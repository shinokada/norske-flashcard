import { FSRS, createEmptyCard, Rating, generatorParameters } from 'ts-fsrs';
import type { Grade } from 'ts-fsrs';
import type { FSRSRating, CardProgress, CEFRLevel, GrammarTopic } from '$lib/types';
import type { VocabEntry, GrammarQuestion } from '$lib/types';
import { supabase } from '$lib/supabase';

// enable_short_term: false disables ts-fsrs's sub-day (re)learning steps for every
// instance below. Without it, a first-time "Hard"/"Good" rating on a brand-new card
// reschedules in minutes and re-enters the same session's queue almost immediately —
// across many topics in one sitting those re-queues pile up. With it disabled, even a
// first rating is scheduled by the main FSRS formula (day-scale), computed per-card
// from difficulty/stability rather than a fixed short-term step.
//
// BASE_W overrides only the initial-stability weights (indices 1–3: hard/good/easy —
// index 0/"again" is left at ts-fsrs's default, which floors at 1 day regardless) so a
// brand-new card's very first rating lands at Hard=3d/Good=5d/Easy=8d under the Standard
// (0.90) retention preset, instead of ts-fsrs's stock ~2d/3d/8d. This flattens the
// Good→Easy jump (was 2.67x, now 1.6x) so "Easy" doesn't disappear from the deck for
// disproportionately longer than "Good". Verified against ts-fsrs 5.4.1 — see
// ai-docs/implementation/fsrs-update.md. Only affects a card's *first* interval; growth
// on subsequent reviews (from real stability/difficulty) is untouched. The Relaxed/
// Intensive presets scale proportionally from this same baseline via request_retention,
// so no separate tuning is needed per preset.
const BASE_W = (() => {
  const w = [...generatorParameters().w];
  w[1] = 3; // hard
  w[2] = 5; // good
  w[3] = 8; // easy
  return w;
})();

const DEFAULT_FSRS = new FSRS(generatorParameters({ enable_short_term: false, w: BASE_W }));

// FSRS instance cache, keyed by retention. Every instance uses the same BASE_W and
// enable_short_term: false; only request_retention varies. A user who changes their
// review-intensity preset mid-session gets the matching instance.
const fsrsCache = new Map<number, FSRS>();

/**
 * Returns the FSRS instance for a review-intensity preset: `request_retention` is set from
 * the user's `fsrs_retention` (0.8 Relaxed / 0.9 Standard / 0.95 Intensive). null/undefined
 * returns DEFAULT_FSRS (ts-fsrs's own default of 0.9). Instances are cached per retention.
 *
 * Weights are always BASE_W. There are no per-user weights: the optimise-fsrs-weights Edge
 * Function and the user_settings lookup were removed (ai-docs/implementation/
 * fsrs-optimise-function.md).
 */
export function getFsrs(retention?: number | null): FSRS {
  if (retention == null) return DEFAULT_FSRS;
  const cached = fsrsCache.get(retention);
  if (cached) return cached;
  const instance = new FSRS(
    generatorParameters({ enable_short_term: false, request_retention: retention, w: BASE_W })
  );
  fsrsCache.set(retention, instance);
  return instance;
}

export const LS_PREFIX = 'progress-';

/**
 * localStorage prefix for grammar FSRS state (guest/free users).
 * Kept distinct from LS_PREFIX so the vocab loaders never pick up grammar keys.
 * Plus users persist grammar progress to the grammar_progress table instead.
 */
export const GRAMMAR_LS_PREFIX = 'grammar-';

/**
 * Removes all progress keys for guest/free users from localStorage.
 * Called on logout so the next person who opens the browser sees no progress.
 */
export function clearUserProgress(): void {
  // Guest/free users store vocab keys as 'progress-<vocabId>' and grammar
  // keys as 'grammar-<questionId>'. (Plus users no longer use localStorage at all.)
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(LS_PREFIX) || key?.startsWith(GRAMMAR_LS_PREFIX)) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

const RATING_MAP: Record<FSRSRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy
};

// ── Stable key helper ────────────────────────────────────────────────────────

