// src/lib/server/quiz-sources.ts
// Loads the vocab and uttrykk files the quiz draws from, on the server only
// (ai-docs/implementation/quiz-server-gating.md). `$lib/server` modules cannot be
// imported by browser code, so none of this content can end up in a client chunk.
//
// Dynamic import() keeps a level's files unloaded until a request needs them, and
// the module cache keeps them after that.

import type { CEFRLevel, VocabEntry } from '$lib/types';
import {
  countQuizEntries,
  type QuizCategoryCount,
  type QuizEntryType,
  type QuizSource
} from '$lib/quiz-gate';

type Loader = () => Promise<{ default: VocabEntry[] }>;

const LOADERS: Record<CEFRLevel, Record<QuizEntryType, Loader>> = {
  A1: {
    vocab: () => import('$lib/data/vocab-a1.json') as unknown as ReturnType<Loader>,
    uttrykk: () => import('$lib/data/uttrykk-a1.json') as unknown as ReturnType<Loader>
  },
  A2: {
    vocab: () => import('$lib/data/vocab-a2.json') as unknown as ReturnType<Loader>,
    uttrykk: () => import('$lib/data/uttrykk-a2.json') as unknown as ReturnType<Loader>
  },
  B1: {
    vocab: () => import('$lib/data/vocab-b1.json') as unknown as ReturnType<Loader>,
    uttrykk: () => import('$lib/data/uttrykk-b1.json') as unknown as ReturnType<Loader>
  },
  B2: {
    vocab: () => import('$lib/data/vocab-b2.json') as unknown as ReturnType<Loader>,
    uttrykk: () => import('$lib/data/uttrykk-b2.json') as unknown as ReturnType<Loader>
  },
  C: {
    vocab: () => import('$lib/data/vocab-c.json') as unknown as ReturnType<Loader>,
    uttrykk: () => import('$lib/data/uttrykk-c.json') as unknown as ReturnType<Loader>
  }
};

export const QUIZ_LEVELS = Object.keys(LOADERS) as CEFRLevel[];

export function isQuizLevel(value: unknown): value is CEFRLevel {
  return typeof value === 'string' && (QUIZ_LEVELS as string[]).includes(value);
}

/** The vocab and uttrykk files of the given levels, each tagged with its type. */
export async function loadQuizSources(levels: readonly CEFRLevel[]): Promise<QuizSource[]> {
  const types: QuizEntryType[] = ['vocab', 'uttrykk'];
  return Promise.all(
    levels.flatMap((level) =>
      types.map(async (type) => ({
        level,
        type,
        entries: (await LOADERS[level][type]()).default
      }))
    )
  );
}

// The counts are the same for everyone and the files do not change while the server
// runs, so compute them once.
let counts: Promise<QuizCategoryCount[]> | null = null;

/** Quizable entries per level and category, for the picker. No entry content. */
export function getQuizCategoryCounts(): Promise<QuizCategoryCount[]> {
  counts ??= loadQuizSources(QUIZ_LEVELS)
    .then(countQuizEntries)
    .catch((err) => {
      counts = null; // do not cache a failure
      throw err;
    });
  return counts;
}
