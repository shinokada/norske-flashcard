/**
 * POST /api/review-grammar-entries
 *
 * Fix 3 (ai-docs/implementation/due-only-review-update.md) — the grammar
 * counterpart to POST /api/review-entries (due-only.md Step 1). Resolves a
 * list of grammar question ids (+ the CEFR level each one belongs to) back
 * into full GrammarQuestion objects, without shipping an entire level's
 * grammar JSON to the client just to filter it. Used by /review/grammar:
 * the client already knows which ids are due (from the grammar progress
 * map — Plus via Supabase, free/guest via localStorage) but only has
 * id/level/topic on each CardProgress row, not the full question (prompt,
 * sentence, options, answer, ...).
 *
 * No auth check — anyone may call it, but free and guest callers only get
 * questions they could open anyway (see freeGrammarQuestionIds in $lib/access).
 */

import type { RequestHandler } from './$types';
import type { CEFRLevel, GrammarQuestion } from '$lib/types';
import { grammarLevelLoaders } from '$lib/grammar/level-loader';
import { isFreeGrammarTopic } from '$lib/access';
import { recordContentUsage, shouldBlock, rateLimitedResponse } from '$lib/server/content-usage';

interface ReviewGrammarEntryRequest {
  id: string;
  level: CEFRLevel;
}

// Same sanity guard as /api/review-entries — bounded by however many
// grammar cards are actually due, which never gets close to this.
const MAX_ITEMS = 1000;

export const POST: RequestHandler = async ({ request, locals }) => {
  const isPlus = locals.plan === 'plus';

  let items: ReviewGrammarEntryRequest[];
  try {
    const body = await request.json();
    items = Array.isArray(body?.items) ? body.items : [];
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (items.length === 0) {
    return Response.json({ entries: [] });
  }
  if (items.length > MAX_ITEMS) {
    items = items.slice(0, MAX_ITEMS);
  }

  // Group requested ids by level so each level's grammar JSON is loaded at
  // most once, regardless of how many due questions came from it.
  const idsByLevel = new Map<CEFRLevel, Set<string>>();
  for (const item of items) {
    if (!item?.id || !item?.level) continue;
    const set = idsByLevel.get(item.level) ?? new Set<string>();
    set.add(item.id);
    idsByLevel.set(item.level, set);
  }

  const resolved: GrammarQuestion[] = [];

  for (const [level, ids] of idsByLevel) {
    const loader = grammarLevelLoaders[level];
    if (!loader) continue;
    const questions = await loader();
    for (const q of questions.default) {
      if (!ids.has(q.id)) continue;
      // Free-tier gate (free-tier-simplification.md): same rule as
      // freeGrammarQuestionIds() — a free user never gets plusOnly questions or
      // topics/levels that are Plus, even if they studied them while free.
      if (!isPlus && (q.plusOnly || !isFreeGrammarTopic(q.topic, q.cefr))) continue;
      resolved.push(q);
    }
  }

  // Plus calls are counted (content-scraping-hardening.md, Phase 1); log-only for now.
  const usage = await recordContentUsage({
    userId: locals.user?.id,
    plan: locals.plan,
    endpoint: 'review-grammar-entries',
    entries: resolved.length
  });
  if (shouldBlock(usage)) return rateLimitedResponse();

  return Response.json({ entries: resolved });
};