/**
 * Returns the stable progress key for a vocab entry: its `id` (`w-NNNNNN`). Never `norsk`:
 * sibling senses share it, so a `norsk` key would merge their cards (the lint rule in
 * eslint.config.js blocks `x[e.norsk]`). `VocabEntry.id` is required and `pnpm check:ids`
 * guarantees every production entry has one. Both guest/free localStorage and the
 * in-memory progressMap use this key.
 *
 * Old guest localStorage keys written by `norsk` (before ids existed) never match any
 * entry and are simply ignored; they are not migrated.
 */
export function vocabKey(entry: VocabEntry): string {
  return entry.id;
}

// ── Stale-id migration (Phase 3/7/11, id-new-format.md) ───────────────────────

/**
 * Whitelist of every superseded vocab/uttrykk id shape, from oldest to newest.
 * The *current* shape (`w-{NNNNNN}`, shared across vocab and uttrykk since
 * Round 3) is deliberately NOT in this list — only shapes that used to be
 * valid and have since been replaced belong here.
 *
 * Deliberately a whitelist of known-past shapes, not "anything that doesn't
 * match the current shape" — the latter would also flag legacy norsk-
 * keys (from before ids existed; vocabKey() no longer falls back to norsk) as
 * "possibly stale", paying the id-migration-map.json fetch cost for guests
 * who have no stale id at all, just an older storage convention with
 * nothing in the mapping file to find.
 *
 *   1. v-{level}-{category}-{NNN}  — the original, pre-Round-1 shape. The
 *      only shape any real guest actually has today, since neither Round 1
 *      nor Round 2 ever shipped to production before Round 3 folded
 *      straight through to the final shared format.
 *   2. v-{level}-{NNNN}            — Round 1's intermediate shape. Never
 *      deployed to a real guest, but kept matching defensively in case of
 *      local test data.
 *   3. v-{NNNNNN}                  — Round 2's intermediate (vocab-only,
 *      global) shape. Same defensive reasoning as #2.
 *   4. u-{level}-{NNN}             — uttrykk's original, pre-Round-2 shape.
 *      Round 1 never touched uttrykk, so this was still "current" right up
 *      until Round 3's migration.
 *   5. u-{NNNNN}                   — Round 2's intermediate (uttrykk-only,
 *      global) shape. Same defensive reasoning as #2/#3.
 */
const STALE_ID_RE = new RegExp(
  [
    String.raw`^v-[a-z0-9]+-.+-\d{3}$`, // 1: pre-Round-1 vocab
    String.raw`^v-[a-z0-9]+-\d{4}$`, // 2: Round 1 intermediate vocab
    String.raw`^v-\d{6}$`, // 3: Round 2 intermediate vocab (global)
    String.raw`^u-[a-z0-9]+-\d{3}$`, // 4: pre-Round-2 uttrykk
    String.raw`^u-\d{5}$` // 5: Round 2 intermediate uttrykk (global)
  ].join('|')
);

function hasStaleKeys(map: Record<string, CardProgress>): boolean {
  return Object.keys(map).some((k) => STALE_ID_RE.test(k));
}

/**
 * Remaps any old-format key in `map` to its new id via id-migration-map.json,
 * dynamically imported only when `hasStaleKeys` finds a candidate — never
 * bundled into every route, never fetched for a map with no stale keys.
 * Last-write-wins if both the old and new key happen to already exist
 * (shouldn't occur in practice).
 */
async function remapStaleKeys(
  map: Record<string, CardProgress>
): Promise<Record<string, CardProgress>> {
  if (!hasStaleKeys(map)) return map;

  const { default: idMigrationMap } = (await import('$lib/data/id-migration-map.json')) as {
    default: Record<string, string>;
  };

  const remapped: Record<string, CardProgress> = { ...map };
  for (const [oldId, progress] of Object.entries(map)) {
    const newId = idMigrationMap[oldId];
    if (newId) {
      remapped[newId] = progress;
      delete remapped[oldId];
    }
  }
  return remapped;
}

// ── Local storage (guest / free users only) ──────────────────────────────────

/**
 * Loads the progress map from localStorage.
 * Only used for guest and free users. Plus users call loadProgressMapFromSupabase.
 *
 * Remaps any stale (pre-migration) vocab/uttrykk ids found in the map to
 * their current `w-{NNNNNN}` id via id-migration-map.json (Phase 3/7/11).
 * Not persisted back to localStorage immediately — the next saveProgress()
 * call naturally writes under the new key.
 */
