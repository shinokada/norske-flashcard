import { describe, it, expect, beforeEach, vi } from 'vitest';
import { normalizeAnswer, gradeGrammarAnswer, buildGrammarSession, shuffleTokens } from './session';
import {
  loadGrammarProgressMap,
  saveGrammarProgress,
  getDueGrammarItems,
  GRAMMAR_LS_PREFIX,
  clearUserProgress
} from '$lib/progress';
import { freeGrammarQuestionIds } from '$lib/access';
import { questionLevels, topicLevels } from '$lib/vocab-helpers';
import type { CardProgress, GrammarQuestion } from '$lib/types';
import { createEmptyCard } from 'ts-fsrs';

// $lib/config's real FREE_GRAMMAR_TOPICS has every listed topic set to 'all' today
// (free at every level it spans). This test-only override adds one topic gated to a
// single CEFR level, purely to exercise the per-(topic, cefr) branch of the gating
// logic — see ai-docs/gating-rules.md "gate by topic × CEFR level, not by topic alone".
vi.mock('$lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/config')>();
  return {
    ...actual,
    FREE_GRAMMAR_TOPICS: {
      ...actual.FREE_GRAMMAR_TOPICS,
      'det-sentence': ['A2'] // free at A2 only, Plus-gated at B1 (real det-sentence spans both)
    }
  };
});

// ── localStorage mock ─────────────────────────────────────────────────────────

const store: Record<string, string> = {};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.stubGlobal('localStorage', {
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    }
  });
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeQuestion(overrides: Partial<GrammarQuestion> = {}): GrammarQuestion {
  return {
    id: 'gq-ikke-001',
    topic: 'ikke-placement',
    cefr: 'A2',
    type: 'fill',
    sentence: 'Jeg liker _____ vinteren.',
    answer: 'ikke',
    ...overrides
  };
}

function makeProgress(daysUntilDue: number): CardProgress {
  const due = new Date();
  due.setDate(due.getDate() + daysUntilDue);
  return {
    fsrs: { ...createEmptyCard(), due },
    seenCount: 1,
    lastSeen: new Date().toISOString(),
    level: 'A2',
    category: 'ikke-placement' as CardProgress['category']
  };
}

// ── normalizeAnswer ───────────────────────────────────────────────────────────

describe('normalizeAnswer', () => {
  it('lowercases and trims', () => {
    expect(normalizeAnswer('  Ikke ')).toBe('ikke');
  });

  it('strips trailing punctuation', () => {
    expect(normalizeAnswer('Det er ikke sant.')).toBe('det er ikke sant');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeAnswer('Jeg   forstår  ikke')).toBe('jeg forstår ikke');
  });
});

// ── gradeGrammarAnswer ────────────────────────────────────────────────────────

