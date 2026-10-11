<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { loadGrammarProgressMap, loadGrammarProgressFromSupabase } from '$lib/progress';
  import { buildGrammarProgress } from '$lib/grammar/progress';
  import { chapterBySlug } from '$lib/grammar/taxonomy';
  import {
    chapterEntryBySlug,
    chapterPlayable,
    countLockedTopics,
    parseLevelParam,
    topicHref
  } from '$lib/grammar/overview';
  import TopicRow from '$lib/components/grammar/TopicRow.svelte';
  import GrammarSession from '$lib/components/grammar/GrammarSession.svelte';
  import { localeStore } from '$lib/localeStore.svelte';
  import type { CardProgress, GrammarQuestion } from '$lib/types';
  import * as m from '$lib/paraglide/messages';

  // grammar-update.md Phase 5: a chapter's sections and topics in book order,
  // each topic with its level badges, progress and free / Plus state inline
  // (decision #20), plus one upsell banner and "Practise this chapter".

  let { data } = $props();

  const isPlus = $derived(page.data.plan === 'plus');
  const userId = $derived(isPlus ? ((page.data.user?.id as string | undefined) ?? null) : null);
  const showGloss = $derived(localeStore.current !== 'nb');

  // ?level= scopes the chapter (counts, topics, practice) like the /grammar chips.
  const level = $derived(parseLevelParam(page.url.searchParams.get('level')));
  // ?from= (a level hub) is forwarded into the topic pages, as everywhere else.
  const VALID_FROM = new Set(['a1', 'a2', 'b1', 'b2', 'c']);
  const from = $derived.by(() => {
    const raw = page.url.searchParams.get('from')?.toLowerCase() ?? '';
    return VALID_FROM.has(raw) ? raw : null;
  });

  const chapter = $derived(chapterBySlug(data.slug)!);
  const entry = $derived(chapterEntryBySlug(data.slug, level));
  const lockedCount = $derived(entry ? countLockedTopics(entry) : 0);
  const canPractise = $derived(!!entry && (isPlus || entry.access !== 'locked'));

  // ── Progress (separate grammar store; Plus reads Supabase, others localStorage) ──
  let grammarMap = $state<Record<string, CardProgress>>({});
  const progress = $derived(buildGrammarProgress(grammarMap));

  onMount(async () => {
    try {
      grammarMap = userId
        ? await loadGrammarProgressFromSupabase(userId)
        : loadGrammarProgressMap();
    } catch {
      // Progress is a nicety here; the chapter itself must still render.
    }
  });

  // ── Practise this chapter: questions are fetched only when asked for ────────
  // They come from POST /api/grammar-questions, which applies the plan gate on the
  // server (grammar-server-gating.md, Phase 3). The browser never loads level files.
  let practising = $state(false);
  let loadingPractice = $state(false);
  let practiceQuestions = $state<GrammarQuestion[]>([]);

  async function startPractice() {
    if (!entry || loadingPractice) return;
    loadingPractice = true;
    try {
      const topics = entry.topics.map((t) => t.topic);
      const res = await fetch('/api/grammar-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics, levels: entry.levels })
      });
      if (!res.ok) throw new Error(`grammar-questions ${res.status}`);
      const { questions } = (await res.json()) as { questions: GrammarQuestion[] };
      // Already gated by the server; chapterPlayable stays as a second layer.
      practiceQuestions = chapterPlayable(questions, topics, { isPlus });
      practising = true;
    } catch (err) {
      // Stay on the chapter overview; the button works again.
      console.error('Could not load chapter questions', err);
    } finally {
      loadingPractice = false;
    }
  }
</script>

<svelte:head>
  <title>{chapter.titleNb} · {m.grammar_title()} — Norskeord</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-10 text-left">
  <div class="mb-4 flex items-center justify-between">
    {#if practising}
      <button
        onclick={() => (practising = false)}
        class="rounded text-sm text-indigo-600 hover:text-indigo-800 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-indigo-300 dark:hover:text-indigo-200"
      >
        {m.grammar_map_back_to_chapter()}
      </button>
    {:else}
      <a
        href="/grammar"
        class="rounded text-sm text-indigo-600 hover:text-indigo-800 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-indigo-300 dark:hover:text-indigo-200"
      >
        {m.grammar_map_all_chapters()}
      </a>
    {/if}
  </div>

  <div class="mb-6">
    <p
      class="mb-1 text-xs font-semibold tracking-widest text-gray-600 uppercase dark:text-gray-300"
    >
      {m.grammar_map_chapter({ no: chapter.no })}
    </p>
    <h1 class="mb-1" data-testid="chapter-heading">{chapter.titleNb}</h1>
    {#if showGloss}
      <p class="text-gray-500 dark:text-gray-400">{chapter.titleEn}</p>
    {/if}
    {#if level}
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {m.grammar_level_scope_showing({ level })}
        <a href="/grammar/chapter/{chapter.slug}" class="underline hover:text-indigo-500">
          {m.grammar_level_scope_see_all()}
        </a>
      </p>
    {/if}
  </div>

  {#if !entry}
    <!-- A level with no questions in this chapter: empty state, not a 404. -->
    <p class="text-sm text-gray-600 dark:text-gray-300">{m.grammar_empty()}</p>
  {:else if practising}
    {#if practiceQuestions.length === 0}
      <p class="py-8 text-center text-sm text-gray-600 dark:text-gray-300">{m.grammar_empty()}</p>
    {:else}
      <GrammarSession questions={practiceQuestions} rule={undefined} {userId} />
    {/if}
  {:else}
    {#if canPractise}
      <button
        onclick={startPractice}
        disabled={loadingPractice}
        data-testid="practise-chapter"
        class="mb-8 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 focus:outline-none disabled:opacity-60"
      >
        {loadingPractice ? m.stats_loading() : m.grammar_map_practise_chapter()}
      </button>
    {/if}

    <!-- One upsell banner, only when the chapter has locked topics (decision #20) -->
    {#if !isPlus && lockedCount > 0}
      <div
        class="mb-8 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-800 dark:bg-indigo-900/20"
        data-testid="chapter-upsell"
      >
        <p class="mb-1 text-base font-semibold text-indigo-800 dark:text-indigo-200">
          {m.grammar_more_topics_plus({ count: lockedCount })}
        </p>
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-300">
          {m.grammar_plus_upsell_text()}
        </p>
        <a
          href="/plus?ref=grammar-topics"
          class="inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {m.grammar_plus_cta()}
        </a>
      </div>
    {/if}

    <!-- Sections in book order (7.1, 7.2, ...), topics inline with their state -->
    {#each entry.sections as s (s.section.id)}
      <section class="mb-8" data-testid="chapter-section">
        <h2 class="mb-3 text-lg">
          <span class="text-gray-600 dark:text-gray-300">{s.section.id}</span>
          · {s.section.titleNb}
          {#if showGloss}
            <span class="text-sm font-normal text-gray-500 dark:text-gray-400">
              {s.section.titleEn}
            </span>
          {/if}
        </h2>
        <div class="grid gap-4 sm:grid-cols-2">
          {#each s.topics as topic (topic.topic)}
            {@const tp = progress.byTopic.get(topic.topic)}
            <TopicRow
              entry={topic}
              href={topicHref(topic, { level, isPlus, from })}
              {isPlus}
              {showGloss}
              seen={level ? 0 : (tp?.seen ?? 0)}
              due={tp?.due ?? 0}
            />
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</div>
