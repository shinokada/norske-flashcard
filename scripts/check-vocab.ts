#!/usr/bin/env tsx
/**
 * check-vocab.ts
 *
 * Validates all vocab-{level}.json files in src/lib/data against the
 * canonical rules for VocabEntry IDs and norsk/lemma field formatting.
 *
 * Rules checked:
 *   1. ID format    — must be w-{NNNNNN} (6-digit zero-padded, global — shared with uttrykk,
 *                     no level, category, or type segment; see id-new-format.md Round 3)
 *   2. ID uniqueness — no duplicates within or across files
 *   3. level field  — must match file's CEFR level (case-insensitive)
 *   4. category     — must be in CATEGORIES_BY_LEVEL for that level
 *   5. part         — must be a known PartOfSpeech value
 *   6. norsk field  — formatting rules per part of speech:
 *        noun   → "word (en|et|ei)" for singular, "word (pl.)" / "word (b.pl.)" for a plural-form card,
 *                  or "word (ubøy.)" if the noun is indeclinable (no gender/plural/bestemt form)
 *        verb   → starts with "å "
 *        other  → no "å " prefix, no gender/plural/ubøy. parenthetical
 *   7. lemma field  — must be plain dictionary form (no å prefix, no gender, no plural marker, no ubøy. marker):
 *        verb   → bare infinitive, e.g. "få"  (NOT "å få")
 *        noun   → bare singular word, e.g. "bok" (NOT "hus (et)" and NOT "bøker" even for a plural card)
 *        other  → bare word,       e.g. "glad"
 *   8. Required fields present (norsk, english, example, example_english, level, category, part)
 *   9. Language consistency — for each translation language present (ukrainian, spanish,
 *      german, romanian, …), the matching example_{lang} field must also be present and
 *      non-empty, and vice-versa.
 *  10. Translation coverage — warns if an entry is missing a language that other entries
 *      in the same file have.
 *  11. sense field — optional short gloss (trimmed, lowercase, no parentheses, 1-3 words,
 *      ~25 chars). Entries sharing an identical `norsk` must each have a distinct sense:
 *      a group with some senses but missing/duplicate ones is an error; a legacy group
 *      with none is a warning (an error in --draft mode, where it is a new entry).
 *      Only the vocab files being checked are grouped (+ production as context in --draft).
 *  12. kind field — uttrykk only (data-rules/vocab-and-uttrykk-v2.md): a vocab entry must
 *      not have one. Catches a leftover `kind` after an uttrykk → vocab move.
 *
 * NOTE: "numeral" appears in vocab-a1.json (numbers category) but is not in
 * types.ts PartOfSpeech. It is treated as a warning, not an error, so you can
 * decide whether to add it to the type or reclassify those entries.
 *
 * Usage:
 *   npx tsx scripts/check-vocab.ts           # check all vocab files
 *   npx tsx scripts/check-vocab.ts a1        # check only vocab-a1.json
 *   npx tsx scripts/check-vocab.ts a1 a2     # check multiple levels
 *   npx tsx scripts/check-vocab.ts --strict  # exit 1 if any errors found
 *   npx tsx scripts/check-vocab.ts --draft    # check draft/{level}/vocab-{level}-new.json instead
 *   npx tsx scripts/check-vocab.ts c --draft  # check only draft/c/vocab-c-new.json
 *   --data-dir=<dir> / --draft-dir=<dir>      # read from another tree (used by the fixture test)
 *
 * --draft mode (Step 3B in work-flow.md, run BEFORE Step 4 assigns real IDs):
 *   - Reads draft/{level}/vocab-{level}-new.json instead of src/lib/data/vocab-{level}.json
 *   - Entries with id === "" are expected (IDs aren't assigned until Step 4) and are not
 *     flagged as errors; a non-empty id is still validated against the normal ID format.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { CATEGORIES_BY_LEVEL as CATEGORIES_BY_LEVEL_RAW } from '../src/lib/config.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Value of a `--name=value` CLI flag, or undefined. */
function flagValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
  if (hit === undefined) return undefined; // flag absent: caller uses its default
  const value = hit.slice(prefix.length);
  if (!value) {
    // Present but empty (`--data-dir=`) is a usage error; resolve('') would silently mean the CWD.
    console.error(`--${name} requires a non-empty value`);
    process.exit(2);
  }
  return value;
}