export async function loadProgressMap(): Promise<Record<string, CardProgress>> {
  const map: Record<string, CardProgress> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(LS_PREFIX)) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as CardProgress;
          parsed.fsrs.due = new Date(parsed.fsrs.due);
          if (parsed.fsrs.last_review) {
            parsed.fsrs.last_review = new Date(parsed.fsrs.last_review);
          }
          map[key.slice(LS_PREFIX.length)] = parsed;
        }
      } catch {
        // Ignore malformed entries
      }
    }
  }
  return remapStaleKeys(map);
}

// ── Supabase row shape ───────────────────────────────────────────────────────

interface ProgressRow {
  // vocab_id is the stable lookup key (entry.id).
  // NOT NULL — migration 016 added it as NOT NULL with a unique constraint.
  vocab_id: string;
  level: string;
  category: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
  seen_count: number;
  last_seen: string;
}

function toRow(entry: VocabEntry, p: CardProgress): Omit<ProgressRow, never> {
  return {
    vocab_id: vocabKey(entry),
    // level/category: same Phase 4 backward-compat note as saveProgress()
    // below — written for Table Editor readability, not read back for
    // stats/due-filtering (Phase 2/3 resolve those live instead).
    level: p.level,
    category: p.category,
    due: p.fsrs.due instanceof Date ? p.fsrs.due.toISOString() : String(p.fsrs.due),
    stability: p.fsrs.stability,
    difficulty: p.fsrs.difficulty,
    elapsed_days: p.fsrs.elapsed_days,
    scheduled_days: p.fsrs.scheduled_days,
    learning_steps: p.fsrs.learning_steps,
    reps: p.fsrs.reps,
    lapses: p.fsrs.lapses,
    state: p.fsrs.state,
    last_review: p.fsrs.last_review
      ? p.fsrs.last_review instanceof Date
        ? p.fsrs.last_review.toISOString()
        : String(p.fsrs.last_review)
      : null,
    seen_count: p.seenCount,
    last_seen: p.lastSeen
  };
}

function fromRow(row: ProgressRow): CardProgress {
  return {
    fsrs: {
      due: new Date(row.due),
      stability: row.stability,
      difficulty: row.difficulty,
      elapsed_days: row.elapsed_days,
      scheduled_days: row.scheduled_days,
      learning_steps: row.learning_steps,
      reps: row.reps,
      lapses: row.lapses,
      state: row.state,
      last_review: row.last_review ? new Date(row.last_review) : undefined
    },
    seenCount: row.seen_count,
    lastSeen: row.last_seen,
    level: row.level as CardProgress['level'],
    category: row.category as CardProgress['category']
  };
}

// ── Row key: what we use to key the in-memory map from a DB row ──────────────

/**
 * Derives the in-memory map key from a Supabase row.
 * Always uses vocab_id (NOT NULL since migration 016, norsk dropped in 017).
 */
function rowKey(row: ProgressRow): string {
  return row.vocab_id;
}

// ── Supabase — Plus users ────────────────────────────────────────────────────

/**
 * Fetches all card_progress rows for a Plus user and returns them as a
 * CardProgress map keyed by vocab_id.
 * Called on mount for Plus users instead of loadProgressMap.
 */
export async function loadProgressMapFromSupabase(
  userId: string
): Promise<Record<string, CardProgress>> {
  const { data, error } = await supabase.from('card_progress').select('*').eq('user_id', userId);

  if (error || !data) return {};

  const map: Record<string, CardProgress> = {};
  for (const row of data as ProgressRow[]) {
    map[rowKey(row)] = fromRow(row);
  }
  return map;
}

/**
 * Upserts a single card_progress row for a Plus user, then returns the
 * updated progress map. Called by saveProgress for Plus users.
 */
async function saveProgressToSupabase(
  userId: string,
  entry: VocabEntry,
  progress: CardProgress,
  progressMap: Record<string, CardProgress>
): Promise<Record<string, CardProgress>> {
  const key = vocabKey(entry);
  const updated = { ...progressMap, [key]: progress };

  // NOTE: supabase-js does NOT throw on PostgREST errors — it resolves with
  // { data, error }. A try/catch here only catches network-level exceptions,
  // so failures (e.g. a missing/mismatched onConflict constraint) were being
  // silently swallowed. Check `error` explicitly and log it.
  const { error } = await supabase
    .from('card_progress')
    .upsert({ user_id: userId, ...toRow(entry, progress) }, { onConflict: 'user_id,vocab_id' });

  if (error) {
    console.error('saveProgressToSupabase: upsert failed', error);
  }

  return updated;
}

