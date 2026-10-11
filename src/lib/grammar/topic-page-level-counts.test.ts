// src/lib/grammar/topic-page-level-counts.test.ts
// Phase 2 of ai-docs/implementation/grammar-server-gating.md: the teaser counts
// the topic page now gets from the server (`levelCounts`) instead of deriving
// them from the full question list in the browser.
//
// The key guarantee: the new helpers give exactly the numbers the old
// client-side helpers (`countByLevel`, `lockedBreakdown`) gave on the full list,
// with and without a `?level=` scope.

import { describe, it, expect } from 'vitest';
import grammarData from '$lib/data/grammar.json';
import { freeGrammarQuestionIds } from '$lib/access';
import {
  countByLevel,
  levelCountsFor,
  lockedBreakdown,
  lockedFromCounts,
  teaserLevelsFrom
} from './topic-page';
import type { CEFRLevel, GrammarQuestion } from '$lib/types';

const q = (id: string, cefr: CEFRLevel) => ({ id, cefr });

describe('levelCountsFor', () => {
  it('counts total and free per level, in level order, skipping empty levels', () => {
    const questions = [q('a', 'B1'), q('b', 'A1'), q('c', 'A1'), q('d', 'B1'), q('e', 'B1')];
    const free = new Set(['b', 'c']);
    expect(levelCountsFor(questions, free)).toEqual([
      { level: 'A1', total: 2, free: 2 },
      { level: 'B1', total: 3, free: 0 }
    ]);
  });

  it('returns an empty list for no questions', () => {
    expect(levelCountsFor([], new Set())).toEqual([]);
  });

  it('carries no question content, only level and counts', () => {
    const [entry] = levelCountsFor([q('a', 'A1')], new Set(['a']));
    expect(Object.keys(entry).sort()).toEqual(['free', 'level', 'total']);
  });
});

describe('teaserLevelsFrom', () => {
  const counts = levelCountsFor(
    [q('a', 'A1'), q('b', 'A2'), q('c', 'A2'), q('d', 'B1')],
    new Set(['a'])
  );

  it('lists every level with its total when there is no ?level= scope', () => {
    expect(teaserLevelsFrom(counts, null)).toEqual([
      { level: 'A1', count: 1 },
      { level: 'A2', count: 2 },
      { level: 'B1', count: 1 }
    ]);
  });

  it('limits to one level when ?level= is set', () => {
    expect(teaserLevelsFrom(counts, 'A2')).toEqual([{ level: 'A2', count: 2 }]);
  });

  it('returns nothing for a level the topic does not have', () => {
    expect(teaserLevelsFrom(counts, 'C')).toEqual([]);
  });
});

describe('lockedFromCounts', () => {
  const counts = levelCountsFor(
    [q('a', 'A1'), q('b', 'A2'), q('c', 'A2'), q('d', 'B1')],
    new Set(['a'])
  );

  it('totals the locked questions across levels, skipping levels with none locked', () => {
    expect(lockedFromCounts(counts, null)).toEqual({
      total: 3,
      levels: [
        { level: 'A2', count: 2 },
        { level: 'B1', count: 1 }
      ]
    });
  });

  it('limits to one level when ?level= is set', () => {
    expect(lockedFromCounts(counts, 'B1')).toEqual({
      total: 1,
      levels: [{ level: 'B1', count: 1 }]
    });
  });

  it('is empty for a level that is fully free', () => {
    expect(lockedFromCounts(counts, 'A1')).toEqual({ total: 0, levels: [] });
  });

  it('is empty for a level the topic does not have', () => {
    expect(lockedFromCounts(counts, 'C')).toEqual({ total: 0, levels: [] });
  });
});

describe('server counts match the old client-side helpers on the real data', () => {
  const all = grammarData as GrammarQuestion[];
  const byTopic = new Map<string, GrammarQuestion[]>();
  for (const question of all) {
    const list = byTopic.get(question.topic) ?? [];
    list.push(question);
    byTopic.set(question.topic, list);
  }
  const scopes: (CEFRLevel | null)[] = [null, 'A1', 'A2', 'B1', 'B2', 'C'];

  it('gives the same teaser levels and locked breakdown for every topic and scope', () => {
    for (const [topic, questions] of byTopic) {
      const freeIds = freeGrammarQuestionIds(questions);
      const counts = levelCountsFor(questions, freeIds);
      for (const scope of scopes) {
        const scoped = scope ? questions.filter((x) => x.cefr === scope) : questions;
        expect(teaserLevelsFrom(counts, scope), `${topic} teaser ${scope}`).toEqual(
          countByLevel(scoped)
        );
        expect(lockedFromCounts(counts, scope), `${topic} locked ${scope}`).toEqual(
          lockedBreakdown(scoped, freeIds)
        );
      }
    }
  });
});
