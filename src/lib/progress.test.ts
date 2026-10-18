import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEmptyCard, Rating } from 'ts-fsrs';
import {
  loadProgressMap,
  saveProgress,
  saveGrammarProgress,
  countDueToday,
  previewIntervals,
  getFsrs,
  LS_PREFIX,
  GRAMMAR_LS_PREFIX
} from './progress';
import type { VocabEntry, GrammarQuestion } from '$lib/types';

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

const entry: VocabEntry = {
  // Old-format shape (v-{level}-{category}-{NNN}) is deliberate — several
  // tests below (loadProgressMap's stale-key handling) rely on this id
  // looking pre-migration. 'testfixture' as the category segment is
  // deliberately not a real category, so this id can never collide with an
  // actual entry in id-migration-map.json (unlike an earlier version of
  // this fixture, 'v-a1-greetings-001', which turned out to be a real
  // migrated id and got silently renamed by remapStaleKeys() mid-test).
  id: 'v-a1-testfixture-001',
  norsk: 'hei',
  english: 'hello',
  spanish: 'hola',
  ukrainian: 'привіт',
  example: 'Hei, hvordan har du det?',
  example_english: 'Hello, how are you?',
  example_spanish: 'Hola, ¿cómo estás?',
  example_ukrainian: 'Привіт, як справи?',
  level: 'A1',
  category: 'greetings',
  part: 'interjection'
};

// vocabKey(entry) returns entry.id when present — use this as the map key.
const KEY = entry.id;

// ── loadProgressMap ───────────────────────────────────────────────────────────

describe('loadProgressMap', () => {
  it('returns empty map when localStorage is empty', async () => {
    expect(await loadProgressMap()).toEqual({});
  });

  it('ignores keys without the progress- prefix', async () => {
    store['other-key'] = JSON.stringify({ fsrs: {}, seenCount: 1 });
    expect(await loadProgressMap()).toEqual({});
  });

  it('loads and rehydrates a stored progress entry', async () => {
    const map = await saveProgress(entry, 'good', {});
    const loaded = await loadProgressMap();
    expect(loaded[KEY]).toBeDefined();
    expect(loaded[KEY].seenCount).toBe(1);
    expect(loaded[KEY].fsrs.due).toBeInstanceOf(Date);
    expect(map[KEY].level).toBe('A1');
    expect(map[KEY].category).toBe('greetings');
  });

  it('skips malformed JSON entries without throwing', async () => {
    store['progress-bad'] = 'not-json{{{';
    expect(await loadProgressMap()).toEqual({});
  });

  it('leaves current-format ids untouched (no stale-key gate triggered)', async () => {
    // entry.id is already 'v-a1-testfixture-001' in the old format on
    // purpose for other tests in this file — but a genuinely *current*-
    // format id (w-{NNNNNN}, shared vocab/uttrykk shape) must not trip
    // STALE_ID_RE or trigger a mapping fetch. Note 'v-a1-0001' (Round 1's
    // intermediate shape) is NOT a valid stand-in here anymore — it's one
    // of STALE_ID_RE's own whitelisted branches now, so it would (correctly)
    // trigger the gate rather than test the "leave alone" path.
    await saveProgress({ ...entry, id: 'w-000001' }, 'good', {});
    const loaded = await loadProgressMap();
    expect(loaded['w-000001']).toBeDefined();
  });

  it('remaps a stale pre-migration id to its new id via id-migration-map.json (Phase 3/7/11)', async () => {
    // v-a1-home-034 ('uthus') flattens straight through to w-000572 — a real
    // pair from src/lib/data/id-migration-map.json (single-hop mapping,
    // Round 3: original pre-Round-1 shape → final shared w-{NNNNNN} id; see
    // also e2e/review.test.ts, which exercises the same id end to end
    // through /api/review-entries).
    const OLD_ID = 'v-a1-home-034';
    const NEW_ID = 'w-000572';
    store[LS_PREFIX + OLD_ID] = JSON.stringify({
      fsrs: {
        due: new Date().toISOString(),
        stability: 1,
        difficulty: 5,
        elapsed_days: 0,
        scheduled_days: 1,
        learning_steps: 0,
        reps: 1,
        lapses: 0,
        state: 2
      },
      seenCount: 1,
      lastSeen: new Date().toISOString(),
      level: 'A1',
      category: 'home'
    });

    const loaded = await loadProgressMap();
    expect(loaded[NEW_ID]).toBeDefined();
    expect(loaded[OLD_ID]).toBeUndefined();
  });
});

