// src/lib/uttrykk-c-stats.ts
// Shared by /stats (stats.ts and stats/+page.svelte; formerly also the now-
// removed CategoryBarChart.svelte / UttrykkThemeChart.svelte) so C-level
// uttrykk progress can be split out from vocab progress consistently with
// A1–B2, even though C's data model has no category: 'uttrykk' sentinel or
// theme field to filter on.
//
// Phase 4 (ai-docs/implementation/uttrykk-category.md) merges uttrykk-c.json's
// 559 entries into the matching c/{category} vocab pages at read time, so a
// studied C-level idiom's CardProgress.category is a real CATEGORIES_BY_LEVEL.C
// slug — identical in shape to a studied vocab-c.json entry's progress card.
// The only way to tell them apart afterwards is by the progress map's key
// (vocab_id = the entry id, see vocabKey() in progress.ts): if that
// key matches an uttrykk-c.json entry, the card is uttrykk-sourced.
//
// Reads the slim content index (content-index.ts, ids only) instead of importing
// uttrykk-c.json, so no C-level text reaches the client bundle
// (ai-docs/implementation/stats-content-gating.md).
import { CONTENT_INDEX, categoryCountsFor } from '$lib/content-index';

/**
 * id → true for every uttrykk-c.json entry.
 * Used to decide whether a studied C-level card came from uttrykk-c.json
 * (belongs in the Uttrykk section) or vocab-c.json (belongs in Vocabulary).
 */
export const UTTRYKK_C_KEYS: ReadonlySet<string> = new Set(
  Object.values(CONTENT_INDEX.C.uttrykk).flat()
);

/**
 * Per-category entry counts across uttrykk-c.json. C has no separate `theme`
 * taxonomy (Phase 1 excluded it — see UTTRYKK_THEME_LEVELS in config.ts), so
 * its real category slugs double as C's "theme" rows in the Uttrykk section's
 * per-theme breakdown.
 */
export function uttrykkCCategoryCounts(): Map<string, number> {
  return categoryCountsFor('C', 'uttrykk');
}
