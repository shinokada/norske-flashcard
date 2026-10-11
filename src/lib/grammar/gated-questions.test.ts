// src/lib/grammar/gated-questions.test.ts
// Phase 1 of ai-docs/implementation/grammar-server-gating.md: the plan filter
// that every server entry point must apply before returning grammar questions.
//
// The tests derive their fixtures from the real data and policy (grammar.json +
// FREE_GRAMMAR_TOPICS) instead of hard-coding topic names, so they keep
// meaning the same thing if the free policy is retuned.

import { describe, it, expect } from 'vitest';
import grammarData from '$lib/data/grammar.json';
import { freeGrammarQuestionIds } from '$lib/access';
import { questionsForPlan } from './gated-questions';
import type { GrammarQuestion } from '$lib/types';

const all = grammarData as GrammarQuestion[];
const freeIds = freeGrammarQuestionIds(all);

function byTopic(): Map<string, GrammarQuestion[]> {
  const map = new Map<string, GrammarQuestion[]>();
  for (const q of all) {
    const list = map.get(q.topic) ?? [];
    list.push(q);
    map.set(q.topic, list);
  }
  return map;
}

const topics = [...byTopic().entries()];
const mixedTopic = topics.find(
  ([, qs]) => qs.some((q) => freeIds.has(q.id)) && qs.some((q) => !freeIds.has(q.id))
);
const lockedTopic = topics.find(([, qs]) => qs.every((q) => !freeIds.has(q.id)));

describe('questionsForPlan', () => {
  it('Plus gets every question, in the original order', () => {
    const result = questionsForPlan(all, true);
    expect(result).toHaveLength(all.length);
    expect(result.map((q) => q.id)).toEqual(all.map((q) => q.id));
  });

  it('Plus gets a copy, so the caller cannot mutate the source list', () => {
    const result = questionsForPlan(all, true);
    expect(result).not.toBe(all);
  });

  it('free and guest users get exactly freeGrammarQuestionIds, in order', () => {
    const result = questionsForPlan(all, false);
    expect(result.map((q) => q.id)).toEqual(all.filter((q) => freeIds.has(q.id)).map((q) => q.id));
  });

  it('a free user never receives a plusOnly question', () => {
    expect(questionsForPlan(all, false).filter((q) => q.plusOnly)).toEqual([]);
  });

  it('a free user never receives a question from a Plus (topic, level) pair', () => {
    const leaked = questionsForPlan(all, false).filter((q) => !freeIds.has(q.id));
    expect(leaked).toEqual([]);
  });

  it('a plusOnly flag removes a question that would otherwise be free', () => {
    const free = all.find((q) => freeIds.has(q.id));
    expect(free).toBeDefined();
    const flagged: GrammarQuestion = { ...free!, id: 'gq-test-plusonly', plusOnly: true };
    const result = questionsForPlan([free!, flagged], false);
    expect(result.map((q) => q.id)).toEqual([free!.id]);
  });

  it('a mixed-level topic returns only its free levels to a free user', () => {
    expect(mixedTopic).toBeDefined();
    const [, qs] = mixedTopic!;
    const result = questionsForPlan(qs, false);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThan(qs.length);
    expect(result.every((q) => freeIds.has(q.id))).toBe(true);
    // Plus still gets the whole topic.
    expect(questionsForPlan(qs, true)).toHaveLength(qs.length);
  });

  it('a fully locked topic returns nothing to a free user', () => {
    expect(lockedTopic).toBeDefined();
    const [, qs] = lockedTopic!;
    expect(questionsForPlan(qs, false)).toEqual([]);
    expect(questionsForPlan(qs, true)).toHaveLength(qs.length);
  });

  it('handles an empty list for both plans', () => {
    expect(questionsForPlan([], false)).toEqual([]);
    expect(questionsForPlan([], true)).toEqual([]);
  });

  it('does not mutate its input', () => {
    const input = all.slice(0, 50);
    const snapshot = input.map((q) => q.id);
    questionsForPlan(input, false);
    questionsForPlan(input, true);
    expect(input.map((q) => q.id)).toEqual(snapshot);
  });
});
