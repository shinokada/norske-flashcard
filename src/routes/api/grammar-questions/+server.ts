/**
 * POST /api/grammar-questions   body: { topics: string[], levels: CEFRLevel[] }
 *
 * Phase 3 of ai-docs/implementation/grammar-server-gating.md. «Practise this
 * chapter» used to load whole level files in the browser and filter them there,
 * which downloaded every locked question. The page now asks this endpoint, and
 * only when the user clicks the button.
 *
 * The gate is `questionsForPlan` (the same rule as the topic page): Plus gets
 * every question of the requested topics, free and guest callers only the free
 * ones. The plan comes from `locals.plan` (hooks.server.ts), never from the body.
 *
 * Response: { questions: GrammarQuestion[] }, `Cache-Control: private, no-store`
 * because the payload differs by plan.
 */

import type { RequestHandler } from './$types';
import type { CEFRLevel, GrammarQuestion } from '$lib/types';
import { grammarLevelLoaders } from '$lib/grammar/level-loader';
import { questionsForPlan } from '$lib/grammar/gated-questions';

// A chapter has a handful of topics; this only guards against abuse.
const MAX_TOPICS = 100;
const LEVELS = Object.keys(grammarLevelLoaders) as CEFRLevel[];

const NO_STORE = { 'Cache-Control': 'private, no-store' };

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

export const POST: RequestHandler = async ({ request, locals }) => {
  const isPlus = locals.plan === 'plus';

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: NO_STORE });
  }

  const { topics, levels } = (body ?? {}) as { topics?: unknown; levels?: unknown };
  if (!isStringArray(topics) || !isStringArray(levels)) {
    return new Response('topics and levels must be arrays of strings', {
      status: 400,
      headers: NO_STORE
    });
  }

  const topicSet = new Set(topics.slice(0, MAX_TOPICS));
  // Unknown levels are ignored; duplicates are loaded once.
  const wanted = LEVELS.filter((l) => levels.includes(l));
  if (topicSet.size === 0 || wanted.length === 0) {
    return Response.json({ questions: [] }, { headers: NO_STORE });
  }

  const modules = await Promise.all(wanted.map((l) => grammarLevelLoaders[l]()));
  const inChapter: GrammarQuestion[] = modules
    .flatMap((m) => m.default)
    .filter((q) => topicSet.has(q.topic));

  return Response.json({ questions: questionsForPlan(inChapter, isPlus) }, { headers: NO_STORE });
};