describe('gradeGrammarAnswer', () => {
  it('marks an exact match correct with "good"', () => {
    const r = gradeGrammarAnswer('ikke', makeQuestion());
    expect(r).toEqual({ correct: true, rating: 'good' });
  });

  it('is case- and punctuation-insensitive', () => {
    const q = makeQuestion({ answer: 'Det er ikke sant.' });
    expect(gradeGrammarAnswer('det er ikke sant', q).correct).toBe(true);
  });

  it('rejects a 1-character typo on a long word — exact match only, no leniency', () => {
    const q = makeQuestion({ answer: 'vinteren' });
    expect(gradeGrammarAnswer('vintren', q)).toEqual({ correct: false, rating: 'again' });
  });

  it('rejects a diacritic swap (ø/o) as a typo — a real Norwegian spelling mistake', () => {
    const q = makeQuestion({ answer: 'sønner' });
    expect(gradeGrammarAnswer('sonner', q)).toEqual({ correct: false, rating: 'again' });
  });

  it('rejects an extra letter on a short word within a longer sentence', () => {
    // "hjemm" isn't a 1-word typo of "hjem" that should be forgiven here —
    // hjem/hjemme is exactly the contrast this topic tests, and applying
    // whole-string edit distance to a full sentence was forgiving any single
    // stray letter anywhere in it, not just genuine typos on long words.
    const q = makeQuestion({
      topic: 'adverb-sted-hjem',
      answer: 'De går hjem.'
    });
    expect(gradeGrammarAnswer('de går hjemm', q)).toEqual({ correct: false, rating: 'again' });
    expect(gradeGrammarAnswer('de går hjem', q).correct).toBe(true);
  });

  it('rejects a 1-character typo on one word within a longer sentence', () => {
    const q = makeQuestion({
      type: 'order',
      answer: 'Jeg forstår ikke dette.'
    });
    // "forstr" is missing the å from "forstår" — with typo tolerance removed,
    // every word must match exactly, so this is rejected.
    expect(gradeGrammarAnswer('jeg forstr ikke dette', q)).toEqual({
      correct: false,
      rating: 'again'
    });
  });

  it('rejects an answer with an extra word not in the target', () => {
    const q = makeQuestion({ type: 'transform', answer: 'Jeg liker det.' });
    expect(gradeGrammarAnswer('jeg liker det veldig', q).correct).toBe(false);
  });

  it('rejects a far-off answer with "again"', () => {
    expect(gradeGrammarAnswer('alltid', makeQuestion())).toEqual({
      correct: false,
      rating: 'again'
    });
  });

  it('requires an exact match for short answers (no typo leniency)', () => {
    // "ja" is one edit from "jo" but is the WRONG option — must be rejected.
    const q = makeQuestion({ topic: 'svar-ja-jo-nei', answer: 'Jo' });
    expect(gradeGrammarAnswer('ja', q)).toEqual({ correct: false, rating: 'again' });
    expect(gradeGrammarAnswer('Jo', q).correct).toBe(true);
  });

  it('treats empty input as incorrect', () => {
    expect(gradeGrammarAnswer('', makeQuestion())).toEqual({ correct: false, rating: 'again' });
  });

  it('accepts any of the alternates', () => {
    const q = makeQuestion({
      type: 'order',
      answer: 'Jeg forstår ikke det.',
      alternates: ['Jeg forstår ikke det']
    });
    expect(gradeGrammarAnswer('Jeg forstår ikke det', q).correct).toBe(true);
  });

  it('grades multiple-choice by matching the tapped option text against answer', () => {
    const q = makeQuestion({
      type: 'multiple-choice',
      topic: 'uttrykk',
      prompt: 'Hun har fått kalde føtter før brøllopet.',
      options: [
        'Hun nøler med å gifte seg.',
        'Hun frøs på bryllupsdagen.',
        'Hun gledet seg stort.'
      ],
      answer: 'Hun nøler med å gifte seg.'
    });
    expect(gradeGrammarAnswer('Hun nøler med å gifte seg.', q)).toEqual({
      correct: true,
      rating: 'good'
    });
    expect(gradeGrammarAnswer('Hun frøs på bryllupsdagen.', q).correct).toBe(false);
  });

  // Placeholder content only, per punctuation.md Phase 1 step 4 — proves the
  // plumbing end-to-end before real kommaregler content is written (Phase 2/3).
  it('grades punctuation questions by exact match, preserving commas', () => {
    const q = makeQuestion({
      type: 'punctuation',
      topic: 'kommaregler' as GrammarQuestion['topic'],
      prompt: 'Hvilken setning har riktig tegnsetting?',
      options: [
        'Han sa at han, dessverre, ikke kunne komme.',
        'Han sa at han dessverre ikke kunne komme.',
        'Han sa, at han dessverre ikke kunne komme.'
      ],
      answer: 'Han sa at han dessverre ikke kunne komme.'
    });
    expect(gradeGrammarAnswer('Han sa at han dessverre ikke kunne komme.', q)).toEqual({
      correct: true,
      rating: 'good'
    });
    // Wrong comma placement must be rejected, not accepted as a nearby option.
    expect(gradeGrammarAnswer('Han sa at han, dessverre, ikke kunne komme.', q).correct).toBe(
      false
    );
  });

  it('does not apply typo tolerance to a punctuation question (comma is a 1-char edit)', () => {
    const q = makeQuestion({
      type: 'punctuation',
      topic: 'kommaregler' as GrammarQuestion['topic'],
      options: ['Jeg vet ikke, om han kommer.', 'Jeg vet ikke om han kommer.'],
      answer: 'Jeg vet ikke om han kommer.'
    });
    // Differs from the correct answer by exactly one comma — must NOT be
    // accepted via the typo-tolerance path that other question types use.
    expect(gradeGrammarAnswer('Jeg vet ikke, om han kommer.', q)).toEqual({
      correct: false,
      rating: 'again'
    });
  });

  it('treats empty input as incorrect for punctuation questions', () => {
    const q = makeQuestion({
      type: 'punctuation',
      topic: 'kommaregler' as GrammarQuestion['topic'],
      options: ['Ja, det stemmer.', 'Ja det stemmer.'],
      answer: 'Ja, det stemmer.'
    });
    expect(gradeGrammarAnswer('', q)).toEqual({ correct: false, rating: 'again' });
  });
});

