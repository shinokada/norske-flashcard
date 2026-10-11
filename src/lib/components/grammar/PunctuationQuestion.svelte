<script lang="ts">
  import type { GrammarQuestion } from '$lib/types';

  let { question, onsubmit }: { question: GrammarQuestion; onsubmit: (answer: string) => void } =
    $props();

  const LETTERS = ['A', 'B', 'C'];
</script>

<p
  id="punct-{question.id}-instr"
  class="mb-3 text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-300"
>
  Hvilken setning har riktig tegnsetting?
</p>

{#if question.prompt}
  <p id="punct-{question.id}-prompt" class="mb-4 text-lg font-medium text-gray-900 dark:text-white">
    {question.prompt}
  </p>
{/if}

<div
  role="group"
  aria-labelledby="punct-{question.id}-instr punct-{question.id}-prompt"
  class="flex flex-col gap-3"
>
  {#each question.options ?? [] as option, i (option)}
    <button
      type="button"
      onclick={() => onsubmit(option)}
      class="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-800 transition-colors hover:border-indigo-400 hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/30 dark:focus-visible:ring-indigo-400"
    >
      <span
        class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
        >{LETTERS[i] ?? i + 1}</span
      >
      <span>{option}</span>
    </button>
  {/each}
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
