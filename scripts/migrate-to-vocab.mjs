#!/usr/bin/env node
/**
 * migrate-to-vocab.mjs
 *
 * Companion to migrate-type-a-to-uttrykk.mjs, for the reverse direction.
 *
 * Reads scripts/output/uttrykk-verb-classification.json (produced by
 * classify-uttrykk-verbs.mjs), takes all entries classified as
 * "move_to_vocab", removes them from their source uttrykk-xx.json file,
 * and appends them to the matching vocab-xx.json file with proper vocab
 * IDs and verb-formatted fields.
 *
 * What it does per migrated entry:
 *   - Removes entry from uttrykk-xx.json
 *   - Assigns a new sequential ID: v-{level}-{category}-{NNN}
 *     (category comes from suggested_category in the classification file;
 *     NNN continues from the highest existing number IN THAT CATEGORY)
 *   - Sets category → suggested_category, part → "verb"
 *   - Reformats norsk to the vocab verb convention: prefixes "å " if not
 *     already present (uttrykk stores bare infinitives; vocab verbs need
 *     the å-marker — see data-rules/vocab-and-uttrykk-v2.md)
 *   - lemma is left as-is (already bare infinitive, matches vocab's lemma rule)
 *   - All other fields (english, translations, example*) copied as-is
 *   - Writes a .bak backup of each modified file before touching it
 *
 * Usage:
 *   node scripts/migrate-to-vocab.mjs --dry-run   ← always try this first
 *   node scripts/migrate-to-vocab.mjs
 *
 * Options:
 *   --dry-run   Print what would happen without writing any files
 *   --ids       Comma-separated list of uttrykk IDs to migrate (overrides
 *               the move_to_vocab filter), e.g. --ids u-b1-014,u-b1-022
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'src/lib/data');
const CLASSIFICATION_FILE = path.join(
  PROJECT_ROOT,
  'scripts/output/uttrykk-verb-classification.json'
);

// ── Manual overrides ──────────────────────────────────────────────────────

// move_to_vocab entries to skip (keep in uttrykk — reclassified after
// dry-run review). Add IDs here as you review the report, same pattern as
// SKIP_IDS in migrate-type-a-to-uttrykk.mjs.
//
// The 11 below are same-phrase/same-level/same-category duplicates found in
// the 2026-07-10 dry-run (scripts/output/migrate-to-vocab.txt) — migrating
// both sides of each pair would create a literal duplicate vocab entry.
// u-b2-073 is the one exception introduced during borderline review (moved
// for consistency with u-b2-353, which turned out to already cover it —
// skipping u-b2-073 resolves that). The rest are pre-existing duplicate
// uttrykk entries, worth a separate find_dupes.py pass on the uttrykk files
// at some point.
const SKIP_IDS = new Set([
  'u-b1-307', // å bry seg om — dup of u-b1-016
  'u-b1-270', // å integrere seg — dup of u-b1-131
  'u-b2-073', // å forsørge seg selv — dup of u-b2-353
  'u-b2-329', // å begripe seg på — dup of u-b2-005
  'u-b2-330', // å benytte seg av — dup of u-b2-006
  'u-b2-412', // å henvende seg til — dup of u-b2-118
  'u-b2-418', // å innrette seg — dup of u-b2-153
  'u-b2-461', // å skjerpe seg — dup of u-b2-234
  'u-b2-474', // å stikke seg ut — dup of u-b2-248
  'u-b2-497', // å tilby seg — dup of u-b2-278
  'u-b2-506' // å vie seg til — dup of u-b2-298
]);

// ── CLI ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const idsArg = args.find((a) => a.startsWith('--ids='))?.split('=')[1];
const FILTER_IDS = idsArg ? new Set(idsArg.split(',').map((s) => s.trim())) : null;

// ── Level helpers ──────────────────────────────────────────────────────────

const LEVEL_MAP = {
  a1: { vocabFile: 'vocab-a1.json', uttrykFile: 'uttrykk-a1.json', levelField: 'A1' },
  a2: { vocabFile: 'vocab-a2.json', uttrykFile: 'uttrykk-a2.json', levelField: 'A2' },
  b1: { vocabFile: 'vocab-b1.json', uttrykFile: 'uttrykk-b1.json', levelField: 'B1' },
  b2: { vocabFile: 'vocab-b2.json', uttrykFile: 'uttrykk-b2.json', levelField: 'B2' },
  c: { vocabFile: 'vocab-c.json', uttrykFile: 'uttrykk-c.json', levelField: 'C' }
};

function formatVocabNorsk(norsk) {
  const trimmed = norsk.trim();
  return trimmed.toLowerCase().startsWith('å ') ? trimmed : `å ${trimmed}`;
}

function pad3(n) {
  return String(n).padStart(3, '0');
}

/** Highest existing NNN for a given level+category among vocab entries */
function maxVocabIdForCategory(vocabEntries, level, category) {
  let max = 0;
  const re = new RegExp(`^v-${level}-${category}-(\\d+)$`);
  for (const e of vocabEntries) {
    const m = e.id?.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

function buildVocabEntry(uttrykkEntry, level, category, newId) {
  const entry = { ...uttrykkEntry };
  delete entry._level;
  delete entry._sourceFile;
  delete entry.classification;
  delete entry.suggested_category;
  delete entry.reason;

  entry.id = newId;
  entry.norsk = formatVocabNorsk(uttrykkEntry.norsk);
  // lemma stays as-is: bare infinitive, no å — matches vocab lemma rule
  entry.category = category;
  entry.part = 'verb';
  return entry;
}

function writeBackup(filePath) {
  const bakPath = filePath + '.bak';
  fs.copyFileSync(filePath, bakPath);
  return bakPath;
}

// ── Main ─────────────────────────────────────────────────────────────────

function main() {
  if (DRY_RUN) console.log('🔍 DRY RUN — no files will be modified\n');

  if (!fs.existsSync(CLASSIFICATION_FILE)) {
    console.error(`❌ Classification file not found: ${CLASSIFICATION_FILE}`);
    console.error('   Run classify-uttrykk-verbs.mjs first.');
    process.exit(1);
  }
  const classified = JSON.parse(fs.readFileSync(CLASSIFICATION_FILE, 'utf8'));

  const toMigrate = (
    FILTER_IDS
      ? classified.filter((e) => FILTER_IDS.has(e.id))
      : classified.filter((e) => e.classification === 'move_to_vocab')
  ).filter((e) => !SKIP_IDS.has(e.id));

  if (toMigrate.length === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  // Entries missing a usable suggested_category can't be auto-migrated —
  // flag them instead of guessing.
  const missingCategory = toMigrate.filter((e) => !e.suggested_category);
  const migratable = toMigrate.filter((e) => e.suggested_category);

  if (missingCategory.length > 0) {
    console.warn(
      `\n⚠ ${missingCategory.length} entries have no suggested_category and will be skipped:`
    );
    for (const e of missingCategory) console.warn(`    ${e.id}  |  ${e.norsk}`);
  }

  const byLevel = {};
  for (const entry of migratable) {
    const level = entry._level;
    if (!LEVEL_MAP[level]) {
      console.warn(`  ⚠ Unknown level "${level}" for ${entry.id} — skipping`);
      continue;
    }
    if (!byLevel[level]) byLevel[level] = [];
    byLevel[level].push(entry);
  }

  console.log(`\n📋 Entries to migrate: ${migratable.length}\n`);

  const migrations = [];

  for (const [level, entries] of Object.entries(byLevel)) {
    const { vocabFile, uttrykFile, levelField } = LEVEL_MAP[level];
    const vocabPath = path.join(DATA_DIR, vocabFile);
    const uttrykPath = path.join(DATA_DIR, uttrykFile);

    if (!fs.existsSync(vocabPath)) {
      console.error(`  ❌ Missing vocab file: ${vocabFile}`);
      continue;
    }
    if (!fs.existsSync(uttrykPath)) {
      console.error(`  ❌ Missing uttrykk file: ${uttrykFile}`);
      continue;
    }

    const vocabData = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
    const uttrykData = JSON.parse(fs.readFileSync(uttrykPath, 'utf8'));

    const removeIds = new Set(entries.map((e) => e.id));
    const newVocabEntries = [];

    // Track per-category counters, seeded from existing max in that category
    const categoryCounters = {};

    console.log(`  ${levelField} — ${uttrykFile} → ${vocabFile}`);

    for (const entry of entries) {
      const category = entry.suggested_category;
      if (categoryCounters[category] === undefined) {
        categoryCounters[category] = maxVocabIdForCategory(vocabData, level, category);
      }
      categoryCounters[category] += 1;
      const newId = `v-${level}-${category}-${pad3(categoryCounters[category])}`;

      const vocabEntry = buildVocabEntry(entry, level, category, newId);
      newVocabEntries.push(vocabEntry);
      migrations.push({ from: entry.id, to: newId, norsk: vocabEntry.norsk, level });

      console.log(`    ${entry.id}  →  ${newId}  |  "${vocabEntry.norsk}"  (${category})`);
    }

    if (!DRY_RUN) {
      writeBackup(vocabPath);
      writeBackup(uttrykPath);

      const newUttrykData = uttrykData.filter((e) => !removeIds.has(e.id));
      const combinedVocabData = [...vocabData, ...newVocabEntries];

      fs.writeFileSync(uttrykPath, JSON.stringify(newUttrykData, null, 2) + '\n', 'utf8');
      fs.writeFileSync(vocabPath, JSON.stringify(combinedVocabData, null, 2) + '\n', 'utf8');

      console.log(
        `    ✓ Removed ${entries.length} from ${uttrykFile}, appended ${newVocabEntries.length} to ${vocabFile}`
      );
    }

    console.log('');
  }

  if (DRY_RUN) {
    console.log(`\n✅ Dry run complete — ${migrations.length} entries would be migrated.`);
    console.log('   Run without --dry-run to apply.\n');
  } else {
    console.log(`\n✅ Done — migrated ${migrations.length} entries.`);
    console.log('   Backups written as .bak files.');
    console.log('   NOTE: run scripts/assign-ids.mjs / verify-vocab-ids.mjs afterwards');
    console.log('   if you want IDs re-verified for gaps across the whole category.\n');
  }
}

main();