// ── buildGrammarSession ───────────────────────────────────────────────────────

describe('buildGrammarSession', () => {
  const pool = Array.from({ length: 20 }, (_, i) =>
    makeQuestion({ id: `gq-${i}`, answer: `a${i}` })
  );

  it('caps the session at the requested count', () => {
    expect(buildGrammarSession(pool, {}, 10)).toHaveLength(10);
  });

  it('returns all questions when fewer than the count exist', () => {
    expect(buildGrammarSession(pool.slice(0, 3), {}, 10)).toHaveLength(3);
  });

  it('prioritises overdue/new cards over far-future ones', () => {
    // Make every card far-future except one, which we expect to be selected.
    const map: Record<string, CardProgress> = {};
    for (const q of pool) map[q.id] = makeProgress(365);
    map['gq-7'] = makeProgress(-5); // overdue
    const session = buildGrammarSession(pool, map, 1);
    expect(session[0].id).toBe('gq-7');
  });
});

// ── shuffleTokens ─────────────────────────────────────────────────────────────

describe('shuffleTokens', () => {
  it('preserves the multiset of tokens', () => {
    const tokens = ['ikke', 'Jeg', 'forstår', 'det'];
    expect([...shuffleTokens(tokens)].sort()).toEqual([...tokens].sort());
  });

  it('handles a single token', () => {
    expect(shuffleTokens(['ord'])).toEqual(['ord']);
  });
});

// ── freeGrammarQuestionIds ────────────────────────────────────────────────────

describe('freeGrammarQuestionIds', () => {
  it('frees every non-plusOnly question in a fully-free topic (no cap)', () => {
    // ikke-placement is free at A1 only (its A2 free sample was removed by the free-tier simplification).
    const qs: GrammarQuestion[] = Array.from({ length: 8 }, (_, i) =>
      makeQuestion({ id: `ikke-${i}`, topic: 'ikke-placement', cefr: 'A1' })
    );
    const free = freeGrammarQuestionIds(qs);
    expect(free.size).toBe(8);
    qs.forEach((q) => expect(free.has(q.id)).toBe(true));
  });

  it('gates topics independently: a topic not in FREE_GRAMMAR_TOPICS stays fully locked', () => {
    const qs: GrammarQuestion[] = [
      ...Array.from({ length: 4 }, (_, i) =>
        makeQuestion({ id: `ikke-${i}`, topic: 'ikke-placement', cefr: 'A1' })
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        makeQuestion({ id: `sterke-${i}`, topic: 'sterke-verb', cefr: 'A2' })
      )
    ];
    const free = freeGrammarQuestionIds(qs);
    expect(free.size).toBe(4);
    expect(free.has('ikke-0')).toBe(true);
    expect(free.has('sterke-0')).toBe(false);
  });

  it('gates the same topic differently per CEFR level', () => {
    // det-sentence is mocked above to be free at A2 only, Plus-gated at B1.
    const qs: GrammarQuestion[] = [
      makeQuestion({ id: 'det-a2', topic: 'det-sentence', cefr: 'A2' }),
      makeQuestion({ id: 'det-b1', topic: 'det-sentence', cefr: 'B1' })
    ];
    const free = freeGrammarQuestionIds(qs);
    expect(free.has('det-a2')).toBe(true);
    expect(free.has('det-b1')).toBe(false);
  });

  it('never frees plusOnly questions, even in a free topic/level', () => {
    const qs = [
      makeQuestion({ id: 'p1', topic: 'ikke-placement', cefr: 'A1', plusOnly: true }),
      makeQuestion({ id: 'f1', topic: 'ikke-placement', cefr: 'A1' })
    ];
    const free = freeGrammarQuestionIds(qs);
    expect(free.has('p1')).toBe(false);
    expect(free.has('f1')).toBe(true);
  });
});

// ── questionLevels / topicLevels ──────────────────────────────────────────────

