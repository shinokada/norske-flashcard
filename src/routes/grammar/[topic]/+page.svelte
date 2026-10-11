<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { GRAMMAR_RULES } from '$lib/grammar/rules';
  import TopicTabs from '$lib/components/grammar/TopicTabs.svelte';
  import TopicNav from '$lib/components/grammar/TopicNav.svelte';
  import { chapterHref } from '$lib/grammar/overview';
  import {
    lockedFromCounts,
    parseTabParam,
    teaserLevelsFrom,
    teaserText,
    topicNavModel
  } from '$lib/grammar/topic-page';
  import * as m from '$lib/paraglide/messages';

  let { data } = $props();

  let isPlus = $derived(page.data.plan === 'plus');
  let userId = $derived(isPlus ? (page.data.user?.id ?? null) : null);

  let rule = $derived(GRAMMAR_RULES[data.topic]);
  // Grammar questions are Norwegian-only at every level (see
  // ai-docs/implementation/grammar-with-only-norsk.md).
  let title = $derived(rule ? rule.titleNb : data.topic);

  // Optional level scoping (ai-docs/implementation/grammar-fix.md §5,
  // extended in ai-docs/implementation/grammar-ux-update.md Step 1): when a
  // locked-segment card or a level hub links here with e.g. ?level=B1, a
  // free user must see the paywall even if the topic has free content at a
  // *different* level (e.g. A1) — otherwise they'd silently land on the
  // wrong content instead of the lock screen. Plus users are now scoped by
  // levelParam too (previously they saw every level combined regardless —
  // that let a topic clicked from e.g. /learn/b2 show its A2/B1 questions
  // as well, which is the bug grammar-ux-update.md Step 1 fixes).
  const CEFR_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C']);
  let levelParam = $derived(() => {
    const raw = page.url.searchParams.get('level')?.toUpperCase() ?? '';
    return CEFR_LEVELS.has(raw) ? (raw as (typeof data.questions)[number]['cefr']) : null;
  });

  // Free users get the free subset; Plus users get everything. Either way,
  // the result is further scoped to levelParam when present, so a user
  // coming from a specific level hub/pill only ever practices that level.
  let freeSet = $derived(new Set(data.freeQuestionIds));
  let playable = $derived(
    (isPlus ? data.questions : data.questions.filter((q) => freeSet.has(q.id))).filter(
      (q) => !levelParam() || q.cefr === levelParam()
    )
  );
  let locked = $derived(!isPlus && playable.length === 0);

  // Plus teaser (Phase 6c): how the questions in scope (all levels, or just
  // ?level=) split by level, and how many a free learner cannot play. The counts
  // come from the server (`data.levelCounts`, computed from the full topic), not
  // from `data.questions`, because a free user is never sent the locked questions
  // (ai-docs/implementation/grammar-server-gating.md).
  let teaser = $derived(teaserText(rule));
  let teaserLevels = $derived(teaserLevelsFrom(data.levelCounts, levelParam()));
  let lockedInfo = $derived(lockedFromCounts(data.levelCounts, levelParam()));

  // Breadcrumb, prev/next and related topics, all from the taxonomy (Phase 6a).
  let nav = $derived(topicNavModel(data.topic));
  let tabParam = $derived(parseTabParam(page.url.searchParams.get('tab')));

  // Back-navigation: if the user came from a level hub, show "← B1" on the
  // left and "Grammar topics →" on the right. Otherwise fall back to just
  // "Grammar topics →" on the left.
  const VALID_LEVELS = new Set(['a1', 'a2', 'b1', 'b2', 'c']);
  let fromLevel = $derived(() => {
    const raw = page.url.searchParams.get('from')?.toLowerCase() ?? '';
    return VALID_LEVELS.has(raw) ? raw : null;
  });

  // Use history.back() so SvelteKit restores the snapshot (expanded state)
  // on the level hub. Fall back to a direct href if there's no history entry
  // (e.g. page was opened in a new tab).
  function goBack(level: string, e: MouseEvent) {
    if (!browser) return;
    // history.length === 1 means this is the first page in the tab — no back.
    if (history.length > 1) {
      e.preventDefault();
      history.back();
    }
    // Otherwise let the <a> href handle it normally.
  }
</script>

<!-- <title> and meta come from `pageMetaTags` in +page.server.ts (merged in +layout.svelte). -->

