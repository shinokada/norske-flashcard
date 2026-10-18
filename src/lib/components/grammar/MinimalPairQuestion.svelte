<script lang="ts">
  import type { GrammarQuestion } from '$lib/types';
  import { optionKeyIndex } from '$lib/grammar/option-keys';

  let { question, onsubmit }: { question: GrammarQuestion; onsubmit: (answer: string) => void } =
    $props();

  function handleKeyDown(e: KeyboardEvent) {
    const i = optionKeyIndex(e, 2);
    if (i === -1) return;
    e.preventDefault();
    onsubmit(i === 0 ? 'A' : 'B');
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="mb-3">
  <p
    id="mp-{question.id}-instr"
    class="text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-300"
  >
    Hvilken setning er riktig?
  </p>
  <p class="mt-1 hidden text-xs text-gray-500 dark:text-gray-400 [@media(hover:hover)]:block">
    Trykk A eller B, eller klikk på svaret.
  </p>
</div>

{#if question.prompt}
  <p id="mp-{question.id}-prompt" class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
    {question.prompt}
  </p>
{/if}

<div
  role="group"
  aria-labelledby="mp-{question.id}-instr mp-{question.id}-prompt"
  class="flex flex-col gap-3"
>
  <button
    type="button"
    onclick={() => onsubmit('A')}
    aria-keyshortcuts="a"
    class="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-800 transition-colors hover:border-indigo-400 hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/30 dark:focus-visible:ring-indigo-400"
  >
    <span
      class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
      >A</span
    >
    <span>{question.optionA}</span>
  </button>

  <button
    type="button"
    onclick={() => onsubmit('B')}
    aria-keyshortcuts="b"
    class="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-800 transition-colors hover:border-indigo-400 hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/30 dark:focus-visible:ring-indigo-400"
  >
    <span
      class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
      >B</span
    >
    <span>{question.optionB}</span>
  </button>
</div>

<div class="mt-3">
  <button
    type="button"
    onclick={() => onsubmit('')}
    class="rounded text-xs text-gray-600 hover:text-gray-900 hover:underline focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:outline-none dark:text-gray-300 dark:hover:text-white dark:focus-visible:ring-indigo-400"
  >
    Hopp over
  </button>
</div>
