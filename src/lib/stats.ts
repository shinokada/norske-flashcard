// src/lib/stats.ts
// Per-level, per-content-type stat builders for the restructured /stats page
// (ai-docs/implementation/stats-page-improvement.md, Phase 1).
//
// Each of vocabCategoryStatsForLevel / uttrykkThemeStatsForLevel /
// grammarTopicStatsForLevel scopes an existing all-levels builder (previously
// inline in the old CategoryBarChart.svelte / UttrykkThemeChart.svelte / the
// old grammarByTopic in stats/+page.svelte, all since removed) down to a
// single CEFRLevel, and all three return the same StatRow shape so Phase 2's
// shared row-list component can render any of them identically.
import { State } from 'ts-fsrs';
import type { CardProgress, CEFRLevel, GrammarTopic } from '$lib/types';
import { CATEGORIES_BY_LEVEL } from '$lib/config';
import { uttrykkCCategoryCounts } from '$lib/uttrykk-c-stats';
import { resolveEntry } from '$lib/content-lookup';
import {
  partitionUttrykkThemes,
  UTTRYKK_OTHERS_THEME,
  categoryLabel,
  type ThemeCount
} from '$lib/vocab-helpers';
import { GRAMMAR_RULES } from '$lib/grammar/rules';
import { resolveGrammarQuestion } from '$lib/grammar/id-index';
import { orderedTopics, placementOf } from '$lib/grammar/taxonomy';
import grammarTopicIndex from '$lib/data/grammar-topic-index.json';
import { categoryCount, categoryCountsFor } from '$lib/content-index';

/**
 * Shared row shape for the per-level Vocab / Uttrykk / Grammar breakdowns.
 * Identical to the CatBarStat/ThemeStat shapes formerly inline in
 * CategoryBarChart.svelte / UttrykkThemeChart.svelte (both removed) —
 * unified here so all three content types render through one component.
 *
 * `label` is pre-formatted for display (removeHyphensAndCapitalize already
 * applied to vocab/uttrykk slugs; grammar titles are already display text)
 * so the rendering component never needs to know which content type built
 * the row.
 */
export interface StatRow {
  key: string; // category / theme / topic slug — unique within a level
  label: string; // display-ready name
  href: string; // row link target
  total: number;
  seen: number;
  review: number;
  learning: number;
  relearning: number;
  due: number;
  /**
   * Grammar rows only: the book section the topic sits in (e.g. '9.1') and the
   * chapter page it links to. LevelStatRows shows them as a small muted prefix.
   * Absent for vocab/uttrykk rows and for topics without a taxonomy placement.
   */
  sectionId?: string;
  sectionHref?: string;
  /**
   * Grammar rows only, free users: the topic has nothing free at this level. The row is
   * shown as a teaser (lock, question count, link to the topic page) with no progress.
   */
  locked?: boolean;
}

/**
 * Which content type LevelStatRows' due-badge link should scope a review
 * session to (Step 4c, ai-docs/implementation/due-only.md, extended for
 * grammar in Fix 3 of due-only-review-update.md).
 */
export type ReviewType = 'vocab' | 'uttrykk' | 'grammar';

/**
 * Builds the due-badge's review href for one row (LevelStatRows.svelte),
 * or null when this row shouldn't link anywhere — no `reviewType`/`level`
 * given. Pure/extracted so it's unit-testable without mounting the
 * component (see stats.test.ts) — LevelStatRows.svelte just calls this per
 * row.
 *
 * Grammar rows (Fix 3) go to the separate `/review/grammar` route (grammar
 * was deliberately kept out of the combined vocab+uttrykk `/review` flow —
 * see the Open Questions resolution in due-only-review-update.md) with a
 * `topic` param, since `row.key` for a grammar row is a real `GrammarTopic`
 * that lines up exactly with `CardProgress.category` there — no theme
 * workaround needed.
 *
 * For vocab/uttrykk, always includes `&category={row.key}` when reviewType
 * is set (Fix 2) — `/review` handles scoping it correctly downstream
 * regardless of which kind of row this is: `row.key` lines up with the
 * resolved entry's `category` for vocab rows and every uttrykk row (A1–B2
 * and C alike carry a real category directly as of the theme/category
 * unification — ai-docs/implementation/uttrykk-theme-category-unification.md),
 * so `/api/review-entries` can scope by it directly server-side. The
 * synthetic "Others" row (`row.key === UTTRYKK_OTHERS_THEME`) is the one
 * exception — `/review` resolves it via `uttrykkOthersKeysForLevel()`
 * below instead of a direct field match, since 'others' isn't a real
 * category value on any card.
 */
