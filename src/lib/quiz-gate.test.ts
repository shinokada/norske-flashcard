// Phase 1 of ai-docs/implementation/quiz-server-gating.md: the gate that decides
// which vocab / uttrykk entries a free or guest visitor may receive for the quiz.
// Runs against the real data. Expectations are derived from the policy in
// config.ts (FREE_VOCAB_CATEGORIES, FREE_UTTRYKK_THEMES via isFreeUttrykkTheme),
// not from the gate itself, so a policy change is caught.

import { describe, it, expect } from 'vitest';
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
import { FREE_VOCAB_CATEGORIES } from '$lib/config';
import { isFreeQuizCategory, isPlusOnlyEntry } from '$lib/access';
import { isFreeUttrykkTheme } from '$lib/uttrykk-gating';
import { getDistractors, isQuizable } from '$lib/quiz';
import type { UttrykkThemeLevel } from '$lib/config';
import type { CEFRLevel, VocabEntry } from '$lib/types';
import {
  countQuizEntries,
  entriesForPlan,
  isQuizableEntry,
  isQuizEntryFree,
  quizPoolSize,
  selectQuizEntries,
  type QuizEntryType,
  type QuizSource
} from './quiz-gate';

const asEntries = (x: unknown) => x as VocabEntry[];

const VOCAB: VocabEntry[] = [
  ...asEntries(vocabA1),
  ...asEntries(vocabA2),
  ...asEntries(vocabB1),
  ...asEntries(vocabB2),
  ...asEntries(vocabC)
];
const UTTRYKK: VocabEntry[] = [
  ...asEntries(uttrykkA1),
  ...asEntries(uttrykkA2),
  ...asEntries(uttrykkB1),
  ...asEntries(uttrykkB2),
  ...asEntries(uttrykkC)
];

const LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C'];

/** What the policy says, written independently of quiz-gate.ts. */
function expectedFree(e: VocabEntry, type: QuizEntryType): boolean {
  if (e.level === 'A1') return true;
  const freeCategory = FREE_VOCAB_CATEGORIES[e.level as Exclude<CEFRLevel, 'A1'>].includes(
    e.category
  );
  // C uttrykk lives inside the vocab categories and follows them.
  if (type === 'vocab' || e.level === 'C') return freeCategory;
  // A2 to B2 uttrykk: free only for a free uttrykk theme (currently none).
  return isFreeUttrykkTheme(e.level as UttrykkThemeLevel, e.category);
}