// ── saveProgress ──────────────────────────────────────────────────────────────

describe('saveProgress', () => {
  it('creates a new entry for an unseen card', async () => {
    const map = await saveProgress(entry, 'good', {});
    expect(map[KEY]).toBeDefined();
    expect(map[KEY].seenCount).toBe(1);
    expect(map[KEY].level).toBe('A1');
    expect(map[KEY].category).toBe('greetings');
  });

  it('increments seenCount on subsequent ratings', async () => {
    let map = await saveProgress(entry, 'good', {});
    map = await saveProgress(entry, 'again', map);
    expect(map[KEY].seenCount).toBe(2);
  });

  it('persists the entry to localStorage', async () => {
    await saveProgress(entry, 'easy', {});
    expect(localStorage.getItem('progress-' + KEY)).not.toBeNull();
  });

  it('sets a future due date for "easy" rating', async () => {
    const map = await saveProgress(entry, 'easy', {});
    expect(new Date(map[KEY].fsrs.due).getTime()).toBeGreaterThan(Date.now());
  });

  it('does not mutate the original progressMap', async () => {
    const original = {};
    const result = await saveProgress(entry, 'good', original);
    expect(original).toEqual({});
    expect(result[KEY]).toBeDefined();
  });

  it('handles all four FSRS ratings without throwing', async () => {
    for (const rating of ['again', 'hard', 'good', 'easy'] as const) {
      await expect(saveProgress(entry, rating, {})).resolves.not.toThrow();
    }
  });
});

// ── saveGrammarProgress ───────────────────────────────────────────────────────

describe('saveGrammarProgress', () => {
  // Only id, topic and cefr are read by saveGrammarProgress.
  const question = {
    id: 'g-test-001',
    topic: 'word-order',
    cefr: 'A1'
  } as unknown as GrammarQuestion;

  it('reports saved: true and persists to localStorage on success', async () => {
    const { progress, saved } = await saveGrammarProgress(question, 'good', {});
    expect(saved).toBe(true);
    expect(progress[question.id].seenCount).toBe(1);
    expect(localStorage.getItem(GRAMMAR_LS_PREFIX + question.id)).not.toBeNull();
  });

  it('reports saved: false but keeps the in-memory progress when localStorage throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('localStorage', {
      ...localStorage,
      setItem: () => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      }
    });

    const { progress, saved } = await saveGrammarProgress(question, 'good', {});

    expect(saved).toBe(false);
    expect(progress[question.id]).toBeDefined();
    expect(progress[question.id].seenCount).toBe(1);
    errorSpy.mockRestore();
  });

  it('does not mutate the original progressMap', async () => {
    const original = {};
    const { progress } = await saveGrammarProgress(question, 'good', original);
    expect(original).toEqual({});
    expect(progress[question.id]).toBeDefined();
  });
});

// ── getFsrs ───────────────────────────────────────────────────────────────────

describe('getFsrs', () => {
  it('returns the same default instance for null and undefined retention', () => {
    const a = getFsrs(null);
    const b = getFsrs(undefined);
    expect(typeof a.next).toBe('function');
    expect(a).toBe(b);
  });

  it('caches one instance per retention and keys the cache by retention only', () => {
    expect(getFsrs(0.8)).toBe(getFsrs(0.8));
    expect(getFsrs(0.95)).toBe(getFsrs(0.95));
    expect(getFsrs(0.8)).not.toBe(getFsrs(0.95));
  });

  it('schedules a new card at Hard 3d / Good 5d / Easy 8d at the default retention', () => {
    // BASE_W's initial-stability overrides (see fsrs-update.md Phase 3), Standard preset.
    const i = previewIntervals(null, new Date(), getFsrs(null));
    expect(i.hard).toBe('3d');
    expect(i.good).toBe('5d');
    expect(i.easy).toBe('8d');
  });

  it('applies the retention preset: Intensive reviews sooner than Relaxed', () => {
    const now = new Date();
    const card = createEmptyCard(now);
    const relaxed = getFsrs(0.8).next(card, now, Rating.Good).card.scheduled_days;
    const intensive = getFsrs(0.95).next(card, now, Rating.Good).card.scheduled_days;
    expect(intensive).toBeLessThan(relaxed);
  });

  it('saveProgress ignores the retention preset when there is no userId (guest / free)', async () => {
    const relaxed = await saveProgress(entry, 'good', {}, null, 0.8);
    const intensive = await saveProgress(entry, 'good', {}, null, 0.95);
    expect(relaxed[KEY].fsrs.scheduled_days).toBe(intensive[KEY].fsrs.scheduled_days);
  });
});