// Defaults are the real data; the flags exist so the fixture test
// (src/lib/check-scripts.test.ts) can run this script against a throwaway tree.
const DATA_DIR = resolve(flagValue('data-dir') ?? join(__dirname, '../src/lib/data'));
const DRAFT_DIR = resolve(flagValue('draft-dir') ?? join(__dirname, '../draft'));

// ── Config (real import from config.ts, keys lower-cased — no more
// hand-copied constant that can silently drift out of sync) ──────────────────

const CATEGORIES_BY_LEVEL: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(CATEGORIES_BY_LEVEL_RAW).map(([level, cats]) => [level.toLowerCase(), cats])
);

// Parts declared in types.ts PartOfSpeech
const VALID_PARTS = new Set([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'numeral',
  'preposition',
  'conjunction',
  'interjection',
  'phrase'
]);

// Parts used in data but NOT yet in types.ts — flagged as warnings
const UNOFFICIAL_PARTS = new Set([]);

const REQUIRED_FIELDS = [
  'norsk',
  'english',
  'example',
  'example_english',
  'level',
  'category',
  'part'
];

// All translation languages the app supports.
const KNOWN_LANGUAGES = [
  'ukrainian',
  'spanish',
  'german',
  'romanian',
  'french',
  'polish',
  'arabic',
  'turkish',
  'dutch',
  'italian'
];

const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c'];

// ── Filters from CLI ──────────────────────────────────────────────────────────

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const STRICT = process.argv.includes('--strict');
const DRAFT = process.argv.includes('--draft');
const targetLevels = args.length > 0 ? args.map((a) => a.toLowerCase()) : LEVELS;

// ── Validators ────────────────────────────────────────────────────────────────

const ID_PATTERN = /^w-(\d{6,})$/;

function checkIdFormat(id) {
  const errors = [];
  const m = id.match(ID_PATTERN);
  if (!m) {
    errors.push(`ID "${id}" does not match w-{NNNNNN} format`);
  }
  return errors;
}

/** Gender parenthetical: (en), (et), (ei), or combinations */
const GENDER_PATTERN = /\s*\((en|et|ei|en\/ei|en\/et|en\/men|en\/ei\/et)\)$/i;
/** Plural parenthetical: (pl.) = ubestemt flertall, (b.pl.) = bestemt flertall */
const PLURAL_PATTERN = /\s*\((b\.)?pl\.\)$/i;
/** Indeclinable parenthetical: (ubøy.) = ubøyelig — noun takes no gender/plural/bestemt inflection at all */
const UBOYELIG_PATTERN = /\s*\(ubøy\.\)$/i;
/** Verb prefix */
const VERB_PREFIX = /^å\s/;

function checkNorsk(norsk, part) {
  const errors = [];
  switch (part) {
    case 'noun':
      if (
        !GENDER_PATTERN.test(norsk) &&
        !PLURAL_PATTERN.test(norsk) &&
        !UBOYELIG_PATTERN.test(norsk)
      ) {
        errors.push(
          `noun norsk "${norsk}" should end with gender, e.g. "hus (et)", a plural marker, e.g. "bøker (pl.)" / "bøkene (b.pl.)", or (ubøy.) if the noun is indeclinable`
        );
      }
      break;
    case 'verb':
      if (!VERB_PREFIX.test(norsk)) {
        errors.push(`verb norsk "${norsk}" should start with "å ", e.g. "å få"`);
      }
      break;
    default:
      // adjective, adverb, phrase, numeral, etc. — no prefix, gender, plural, or indeclinable marker expected
      if (VERB_PREFIX.test(norsk)) {
        errors.push(`${part} norsk "${norsk}" should not start with "å " (only verbs use this)`);
      }
      if (GENDER_PATTERN.test(norsk) && part !== 'phrase') {
        errors.push(`${part} norsk "${norsk}" has gender parenthetical — is the part wrong?`);
      }
      if (PLURAL_PATTERN.test(norsk)) {
        errors.push(`${part} norsk "${norsk}" has a plural marker — only nouns use (pl.)/(b.pl.)`);
      }
      if (UBOYELIG_PATTERN.test(norsk)) {
        errors.push(`${part} norsk "${norsk}" has (ubøy.) — only nouns use this marker`);
      }
      break;
  }
  return errors;
}