describe('questionLevels', () => {
  it("always returns a single-item array of the question's cefr", () => {
    expect(questionLevels(makeQuestion({ cefr: 'B2' }))).toEqual(['B2']);
  });

  it('reflects cefr for every level', () => {
    expect(questionLevels(makeQuestion({ cefr: 'A2' }))).toEqual(['A2']);
  });
});

describe('topicLevels', () => {
  it('returns the sorted, de-duplicated CEFR span of a question list', () => {
    const qs = [
      makeQuestion({ id: 'a', cefr: 'A2' }),
      makeQuestion({ id: 'b', cefr: 'C' }),
      makeQuestion({ id: 'c', cefr: 'B1' })
    ];
    expect(topicLevels(qs)).toEqual(['A2', 'B1', 'C']);
  });
});

// ── grammar progress (guest / localStorage) ───────────────────────────────────

describe('saveGrammarProgress + loadGrammarProgressMap', () => {
  it('persists and rehydrates a grammar question keyed by id', async () => {
    const q = makeQuestion();
    const { progress: map } = await saveGrammarProgress(q, 'good', {}, null);
    expect(map[q.id].seenCount).toBe(1);
    expect(localStorage.getItem(GRAMMAR_LS_PREFIX + q.id)).not.toBeNull();

    const loaded = loadGrammarProgressMap();
    expect(loaded[q.id]).toBeDefined();
    expect(loaded[q.id].fsrs.due).toBeInstanceOf(Date);
  });

  it('increments seenCount across ratings', async () => {
    const q = makeQuestion();
    let { progress: map } = await saveGrammarProgress(q, 'good', {}, null);
    ({ progress: map } = await saveGrammarProgress(q, 'again', map, null));
    expect(map[q.id].seenCount).toBe(2);
  });

  it('does not collide with the vocab progress- namespace', async () => {
    const q = makeQuestion();
    await saveGrammarProgress(q, 'good', {}, null);
    // grammar key uses the 'grammar-' prefix, not 'progress-'
    expect(localStorage.getItem('progress-' + q.id)).toBeNull();
  });

  it('clearUserProgress removes grammar keys', async () => {
    await saveGrammarProgress(makeQuestion(), 'good', {}, null);
    clearUserProgress();
    expect(loadGrammarProgressMap()).toEqual({});
  });
});

// ── getDueGrammarItems ────────────────────────────────────────────────────────

describe('getDueGrammarItems', () => {
  // Local helper (distinct from the file's makeProgress, which fixes
  // level/category to A2/ikke-placement) — these tests need to vary both.
  function progressRow(daysUntilDue: number, level: CardProgress['level'], topic: string) {
    const due = new Date();
    due.setDate(due.getDate() + daysUntilDue);
    return {
      fsrs: { ...createEmptyCard(), due },
      seenCount: 1,
      lastSeen: new Date().toISOString(),
      level,
      category: topic as CardProgress['category']
    };
  }

  it('returns [] for an empty progress map', () => {
    expect(getDueGrammarItems({})).toEqual([]);
  });

  it('excludes a question not yet due', () => {
    const map = { 'gq-1': progressRow(1, 'A2', 'ikke-placement') };
    expect(getDueGrammarItems(map)).toEqual([]);
  });

  it('includes a question whose due date has passed', () => {
    const map = { 'gq-1': progressRow(-1, 'A2', 'ikke-placement') };
    expect(getDueGrammarItems(map)).toEqual([{ id: 'gq-1', level: 'A2' }]);
  });

  it('a question with no progress row is never included, regardless of options', () => {
    // getDueGrammarItems only ever iterates the map it's given — there's no
    // separate "is this a known question id" check, so an id absent from
    // the map simply can't appear in the result.
    const map = { 'gq-1': progressRow(-1, 'A2', 'ikke-placement') };
    const result = getDueGrammarItems(map, { level: 'A2', topic: 'ikke-placement' });
    expect(result.map((r) => r.id)).not.toContain('gq-unseen');
  });

  it('filters by level when provided', () => {
    const map = {
      'gq-a2': progressRow(-1, 'A2', 'ikke-placement'),
      'gq-b1': progressRow(-1, 'B1', 'ikke-placement')
    };
    const result = getDueGrammarItems(map, { level: 'A2' });
    expect(result).toEqual([{ id: 'gq-a2', level: 'A2' }]);
  });

  it('filters by topic when provided', () => {
    const map = {
      'gq-ikke': progressRow(-1, 'A2', 'ikke-placement'),
      'gq-sterke': progressRow(-1, 'A2', 'sterke-verb')
    };
    const result = getDueGrammarItems(map, { topic: 'ikke-placement' });
    expect(result).toEqual([{ id: 'gq-ikke', level: 'A2' }]);
  });

  it('combines level and topic filters (both must match)', () => {
    const map = {
      // Right topic, wrong level — must be excluded.
      'gq-b1-ikke': progressRow(-1, 'B1', 'ikke-placement'),
      // Right level, wrong topic — must be excluded.
      'gq-a2-sterke': progressRow(-1, 'A2', 'sterke-verb'),
      // Matches both — the only one that should come back.
      'gq-a2-ikke': progressRow(-1, 'A2', 'ikke-placement')
    };
    const result = getDueGrammarItems(map, { level: 'A2', topic: 'ikke-placement' });
    expect(result).toEqual([{ id: 'gq-a2-ikke', level: 'A2' }]);
  });

  it('never mixes up a vocab progress map with the grammar shape it expects', () => {
    // Sanity check: the function trusts card.level/card.category verbatim —
    // any CardProgress-shaped map works, since grammar and vocab progress
    // rows share the same CardProgress type. Two due rows, no filter → both.
    const map = {
      'gq-1': progressRow(-1, 'A1', 'a'),
      'gq-2': progressRow(-2, 'C', 'b')
    };
    const result = getDueGrammarItems(map);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id).sort()).toEqual(['gq-1', 'gq-2']);
  });
});