/**
 * Deletes all card_progress, grammar_progress and study_days rows for a user
 * from Supabase. Called when a Plus user resets their progress from the stats
 * page.
 */
export async function resetProgressInSupabase(userId: string): Promise<void> {
  const results = await Promise.all([
    supabase.from('card_progress').delete().eq('user_id', userId),
    supabase.from('grammar_progress').delete().eq('user_id', userId),
    supabase.from('study_days').delete().eq('user_id', userId)
  ]);
  for (const { error } of results) {
    if (error) console.error('resetProgressInSupabase: delete failed', error);
  }
}

// ── Core progress functions ──────────────────────────────────────────────────

/**
 * Computes the next FSRS card state and persists it.
 *
 * - Plus users (userId present): writes directly to Supabase. localStorage is
 *   not touched. Returns a Promise resolving to the updated map.
 * - Guest/free users (userId null): writes synchronously to localStorage.
 *   Returns the updated map directly (wrapped in a resolved Promise for a
 *   uniform call signature).
 *
 * The in-memory progressMap and localStorage are keyed by vocabKey(entry)
 * (i.e. entry.id).
 *
 * Callers should await this function regardless of user type.
 */
export async function saveProgress(
  entry: VocabEntry,
  rating: FSRSRating,
  progressMap: Record<string, CardProgress>,
  userId?: string | null,
  retention?: number | null
): Promise<Record<string, CardProgress>> {
  const key = vocabKey(entry);
  const now = new Date();
  const existing = progressMap[key] ?? null;
  const card = existing ? existing.fsrs : createEmptyCard(now);

  // Retention presets apply to Plus users only; guests and free users use the default.
  const fsrs = getFsrs(userId ? retention : null);
  const result = fsrs.next(card, now, RATING_MAP[rating]);

  const updated: CardProgress = {
    fsrs: result.card,
    seenCount: (existing?.seenCount ?? 0) + 1,
    lastSeen: now.toISOString(),
    lastRating: rating,
    // Kept for backward-compat / readability in Table Editor (Phase 4,
    // permanent-structural-fix.md) — nothing reads these two fields for
    // stats or due-filtering anymore as of Phase 2/3 (both resolve live via
    // content-lookup.ts's resolveEntry() instead). They're just a snapshot
    // of where this entry was *at review time*, and are allowed to go
    // stale the moment the entry moves — that's expected now, not a bug.
    level: entry.level,
    category: entry.category
  };

  if (userId) {
    // Plus: Supabase only — no localStorage
    void recordStudyDay(userId);

    const newMap = await saveProgressToSupabase(userId, entry, updated, progressMap);
    return newMap;
  } else {
    // Guest / free: localStorage only
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(updated));
    return { ...progressMap, [key]: updated };
  }
}

export function countDueToday(progressMap: Record<string, CardProgress>): number {
  const now = new Date();
  return Object.values(progressMap).filter((p) => new Date(p.fsrs.due) <= now).length;
}

// ── Due-only review (ai-docs/implementation/due-only.md) ───────────────────

export interface DueItem {
  id: string;
}

/**
 * Returns every due card in `progressMap` as the minimal `{ id }` shape
 * `/api/review-entries` expects — id only, no level/category/type.
 *
 * Before Phase 3 (permanent-structural-fix.md) this also scoped by level/
 * category/vocab-vs-uttrykk, filtered off the *stored* `CardProgress.level`/
 * `.category` snapshot. That snapshot goes stale the moment an entry moves
 * level, category, or vocab↔uttrykk without being reviewed again — exactly
 * the bug this whole plan doc fixes elsewhere (stats.ts). Doing the live
 * fix here too (resolving each id via content-lookup.ts's `resolveEntry()`)
 * would mean importing that full id→location map into progress.ts, which
 * is bundled into nearly every flashcard/quiz/review route — see the plan
 * doc's Performance notes. So scoping now happens server-side instead, in
 * `/api/review-entries`, which already loads production content JSON at
 * zero client cost: callers pass their desired level/category/type filter
 * straight through to that endpoint (as request fields) rather than to
 * this function. See `/review/+page.svelte` for the caller-side change.
 *
 * New/never-studied cards (no progress row) are never included — "due"
 * here specifically means an existing FSRS schedule whose due date has
 * passed, not "not yet seen". See due-only.md's Decisions section.
 */
