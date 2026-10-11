<script lang="ts">
  import type { GrammarQuestion } from '$lib/types';
  import * as m from '$lib/paraglide/messages';

  interface GrammarResult {
    question: GrammarQuestion;
    correct: boolean;
    userAnswer: string;
  }

  let {
    results,
    total,
    correctCount,
    dueSoon,
    onrestart
  }: {
    results: GrammarResult[];
    total: number;
    correctCount: number;
    dueSoon: number;
    onrestart: () => void;
  } = $props();

  function scoreEmoji(correct: number, t: number): string {
    const pct = t > 0 ? correct / t : 0;
    if (pct >= 0.9) return '🎉';
    if (pct >= 0.7) return '👍';
    if (pct >= 0.5) return '💪';
    return '📖';
  }

  function stimulus(q: GrammarQuestion): string {
    if (q.type === 'fill') return q.sentence ?? q.answer;
    if (q.type === 'transform') return q.source ?? q.answer;
    if (q.type === 'order') return (q.tokens ?? []).join(' / ');
    if (q.type === 'minimal-pair') return `A: ${q.optionA}  |  B: ${q.optionB}`;
    if (q.type === 'multiple-choice') return q.prompt ?? (q.options ?? []).join(' / ');
    return q.answer;
  }

  function correctDisplay(q: GrammarQuestion): string {
    if (q.type === 'minimal-pair') {
      return `${q.answer}: ${q.answer === 'A' ? q.optionA : q.optionB}`;
    }
    return q.answer;
  }
</script>

<div class="text-center">
  <p aria-hidden="true" class="mb-1 text-5xl">{scoreEmoji(correctCount, total)}</p>
  <h2 class="mt-3 text-2xl font-bold dark:text-white">{m.grammar_summary_done()}</h2>
  <p class="mt-2 text-lg text-gray-600 dark:text-gray-300">
    {m.grammar_summary_score({ correct: correctCount, total })}
  </p>
  {#if dueSoon > 0}
    <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
      {m.grammar_summary_due_soon({ count: dueSoon })}
    </p>
  {/if}

  <!-- Per-question result list -->
  <div class="mt-8 space-y-2 text-left">
    {#each results as result, i (i)}
      <div
        class="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm
        {result.correct
          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10'
          : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10'}"
      >
        <span
          aria-hidden="true"
          class="mt-0.5 text-base {result.correct ? 'text-green-500' : 'text-red-500'}"
        >
          {result.correct ? '✓' : '✗'}
        </span>
        <span class="sr-only">{result.correct ? 'Riktig' : 'Feil'}</span>
        <div class="min-w-0 flex-1">
          <p class="text-gray-600 dark:text-gray-300">{stimulus(result.question)}</p>
          <p class="mt-0.5 font-medium text-gray-800 dark:text-gray-100">
            {correctDisplay(result.question)}
          </p>
          {#if !result.correct && result.userAnswer}
            <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
              {m.grammar_summary_you_wrote()}
              {result.userAnswer}
            </p>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <div class="mt-8 flex flex-wrap justify-center gap-3">
    <button
      type="button"
      onclick={onrestart}
      class="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 focus:outline-none dark:bg-indigo-500 dark:hover:bg-indigo-600"
    >
      {m.grammar_summary_restart()}
    </button>
  </div>
  <p class="mt-4 text-xs text-gray-700 dark:text-gray-300">{m.grammar_summary_restart_hint()}</p>
  <a
    href="/my-progress"
    class="mt-3 inline-block text-sm text-indigo-600 underline hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
  >
    {m.flashcard_view_stats()}
  </a>
</div>
