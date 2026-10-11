<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import type { CardProgress, GrammarQuestion, GrammarRule } from '$lib/types';
  import {
    loadGrammarProgressMap,
    loadGrammarProgressFromSupabase,
    saveGrammarProgress,
    countDueToday
  } from '$lib/progress';
  import { buildGrammarSession, gradeGrammarAnswer } from '$lib/grammar/session';
  import { GRAMMAR_RULES } from '$lib/grammar/rules';
  import * as m from '$lib/paraglide/messages';
  import FillQuestion from './FillQuestion.svelte';
  import OrderQuestion from './OrderQuestion.svelte';
  import TransformQuestion from './TransformQuestion.svelte';
  import MinimalPairQuestion from './MinimalPairQuestion.svelte';
  import MultipleChoiceQuestion from './MultipleChoiceQuestion.svelte';
  import PunctuationQuestion from './PunctuationQuestion.svelte';
  import AnswerReveal from './AnswerReveal.svelte';
  import GrammarSummary from './GrammarSummary.svelte';

  let {
    questions: pool,
    rule,
    userId,
    onprogressloaded
  }: {
    questions: GrammarQuestion[];
    rule: GrammarRule | undefined;
    userId: string | null;
    /** Called once with the loaded progress map, before the first session is built. */
    onprogressloaded?: (map: Record<string, CardProgress>) => void;
  } = $props();

  type SessionState = 'loading' | 'questioning' | 'revealing' | 'summary';

  interface GrammarResult {
    question: GrammarQuestion;
    correct: boolean;
    userAnswer: string;
  }

  const SESSION_SIZE = 10;

  let sessionState = $state<SessionState>('loading');
  let questions = $state<GrammarQuestion[]>([]);
  let currentIndex = $state(0);
  let progressMap = $state<Record<string, CardProgress>>({});
  let correctCount = $state(0);
  let results = $state<GrammarResult[]>([]);
  let isCorrect = $state<boolean | null>(null);
  let userAnswer = $state('');
  let questionBox = $state<HTMLElement | null>(null);
  let summaryBox = $state<HTMLElement | null>(null);

  // FSRS review-intensity preset from layout server (0.8/0.9/0.95, or null for
  // default Standard). Only meaningful when userId is set (Plus users).
  let fsrsRetention = $derived((page.data.fsrsRetention as number | null | undefined) ?? null);

  let current = $derived(questions[currentIndex]);
  // Single-topic pages pass `rule`; chapter practice mixes topics, so it passes
  // none and each question's own topic rule is shown after answering.
  let currentRule = $derived(rule ?? (current ? GRAMMAR_RULES[current.topic] : undefined));
  let progress = $derived(
    questions.length > 0 ? Math.round((currentIndex / questions.length) * 100) : 0
  );
  let dueSoon = $derived(countDueToday(progressMap));

  onMount(() => {
    (async () => {
      if (browser) {
        progressMap = userId
          ? await loadGrammarProgressFromSupabase(userId)
          : loadGrammarProgressMap();
        onprogressloaded?.(progressMap);
      }
      start();
    })();
  });

  function start() {
    questions = buildGrammarSession(pool, progressMap, SESSION_SIZE);
    currentIndex = 0;
    correctCount = 0;
    results = [];
    isCorrect = null;
    userAnswer = '';
    sessionState = questions.length > 0 ? 'questioning' : 'summary';
  }

  // Option question types have no input to focus themselves, so without this focus
  // would be left on <body> after the previous view (reveal or summary) goes away.
  // Typed question types focus their own input.
  function focusOptionQuestion() {
    if (current && ['minimal-pair', 'multiple-choice', 'punctuation'].includes(current.type)) {
      questionBox?.focus();
    }
  }

  // Restart from the summary (button or R). Unlike the first start on mount, this
  // follows a keyboard action that removed the focused element, so focus is moved
  // to the first question. The mount path must not take focus on page load.
  async function restart() {
    start();
    await tick();
    focusOptionQuestion();
  }

  async function submit(answer: string) {
    if (!current || sessionState !== 'questioning') return;
    const { correct, rating } = gradeGrammarAnswer(answer, current);
    userAnswer = answer.trim();
    isCorrect = correct;
    if (correct) correctCount++;
    results = [...results, { question: current, correct, userAnswer }];
    progressMap = await saveGrammarProgress(current, rating, progressMap, userId, fsrsRetention);
    sessionState = 'revealing';
  }

  async function next() {
    if (currentIndex < questions.length - 1) {
      currentIndex++;
      isCorrect = null;
      userAnswer = '';
      sessionState = 'questioning';
      await tick();
      focusOptionQuestion();
    } else {
      sessionState = 'summary';
      await tick();
      // Move focus into the summary so the R shortcut (active only while focus is
      // inside it) works and screen readers announce the result.
      summaryBox?.focus();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    // The Enter that submits an answer must not also count as "next". Free and
    // guest users save to localStorage with no network await, so submit() reaches
    // 'revealing' in microtasks *between* the input's handler and this window
    // handler for the same keypress, which would skip the reveal at once. Plus
    // users never hit it (the Supabase await keeps the reveal alive). Skip keys
    // already handled by the question component, held-down (auto-repeat) keys,
    // and keys typed in a field. Links and buttons handle Enter/Space themselves,
    // so they are left alone (otherwise "Les mer →" could never be followed). The
    // single-key R shortcut is only active while focus is inside the summary
    // (WCAG 2.1.4).
    if (e.defaultPrevented || e.repeat) return;
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const isInteractive = tag === 'A' || tag === 'BUTTON';

    if (sessionState === 'revealing' && !isInteractive && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      next();
    }
    if (
      sessionState === 'summary' &&
      (e.key === 'r' || e.key === 'R') &&
      target &&
      summaryBox?.contains(target)
    ) {
      e.preventDefault();
      restart();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if sessionState === 'loading'}
  <div class="py-16 text-center text-sm text-gray-600 dark:text-gray-300">…</div>
{:else if sessionState === 'summary'}
  {#if questions.length === 0}
    <p class="py-16 text-center text-sm text-gray-600 dark:text-gray-300">{m.grammar_empty()}</p>
  {:else}
    <div
      bind:this={summaryBox}
      role="region"
      tabindex="-1"
      aria-label={m.grammar_summary_done()}
      class="rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-400"
    >
      <GrammarSummary
        {results}
        total={questions.length}
        {correctCount}
        {dueSoon}
        onrestart={restart}
      />
    </div>
  {/if}
{:else if current}
  <!-- Progress bar -->
  <div class="mb-6">
    <div class="mb-1 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
      <span>{m.grammar_question_count({ current: currentIndex + 1, total: questions.length })}</span
      >
      <span>{m.grammar_correct_so_far({ count: correctCount })}</span>
    </div>
    <div
      aria-hidden="true"
      class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
    >
      <div
        class="h-full rounded-full bg-indigo-500 transition-all duration-300"
        style="width: {progress}%"
      ></div>
    </div>
  </div>

  {#if sessionState === 'questioning'}
    <div
      bind:this={questionBox}
      role="group"
      tabindex="-1"
      aria-label={m.grammar_question_count({ current: currentIndex + 1, total: questions.length })}
      class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-gray-700 dark:bg-indigo-950/60 dark:focus-visible:outline-indigo-400"
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
  {:else if sessionState === 'revealing'}
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