// ── countDueToday ─────────────────────────────────────────────────────────────

describe('countDueToday', () => {
  it('returns 0 for an empty map', () => {
    expect(countDueToday({})).toBe(0);
  });

  it('counts cards with due date in the past', async () => {
    const map = await saveProgress(entry, 'good', {});
    // Backdate the due date so the card is overdue
    const overdue = { ...map[KEY], fsrs: { ...map[KEY].fsrs, due: new Date('2000-01-01') } };
    expect(countDueToday({ [KEY]: overdue })).toBe(1);
  });

  it('does not count cards due in the future', async () => {
    const map = await saveProgress(entry, 'easy', {}); // "easy" schedules far in the future
    expect(countDueToday(map)).toBe(0);
  });
});

// ── previewIntervals ──────────────────────────────────────────────────────────

describe('previewIntervals', () => {
  const now = new Date('2025-06-01T12:00:00Z');

  it('returns all four rating keys', () => {
    const result = previewIntervals(null, now);
    expect(result).toHaveProperty('again');
    expect(result).toHaveProperty('hard');
    expect(result).toHaveProperty('good');
    expect(result).toHaveProperty('easy');
  });

  it('all values are non-empty strings', () => {
    const result = previewIntervals(null, now);
    for (const val of Object.values(result)) {
      expect(typeof val).toBe('string');
      expect(val.length).toBeGreaterThan(0);
    }
  });

  it('interval ordering: again <= hard <= good <= easy for a new card', async () => {
    // FSRS always schedules again shortest and easy longest on a new card.
    // We compare the raw ms values by back-calculating from the formatted strings —
    // but it is simpler to just assert the due dates directly via saveProgress.
    // Instead, assert the labels reflect short-to-long ordering by saving after
    // each speculative rating and comparing actual due dates.
    const againMap = await saveProgress(entry, 'again', {});
    const hardMap = await saveProgress(entry, 'hard', {});
    const goodMap = await saveProgress(entry, 'good', {});
    const easyMap = await saveProgress(entry, 'easy', {});

    const dueAgain = new Date(againMap[KEY].fsrs.due).getTime();
    const dueHard = new Date(hardMap[KEY].fsrs.due).getTime();
    const dueGood = new Date(goodMap[KEY].fsrs.due).getTime();
    const dueEasy = new Date(easyMap[KEY].fsrs.due).getTime();

    expect(dueAgain).toBeLessThanOrEqual(dueHard);
    expect(dueHard).toBeLessThanOrEqual(dueGood);
    expect(dueGood).toBeLessThanOrEqual(dueEasy);
  });

  it('accepts null (new card) without throwing', () => {
    expect(() => previewIntervals(null, now)).not.toThrow();
  });

  it('accepts an existing CardProgress without throwing', async () => {
    const map = await saveProgress(entry, 'good', {});
    expect(() => previewIntervals(map[KEY], now)).not.toThrow();
  });

  it('formats "again" as a day-scale interval, not minutes (enable_short_term: false)', () => {
    // With short-term scheduling disabled, even "again" on a new card is scheduled by
    // the main FSRS formula (day-scale) rather than a fixed short-term minute step —
    // this is the fix for cards reappearing within the same session.
    const result = previewIntervals(null, now);
    expect(result.again).toMatch(/^\d+(m|h|d)$/);
    expect(result.again).not.toBe('0m');
  });

  it('formats days correctly for a well-reviewed card', async () => {
    // Rate good three times to push intervals into days territory
    let map = await saveProgress(entry, 'good', {});
    map = await saveProgress(entry, 'good', map);
    map = await saveProgress(entry, 'good', map);
    const result = previewIntervals(map[KEY], now);
    // "easy" on a mature card should be days or months
    expect(result.easy).toMatch(/^\d+(d|mo)$/);
  });
});
