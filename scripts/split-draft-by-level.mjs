// Split a book's uttrykk and vocab draft files by level (Phase 5 of
// ai-docs/implementation/uttrykk-from-book-photos.md and ...-2.md).
// Writes draft/{level}/uttrykk-{level}-new.json and vocab-{level}-new.json.
// Never overwrites: stops if a target file already exists. Source drafts are
// left untouched.
//
// Usage (run from the repo root):
//   node scripts/split-draft-by-level.mjs <sourceDir> <uttrykkFile> <vocabFile>
// <sourceDir> is relative to the repo root; the two file names are relative
// to <sourceDir>. Examples:
//   node scripts/split-draft-by-level.mjs draft/uttrykk/høy-på-pæra uttrykk-hoy-pa-paara-1.json vocab-hoy-pa-paara-1.json
//   node scripts/split-draft-by-level.mjs draft/uttrykk/midt-i-blinken uttrykk-midt-i-blinken-1.json vocab-midt-i-blinken-1.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [srcArg, uttrykkFile, vocabFile] = process.argv.slice(2);
if (!srcArg || !uttrykkFile || !vocabFile) {
  console.error(
    'Usage: node scripts/split-draft-by-level.mjs <sourceDir> <uttrykkFile> <vocabFile>'
  );
  process.exit(1);
}

const srcDir = resolve(root, srcArg);
const sources = [
  ['uttrykk', join(srcDir, uttrykkFile)],
  ['vocab', join(srcDir, vocabFile)]
];
const LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C']);

const plan = [];
for (const [kind, file] of sources) {
  if (!existsSync(file)) {
    console.error(`Source not found: ${file}`);
    process.exit(1);
  }
  const entries = JSON.parse(readFileSync(file, 'utf8'));
  const byLevel = {};
  for (const e of entries) {
    if (!LEVELS.has(e.level)) throw new Error(`${kind}: bad level "${e.level}" in "${e.norsk}"`);
    (byLevel[e.level] ??= []).push(e);
  }
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
