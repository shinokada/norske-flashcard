<script lang="ts">
  import { onMount } from 'svelte';
  import type { GrammarQuestion, GrammarRule } from '$lib/types';
  import ExplanationText from './ExplanationText.svelte';

  let {
    question,
    rule,
    isCorrect,
    userAnswer,
    isLast,
    onnext
  }: {
    question: GrammarQuestion;
    rule: GrammarRule | undefined;
    isCorrect: boolean;
    userAnswer: string;
    isLast: boolean;
    onnext: () => void;
  } = $props();

  // Move focus to the result heading so keyboard and screen-reader users land on
  // the verdict after answering (the clicked option button is gone by now).
  let heading = $state<HTMLElement | null>(null);
  onMount(() => heading?.focus());

  // Grammar questions are Norwegian-only at every level (see
  // ai-docs/implementation/grammar-with-only-norsk.md).
  let ruleTitle = $derived(rule ? rule.titleNb : '');
  let ruleText = $derived(rule ? rule.explanationNb : '');

  const LETTERS = ['A', 'B', 'C'];
  const BLANK = /_{2,}/;
  const same = (a: string, b: string) => a.trim() === b.trim();

  // Option questions are answered by picking, so the options list carries the
  // result (✓ on the right one, ✗ on a wrong pick) instead of a separate answer box.
  let isOptionType = $derived(
    question.type === 'minimal-pair' ||
      question.type === 'multiple-choice' ||
      question.type === 'punctuation'
  );

  interface RevealOption {
    label: string;
    text: string;
    correct: boolean;
    picked: boolean;
  }

  let options = $derived.by((): RevealOption[] => {
    if (question.type === 'minimal-pair') {
      return [
        { label: 'A', text: question.optionA ?? '' },
        { label: 'B', text: question.optionB ?? '' }
      ].map((o) => ({
        ...o,
        correct: same(question.answer, o.label),
        picked: same(userAnswer, o.label)
      }));
    }
    if (question.type === 'multiple-choice' || question.type === 'punctuation') {
      return (question.options ?? []).map((text, i) => ({
        label: LETTERS[i] ?? String(i + 1),
        text,
        correct: same(question.answer, text),
        picked: userAnswer !== '' && same(userAnswer, text)
      }));
    }
    return [];
  });

  // A fill sentence with a blank, split around it, so the finished sentence can
  // be shown with the answer in place. Null when the sentence has no blank.
  let filledParts = $derived.by((): string[] | null => {
    if (question.type !== 'fill' || !question.sentence) return null;
    const parts = question.sentence.split(BLANK);
    return parts.length > 1 ? parts : null;
  });

  // «Du skrev» only for a wrong typed answer; a skipped question has none.
  let showUser = $derived(!isCorrect && userAnswer !== '' && !isOptionType);
</script>

<div
  class="rounded-2xl border p-6 shadow-sm {isCorrect
    ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
    : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'}"