export function getDueItems(progressMap: Record<string, CardProgress>): DueItem[] {
  const now = new Date();

  return Object.entries(progressMap)
    .filter(([, card]) => new Date(card.fsrs.due) <= now)
    .map(([id]) => ({ id }));
}

// ── Grammar progress ─────────────────────────────────────────────────────────
// Grammar FSRS state mirrors the vocab flow but lives in its own store:
//   - Guest/free users: localStorage under 'grammar-<questionId>'
//   - Plus users: the grammar_progress Supabase table (one row per user+question)
// Maps are keyed by GrammarQuestion.id (not the 'grammar-' prefixed key) so the
// session components can look up progress directly by question.id.

interface GrammarProgressRow {
  question_id: string;
  topic: string;
  cefr: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
  seen_count: number;
  last_seen: string;
}

function toGrammarRow(question: GrammarQuestion, p: CardProgress): GrammarProgressRow {
  return {
    question_id: question.id,
    topic: question.topic,
    cefr: question.cefr,
    due: p.fsrs.due instanceof Date ? p.fsrs.due.toISOString() : String(p.fsrs.due),
    stability: p.fsrs.stability,
    difficulty: p.fsrs.difficulty,
    elapsed_days: p.fsrs.elapsed_days,
    scheduled_days: p.fsrs.scheduled_days,
    learning_steps: p.fsrs.learning_steps,
    reps: p.fsrs.reps,
    lapses: p.fsrs.lapses,
    state: p.fsrs.state,
    last_review: p.fsrs.last_review
      ? p.fsrs.last_review instanceof Date
        ? p.fsrs.last_review.toISOString()
        : String(p.fsrs.last_review)
      : null,
    seen_count: p.seenCount,
    last_seen: p.lastSeen
  };
}

function fromGrammarRow(row: GrammarProgressRow): CardProgress {
  return {
    fsrs: {
      due: new Date(row.due),
      stability: row.stability,
      difficulty: row.difficulty,
      elapsed_days: row.elapsed_days,
      scheduled_days: row.scheduled_days,
      learning_steps: row.learning_steps,
      reps: row.reps,
      lapses: row.lapses,
      state: row.state,
      last_review: row.last_review ? new Date(row.last_review) : undefined
    },
    seenCount: row.seen_count,
    lastSeen: row.last_seen,
    // level/category reuse the CardProgress shape; for grammar they carry the
    // CEFR level and topic respectively (not vocab Category values).
    level: row.cefr as CardProgress['level'],
    category: row.topic as unknown as CardProgress['category']
  };
}

/**
 * Loads grammar progress from localStorage. Guest/free users only.
 * Returns a map keyed by GrammarQuestion.id.
 */
export function loadGrammarProgressMap(): Record<string, CardProgress> {
  const map: Record<string, CardProgress> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(GRAMMAR_LS_PREFIX)) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as CardProgress;
          parsed.fsrs.due = new Date(parsed.fsrs.due);
          if (parsed.fsrs.last_review) {
            parsed.fsrs.last_review = new Date(parsed.fsrs.last_review);
          }
          map[key.slice(GRAMMAR_LS_PREFIX.length)] = parsed;
        }
      } catch {
        // Ignore malformed entries
      }
    }
  }
  return map;
}

/**
 * Fetches all grammar_progress rows for a Plus user, keyed by question_id.
 * Called on mount for Plus users instead of loadGrammarProgressMap.
 */
export async function loadGrammarProgressFromSupabase(
  userId: string
): Promise<Record<string, CardProgress>> {
  const { data, error } = await supabase.from('grammar_progress').select('*').eq('user_id', userId);

  if (error || !data) return {};

  const map: Record<string, CardProgress> = {};
  for (const row of data as GrammarProgressRow[]) {
    map[row.question_id] = fromGrammarRow(row);
  }
  return map;
}