/**
 * lemma must be plain dictionary form — no "å" prefix, no gender marker.
 * verb  → bare infinitive e.g. "få"   (NOT "å få")
 * noun  → bare word       e.g. "hus"  (NOT "hus (et)")
 * other → bare word       e.g. "glad"
 */
function checkLemma(entry) {
  const warnings = [];
  if (!entry.lemma) {
    warnings.push(`lemma field is missing`);
    return warnings;
  }
  // Verb lemma must NOT have "å "
  if (entry.part === 'verb' && VERB_PREFIX.test(entry.lemma)) {
    warnings.push(
      `verb lemma "${entry.lemma}" should be bare infinitive without "å", e.g. "${entry.lemma.replace(/^å\s+/, '')}"`
    );
  }
  // Noun lemma must NOT have gender
  if (entry.part === 'noun' && GENDER_PATTERN.test(entry.lemma)) {
    warnings.push(
      `noun lemma "${entry.lemma}" should be bare word without gender, e.g. "${entry.lemma.replace(GENDER_PATTERN, '').trim()}"`
    );
  }
  // Noun lemma must NOT have a plural marker — plural cards' lemma is still the bare singular
  if (entry.part === 'noun' && PLURAL_PATTERN.test(entry.lemma)) {
    warnings.push(
      `noun lemma "${entry.lemma}" should be the bare singular dictionary form, not a plural, e.g. "${entry.lemma.replace(PLURAL_PATTERN, '').trim()}"`
    );
  }
  // Noun lemma must NOT have the indeclinable marker — lemma is always the bare word
  if (entry.part === 'noun' && UBOYELIG_PATTERN.test(entry.lemma)) {
    warnings.push(
      `noun lemma "${entry.lemma}" should be the bare word without (ubøy.), e.g. "${entry.lemma.replace(UBOYELIG_PATTERN, '').trim()}"`
    );
  }
  // Lemma should not be identical to norsk (which includes å/gender/plural/ubøy.) — likely copy-paste error
  if (
    entry.lemma === entry.norsk &&
    (VERB_PREFIX.test(entry.norsk) ||
      GENDER_PATTERN.test(entry.norsk) ||
      PLURAL_PATTERN.test(entry.norsk) ||
      UBOYELIG_PATTERN.test(entry.norsk))
  ) {
    warnings.push(
      `lemma "${entry.lemma}" is identical to norsk — lemma should be the bare dictionary form`
    );
  }
  return warnings;
}

/**
 * sense must be a short disambiguating gloss: trimmed, lowercase, no parentheses,
 * 1-3 words, ~25 chars max. Returns { errors, warnings } (length/word-count are
 * soft limits — "~25" / "1-3" in the design doc — so they only warn).
 */
function checkSense(entry) {
  const errors = [];
  const warnings = [];
  if (entry.sense === undefined) return { errors, warnings };
  if (typeof entry.sense !== 'string' || entry.sense.trim() === '') {
    errors.push('sense must be a non-empty string when present');
    return { errors, warnings };
  }
  const s = entry.sense;
  if (s !== s.trim()) errors.push(`sense "${s}" has leading/trailing whitespace`);
  if (s !== s.toLowerCase()) errors.push(`sense "${s}" must be lowercase`);
  if (/[()]/.test(s)) errors.push(`sense "${s}" must not contain parentheses`);
  if (s.length > 25) warnings.push(`sense "${s}" is longer than ~25 characters`);
  if (s.trim().split(/\s+/).length > 3) warnings.push(`sense "${s}" is longer than 3 words`);
  return { errors, warnings };
}

// ── Main ──────────────────────────────────────────────────────────────────────

let totalErrors = 0;
let totalWarnings = 0;
const globalIds = new Map(); // id → filename
// Every entry seen, for the cross-entry `sense` check after the main loop.
// `checked` = entry belongs to a file being validated (vs. production context
// loaded only so drafts are compared against it in --draft mode).
const senseGroupPool = [];

