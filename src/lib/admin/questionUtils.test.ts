import { describe, it, expect } from 'vitest';
import { generateId, validateQuestion, blankQuestion } from './questionUtils';
import type { GrammarQuestion, GrammarTopic } from '$lib/types';

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

function makeQuestions(
  count: number,
  topic: GrammarTopic = 'ikke-placement',
  startAt = 1
): GrammarQuestion[] {
  return Array.from({ length: count }, (_, i) =>
    makeQuestion({
      id: `gq-ikke-${String(startAt + i).padStart(3, '0')}`,
      topic
    })
  );
}

// ── generateId ────────────────────────────────────────────────────────────────

describe('generateId', () => {
  it('starts at 001 when there are no existing questions for the topic', () => {
    expect(generateId('ikke-placement', [])).toBe('gq-ikke-001');
  });

  it('increments one above the highest existing number', () => {
    const existing = makeQuestions(3, 'ikke-placement');
    expect(generateId('ikke-placement', existing)).toBe('gq-ikke-004');
  });

  it('handles gaps in the sequence (uses max + 1)', () => {
    const existing = [
      makeQuestion({ id: 'gq-ikke-001' }),
      makeQuestion({ id: 'gq-ikke-005' }) // gap at 002-004
    ];
    expect(generateId('ikke-placement', existing)).toBe('gq-ikke-006');
  });

  it('ignores questions from other topics when computing the next id', () => {
    const existing = [
      makeQuestion({ id: 'gq-ikke-009', topic: 'ikke-placement' }),
      makeQuestion({ id: 'gq-v2-001', topic: 'v2-word-order' })
    ];
    // Only ikke questions count for the ikke-placement topic
    expect(generateId('ikke-placement', existing)).toBe('gq-ikke-010');
  });

  it('zero-pads the number to 3 digits', () => {
    const existing = makeQuestions(9, 'ikke-placement');
    const id = generateId('ikke-placement', existing);
    expect(id).toBe('gq-ikke-010');
  });

  it('uses the correct prefix for v2-word-order', () => {
    expect(generateId('v2-word-order', [])).toBe('gq-v2-001');
  });

  it('uses the correct prefix for modal-verb-order', () => {
    expect(generateId('modal-verb-order', [])).toBe('gq-mod-001');
  });

  it('uses the correct prefix for setningsadverbial', () => {
    expect(generateId('setningsadverbial', [])).toBe('gq-setadv-001');
  });

  it('uses the correct prefix for noun-articles', () => {
    expect(generateId('noun-articles', [])).toBe('gq-noun-art-001');
  });

  it('uses the correct prefix for noun-plurals', () => {
    expect(generateId('noun-plurals', [])).toBe('gq-noun-pl-001');
  });

  it('uses the correct prefix for adj-agreement', () => {
    expect(generateId('adj-agreement', [])).toBe('gq-adj-001');
  });

  it('uses the correct prefix for preposisjoner-tid', () => {
    expect(generateId('preposisjoner-tid', [])).toBe('gq-prep-tid-001');
  });

  it('uses the correct prefix for preposisjoner-sted', () => {
    expect(generateId('preposisjoner-sted', [])).toBe('gq-prep-sted-001');
  });

  it('falls back to first-6-chars for an unknown topic', () => {
    const id = generateId('future-unknown-topic', []);
    expect(id).toBe('gq-future-001');
  });
});

// ── validateQuestion ──────────────────────────────────────────────────────────

describe('validateQuestion — common required fields', () => {
  it('returns no errors for a valid fill question', () => {
    expect(validateQuestion(makeQuestion())).toEqual([]);
  });

  it('flags a missing id', () => {
    expect(validateQuestion(makeQuestion({ id: '' }))).toContain('id is required');
  });

  it('flags a missing topic', () => {
    const q = makeQuestion();
    const partial = { ...q } as Partial<GrammarQuestion>;
    delete partial.topic;
    expect(validateQuestion(partial)).toContain('topic is required');
  });

  it('flags a missing cefr', () => {
    const q = makeQuestion();
    const partial = { ...q } as Partial<GrammarQuestion>;
    delete partial.cefr;
    expect(validateQuestion(partial)).toContain('cefr is required');
  });

  it('flags a missing type', () => {
    const q = makeQuestion();
    const partial = { ...q } as Partial<GrammarQuestion>;
    delete partial.type;
    expect(validateQuestion(partial)).toContain('type is required');
  });

  it('flags a missing answer', () => {
    expect(validateQuestion(makeQuestion({ answer: '' }))).toContain('answer is required');
  });

  it('can flag multiple errors at once', () => {
    const errors = validateQuestion({ type: 'fill' });
    expect(errors.length).toBeGreaterThan(2);
  });
});

describe('validateQuestion — fill type', () => {
  it('passes when sentence is provided', () => {
    expect(
      validateQuestion(makeQuestion({ type: 'fill', sentence: 'Jeg _____ ikke.' }))
    ).not.toContain('sentence is required for fill');
  });

  it('flags a missing sentence', () => {
    const q = makeQuestion({ type: 'fill' });
    const partial = { ...q } as Partial<GrammarQuestion>;
    delete partial.sentence;
    expect(validateQuestion(partial)).toContain('sentence is required for fill');
  });
});

describe('validateQuestion — order type', () => {
  it('passes when tokens array is provided and non-empty', () => {
    const errors = validateQuestion(
      makeQuestion({ type: 'order', tokens: ['Jeg', 'forstår', 'ikke'] })
    );
    expect(errors).not.toContain('tokens are required for order');
  });

  it('flags missing tokens', () => {
    const q = makeQuestion({ type: 'order' });
    const partial = { ...q } as Partial<GrammarQuestion>;
    delete partial.tokens;
    expect(validateQuestion(partial)).toContain('tokens are required for order');
  });

  it('flags an empty tokens array', () => {
    expect(validateQuestion(makeQuestion({ type: 'order', tokens: [] }))).toContain(
      'tokens are required for order'
    );
  });
});

