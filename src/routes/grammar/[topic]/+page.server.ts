import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import grammarTopicIndex from '$lib/data/grammar-topic-index.json';
import type { CEFRLevel, GrammarQuestion, GrammarTopic } from '$lib/types';
import { freeGrammarQuestionIds } from '$lib/access';
import { GRAMMAR_RULES } from '$lib/grammar/rules';
import { loadGrammarLevels } from '$lib/grammar/level-loader';
import { questionsForPlan } from '$lib/grammar/gated-questions';
import { levelCountsFor } from '$lib/grammar/topic-page';
import { topicMetaTags } from '$lib/grammar/seo';

// Server-rendered since Phase 6b (grammar-update.md): the rule text, breadcrumb
// and meta must be in the HTML for crawlers. GrammarSession only starts in
// onMount, so the practice panel is a placeholder on the server.
//
// Server load since grammar-server-gating.md (Phase 2): the question payload
// depends on the plan. A free or guest visitor is only ever sent the free
// questions (see $lib/grammar/gated-questions); Plus gets the full set. This
// file must stay server-only (+page.server.ts): a universal load would fetch
// the level JSON in the browser, where the gate cannot hold.

type GrammarTopicIndexEntry = {
  levels: CEFRLevel[];
  countsByLevel: Partial<Record<CEFRLevel, number>>;
  total: number;
};

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
  const topic = params.topic as GrammarTopic;

  // Unknown topic → 404.
  if (!GRAMMAR_RULES[topic]) {
    throw error(404, 'Grammar topic not found');
  }

  // locals.plan is set by hooks.server.ts before any load runs.
  const isPlus = locals.plan === 'plus';

  // Look up which levels this topic spans via the topic index (derived
  // artifact — scripts/build-grammar-level-index.mjs), then dynamically
  // import only those level files (usually 1–2 of 5) instead of the full
  // grammar.json. See
  // draft/b2/pa-niva/implementation/grammar-lazy-load-per-level.md.
  const index = grammarTopicIndex as Record<GrammarTopic, GrammarTopicIndexEntry>;
  const entry = index[topic];
  const levels = entry?.levels ?? [];

  const levelQuestions = await loadGrammarLevels(levels);
  const allQuestions = levelQuestions.filter((q): q is GrammarQuestion => q.topic === topic);
  const freeIds = freeGrammarQuestionIds(allQuestions);

  // The same page is served as a free and as a Plus payload, so no shared cache
  // may keep one and hand it to the other (same as the locked vocab teaser).
  setHeaders({ 'Cache-Control': 'private, no-store' });

  return {
    topic,
    // Plus: the whole topic. Free / guest: only the free questions.
    questions: questionsForPlan(allQuestions, isPlus),
    // Ids only, no content. +page.svelte still filters by it.
    freeQuestionIds: [...freeIds],
    // Counts only, from the FULL set, so the teaser (level chips, «N more
    // questions with Plus») works without the locked questions being sent.
    levelCounts: levelCountsFor(allQuestions, freeIds),
    // Merged over the layout defaults in +layout.svelte; noindex for topics
    // without free A1 content (see $lib/grammar/seo.ts).
    pageMetaTags: topicMetaTags(topic) ?? undefined
  };
};
