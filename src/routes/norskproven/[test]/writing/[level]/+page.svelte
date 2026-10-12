<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import type { WritingPrompt } from '$lib/types';

  let { data } = $props();

  // ── Types ──────────────────────────────────────────────────────────────────

  type WritingState = 'drafting' | 'revealed' | 'summary';

  // ── State ──────────────────────────────────────────────────────────────────

  let writingState: WritingState = $state('drafting');
  let promptIndex = $state(0);
  let draftText = $state('');

  // ── Derived ────────────────────────────────────────────────────────────────

  let prompts: WritingPrompt[] = $derived(data.prompts);
  let currentPrompt: WritingPrompt = $derived(prompts[promptIndex]);
  let isLastPrompt = $derived(promptIndex === prompts.length - 1);

  let wordCount = $derived(draftText.trim() === '' ? 0 : draftText.trim().split(/\s+/).length);

  let wordCountStatus: 'under' | 'ok' | 'over' = $derived(
    wordCount < currentPrompt?.wordCountMin
      ? 'under'
      : wordCount > currentPrompt?.wordCountMax
        ? 'over'
        : 'ok'
  );

  let canReveal = $derived(wordCount >= (currentPrompt?.wordCountMin ?? 0));

  // ── Actions ────────────────────────────────────────────────────────────────

  function revealModel() {
    if (!canReveal) return;
    writingState = 'revealed';
  }

  function nextPrompt() {
    if (isLastPrompt) {
      writingState = 'summary';
      return;
    }
    promptIndex++;
    draftText = '';
    writingState = 'drafting';
  }

  function restart() {
    promptIndex = 0;
    draftText = '';
    writingState = 'drafting';
  }

  // The Plus gate (Test 1 is free; Tests 2+ require Plus) lives in the server load
  // (+page.server.ts): this page only ever receives a test the visitor may open.
</script>

<svelte:head>
  <title>{m.norskproven_writing_page_title({ level: data.level, test: data.test })}</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-10 text-left">
  {#if writingState !== 'summary'}
    <!-- ── Page heading ─────────────────────────────────────────────────── -->
    <div class="mb-5">
      <a
        href="/norskproven"
        class="mb-2 inline-flex items-center gap-1 text-sm text-blue-500 hover:text-blue-700 dark:hover:text-blue-300"
      >
        ← {m.norskproven_practice_heading()}
      </a>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">
        ✍️ {m.norskproven_practice_writing()} · {data.level} · Test {data.test}
      </h1>
    </div>

    <!-- ── Progress bar ──────────────────────────────────────────────────── -->
    <div class="mb-6">
      <div class="mb-1 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
        <span>Oppgave {promptIndex + 1} av {prompts.length}</span>
        <span class="font-medium text-blue-500 dark:text-blue-400"
          >{data.level} · Test {data.test}</span
        >
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          class="h-full rounded-full bg-blue-500 transition-all duration-300"
          style="width: {(promptIndex / prompts.length) * 100}%"
        ></div>
      </div>
    </div>

    {#if currentPrompt}
      <!-- ── Prompt card ───────────────────────────────────────────────── -->
      <div
        class="mb-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-indigo-950/60"
      >
        <p
          class="mb-1 text-xs font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-400"
        >
          Situasjon
        </p>
        <p class="mb-4 text-base text-gray-800 dark:text-gray-200">
          {currentPrompt.situation}
        </p>

        <p
          class="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
        >
          Oppgave
        </p>
        <p class="text-base font-medium text-gray-900 dark:text-white">
          {currentPrompt.task}
        </p>
      </div>

      <!-- ── Textarea ──────────────────────────────────────────────────── -->
      <div class="mb-4">
        <textarea
          bind:value={draftText}
          disabled={writingState === 'revealed'}
          rows={8}
          placeholder="Skriv svaret ditt her…"
          class="w-full resize-y rounded-xl border px-4 py-3 text-sm leading-relaxed text-gray-800 transition-colors focus:ring-2 focus:ring-blue-300 focus:outline-none dark:text-gray-200 dark:placeholder-gray-500
						{writingState === 'revealed'
            ? 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-900'
            : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-indigo-950/60'}"></textarea>

        <div class="mt-1 flex items-center justify-between">
          <span
            class="text-xs font-medium
							{wordCountStatus === 'under'
              ? 'text-amber-500 dark:text-amber-400'
              : wordCountStatus === 'over'
                ? 'text-red-500 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'}"
          >
            {m.norskproven_writing_word_count({ count: wordCount })}
            <span class="font-normal text-gray-600 dark:text-gray-300">
              / {currentPrompt.wordCountMin}–{currentPrompt.wordCountMax} ord
            </span>
          </span>

          {#if wordCountStatus === 'under'}
            <span class="text-xs text-amber-500 dark:text-amber-400">
              Skriv minst {currentPrompt.wordCountMin} ord for å se eksempelsvaret
            </span>
          {:else if wordCountStatus === 'over'}
            <span class="text-xs text-red-500 dark:text-red-400">
              For mange ord — prøv å korte ned
            </span>
          {/if}
        </div>
      </div>

      {#if writingState === 'drafting'}
        <button
          type="button"
          onclick={revealModel}
          disabled={!canReveal}
          class="w-full rounded-xl py-3 text-sm font-semibold transition-colors focus:ring-4 focus:ring-blue-300 focus:outline-none
						{canReveal
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'}"
        >
          {m.norskproven_writing_show_model()}
        </button>
      {/if}

      {#if writingState === 'revealed'}
        <div
          class="mb-4 rounded-2xl border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-950/40"
        >
          <p
            class="mb-2 text-xs font-semibold tracking-wide text-green-700 uppercase dark:text-green-400"
          >
            Eksempelsvar
          </p>
          <p class="text-sm leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-200">
            {currentPrompt.modelAnswer}
          </p>

          {#if currentPrompt.modelNotes}
            <div class="mt-4 border-t border-green-200 pt-3 dark:border-green-800">
              <p
                class="mb-1 text-xs font-semibold tracking-wide text-green-700 uppercase dark:text-green-400"
              >
                Kommentar
              </p>
              <p class="text-xs text-gray-600 dark:text-gray-300">
                {currentPrompt.modelNotes}
              </p>
            </div>
          {/if}
        </div>

        <button
          type="button"
          onclick={nextPrompt}
          class="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 focus:outline-none"
        >
          {#if isLastPrompt}
            Fullfør ✓
          {:else}
            {m.norskproven_writing_next()} →
          {/if}
        </button>
      {/if}
    {/if}
  {:else}
    <!-- ── Summary ───────────────────────────────────────────────────────── -->
    <div class="text-center">
      <p class="text-5xl">🖊️</p>
      <h2 class="mt-3 text-2xl font-bold dark:text-white">Skriveøkt fullført!</h2>
      <p class="mt-2 text-gray-600 dark:text-gray-300">
        Du har fullført alle {prompts.length} skriveoppgaver på {data.level}-nivå.
      </p>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-300">
        Sammenlign svarene dine med eksempelsvarene for å se hva du kan forbedre.
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
            href="/norskproven/{data.test}/writing/b1"
            class="rounded-lg border border-blue-300 px-6 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 focus:ring-4 focus:ring-blue-200 focus:outline-none dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
          >
            Prøv B1 →
          </a>
        {/if}
      </div>
    </div>
  {/if}
</div>