// ── Due-only grammar review (Fix 3, due-only-review-update.md) ─────────────

export interface GetDueGrammarItemsOptions {
  /** Restrict to one CEFR level. Omit for a global (all-levels) session. */
  level?: CEFRLevel;
  /**
   * Restrict to one grammar topic. Used by the per-topic due badge deep
   * link (LevelStatRows.svelte, reviewType="grammar").
   *
   * Without `resolve`, this compares against the STORED `CardProgress.category`
   * snapshot, which is stale for any card last reviewed before the Phase 1b
   * topic reorganisation (grammar-update.md). Pass `resolve` whenever `topic`
   * (or `level`) is set.
   */
  topic?: GrammarTopic;
  /**
   * Live id -> { topic, level } resolver, normally `resolveGrammarQuestion`
   * from `$lib/grammar/id-index`. When given, topic/level filtering and the
   * returned `level` use the question's CURRENT values instead of the stored
   * snapshot, and ids that no longer exist in grammar.json are dropped.
   *
   * Injected rather than imported here because the id index is ~3,000 entries
   * and progress.ts is bundled into nearly every flashcard/quiz route (same
   * reasoning as getDueItems() above).
   */
  resolve?: (id: string) => { topic: string; level: CEFRLevel } | undefined;
}

/**
 * Grammar's due-item shape, kept separate from vocab's `DueItem` (Phase 3,
 * permanent-structural-fix.md). `/api/review-grammar-entries` groups by the
 * client-supplied `level`, so it must be the question's real level: callers
 * that can, pass `resolve` to getDueGrammarItems() so it is resolved live.
 * Don't reuse `DueItem` for this: it lost `level` in Phase 3 specifically
 * because trusting a stored level for *vocab* was unsafe; sharing the type
 * anyway is what broke this file's svelte-check once already (2026-09-26).
 */
export interface DueGrammarItem {
  id: string;
  level: CEFRLevel;
}

/**
 * Returns every due grammar card in `progressMap` as the minimal
 * `{ id, level }` shape `/api/review-grammar-entries` expects, optionally
 * narrowed to one level and/or one topic. Mirrors getDueItems() above but
 * for the grammar progress map (keyed by GrammarQuestion.id).
 *
 * With `opts.resolve`, level/topic come from the live id index; without it,
 * from the stored `CardProgress.level` / `.category` snapshot (may be stale
 * after topic reorganisations).
 *
 * New/never-studied questions (no progress row) are never included —
 * "due" here means an existing FSRS schedule whose due date has passed,
 * same as getDueItems().
 */
export function getDueGrammarItems(
  progressMap: Record<string, CardProgress>,
  opts: GetDueGrammarItemsOptions = {}
): DueGrammarItem[] {
  const { level, topic, resolve } = opts;
  const now = new Date();

  const items: DueGrammarItem[] = [];
  for (const [id, card] of Object.entries(progressMap)) {
    if (new Date(card.fsrs.due) > now) continue;

    let cardLevel: CEFRLevel = card.level;
    let cardTopic = card.category as unknown as string;
    if (resolve) {
      const live = resolve(id);
      if (!live) continue; // question no longer exists
      cardLevel = live.level;
      cardTopic = live.topic;
    }

    if (level && cardLevel !== level) continue;
    if (topic && cardTopic !== topic) continue;
    items.push({ id, level: cardLevel });
  }
  return items;
}

/**
 * Result of saveGrammarProgress: the updated in-memory map (always updated, so the
 * session keeps working) plus whether the write to persistent storage succeeded.
 */
export interface GrammarSaveResult {
  progress: Record<string, CardProgress>;
  /** false when the Supabase upsert or the localStorage write failed. */
  saved: boolean;
}

/**
 * Computes the next FSRS state for a grammar question and persists it.
 * Plus users (userId present) write to grammar_progress; guest/free users
 * write to localStorage. Returns the updated map keyed by question.id and
 * whether persistence succeeded (the map is updated either way).
 */
