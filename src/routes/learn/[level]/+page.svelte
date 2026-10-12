<script lang="ts">
  import { page } from '$app/state';
  import { GRAMMAR_RULES } from '$lib/grammar/rules';
  import { categoryLabel, partitionUttrykkThemes, UTTRYKK_OTHERS_THEME } from '$lib/vocab-helpers';
  import { isFreeUttrykkTheme } from '$lib/uttrykk-gating';
  import { learnHubExpanded } from '$lib/stores/learnHubExpanded.svelte';
  import type { UttrykkThemeLevel } from '$lib/config';
  import { adjacentLevels } from '$lib/level-nav';
  import * as m from '$lib/paraglide/messages';

  let { data } = $props();

  // Translated level name for the hero badge and the prev/next aria-labels.
  function levelName(slug: string): string {
    switch (slug) {
      case 'a1':
        return m.level_hub_beginner();
      case 'a2':
        return m.level_hub_elementary();
      case 'b1':
        return m.level_hub_intermediate();
      case 'b2':
        return m.level_hub_upper_intermediate();
      default:
        return m.level_hub_mastery();
    }
  }

  const adjacent = $derived(adjacentLevels(data.level));

  let isPlus = $derived(page.data.plan === 'plus');

  const levelColors: Record<string, { heading: string; badge: string; accent: string }> = {
    a1: {
      heading: 'text-green-700 dark:text-green-400',
      badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      accent: 'text-green-700 dark:text-green-400'
    },
    a2: {
      heading: 'text-teal-700 dark:text-teal-400',
      badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
      accent: 'text-teal-700 dark:text-teal-400'
    },
    b1: {
      heading: 'text-blue-700 dark:text-blue-400',
      badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      accent: 'text-blue-700 dark:text-blue-400'
    },
    b2: {
      heading: 'text-indigo-700 dark:text-indigo-400',
      badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
      accent: 'text-indigo-700 dark:text-indigo-400'
    },
    c: {
      heading: 'text-purple-700 dark:text-purple-400',
      badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      accent: 'text-purple-700 dark:text-purple-400'
    }
  };

  const colors = $derived(levelColors[data.level] ?? levelColors['b1']);

  function entryLabel(s: { vocab: number; uttrykk: number; total: number } | null): string {
    if (!s) return '';
    if (s.uttrykk > 0) {
      return m.level_hub_words_and_phrases({
        vocab: s.vocab.toLocaleString(),
        uttrykk: s.uttrykk.toLocaleString()
      });
    }
    return m.level_hub_words({ count: s.vocab.toLocaleString() });
  }

  // Phase 3 (ai-docs/implementation/uttrykk-gate.md): 'uttrykk-preview' is
  // retired (no longer a real category slug), so this only ever needs to
  // exclude 'uttrykk' itself — it gets its own dedicated Section 2b below.
  const visibleCategories = $derived(
    data.categories.filter((c: { slug: string; locked: boolean }) => c.slug !== 'uttrykk')
  );

  const uttrykkCategory = $derived(
    data.categories.find((c: { slug: string; locked: boolean }) => c.slug === 'uttrykk')
  );

  // Phase 3b: split into major themes (own pill) + a single Others bucket
  // for anything under UTTRYKK_OTHERS_THRESHOLD, so a long tail of tiny
  // themes (several A1 themes sit at count 1–2) doesn't balloon the pill row.
  const uttrykkThemeGroups = $derived(partitionUttrykkThemes(data.uttrykkThemes));

  const showNorskproven = $derived(data.level === 'a2' || data.level === 'b1');

  const GRAMMAR_INITIAL = 4;
  // Phase 8 (ai-docs/implementation/uttrykk-category.md): same collapse
  // pattern as Grammar/blog, applied to Vocabulary's category pills and
  // Uttrykk's theme/category pills — both sections can run to 15-40 pills
  // at B1/B2/C.
  const VOCAB_INITIAL = 12;
  const UTTRYKK_INITIAL = 8;
  // Backed by a shared, level-keyed store (see $lib/stores/learnHubExpanded)
  // instead of local $state, so "Show more" stays expanded across ordinary
  // client-side navigation — e.g. into a flashcard session and back via the
  // main nav — not just SvelteKit history back/forward.
  let grammarExpanded = $derived(learnHubExpanded.get('grammar', data.level));
  let vocabExpanded = $derived(learnHubExpanded.get('vocab', data.level));
  let uttrykkExpanded = $derived(learnHubExpanded.get('uttrykk', data.level));

  const visibleGrammarTopics = $derived(
    grammarExpanded ? data.grammarTopics : data.grammarTopics.slice(0, GRAMMAR_INITIAL)
  );
  const hiddenGrammarCount = $derived(data.grammarTopics.length - GRAMMAR_INITIAL);

  // Vocabulary section show-more. Locked categories render inline too now
  // (dimmed, with a 🔒 linking to /plus) instead of being filtered out and
  // summarized behind an aggregate "+N with Plus" pill, so the raw category
  // list is exactly what's shown — "Show more" counts/slices it directly.
  const visibleVocabCategories = $derived(
    vocabExpanded ? visibleCategories : visibleCategories.slice(0, VOCAB_INITIAL)
  );
  const hiddenVocabCount = $derived(Math.max(visibleCategories.length - VOCAB_INITIAL, 0));

  // Uttrykk section show-more, A1–B2 branch (major theme pills; the Others
  // pill and any locked-preview card are unaffected by this slice).
  const visibleUttrykkMajorThemes = $derived(
    uttrykkExpanded ? uttrykkThemeGroups.major : uttrykkThemeGroups.major.slice(0, UTTRYKK_INITIAL)
  );
  const hiddenUttrykkMajorCount = $derived(
    Math.max(uttrykkThemeGroups.major.length - UTTRYKK_INITIAL, 0)
  );

  // Uttrykk section show-more, C branch (category-count pills — see Phase 8
  // below). Reuses uttrykkExpanded since only one of the two branches ever
  // renders on a given level's page.
  const visibleUttrykkCThemes = $derived(
    uttrykkExpanded ? data.uttrykkThemes : data.uttrykkThemes.slice(0, UTTRYKK_INITIAL)
  );
  const hiddenUttrykkCCount = $derived(Math.max(data.uttrykkThemes.length - UTTRYKK_INITIAL, 0));

  const schemaJson = $derived(
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'LearningResource',
      name: `Learn Norwegian ${data.levelUpper} — Norskeord`,
      description: `All learning resources for Norwegian CEFR level ${data.levelUpper}: vocabulary, grammar, quizzes, and Norskprøven preparation.`,
      url: `https://norskeord.no/learn/${data.level}`,
      educationalLevel: data.levelUpper,
      inLanguage: 'nb',
      learningResourceType: ['Flashcard', 'Practice Problems', 'Quiz'],
      isAccessibleForFree: true,
      provider: { '@type': 'Organization', name: 'Norskeord', url: 'https://norskeord.no' }
    })
  );
