// src/lib/grammar/topic-page.ts
// View-model helpers for /grammar/[topic] (ai-docs/implementation/grammar-update.md,
// Phase 6a: Regel/Øv layout, breadcrumb, prev/next and related topics).
//
// Pure functions only, so everything is unit-testable. Access (free / Plus) is
// not decided here; the page keeps using its existing per-question gating.

import type { CardProgress, CEFRLevel, GrammarRule, GrammarTopic } from '$lib/types';
import { GRAMMAR_RULES } from './rules';
import { plainSummary } from './summary';
import {
  adjacentTopics,
  placementOf,
  sectionsAlsoCovering,
  topicsAlsoIn,
  type TaxonomyChapter,
  type TaxonomyPart,
  type TaxonomySection
} from './taxonomy';

// ── Regel / Øv tabs ────────────────────────────────────────────────────────────────────────────

export type TopicTab = 'rule' | 'practice';

/** `?tab=` value to a tab, or null when absent or invalid. */
export function parseTabParam(raw: string | null | undefined): TopicTab | null {
  return raw === 'rule' || raw === 'practice' ? raw : null;
}

/**
 * Which tab to open when the learner has not chosen one: returning learners
 * with due cards go straight to practice, everyone else starts with the rule.
 */
export function defaultTab(dueCount: number): TopicTab {
  return dueCount > 0 ? 'practice' : 'rule';
}

export const TOPIC_TABS: readonly TopicTab[] = ['rule', 'practice'];

/**
 * The tab a key press moves to, following the ARIA tabs pattern: ArrowRight and
 * ArrowLeft move to the next / previous tab and wrap around, Home and End jump
 * to the first / last. Returns null for any other key (the key is not ours).
 */
export function tabForKey(current: TopicTab, key: string): TopicTab | null {
  const i = TOPIC_TABS.indexOf(current);
  const last = TOPIC_TABS.length - 1;
  switch (key) {
    case 'ArrowRight':
      return TOPIC_TABS[i === last ? 0 : i + 1];
    case 'ArrowLeft':
      return TOPIC_TABS[i === 0 ? last : i - 1];
    case 'Home':
      return TOPIC_TABS[0];
    case 'End':
      return TOPIC_TABS[last];
    default:
      return null;
  }
}

/** The entries of `map` whose key is in `ids` (a topic's slice of the progress map). */
export function pickProgress(
  ids: Iterable<string>,
  map: Record<string, CardProgress>
): Record<string, CardProgress> {
  const out: Record<string, CardProgress> = {};
  for (const id of ids) {
    if (map[id]) out[id] = map[id];
  }
  return out;
}

// ── Breadcrumb, prev/next, related ─────────────────────────────────────────────────────────────

export interface TopicLink {
  topic: GrammarTopic;
  /** Norwegian rule title (grammar content is Norwegian-only). */
  title: string;
  /** Book section the topic sits in (e.g. '1.6'); absent for an unplaced topic. */
  sectionId?: string;
}

export interface TopicNavModel {
  part: TaxonomyPart;
  chapter: TaxonomyChapter;
  section: TaxonomySection;
  /** Previous / next topic in book order (across chapters), null at either end. */
  prev: TopicLink | null;
  next: TopicLink | null;
  /** Other topics worth reading next to this one, without prev/next or duplicates. */
  related: TopicLink[];
}

export const MAX_RELATED = 4;

function linkFor(topic: GrammarTopic): TopicLink | null {
  const rule = GRAMMAR_RULES[topic];
  if (!rule) return null;
  const sectionId = placementOf(topic)?.section.id;
  return sectionId ? { topic, title: rule.titleNb, sectionId } : { topic, title: rule.titleNb };
}

/**
 * Related topics, most relevant first:
 *   1. siblings in the same section,
 *   2. topics in the sections this topic also covers (`ALSO_IN`),
 *   3. topics that list this topic's own section as an also-in.
 * The topic itself and `exclude` (prev/next, shown separately) are left out.
 */
export function relatedTopics(
  topic: GrammarTopic,
  exclude: readonly GrammarTopic[] = [],
  max = MAX_RELATED
): TopicLink[] {
  const placement = placementOf(topic);
  if (!placement) return [];

  const candidates: GrammarTopic[] = [
    ...placement.section.topics,
    ...sectionsAlsoCovering(topic).flatMap((s) => s.topics),
    ...topicsAlsoIn(placement.section.id)
  ];

  const skip = new Set<GrammarTopic>([topic, ...exclude]);
  const out: TopicLink[] = [];
  for (const candidate of candidates) {
    if (skip.has(candidate)) continue;
    skip.add(candidate);
    const link = linkFor(candidate);
    if (link) out.push(link);
    if (out.length >= max) break;
  }
  return out;
}

