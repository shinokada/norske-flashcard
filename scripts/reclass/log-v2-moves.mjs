#!/usr/bin/env node
// Usage: node scripts/reclass/log-v2-moves.mjs --file scripts/outputs/v2-batches/a1-batch-1.json [--write]
//
// Phase 4 helper for ai-docs/implementation/vocab-uttrykk-v2-rollout.md. Turns an APPROVED review
// batch into decision lines in scripts/reclass/decisions/<level>.jsonl, so the apply scripts and
// status.mjs can act on them. It edits no data file. Dry run by default; --write appends.
//
// Batch file (JSON):
//   { "level": "a1", "batch": "v2-1",
//     "moves": [ { "id": "w-010155", "category": "days-months", "part": "adverb",
//                  "definition": "Den dagen det er nå.", "reason": "v2: time expression, adverb" } ],
//     "stays": [ { "id": "w-008043", "from": "uttrykk", "reason": "v2: formula (discourse marker)" } ] }
//
// moves: uttrykk -> vocab. The decision's `vocab` object is the full entry built from the live
//   uttrykk entry (same id, so progress keeps resolving), with `part`, `category` and `definition`
//   set and any `kind`/`theme` removed. Apply with apply-deletions.mjs, THEN apply-additions.mjs
//   (additions refuses an id that still exists in uttrykk).
// stays: reviewed, no change (type no_action), kept as audit trail so the entry is not re-reviewed.
//   `from` is "uttrykk" or "vocab" (which file the entry lives in).
//
// Idempotent: an entry that already has an active phase "v2" decision is skipped.
import { levelDataPaths, loadJSON, loadActiveDecisions, appendDecision } from './lib.mjs';
import fs from 'node:fs';

const args = process.argv.slice(2);
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
const write = args.includes('--write');
if (!fileArg) {
  console.error('Usage: node log-v2-moves.mjs --file <batch.json> [--write]');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(fileArg, 'utf8'));
const { level, batch } = spec;
if (!['a1', 'a2', 'b1', 'b2', 'c'].includes(level) || !batch) {
  console.error('Batch file needs "level" (a1..c) and "batch".');
  process.exit(1);
}

const PARTS = new Set([
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
const { uttrykk: uttrykkPath, vocab: vocabPath } = levelDataPaths(level);
const uttrykkList = loadJSON(uttrykkPath);
const vocabList = loadJSON(vocabPath);
const already = new Set(
  loadActiveDecisions(level)
    .filter((d) => d.phase === 'v2')
    .map((d) => d.source?.id)
    .filter(Boolean)
);

const errors = [];
const lines = [];

for (const m of spec.moves ?? []) {
  const src = uttrykkList.find((e) => e.id === m.id);
  if (already.has(m.id)) {
    console.log(`skip ${m.id}: already has a v2 decision`);
    continue;
  }
  if (!src) {
    errors.push(`${m.id}: not found in uttrykk-${level}.json`);
    continue;
  }
  if (!m.category || !m.part || !m.definition || !m.reason) {
    errors.push(`${m.id}: move needs category, part, definition and reason`);
    continue;
  }
  if (!PARTS.has(m.part) || m.part === 'phrase') {
    errors.push(
      `${m.id}: part "${m.part}" invalid for a vocab move (use the grammatical head's part, never phrase)`
    );
    continue;
  }
  if (m.category === 'uttrykk') {
    errors.push(`${m.id}: category "uttrykk" is retired`);
    continue;
  }
  // Build the vocab entry: same fields and order, definition just before level.
  const vocab = {};
  for (const [k, v] of Object.entries(src)) {
    if (k === 'kind' || k === 'theme' || k === 'definition') continue;
    if (k === 'level') vocab.definition = m.definition;
    vocab[k] = k === 'category' ? m.category : k === 'part' ? m.part : v;
  }
  if (!('definition' in vocab)) vocab.definition = m.definition;
  lines.push({
    level,
    batch,
    phase: 'v2',
    type: 'move',
    bucket: 'v2_move_to_vocab',
    source: { norsk: src.norsk, id: src.id },
    vocab,
    reason: m.reason
  });
}

for (const s of spec.stays ?? []) {
  const list = s.from === 'vocab' ? vocabList : uttrykkList;
  const src = list.find((e) => e.id === s.id);
  if (already.has(s.id)) {
    console.log(`skip ${s.id}: already has a v2 decision`);
    continue;
  }
  if (!src) {
    errors.push(`${s.id}: not found in ${s.from}-${level}.json`);
    continue;
  }
  if (!s.reason || !['uttrykk', 'vocab'].includes(s.from)) {
    errors.push(`${s.id}: stay needs from (uttrykk|vocab) and reason`);
    continue;
  }
  lines.push({
    level,
    batch,
    phase: 'v2',
    type: 'no_action',
    bucket: 'v2_stay',
    source: { norsk: src.norsk, id: src.id },
    from: s.from,
    reason: s.reason
  });
}

if (errors.length) {
  console.error('Not logging anything. Fix the batch file:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(
  `${write ? 'LOGGING' : 'DRY RUN'}: ${lines.length} decision line(s) for ${level} batch ${batch}`
);
for (const l of lines) {
  console.log(
    `  ${l.type.padEnd(9)} ${l.source.id}  ${l.source.norsk}${l.vocab ? `  -> ${l.vocab.part}/${l.vocab.category}` : ''}`
  );
}
if (!write) {
  console.log('\nRe-run with --write to append to decisions/' + level + '.jsonl');
  process.exit(0);
}
for (const l of lines) appendDecision(level, l);
console.log(
  `Appended ${lines.length} line(s). Next: apply-deletions, then apply-additions (dry run each first), then status.mjs.`
);
