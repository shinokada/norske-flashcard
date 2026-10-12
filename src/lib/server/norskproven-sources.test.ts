import { describe, it, expect } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { isFreeTest } from '$lib/access';
import {
  loadNorskprovenPage,
  PLUS_REDIRECT,
  type NorskprovenLevel,
  type NorskprovenTest
} from './norskproven-sources';

import a2t1 from '$lib/data/norskproven-a2-1.json';
import a2t2 from '$lib/data/norskproven-a2-2.json';
import a2t3 from '$lib/data/norskproven-a2-3.json';
import b1t1 from '$lib/data/norskproven-b1-1.json';
import b1t2 from '$lib/data/norskproven-b1-2.json';
import b1t3 from '$lib/data/norskproven-b1-3.json';

// ai-docs/implementation/norskproven-server-gating.md, Phase 2.

const FILES: Record<NorskprovenLevel, Record<NorskprovenTest, unknown>> = {
  A2: { '1': a2t1, '2': a2t2, '3': a2t3 },
  B1: { '1': b1t1, '2': b1t2, '3': b1t3 }
};

const LEVELS: NorskprovenLevel[] = ['A2', 'B1'];
const TESTS: NorskprovenTest[] = ['1', '2', '3'];

/** The status and location of the redirect a call throws, or null when it does not redirect. */
async function redirectOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (err) {
    if (isRedirect(err)) return { status: err.status, location: err.location };
    throw err;
  }
  return null;
}

describe('the free-test policy', () => {
  it('only test 1 is free', () => {
    expect(isFreeTest(1)).toBe(true);
    expect(isFreeTest(0)).toBe(false);
    expect(isFreeTest(2)).toBe(false);
    expect(isFreeTest(3)).toBe(false);
  });
});

describe('loadNorskprovenPage: the data files', () => {
  it('has reading, writing and oral content in all six files', () => {
    for (const level of LEVELS) {
      for (const test of TESTS) {
        const file = FILES[level][test] as Record<string, unknown>;
        for (const section of ['reading', 'writing', 'oral']) {
          const value = file[section];
          expect(Array.isArray(value), `${level} test ${test} ${section}`).toBe(true);
          expect((value as unknown[]).length, `${level} test ${test} ${section}`).toBeGreaterThan(
            0
          );
        }
      }
    }
  });

  it('returns exactly the file for the level and test (Plus)', async () => {
    for (const level of LEVELS) {
      for (const test of TESTS) {
        const result = await loadNorskprovenPage({ level, test }, true);
        expect(result.data, `${level} test ${test}`).toEqual(FILES[level][test]);
        expect(result.level).toBe(level);
        expect(result.test).toBe(test);
      }
    }
  });

  it('accepts a lower-case level, as in the URL', async () => {
    const result = await loadNorskprovenPage({ level: 'a2', test: '1' }, false);
    expect(result.level).toBe('A2');
    expect(result.data).toEqual(FILES.A2['1']);
  });
});

describe('loadNorskprovenPage: the plan gate', () => {
  it('gives a free or guest visitor test 1 at both levels', async () => {
    for (const level of LEVELS) {
      const result = await loadNorskprovenPage({ level, test: '1' }, false);
      expect(result.data, level).toEqual(FILES[level]['1']);
    }
  });

  it('sends a free or guest visitor to /plus for tests 2 and 3, at both levels', async () => {
    for (const level of LEVELS) {
      for (const test of ['2', '3'] as const) {
        const redirect = await redirectOf(loadNorskprovenPage({ level, test }, false));
        expect(redirect, `${level} test ${test}`).toEqual({ status: 302, location: PLUS_REDIRECT });
      }
    }
  });

  it('does not redirect a Plus visitor', async () => {
    for (const level of LEVELS) {
      for (const test of TESTS) {
        expect(await redirectOf(loadNorskprovenPage({ level, test }, true))).toBeNull();
      }
    }
  });
});

describe('loadNorskprovenPage: bad params', () => {
  it('redirects an unknown level or test to /norskproven, for any plan', async () => {
    const bad = [
      { level: 'c1', test: '1' },
      { level: 'a1', test: '1' },
      { level: 'a2', test: '4' },
      { level: 'a2', test: '0' },
      { level: 'a2', test: '' },
      { level: '', test: '1' }
    ];
    for (const params of bad) {
      for (const isPlus of [false, true]) {
        const redirect = await redirectOf(loadNorskprovenPage(params, isPlus));
        expect(redirect, JSON.stringify({ ...params, isPlus })).toEqual({
          status: 302,
          location: '/norskproven'
        });
      }
    }
  });
});
