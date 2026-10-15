#!/usr/bin/env node
// Usage: node scripts/reclass/apply-additions.mjs --level a2 [--write]
//
// Idempotent: skips anything already present in the target vocab file.
// Refuses (does not add) anything that already exists as a duplicate in
// a DIFFERENT level's vocab file — this is the exact bug from batch 1
// ("en stund"/"en feil" duplicating vocab-b1 / vocab-a2's own existing
// entries). Those must be resolved as a decision (drop the addition)
// before this script will proceed for that entry.

import {
  levelDataPaths,
  loadJSON,
  saveJSON,
  loadActiveDecisions,
  findEntry,
  collectAllIds,
  collectAllEntries,
  nextFreeId,
  normTextIgnoreA
} from './lib.mjs';

const args = process.argv.slice(2);
const level = args.includes('--level') ? args[args.indexOf('--level') + 1] : null;
const write = args.includes('--write');
if (!level) {
  console.error('Usage: node apply-additions.mjs --level <a1|a2|b1|b2|c> [--write]');
  process.exit(1);
}

const { vocab: vocabPath } = levelDataPaths(level);
const vocabList = loadJSON(vocabPath);
// Never (re-)add vocab that the log says was resolved otherwise:
//  - `resolution: 'skip'`: the user confirmed no vocab entry should be added
//    (same-sense twin already exists, or the addition was rejected);
//  - a `delete` or `reverse_move` names the vocab id as its source: the entry
//    was deliberately removed (dedupe) or sent back to uttrykk. Ids are
//    unique across files, so line order does not matter.
// Without these, re-running this script re-adds entries that status.mjs
// already counts as resolved (e.g. w-010692 'svunnen tid (en)').
const removedVocabIds = new Set(
  loadActiveDecisions(level)
    .filter((d) => d.type === 'delete' || d.type === 'reverse_move')
    .map((d) => d.source?.id)
    .filter(Boolean)
);
const decisions = loadActiveDecisions(level).filter(
  (d) =>
    d.vocab &&
    (d.type === 'move' || d.type === 'add_vocab') &&
    d.resolution !== 'skip' &&
    !(d.vocab.id && removedVocabIds.has(d.vocab.id))
);

const allEntries = collectAllEntries();
const toAdd = [];
const conflicts = [];
// Normalised norsk/lemma of the additions accepted so far in THIS run. Two decisions (possibly from
// different batches) can carry the same destination text under different ids; the checks against the
// files on disk cannot see that, so refuse the later one here.
const addedText = new Map();

for (const d of decisions) {
  if (findEntry(vocabList, d.vocab)) continue; // already applied

  // å-insensitive: uttrykk `norsk` may or may not carry a leading "å ",
  // so compare ignoring it (see lib.mjs normTextIgnoreA).
  const dupElsewhere = [...allEntries.values()].find(
    (e) =>
      e.file !== `vocab-${level}.json` &&
      ((d.vocab.norsk && normTextIgnoreA(e.norsk) === normTextIgnoreA(d.vocab.norsk)) ||
        (d.vocab.lemma && normTextIgnoreA(e.lemma) === normTextIgnoreA(d.vocab.lemma)))
  );
  if (dupElsewhere) {
    conflicts.push({ decision: d, dupElsewhere });
    continue;
  }
  const keys = [
    ...new Set([d.vocab.norsk, d.vocab.lemma].filter(Boolean).map((t) => normTextIgnoreA(t)))
  ];
  const dupInRun = keys.find((k) => addedText.has(k));
  if (dupInRun !== undefined) {
    conflicts.push({
      decision: d,
      dupElsewhere: { file: `another addition in this run ("${addedText.get(dupInRun)}")` }
    });
    continue;
  }
  for (const k of keys) addedText.set(k, d.vocab.norsk);
  toAdd.push(d);
}

if (conflicts.length > 0) {
  console.log(
    `CONFLICTS — ${conflicts.length} addition(s) already exist elsewhere, skipping (resolve manually):`
  );
  for (const { decision, dupElsewhere } of conflicts) {
    console.log(`  - "${decision.vocab.norsk}" already in ${dupElsewhere.file}`);
  }
  console.log('');
}

if (toAdd.length === 0) {
  console.log(
    `Nothing to add for ${level} — all logged additions already applied, or all conflicts.`
  );
  process.exit(conflicts.length > 0 ? 1 : 0);
}

console.log(
  `${write ? 'APPLYING' : 'DRY RUN'} — ${toAdd.length} addition(s) to vocab-${level}.json:\n`
);

const existingIds = collectAllIds();
const prepared = [];
for (const d of toAdd) {
  const entry = { ...d.vocab };
  if (!entry.id) {
    entry.id = nextFreeId(existingIds);
    existingIds.add(entry.id);
  }
  if (existingIds.has(entry.id) && !prepared.some((p) => p.id === entry.id)) {
    // id explicitly set in decision but already taken elsewhere — bail loudly
    if ([...allEntries.keys()].includes(entry.id)) {
      console.error(
        `ID COLLISION: ${entry.id} already exists. Fix the decision file before proceeding.`
      );
      process.exit(1);
    }
  }
  prepared.push(entry);
  console.log(`  + add ${entry.id}  "${entry.norsk}"  (${d.bucket ?? d.type}: ${d.reason ?? ''})`);
}

if (!write) {
  console.log('\nRe-run with --write to apply.');
  process.exit(0);
}

const before = vocabList.length;
const after = [...vocabList, ...prepared];
saveJSON(vocabPath, after);
console.log(`\nWrote vocab-${level}.json: ${before} -> ${after.length} entries.`);

const verify = loadJSON(vocabPath);
const missing = prepared.filter((p) => !verify.some((e) => e.id === p.id));
const ids = verify.map((e) => e.id);
const dupeIds = ids.filter((id, i) => ids.indexOf(id) !== i);
if (verify.length !== after.length || missing.length > 0 || dupeIds.length > 0) {
  console.error('VERIFICATION FAILED.', { missing, dupeIds });
  process.exit(1);
}
console.log(
  `Verified via fresh read-back: ${verify.length} entries, all ${prepared.length} additions confirmed present, no duplicate ids.`
);
