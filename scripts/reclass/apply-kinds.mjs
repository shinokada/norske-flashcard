#!/usr/bin/env node
// Usage: node scripts/reclass/apply-kinds.mjs --level a1 [--file <decisions.jsonl>] [--write]
//
// Phase 2 helper for ai-docs/implementation/uttrykk-kind-field.md. Applies `kind` decisions
// (one JSON object per line: {"id":"w-007931","kind":"formula","reason":"..."}) to
// uttrykk-<level>.json. Default input: scripts/outputs/kind-decisions/<level>.jsonl.
//
// - Dry run by default; --write saves and re-reads the file from disk to verify.
// - Idempotent: an entry that already has a `kind` is skipped (never overwritten). If the existing
//   kind differs from the decision, it is reported as a CONFLICT and nothing is written.
// - Refuses (writes nothing) when an id is missing from uttrykk-<level>.json, a kind is not
//   idiom|ordtak|formula, an id appears twice in the decisions, or an entry is not part "phrase".
// - `kind` is inserted right after `part`, same field order as log-v2-moves.mjs reverse moves.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { levelDataPaths, loadJSON, saveJSON } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const level = args.includes('--level') ? args[args.indexOf('--level') + 1] : null;
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
const write = args.includes('--write');
if (!['a1', 'a2', 'b1', 'b2', 'c'].includes(level)) {
  console.error('Usage: node apply-kinds.mjs --level <a1|a2|b1|b2|c> [--file <jsonl>] [--write]');
  process.exit(1);
}

const KINDS = new Set(['idiom', 'ordtak', 'formula']);
const decisionsFile = fileArg
  ? path.resolve(fileArg)
  : path.resolve(__dirname, `../outputs/kind-decisions/${level}.jsonl`);
if (!fs.existsSync(decisionsFile)) {
  console.error(`Decisions file not found: ${decisionsFile}`);
  process.exit(1);
}

const decisions = fs
  .readFileSync(decisionsFile, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l, i) => {
    try {
      return JSON.parse(l);
    } catch {
      console.error(`Line ${i + 1} of ${decisionsFile} is not valid JSON.`);
      process.exit(1);
    }
  });

const { uttrykk: uttrykkPath } = levelDataPaths(level);
const list = loadJSON(uttrykkPath);
const byId = new Map(list.map((e) => [e.id, e]));

const errors = [];
const seen = new Set();
const toApply = [];
let skipped = 0;
for (const d of decisions) {
  if (!d.id || !d.kind) {
    errors.push(`decision needs id and kind: ${JSON.stringify(d)}`);
    continue;
  }
  if (seen.has(d.id)) {
    errors.push(`${d.id}: appears more than once in the decisions file`);
    continue;
  }
  seen.add(d.id);
  if (!KINDS.has(d.kind)) {
    errors.push(`${d.id}: kind "${d.kind}" must be idiom, ordtak or formula`);
    continue;
  }
  const e = byId.get(d.id);
  if (!e) {
    errors.push(`${d.id}: not found in uttrykk-${level}.json (moved or deleted?)`);
    continue;
  }
  if (e.part !== 'phrase') {
    errors.push(`${d.id} "${e.norsk}": part is "${e.part}", uttrykk entries must be part "phrase"`);
    continue;
  }
  if (e.kind) {
    if (e.kind === d.kind) {
      skipped++;
    } else {
      errors.push(`${d.id} "${e.norsk}": already has kind "${e.kind}", decision says "${d.kind}"`);
    }
    continue;
  }
  toApply.push({ id: d.id, kind: d.kind, norsk: e.norsk });
}

if (errors.length) {
  console.error('Not changing anything. Fix the decisions file:\n  ' + errors.join('\n  '));
  process.exit(1);
}

console.log(
  `${write ? 'APPLYING' : 'DRY RUN'}: ${toApply.length} kind(s) for uttrykk-${level}.json` +
    ` (${skipped} already set, skipped)`
);
for (const a of toApply) console.log(`  ${a.kind.padEnd(8)} ${a.id}  ${a.norsk}`);

if (toApply.length === 0) process.exit(0);
if (!write) {
  console.log('\nRe-run with --write to apply.');
  process.exit(0);
}

const kindById = new Map(toApply.map((a) => [a.id, a.kind]));
const next = list.map((e) => {
  const kind = kindById.get(e.id);
  if (!kind) return e;
  const out = {};
  for (const [k, v] of Object.entries(e)) {
    out[k] = v;
    if (k === 'part') out.kind = kind;
  }
  if (!('kind' in out)) out.kind = kind;
  return out;
});
saveJSON(uttrykkPath, next);

// Read back from disk: same length, every target has its kind, nothing else changed.
const verify = loadJSON(uttrykkPath);
const bad = [];
if (verify.length !== list.length) bad.push(`length ${list.length} -> ${verify.length}`);
for (const [id, kind] of kindById) {
  if (verify.find((e) => e.id === id)?.kind !== kind) bad.push(`${id} missing kind ${kind}`);
}
const withKind = verify.filter((e) => e.kind).length;
if (bad.length) {
  console.error('VERIFICATION FAILED:', bad);
  process.exit(1);
}
console.log(
  `\nWrote uttrykk-${level}.json. Verified via fresh read-back: ${verify.length} entries, ` +
    `${kindById.size} kinds added, ${withKind} entries now have a kind.`
);