export function buildReviewHref(
  row: StatRow,
  level: CEFRLevel | undefined,
  reviewType: ReviewType | undefined
): string | null {
  if (!reviewType || !level) return null;
  const lvl = encodeURIComponent(level.toLowerCase());
  if (reviewType === 'grammar') {
    return `/review/grammar?level=${lvl}&topic=${encodeURIComponent(row.key)}`;
  }
  return `/review?level=${lvl}&type=${encodeURIComponent(reviewType)}&category=${encodeURIComponent(row.key)}`;
}

/**
 * Below this many reps, a card is still shown as "Learning" even though
 * saveProgress()'s FSRS instances all use enable_short_term:false
 * (progress.ts), which makes ts-fsrs skip its sub-day Learning/Relearning
 * steps entirely — a brand-new card jumps straight to State.Review after
 * its very first rating, of any grade. Left at raw FSRS state, that makes
 * "Learning" an almost-dead bucket: a card rated "Hard" once already reads
 * as fully "Memorized" in the stats bars. See progressBucket() below.
 */
const LEARNING_REPS_THRESHOLD = 3;

/**
 * Buckets a card into review/learning/relearning for the stats bars
 * (StatRow.review/learning/relearning, rendered by LevelStatRows.svelte as
 * "Memorized"/"Learning"/"Forgotten").
 *
 * Real Learning/Relearning FSRS states are trusted first (in case
 * enable_short_term is ever re-enabled), then approximated from reps/
 * lastRating so the buckets stay meaningful under the current
 * enable_short_term:false scheduling:
 *   - a card just rated "Again" reads as Relearning/"Forgotten", even
 *     though ts-fsrs itself sends it straight back to State.Review
 *   - a card with fewer than LEARNING_REPS_THRESHOLD reps reads as
 *     Learning/"Learning", even though it's technically in State.Review
 */
export function progressBucket(card: CardProgress): 'review' | 'learning' | 'relearning' {
  if (card.fsrs.state === State.Learning) return 'learning';
  if (card.fsrs.state === State.Relearning) return 'relearning';
  if (card.lastRating === 'again') return 'relearning';
  if (card.fsrs.reps < LEARNING_REPS_THRESHOLD) return 'learning';
  return 'review';
}

/**
 * The set of real theme names (A1–B2) or category slugs (C) that a level's
 * synthetic "Others" uttrykk row rolls up — i.e. `minor` from
 * partitionUttrykkThemes(), same threshold `uttrykkThemeStatsForLevel` used
 * to build that row in the first place. Needed by `/review` (Fix for the
 * Others due-badge) to resolve `?category=others` into the actual entries
 * it represents: `UTTRYKK_OTHERS_THEME` isn't a real `theme`/`category`
 * value stored on any card, so `getDueItems`/the resolved-entry filter
 * there can't match it directly — they need this concrete key set instead.
 *
 * `progressMap` is optional and defaults to `{}` for callers (tests, mostly)
 * that don't have one handy, but real callers (`/review`) should always pass
 * the live map: for C, this must partition over the exact same category set
 * `uttrykkThemeStatsForLevel` used to decide which row a due card landed in,
 * or the two can disagree.
 *
 * Since Phase 2 (permanent-structural-fix.md), a persisted C card's category
 * is resolved live via `content-lookup.ts`'s `resolveEntry()` rather than
 * trusted from the stored `CardProgress.category` snapshot — so a card
 * always lands under its *current* category here, even after uttrykk-c.json
 * content has been re-categorised. There's no more "stale category no
 * longer in `uttrykkCCategoryCounts()`" case to special-case: an id that no
 * longer resolves anywhere (deleted outright, not moved) is simply dropped.
 */
