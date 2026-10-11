// Phase 3 of ai-docs/implementation/grammar-server-gating.md: the chapter
// practice endpoint must give a free or guest caller only the free questions.
// Uses the real grammar data and the real gate, so a policy change is caught.

import { describe, it, expect } from 'vitest';
import grammarData from '$lib/data/grammar.json';
import { freeGrammarQuestionIds } from '$lib/access';
import { chapterEntryBySlug } from '$lib/grammar/overview';
import type { CEFRLevel, GrammarQuestion } from '$lib/types';
import { POST } from './+server';

const ALL = grammarData as GrammarQuestion[];

async function call(body: unknown, plan: 'plus' | 'free' | undefined, raw = false) {
  const request = new Request('http://localhost/api/grammar-questions', {
    method: 'POST',
    body: raw ? (body as string) : JSON.stringify(body)
  });
  return POST({ request, locals: { plan } } as unknown as Parameters<typeof POST>[0]);
}

// helsetninger is a mixed chapter: free at A1, Plus at the other levels.
const chapter = chapterEntryBySlug('helsetninger')!;
const topics = chapter.topics.map((t) => t.topic as string);
const levels: CEFRLevel[] = chapter.levels;
const inChapter = ALL.filter((q) => topics.includes(q.topic) && levels.includes(q.cefr));
const freeIds = freeGrammarQuestionIds(inChapter);

describe('POST /api/grammar-questions', () => {
  it('the fixture chapter really mixes free and locked questions', () => {
    expect(freeIds.size).toBeGreaterThan(0);
    expect(inChapter.length).toBeGreaterThan(freeIds.size);
  });

  it('gives a free user only the free questions', async () => {
    const res = await call({ topics, levels }, 'free');
    expect(res.status).toBe(200);
    const { questions } = (await res.json()) as { questions: GrammarQuestion[] };
    expect(questions.length).toBe(freeIds.size);
    expect(questions.every((q) => freeIds.has(q.id))).toBe(true);
  });

  it('treats a missing plan (guest) like a free user', async () => {
    const res = await call({ topics, levels }, undefined);
    const { questions } = (await res.json()) as { questions: GrammarQuestion[] };
    expect(questions.every((q) => freeIds.has(q.id))).toBe(true);
  });

  it('gives a Plus user every question of the chapter', async () => {
    const res = await call({ topics, levels }, 'plus');
    const { questions } = (await res.json()) as { questions: GrammarQuestion[] };
    expect(questions.map((q) => q.id).sort()).toEqual(inChapter.map((q) => q.id).sort());
  });

  it('never returns a locked question to a free user, whatever the body claims', async () => {
    const res = await call({ topics, levels, plan: 'plus', isPlus: true }, 'free');
    const { questions } = (await res.json()) as { questions: GrammarQuestion[] };
    expect(questions.some((q) => q.plusOnly || !freeIds.has(q.id))).toBe(false);
  });

  it('only returns questions of the requested topics', async () => {
    const res = await call({ topics: [topics[0]], levels }, 'plus');
    const { questions } = (await res.json()) as { questions: GrammarQuestion[] };
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every((q) => q.topic === topics[0])).toBe(true);
  });

  it('only loads the requested levels', async () => {
    const res = await call({ topics, levels: ['A1'] }, 'plus');
    const { questions } = (await res.json()) as { questions: GrammarQuestion[] };
    expect(questions.every((q) => q.cefr === 'A1')).toBe(true);
  });

  it('returns nothing for a fully locked topic to a free user', async () => {
    const res = await call({ topics: ['uttrykk'], levels: ['A1', 'A2', 'B1', 'B2', 'C'] }, 'free');
    const { questions } = (await res.json()) as { questions: GrammarQuestion[] };
    expect(questions).toEqual([]);
  });

  it('returns an empty list for empty or unknown input', async () => {
    for (const body of [
      { topics: [], levels },
      { topics, levels: [] },
      { topics, levels: ['Z9'] },
      { topics: ['no-such-topic'], levels }
    ]) {
      const res = await call(body, 'plus');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ questions: [] });
    }
  });

  it('rejects invalid JSON and wrongly typed fields with 400', async () => {
    expect((await call('{not json', 'plus', true)).status).toBe(400);
    expect((await call({ topics: 'x', levels }, 'plus')).status).toBe(400);
    expect((await call({ topics, levels: [1] }, 'plus')).status).toBe(400);
    expect((await call(null, 'plus')).status).toBe(400);
  });

  it('is never cached, for free or Plus', async () => {
    for (const plan of ['free', 'plus'] as const) {
      const res = await call({ topics, levels }, plan);
      expect(res.headers.get('cache-control')).toBe('private, no-store');
    }
  });
});
