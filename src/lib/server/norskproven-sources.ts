// src/lib/server/norskproven-sources.ts
// Loads a Norskprøven practice test on the server only
// (ai-docs/implementation/norskproven-server-gating.md). `$lib/server` modules cannot
// be imported by browser code, so none of this content can end up in a client chunk.
//
// The three practice pages (reading, writing, oral) used to import these files in the
// browser and check the plan afterwards, so every visitor could download tests 2 and 3.
// Now their server loads call `loadNorskprovenPage`: it applies the gate first and
// only then reads the file.
//
// Dynamic import() keeps a test unloaded until a request needs it, and the module
// cache keeps it after that.

import { redirect } from '@sveltejs/kit';
import { isFreeTest } from '$lib/access';
import type { NorskprovenData } from '$lib/types';

export type NorskprovenLevel = 'A2' | 'B1';
export type NorskprovenTest = '1' | '2' | '3';

type Loader = () => Promise<{ default: unknown }>;

const LOADERS: Record<NorskprovenLevel, Record<NorskprovenTest, Loader>> = {
  A2: {
    '1': () => import('$lib/data/norskproven-a2-1.json'),
    '2': () => import('$lib/data/norskproven-a2-2.json'),
    '3': () => import('$lib/data/norskproven-a2-3.json')
  },
  B1: {
    '1': () => import('$lib/data/norskproven-b1-1.json'),
    '2': () => import('$lib/data/norskproven-b1-2.json'),
    '3': () => import('$lib/data/norskproven-b1-3.json')
  }
};

/** Where a visitor without Plus goes when they ask for a test that is not free. */
export const PLUS_REDIRECT = '/plus?ref=practice-test-lock';

function isNorskprovenLevel(value: string): value is NorskprovenLevel {
  return value === 'A2' || value === 'B1';
}

function isNorskprovenTest(value: string): value is NorskprovenTest {
  return value === '1' || value === '2' || value === '3';
}

/**
 * Validates the route params, applies the plan gate and returns the test file.
 * Unknown level or test: redirect to /norskproven. Test that is not free (see
 * `isFreeTest`) and no Plus: redirect to /plus, without reading the file.
 * `plan` is `locals.plan` (hooks.server.ts), never anything the client sends.
 */
export async function loadNorskprovenPage(
  params: { level: string; test: string },
  isPlus: boolean
): Promise<{ data: NorskprovenData; level: NorskprovenLevel; test: NorskprovenTest }> {
  const level = params.level.toUpperCase();
  const test = params.test;

  if (!isNorskprovenLevel(level) || !isNorskprovenTest(test)) {
    redirect(302, '/norskproven');
  }
  if (!isPlus && !isFreeTest(Number(test))) {
    redirect(302, PLUS_REDIRECT);
  }

  const data = (await LOADERS[level][test]()).default as unknown as NorskprovenData;
  return { data, level, test };
}
