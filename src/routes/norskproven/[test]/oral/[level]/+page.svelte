<script lang="ts">
  import { onDestroy } from 'svelte';
  import * as m from '$lib/paraglide/messages.js';
  import type { OralPrompt } from '$lib/types';

  let { data } = $props();

  // ── Types ──────────────────────────────────────────────────────────────────

  type OralState = 'prep' | 'practice' | 'summary';

  // ── State ──────────────────────────────────────────────────────────────────

  let oralState = $state<OralState>('prep');
  let scenarioIndex = $state(0);
  let revealedCount = $state(0);

  const TIMER_SECONDS = 120;
  let timerActive = $state(false);
  let timerRemaining = $state(TIMER_SECONDS);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  // ── Derived ────────────────────────────────────────────────────────────────

  let scenarios: OralPrompt[] = $derived(data.scenarios);
  let current: OralPrompt = $derived(scenarios[scenarioIndex]);
  let isLastScenario = $derived(scenarioIndex === scenarios.length - 1);
  let allQuestionsRevealed = $derived(revealedCount >= (current?.questions.length ?? 0));

  let timerDisplay = $derived.by(() => {
    const mins = Math.floor(timerRemaining / 60);
    const secs = timerRemaining % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  });

  let timerExpired = $derived(timerRemaining === 0);

  // ── Timer helpers ──────────────────────────────────────────────────────────

  function startTimer() {
    if (timerActive) return;
    timerActive = true;
    timerInterval = setInterval(() => {
      timerRemaining = Math.max(0, timerRemaining - 1);
      if (timerRemaining === 0) {
        clearInterval(timerInterval!);
        timerInterval = null;
        timerActive = false;
      }
    }, 1000);
  }

  function resetTimer() {
    clearInterval(timerInterval!);
    timerInterval = null;
    timerActive = false;
    timerRemaining = TIMER_SECONDS;
  }

  // ── Model answer ──────────────────────────────────────────────────────────
  let modelRevealed = $state(false);

  let canRevealModel = $derived(oralState === 'practice' && (allQuestionsRevealed || timerExpired));

  // ── Actions ────────────────────────────────────────────────────────────────

  function startPractice() {
    resetTimer();
    revealedCount = 1;
    oralState = 'practice';
  }

  function revealNext() {
    if (allQuestionsRevealed) return;
    revealedCount++;
  }

  function nextScenario() {
    resetTimer();
    modelRevealed = false;
    if (isLastScenario) {
      oralState = 'summary';
      return;
    }
    scenarioIndex++;
    revealedCount = 0;
    oralState = 'prep';
  }

  function restart() {
    resetTimer();
    modelRevealed = false;
    scenarioIndex = 0;
    revealedCount = 0;
    oralState = 'prep';
  }

  // ── Plus gate ──────────────────────────────────────────────────────────
  // lives in the server load (+page.server.ts): Test 1 is free, Tests 2+ require Plus,
  // and this page only ever receives a test the visitor may open.

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
  });
</script>