export function uttrykkOthersKeysForLevel(
  level: CEFRLevel,
  progressMap: Record<string, CardProgress> = {}
): Set<string> {
  if (level === 'C') {
    const categoryCounts = uttrykkCCategoryCounts();
    // Resolved live via content-lookup.ts (Phase 2, permanent-structural-fix.md)
    // instead of trusting the stored CardProgress.category — a persisted id
    // always lands under its *current* category this way, so there's no more
    // "stale category no longer in categoryCounts" case to account for; an id
    // that no longer resolves anywhere is dropped silently.
    const persistedCategories = new Set<string>();
    for (const id of Object.keys(progressMap)) {
      const resolved = resolveEntry(id);
      if (resolved && resolved.level === 'C' && resolved.type === 'uttrykk') {
        persistedCategories.add(resolved.category);
      }
    }
    const keys = new Set<string>([...categoryCounts.keys(), ...persistedCategories]);
    const categoryList: ThemeCount[] = [...keys].map((theme) => ({
      theme,
      count: categoryCounts.get(theme) ?? 0
    }));
    return new Set(partitionUttrykkThemes(categoryList).minor.map((t) => t.theme));
  }
  const themeCounts = categoryCountsFor(level, 'uttrykk');
  const themeList: ThemeCount[] = [...themeCounts.entries()].map(([theme, count]) => ({
    theme,
    count
  }));
  return new Set(partitionUttrykkThemes(themeList).minor.map((t) => t.theme));
}

function buildStatRow(
  key: string,
  label: string,
  href: string,
  total: number,
  cards: CardProgress[],
  now: Date
): StatRow {
  return {
    key,
    label,
    href,
    total,
    seen: cards.length,
    review: cards.filter((c) => progressBucket(c) === 'review').length,
    learning: cards.filter((c) => progressBucket(c) === 'learning').length,
    relearning: cards.filter((c) => progressBucket(c) === 'relearning').length,
    due: cards.filter((c) => new Date(c.fsrs.due) <= now).length
  };
}

// ── Vocabulary — category rows for one level ────────────────────────────────

// Totals come from the slim content index (content-index.ts), not the content
// files: only per-category counts are needed, and importing the files put every
// entry in the client bundle (ai-docs/implementation/stats-content-gating.md).

/**
 * Category breakdown for one CEFR level. 'uttrykk' is excluded — it belongs
 * to uttrykkThemeStatsForLevel instead. For C, cards whose progress key
 * matches an uttrykk-c.json entry are excluded too (they belong to the
 * Uttrykk block for C — see uttrykk-c-stats.ts).
 *
 * Since Phase 2 (permanent-structural-fix.md), each progress key's level and
 * category are resolved live via `content-lookup.ts`'s `resolveEntry()`
 * instead of trusted from the stored `CardProgress.level`/`.category`
 * snapshot — so a card moved to a different level, category, or vocab↔
 * uttrykk since it was last reviewed still buckets under its *current*
 * location immediately, with no re-review needed. `resolved.type` (which
 * file the id was found in) replaces the old `UTTRYKK_C_KEYS.has(key)` check
 * for telling vocab and uttrykk apart at C, where both share the same real
 * category slugs. An id that no longer resolves anywhere (the entry was
 * deleted outright, not moved) is dropped silently.
 */
export function vocabCategoryStatsForLevel(
  level: CEFRLevel,
  progressMap: Record<string, CardProgress>
): StatRow[] {
  const now = new Date();
  const lvl = level.toLowerCase();

  const levelCards: { c: CardProgress; category: string }[] = [];
  for (const [id, c] of Object.entries(progressMap)) {
    const resolved = resolveEntry(id);
    if (resolved && resolved.level === level && resolved.type === 'vocab') {
      levelCards.push({ c, category: resolved.category });
    }
  }

  return CATEGORIES_BY_LEVEL[level]
    .filter((category) => category !== 'uttrykk')
    .map((category) => {
      const catCards = levelCards.filter((lc) => lc.category === category).map((lc) => lc.c);
      const total = categoryCount(level, 'vocab', category);
      return buildStatRow(
        category,
        categoryLabel(level, category),
        `/${lvl}/${category}`,
        total,
        catCards,
        now
      );
    });
}

// ── Uttrykk — theme rows for one level ──────────────────────────────────────

/**
 * Theme breakdown for one CEFR level. As of the theme/category unification
 * (ai-docs/implementation/uttrykk-theme-category-unification.md), A1–B2
 * and C both key off a real `category` field directly — A1–B2 reads
 * uttrykk-{level}.json's `category`; C has its own loader
 * (uttrykk-c-stats.ts) for historical reasons but the two are now
 * conceptually the same shape.
 */