describe('entriesForPlan', () => {
  it('the fixtures are real data', () => {
    expect(VOCAB.length).toBeGreaterThan(1000);
    expect(UTTRYKK.length).toBeGreaterThan(1000);
  });

  it('gives a Plus user every entry, in order, as a new array', () => {
    for (const [entries, type] of [
      [VOCAB, 'vocab'],
      [UTTRYKK, 'uttrykk']
    ] as const) {
      const out = entriesForPlan(entries, type, true);
      expect(out).toHaveLength(entries.length);
      expect(out).not.toBe(entries);
      expect(out[0]).toBe(entries[0]);
      expect(out[out.length - 1]).toBe(entries[entries.length - 1]);
    }
  });

  it('never mutates its input', () => {
    const copy = [...VOCAB];
    entriesForPlan(VOCAB, 'vocab', false);
    entriesForPlan(VOCAB, 'vocab', true);
    expect(VOCAB).toEqual(copy);
  });

  it('keeps the input order for a free user', () => {
    const index = new Map(VOCAB.map((e, i) => [e, i]));
    const positions = entriesForPlan(VOCAB, 'vocab', false).map((e) => index.get(e)!);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('gives a free user all of A1, vocab and uttrykk', () => {
    expect(entriesForPlan(asEntries(vocabA1), 'vocab', false)).toHaveLength(
      asEntries(vocabA1).length
    );
    expect(entriesForPlan(asEntries(uttrykkA1), 'uttrykk', false)).toHaveLength(
      asEntries(uttrykkA1).length
    );
  });

  it('gives a free user exactly the policy for every real vocab and uttrykk entry', () => {
    for (const [entries, type] of [
      [VOCAB, 'vocab'],
      [UTTRYKK, 'uttrykk']
    ] as const) {
      const got = new Set(entriesForPlan(entries, type, false));
      for (const e of entries) {
        expect(got.has(e), `${type} ${e.id} (${e.level}/${e.category})`).toBe(
          expectedFree(e, type)
        );
      }
    }
  });

  it('gives a free user no A2 to B2 uttrykk, even in a free vocab category', () => {
    for (const level of ['A2', 'B1', 'B2'] as const) {
      const entries = UTTRYKK.filter((e) => e.level === level);
      expect(entries.length, level).toBeGreaterThan(0);
      expect(entriesForPlan(entries, 'uttrykk', false), level).toEqual([]);
    }
  });

  it('only offers free vocab categories above A1', () => {
    for (const level of ['A2', 'B1', 'B2', 'C'] as const) {
      const cats = new Set(
        entriesForPlan(
          VOCAB.filter((e) => e.level === level),
          'vocab',
          false
        ).map((e) => e.category)
      );
      expect(
        [...cats].every((c) => FREE_VOCAB_CATEGORIES[level].includes(c)),
        level
      ).toBe(true);
      expect(cats.size, level).toBeGreaterThan(0);
    }
  });
});

describe('isQuizEntryFree', () => {
  it('is true only when both policies allow the entry', () => {
    for (const [entries, type] of [
      [VOCAB, 'vocab'],
      [UTTRYKK, 'uttrykk']
    ] as const) {
      for (const e of entries) {
        const both =
          isFreeQuizCategory(e.level, e.category) && !isPlusOnlyEntry(e.level, e.category, type);
        expect(isQuizEntryFree(e, type), `${type} ${e.id}`).toBe(both);
      }
    }
  });

  it('closes the gap the old page check left: a free category slug on an A2 uttrykk entry', () => {
    const sample = UTTRYKK.find(
      (e) => e.level === 'A2' && FREE_VOCAB_CATEGORIES.A2.includes(e.category)
    );
    // The old page-only check (isFreeQuizCategory) let this entry through.
    if (!sample) return;
    expect(isFreeQuizCategory(sample.level, sample.category)).toBe(true);
    expect(isQuizEntryFree(sample, 'uttrykk')).toBe(false);
  });

  it('locks an unknown category above A1', () => {
    // category is a union of known slugs, so an unknown one needs a double cast.
    const entry = {
      level: 'B1' as const,
      category: 'not-a-real-category' as unknown as VocabEntry['category']
    };
    expect(isQuizEntryFree(entry, 'vocab')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phases 2 and 3: the picker counts and the payload behind POST /api/quiz-entries
// ---------------------------------------------------------------------------

const SOURCES: QuizSource[] = LEVELS.flatMap((level) => [
  { level, type: 'vocab' as const, entries: VOCAB.filter((e) => e.level === level) },
  { level, type: 'uttrykk' as const, entries: UTTRYKK.filter((e) => e.level === level) }
]);

const COUNTS = countQuizEntries(SOURCES);

describe('isQuizableEntry', () => {
  it('agrees with isQuizable from $lib/quiz on every real entry', () => {
    const disagreements = [...VOCAB, ...UTTRYKK].filter(
      (e) => isQuizableEntry(e) !== isQuizable(e)
    );
    expect(disagreements.map((e) => e.id)).toEqual([]);
  });
});

describe('countQuizEntries', () => {
  it('counts every quizable entry once, split by vocab and uttrykk', () => {
    const vocab = COUNTS.reduce((n, c) => n + c.vocab, 0);
    const uttrykk = COUNTS.reduce((n, c) => n + c.uttrykk, 0);
    expect(vocab).toBe(VOCAB.filter(isQuizable).length);
    expect(uttrykk).toBe(UTTRYKK.filter(isQuizable).length);
  });

  it('has one row per level and category, in level order', () => {
    const keys = COUNTS.map((c) => `${c.level}|${c.category}`);
    expect(new Set(keys).size).toBe(keys.length);
    const order = COUNTS.map((c) => LEVELS.indexOf(c.level));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('carries no entry content', () => {
    for (const c of COUNTS) {
      expect(Object.keys(c).sort()).toEqual(['category', 'level', 'uttrykk', 'vocab']);
    }
  });
});

describe('selectQuizEntries', () => {
  it('quizPoolSize equals the payload size for every level, category and plan', () => {
    const mismatches: string[] = [];
    for (const level of LEVELS) {
      const categories = [
        '',
        ...new Set(COUNTS.filter((c) => c.level === level).map((c) => c.category))
      ];
      for (const category of categories) {
        for (const isPlus of [false, true]) {
          const size = quizPoolSize(COUNTS, level, category, isPlus);
          const real = selectQuizEntries(SOURCES, level, category || undefined, isPlus).entries
            .length;
          if (size !== real) mismatches.push(`${level}|${category}|${isPlus}: ${size} vs ${real}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('never gives a free user an entry the gate locks, as a question or as an option', () => {
    const leaks: string[] = [];
    for (const level of LEVELS) {
      const categories = [
        undefined,
        ...new Set(COUNTS.filter((c) => c.level === level).map((c) => c.category))
      ];
      for (const category of categories) {
        const { entries, distractors } = selectQuizEntries(SOURCES, level, category, false);
        const uttrykkIds = new Set(UTTRYKK.map((e) => e.id));
        for (const e of [...entries, ...distractors]) {
          const type: QuizEntryType = uttrykkIds.has(e.id) ? 'uttrykk' : 'vocab';
          if (!expectedFree(e, type)) leaks.push(`${level}|${category}|${e.id}`);
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  it('gives a free user nothing for a Plus-only category', () => {
    const locked = COUNTS.find(
      (c) => c.level === 'B2' && quizPoolSize(COUNTS, 'B2', c.category, false) === 0
    );
    expect(locked).toBeDefined();
    expect(selectQuizEntries(SOURCES, 'B2', locked!.category, false)).toEqual({
      entries: [],
      distractors: []
    });
    // The same category is not empty for Plus.
    expect(selectQuizEntries(SOURCES, 'B2', locked!.category, true).entries.length).toBeGreaterThan(
      0
    );
  });

  it('keeps entries and distractors apart, and only sends distractors when a category narrows the pool', () => {
    for (const isPlus of [false, true]) {
      const all = selectQuizEntries(SOURCES, 'A2', undefined, isPlus);
      expect(all.distractors).toEqual([]);

      const category = COUNTS.find(
        (c) => c.level === 'A2' && quizPoolSize(COUNTS, 'A2', c.category, isPlus) > 0
      )!.category;
      const narrowed = selectQuizEntries(SOURCES, 'A2', category, isPlus);
      expect(narrowed.entries.every((e) => e.category === category)).toBe(true);
      expect(narrowed.distractors.length).toBeGreaterThanOrEqual(3);
      expect(narrowed.distractors.every((e) => e.category !== category)).toBe(true);
      const ids = new Set(narrowed.entries.map((e) => e.id));
      expect(narrowed.distractors.some((e) => ids.has(e.id))).toBe(false);
    }
  });

  it('gives Plus every quizable entry of a level', () => {
    for (const level of LEVELS) {
      const real = [...VOCAB, ...UTTRYKK].filter((e) => e.level === level && isQuizable(e));
      expect(selectQuizEntries(SOURCES, level, undefined, true).entries).toHaveLength(real.length);
    }
  });

  it('has enough answer options for every question a free user can get', () => {
    // The same-level pool must still offer three distractors per entry, including
    // monolingual levels where a candidate needs a definition.
    for (const level of LEVELS) {
      const { entries } = selectQuizEntries(SOURCES, level, undefined, false);
      const sample = entries.filter((_, i) => i % 25 === 0);
      for (const entry of sample) {
        expect(getDistractors(entry, entries), `${level} ${entry.id}`).toHaveLength(3);
      }
    }
  });
});

describe('a free user can still get a full set of distractors', () => {
  // The distractor pool for a free quiz is the free pool, so a locked word can
  // never be offered as an option. It must stay large enough: every free,
  // quizable entry needs three distractors (same level first, then padded).
  const free = [
    ...entriesForPlan(VOCAB, 'vocab', false),
    ...entriesForPlan(UTTRYKK, 'uttrykk', false)
  ];

  for (const level of LEVELS) {
    it(`${level}: every free quizable entry gets three distractors from the free pool`, () => {
      const entries = free.filter((e) => e.level === level && isQuizable(e));
      expect(entries.length).toBeGreaterThan(0);
      const short = entries.filter((e) => getDistractors(e, free, 3).length < 3).map((e) => e.id);
      expect(short).toEqual([]);
    });
  }
});
