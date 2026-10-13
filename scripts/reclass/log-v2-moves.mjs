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
//   set and any `kind`/`theme` removed. Optional per-move `norsk` and `lemma` override the source
//   values (needed e.g. for a verb whose uttrykk `norsk` has no leading "å "). Before logging, each
//   move is checked against the vocab rules (config.ts category set, norsk/lemma format per part,
//   definition format, no same-norsk entry already in the destination, no duplicate id in the batch).
//   Apply with apply-deletions.mjs, THEN apply-additions.mjs (additions refuses an entry whose
//   id or text still exists in uttrykk).
// stays: reviewed, no change (type no_action), kept as audit trail so the entry is not re-reviewed.
//   `from` is "uttrykk" or "vocab" (which file the entry lives in).
//
// Idempotent: an entry that already has an active phase "v2" decision is skipped.
import {
  levelDataPaths,
  loadJSON,
  loadActiveDecisions,
  loadDecisions,
  appendDecision,
  collectAllEntries,
  normTextIgnoreA,
  DECISIONS_DIR
} from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// Translation languages, same list as scripts/check-vocab.ts (KNOWN_LANGUAGES).
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

// Same patterns as scripts/check-vocab.ts.
const GENDER_PATTERN = /\s*\((en|et|ei|en\/ei|en\/et|en\/men|en\/ei\/et)\)$/i;
const PLURAL_PATTERN = /\s*\((b\.)?pl\.\)$/i;
const UBOYELIG_PATTERN = /\s*\(ubøy\.\)$/i;
const VERB_PREFIX = /^å\s/;