>
  <h2 bind:this={heading} tabindex="-1" class="mb-4 flex items-center gap-2 focus:outline-none">
    {#if isCorrect}
      <span aria-hidden="true" class="text-2xl">✓</span>
      <span class="font-semibold text-green-700 dark:text-green-300">Riktig!</span>
    {:else}
      <span aria-hidden="true" class="text-2xl">✗</span>
      <span class="font-semibold text-red-700 dark:text-red-300">Ikke helt.</span>
    {/if}
  </h2>

  <!-- The question, so the answer can be read against what was asked. -->
  <div
    class="mb-4 rounded-lg bg-white/60 px-4 py-3 dark:bg-indigo-950/60"
    data-testid="reveal-question"
  >
    <p class="mb-1 text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400">
      Spørsmålet
    </p>
    {#if question.prompt}
      <p class="text-sm text-gray-700 dark:text-gray-300">{question.prompt}</p>
    {/if}

    {#if question.type === 'fill' && question.sentence}
      <p class="mt-2 text-base font-medium text-gray-900 dark:text-white">{question.sentence}</p>
    {:else if question.type === 'order'}
      <div class="mt-2 flex flex-wrap gap-2">
        {#each question.tokens ?? [] as token, i (i)}
          <span
            class="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
          >
            {token}
          </span>
        {/each}
      </div>
    {:else if options.length > 0}
      <ul class="mt-2 flex flex-col gap-2">
        {#each options as opt (opt.label)}
          <li
            class="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm text-gray-800 dark:text-gray-100 {opt.correct
              ? 'border-green-400 bg-green-100/60 dark:border-green-600 dark:bg-green-900/30'
              : opt.picked
                ? 'border-red-400 bg-red-100/60 dark:border-red-600 dark:bg-red-900/30'
                : 'border-gray-200 dark:border-gray-600'}"
          >
            <span class="mt-0.5 text-xs font-bold text-gray-500 dark:text-gray-400"
              >{opt.label}</span
            >
            <span class="min-w-0 flex-1">{opt.text}</span>
            {#if opt.picked}
              <span class="text-xs text-gray-500 dark:text-gray-400">Ditt valg</span>
            {/if}
            {#if opt.correct}
              <span aria-hidden="true" class="font-bold text-green-600 dark:text-green-400">✓</span>
              <span class="sr-only">Riktig svar</span>
            {:else if opt.picked}
              <span aria-hidden="true" class="font-bold text-red-600 dark:text-red-400">✗</span>
              <span class="sr-only">Feil svar</span>
            {/if}
          </li>
        {/each}
      </ul>
    {:else if question.source}
      <p class="mt-2 text-base font-medium text-gray-900 italic dark:text-white">
        "{question.source}"
      </p>
    {/if}
  </div>

  {#if !isOptionType}
    <!-- Your answer next to the correct one; the correct one is on top on mobile. -->
    <div class="mb-4 grid gap-3 {showUser ? 'sm:grid-cols-2' : ''}">
      {#if showUser}
        <div
          class="order-2 rounded-lg border border-red-300 bg-red-100/50 px-4 py-3 sm:order-1 dark:border-red-700 dark:bg-red-900/20"
          data-testid="reveal-user-answer"
        >
          <p
            class="mb-1 text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400"
          >
            Du skrev
          </p>
          <p class="text-lg font-semibold text-red-700 dark:text-red-300">{userAnswer}</p>
        </div>
      {/if}
      <div
        class="order-1 rounded-lg border border-green-300 bg-green-100/50 px-4 py-3 sm:order-2 dark:border-green-700 dark:bg-green-900/20"
        data-testid="reveal-correct-answer"
      >
        <p
          class="mb-1 text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400"
        >
          Riktig svar
        </p>
        <p class="text-xl font-bold text-gray-800 dark:text-white">{question.answer}</p>
        {#if filledParts}
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {#each filledParts as part, i (i)}{#if i > 0}<strong
                  class="font-bold text-green-700 dark:text-green-300">{question.answer}</strong
                >{/if}{part}{/each}
          </p>
        {/if}
      </div>
    </div>
  {:else if question.type === 'minimal-pair' && question.explanation}
    <p class="mb-4 text-sm text-gray-600 dark:text-gray-300">{question.explanation}</p>
  {/if}

  {#if !isCorrect && question.hint}
    <p class="mb-4 text-sm text-indigo-600 dark:text-indigo-300">💡 {question.hint}</p>
  {/if}

  {#if rule}
    <div class="rounded-lg bg-white/60 px-4 py-3 dark:bg-indigo-950/60">
      <p
        class="mb-1 text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400"
      >
        Hvorfor · {ruleTitle}
      </p>
      <ExplanationText text={ruleText} />
      {#if rule.blogSlug}
        <a
          href={`/blog/${rule.blogSlug}`}
          class="mt-2 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Les mer →
        </a>
      {/if}
    </div>
  {/if}

  <div class="mt-5 flex items-center justify-end">
    <button
      type="button"
      onclick={onnext}
      class="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 focus:outline-none"
    >
      {isLast ? 'Se resultater' : 'Neste →'}
    </button>
  </div>
  <p class="mt-2 text-right text-xs text-gray-700 dark:text-gray-300">
    Mellomrom eller Enter for å fortsette
  </p>
</div>