describe('buildGrammarSession — mixed-level tie-breaking', () => {
  // Mirrors the real noun-plurals topic: 10 A2 questions followed by 2 B1
  // questions, all unseen (due = 0). Before the shuffle-first fix, slice(0,10)
  // always returned the 10 A2 questions and the B1 ones were never seen.
  const a2Questions = Array.from({ length: 10 }, (_, i) =>
    makeQuestion({ id: `a2-${i}`, cefr: 'A2', topic: 'noun-plurals', answer: `a${i}` })
  );
  const b1Questions = Array.from({ length: 2 }, (_, i) =>
    makeQuestion({ id: `b1-${i}`, cefr: 'B1', topic: 'noun-plurals', answer: `b${i}` })
  );
  const pool = [...a2Questions, ...b1Questions];

  it('B1 questions can appear in a session when all questions are unseen', () => {
    // Run many sessions; B1 questions must appear at least once.
    let b1Seen = false;
    for (let attempt = 0; attempt < 50 && !b1Seen; attempt++) {
      const session = buildGrammarSession(pool, {}, 10);
      if (session.some((q) => q.cefr === 'B1')) b1Seen = true;
    }
    expect(b1Seen).toBe(true);
  });

  it('sessions vary between runs (not always the same 10)', () => {
    const ids1 = buildGrammarSession(pool, {}, 10)
      .map((q) => q.id)
      .sort();
    let foundDifferent = false;
    for (let attempt = 0; attempt < 20 && !foundDifferent; attempt++) {
      const ids2 = buildGrammarSession(pool, {}, 10)
        .map((q) => q.id)
        .sort();
      if (ids1.join() !== ids2.join()) foundDifferent = true;
    }
    expect(foundDifferent).toBe(true);
  });

  it('overdue questions are still prioritised over new ones', () => {
    // Mark all B1 questions as far-future and all other A2 questions as near-future,
    // so only a2-3 (overdue) has the earliest due date.
    // New/unseen cards score due=0 (epoch-zero) — less than any real timestamp —
    // so we must give the non-overdue cards explicit progress entries with future dates
    // to ensure the overdue card has a strictly smaller timestamp than everything else.
    const map: Record<string, CardProgress> = {};
    for (const q of b1Questions) map[q.id] = makeProgress(365);
    for (const q of a2Questions) map[q.id] = makeProgress(30); // future, not overdue
    map['a2-3'] = makeProgress(-10); // overdue — earliest timestamp, must win
    // With only 1 slot, the overdue A2 must always win.
    const session = buildGrammarSession(pool, map, 1);
    expect(session[0].id).toBe('a2-3');
  });
});
