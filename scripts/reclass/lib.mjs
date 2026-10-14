import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Assumes this file lives at scripts/reclass/lib.mjs relative to repo root.
export const DATA_DIR = path.resolve(__dirname, '../../src/lib/data');
export const DECISIONS_DIR = path.resolve(__dirname, 'decisions');

export function levelDataPaths(level) {
  return {
    uttrykk: path.join(DATA_DIR, `uttrykk-${level}.json`),
    vocab: path.join(DATA_DIR, `vocab-${level}.json`),
    migrationMap: path.join(DATA_DIR, 'id-migration-map.json')
  };
}

export function loadJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Existing files are pretty-printed with 2-space indent and end with a newline.
// Written atomically: the complete JSON goes to a temp file in the same directory, then
// renameSync replaces the target, so an interrupted run can never leave a truncated file.
// A failed write removes its temp file and leaves the target untouched.
export function saveJSON(filePath, data) {
  const tmp = `${filePath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

export function loadDecisions(level) {
  const file = path.join(DECISIONS_DIR, `${level}.jsonl`);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

// Decisions carrying a `superseded_by` field (e.g. the redundant_grammar
// deletes undone by the 2026-09-16 policy change, whose entries were then
// restored on purpose) are audit trail only. The apply scripts must never
// act on them: re-running apply-deletions would delete the restored entries,
// and apply-additions would re-add vocab for a superseded move. status.mjs
// counts them separately instead of reporting them pending.
export function loadActiveDecisions(level) {
  return loadDecisions(level).filter((d) => !d.superseded_by);
}

export function appendDecision(level, decision) {
  fs.mkdirSync(DECISIONS_DIR, { recursive: true });
  const file = path.join(DECISIONS_DIR, `${level}.jsonl`);
  fs.appendFileSync(file, JSON.stringify(decision) + '\n', 'utf8');
}

// Norsk/lemma comparison is case-insensitive and trims trailing
// punctuation variance ("Vær så god." vs "Vær så god") since that's a
// real duplicate class seen in this data.
export function normText(s) {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[.?!]+$/, '');
}

// Same as normText, but also strips a leading "å " (infinitive marker).
// Uttrykk `norsk` may or may not carry it (see data-rules/vocab-and-
// uttrykk.md, amended 2026-09-20); vocab `norsk` always does for verbs.
// Use this — never normText — for cross-file/cross-type duplicate
// detection (status.mjs, apply-additions.mjs), so e.g. uttrykk "ta del
// i" and vocab "å ta del i" are recognised as the same entry. Keep
// normText as-is for `fix`-decision verification, where the exact
// stored form matters.
export function normTextIgnoreA(s) {
  return normText(s).replace(/^å\s+/, '');
}

// An explicit `id` is authoritative: when a decision names one, match by id
// only and never fall back to text. Otherwise a merge/dedupe decision (delete
// one of two same-text twins) matches the surviving twin by text, so status.mjs
// reports it pending forever and apply-deletions.mjs would delete the entry
// that was meant to be kept. Text matching is only for id-less decisions.
export function findEntry(list, { id, norsk, lemma }) {
  if (id) return list.find((e) => e.id === id);
  return list.find((e) => {
    if (norsk && normText(e.norsk) === normText(norsk)) return true;
    if (lemma && normText(e.lemma) === normText(lemma)) return true;
    return false;
  });
}

// Scans every non-.bak, non-preview vocab-*.json / uttrykk-*.json in
// DATA_DIR and returns the full set of ids in use, so a new id never
// collides across levels/files (the mistake that caused the batch-1
// vocab duplicates).
export function collectAllIds() {
  const ids = new Set();
  for (const file of fs.readdirSync(DATA_DIR)) {
    if (!/^(vocab|uttrykk)-(a1|a2|b1|b2|c)\.json$/.test(file)) continue;
    const list = loadJSON(path.join(DATA_DIR, file));
    for (const e of list) if (e.id) ids.add(e.id);
  }
  return ids;
}

// Same scan but returns a map id -> { file, norsk } for duplicate /
// migration-map lookups.
export function collectAllEntries() {
  const map = new Map();
  for (const file of fs.readdirSync(DATA_DIR)) {
    if (!/^(vocab|uttrykk)-(a1|a2|b1|b2|c)\.json$/.test(file)) continue;
    const list = loadJSON(path.join(DATA_DIR, file));
    for (const e of list) if (e.id) map.set(e.id, { file, norsk: e.norsk, lemma: e.lemma });
  }
  return map;
}

export function nextFreeId(existingIds) {
  let max = 0;
  for (const id of existingIds) {
    const m = /^w-(\d+)$/.exec(id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `w-${String(max + 1).padStart(6, '0')}`;
}

export function findByAnyOfNorsk(list, norskArr) {
  const set = new Set(norskArr.map(normText));
  return list.filter((e) => set.has(normText(e.norsk)) || set.has(normText(e.lemma)));
}
