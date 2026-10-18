<script lang="ts">
  /**
   * /review/grammar — due-only grammar review (Fix 3,
   * ai-docs/implementation/due-only-review-update.md). Kept as its own
   * route rather than folded into /review (see the Open Questions
   * resolution in that doc) — grammar's due badges (LevelStatRows.svelte,
   * reviewType="grammar") link here directly, never through /review.
   *
   * Query params:
   *   ?level=b1        restrict to one CEFR level (omit = all levels)
   *   ?topic=v2-word-order
   *                    restrict to one grammar topic (used by the
   *                    per-topic due badge — LevelStatRows.svelte). Matched
   *                    against the question's live topic (id-index.ts), so
   *                    progress saved under a retired topic id still counts.
   *   ?chapter=pronomen
   *                    restrict to one chapter of the grammar book (its
   *                    primary topics; slug from grammar/taxonomy.ts). Used
   *                    by the per-chapter due links on /my-progress/grammar
   *                    (grammar-update.md, Phase 7). An unknown slug shows the
   *                    empty state instead of reviewing everything.
   *
   * This is a lighter renderer than GrammarSession.svelte, by design (see
   * the Fix 3 discussion in due-only-review-update.md): it doesn't call
   * buildGrammarSession() (which prioritises by due-date among ALL
   * questions in a pool, due or not, and caps at a fixed session size) — it
   * takes the already-resolved due-only list directly and just shuffles it
   * once for display order. Restart reshuffles that same fixed list (no
   * re-fetch, no session-size cap) — the same-batch loop + practice-only
   * repeat-rating refinement from Fix 1 is vocab-specific and intentionally
   * out of scope here; a plain restart is enough for grammar for now.
   */
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import type { CardProgress, CEFRLevel, GrammarQuestion, GrammarTopic } from '$lib/types';
  import {
    loadGrammarProgressMap,
    loadGrammarProgressFromSupabase,
    saveGrammarProgress,
    getDueGrammarItems,
    countDueToday
  } from '$lib/progress';
  import { gradeGrammarAnswer } from '$lib/grammar/session';
  import { resolveGrammarQuestion } from '$lib/grammar/id-index';
  import { chapterScope, dueInScope } from '$lib/grammar/review-scope';
  import { GRAMMAR_RULES } from '$lib/grammar/rules';
  import * as m from '$lib/paraglide/messages';
  import FillQuestion from '$lib/components/grammar/FillQuestion.svelte';
  import OrderQuestion from '$lib/components/grammar/OrderQuestion.svelte';
  import TransformQuestion from '$lib/components/grammar/TransformQuestion.svelte';
  import MinimalPairQuestion from '$lib/components/grammar/MinimalPairQuestion.svelte';
  import MultipleChoiceQuestion from '$lib/components/grammar/MultipleChoiceQuestion.svelte';
  import PunctuationQuestion from '$lib/components/grammar/PunctuationQuestion.svelte';
  import AnswerReveal from '$lib/components/grammar/AnswerReveal.svelte';
  import GrammarSummary from '$lib/components/grammar/GrammarSummary.svelte';

  const LEVELS: readonly CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C'];

  function parseLevel(v: string | null): CEFRLevel | undefined {
    if (!v) return undefined;
    const upper = v.toUpperCase();
    return (LEVELS as readonly string[]).includes(upper) ? (upper as CEFRLevel) : undefined;
  }

  let levelParam = $derived(parseLevel(page.url.searchParams.get('level')));
  let topicParam = $derived(
    (page.url.searchParams.get('topic') as GrammarTopic | null) ?? undefined
  );

  type Phase = 'loading' | 'empty' | 'questioning' | 'revealing' | 'summary';

  interface GrammarResult {
    question: GrammarQuestion;
    correct: boolean;
    userAnswer: string;
  }

  let phase = $state<Phase>('loading');
  // Fixed due-only pool fetched once per page load — Restart reshuffles
  // this same array rather than re-fetching (see file doc comment above).
  let duePool = $state<GrammarQuestion[]>([]);
  let questions = $state<GrammarQuestion[]>([]);
  let currentIndex = $state(0);
  let progressMap = $state<Record<string, CardProgress>>({});
  let correctCount = $state(0);
  let results = $state<GrammarResult[]>([]);
  let isCorrect = $state<boolean | null>(null);
  let userAnswer = $state('');
  // Set once any save fails in this session; cleared on restart. Progress stays in memory.
  let saveFailed = $state(false);

  let isPlus = $derived(page.data.plan === 'plus');
  let userId = $derived(isPlus ? (page.data.user?.id ?? null) : null);
  let fsrsRetention = $derived((page.data.fsrsRetention as number | null | undefined) ?? null);

  let current = $derived(questions[currentIndex]);
  let currentRule = $derived(current ? GRAMMAR_RULES[current.topic] : undefined);
  let progress = $derived(
    questions.length > 0 ? Math.round((currentIndex / questions.length) * 100) : 0
  );
  let dueSoon = $derived(countDueToday(progressMap));

  /** Fisher–Yates shuffle (returns a new array). */
  function shuffle<T>(arr: T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function start() {
    questions = shuffle(duePool);
    currentIndex = 0;
    correctCount = 0;
    results = [];
    isCorrect = null;
    userAnswer = '';
    saveFailed = false;
    phase = questions.length > 0 ? 'questioning' : 'empty';
  }

  async function loadSession() {
    phase = 'loading';

    progressMap =
      isPlus && userId ? await loadGrammarProgressFromSupabase(userId) : loadGrammarProgressMap();

    // `resolve` makes the level/topic filters use each question's CURRENT
    // topic/level (grammar/id-index.ts), not the snapshot stored on the
    // progress row, which is stale for cards reviewed before Phase 1b.
    const dueItems = dueInScope(
      getDueGrammarItems(progressMap, {
        level: levelParam,
        topic: topicParam,
        resolve: resolveGrammarQuestion
      }),
      chapterScope(page.url.searchParams.get('chapter')),
      (id) => resolveGrammarQuestion(id)?.topic
    );

    if (dueItems.length === 0) {
      duePool = [];
      phase = 'empty';
      return;
    }

    const res = await fetch('/api/review-grammar-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: dueItems.map((d) => ({ id: d.id, level: d.level })) })
    });
    const json = await res.json().catch(() => ({ entries: [] }));
    duePool = (json.entries as GrammarQuestion[] | undefined) ?? [];
    start();
  }

  onMount(() => {
    void loadSession();
  });

  async function submit(answer: string) {
    if (!current || phase !== 'questioning') return;
    const { correct, rating } = gradeGrammarAnswer(answer, current);
    userAnswer = answer.trim();
    isCorrect = correct;
    if (correct) correctCount++;
    results = [...results, { question: current, correct, userAnswer }];
    const saveResult = await saveGrammarProgress(
      current,
      rating,
      progressMap,
      userId,
      fsrsRetention
    );
    progressMap = saveResult.progress;
    if (!saveResult.saved) saveFailed = true;
    phase = 'revealing';
  }

  function next() {
    if (currentIndex < questions.length - 1) {
      currentIndex++;
      isCorrect = null;
      userAnswer = '';
      phase = 'questioning';
    } else {
      phase = 'summary';
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (phase === 'revealing' && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      next();
    }
    if (phase === 'summary' && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      start();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<svelte:head>
  <title>{m.grammar_title()} · {m.stats_due_today()} — Norskeord</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-10 text-left">
  {#if phase === 'loading'}
    <p class="py-16 text-center text-sm text-gray-600 dark:text-gray-300">…</p>
  {:else if phase === 'empty'}
    <div class="mx-auto mt-6 max-w-md px-4 text-center">
      <p class="text-2xl">🎉</p>
      <p class="mt-3 text-lg font-medium text-gray-800 dark:text-gray-100">
        {m.grammar_empty()}
      </p>
      <div class="mt-5 flex justify-center gap-4 text-sm">
        <a
          href="/my-progress"
          class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {m.stats_title()}
        </a>
        <a href="/grammar" class="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          {m.grammar_back_to_topics()}
        </a>
      </div>
    </div>
  {:else if phase === 'summary'}
    <GrammarSummary {results} total={questions.length} {correctCount} {dueSoon} onrestart={start} />
  {:else if current}
    <!-- Progress bar -->
    <div class="mb-6">
      <div class="mb-1 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
        <span
          >{m.grammar_question_count({ current: currentIndex + 1, total: questions.length })}</span
        >
        <span>{m.grammar_correct_so_far({ count: correctCount })}</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          class="h-full rounded-full bg-indigo-500 transition-all duration-300"
          style="width: {progress}%"
        ></div>
      </div>
    </div>

    {#if saveFailed}
      <p
        role="status"
        class="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
      >
        {m.grammar_save_failed()}
      </p>
    {/if}

    {#if phase === 'questioning'}
      <div
        class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-indigo-950/60"
      >
        {#if current.cefr}
          <span
            class="mb-3 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300"
          >
            {current.cefr}
          </span>
        {/if}
        {#if current.type === 'fill'}
          <FillQuestion question={current} onsubmit={submit} />
        {:else if current.type === 'order'}
          <OrderQuestion question={current} onsubmit={submit} />
        {:else if current.type === 'minimal-pair'}
          <MinimalPairQuestion question={current} onsubmit={submit} />
        {:else if current.type === 'multiple-choice'}
          <MultipleChoiceQuestion question={current} onsubmit={submit} />
        {:else if current.type === 'punctuation'}
          <PunctuationQuestion question={current} onsubmit={submit} />
        {:else}
          <TransformQuestion question={current} onsubmit={submit} />
        {/if}
      </div>
    {:else if phase === 'revealing'}
      <AnswerReveal
        question={current}
        rule={currentRule}
        isCorrect={isCorrect ?? false}
        {userAnswer}
        isLast={currentIndex >= questions.length - 1}
        onnext={next}
      />
    {/if}
  {/if}
</div>