<div class="mx-auto max-w-2xl px-4 py-10 text-left">
  <div class="mb-4 flex items-center justify-between">
    {#if fromLevel()}
      <a
        href="/learn/{fromLevel()}"
        onclick={(e) => goBack(fromLevel()!, e)}
        class="inline-flex items-center gap-1 rounded text-sm text-indigo-600 hover:text-indigo-800 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-indigo-300 dark:hover:text-indigo-200"
      >
        ← {fromLevel()!.toUpperCase()}
      </a>
    {:else}
      <span></span>
    {/if}
    <a
      href="/grammar"
      class="rounded text-sm text-gray-600 hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-gray-300 dark:hover:text-indigo-300"
    >
      {m.grammar_back_to_topics()} →
    </a>
  </div>

  {#if nav}
    <nav
      aria-label={m.grammar_topic_breadcrumb_aria()}
      data-testid="topic-page-breadcrumb"
      class="mb-3 text-xs text-gray-500 dark:text-gray-400"
    >
      <a href="/grammar" class="hover:text-indigo-500">{m.grammar_title()}</a>
      <span aria-hidden="true">›</span>
      <a href={chapterHref(nav.chapter.slug, levelParam())} class="hover:text-indigo-500">
        {nav.chapter.no}. {nav.chapter.titleNb}
      </a>
      <span aria-hidden="true">›</span>
      <span aria-current="page">{nav.section.id} {nav.section.titleNb}</span>
    </nav>
  {/if}

  <h1 class="mb-6 text-xl font-bold text-gray-900 dark:text-white">{title}</h1>

  {#if locked}
    <!-- Plus teaser: the rule's opening and what is inside, then the upsell. -->
    {#if teaser}
      <section
        data-testid="topic-teaser"
        class="mb-4 rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm dark:border-gray-700 dark:bg-indigo-950/60"
      >
        <p
          class="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
        >
          {m.grammar_teaser_label()}
        </p>
        <p class="text-sm text-gray-700 dark:text-gray-300" data-testid="topic-teaser-text">
          {teaser}
        </p>
        {#if teaserLevels.length > 0}
          <ul class="mt-4 flex flex-wrap gap-2" data-testid="topic-teaser-levels">
            {#each teaserLevels as lc (lc.level)}
              <li
                class="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                {m.grammar_teaser_level_count({ level: lc.level, count: lc.count })}
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
    <div
      class="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-center shadow-sm dark:border-amber-700 dark:bg-amber-900/20"
    >
      <p class="mb-2 text-2xl" aria-hidden="true">🔒</p>
      <h2 class="mb-2 text-lg font-bold text-amber-800 dark:text-amber-200">
        {m.grammar_plus_locked_title()}
      </h2>
      <p class="mb-4 text-sm text-amber-700 dark:text-amber-300">{m.grammar_plus_locked_desc()}</p>
      <a
        href="/plus?ref=grammar-topic-lock"
        class="inline-block rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 focus:ring-4 focus:ring-amber-300 focus:outline-none"
      >
        {m.grammar_plus_cta()}
      </a>
    </div>
  {:else}
    <!-- Active level-scope indicator + escape hatch (only once real content
         is playing here — not shown on the locked/paywall view above, since
         that intentionally hides other-level free content per
         ai-docs/implementation/grammar-fix.md §5; see
         ai-docs/implementation/grammar-ux-update.md Step 5). -->
    {#if levelParam()}
      <p class="-mt-4 mb-4 text-sm text-gray-500 dark:text-gray-400">
        {m.grammar_level_scope_showing({ level: levelParam()! })}
        <a href="/grammar/{data.topic}" class="underline hover:text-indigo-500">
          {m.grammar_level_scope_see_all()}
        </a>
      </p>
    {/if}
    {#key data.topic}
      <TopicTabs {rule} questions={playable} {userId} {tabParam} />
    {/key}
    {#if !isPlus && lockedInfo.total > 0}
      <p class="mt-6 text-sm" data-testid="topic-locked-levels">
        <a
          href="/plus?ref=grammar-topic-levels"
          class="text-amber-700 underline hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200"
        >
          {m.grammar_teaser_locked_levels({
            count: lockedInfo.total,
            levels: lockedInfo.levels.map((l) => l.level).join(', ')
          })} →
        </a>
      </p>
    {/if}
  {/if}

  {#if nav}
    <TopicNav {nav} />
  {/if}
</div>
