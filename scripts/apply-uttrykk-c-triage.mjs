// Applies the reviewed per-entry categories from
// ai-docs/implementation/uttrykk-c-category-triage.json onto
// src/lib/data/uttrykk-c.json's `category` field (replacing the generic
// "uttrykk" placeholder with the real triaged C-level category slug).
//
// This does NOT touch vocab-c.json and does NOT change `part` (stays
// "phrase") — these entries remain classified as uttrykk, per
// data-rules/vocab-and-uttrykk-v2.md. The category is only used so uttrykk-c
// entries can be browsed/merged alongside their matching vocab-c category
// at read time (see the c/{category} loader change in
// src/routes/[level]/[category]/+page.server.ts).
//
// Usage:
//   node scripts/apply-uttrykk-c-triage.mjs --dry-run
//   node scripts/apply-uttrykk-c-triage.mjs

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const UTTRYKK_PATH = join(root, 'src/lib/data/uttrykk-c.json');
const TRIAGE_PATH = join(root, 'ai-docs/implementation/uttrykk-c-category-triage.json');

const VALID_CATS = new Set([
  'philosophy',
  'academic',
  'formal-writing',
  'rhetoric',
  'complex-emotions',
  'professional',
  'abstract-concepts',
  'politics-democracy',
  'linguistics',
  'media-journalism',
  'architecture-design',
  'diplomacy-international',
  'finance-economics',
  'medicine-healthcare',
  'psychology-advanced',
  'literary',
  'archaic',
  'proverbs',
  'highly-formal',
  'technical',
  'advanced-law-justice',
  'neuroscience-cognition',
  'climate-environment-policy',
  'sociology-anthropology',
  'advanced-business-strategy',
  'existential-abstract',
  'nature-landscape',
  'sensory-sound',
  'physical-appearance',
  'everyday-objects',
  'character-temperament',
  'embodied-emotion',
  'manner-of-motion',
  'interpersonal-conflict',
  'intensifiers-degree',
  'gastronomy',
  'cultural-heritage'
]);

const isDryRun = process.argv.includes('--dry-run');

const uttrykk = JSON.parse(readFileSync(UTTRYKK_PATH, 'utf-8'));
const triage = JSON.parse(readFileSync(TRIAGE_PATH, 'utf-8'));

const triageById = new Map(triage.map((t) => [t.id, t]));

// ── Validate before writing anything ────────────────────────────────────────
const missingInTriage = uttrykk.filter((e) => !triageById.has(e.id)).map((e) => e.id);
const uttrykkIds = new Set(uttrykk.map((e) => e.id));
const missingInUttrykk = triage.filter((t) => !uttrykkIds.has(t.id)).map((t) => t.id);
const invalidCats = triage.filter((t) => !VALID_CATS.has(t.proposed_category));
const dupIds = uttrykk.length - uttrykkIds.size;

if (missingInTriage.length || missingInUttrykk.length || invalidCats.length || dupIds > 0) {
  console.error('Validation failed:');
  if (missingInTriage.length) console.error('  uttrykk ids missing from triage:', missingInTriage);
  if (missingInUttrykk.length)
    console.error('  triage ids missing from uttrykk:', missingInUttrykk);
  if (invalidCats.length) console.error('  invalid proposed_category values:', invalidCats);
  if (dupIds > 0) console.error('  duplicate ids in uttrykk-c.json:', dupIds);
  process.exit(1);
}

const confidenceCounts = {};
for (const t of triage) {
  confidenceCounts[t.confidence] = (confidenceCounts[t.confidence] || 0) + 1;
}

console.log(`Validation passed: ${uttrykk.length} entries, all ids matched, all categories valid.`);
console.log('Confidence breakdown:', confidenceCounts);

// ── Apply ────────────────────────────────────────────────────────────────────
const updated = uttrykk.map((e) => ({
  ...e,
  category: triageById.get(e.id).proposed_category
}));

const byCategory = {};
for (const e of updated) {
  byCategory[e.category] = (byCategory[e.category] || 0) + 1;
}
console.log('Entries per category:', byCategory);

if (isDryRun) {
  console.log('\nDry run only — no files written. Run without --dry-run to apply.');
  process.exit(0);
}

copyFileSync(UTTRYKK_PATH, `${UTTRYKK_PATH}.bak-pretriage`);
writeFileSync(UTTRYKK_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
console.log(`\nWrote ${updated.length} categorized entries to ${UTTRYKK_PATH}`);
console.log(`Backup of pre-triage state saved to ${UTTRYKK_PATH}.bak-pretriage`);