</script>

<svelte:head>
  <title>Learn Norwegian {data.levelUpper} — Norskeord</title>
  <meta
    name="description"
    content="Vocabulary flashcards, grammar practice, quizzes and Norskprøven preparation at {data.levelUpper} ({data.cefrLabel}) level."
  />
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html '<scr' + 'ipt type="application/ld+json">' + schemaJson + '</scr' + 'ipt>'}
</svelte:head>

<!-- Previous / next level link (ai-docs/implementation/level-navigation.md). Visible text is
     only the level code; the aria-label carries the full meaning. -->
{#snippet levelLink(slug: string, dir: 'prev' | 'next', variant: 'hero' | 'bottom')}
  {@const code = slug.toUpperCase()}
  <a
    href="/learn/{slug}"
    aria-label={m.level_nav_go_to({ level: code, name: levelName(slug) })}
    class="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm font-medium transition hover:underline {colors.accent}
      {variant === 'bottom'
      ? 'rounded-full border border-gray-200 bg-white px-4 py-2 opacity-90 hover:border-indigo-300 hover:opacity-100 dark:border-gray-700 dark:bg-indigo-950/60'
      : 'rounded-lg px-2 opacity-80 hover:opacity-100'}"
  >
    {#if dir === 'prev'}
      <span aria-hidden="true">{variant === 'bottom' ? '←' : '‹'}</span>
    {/if}
    <span aria-hidden="true" class={variant === 'hero' ? 'hidden min-[360px]:inline' : ''}
      >{code}</span
    >
    {#if dir === 'next'}
      <span aria-hidden="true">{variant === 'bottom' ? '→' : '›'}</span>
    {/if}
  </a>
{/snippet}

<!-- ── Section 1 — Level hero ──────────────────────────────────────────── -->
<div
  class="mb-10 border-b border-gray-200 bg-gray-50 px-4 py-10 text-center dark:border-gray-700 dark:bg-gray-800/50"
>
  <div class="mx-auto max-w-3xl">
    <!-- Fixed-width outer columns keep the title centred even when only one arrow exists.
         The middle column may shrink and wrap (B2's badge is long on a 320px screen). -->
    <div
      class="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 min-[360px]:grid-cols-[4.5rem_1fr_4.5rem]"
    >
      <div class="justify-self-start">
        {#if adjacent.prev}
          {@render levelLink(adjacent.prev, 'prev', 'hero')}
        {/if}
      </div>
      <div class="flex min-w-0 flex-wrap items-baseline justify-center gap-3">
        <h1 class="mb-0 leading-none {colors.heading}" style="letter-spacing:0.04em">
          {data.levelUpper}
        </h1>
        <span class="font-norse rounded-full px-3 py-1 text-xl font-semibold {colors.badge}">
          {levelName(data.level)}
        </span>
      </div>
      <div class="justify-self-end">
        {#if adjacent.next}
          {@render levelLink(adjacent.next, 'next', 'hero')}
        {/if}
      </div>
    </div>
    {#if data.levelStats}
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{entryLabel(data.levelStats)}</p>
    {/if}
    {#if !page.data.user}
      <a
        href="/auth/login"
        class="mt-4 inline-block rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500"
      >
        {m.level_hub_start_free()}
      </a>
    {/if}
  </div>
</div>

<div class="mx-auto max-w-3xl px-4 pb-16">
  <!-- ── Section 2 — Vocabulary ──────────────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="mb-4">📖 Vocabulary</h2>
    <div class="flex flex-wrap gap-2">
      {#each visibleVocabCategories as cat (cat.slug)}
        {@const locked = !isPlus && cat.locked}
        <a
          href={locked
            ? `/${data.level}/${cat.slug}?ref=hub-vocab-badge`
            : `/${data.level}/${cat.slug}`}
          class="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-medium transition
            {locked
            ? 'border-gray-200 bg-white text-gray-500 opacity-60 dark:border-gray-700 dark:bg-indigo-950/40 dark:text-gray-400'
            : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-gray-700 dark:bg-indigo-950/60 dark:text-gray-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300'}"
        >
          {categoryLabel(data.level, cat.slug)}{#if locked}
            🔒{/if}
        </a>
      {/each}
    </div>
    {#if hiddenVocabCount > 0 || vocabExpanded}
      <button
        onclick={() => learnHubExpanded.toggle('vocab', data.level)}
        class="mt-4 text-sm font-medium {colors.accent} hover:underline"
      >
        {vocabExpanded
          ? m.level_hub_show_less()
          : m.level_hub_show_more({ count: hiddenVocabCount })}
      </button>
    {/if}
  </section>

  <!-- ── Section 2b — Uttrykk (fixed expressions) ──────────────────────────── -->
  <!-- Phase 8 (ai-docs/implementation/uttrykk-category.md): C has no
       category === 'uttrykk' entry in CATEGORIES_BY_LEVEL (Phase 4 merges
       uttrykk-c.json into the regular c/{category} vocab pages instead), so
       uttrykkCategory is always undefined for C. The second branch below
       covers C specifically: pills with per-category counts of the
       phrase-sourced entries, each linking to the same /c/{category} page
       its Vocabulary pill already links to — the "two entry points, one
       page" option chosen over a single unclickable summary card or
       skipping the section entirely. -->
  {#if uttrykkCategory || (data.levelUpper === 'C' && data.uttrykkThemes.length > 0)}
    <section id="uttrykk" class="mb-12">
      <h2 class="mb-4">💬 Uttrykk</h2>
      {#if uttrykkCategory}
        <!-- Phase 1/2 (ai-docs/implementation/uttrykk-gate.md): uttrykk is
             gated per-theme, not per-category, so this section never
             collapses to a single locked teaser card anymore — 2–3 curated
             themes (FREE_UTTRYKK_THEMES) are fully free for every free
             user, every other theme pill stays visible but dimmed with a
             🔒, same visual language Grammar already uses for its locked
             topic cards (chosen over Vocabulary's hide-and-aggregate
             pattern because there are only ~5–9 major theme pills here, not
             20–30 — see uttrykk-gate.md Phase 4's "per-pill vs aggregate"
             note). The "study the whole deck" overview card (fixed count +
             explainer, no theme filter) has been removed for everyone —
             it was a Plus-only shortcut that only ever duplicated what the
             theme pills below already offer as direct entry points. -->
        {#if uttrykkThemeGroups.major.length > 0}
          <div class="mt-3 flex flex-wrap gap-2">
            {#each visibleUttrykkMajorThemes as t (t.theme)}
              {@const themeLocked =
                !isPlus && !isFreeUttrykkTheme(data.levelUpper as UttrykkThemeLevel, t.theme)}
              <a
                href={themeLocked
                  ? `/${data.level}/uttrykk?theme=${t.theme}&ref=hub-uttrykk-theme`
                  : `/${data.level}/uttrykk?theme=${t.theme}`}
                class="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-medium transition
                  {themeLocked
                  ? 'border-gray-200 bg-white text-gray-500 opacity-60 dark:border-gray-700 dark:bg-indigo-950/40 dark:text-gray-400'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-gray-700 dark:bg-indigo-950/60 dark:text-gray-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300'}"
              >
                {categoryLabel(data.level, t.theme)} ({t.count}){#if themeLocked}
                  🔒{/if}
              </a>
            {/each}
            {#if uttrykkThemeGroups.minor.length > 0}
              <!-- Others is locked for free users except at A1, which is now
                   fully open (see uttrykk-gating.ts) — so this defers to
                   isFreeUttrykkTheme instead of a hardcoded !isPlus check. -->
              {@const othersLocked =
                !isPlus &&
                !isFreeUttrykkTheme(data.levelUpper as UttrykkThemeLevel, UTTRYKK_OTHERS_THEME)}
              <a
                href={othersLocked
                  ? `/${data.level}/uttrykk?theme=${UTTRYKK_OTHERS_THEME}&ref=hub-uttrykk-theme`
                  : `/${data.level}/uttrykk?theme=${UTTRYKK_OTHERS_THEME}`}
                class="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-medium transition
                  {othersLocked
                  ? 'border-gray-200 bg-white text-gray-500 opacity-60 dark:border-gray-700 dark:bg-indigo-950/40 dark:text-gray-400'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-gray-700 dark:bg-indigo-950/60 dark:text-gray-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300'}"
              >
                Others ({uttrykkThemeGroups.othersCount}){#if othersLocked}
                  🔒{/if}
              </a>
            {/if}
          </div>
          {#if hiddenUttrykkMajorCount > 0 || uttrykkExpanded}
            <button
              onclick={() => learnHubExpanded.toggle('uttrykk', data.level)}
              class="mt-4 text-sm font-medium {colors.accent} hover:underline"
            >
              {uttrykkExpanded
                ? m.level_hub_show_less()
                : m.level_hub_show_more({ count: hiddenUttrykkMajorCount })}
            </button>
          {/if}
        {/if}
      {:else}
        <!-- C branch: no per-category lock state of its own for the pills below —
             each pill's lock state comes from the matching Vocabulary
             category. Phase 9 (ai-docs/implementation/uttrykk-category.md)
             added a virtual /c/uttrykk "study all" deck; the total-count
             summary line that used to sit above these pills was removed —
             no other level page (A1–B2) has an equivalent line, so it was
             an inconsistency rather than a pattern worth keeping. -->
        <div class="flex flex-wrap gap-2">
          {#each visibleUttrykkCThemes as t (t.theme)}
            {@const cat = data.categories.find(
              (c: { slug: string; locked: boolean }) => c.slug === t.theme
            )}
            {@const catLocked = cat ? !isPlus && cat.locked : false}
            <a
              href={catLocked
                ? `/${data.level}/${t.theme}?from=uttrykk&ref=hub-uttrykk-badge`
                : `/${data.level}/${t.theme}?from=uttrykk`}
              class="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-medium transition
                {catLocked
                ? 'border-gray-200 bg-white text-gray-500 opacity-60 dark:border-gray-700 dark:bg-indigo-950/40 dark:text-gray-400'
                : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-gray-700 dark:bg-indigo-950/60 dark:text-gray-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300'}"
            >
              {categoryLabel(data.level, t.theme)} ({t.count}){#if catLocked}
                🔒{/if}
            </a>
          {/each}
        </div>
        {#if hiddenUttrykkCCount > 0 || uttrykkExpanded}
          <button
            onclick={() => learnHubExpanded.toggle('uttrykk', data.level)}
            class="mt-4 text-sm font-medium {colors.accent} hover:underline"
          >
            {uttrykkExpanded
              ? m.level_hub_show_less()
              : m.level_hub_show_more({ count: hiddenUttrykkCCount })}
          </button>
        {/if}
      {/if}
    </section>
  {/if}

  <!-- ── Section 3 — Grammar ─────────────────────────────────────────────── -->
  {#if data.grammarTopics.length > 0}
    <section class="mb-12">
      <h2 class="mb-4">🧩 Grammar</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        {#each visibleGrammarTopics as t (t.topic)}
          {@const rule = GRAMMAR_RULES[t.topic]}
          {@const locked = !isPlus && !t.free}
          <a
            href={locked
              ? '/plus?ref=hub-grammar'
              : `/grammar/${t.topic}?from=${data.level}&level=${data.levelUpper}`}
            class="group flex flex-col rounded-2xl border p-4 text-left transition
              {locked
              ? 'border-gray-200 bg-white dark:border-gray-700 dark:bg-indigo-950/40'
              : 'border-gray-200 bg-white shadow-sm hover:shadow-md dark:border-white/10 dark:bg-indigo-950/60 dark:hover:bg-indigo-950/80'}"
          >
            <div class="mb-1 flex items-start justify-between gap-2">
              <h3
                class="text-sm font-semibold {locked
                  ? 'opacity-60 '
                  : ''}text-gray-800 dark:text-gray-100"
              >
                {rule ? rule.titleNb : t.topic}
              </h3>
              {#if locked}
                <span
                  class="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                >
                  🔒 Plus
                </span>
              {/if}
            </div>
            {#if t.levels.length}
              <div class="mb-2 flex flex-wrap gap-1">
                {#each t.levels as lv (lv)}
                  <span
                    class="rounded bg-indigo-50 px-2 py-1 text-sm font-semibold tracking-wide text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300"
                  >
                    {lv}
                  </span>
                {/each}
              </div>
            {/if}
            <p
              class="line-clamp-2 text-sm {locked
                ? 'opacity-60 '
                : ''}text-gray-600 dark:text-gray-300"
            >
              {rule ? rule.explanationNb : ''}
            </p>
            <div class="mt-2 text-xs text-gray-600 dark:text-gray-300">{t.total} questions</div>
          </a>
        {/each}
      </div>
      {#if hiddenGrammarCount > 0 || grammarExpanded}
        <button
          onclick={() => learnHubExpanded.toggle('grammar', data.level)}
          class="mt-4 text-sm font-medium {colors.accent} hover:underline"
        >
          {grammarExpanded
            ? m.level_hub_show_less()
            : m.level_hub_show_more({ count: hiddenGrammarCount })}
        </button>
      {/if}
    </section>
  {/if}

  <!-- ── Section 4 — Quiz ────────────────────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="mb-4">🎯 Quiz</h2>
    <a
      href="/quiz?level={data.levelUpper}"
      class="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-indigo-950/60 dark:hover:bg-indigo-950/80"
    >
      <div class="text-left">
        <p class="font-semibold text-gray-800 dark:text-gray-100">
          Start a {data.levelUpper} quiz
        </p>
        <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
          Multiple-choice, fill-in-the-blank, and typed answers{#if !isPlus && data.level !== 'a1'}
            · some categories require Plus{/if}
        </p>
      </div>
    </a>
  </section>

  <!-- ── Section 5 — Norskprøven (A2 and B1 only) ───────────────────────── -->
  {#if showNorskproven}
    <section class="mb-12">
      <h2 class="mb-4">📝 Norskprøven</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <a
          href="/norskproven"
          class="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-indigo-950/60 dark:hover:bg-indigo-950/80"
        >
          <p class="font-semibold text-gray-800 dark:text-gray-100">Vocabulary prep</p>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Exam-targeted vocabulary for the official Norwegian language test at {data.levelUpper}.
          </p>
        </a>
        <a
          href="/norskproven"
          class="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-indigo-950/60 dark:hover:bg-indigo-950/80"
        >
          <div class="flex items-center gap-2">
            <p class="font-semibold text-gray-800 dark:text-gray-100">Practice tests</p>
            {#if !isPlus}
              <span
                class="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300"
              >
                Plus
              </span>
            {/if}
          </div>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Reading, writing, and oral practice in exam format. Test 1 is always free.
          </p>
        </a>
      </div>
    </section>
  {/if}

  <!-- ── Section 6 — From the blog ─────────────────────────────────────────── -->
  {#if data.blogPosts.length > 0}
    <section class="mb-12">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="mb-4">✍️ From the blog</h2>
        <a
          href="/blog?level={data.levelUpper}"
          class="text-sm font-medium {colors.accent} hover:underline"
        >
          {m.level_hub_all_articles({ count: data.blogPostCount, level: data.levelUpper })}
        </a>
      </div>
      <div class="space-y-3">
        {#each data.blogPosts as post (post.slug)}
          <a
            href="/blog/{post.slug}"
            class="block rounded-xl border border-gray-200 bg-white px-5 py-4 text-left transition hover:shadow-sm dark:border-gray-700 dark:bg-indigo-950/60"
          >
            <p class="font-semibold text-gray-900 dark:text-white">{post.title}</p>
            {#if post.description}
              <p class="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
                {post.description}
              </p>
            {/if}
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <!-- ── Previous / next level (outside the blog block so every level keeps them) ── -->
  <nav class="flex items-center justify-between gap-4" aria-label={m.level_nav_label()}>
    <div>
      {#if adjacent.prev}
        {@render levelLink(adjacent.prev, 'prev', 'bottom')}
      {/if}
    </div>
    <div>
      {#if adjacent.next}
        {@render levelLink(adjacent.next, 'next', 'bottom')}
      {/if}
    </div>
  </nav>
</div>
