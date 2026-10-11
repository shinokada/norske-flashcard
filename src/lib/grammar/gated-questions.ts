// src/lib/grammar/gated-questions.ts
// The one rule for which grammar questions a visitor may receive from the
// server (ai-docs/implementation/grammar-server-gating.md, Phase 1).
//
// Plus gets everything. Free and guest users get only the free questions, i.e.
// exactly `freeGrammarQuestionIds()`: not `plusOnly`, and the (topic, cefr)
// pair is free per FREE_GRAMMAR_TOPICS. Every server entry point that returns
// grammar questions (topic page load, chapter practice endpoint) must go
// through this function, so the rule lives in one place and a locked question
// never reaches the browser.
//
// Pure and side-effect free, so it is unit-testable and safe to import on the
// server only. Do NOT import it into a component to "gate" client-side: by then
// the questions have already been downloaded.

import type { GrammarQuestion } from '$lib/types';
import { freeGrammarQuestionIds } from '$lib/access';

/**
 * The questions a visitor with this plan may receive.
 * Keeps the input order. Never mutates `questions`.
 */
export function questionsForPlan(
  questions: readonly GrammarQuestion[],
  isPlus: boolean
): GrammarQuestion[] {
  if (isPlus) return [...questions];
  const free = freeGrammarQuestionIds([...questions]);
  return questions.filter((q) => free.has(q.id));
}
