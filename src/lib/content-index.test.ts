import { describe, it, expect } from 'vitest';
import contentIndex from '$lib/data/content-index.json';

import vocabA1 from '$lib/data/vocab-a1.json';
import vocabA2 from '$lib/data/vocab-a2.json';
import vocabB1 from '$lib/data/vocab-b1.json';
import vocabB2 from '$lib/data/vocab-b2.json';
import vocabC from '$lib/data/vocab-c.json';
import uttrykkA1 from '$lib/data/uttrykk-a1.json';
import uttrykkA2 from '$lib/data/uttrykk-a2.json';
import uttrykkB1 from '$lib/data/uttrykk-b1.json';
import uttrykkB2 from '$lib/data/uttrykk-b2.json';
import uttrykkC from '$lib/data/uttrykk-c.json';

// scripts/build-content-index.mjs writes content-index.json; these tests fail when the
// committed file is stale or when text sneaks into it
// (ai-docs/implementation/stats-content-gating.md, section 5).

type Source = { id: string; category: string };
type Index = Record<string, Record<string, Record<string, string[]>>>;

const index = contentIndex as Index;

const SOURCES: Record<string, Record<'vocab' | 'uttrykk', Source[]>> = {
  A1: { vocab: vocabA1 as Source[], uttrykk: uttrykkA1 as Source[] },
  A2: { vocab: vocabA2 as Source[], uttrykk: uttrykkA2 as Source[] },
  B1: { vocab: vocabB1 as Source[], uttrykk: uttrykkB1 as Source[] },
  B2: { vocab: vocabB2 as Source[], uttrykk: uttrykkB2 as Source[] },
  C: { vocab: vocabC as Source[], uttrykk: uttrykkC as Source[] }
};

describe('content-index.json matches the content files', () => {
  it('has the same ids per level, type and category as the source files', () => {
    for (const [level, types] of Object.entries(SOURCES)) {
      for (const [type, entries] of Object.entries(types) as [string, Source[]][]) {
        const expected: Record<string, string[]> = {};
        for (const e of entries) (expected[e.category] ??= []).push(e.id);
        const actual = index[level]?.[type] ?? {};
        expect(Object.keys(actual).sort(), `${level} ${type} categories`).toEqual(
          Object.keys(expected).sort()
        );
        for (const category of Object.keys(expected)) {
          expect(actual[category], `${level} ${type} ${category}`).toEqual(expected[category]);
        }
      }
    }
  });

  it('has no id in two places', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const types of Object.values(index)) {
      for (const categories of Object.values(types)) {
        for (const ids of Object.values(categories)) {
          for (const id of ids) {
            if (seen.has(id)) dupes.push(id);
            seen.add(id);
          }
        }
      }
    }
    expect(dupes).toEqual([]);
  });
});

describe('content-index.json holds no text', () => {
  const ID_FORMAT = /^w-\d{6}$/;
  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C'];
  const TYPES = ['vocab', 'uttrykk'];

  it('is level -> type -> category -> array of ids, and nothing else', () => {
    expect(Object.keys(index).sort()).toEqual([...LEVELS].sort());
    for (const level of LEVELS) {
      expect(Object.keys(index[level]).sort()).toEqual([...TYPES].sort());
      for (const type of TYPES) {
        for (const [category, ids] of Object.entries(index[level][type])) {
          expect(Array.isArray(ids), `${level} ${type} ${category}`).toBe(true);
          for (const id of ids) {
            expect(typeof id).toBe('string');
            expect(id, `${level} ${type} ${category}`).toMatch(ID_FORMAT);
          }
        }
      }
    }
  });
});
