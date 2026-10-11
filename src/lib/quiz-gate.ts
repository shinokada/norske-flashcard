// src/lib/quiz-gate.ts
// The one rule for which vocab / uttrykk entries a visitor may receive from the
// server for the quiz (ai-docs/implementation/quiz-server-gating.md, Phase 1).
//
// Plus gets everything. Free and guest users get an entry only when BOTH
// predicates allow it:
//   - isFreeQuizCategory(level, category): the quiz category policy (A1 in
//     full, three categories per level above, see FREE_QUIZ_CATEGORIES), and
//   - !isPlusOnlyEntry(level, category, type): the entry-level policy that
//     review and the uttrykk gate already use (A2 to B2 uttrykk is Plus, even
//     when its category slug, e.g. `money`, is a free vocab category).
//
// Both are needed. The quiz page used to check only the first one, so a free
// user quizzing A2 `money` also got the A2 uttrykk entries of that category.
// An entry whose category is not in CATEGORIES_BY_LEVEL is locked above A1
// (isFreeQuizCategory), never free by default.
//
// `VocabEntry` carries no vocab/uttrykk marker, so the caller passes `type`
// (it knows which file the entries came from).
//
// Pure and side-effect free. `entriesForPlan` and `selectQuizEntries` run on the
// server only: by the time a component calls them, the entries have already been
// downloaded. `quizPoolSize` works on counts, not content, so the page uses it too.

import type { CEFRLevel, VocabEntry } from '$lib/types';
import { isFreeQuizCategory, isPlusOnlyEntry } from '$lib/access';

export type QuizEntryType = 'vocab' | 'uttrykk';

/** Whether a free or guest user may receive this entry in the quiz. */
export function isQuizEntryFree(
  entry: Pick<VocabEntry, 'level' | 'category'>,
  type: QuizEntryType
): boolean {
  return (
    isFreeQuizCategory(entry.level, entry.category) &&
    !isPlusOnlyEntry(entry.level, entry.category, type)
  );
}

/**
 * The entries this plan may receive. Keeps the input order, never mutates
 * `entries`. Plus: all. Free and guest: only `isQuizEntryFree`.
 */
export function entriesForPlan(
  entries: readonly VocabEntry[],
  type: QuizEntryType,
  isPlus: boolean
): VocabEntry[] {
  if (isPlus) return [...entries];
  return entries.filter((e) => isQuizEntryFree(e, type));
}

// ── Quiz payload (POST /api/quiz-entries) and picker counts ────────────────────────────────────

/** One source file of quiz entries: the vocab or the uttrykk file of one level. */
export interface QuizSource {
  level: CEFRLevel;
  type: QuizEntryType;
  entries: readonly VocabEntry[];
}

/** Per level and category: how many quizable entries each source has. No content. */
export interface QuizCategoryCount {
  level: CEFRLevel;
  category: VocabEntry['category'];
  vocab: number;
  uttrykk: number;
}

/** What the quiz needs for one session: the pool to quiz on and extra answer options. */
export interface QuizPayload {
  entries: VocabEntry[];
  distractors: VocabEntry[];
}

const LEVEL_ORDER: readonly CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C'];

/**
 * Same rule as `isQuizable` in `$lib/quiz`: B2 and C questions are monolingual, so an
 * entry there needs a `definition`. Repeated here so server code does not have to
 * import `$lib/quiz` (which pulls in the Supabase client); `quiz-gate.test.ts` checks
 * the two agree on every real entry.
 */
export function isQuizableEntry(entry: Pick<VocabEntry, 'level' | 'definition'>): boolean {
  const monolingual = entry.level === 'B2' || entry.level === 'C';
  return !monolingual || !!entry.definition;
}

/** Counts of quizable entries per level and category, in level then category order. */
export function countQuizEntries(sources: readonly QuizSource[]): QuizCategoryCount[] {
  const byKey = new Map<string, QuizCategoryCount>();
  for (const source of sources) {
    for (const e of source.entries) {
      if (!isQuizableEntry(e)) continue;
      const key = `${e.level}|${e.category}`;
      let row = byKey.get(key);
      if (!row) {
        row = { level: e.level, category: e.category, vocab: 0, uttrykk: 0 };
        byKey.set(key, row);
      }
      row[source.type]++;
    }
  }
  return [...byKey.values()].sort(
    (a, b) =>
      LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) ||
      a.category.localeCompare(b.category)
  );
}

/**
 * How many quizable entries a plan can quiz on for a level (and optionally one
 * category), from the counts alone. Same rule as `selectQuizEntries`.
 */
export function quizPoolSize(
  counts: readonly QuizCategoryCount[],
  level: string,
  category: string,
  isPlus: boolean
): number {
  let n = 0;
  for (const c of counts) {
    if (c.level !== level) continue;
    if (category && c.category !== category) continue;
    if (isPlus) {
      n += c.vocab + c.uttrykk;
      continue;
    }
    if (isQuizEntryFree(c, 'vocab')) n += c.vocab;
    if (isQuizEntryFree(c, 'uttrykk')) n += c.uttrykk;
  }
  return n;
}

/**
 * The payload for one quiz session. `entries` is every quizable entry the plan may
 * receive for the level (and category, when given). `distractors` is the rest of
 * that level's quizable, accessible entries, only when a category narrows the pool
 * (otherwise `entries` already covers them). Distractors follow the same gate, so a
 * locked word is never offered as an answer option. A level with no accessible
 * entries in the chosen category returns nothing at all.
 *
 * Answer options come from the same level only: every level has far more than the
 * three distractors a question needs (checked in `quiz-gate.test.ts`).
 */
export function selectQuizEntries(
  sources: readonly QuizSource[],
  level: CEFRLevel,
  category: string | undefined,
  isPlus: boolean
): QuizPayload {
  const accessible = sources
    .filter((s) => s.level === level)
    .flatMap((s) => entriesForPlan(s.entries, s.type, isPlus))
    .filter((e) => e.level === level && isQuizableEntry(e));

  const entries = category ? accessible.filter((e) => e.category === category) : accessible;
  if (entries.length === 0) return { entries: [], distractors: [] };

  const inPool = new Set(entries);
  const distractors = category ? accessible.filter((e) => !inPool.has(e)) : [];
  return { entries, distractors };
}
