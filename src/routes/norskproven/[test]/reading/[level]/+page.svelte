<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import type { ReadingPassage, ReadingOption } from '$lib/types';

  let { data } = $props();

  // ── Types ──────────────────────────────────────────────────────────────────

  type ReadingState = 'questioning' | 'revealing' | 'summary';

  interface PassageResult {
    passageId: string;
    title: string;
    questionResults: { questionId: string; correct: boolean }[];
  }

  // ── State ──────────────────────────────────────────────────────────────────

  let readingState: ReadingState = $state('questioning');
  let passageIndex = $state(0);
  let questionIndex = $state(0);
  let selectedOptionId: string | null = $state(null);
  let isCorrect: boolean | null = $state(null);
  let results: PassageResult[] = $state([]);
  let currentPassageQuestionResults: { questionId: string; correct: boolean }[] = $state([]);

  // ── Derived ────────────────────────────────────────────────────────────────

  let passages: ReadingPassage[] = $derived(data.passages);
  let currentPassage: ReadingPassage = $derived(passages[passageIndex]);
  let currentQuestion = $derived(currentPassage?.questions[questionIndex] ?? null);
  let isLastQuestion = $derived(questionIndex === (currentPassage?.questions.length ?? 1) - 1);
  let isLastPassage = $derived(passageIndex === passages.length - 1);

  let totalCorrect = $derived(
    results.reduce((sum, r) => sum + r.questionResults.filter((q) => q.correct).length, 0)
  );
  let totalQuestions = $derived(results.reduce((sum, r) => sum + r.questionResults.length, 0));

  // ── Helpers ────────────────────────────────────────────────────────────────

  function optionLabel(id: string): string {
    const map: Record<string, string> = { a: 'A', b: 'B', c: 'C', d: 'D' };
    return map[id] ?? id.toUpperCase();
  }

  function scoreEmoji(correct: number, total: number): string {
    const pct = total > 0 ? correct / total : 0;
    if (pct >= 0.9) return '🎉';
    if (pct >= 0.7) return '👍';
    if (pct >= 0.5) return '💪';
    return '📖';
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  function selectOption(optionId: string) {
    if (readingState !== 'questioning' || !currentQuestion) return;
    selectedOptionId = optionId;
    isCorrect = optionId === currentQuestion.correctId;
    currentPassageQuestionResults = [
      ...currentPassageQuestionResults,
      { questionId: currentQuestion.id, correct: isCorrect }
    ];
    readingState = 'revealing';
  }

  function advance() {
    if (readingState !== 'revealing') return;

    if (!isLastQuestion) {
      questionIndex++;
      selectedOptionId = null;
      isCorrect = null;
      readingState = 'questioning';
      return;
    }

    results = [
      ...results,
      {
        passageId: currentPassage.id,
        title: currentPassage.title,
        questionResults: currentPassageQuestionResults
      }
    ];
    currentPassageQuestionResults = [];

    if (isLastPassage) {
      readingState = 'summary';
      return;
    }

    passageIndex++;
    questionIndex = 0;
    selectedOptionId = null;
    isCorrect = null;
    readingState = 'questioning';
  }

  function restart() {
    passageIndex = 0;
    questionIndex = 0;
    selectedOptionId = null;
    isCorrect = null;
    results = [];
    currentPassageQuestionResults = [];
    readingState = 'questioning';
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  function handleKeyDown(e: KeyboardEvent) {
    if (readingState === 'questioning' && currentQuestion) {
      const keyMap: Record<string, string> = { a: 'a', b: 'b', c: 'c', d: 'd' };
      const optId = keyMap[e.key.toLowerCase()];
      if (optId && currentQuestion.options.some((o: ReadingOption) => o.id === optId)) {
        e.preventDefault();
        selectOption(optId);
        return;
      }
    }

    if (readingState === 'revealing' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      advance();
    }
  }

  // The Plus gate (Test 1 is free; Tests 2+ require Plus) lives in the server load
  // (+page.server.ts): this page only ever receives a test the visitor may open.
</script>

<svelte:head>
  <title>{m.norskproven_reading_page_title({ level: data.level, test: data.test })}</title>
</svelte:head>

<svelte:window onkeydown={handleKeyDown} />

<div class="mx-auto max-w-2xl px-4 py-10 text-left">
  {#if readingState === 'questioning' || readingState === 'revealing'}
    <!-- Page heading -->
    <div class="mb-5">
      <a
        href="/norskproven"
        class="mb-2 inline-flex items-center gap-1 text-sm text-blue-500 hover:text-blue-700 dark:hover:text-blue-300"
      >
        ← {m.norskproven_practice_heading()}
      </a>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">
        📖 {m.norskproven_practice_reading()} · {data.level} · Test {data.test}
      </h1>
    </div>

    <!-- Progress bar -->
    <div class="mb-6">
      <div class="mb-1 flex items-center justify-between text-xs text-gray-800 dark:text-gray-200">
        <span>
          {m.norskproven_reading_text_counter({
            current: passageIndex + 1,
            total: passages.length
          })}
        </span>
        <span class="font-medium text-blue-500 dark:text-blue-400">
          {data.level} · Test {data.test}
        </span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          class="h-full rounded-full bg-blue-500 transition-all duration-300"
          style="width: {(passageIndex / passages.length) * 100}%"
        ></div>
      </div>
    </div>

    <!-- ── Passage ───────────────────────────────────────────────────────── -->
    {#if currentPassage}
      <div
        class="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-indigo-950/60"
      >
        {#if currentPassage.imageUrl}
          <img
            src={currentPassage.imageUrl}
            alt={currentPassage.title}
            class="mb-4 w-full rounded-xl object-cover"
          />
        {/if}
        <h2
          class="mb-2 text-sm font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-400"
        >
          {currentPassage.title}
        </h2>
        <p class="text-base leading-relaxed text-gray-800 dark:text-gray-200">
          {currentPassage.text}
        </p>
      </div>
    {/if}

    <!-- ── Question ──────────────────────────────────────────────────────── -->
    {#if currentQuestion}
      <div
        class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-indigo-950/60"
      >
        <p class="mb-4 text-base font-semibold text-gray-900 dark:text-white">
          {currentQuestion.prompt}
        </p>

        <div class="space-y-2">
          {#each currentQuestion.options as option (option.id)}
            {@const isSelected = selectedOptionId === option.id}
            {@const isCorrectOption = option.id === currentQuestion.correctId}
            {@const revealed = readingState === 'revealing'}

            <button
              type="button"
              disabled={revealed}
              onclick={() => selectOption(option.id)}
              class="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors
								{revealed && isCorrectOption
                ? 'border-green-400 bg-green-50 text-green-800 dark:border-green-600 dark:bg-green-900/30 dark:text-green-200'
                : revealed && isSelected && !isCorrectOption
                  ? 'border-red-400 bg-red-50 text-red-800 dark:border-red-600 dark:bg-red-900/30 dark:text-red-200'
                  : revealed
                    ? 'border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-500'
                    : 'border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50 focus:ring-2 focus:ring-blue-300 focus:outline-none dark:border-gray-600 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:bg-blue-900/20'}"
            >
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold
									{revealed && isCorrectOption
                  ? 'bg-green-200 dark:bg-green-700'
                  : revealed && isSelected && !isCorrectOption
                    ? 'bg-red-200 dark:bg-red-700'
                    : 'bg-gray-100 dark:bg-gray-700'}"
              >
                {optionLabel(option.id)}
              </span>
              {option.text}
              {#if revealed && isCorrectOption}
                <span class="ml-auto text-green-600 dark:text-green-400">✓</span>
              {:else if revealed && isSelected && !isCorrectOption}
                <span class="ml-auto text-red-500 dark:text-red-400">✗</span>
              {/if}
            </button>
          {/each}
        </div>

        {#if readingState === 'questioning'}
          <p class="mt-3 text-xs text-gray-800 dark:text-gray-200">
            Trykk A · B · C · D for å velge
          </p>
        {/if}

        {#if readingState === 'revealing'}
          <div
            class="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700"
          >
            <p
              class="text-sm font-semibold {isCorrect
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'}"
            >
              {#if isCorrect}
                {m.norskproven_reading_correct()}
              {:else}
                {m.norskproven_reading_incorrect({
                  answer: optionLabel(currentQuestion.correctId)
                })}
              {/if}
            </p>

            <button
              type="button"
              onclick={advance}
              class="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 focus:outline-none"
            >
              {#if isLastQuestion && isLastPassage}
                {m.norskproven_reading_finish()}
              {:else if isLastQuestion}
                {m.norskproven_reading_next()}
              {:else}
                Neste spørsmål →
              {/if}
            </button>
          </div>
          <p class="mt-1 text-right text-xs text-gray-700 dark:text-gray-300">
            Enter eller mellomrom for å fortsette
          </p>
        {/if}
      </div>
    {/if}
  {:else if readingState === 'summary'}
    <!-- ── Summary ───────────────────────────────────────────────────────── -->
    <div class="text-center">
      <p class="mb-1 text-5xl">{scoreEmoji(totalCorrect, totalQuestions)}</p>
      <h2 class="mt-3 text-2xl font-bold dark:text-white">Økt fullført!</h2>
      <p class="mt-2 text-lg text-gray-600 dark:text-gray-300">
        {m.norskproven_reading_score({ correct: totalCorrect, total: totalQuestions })}
      </p>

      <div class="mt-8 space-y-4 text-left">
        {#each results as result, i (result.passageId)}
          <div
            class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-indigo-950/60"
          >
            <p class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
              {i + 1}. {result.title}
            </p>
            <div class="flex gap-2">
              {#each result.questionResults as qr (qr.questionId)}
                <span
                  class="rounded-full px-2.5 py-0.5 text-xs font-medium {qr.correct
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}"
                >
                  {qr.correct ? '✓ Riktig' : '✗ Feil'}
                </span>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onclick={restart}
          class="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 focus:outline-none"
        >
          Prøv igjen
        </button>
        <a
          href="/norskproven"
          class="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus:ring-4 focus:ring-gray-200 focus:outline-none dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          ← Tilbake til øving
        </a>
        {#if data.level === 'A2'}
          <a
            href="/norskproven/{data.test}/reading/b1"
            class="rounded-lg border border-blue-300 px-6 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 focus:ring-4 focus:ring-blue-200 focus:outline-none dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
          >
            Prøv B1 →
          </a>
        {/if}
      </div>
    </div>
  {/if}
</div>