export function uttrykkThemeStatsForLevel(
  level: CEFRLevel,
  progressMap: Record<string, CardProgress>
): StatRow[] {
  const now = new Date();

  if (level === 'C') {
    const categoryCounts = uttrykkCCategoryCounts();
    // Resolved live via content-lookup.ts (Phase 2, permanent-structural-fix.md)
    // instead of trusting the stored CardProgress.category — a due/seen card
    // always buckets under its *current* category, even if it's moved since
    // it was last reviewed.
    const cardsByCategory = new Map<string, CardProgress[]>();
    for (const [id, card] of Object.entries(progressMap)) {
      const resolved = resolveEntry(id);
      if (resolved && resolved.level === 'C' && resolved.type === 'uttrykk') {
        const list = cardsByCategory.get(resolved.category) ?? [];
        list.push(card);
        cardsByCategory.set(resolved.category, list);
      }
    }
    const keys = new Set<string>([...categoryCounts.keys(), ...cardsByCategory.keys()]);
    const categoryList: ThemeCount[] = [...keys].map((theme) => ({
      theme,
      count: categoryCounts.get(theme) ?? 0
    }));

    // Same UTTRYKK_OTHERS_THRESHOLD bucketing the /learn/[level] hub uses
    // (Phase 8, uttrykk-category.md) — C has 37 category slugs, many with
    // only a handful of entries, so without this every one gets its own
    // tiny row here. Unlike A1-B2's Others row, C has no per-theme
    // query-param filter (Phase 9 deliberately didn't add one — C's real
    // browse dimension is its categories, already linked individually
    // below), so the combined row links to the /c/uttrykk "study all" deck
    // instead of a filtered subset.
    const { major, minor, othersCount } = partitionUttrykkThemes(categoryList);

    const rows = major
      .sort((a, b) => b.count - a.count)
      .map(({ theme: category }) =>
        buildStatRow(
          category,
          categoryLabel(level, category),
          `/c/${category}`,
          categoryCounts.get(category) ?? 0,
          cardsByCategory.get(category) ?? [],
          now
        )
      );

    if (minor.length > 0) {
      const othersCards = minor.flatMap(({ theme }) => cardsByCategory.get(theme) ?? []);
      rows.push(
        buildStatRow(
          UTTRYKK_OTHERS_THEME,
          categoryLabel(level, UTTRYKK_OTHERS_THEME),
          `/c/uttrykk`,
          othersCount,
          othersCards,
          now
        )
      );
    }

    return rows;
  }

  const lvl = level.toLowerCase();

  const themeCounts = categoryCountsFor(level, 'uttrykk');

  // Resolved live via content-lookup.ts (Phase 2, permanent-structural-fix.md)
  // instead of trusting the stored CardProgress.level/.category — a card
  // moved to a different category, level, or vocab↔uttrykk since it was last
  // reviewed buckets under its *current* category immediately. This also
  // replaces the old per-level `lookup` map built from `entries` above: that
  // map could only ever answer "what's this id's category *at this level's
  // current content*", which silently broke the moment a card's real level
  // changed — `resolveEntry()` isn't scoped to one level's file at all, so
  // it always finds the id wherever it currently lives.
  //
  // As of the theme/category unification
  // (ai-docs/implementation/uttrykk-theme-category-unification.md), A1–B2
  // uttrykk entries carry a real category directly — the old
  // `resolved.theme ?? UTTRYKK_CATCHALL_THEME` fallback is gone since
  // `category` is always set now, same as vocab and C uttrykk.
  const cardsByTheme = new Map<string, CardProgress[]>();
  for (const [id, card] of Object.entries(progressMap)) {
    const resolved = resolveEntry(id);
    if (resolved && resolved.level === level && resolved.type === 'uttrykk') {
      const theme = resolved.category;
      const list = cardsByTheme.get(theme) ?? [];
      list.push(card);
      cardsByTheme.set(theme, list);
    }
  }

  const themeKeys = new Set<string>([...themeCounts.keys(), ...cardsByTheme.keys()]);
  const themeList: ThemeCount[] = [...themeKeys].map((theme) => ({
    theme,
    count: themeCounts.get(theme) ?? 0
  }));

  // Bucket small themes into one "Others" row, same UTTRYKK_OTHERS_THRESHOLD
  // and UTTRYKK_OTHERS_THEME the /learn/[level] hub uses (Phase 3b,
  // uttrykk-category.md) — keeps /stats consistent with the hub instead of
  // listing a long tail of tiny rows. Links to `?theme=others`, which
  // [level]/[category]/+page.server.ts already resolves via the same
  // partitionUttrykkThemes() call, so the deep link works with no
  // server-side changes.
  const { major, minor, othersCount } = partitionUttrykkThemes(themeList);

  const rows = major
    .sort((a, b) => b.count - a.count)
    .map(({ theme }) =>
      buildStatRow(
        theme,
        categoryLabel(level, theme),
        `/${lvl}/uttrykk?theme=${theme}`,
        themeCounts.get(theme) ?? 0,
        cardsByTheme.get(theme) ?? [],
        now
      )
    );

  if (minor.length > 0) {
    const othersCards = minor.flatMap(({ theme }) => cardsByTheme.get(theme) ?? []);
    rows.push(
      buildStatRow(
        UTTRYKK_OTHERS_THEME,
        categoryLabel(level, UTTRYKK_OTHERS_THEME),
        `/${lvl}/uttrykk?theme=${UTTRYKK_OTHERS_THEME}`,
        othersCount,
        othersCards,
        now
      )
    );
  }

  return rows;
}