export async function saveGrammarProgress(
  question: GrammarQuestion,
  rating: FSRSRating,
  progressMap: Record<string, CardProgress>,
  userId?: string | null,
  retention?: number | null
): Promise<GrammarSaveResult> {
  const now = new Date();
  const existing = progressMap[question.id] ?? null;
  const card = existing ? existing.fsrs : createEmptyCard(now);

  // Retention presets apply to Plus users only; guests and free users use the default.
  const fsrs = getFsrs(userId ? retention : null);
  const result = fsrs.next(card, now, RATING_MAP[rating]);

  const updated: CardProgress = {
    fsrs: result.card,
    seenCount: (existing?.seenCount ?? 0) + 1,
    lastSeen: now.toISOString(),
    lastRating: rating,
    level: question.cefr,
    category: question.topic as unknown as CardProgress['category']
  };

  if (userId) {
    // Plus: grammar_progress table only — no localStorage
    void recordStudyDay(userId);
    let saved = true;
    try {
      const { error } = await supabase
        .from('grammar_progress')
        .upsert(
          { user_id: userId, ...toGrammarRow(question, updated) },
          { onConflict: 'user_id,question_id' }
        );
      if (error) {
        saved = false;
        console.error('saveGrammarProgress: upsert failed', error);
      }
    } catch (error) {
      // In-memory map is still correct for this session
      saved = false;
      console.error('saveGrammarProgress: upsert threw', error);
    }
    return { progress: { ...progressMap, [question.id]: updated }, saved };
  } else {
    // Guest / free: localStorage only
    let saved = true;
    try {
      localStorage.setItem(GRAMMAR_LS_PREFIX + question.id, JSON.stringify(updated));
    } catch (error) {
      // Quota or private mode: keep the session working with the in-memory map
      saved = false;
      console.error('saveGrammarProgress: localStorage write failed', error);
    }
    return { progress: { ...progressMap, [question.id]: updated }, saved };
  }
}

// ── Streak + activity helpers ────────────────────────────────────────────────

/**
 * Returns today's date as a YYYY-MM-DD string in the user's local timezone.
 */
export function todayLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Counts the current streak from localStorage lastSeen values.
 * Used for guest/free users only.
 */
