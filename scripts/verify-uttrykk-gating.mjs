#!/usr/bin/env node
/**
 * verify-uttrykk-gating.mjs
 *
 * Phase 3, ai-docs/implementation/uttrykk-theme-category-unification.md.
 *
 * Read-only sanity check that the theme→category rename didn't change any
 * free/Plus gating outcome. `isFreeUttrykkTheme()` in uttrykk-gating.ts
 * never changed — it just takes a string — so this reproduces its logic
 * inline against FREE_UTTRYKK_THEMES (copied verbatim from
 * src/lib/uttrykk-gating.ts) and runs it over every *real* category value
 * now sitting in each level's uttrykk-{level}.json, plus flags any
 * leftover 'uttrykk' sentinel or 'theme' key (defense in depth — the
 * rename script already checked this, but cheap to re-check here too).
 *
 * Usage: node scripts/verify-uttrykk-gating.mjs
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../src/lib/data');

// Copied from src/lib/uttrykk-gating.ts — keep in sync if that file's
// values ever change. Updated 2026-10-14: under the free-tier simplification
// (ai-docs/implementation/free-tier-simplification.md) every level is empty;
// A1 is open in full through isFreeUttrykkTheme(), and A2–B2 uttrykk is
// Plus-only. The earlier copy (A2/B1/B2 themes) was stale and reported free
// entries that the app does not treat as free.
const FREE_UTTRYKK_THEMES = {
  A1: [],
  A2: [],
  B1: [],
  B2: []
};

function isFreeUttrykkTheme(level, theme) {
  if (level === 'A1') return true;
  if (!theme) return false;
  return FREE_UTTRYKK_THEMES[level].includes(theme);
}

const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;

const LEVELS = ['a1', 'a2', 'b1', 'b2'];
let anyIssue = false;

for (const level of LEVELS) {
  const levelUpper = level.toUpperCase();
  const dataPath = join(DATA_DIR, `uttrykk-${level}.json`);
  const entries = JSON.parse(readFileSync(dataPath, 'utf8'));

  // Defense in depth — the rename script already validated this.
  const badSentinel = entries.filter((e) => e.category === 'uttrykk');
  const leftoverTheme = entries.filter((e) => e.theme !== undefined);
  const invalidCategory = entries.filter(
    (e) => e.category !== 'uttrykk' && !isNonEmptyString(e.category)
  );
  if (badSentinel.length > 0 || leftoverTheme.length > 0 || invalidCategory.length > 0) {
    console.error(
      `❌ uttrykk-${level}.json: ${badSentinel.length} entr(y/ies) still have category:'uttrykk', ${leftoverTheme.length} still have a theme key, ${invalidCategory.length} have an invalid (empty/non-string) category.`
    );
    anyIssue = true;
    continue;
  }

  const counts = new Map();
  for (const e of entries) {
    counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  }

  const categories = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const totalEntries = entries.length;
  let freeEntries = 0;

  console.log(`\n${levelUpper} (${totalEntries} entries, ${categories.length} categories):`);
  for (const [category, count] of categories) {
    const free = isFreeUttrykkTheme(levelUpper, category);
    if (free) freeEntries += count;
    console.log(`  ${free ? '🟢 free' : '🔒 plus'}  ${category} (${count})`);
  }
  console.log(
    `  → ${freeEntries}/${totalEntries} entries free (${((freeEntries / totalEntries) * 100).toFixed(1)}%)`
  );

  // Sanity: every curated free theme for this level should actually exist
  // as a real category in the data — a typo here would silently grant zero
  // free entries at that level (covered generally by uttrykk-gating.test.ts
  // against UTTRYKK_THEMES_BY_LEVEL, but this checks against the *actual*
  // post-rename data specifically).
  for (const freeTheme of FREE_UTTRYKK_THEMES[levelUpper] ?? []) {
    if (!counts.has(freeTheme)) {
      console.error(
        `  ⚠️  "${freeTheme}" is in FREE_UTTRYKK_THEMES.${levelUpper} but no entry has that category!`
      );
      anyIssue = true;
    }
  }
}

if (anyIssue) {
  console.error('\nOne or more issues found — see above.');
  process.exit(1);
}

console.log('\n✅ No issues — gating data looks consistent with FREE_UTTRYKK_THEMES.');
