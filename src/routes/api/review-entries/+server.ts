/**
 * POST /api/review-entries
 *
 * ai-docs/implementation/due-only.md — Step 1.
 * ai-docs/implementation/permanent-structural-fix.md — Phase 3.
 *
 * Resolves a list of due ids back into full VocabEntry objects, without
 * shipping an entire level's JSON to the client just to filter it. Used by
 * the /review due-only session: the client already knows *which* ids are
 * due (from getDueItems() in progress.ts — Plus via Supabase, free/guest
 * via localStorage) but only has the id itself, not the full entry (norsk,
 * translations, examples, ...) or even a trustworthy level/category for it.
 *
 * As of Phase 3, level/category/vocab-vs-uttrykk scoping happens here too,
 * server-side, instead of client-side in getDueItems() — and it's resolved
 * *live* via content-lookup.ts's `resolveEntry()` rather than trusted from
 * any client-supplied level. That matters: the client's only source for an
 * id's level/category is the stored `CardProgress` snapshot, which goes
 * stale the instant an entry's level/category/type changes in content
 * without the card being reviewed again (the exact bug the whole plan doc
 * fixes for stats.ts). Resolving live here means a due card for an id
 * that's since moved is still found under its *current* location, with no
 * re-review needed — and doing it server-side, rather than importing
 * content-lookup.ts into progress.ts, keeps that full id→location map out
 * of the client bundle (see the plan doc's Performance notes).
 *
 * No auth check — anyone may call it, but free and guest callers only get
 * entries they could open anyway: Plus-only categories are dropped for them
 * (see isPlusOnlyEntry in $lib/access). `locals.plan` is set by hooks.server.ts.
 */

import type { RequestHandler } from './$types';
import type { VocabEntry, CEFRLevel } from '$lib/types';
import { resolveEntry } from '$lib/content-lookup';
import { isPlusOnlyEntry } from '$lib/access';
import { recordContentUsage, shouldBlock, rateLimitedResponse } from '$lib/server/content-usage';

interface ReviewEntriesRequest {
  ids: string[];
  /** Restrict to one CEFR level. Omit for a global (all-levels) session. */
  level?: CEFRLevel;
  /**
   * Restrict to one category. As of the theme/category unification
   * (ai-docs/implementation/uttrykk-theme-category-unification.md), every
   * uttrykk entry at every level carries a real `category` directly —
   * matched against the resolved entry's `category` alone, same as vocab.
   */
  category?: string;
  /** vocab / uttrykk / both (default). */
  type?: 'vocab' | 'uttrykk' | 'both';
}

// Same loader shape as `/{level}/{category}/+page.server.ts` — dynamic
// import() keeps these out of the client bundle; only the files a given
// request's levels actually touch get loaded.
const vocabLoaders: Record<CEFRLevel, () => Promise<{ default: VocabEntry[] }>> = {
  A1: () => import('$lib/data/vocab-a1.json') as unknown as Promise<{ default: VocabEntry[] }>,
  A2: () => import('$lib/data/vocab-a2.json') as unknown as Promise<{ default: VocabEntry[] }>,
  B1: () => import('$lib/data/vocab-b1.json') as unknown as Promise<{ default: VocabEntry[] }>,
  B2: () => import('$lib/data/vocab-b2.json') as unknown as Promise<{ default: VocabEntry[] }>,
  C: () => import('$lib/data/vocab-c.json') as unknown as Promise<{ default: VocabEntry[] }>
};

// A1–B2 uttrykk decks. C has no separate uttrykk file keyed by level — see
// uttrykkCLoader below.
const uttrykkLoaders: Partial<Record<CEFRLevel, () => Promise<{ default: VocabEntry[] }>>> = {
  A1: () => import('$lib/data/uttrykk-a1.json') as unknown as Promise<{ default: VocabEntry[] }>,
  A2: () => import('$lib/data/uttrykk-a2.json') as unknown as Promise<{ default: VocabEntry[] }>,
  B1: () => import('$lib/data/uttrykk-b1.json') as unknown as Promise<{ default: VocabEntry[] }>,
  B2: () => import('$lib/data/uttrykk-b2.json') as unknown as Promise<{ default: VocabEntry[] }>
};

const uttrykkCLoader = () =>
  import('$lib/data/uttrykk-c.json') as unknown as Promise<{ default: VocabEntry[] }>;