// Valid vocab categories for the level, read from src/lib/config.ts (CATEGORIES_BY_LEVEL).
// Returns null when the block can't be parsed; the category check is then skipped with a warning.
function loadValidCategories(lvl) {
  const src = fs.readFileSync(path.resolve(__dirname, '../../src/lib/config.ts'), 'utf8');
  const start = src.indexOf('export const CATEGORIES_BY_LEVEL');
  if (start === -1) return null;
  const body = src
    .slice(start)
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');
  const m = new RegExp(`\\b${lvl.toUpperCase()}:\\s*\\[([\\s\\S]*?)\\]`).exec(body);
  if (!m) return null;
  return new Set([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
}

function checkNorskLemma(vocab) {
  const errs = [];
  const { norsk, lemma, part } = vocab;
  if (part === 'noun') {
    if (!GENDER_PATTERN.test(norsk) && !PLURAL_PATTERN.test(norsk) && !UBOYELIG_PATTERN.test(norsk))
      errs.push(`noun norsk "${norsk}" needs a gender, (pl.)/(b.pl.) or (ubøy.) marker`);
    if (
      lemma &&
      (GENDER_PATTERN.test(lemma) || PLURAL_PATTERN.test(lemma) || UBOYELIG_PATTERN.test(lemma))
    )
      errs.push(`noun lemma "${lemma}" must be the bare singular word`);
  } else if (part === 'verb') {
    if (!VERB_PREFIX.test(norsk))
      errs.push(`verb norsk "${norsk}" must start with "å " (set "norsk" in the batch move)`);
    if (lemma && VERB_PREFIX.test(lemma))
      errs.push(`verb lemma "${lemma}" must be bare, without "å" (set "lemma" in the batch move)`);
  } else {
    if (VERB_PREFIX.test(norsk)) errs.push(`${part} norsk "${norsk}" must not start with "å "`);
    if (GENDER_PATTERN.test(norsk) || PLURAL_PATTERN.test(norsk) || UBOYELIG_PATTERN.test(norsk))
      errs.push(`${part} norsk "${norsk}" has a noun-only marker (gender, pl. or ubøy.)`);
  }
  if (!lemma) errs.push('lemma is missing');
  return errs;
}

// data-rules/vocab-and-uttrykk-v2.md, "definition field": capitalised, ends with a period, not a
// question or exclamation, verbs start with "Å ", and no more than half its words shared with `example`.
function checkDefinition(def, part, example) {
  const errs = [];
  if (typeof def !== 'string' || def === '' || def !== def.trim()) {
    errs.push('definition must be a non-empty, trimmed string');
    return errs;
  }
  if (!/^[A-ZÆØÅ]/.test(def)) errs.push('definition must start with a capital letter');
  if (!def.endsWith('.')) errs.push('definition must end with a period');
  if (/[?!]/.test(def)) errs.push('definition must not be a question or exclamation');
  if (part === 'verb' && !/^Å\s/.test(def))
    errs.push('verb definition must start with "Å " + infinitive');
  const words = def.toLowerCase().match(/\p{L}+/gu) ?? [];
  const exWords = new Set((example ?? '').toLowerCase().match(/\p{L}+/gu) ?? []);
  const shared = words.filter((w) => exWords.has(w)).length;
  if (words.length > 0 && shared / words.length > 0.5)
    errs.push('definition shares more than half its words with `example`');
  return errs;
}

const { uttrykk: uttrykkPath, vocab: vocabPath } = levelDataPaths(level);
const uttrykkList = loadJSON(uttrykkPath);
const vocabList = loadJSON(vocabPath);
const allEntries = collectAllEntries(); // id -> { file, norsk, lemma }, every vocab/uttrykk file
const validCategories = loadValidCategories(level);
if (!validCategories) {
  console.warn(
    `WARN: could not read the ${level.toUpperCase()} category list from config.ts; category check skipped.`
  );
}
const already = new Set(
  loadActiveDecisions(level)
    .filter((d) => d.phase === 'v2')
    .map((d) => d.source?.id)
    .filter(Boolean)
);

const errors = [];
const lines = [];

// An id may appear once in the whole batch (as a move or a stay), otherwise both would be logged.
const seen = new Set();
for (const e of [...(spec.moves ?? []), ...(spec.stays ?? [])]) {
  if (seen.has(e.id)) errors.push(`${e.id}: appears more than once in the batch file`);
  seen.add(e.id);
}

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
  if (validCategories && !validCategories.has(m.category)) {
    errors.push(
      `${m.id}: category "${m.category}" is not in CATEGORIES_BY_LEVEL for ${level.toUpperCase()}`
    );
    continue;
  }
  if (!src.level || String(src.level).toLowerCase() !== level) {
    errors.push(`${m.id}: source level "${src.level}" does not match batch level "${level}"`);
    continue;
  }
  // Build the vocab entry: same fields and order, definition just before level.
  const vocab = {};
  for (const [k, v] of Object.entries(src)) {
    if (k === 'kind' || k === 'theme' || k === 'definition') continue;
    if (k === 'level') vocab.definition = m.definition;
    vocab[k] =
      k === 'category'
        ? m.category
        : k === 'part'
          ? m.part
          : k === 'norsk' && m.norsk
            ? m.norsk
            : k === 'lemma' && m.lemma
              ? m.lemma
              : v;
  }
  const entryErrors = [];
  for (const f of ['norsk', 'english', 'example', 'example_english']) {
    if (!vocab[f]) entryErrors.push(`source is missing required field "${f}"`);
  }
  if (vocab.norsk) entryErrors.push(...checkNorskLemma(vocab));
  // v2 rule, lemma table: for every part except noun and verb the lemma is the same as norsk.
  if (
    vocab.norsk &&
    vocab.lemma &&
    m.part !== 'noun' &&
    m.part !== 'verb' &&
    vocab.lemma !== vocab.norsk
  )
    entryErrors.push(`lemma "${vocab.lemma}" must equal norsk "${vocab.norsk}" for part ${m.part}`);
  // check-vocab.ts: a translation needs its example_<lang>, and vice versa (warning there, error here).
  for (const lang of KNOWN_LANGUAGES) {
    const hasT = vocab[lang] != null && vocab[lang] !== '';
    const hasE = vocab[`example_${lang}`] != null && vocab[`example_${lang}`] !== '';
    if (hasT !== hasE)
      entryErrors.push(`"${lang}" and "example_${lang}" must both be present or both absent`);
  }
  entryErrors.push(...checkDefinition(m.definition, m.part, vocab.example));
  if (vocabList.some((e) => e.id === src.id))
    entryErrors.push(`id already exists in vocab-${level}.json`);
  // Same-level vocab: same norsk or lemma (a-insensitive, like apply-additions.mjs and status.mjs).
  const sameText = vocabList.find(
    (e) =>
      normTextIgnoreA(e.norsk) === normTextIgnoreA(vocab.norsk) ||
      (vocab.lemma && normTextIgnoreA(e.lemma) === normTextIgnoreA(vocab.lemma))
  );
  if (sameText)
    entryErrors.push(
      `vocab-${level}.json already has "${sameText.norsk}" (${sameText.id}); decide manually (sense rule) before moving`
    );
  // Any other file (other levels' vocab, every uttrykk file). apply-additions.mjs refuses these as
  // conflicts, so catch them now. The source entry itself (same id) is expected and is skipped.
  for (const [id, e] of allEntries) {
    if (id === src.id || e.file === `vocab-${level}.json`) continue;
    if (
      normTextIgnoreA(e.norsk) === normTextIgnoreA(vocab.norsk) ||
      (vocab.lemma && normTextIgnoreA(e.lemma) === normTextIgnoreA(vocab.lemma))
    ) {
      entryErrors.push(`${e.file} already has "${e.norsk}" (${id}); resolve before moving`);
      break;
    }
  }
  if (entryErrors.length) {
    errors.push(...entryErrors.map((e) => `${m.id} "${src.norsk}": ${e}`));
    continue;
  }
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
// appendDecision only appends; if the file lacked a final newline the first new line would be glued
// onto the last old one and corrupt the JSONL. Add the newline first when needed.
const logFile = path.join(DECISIONS_DIR, `${level}.jsonl`);
if (fs.existsSync(logFile)) {
  const text = fs.readFileSync(logFile, 'utf8');
  if (text.length > 0 && !text.endsWith('\n')) fs.appendFileSync(logFile, '\n', 'utf8');
}
const before = loadDecisions(level).length;
for (const l of lines) appendDecision(level, l);
// Read back from disk (every line must still parse) and confirm the count.
const after = loadDecisions(level).length;
if (after !== before + lines.length) {
  console.error(
    `VERIFICATION FAILED: expected ${before + lines.length} decisions, found ${after}.`
  );
  process.exit(1);
}
console.log(
  `Appended ${lines.length} line(s) (${before} -> ${after}, verified by re-reading). Next: apply-deletions, then apply-additions (dry run each first), then status.mjs.`
);
