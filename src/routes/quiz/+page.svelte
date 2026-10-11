<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import SpeakButton from '$lib/SpeakButton.svelte';
  import {
    buildQuizSession,
    levenshtein,
    bareLemma,
    isMonolingualLevel,
    isB1MonolingualEligible,
    type QuizQuestion,
    type MultipleChoiceQuestion,
    type FillBlankQuestion,
    type TypeAnswerQuestion
  } from '$lib/quiz';
  import { loadProgressMap, loadProgressMapFromSupabase, saveProgress } from '$lib/progress';
  import type { FSRSRating, CardProgress, FlashcardLanguage, VocabEntry } from '$lib/types';
  import { isFreeQuizCategory } from '$lib/access';
  import { quizPoolSize, type QuizCategoryCount, type QuizPayload } from '$lib/quiz-gate';
  import { languageStore } from '$lib/stores/language.svelte';
  import { getTranslation, getExampleTranslation, categoryLabel } from '$lib/vocab-helpers';
  import * as m from '$lib/paraglide/messages';

  let { data } = $props();

  // Types

  type QuizState = 'idle' | 'questioning' | 'revealing' | 'summary';

  interface QuizResult {
    question: QuizQuestion;
    correct: boolean;
    userAnswer: string;
  }

  // State

  let quizState: QuizState = $state('idle');
  let questions: QuizQuestion[] = $state([]);
  let currentIndex = $state(0);
  let selectedOption: number | null = $state(null); // MC only
  let typedAnswer = $state(''); // fill / type
  let isCorrect: boolean | null = $state(null);
  let progressMap: Record<string, CardProgress> = $state({});
  let correctCount = $state(0);
  let results: QuizResult[] = $state([]);
  let inputRef: HTMLInputElement | null = $state(null);

  // Toast for "Mark as easy" confirmation
  let showToast = $state(false);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Idle picker state.
  // Default to A1. data.level (from URL params) overrides if present.
  // untrack() prevents Svelte registering data as a reactive dependency of the
  // $state initializer, fixing the state_referenced_locally warning.
  let selectedLevel: string = $state(untrack(() => (data.level ? data.level.toUpperCase() : 'A1')));
  let selectedCategory: string = $state(untrack(() => data.category ?? ''));

  // Derived

  let isPlus = $derived(page.data.plan === 'plus');
  let userId = $derived(isPlus ? (page.data.user?.id ?? null) : null);

  // The picker is built from per-level, per-category counts (no entry content). The
  // entries of a session come from POST /api/quiz-entries when the user clicks Start
  // (ai-docs/implementation/quiz-server-gating.md).
  const ALL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C'];
  let counts = $derived(data.categories as QuizCategoryCount[]);
  let availableLevels = $derived(ALL_LEVELS.filter((l) => counts.some((c) => c.level === l)));
  // Categories of the selected level that have at least one quizable entry.
  let availableCategories = $derived.by(() => {
    const slugs = counts
      .filter((c) => c.level === selectedLevel && c.vocab + c.uttrykk > 0)
      .map((c) => c.category as string);
    return [...new Set(slugs)].sort();
  });

  // Free users: categories where their plan has at least one entry to quiz on.
  let freeCategories = $derived(
    availableCategories.filter((cat) => quizPoolSize(counts, selectedLevel, cat, false) > 0)
  );

  // Count of Plus-only categories for the upsell badge
  let plusOnlyCount = $derived(availableCategories.length - freeCategories.length);

  // How many entries the current picker selection can quiz on for this plan.
  let quizPoolCount = $derived(quizPoolSize(counts, selectedLevel, selectedCategory, isPlus));

  // canStart: Plus users need a level (always true now); free users need a category
  let canStart = $derived(
    isPlus
      ? selectedLevel !== ''
      : selectedCategory !== '' && isFreeQuizCategory(selectedLevel, selectedCategory)
  );

  // Category list for Plus users (all categories, no lock annotation)
  let categoriesWithLock = $derived.by(() =>
    availableCategories.map((cat) => ({
      cat,
      locked: false
    }))
  );

  let current = $derived(questions[currentIndex]);
  let progress = $derived(
    questions.length > 0 ? Math.round((currentIndex / questions.length) * 100) : 0
  );

  // The session pool, fetched from POST /api/quiz-entries on Start (already gated by
  // plan on the server, quizable entries only). $state.raw: it holds up to ~1,300 big
  // objects that never change in place, so no deep proxy is needed.
  let pool = $state.raw<VocabEntry[]>([]);
  let starting = $state(false);
  // Set when the fetch fails; shown next to the start button, cleared on each attempt.
  let startError = $state(false);
  // Fetched pools by level and category. The plan cannot change without a page load,
  // so a restart reuses the result instead of asking the server again.
  // A plain object, not a Map: nothing renders from it, so it needs no reactivity.
  const payloadCache: Record<string, QuizPayload> = {};

  // Phase 1 (ai-docs/implementation/quiz-i18n-and-categories.md): quiz
  // translation language reuses the same `languageStore` flashcards already
  // use (src/lib/stores/language.svelte.ts) — a dedicated preference,
  // independent of the interface locale, that already covers German. No
  // interface-locale mapping needed.
  let quizLanguage = $derived<FlashcardLanguage>(languageStore.current);

  // Whether the current category pool has at least one entry with a
  // `definition` — mirrors VocabFlashcardPage's `hasDefinitions`, and gates
  // whether a B1 entry is quizzed monolingually (see isB1MonolingualEligible).
  let categoryHasDefinitions = $derived(pool.some((e) => !!e.definition));

  function entryIsMonolingual(entry: import('$lib/types').VocabEntry): boolean {
    return (
      isMonolingualLevel(entry.level) || isB1MonolingualEligible(entry, categoryHasDefinitions)
    );
  }

  onMount(() => {
    if (browser) {
      // Plus users: load from Supabase; guest/free: load from localStorage
      if (isPlus && page.data.user?.id) {
        loadProgressMapFromSupabase(page.data.user.id).then((map) => {
          progressMap = map;
        });
      } else {
        loadProgressMap().then((map) => {
          progressMap = map;
        });
      }
    }
    window.addEventListener('quiz:reset', handleQuizReset);
    return () => {
      window.removeEventListener('quiz:reset', handleQuizReset);
      if (toastTimer) clearTimeout(toastTimer);
    };
  });

  // Quiz control

  async function loadPayload(): Promise<QuizPayload> {
    const key = `${selectedLevel}|${selectedCategory}`;
    const cached = payloadCache[key];
    if (cached) return cached;
    const res = await fetch('/api/quiz-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: selectedLevel, category: selectedCategory || undefined })
    });
    if (!res.ok) throw new Error(`quiz-entries responded ${res.status}`);
    const payload = (await res.json()) as QuizPayload;
    payloadCache[key] = payload;
    return payload;
  }

  async function startQuiz() {
    if (starting) return;
    starting = true;
    startError = false;
    try {
      const { entries, distractors } = await loadPayload();
      if (entries.length === 0) return;
      // Read quiz limit from localStorage (set via Preferences). 'default' or
      // missing → 10. Cap to available entries.
      const raw = browser ? (localStorage.getItem('vocab-quiz-limit') ?? 'default') : 'default';
      const quizCount = raw === 'default' ? 10 : Math.max(1, parseInt(raw, 10) || 10);
      const session = buildQuizSession(
        entries,
        [...entries, ...distractors],
        progressMap,
        quizCount,
        quizLanguage
      );
      // Never enter the questioning state with no `current` question.
      if (session.length === 0) return;
      pool = entries;
      questions = session;
      currentIndex = 0;
      correctCount = 0;
      results = [];
      selectedOption = null;
      typedAnswer = '';
      isCorrect = null;
      quizState = 'questioning';
    } catch (err) {
      // Stay on the picker; the button works again.
      console.error('Could not load quiz entries', err);
      startError = true;
    } finally {
      starting = false;
    }
  }

  async function submitAnswer(userAnswer: string | number) {
    if (!current || quizState !== 'questioning') return;

    let rating: FSRSRating;
    let correct: boolean;
    let answerStr: string;

    if (current.type === 'mc') {
      const q = current as MultipleChoiceQuestion;
      correct = userAnswer === q.correctIndex;
      selectedOption = userAnswer as number;
      answerStr = q.options[userAnswer as number] ?? '';
      rating = correct ? 'good' : 'again';
    } else {
      const q = current as FillBlankQuestion | TypeAnswerQuestion;
      answerStr = (userAnswer as string).trim();
      // Normalise the same way the expected answer was built (bareLemma
      // strips a leading "å " and a trailing gender article like "(en)") so
      // a user typing either the dictionary form or the bare word matches.
      const normalised = bareLemma(answerStr).toLowerCase();
      const expected = q.answer.toLowerCase();
      const dist = levenshtein(normalised, expected);
      if (dist === 0) {
        correct = true;
        rating = 'good';
      } else if (dist <= 1) {
        correct = true;
        rating = 'hard';
      } else {
        correct = false;
        rating = 'again';
      }
      typedAnswer = answerStr;
    }

    if (correct) correctCount++;
    isCorrect = correct;
    results = [...results, { question: current, correct, userAnswer: answerStr }];
    progressMap = await saveProgress(current.entry, rating, progressMap, userId);
    quizState = 'revealing';
  }

  async function markEasy() {
    if (!current || quizState !== 'revealing') return;
    progressMap = await saveProgress(current.entry, 'easy', progressMap, userId);
    // Show a brief confirmation toast
    showToast = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      showToast = false;
    }, 2500);
  }

  function nextQuestion() {
    if (currentIndex < questions.length - 1) {
      currentIndex++;
      selectedOption = null;
      typedAnswer = '';
      isCorrect = null;
      quizState = 'questioning';
    } else {
      quizState = 'summary';
    }
  }

  function goToIdle() {
    quizState = 'idle';
    questions = [];
    currentIndex = 0;
    correctCount = 0;
    results = [];
    selectedOption = null;
    typedAnswer = '';
    isCorrect = null;
  }

  function restartQuiz() {
    startQuiz();
  }

  // Keyboard handling

  function handleKeyDown(e: KeyboardEvent) {
    // The answer input handles Enter itself and calls preventDefault(). Without this
    // guard, the same Enter reaches this window handler after submitAnswer() has
    // already switched to 'revealing' (saving progress to localStorage resolves within
    // the same event dispatch), and it would skip the feedback straight to the next
    // question.
    if (e.defaultPrevented) return;

    const target = e.target as HTMLElement | null;
    const inInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

    if (quizState === 'questioning' && current?.type === 'mc' && !inInput) {
      const keyMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
      const idx = keyMap[e.key.toLowerCase()];
      if (idx !== undefined && idx < (current as MultipleChoiceQuestion).options.length) {
        e.preventDefault();
        submitAnswer(idx);
        return;
      }
    }

    if (quizState === 'revealing') {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        nextQuestion();
      }
    }

    if (quizState === 'summary' && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      restartQuiz();
    }
  }

  // Fired when the user clicks the Quiz nav link while already on /quiz.
  function handleQuizReset() {
    goToIdle();
  }

  // Focus text input when question changes to a fill/type question.
  $effect(() => {
    if (quizState === 'questioning' && current && current.type !== 'mc') {
      setTimeout(() => inputRef?.focus(), 0);
    }
  });

  // Helpers

  function optionLabel(i: number): string {
    return String.fromCharCode(65 + i); // A, B, C, D
  }

  // Phase 2 (ai-docs/implementation/quiz-i18n-and-categories.md): a single
  // categoryLabel() lookup for every category, uttrykk included — no more
  // special-cased m.quiz_category_uttrykk() or raw-slug title-case fallback.
  function formatCategory(cat: string): string {
    return categoryLabel(selectedLevel, cat);
  }

  function formatLevel(level: string): string {
    return level.toUpperCase();
  }

  function scoreEmoji(correct: number, total: number): string {
    const pct = total > 0 ? correct / total : 0;
    if (pct >= 0.9) return '🎉';
    if (pct >= 0.7) return '👍';
    if (pct >= 0.5) return '💪';
    return '📖';
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<svelte:head>
  <title>
    {selectedLevel && selectedCategory
      ? `Quiz · ${formatLevel(selectedLevel)} · ${formatCategory(selectedCategory)} — Norskeord`
      : selectedLevel
        ? `Quiz · ${formatLevel(selectedLevel)} — Norskeord`
        : 'Quiz — Norskeord'}
  </title>
</svelte:head>

<!-- "Mark as easy" confirmation toast (fixed, bottom-centre) -->
{#if showToast}
  <div class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2" role="status" aria-live="polite">
    <div
      class="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-medium text-white shadow-lg"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        class="h-4 w-4 shrink-0"
      >
        <path
          fill-rule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clip-rule="evenodd"
        />
      </svg>
      {m.quiz_marked_easy_toast()}
    </div>
  </div>
{/if}

<div class="mx-auto max-w-2xl px-4 py-10 text-left">
  {#if quizState !== 'idle'}
    <div class="mb-4">
      <button
        type="button"
        onclick={goToIdle}
        class="inline-flex items-center gap-1 text-sm text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300"
      >
        ← {m.quiz_title()}
      </button>
    </div>
  {/if}
  {#if quizState === 'idle'}
    <div>
      <h1 class="mb-2">{m.quiz_title()}</h1>
      <p class="mb-8 text-gray-600 dark:text-gray-300">
        {m.quiz_subtitle()}
      </p>

      <div class="mb-8 space-y-4 text-left">
        <!-- Level -->
        <div>
          <label
            for="quiz-level"
            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {m.quiz_label_level()}
          </label>
          <select
            id="quiz-level"
            bind:value={selectedLevel}
            onchange={() => {
              selectedCategory = '';
            }}
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none dark:border-gray-600 dark:bg-indigo-950/60 dark:text-gray-200"
          >
            {#each availableLevels as level (level)}
              <option value={level}>{formatLevel(level)}</option>
            {/each}
          </select>
        </div>

        <!-- Category -->
        <div>
          <label
            for="quiz-category"
            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {m.quiz_label_category()}
            {#if isPlus}<span class="font-normal text-gray-400"
                >{m.quiz_label_category_optional()}</span
              >{/if}
          </label>
          {#if isPlus}
            <!-- Plus: full category select -->
            <select
              id="quiz-category"
              bind:value={selectedCategory}
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none dark:border-gray-600 dark:bg-indigo-950/60 dark:text-gray-200"
            >
              <option value="">{m.quiz_label_all_categories()}</option>
              {#each categoriesWithLock as { cat } (cat)}
                <option value={cat}>{formatCategory(cat)}</option>
              {/each}
            </select>
          {:else}
            <!-- Free: curated button list + upsell -->
            <div class="flex flex-wrap gap-2">
              {#each freeCategories as cat (cat)}
                <button
                  type="button"
                  onclick={() => {
                    selectedCategory = cat;
                  }}
                  class="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors
                    {selectedCategory === cat
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'border-gray-300 text-gray-600 hover:border-indigo-400 hover:bg-indigo-50 dark:border-gray-600 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/20'}"
                >
                  {formatCategory(cat)}
                </button>
              {/each}
              {#if plusOnlyCount > 0}
                <a
                  href="/plus?ref=quiz-category-upsell"
                  class="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-500 transition-colors hover:border-indigo-400 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:border-indigo-600"
                >
                  {m.quiz_plus_only_count({ count: plusOnlyCount })}
                </a>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <p class="mb-6 text-sm text-gray-600 dark:text-gray-300">
        {m.quiz_pool_hint({
          count: quizPoolCount,
          session: Math.min(
            browser ? parseInt(localStorage.getItem('vocab-quiz-limit') ?? '10') || 10 : 10,
            quizPoolCount
          )
        })}
      </p>

      <button
        type="button"
        onclick={startQuiz}
        disabled={quizPoolCount === 0 || !canStart || starting}
        class="rounded-lg bg-indigo-600 px-8 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 dark:bg-indigo-500 dark:hover:bg-indigo-600"
      >
        {starting ? m.stats_loading() : m.quiz_start()}
      </button>
      {#if startError}
        <p
          role="alert"
          data-testid="quiz-start-error"
          class="mt-3 text-sm text-red-700 dark:text-red-400"
        >
          {m.quiz_start_load_error()}
        </p>
      {/if}
    </div>
  {:else if quizState === 'questioning' && current}
    <!-- Page heading -->
    <div class="mb-5">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">
        🧠 {m.quiz_title()}{selectedLevel
          ? ` · ${formatLevel(selectedLevel)}`
          : ''}{selectedCategory ? ` · ${formatCategory(selectedCategory)}` : ''}
      </h1>
    </div>

    <!-- Progress bar -->
    <div class="mb-6">
      <div class="mb-1 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
        <span>{m.quiz_question_count({ current: currentIndex + 1, total: questions.length })}</span>
        <span>{m.quiz_correct_so_far({ count: correctCount })}</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          class="h-full rounded-full bg-indigo-500 transition-all duration-300"
          style="width: {progress}%"
        ></div>
      </div>
    </div>

    <!-- Question card -->
    <div
      class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-indigo-950/60"
    >
      {#if current.type === 'mc'}
        {@const q = current as MultipleChoiceQuestion}
        <p
          class="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-300"
        >
          {m.quiz_mc_prompt()}
        </p>
        <p class="mb-6 text-3xl font-bold text-gray-900 dark:text-white">{q.prompt}</p>
        <div class="space-y-3">
          {#each q.options as option, i (i)}
            <button
              type="button"
              onclick={() => submitAnswer(i)}
              class="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:border-indigo-400 hover:bg-indigo-50 focus:ring-2 focus:ring-indigo-300 focus:outline-none dark:border-gray-600 dark:text-gray-200 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/20"
            >
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold dark:bg-gray-700"
              >
                {optionLabel(i)}
              </span>
              {option}
            </button>
          {/each}
        </div>
        <p class="mt-4 text-xs text-gray-700 dark:text-gray-300">{m.quiz_mc_hint()}</p>
      {:else if current.type === 'fill'}
        {@const q = current as FillBlankQuestion}
        <p
          class="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-300"
        >
          {m.quiz_fill_prompt()}
        </p>
        <p
          class="{q.isFallback
            ? 'mb-6'
            : 'mb-2'} text-lg font-medium text-gray-900 italic dark:text-white"
        >
          "{q.sentence}"
        </p>
        <!-- The fallback sentence already contains the translation/definition. -->
        {#if !q.isFallback}
          <p class="mb-6 text-sm text-indigo-500 dark:text-indigo-400">
            {entryIsMonolingual(q.entry)
              ? (q.entry.definition ?? getTranslation(q.entry, quizLanguage))
              : getTranslation(q.entry, quizLanguage)}
          </p>
        {/if}
        <div class="flex gap-2">
          <input
            bind:this={inputRef}
            type="text"
            bind:value={typedAnswer}
            placeholder={m.quiz_fill_placeholder()}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitAnswer(typedAnswer);
              }
            }}
            class="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
          />
          <button
            type="button"
            onclick={() => submitAnswer(typedAnswer)}
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 focus:outline-none"
          >
            {m.quiz_check()}
          </button>
        </div>
        <div class="mt-3 flex gap-3">
          <button
            type="button"
            onclick={() => submitAnswer('')}
            class="text-xs text-gray-400 hover:text-gray-600 hover:underline dark:hover:text-gray-300"
          >
            {m.quiz_skip()}
          </button>
        </div>
      {:else}
        {@const q = current as TypeAnswerQuestion}
        <p
          class="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-300"
        >
          {m.quiz_type_prompt()}
        </p>
        <p class="mb-6 text-3xl font-bold text-gray-900 dark:text-white">"{q.prompt}"</p>
        <div class="flex gap-2">
          <input
            bind:this={inputRef}
            type="text"
            bind:value={typedAnswer}
            placeholder={m.quiz_type_placeholder()}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitAnswer(typedAnswer);
              }
            }}
            class="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
          />
          <button
            type="button"
            onclick={() => submitAnswer(typedAnswer)}
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 focus:outline-none"
          >
            {m.quiz_check()}
          </button>
        </div>
        <div class="mt-3">
          <button
            type="button"
            onclick={() => submitAnswer('')}
            class="text-xs text-gray-400 hover:text-gray-600 hover:underline dark:hover:text-gray-300"
          >
            {m.quiz_skip()}
          </button>
        </div>
      {/if}
    </div>
  {:else if quizState === 'revealing' && current}
    <!-- Page heading -->
    <div class="mb-5">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">
        🧠 {m.quiz_title()}{selectedLevel
          ? ` · ${formatLevel(selectedLevel)}`
          : ''}{selectedCategory ? ` · ${formatCategory(selectedCategory)}` : ''}
      </h1>
    </div>

    <!-- Progress bar (frozen at current position) -->
    <div class="mb-6">
      <div class="mb-1 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
        <span>{m.quiz_question_count({ current: currentIndex + 1, total: questions.length })}</span>
        <span>{m.quiz_correct_so_far({ count: correctCount })}</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          class="h-full rounded-full bg-indigo-500 transition-all duration-300"
          style="width: {progress}%"
        ></div>
      </div>
    </div>

    <!-- Result card -->
    <div
      class="rounded-2xl border {isCorrect
        ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
        : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'} p-6 shadow-sm"
    >
      <div class="mb-4 flex items-center gap-2">
        {#if isCorrect}
          <span class="text-2xl">✓</span>
          <span class="font-semibold text-green-700 dark:text-green-300">{m.quiz_correct()}</span>
        {:else}
          <span class="text-2xl">✗</span>
          <span class="font-semibold text-red-700 dark:text-red-300">{m.quiz_incorrect()}</span>
        {/if}
      </div>

      {#if current.type === 'mc'}
        {@const q = current as MultipleChoiceQuestion}
        <div class="mb-4 space-y-2">
          {#each q.options as option, i (i)}
            <div
              class="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm
              {i === q.correctIndex
                ? 'bg-green-100 font-semibold text-green-800 dark:bg-green-800/30 dark:text-green-200'
                : i === selectedOption && !isCorrect
                  ? 'bg-red-100 text-red-700 dark:bg-red-800/30 dark:text-red-300'
                  : 'text-gray-600 dark:text-gray-300'}"
            >
              <span
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold
                {i === q.correctIndex
                  ? 'bg-green-200 dark:bg-green-700'
                  : i === selectedOption && !isCorrect
                    ? 'bg-red-200 dark:bg-red-700'
                    : 'bg-gray-100 dark:bg-gray-700'}"
              >
                {optionLabel(i)}
              </span>
              {option}
              {#if i === q.correctIndex}
                <span class="ml-auto text-green-600 dark:text-green-400">✓</span>
              {:else if i === selectedOption && !isCorrect}
                <span class="ml-auto text-red-500 dark:text-red-400">✗</span>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        {@const q = current as FillBlankQuestion | TypeAnswerQuestion}
        {#if !isCorrect}
          <p
            class="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
          >
            {m.quiz_correct_answer()}
          </p>
          <p class="mb-4 text-xl font-bold text-gray-800 dark:text-white">{q.answer}</p>
        {/if}
        {#if typedAnswer && typedAnswer !== q.answer}
          <p class="mb-4 text-sm text-gray-600 dark:text-gray-300">
            {m.quiz_you_wrote()}
            <span class="font-medium text-gray-700 dark:text-gray-200">{typedAnswer || '—'}</span>
          </p>
        {/if}
      {/if}

      <!-- Answer word + its own Pronounce button -->
      <div class="mb-3 flex items-center gap-3">
        <span class="text-lg font-bold text-gray-800 dark:text-white">
          {current.entry.norsk}
        </span>
        {#if current.entry.sense}
          <span
            class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >{current.entry.sense}</span
          >
        {/if}
        <SpeakButton word={current.entry.norsk} label={m.speak_pronounce_word()} />
        <span class="text-xs text-gray-600 dark:text-gray-300">
          {current.entry.part} · {current.entry.level}
        </span>
      </div>

      <!-- Example sentence with its own separate Pronounce sentence button -->
      <div class="rounded-lg bg-white/60 px-4 py-3 dark:bg-indigo-950/60">
        <p class="text-sm text-gray-700 italic dark:text-gray-300">
          {current.entry.example}
        </p>
        {#if !entryIsMonolingual(current.entry)}
          <p class="mt-1 text-xs text-gray-600 dark:text-gray-300">
            {getExampleTranslation(current.entry, quizLanguage) ?? current.entry.example_english}
          </p>
        {/if}
        <div class="mt-2">
          <SpeakButton word={current.entry.example} label={m.speak_pronounce_sentence()} />
        </div>
      </div>

      <!-- Actions row -->
      <div class="mt-5 flex items-center justify-between">
        {#if isCorrect}
          <button
            type="button"
            onclick={markEasy}
            class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 focus:ring-2 focus:ring-gray-200 focus:outline-none dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-200"
          >
            {m.quiz_mark_easy()}
          </button>
        {:else}
          <span></span>
        {/if}

        <button
          type="button"
          onclick={nextQuestion}
          class="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 focus:outline-none"
        >
          {currentIndex < questions.length - 1 ? m.quiz_next() : m.quiz_see_results()}
        </button>
      </div>
      <p class="mt-2 text-right text-xs text-gray-700 dark:text-gray-300">
        {m.quiz_continue_hint()}
      </p>
    </div>
  {:else if quizState === 'summary'}
    <div>
      <p class="mb-1 text-5xl">{scoreEmoji(correctCount, questions.length)}</p>
      <h2 class="mt-3">{m.quiz_session_done()}</h2>
      <p class="mt-2 text-lg text-gray-600 dark:text-gray-300">
        {m.quiz_score({ correct: correctCount, total: questions.length })}
      </p>

      <!-- Per-question result list -->
      <div class="mt-8 space-y-2 text-left">
        {#each results as result, i (i)}
          <div
            class="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm
            {result.correct
              ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10'
              : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10'}"
          >
            <span class="mt-0.5 text-base {result.correct ? 'text-green-500' : 'text-red-500'}">
              {result.correct ? '✓' : '✗'}
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-gray-800 dark:text-gray-100">
                {result.question.entry.norsk}
                {#if result.question.entry.sense}
                  <span class="text-xs font-normal text-gray-500 dark:text-gray-400"
                    >({result.question.entry.sense})</span
                  >
                {/if}
                <span class="ml-1 font-normal text-gray-600 dark:text-gray-300">
                  — {entryIsMonolingual(result.question.entry)
                    ? (result.question.entry.definition ??
                      getTranslation(result.question.entry, quizLanguage))
                    : getTranslation(result.question.entry, quizLanguage)}
                </span>
              </p>
              {#if !result.correct && result.userAnswer}
                <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                  {m.quiz_you_answered()}
                  {result.userAnswer}
                </p>
              {/if}
            </div>
            <span
              class="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            >
              {result.question.type === 'mc'
                ? m.quiz_type_mc()
                : result.question.type === 'fill'
                  ? m.quiz_type_fill()
                  : m.quiz_type_type()}
            </span>
          </div>
        {/each}
      </div>

      <!-- Next quiz picker -->
      <div class="mt-8 space-y-4 text-left">
        <p class="text-sm font-medium text-gray-600 dark:text-gray-300">
          {m.quiz_next_settings_heading()}
        </p>
        <!-- Level -->
        <div>
          <label
            for="summary-level"
            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {m.quiz_label_level()}
          </label>
          <select
            id="summary-level"
            bind:value={selectedLevel}
            onchange={() => {
              selectedCategory = '';
            }}
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none dark:border-gray-600 dark:bg-indigo-950/60 dark:text-gray-200"
          >
            {#each availableLevels as level (level)}
              <option value={level}>{formatLevel(level)}</option>
            {/each}
          </select>
        </div>
        <!-- Category -->
        <div>
          <label
            for="summary-category"
            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {m.quiz_label_category()}
            {#if isPlus}<span class="font-normal text-gray-400"
                >{m.quiz_label_category_optional()}</span
              >{/if}
          </label>
          {#if isPlus}
            <select
              id="summary-category"
              bind:value={selectedCategory}
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none dark:border-gray-600 dark:bg-indigo-950/60 dark:text-gray-200"
            >
              <option value="">{m.quiz_label_all_categories()}</option>
              {#each categoriesWithLock as { cat } (cat)}
                <option value={cat}>{formatCategory(cat)}</option>
              {/each}
            </select>
          {:else}
            <div class="flex flex-wrap gap-2">
              {#each freeCategories as cat (cat)}
                <button
                  type="button"
                  onclick={() => {
                    selectedCategory = cat;
                  }}
                  class="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors
                    {selectedCategory === cat
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'border-gray-300 text-gray-600 hover:border-indigo-400 hover:bg-indigo-50 dark:border-gray-600 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/20'}"
                >
                  {formatCategory(cat)}
                </button>
              {/each}
              {#if plusOnlyCount > 0}
                <a
                  href="/plus?ref=quiz-category-upsell"
                  class="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-500 transition-colors hover:border-indigo-400 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:border-indigo-600"
                >
                  {m.quiz_plus_only_count({ count: plusOnlyCount })}
                </a>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <!-- Action buttons -->
      <div class="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onclick={startQuiz}
          disabled={quizPoolCount === 0 || !canStart || starting}
          class="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          {m.quiz_restart()}
        </button>
      </div>
      {#if startError}
        <p role="alert" class="mt-3 text-sm text-red-700 dark:text-red-400">
          {m.quiz_start_load_error()}
        </p>
      {/if}
      <p class="mt-4 text-xs text-gray-700 dark:text-gray-300">
        {m.quiz_restart_hint()}
      </p>
    </div>
  {/if}
</div>