// Two separate bounds:
// - MAX_RAW_IDS guards against a pathological payload before any filtering
//   runs (getDueItems() sends every due id across all levels/types as of
//   Phase 3, permanent-structural-fix.md, so this needs real headroom).
// - MAX_ITEMS caps how many *matching* (post-filter) entries get resolved,
//   applied inside the loop below rather than to the raw list — capping
//   the raw list first would risk truncating away exactly the ids a scoped
//   request (?level=&category=) is asking for, silently returning fewer
//   entries (or none) than are actually due.
const MAX_RAW_IDS = 20000;
const MAX_ITEMS = 1000;

export const POST: RequestHandler = async ({ request, locals }) => {
  const isPlus = locals.plan === 'plus';

  let body: ReviewEntriesRequest;
  try {
    const raw = await request.json();
    const ids = Array.isArray(raw?.ids)
      ? raw.ids.filter((id: unknown): id is string => typeof id === 'string')
      : [];
    body = {
      ids,
      level: raw?.level,
      category: typeof raw?.category === 'string' ? raw.category : undefined,
      type: raw?.type === 'vocab' || raw?.type === 'uttrykk' ? raw.type : 'both'
    };
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  let ids = body.ids;
  if (ids.length === 0) {
    return Response.json({ entries: [] });
  }
  if (ids.length > MAX_RAW_IDS) {
    ids = ids.slice(0, MAX_RAW_IDS);
  }

  // Resolve each id's *live* level/category/theme/type (content-lookup.ts)
  // instead of trusting any client-supplied level, and apply the level/
  // category/type filter here too — see the file doc comment above. An id
  // that doesn't resolve anywhere (entry deleted outright, not moved) is
  // dropped silently, same as elsewhere in the plan doc. Ids are grouped by
  // their *resolved* level so each JSON file is still loaded at most once.
  // MAX_ITEMS caps *matching* ids, not the raw input — see the constant's
  // doc comment above for why this order matters for scoped requests.
  const idsByLevel = new Map<CEFRLevel, Set<string>>();
  let matched = 0;
  for (const id of ids) {
    if (matched >= MAX_ITEMS) break;
    const resolvedEntry = resolveEntry(id);
    if (!resolvedEntry) continue;
    if (body.level && resolvedEntry.level !== body.level) continue;
    if (body.category && resolvedEntry.category !== body.category) {
      continue;
    }
    if (body.type && body.type !== 'both' && resolvedEntry.type !== body.type) continue;
    // Free-tier gate (free-tier-simplification.md): drop cards from categories a
    // free user can't open, even if they studied them while still free.
    if (
      !isPlus &&
      isPlusOnlyEntry(resolvedEntry.level, resolvedEntry.category, resolvedEntry.type)
    ) {
      continue;
    }

    const set = idsByLevel.get(resolvedEntry.level) ?? new Set<string>();
    set.add(id);
    idsByLevel.set(resolvedEntry.level, set);
    matched++;
  }

  const resolved: VocabEntry[] = [];

  for (const [level, levelIds] of idsByLevel) {
    // A given level's due ids can come from either its vocab file or its
    // uttrykk file (or, for C, uttrykk-c.json) — rather than pre-classifying
    // by id prefix or category sentinel (fragile, easy to drift from the
    // data), just check both files and keep whatever matches. Vocab and
    // uttrykk ids are disjoint in practice, so this never double-resolves
    // the same due card.
    const vocabLoader = vocabLoaders[level];
    if (vocabLoader) {
      const vocab = await vocabLoader();
      for (const e of vocab.default) {
        if (levelIds.has(e.id)) resolved.push(e);
      }
    }

    if (level === 'C') {
      const uttrykkC = await uttrykkCLoader();
      for (const e of uttrykkC.default) {
        if (levelIds.has(e.id)) resolved.push(e);
      }
    } else {
      const uttrykkLoader = uttrykkLoaders[level];
      if (uttrykkLoader) {
        const uttrykk = await uttrykkLoader();
        for (const e of uttrykk.default) {
          if (levelIds.has(e.id)) resolved.push(e);
        }
      }
    }
  }

  // Plus calls are counted (content-scraping-hardening.md, Phase 1); log-only for now.
  const usage = await recordContentUsage({
    userId: locals.user?.id,
    plan: locals.plan,
    endpoint: 'review-entries',
    entries: resolved.length
  });
  if (shouldBlock(usage)) return rateLimitedResponse();

  return Response.json({ entries: resolved });
};
