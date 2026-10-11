// src/lib/content-index.ts
// Typed access to the slim, text-free content index
// (src/lib/data/content-index.json, built by scripts/build-content-index.mjs).
//
// Browser-safe on purpose: it holds ids grouped by level, type and category,
// and nothing else. stats.ts, content-lookup.ts and uttrykk-c-stats.ts read it
// instead of importing the ten vocab/uttrykk content files, which put every
// entry (Plus ones included) in the client bundle. See
// ai-docs/implementation/stats-content-gating.md.
import type { CEFRLevel } from '$lib/types';
import contentIndex from '$lib/data/content-index.json';

export type ContentType = 'vocab' | 'uttrykk';

/** level -> type -> category -> ids, in source-file order. */
export type ContentIndex = Record<CEFRLevel, Record<ContentType, Record<string, string[]>>>;

export const CONTENT_INDEX = contentIndex as ContentIndex;

/** Number of entries per category for one level and content type. */
export function categoryCountsFor(level: CEFRLevel, type: ContentType): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [category, ids] of Object.entries(CONTENT_INDEX[level][type])) {
    counts.set(category, ids.length);
  }
  return counts;
}

/** Number of entries in one category (0 when the category has none). */
export function categoryCount(level: CEFRLevel, type: ContentType, category: string): number {
  return CONTENT_INDEX[level][type][category]?.length ?? 0;
}