<svelte:head>
  <title>{m.norskproven_oral_page_title({ level: data.level, test: data.test })}</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-10 text-left">
  {#if oralState !== 'summary'}
    <!-- ── Page heading ─────────────────────────────────────────────────── -->
    <div class="mb-5">
      <a
        href="/norskproven"
        class="mb-2 inline-flex items-center gap-1 text-sm text-blue-500 hover:text-blue-700 dark:hover:text-blue-300"
      >
        ← {m.norskproven_practice_heading()}
      </a>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">
        🗣️ {m.norskproven_practice_oral()} · {data.level} · Test {data.test}
      </h1>
    </div>

    <!-- ── Progress bar ──────────────────────────────────────────────────── -->
    <div class="mb-6">
      <div class="mb-1 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
        <span>Scenario {scenarioIndex + 1} av {scenarios.length}</span>
        <span class="font-medium text-blue-500 dark:text-blue-400"
          >{data.level} · Test {data.test}</span
        >
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          class="h-full rounded-full bg-blue-500 transition-all duration-300"
          style="width: {(scenarioIndex / scenarios.length) * 100}%"
        ></div>
      </div>
    </div>

    {#if current}
      <!-- ── Scenario card ─────────────────────────────────────────────── -->
      <div
        class="mb-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-indigo-950/60"
      >
        <p
          class="mb-1 text-xs font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-400"
        >
          Scenario
        </p>
        <p class="text-base leading-relaxed text-gray-800 dark:text-gray-200">
          {current.scenario}
        </p>

        {#if current.tips}
          <div class="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
            <p
              class="mb-1 text-xs font-semibold tracking-wide text-amber-600 uppercase dark:text-amber-400"
            >
              Tips
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-300">
              {current.tips}
            </p>
          </div>
        {/if}
      </div>

      {#if oralState === 'prep'}
        <div class="flex flex-col items-center gap-4">
          <p class="text-sm text-gray-600 dark:text-gray-300">
            Les scenariet og tenk deg om. Eksaminatoren vil stille spørsmål ett om gangen.
          </p>
          <button
            type="button"
            onclick={startPractice}
            class="rounded-xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 focus:outline-none"
          >
            {m.norskproven_oral_practice()} →
          </button>
        </div>
      {:else if oralState === 'practice'}
        <div class="mb-4 flex items-center justify-between">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {m.norskproven_oral_questions_label()} ({revealedCount} av {current.questions.length})
          </p>

          {#if !timerActive && timerRemaining === TIMER_SECONDS}
            <button
              type="button"
              onclick={startTimer}
              class="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              ⏱ {m.norskproven_oral_start_timer()}
            </button>
          {:else}
            <span
              class="rounded-lg px-3 py-1.5 font-mono text-sm font-semibold tabular-nums
								{timerExpired
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : timerRemaining <= 30
                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}"
            >
              {timerDisplay}
            </span>
          {/if}
        </div>

        <div class="mb-4 space-y-3">
          {#each current.questions.slice(0, revealedCount) as question, i (i)}
            <div
              class="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-indigo-950/60"
            >
              <span
                class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              >
                {i + 1}
              </span>
              <p class="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                {question}
              </p>
            </div>
          {/each}
        </div>

        {#if !allQuestionsRevealed}
          <div class="mb-4 space-y-3">
            {#each current.questions.slice(revealedCount) as _, i (i)}
              <div
                class="flex items-start gap-3 rounded-xl border border-dashed border-gray-200 px-4 py-3 dark:border-gray-700"
              >
                <span
                  class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                >
                  {revealedCount + i + 1}
                </span>
                <p class="text-sm text-gray-700 dark:text-gray-300">&nbsp;</p>
              </div>
            {/each}
          </div>
        {/if}

        <div class="flex gap-3">
          {#if !allQuestionsRevealed}
            <button
              type="button"
              onclick={revealNext}
              class="flex-1 rounded-xl border border-blue-300 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 focus:ring-4 focus:ring-blue-200 focus:outline-none dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              {m.norskproven_oral_reveal_question()} →
            </button>
          {/if}

          <button
            type="button"
            onclick={nextScenario}
            class="flex-1 rounded-xl py-3 text-sm font-semibold focus:ring-4 focus:ring-blue-300 focus:outline-none
					{allQuestionsRevealed
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'}"
          >
            {#if isLastScenario}
              Fullfør ✓
            {:else}
              {m.norskproven_oral_next()} →
            {/if}
          </button>
        </div>

        {#if canRevealModel && current.modelAnswer}
          {#if !modelRevealed}
            <button
              type="button"
              onclick={() => (modelRevealed = true)}
              class="mt-3 w-full rounded-xl border border-green-300 py-3 text-sm font-semibold text-green-700 hover:bg-green-50 focus:ring-4 focus:ring-green-200 focus:outline-none dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
            >
              {m.norskproven_oral_show_model()}
            </button>
          {:else}
            <div
              class="mt-4 rounded-2xl border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-950/40"
            >
              <p
                class="mb-2 text-xs font-semibold tracking-wide text-green-700 uppercase dark:text-green-400"
              >
                Eksempelsvar
              </p>
              <p class="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                {current.modelAnswer}
              </p>
              {#if current.modelNotes}
                <div class="mt-4 border-t border-green-200 pt-3 dark:border-green-800">
                  <p
                    class="mb-1 text-xs font-semibold tracking-wide text-green-700 uppercase dark:text-green-400"
                  >
                    Kommentar
                  </p>
                  <p class="text-xs text-gray-600 dark:text-gray-300">
                    {current.modelNotes}
                  </p>
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      {/if}
    {/if}
  {:else}
    <!-- ── Summary ───────────────────────────────────────────────────────── -->
    <div class="text-center">
      <p class="text-5xl">🗣️</p>
      <h2 class="mt-3 text-2xl font-bold dark:text-white">Muntlig økt fullført!</h2>
      <p class="mt-2 text-gray-600 dark:text-gray-300">
        Du har øvd på alle {scenarios.length} scenarier på {data.level}-nivå.
      </p>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-300">
        Øv gjerne igjen — å si svarene høyt hver gang gjør en stor forskjell.
      </p>

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
            href="/norskproven/{data.test}/oral/b1"
            class="rounded-lg border border-blue-300 px-6 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 focus:ring-4 focus:ring-blue-200 focus:outline-none dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
          >
            Prøv B1 →
          </a>
        {/if}
      </div>
    </div>
  {/if}
</div>