/** Everything the breadcrumb and the prev/next/related block render. Null for an unplaced topic. */
export function topicNavModel(topic: GrammarTopic): TopicNavModel | null {
  const placement = placementOf(topic);
  if (!placement) return null;

  const { prev, next } = adjacentTopics(topic);
  const exclude = [prev, next].filter((t): t is GrammarTopic => t !== null);

  return {
    ...placement,
    prev: prev ? linkFor(prev) : null,
    next: next ? linkFor(next) : null,
    related: relatedTopics(topic, exclude)
  };
}

// ── Plus teaser (Phase 6c) ─────────────────────────────────────────────────────────────────────────

export const CEFR_ORDER: readonly CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C'];

/** Longest rule preview shown on a locked topic. */
export const TEASER_MAX = 300;

export interface LevelCount {
  level: CEFRLevel;
  count: number;
}

/** Question counts per CEFR level, in level order (A1 to C), skipping empty levels. */
export function countByLevel(questions: readonly { cefr: CEFRLevel }[]): LevelCount[] {
  const counts = new Map<CEFRLevel, number>();
  for (const q of questions) counts.set(q.cefr, (counts.get(q.cefr) ?? 0) + 1);
  return CEFR_ORDER.filter((level) => counts.has(level)).map((level) => ({
    level,
    count: counts.get(level)!
  }));
}

/**
 * The questions a free learner cannot play (not in `freeIds`), as a total and
 * per level. Drives the «+ N more questions at A2, B1 with Plus» notice.
 */
export function lockedBreakdown(
  questions: readonly { id: string; cefr: CEFRLevel }[],
  freeIds: ReadonlySet<string>
): { total: number; levels: LevelCount[] } {
  const locked = questions.filter((q) => !freeIds.has(q.id));
  return { total: locked.length, levels: countByLevel(locked) };
}

/**
 * Per-level question totals for a topic, and how many of them a free learner can
 * play. Computed on the server from the full topic set and sent to the page, so
 * the teaser works even though a free user is never sent the locked questions
 * (ai-docs/implementation/grammar-server-gating.md, Phase 2). Counts only: no
 * question content. In level order (A1 to C), skipping empty levels.
 */
export interface LevelCountEntry {
  level: CEFRLevel;
  total: number;
  free: number;
}

export function levelCountsFor(
  questions: readonly { id: string; cefr: CEFRLevel }[],
  freeIds: ReadonlySet<string>
): LevelCountEntry[] {
  const totals = new Map<CEFRLevel, { total: number; free: number }>();
  for (const q of questions) {
    const entry = totals.get(q.cefr) ?? { total: 0, free: 0 };
    entry.total += 1;
    if (freeIds.has(q.id)) entry.free += 1;
    totals.set(q.cefr, entry);
  }
  return CEFR_ORDER.filter((level) => totals.has(level)).map((level) => ({
    level,
    ...totals.get(level)!
  }));
}

/** `counts` limited to one level when `level` is set (the `?level=` scope). */
function scopeCounts(counts: readonly LevelCountEntry[], level: CEFRLevel | null) {
  return level ? counts.filter((c) => c.level === level) : counts;
}

/** Questions per level in scope (the level chips on a locked topic). Same shape as `countByLevel`. */
export function teaserLevelsFrom(
  counts: readonly LevelCountEntry[],
  level: CEFRLevel | null
): LevelCount[] {
  return scopeCounts(counts, level).map((c) => ({ level: c.level, count: c.total }));
}

/** Questions in scope a free learner cannot play, as a total and per level. Same shape as `lockedBreakdown`. */
export function lockedFromCounts(
  counts: readonly LevelCountEntry[],
  level: CEFRLevel | null
): { total: number; levels: LevelCount[] } {
  const levels = scopeCounts(counts, level)
    .map((c) => ({ level: c.level, count: c.total - c.free }))
    .filter((c) => c.count > 0);
  return { total: levels.reduce((sum, c) => sum + c.count, 0), levels };
}

/** Plain-text preview of a rule (its opening paragraph), or '' when there is no rule. */
export function teaserText(rule: GrammarRule | undefined): string {
  return rule ? plainSummary(rule.explanationNb, TEASER_MAX) : '';
}
