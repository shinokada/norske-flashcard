<script lang="ts">
  import type { GrammarQuestion } from '$lib/types';
  import { optionKeyIndex } from '$lib/grammar/option-keys';

  let { question, onsubmit }: { question: GrammarQuestion; onsubmit: (answer: string) => void } =
    $props();

  const LETTERS = ['A', 'B', 'C', 'D'];

  // "A eller B" / "A, B eller C"
  let keyHint = $derived.by(() => {
    const letters = LETTERS.slice(0, question.options?.length ?? 0);
    if (letters.length < 2) return '';
    return `${letters.slice(0, -1).join(', ')} eller ${letters[letters.length - 1]}`;
  });

  function handleKeyDown(e: KeyboardEvent) {
    const options = question.options ?? [];
    const i = optionKeyIndex(e, Math.min(options.length, LETTERS.length));
    if (i === -1) return;
    e.preventDefault();
    onsubmit(options[i]);
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="mb-3">
  <p
    id="mc-{question.id}-instr"
    class="text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-300"
  >
    Velg riktig svar
  </p>
  {#if keyHint}
    <p class="mt-1 hidden text-xs text-gray-500 dark:text-gray-400 [@media(hover:hover)]:block">
      Trykk {keyHint}, eller klikk på svaret.
    </p>
  {/if}
</div>

{#if question.sentence}
  <p id="mc-{question.id}-sentence" class="mb-2 text-lg font-medium text-gray-900 dark:text-white">
    {question.sentence}
  </p>
{/if}

{#if question.prompt}
  <p id="mc-{question.id}-prompt" class="mb-4 text-lg font-medium text-gray-900 dark:text-white">
    {question.prompt}
  </p>
{/if}

<div
  role="group"
  aria-labelledby="mc-{question.id}-instr mc-{question.id}-sentence mc-{question.id}-prompt"
  class="flex flex-col gap-3"
>
  {#each question.options ?? [] as option, i (option)}
    <button
      type="button"
      onclick={() => onsubmit(option)}
      aria-keyshortcuts={(LETTERS[i] ?? '').toLowerCase() || undefined}
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
