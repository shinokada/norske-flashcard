// One-off: split the two "Høy på pæra" draft files by level (Phase 5 of
// ai-docs/implementation/uttrykk-from-book-photos.md).
// Writes draft/{level}/uttrykk-{level}-new.json and vocab-{level}-new.json.
// Never overwrites: stops if a target file already exists. Source drafts are
// left untouched. Usage: node scripts/split-hoy-pa-paara-by-level.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'draft', 'uttrykk', 'høy-på-pæra');
const sources = [
  ['uttrykk', join(srcDir, 'uttrykk-hoy-pa-paara-1.json')],
  ['vocab', join(srcDir, 'vocab-hoy-pa-paara-1.json')]
];

const plan = [];
for (const [kind, file] of sources) {
  const entries = JSON.parse(readFileSync(file, 'utf8'));
  const byLevel = {};
  for (const e of entries) (byLevel[e.level] ??= []).push(e);
  for (const [level, list] of Object.entries(byLevel)) {
    const lv = level.toLowerCase();
    plan.push({ kind, level, list, target: join(root, 'draft', lv, `${kind}-${lv}-new.json`) });
  }
  const total = Object.values(byLevel).reduce((n, l) => n + l.length, 0);
  if (total !== entries.length) throw new Error(`${kind}: count mismatch`);
}

const clash = plan.filter((p) => existsSync(p.target));
if (clash.length) {
  console.error('Target already exists, nothing written:');
  for (const p of clash) console.error('  ' + p.target);
  process.exit(1);
}

for (const p of plan) {
  writeFileSync(p.target, JSON.stringify(p.list, null, '\t') + '\n', 'utf8');
  console.log(`${p.kind} ${p.level}: ${p.list.length} -> ${p.target}`);
}
