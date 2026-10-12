// src/lib/level-nav.ts
// Previous / next level lookup for the /learn/[level] hub pages.
// See ai-docs/implementation/level-navigation.md.

import { LEVEL_ORDER, type LevelSlug } from '$lib/config';

export type AdjacentLevels = { prev: LevelSlug | null; next: LevelSlug | null };

/** Neighbouring level slugs in learning order. Unknown levels have no neighbours. */
export function adjacentLevels(level: string): AdjacentLevels {
  const i = (LEVEL_ORDER as readonly string[]).indexOf(level.toLowerCase());
  if (i === -1) return { prev: null, next: null };
  return { prev: LEVEL_ORDER[i - 1] ?? null, next: LEVEL_ORDER[i + 1] ?? null };
}
