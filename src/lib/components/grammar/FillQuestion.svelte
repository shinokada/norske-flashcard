<script lang="ts">
  import type { GrammarQuestion } from '$lib/types';

  let { question, onsubmit }: { question: GrammarQuestion; onsubmit: (answer: string) => void } =
    $props();

  let value = $state('');
  let inputRef = $state<HTMLInputElement | null>(null);

  // Some `fill` questions ask the learner to pick a word out of a complete
  // sentence (e.g. «Skriv objektet i setningen.») and have no blank in it. Only
  // call it a blank when the sentence actually has one (a run of underscores).
  const hasBlank = $derived(/_{2,}/.test(question.sentence ?? ''));

  // Reset + focus whenever the question changes.
  $effect(() => {
    void question.id;
    value = '';
    setTimeout(() => inputRef?.focus(), 0);
  });
</script>

<p
  id="fill-{question.id}-instr"
  class="mb-3 text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-300"
>
  {hasBlank ? 'Fyll inn i den tomme plassen' : 'Skriv svaret'}
</p>

{#if question.prompt}
  <p
    id="fill-{question.id}-prompt"
    class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300"
  >
    {question.prompt}
  </p>
{/if}

<p id="fill-{question.id}-sentence" class="mb-4 text-lg font-medium text-gray-900 dark:text-white">
  {question.sentence}
</p>

{#if question.words && question.words.length}
  <div class="mb-4 flex flex-wrap gap-2">
    {#each question.words as word (word)}
      <span
        class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
      >
        {word}
      </span>
    {/each}
  </div>
{/if}

<div class="flex gap-2">
  <input
    bind:this={inputRef}
    type="text"
    aria-labelledby="fill-{question.id}-instr fill-{question.id}-prompt fill-{question.id}-sentence"
    bind:value
    placeholder="Skriv svaret ditt…"
    onkeydown={(e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onsubmit(value);
      }
    }}
    class="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:ring-indigo-400"
  />
  <button
    type="button"
    onclick={() => onsubmit(value)}
    class="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 focus:outline-none"
  >
    Sjekk
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