// ── Grammar — topic rows for one level (new) ────────────────────────────────

type GrammarTopicIndexEntry = {
  levels: CEFRLevel[];
  countsByLevel: Partial<Record<CEFRLevel, number>>;
  total: number;
};

/**
 * Total question count per topic, per CEFR level — derived from the
 * grammar-topic-index.json build artifact (scripts/build-grammar-level-index.mjs)
 * instead of loading every question from grammar.json, since only the counts
 * are needed here. Drives both `total` (the row's denominator) and which
 * topics even appear under a given level tab: a topic with zero questions at
 * this level (e.g. 'ubestemt-artikkel-c', C-only) is omitted rather than
 * shown as an empty row.
 */
const grammarTotalsByLevel: Record<CEFRLevel, Partial<Record<GrammarTopic, number>>> = {
  A1: {},
  A2: {},
  B1: {},
  B2: {},
  C: {}
};
for (const [topic, entry] of Object.entries(
  grammarTopicIndex as Record<string, GrammarTopicIndexEntry>
)) {
  for (const [level, count] of Object.entries(entry.countsByLevel) as [CEFRLevel, number][]) {
    grammarTotalsByLevel[level][topic as GrammarTopic] = count;
  }
}

/**
 * Topic breakdown for one CEFR level. Only includes topics that actually
 * have questions at this level (see grammarTotalsByLevel) — a topic whose
 * questions are all, say, B2 never shows up under the A1 tab.
 *
 * Each progress key's topic and level are resolved live from the question id
 * via grammar/id-index.ts (grammar-update.md, Phase 3) instead of trusting the
 * stored `CardProgress.category`/`.level` snapshot, which is stale for cards
 * reviewed before the Phase 1b topic reorganisation. An id that no longer
 * exists in grammar.json is dropped silently.
 *
 * `isNb` selects the locale for topics outside Nivå C; C topics are always
 * shown in Norwegian (mirrors the forceNb rule in
 * routes/grammar/[topic]/+page.svelte — Nivå C content is hardcoded NB, see
 * ai-docs/implementation/c-grammar-norsk-instruksjoner.md).
 */
export function grammarTopicStatsForLevel(
  level: CEFRLevel,
  grammarMap: Record<string, CardProgress>,
  isNb: boolean
): StatRow[] {
  const now = new Date();
  const totalsForLevel = grammarTotalsByLevel[level];

  const cardsByTopic = new Map<string, CardProgress[]>();
  for (const [id, card] of Object.entries(grammarMap)) {
    const resolved = resolveGrammarQuestion(id);
    if (!resolved || resolved.level !== level) continue;
    const list = cardsByTopic.get(resolved.topic) ?? [];
    list.push(card);
    cardsByTopic.set(resolved.topic, list);
  }

  // Book order (chapter, section, topic) so the list follows /grammar/chapter/…;
  // a topic with no taxonomy placement sorts last. Array.sort is stable, so
  // those keep their GRAMMAR_RULES order.
  const bookOrder = new Map(orderedTopics().map((topic, i) => [topic, i]));

  return Object.values(GRAMMAR_RULES)
    .filter((rule) => (totalsForLevel[rule.id] ?? 0) > 0)
    .sort(
      (a, b) =>
        (bookOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (bookOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    )
    .map((rule) => {
      const title = level === 'C' ? rule.titleNb : isNb ? rule.titleNb : rule.titleEn;
      const row = buildStatRow(
        rule.id,
        title,
        `/grammar/${rule.id}`,
        totalsForLevel[rule.id] ?? 0,
        cardsByTopic.get(rule.id) ?? [],
        now
      );
      const placement = placementOf(rule.id);
      if (placement) {
        row.sectionId = placement.section.id;
        row.sectionHref = `/grammar/chapter/${placement.chapter.slug}`;
      }
      return row;
    });
}