describe('validateQuestion — transform type', () => {
  it('passes when source is provided', () => {
    const errors = validateQuestion(makeQuestion({ type: 'transform', source: 'Jeg er glad.' }));
    expect(errors).not.toContain('source is required for transform');
  });

  it('flags a missing source', () => {
    const q = makeQuestion({ type: 'transform' });
    const partial = { ...q } as Partial<GrammarQuestion>;
    delete partial.source;
    expect(validateQuestion(partial)).toContain('source is required for transform');
  });
});

describe('validateQuestion — minimal-pair type', () => {
  it('passes when optionA and optionB are provided', () => {
    const errors = validateQuestion(
      makeQuestion({
        type: 'minimal-pair',
        optionA: 'Jeg er ikke glad.',
        optionB: 'Jeg ikke er glad.'
      })
    );
    expect(errors).not.toContain('optionA and optionB are required for minimal-pair');
  });

  it('flags when optionA is missing', () => {
    const q = makeQuestion({ type: 'minimal-pair', optionB: 'Jeg ikke er glad.' });
    expect(validateQuestion(q)).toContain('optionA and optionB are required for minimal-pair');
  });

  it('flags when optionB is missing', () => {
    const q = makeQuestion({ type: 'minimal-pair', optionA: 'Jeg er ikke glad.' });
    expect(validateQuestion(q)).toContain('optionA and optionB are required for minimal-pair');
  });

  it('flags when both are missing', () => {
    const q = makeQuestion({ type: 'minimal-pair' });
    expect(validateQuestion(q)).toContain('optionA and optionB are required for minimal-pair');
  });
});

describe('validateQuestion — multiple-choice type', () => {
  it('passes with 3 options where answer matches one of them', () => {
    const errors = validateQuestion(
      makeQuestion({
        type: 'multiple-choice',
        options: ['Hun nøler.', 'Hun frøs.', 'Hun gledet seg.'],
        answer: 'Hun nøler.'
      })
    );
    expect(errors).toEqual([]);
  });

  it('passes with 4 options where answer matches one of them', () => {
    const errors = validateQuestion(
      makeQuestion({
        type: 'multiple-choice',
        options: ['Hun nøler.', 'Hun frøs.', 'Hun gledet seg.', 'Hun lo.'],
        answer: 'Hun lo.'
      })
    );
    expect(errors).toEqual([]);
  });

  it('flags fewer than 3 options', () => {
    const q = makeQuestion({
      type: 'multiple-choice',
      options: ['Hun nøler.', 'Hun frøs.'],
      answer: 'Hun nøler.'
    });
    expect(validateQuestion(q)).toContain('options must have 3 or 4 entries for multiple-choice');
  });

  it('flags more than 4 options', () => {
    const q = makeQuestion({
      type: 'multiple-choice',
      options: ['a', 'b', 'c', 'd', 'e'],
      answer: 'a'
    });
    expect(validateQuestion(q)).toContain('options must have 3 or 4 entries for multiple-choice');
  });

  it('flags missing options', () => {
    const q = makeQuestion({ type: 'multiple-choice' });
    const partial = { ...q } as Partial<GrammarQuestion>;
    delete partial.options;
    expect(validateQuestion(partial)).toContain(
      'options must have 3 or 4 entries for multiple-choice'
    );
  });

  it('flags an answer that does not exactly match one of the options', () => {
    const q = makeQuestion({
      type: 'multiple-choice',
      options: ['Hun nøler.', 'Hun frøs.', 'Hun gledet seg.'],
      answer: 'Hun nøler'
    });
    expect(validateQuestion(q)).toContain(
      'answer must exactly match one of the options for multiple-choice'
    );
  });
});

describe("validateQuestion — cross-type: fill-specific errors don't appear for other types", () => {
  it('no sentence error for an order question', () => {
    const errors = validateQuestion(makeQuestion({ type: 'order', tokens: ['a', 'b'] }));
    expect(errors).not.toContain('sentence is required for fill');
  });

  it('no tokens error for a fill question', () => {
    const errors = validateQuestion(makeQuestion({ type: 'fill', sentence: 'Jeg ___.' }));
    expect(errors).not.toContain('tokens are required for order');
  });

  it('no source error for a fill question', () => {
    const errors = validateQuestion(makeQuestion({ type: 'fill', sentence: 'Jeg ___.' }));
    expect(errors).not.toContain('source is required for transform');
  });
});

// ── blankQuestion ─────────────────────────────────────────────────────────────

describe('blankQuestion', () => {
  it('defaults type to transform', () => {
    expect(blankQuestion().type).toBe('transform');
  });

  it('accepts an explicit type', () => {
    expect(blankQuestion('fill').type).toBe('fill');
    expect(blankQuestion('order').type).toBe('order');
    expect(blankQuestion('minimal-pair').type).toBe('minimal-pair');
  });

  it('defaults cefr to A2', () => {
    expect(blankQuestion().cefr).toBe('A2');
  });

  it('defaults topic to ikke-placement', () => {
    expect(blankQuestion().topic).toBe('ikke-placement');
  });

  it('defaults plusOnly to false', () => {
    expect(blankQuestion().plusOnly).toBe(false);
  });

  it('starts with an empty answer', () => {
    expect(blankQuestion().answer).toBe('');
  });

  it('starts with an empty alternates array', () => {
    expect(blankQuestion().alternates).toEqual([]);
  });
});
