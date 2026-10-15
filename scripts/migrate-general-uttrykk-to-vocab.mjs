#!/usr/bin/env node
/**
 * migrate-general-uttrykk-to-vocab.mjs
 *
 * One-off cleanup of the B1 uttrykk "general" catch-all (58 entries — see
 * §general-category-cleanup in the B1 opp-og-fram implementation doc).
 *
 * Does two things to src/lib/data/uttrykk-b1.json:
 *
 * 1. Retags 12 "general" entries in place:
 *      - GROUP1_RETAG → theme: "fixed-prepositional-phrases" (6 entries) —
 *        new functional theme, just added to UTTRYKK_FUNCTIONAL_THEMES in
 *        src/lib/config.ts
 *      - GROUP2_RETAG → theme: "necessity-formulas" (5 entries) — ditto
 *      - SKYLD_I_RETAG → theme: "society" (1 entry, "skyld i" — topical,
 *        not a new functional theme; see comment below)
 *
 * 2. Migrates 27 "general" entries that are genuinely productive
 *    verb+preposition collocations (fail the uttrykk decision rule in
 *    data-rules/vocab-and-uttrykk-v2.md — they function as ordinary verb
 *    lemmas, not fixed chunks) out of uttrykk-b1.json and into
 *    vocab-b1.json as part: "verb", following the same conventions as
 *    migrate-to-vocab.mjs (å-prefix norsk, lemma unchanged, new
 *    v-b1-<category>-NNN id continuing that category's counter).
 *
 * Usage:
 *   node scripts/migrate-general-uttrykk-to-vocab.mjs --dry-run
 *   node scripts/migrate-general-uttrykk-to-vocab.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'src/lib/data');
const UTTRYKK_PATH = path.join(DATA_DIR, 'uttrykk-b1.json');
const VOCAB_PATH = path.join(DATA_DIR, 'vocab-b1.json');

const DRY_RUN = process.argv.includes('--dry-run');

// ── Group 1: fixed prepositional/adverbial phrases → retag only ──────────
const GROUP1_RETAG = {
  'u-b1-080': 'fixed-prepositional-phrases', // i fred
  'u-b1-085': 'fixed-prepositional-phrases', // i ro og fred
  'u-b1-081': 'fixed-prepositional-phrases', // i hemmelighet
  'u-b1-088': 'fixed-prepositional-phrases', // i veien
  'u-b1-044': 'fixed-prepositional-phrases', // i gang
  'u-b1-128': 'fixed-prepositional-phrases' // sted; av sted
};

// ── Group 2: necessity/obligation formulas → retag only ──────────────────
const GROUP2_RETAG = {
  'u-b1-025': 'necessity-formulas', // er nødt til
  'u-b1-116': 'necessity-formulas', // skulle til
  'u-b1-120': 'necessity-formulas', // slippe å
  'u-b1-104': 'necessity-formulas', // om det trengs
  'u-b1-023': 'necessity-formulas' // er avhengig av
};

// u-b1-117 "skyld i" was in the original Group 4 review list, but on closer
// look it is NOT verb-headed — "skyld" is a noun ("blame/fault"), normally
// paired with "være" ("være skyld i"), so "å skyld i" would be ungrammatical.
// It fails the vocab decision rule (no single verb lemma to conjugate), so
// it's retagged to a topical theme instead of migrated.
const SKYLD_I_RETAG = { 'u-b1-117': 'society' };

// ── Group 4: productive verb+prep collocations → migrate to vocab ────────
const GROUP4_MIGRATE = {
  'u-b1-136': 'personal-growth', // sørge for
  'u-b1-141': 'reasoning', // ta hensyn til
  'u-b1-101': 'reasoning', // minne om
  'u-b1-058': 'personal-growth', // ha godt av
  'u-b1-051': 'personal-growth', // gå glipp av
  'u-b1-068': 'workplace', // holde mål
  'u-b1-075': 'society', // høre hjemme
  'u-b1-066': 'communication-skills', // handle om
  'u-b1-140': 'personal-growth', // ta fatt på
  'u-b1-143': 'personal-growth', // ta kontroll
  'u-b1-145': 'workplace', // ta tak i
  'u-b1-013': 'personal-growth', // bli vant til
  'u-b1-041': 'relationships', // få viljen sin
  'u-b1-096': 'communication-skills', // late som
  'u-b1-133': 'communication-skills', // stå fram som
  'u-b1-207': 'communication-skills', // gjøre rede for
  'u-b1-177': 'personal-growth', // oppfylle et ønske
  'u-b1-206': 'personal-growth', // ta risiko
  'u-b1-170': 'society', // bli påvirket
  'u-b1-211': 'workplace', // møte opp
  'u-b1-047': 'workplace', // gjøre avtaler
  'u-b1-093': 'personal-growth', // komme i gang
  'u-b1-098': 'personal-growth', // ligge godt an
  'u-b1-147': 'traditions', // tenne bål
  'u-b1-125': 'relationships', // spise om kapp
  'u-b1-130': 'relationships', // stikke innom
  'u-b1-040': 'personal-growth' // få noen til å gjøre noe
};

function pad3(n) {
  return String(n).padStart(3, '0');
}

function formatVocabNorsk(norsk) {
  const trimmed = norsk.trim();
  return trimmed.toLowerCase().startsWith('å ') ? trimmed : `å ${trimmed}`;
}

function maxVocabIdForCategory(vocabEntries, category) {
  let max = 0;
  const re = new RegExp(`^v-b1-${category}-(\\d+)$`);
  for (const e of vocabEntries) {
    const m = e.id?.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

function buildVocabEntry(uttrykkEntry, category, newId) {
  const entry = { ...uttrykkEntry };
  delete entry.theme;
  entry.id = newId;
  entry.norsk = formatVocabNorsk(uttrykkEntry.norsk);
  // lemma stays as-is: bare form, matches vocab lemma rule
  entry.category = category;
  entry.part = 'verb';
  return entry;
}

function writeBackup(filePath) {
  if (!fs.existsSync(filePath + '.bak')) {
    fs.copyFileSync(filePath, filePath + '.bak');
  }
}

function main() {
  if (DRY_RUN) console.log('🔍 DRY RUN — no files will be modified\n');

  const uttrykk = JSON.parse(fs.readFileSync(UTTRYKK_PATH, 'utf8'));
  const vocab = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf8'));

  const byId = new Map(uttrykk.map((e) => [e.id, e]));

  // Sanity checks
  const allTargetIds = [
    ...Object.keys(GROUP1_RETAG),
    ...Object.keys(GROUP2_RETAG),
    ...Object.keys(SKYLD_I_RETAG),
    ...Object.keys(GROUP4_MIGRATE)
  ];
  const missing = allTargetIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    console.error(`❌ IDs not found in uttrykk-b1.json: ${missing.join(', ')}`);
    process.exit(1);
  }
  const notGeneral = allTargetIds.filter((id) => byId.get(id).theme !== 'general');
  if (notGeneral.length > 0) {
    console.error(
      `❌ Expected theme "general" but found otherwise for: ${notGeneral
        .map((id) => `${id} (${byId.get(id).theme})`)
        .join(', ')}`
    );
    process.exit(1);
  }

  // 1 & 2: retag in place
  let retagged = 0;
  for (const [id, theme] of [
    ...Object.entries(GROUP1_RETAG),
    ...Object.entries(GROUP2_RETAG),
    ...Object.entries(SKYLD_I_RETAG)
  ]) {
    byId.get(id).theme = theme;
    retagged++;
  }
  console.log(`📌 Retag: ${Object.keys(GROUP1_RETAG).length} → fixed-prepositional-phrases`);
  console.log(`📌 Retag: ${Object.keys(GROUP2_RETAG).length} → necessity-formulas`);
  console.log(
    `📌 Retag: ${Object.keys(SKYLD_I_RETAG).length} → society (skyld i — not verb-headed)`
  );

  // 3: migrate to vocab
  const categoryCounters = {};
  const newVocabEntries = [];
  const migrations = [];

  for (const [id, category] of Object.entries(GROUP4_MIGRATE)) {
    if (categoryCounters[category] === undefined) {
      categoryCounters[category] = maxVocabIdForCategory(vocab, category);
    }
    categoryCounters[category] += 1;
    const newId = `v-b1-${category}-${pad3(categoryCounters[category])}`;
    const vocabEntry = buildVocabEntry(byId.get(id), category, newId);
    newVocabEntries.push(vocabEntry);
    migrations.push({ from: id, to: newId, norsk: vocabEntry.norsk });
  }

  console.log(`\n📋 Migrating ${migrations.length} entries to vocab-b1.json:`);
  for (const m of migrations) {
    console.log(`    ${m.from}  →  ${m.to}  |  "${m.norsk}"`);
  }

  const migrateIds = new Set(Object.keys(GROUP4_MIGRATE));
  const finalUttrykk = uttrykk.filter((e) => !migrateIds.has(e.id));
  const finalVocab = [...vocab, ...newVocabEntries];

  console.log(`\nuttrykk-b1.json: ${uttrykk.length} → ${finalUttrykk.length}`);
  console.log(`vocab-b1.json:   ${vocab.length} → ${finalVocab.length}`);
  console.log(`(retagged in place: ${retagged})`);

  if (!DRY_RUN) {
    writeBackup(UTTRYKK_PATH);
    writeBackup(VOCAB_PATH);
    fs.writeFileSync(UTTRYKK_PATH, JSON.stringify(finalUttrykk, null, 2) + '\n', 'utf8');
    fs.writeFileSync(VOCAB_PATH, JSON.stringify(finalVocab, null, 2) + '\n', 'utf8');
    console.log('\n✅ Done. Backups written as .bak files.');
  } else {
    console.log('\n✅ Dry run complete — run without --dry-run to apply.');
  }
}

main();
