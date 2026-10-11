// src/lib/content-lookup.ts
// Phase 1, ai-docs/implementation/permanent-structural-fix.md.
//
// `CardProgress.level`/`CardProgress.category` are a one-time snapshot taken
// at review time (see saveProgress in progress.ts) — they go stale the
// moment an entry's level, category, or vocab/uttrykk type changes in the
// content files, since nothing rewrites an existing progress row until that
// card is reviewed again.
//
// This module is the fix: a single `id -> current location` map, built once
// at module load from the slim content index (content-index.ts: ids only, no
// text, so no content file reaches the client bundle), plus `resolveEntry()` so any
// caller can look up an id's *live* level/category/theme/type instead of
// trusting the stored snapshot. An id that no longer exists anywhere
// (entry actually deleted, not moved) simply isn't in the map —
// `resolveEntry()` returns undefined and callers drop it silently, per the
// plan doc's Decision section.

import type { CEFRLevel } from '$lib/types';
import { CONTENT_INDEX, type ContentType } from '$lib/content-index';

/**
 * An id's current location in content, resolved live rather than trusted
 * from a stored `CardProgress` snapshot.
 *
 * `type` is derived from *which file the id was found in* — not from the
 * `category` field. As of the theme/category unification
 * (ai-docs/implementation/uttrykk-theme-category-unification.md), every
 * uttrykk entry at every level (A1–B2 and C) carries a real category slug
 * directly — there's no more `'uttrykk'` sentinel or separate `theme` field
 * to reconcile. `type` still comes from *which file the id was found in*,
 * so every other module (stats.ts, progress.ts) can just trust `type`
 * instead of re-deriving it.
 */
export interface ResolvedEntry {
  level: CEFRLevel;
  category: string;
  type: 'vocab' | 'uttrykk';
}

const LEVELS = Object.keys(CONTENT_INDEX) as CEFRLevel[];

/**
 * id -> current { level, category, type }, built once at module load from the
 * content index across all 5 levels — ~10,000 ids, a single pass,
 * sub-millisecond (see the plan doc's Performance notes).
 *
 * Vocab entries are inserted first, uttrykk second; ids are global and
 * unique across both (see id-new-format.md Round 3), so this ordering only
 * matters as a defensive tie-break and should never actually decide a real
 * lookup.
 */
const CONTENT_LOOKUP: Map<string, ResolvedEntry> = (() => {
  const map = new Map<string, ResolvedEntry>();

  // Vocab first, uttrykk second, same order as before.
  for (const type of ['vocab', 'uttrykk'] as ContentType[]) {
    for (const level of LEVELS) {
      for (const [category, ids] of Object.entries(CONTENT_INDEX[level][type])) {
        for (const id of ids) map.set(id, { level, category, type });
      }
    }
  }

  return map;
})();

/**
 * Resolves an id's current level/category/type live from content.
 * Returns undefined when the id no longer exists anywhere in content (the
 * entry was deleted outright, not moved) — callers should drop such ids
 * silently rather than error or fall back to a stale stored value.
 */
export function resolveEntry(id: string): ResolvedEntry | undefined {
  return CONTENT_LOOKUP.get(id);
}