export function getStreakFromLocalStorage(progressMap: Record<string, CardProgress>): number {
  const studiedDates = new Set<string>();
  for (const p of Object.values(progressMap)) {
    if (p.lastSeen) {
      const d = new Date(p.lastSeen);
      studiedDates.add(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      );
    }
  }

  let streak = 0;
  const cursor = new Date();
  const todayStr = todayLocalDate();
  if (!studiedDates.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (!studiedDates.has(dateStr)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/**
 * Upserts a study_days row for today. Fire-and-forget, Plus users only.
 */
export async function recordStudyDay(userId: string): Promise<void> {
  try {
    const today = todayLocalDate();
    await supabase.rpc('upsert_study_day', { p_user_id: userId, p_day: today });
  } catch {
    // Silent failure
  }
}

/**
 * Fetches all study_days rows for a Plus user.
 */
export async function loadStudyDays(userId: string): Promise<Record<string, number>> {
  const { data } = await supabase.from('study_days').select('day, cards').eq('user_id', userId);
  const result: Record<string, number> = {};
  if (data) {
    for (const row of data as { day: string; cards: number }[]) {
      result[row.day] = row.cards;
    }
  }
  return result;
}

export interface ActivityCell {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export function buildActivityGrid(studyDays: Record<string, number>, weeks = 26): ActivityCell[] {
  const cells: ActivityCell[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayOfWeek = today.getDay() || 7;
  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - (dayOfWeek - 1));

  const startDate = new Date(startOfThisWeek);
  startDate.setDate(startOfThisWeek.getDate() - (weeks - 1) * 7);

  const cursor = new Date(startDate);
  while (cursor <= today) {
    const wd = cursor.getDay();
    const isoWeekday = (wd === 0 ? 7 : wd) as ActivityCell['weekday'];

    const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    const count = studyDays[dateStr] ?? 0;
    const level: ActivityCell['level'] =
      count === 0 ? 0 : count <= 5 ? 1 : count <= 15 ? 2 : count <= 30 ? 3 : 4;

    cells.push({ date: dateStr, count, level, weekday: isoWeekday });
    cursor.setDate(cursor.getDate() + 1);
  }

  return cells;
}

// ── Rating preview ───────────────────────────────────────────────────────────

export interface ScheduledIntervals {
  again: string;
  hard: string;
  good: string;
  easy: string;
}

export function previewIntervals(
  existing: CardProgress | null,
  now: Date,
  fsrsInstance?: FSRS
): ScheduledIntervals {
  const f = fsrsInstance ?? DEFAULT_FSRS;
  const card = existing ? { ...existing.fsrs, due: now, last_review: now } : createEmptyCard(now);

  const labels = {} as Record<FSRSRating, string>;
  for (const [r, grade] of Object.entries(RATING_MAP) as [FSRSRating, Grade][]) {
    const result = f.next(card, now, grade);
    labels[r] = formatInterval(result.card.due, now);
  }
  return labels as ScheduledIntervals;
}

function formatInterval(due: Date, now: Date): string {
  const diffMs = due.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.round(diffMs / 3_600_000);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.round(diffMs / 86_400_000);
  if (diffDays < 30) return `${diffDays}d`;
  const diffMonths = Math.round(diffDays / 30);
  return `${diffMonths}mo`;
}

// ── Free → Plus migration ──────────────────────────────────────────────────

/**
 * One-time migration: copies progress from localStorage into Supabase.
 * Called on login for Plus users when Supabase has zero rows (i.e. the user
 * has just upgraded from free). After a successful upsert, clears the
 * localStorage keys so the migration never runs again on this device.
 *
 * localStorage keys are 'progress-<vocabId|norsk>'. The key itself becomes
 * vocab_id in the DB row; the norsk field is back-filled from the key as a
 * best-effort fallback (sufficient for legacy keys that ARE the norsk value).
 * When vocab entries have a proper id the key will be the id, not norsk, but
 * norsk is only needed until migration 017 drops that column.
 */
export async function migrateLocalProgressToSupabase(
  userId: string,
  allEntries: VocabEntry[] = []
): Promise<void> {
  const localMap = await loadProgressMap();
  if (Object.keys(localMap).length === 0) return;

  // Build a lookup from vocabKey → VocabEntry so we can pass the full entry
  // to toRow() (which needs entry.norsk separately from entry.id).
  const entryByKey = new Map<string, VocabEntry>();
  for (const e of allEntries) {
    entryByKey.set(vocabKey(e), e);
  }

  const rows = Object.entries(localMap).map(([key, progress]) => {
    const entry = entryByKey.get(key);
    if (entry) {
      return { user_id: userId, ...toRow(entry, progress) };
    }
    // Fallback for legacy keys that are the norsk value (pre-id localStorage).
    // vocab_id gets the key value; level/category come from progress.
    return {
      user_id: userId,
      vocab_id: key,
      level: progress.level,
      category: progress.category,
      due:
        progress.fsrs.due instanceof Date
          ? progress.fsrs.due.toISOString()
          : String(progress.fsrs.due),
      stability: progress.fsrs.stability,
      difficulty: progress.fsrs.difficulty,
      elapsed_days: progress.fsrs.elapsed_days,
      scheduled_days: progress.fsrs.scheduled_days,
      learning_steps: progress.fsrs.learning_steps,
      reps: progress.fsrs.reps,
      lapses: progress.fsrs.lapses,
      state: progress.fsrs.state,
      last_review: progress.fsrs.last_review
        ? progress.fsrs.last_review instanceof Date
          ? progress.fsrs.last_review.toISOString()
          : String(progress.fsrs.last_review)
        : null,
      seen_count: progress.seenCount,
      last_seen: progress.lastSeen
    };
  });

  const { error } = await supabase
    .from('card_progress')
    .upsert(rows, { onConflict: 'user_id,vocab_id' });

  if (!error) {
    clearUserProgress(); // remove progress-* keys from localStorage
  }
}

// ── Undo helpers (guest / free users) ───────────────────────────────────────

/**
 * Restores a previous card state to localStorage.
 * Only called for guest/free users — Plus users restore via Supabase upsert
 * in the component's undo() handler.
 */
export function restoreProgressToLocalStorage(
  entry: VocabEntry,
  previousProgress: CardProgress | null
): void {
  const key = LS_PREFIX + vocabKey(entry);
  if (previousProgress === null) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, JSON.stringify(previousProgress));
  }
}
