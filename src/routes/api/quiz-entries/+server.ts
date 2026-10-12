/**
 * POST /api/quiz-entries   body: { level: CEFRLevel, category?: string }
 *
 * Phase 3 of ai-docs/implementation/quiz-server-gating.md. The quiz used to import
 * every vocab and uttrykk file in the browser and gate them in the page, so every
 * visitor downloaded every Plus entry. The page now asks this endpoint, and only
 * when the user clicks Start.
 *
 * The gate is `selectQuizEntries` (`$lib/quiz-gate`): Plus gets every quizable entry
 * of the level (and category), free and guest callers only the entries that pass the
 * free quiz policy. The answer options (`distractors`) follow the same gate, so a
 * locked word is never offered as an option. The plan comes from `locals.plan`
 * (hooks.server.ts), never from the body.
 *
 * Response: { entries, distractors }, `Cache-Control: private, no-store` because the
 * payload differs by plan.
 */

import type { RequestHandler } from './$types';
import { selectQuizEntries } from '$lib/quiz-gate';
import { isQuizLevel, loadQuizSources } from '$lib/server/quiz-sources';
import {
  recordContentUsage,
  shouldBlock,
  rateLimitedResponse
} from '$lib/server/content-usage';

const MAX_CATEGORY_LENGTH = 100;

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export const POST: RequestHandler = async ({ request, locals }) => {
  const isPlus = locals.plan === 'plus';

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: NO_STORE });
  }

  const { level, category } = (body ?? {}) as { level?: unknown; category?: unknown };
  if (!isQuizLevel(level)) {
    return new Response('level must be one of A1, A2, B1, B2, C', {
      status: 400,
      headers: NO_STORE
    });
  }
  if (
    category !== undefined &&
    (typeof category !== 'string' || category.length > MAX_CATEGORY_LENGTH)
  ) {
    return new Response('category must be a short string', { status: 400, headers: NO_STORE });
  }

  const sources = await loadQuizSources([level]);
  const result = selectQuizEntries(sources, level, category || undefined, isPlus);

  // Plus calls are counted (content-scraping-hardening.md, Phase 1); log-only for now.
  const usage = await recordContentUsage({
    userId: locals.user?.id,
    plan: locals.plan,
    endpoint: 'quiz-entries',
    entries: result.entries.length + result.distractors.length
  });
  if (shouldBlock(usage)) return rateLimitedResponse();

  return Response.json(result, { headers: NO_STORE });
};