for (const level of LEVELS) {
  if (!targetLevels.includes(level)) continue;

  const filename = DRAFT ? `vocab-${level}-new.json` : `vocab-${level}.json`;
  const filepath = DRAFT ? join(DRAFT_DIR, level, filename) : join(DATA_DIR, filename);
  let entries;
  try {
    entries = JSON.parse(readFileSync(filepath, 'utf8'));
  } catch (err) {
    if (DRAFT && err.code === 'ENOENT') {
      console.log(`\n⏭️   ${filename} not found — skipping`);
      continue;
    }
    console.error(`❌  Could not read ${filename}: ${err.message}`);
    totalErrors++;
    continue;
  }

  const validCats = new Set(CATEGORIES_BY_LEVEL[level]);
  let fileErrors = 0;
  let fileWarnings = 0;
  let unassignedIdCount = 0;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📄  ${filename}  (${entries.length} entries)`);
  console.log(`${'─'.repeat(60)}`);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const loc = `[${i}] id=${entry.id ?? '(missing)'}`;
    const errs = [];
    const warns = [];

    // Required fields
    for (const field of REQUIRED_FIELDS) {
      if (!entry[field]) errs.push(`missing required field "${field}"`);
    }

    // ID format
    if (entry.id) {
      errs.push(...checkIdFormat(entry.id));
      // Global uniqueness
      if (globalIds.has(entry.id)) {
        errs.push(`duplicate ID — also in ${globalIds.get(entry.id)}`);
      } else {
        globalIds.set(entry.id, filename);
      }
    } else if (DRAFT) {
      // Draft entries are expected to have id: "" until Step 4 assigns real IDs —
      // counted below and reported once per file instead of once per entry.
      unassignedIdCount++;
    } else {
      errs.push('missing id field');
    }

    // level field
    if (entry.level && entry.level.toLowerCase() !== level) {
      errs.push(`level field "${entry.level}" does not match file level "${level.toUpperCase()}"`);
    }

    // category
    if (entry.category && !validCats.has(entry.category)) {
      errs.push(`category "${entry.category}" not in CATEGORIES_BY_LEVEL[${level.toUpperCase()}]`);
    }

    // part of speech
    if (entry.part) {
      if (UNOFFICIAL_PARTS.has(entry.part)) {
        warns.push(
          `part "${entry.part}" is used in data but not declared in types.ts PartOfSpeech — consider adding it or reclassifying`
        );
      } else if (!VALID_PARTS.has(entry.part)) {
        errs.push(`unknown part "${entry.part}"`);
      }
    }

    // norsk formatting (skip for unofficial parts like numeral)
    if (entry.norsk && entry.part && !UNOFFICIAL_PARTS.has(entry.part)) {
      errs.push(...checkNorsk(entry.norsk, entry.part));
    }

    // lemma
    if (entry.part && !UNOFFICIAL_PARTS.has(entry.part)) {
      warns.push(...checkLemma(entry));
    }

    // sense format
    {
      const s = checkSense(entry);
      errs.push(...s.errors);
      warns.push(...s.warnings);
    }

    // kind belongs to uttrykk only; it must be removed when an entry moves to vocab
    if (entry.kind !== undefined) {
      errs.push(
        `vocab entry has a "kind" field (${JSON.stringify(entry.kind)}) — only uttrykk entries use it`
      );
    }

    senseGroupPool.push({ entry, filename, checked: true, index: i });

    // Language consistency: translation field and its example_{lang} must both be present
    for (const lang of KNOWN_LANGUAGES) {
      const hasTranslation = entry[lang] != null && entry[lang] !== '';
      const hasExample = entry[`example_${lang}`] != null && entry[`example_${lang}`] !== '';
      if (hasTranslation && !hasExample) {
        errs.push(`has "${lang}" translation but missing "example_${lang}"`);
      }
      if (!hasTranslation && hasExample) {
        warns.push(`has "example_${lang}" but missing "${lang}" translation`);
      }
    }

    if (errs.length > 0) {
      fileErrors += errs.length;
      for (const e of errs) console.log(`  ❌  ${loc}: ${e}`);
    }
    if (warns.length > 0) {
      fileWarnings += warns.length;
      for (const w of warns) console.log(`  ⚠️   ${loc}: ${w}`);
    }
  }

  // Translation coverage: warn for entries missing a language the file otherwise has
  const langsInFile = new Set();
  for (const e of entries) {
    for (const lang of KNOWN_LANGUAGES) {
      if (e[lang] != null && e[lang] !== '') langsInFile.add(lang);
    }
  }
  if (langsInFile.size > 0) {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const loc = `[${i}] id=${entry.id ?? '(missing)'}`;
      for (const lang of langsInFile) {
        if (!entry[lang] || entry[lang] === '') {
          fileWarnings++;
          console.log(
            `  ⚠️   ${loc}: missing "${lang}" translation (other entries in this file have it)`
          );
        }
      }
    }
  }

  if (unassignedIdCount > 0) {
    console.log(
      `\n  ℹ️   ${unassignedIdCount} entry(ies) have id: "" (expected pre-Step 4, not counted as errors)`
    );
  }

  const status = fileErrors === 0 ? '✅' : '❌';
  console.log(`\n${status}  ${filename}: ${fileErrors} error(s), ${fileWarnings} warning(s)`);
  totalErrors += fileErrors;
  totalWarnings += fileWarnings;
}

// ── Cross-entry check: identical `norsk` needs a distinct `sense` ─────────────
//
// Entries with the same (case-insensitive) `norsk` are separate senses of one
// word. Each must carry a distinct, non-empty `sense`.
//   - Group where NO entry has a sense: a warning for legacy homographs already in
//     production (until backfilled) — but an error if the group includes an entry
//     from a checked --draft file, since a new entry must either get a `sense` or
//     is a real duplicate (find_dupes.py).
//   - Group where SOME entry has a sense: missing or duplicate senses are errors.
// Scope: only the vocab files being checked (a single-level run sees only that
// level's groups). In --draft mode the production vocab files are also loaded, as
// context, so a draft is compared against the entry it shares `norsk` with.
// Uttrykk are not checked here (find_dupes.py covers them).

if (DRAFT) {
  for (const level of LEVELS) {
    const filename = `vocab-${level}.json`;
    try {
      const prod = JSON.parse(readFileSync(join(DATA_DIR, filename), 'utf8'));
      prod.forEach((entry, index) =>
        senseGroupPool.push({ entry, filename, checked: false, index })
      );
    } catch {
      // production file missing/unreadable — context only, ignore
    }
  }
}

{
  const groups = new Map();
  for (const item of senseGroupPool) {
    const key = (item.entry.norsk ?? '').trim().toLowerCase();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const label = (item) =>
    `${item.filename} id=${item.entry.id || '(unassigned)'}${item.entry.sense ? ` sense="${item.entry.sense}"` : ''}`;

  let groupErrors = 0;
  let groupWarnings = 0;
  const lines = [];

  for (const [key, items] of groups) {
    if (items.length < 2) continue;
    // In --draft mode only report groups that include a draft entry.
    if (DRAFT && !items.some((it) => it.checked)) continue;

    const senses = items.map((it) => (it.entry.sense ?? '').trim().toLowerCase());
    const anySense = senses.some(Boolean);
    const hasDraft = DRAFT && items.some((it) => it.checked);
    const members = items.map(label).join('; ');

    if (!anySense) {
      if (hasDraft) {
        groupErrors++;
        lines.push(
          `  ❌  norsk "${key}" appears ${items.length}× with no \`sense\` — add a distinct sense to each, or remove the duplicate: ${members}`
        );
      } else {
        groupWarnings++;
        lines.push(
          `  ⚠️   norsk "${key}" appears ${items.length}× with no \`sense\` (legacy homograph — backfill): ${members}`
        );
      }
      continue;
    }

    const missing = senses.filter((s) => !s).length;
    const distinct = new Set(senses.filter(Boolean)).size;
    const filled = senses.filter(Boolean).length;
    if (missing > 0) {
      groupErrors++;
      lines.push(
        `  ❌  norsk "${key}": ${missing} of ${items.length} entries lack a \`sense\`: ${members}`
      );
    } else if (distinct < filled) {
      groupErrors++;
      lines.push(`  ❌  norsk "${key}": duplicate \`sense\` values within the group: ${members}`);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🔀  Identical-norsk groups (sense check)`);
  console.log(`${'─'.repeat(60)}`);
  if (lines.length === 0) console.log('  ✅  none needing attention');
  else for (const l of lines) console.log(l);
  totalErrors += groupErrors;
  totalWarnings += groupWarnings;
}

console.log(`\n${'═'.repeat(60)}`);
console.log(
  `📊  Total: ${totalErrors} error(s), ${totalWarnings} warning(s) across ${targetLevels.length} file(s)`
);

if (STRICT && totalErrors > 0) {
  process.exit(1);
}
