#!/usr/bin/env node
// Usage: node scripts/reclass/apply-reverse-moves.mjs --level c [--write]
//
// Applies the phase "v2" `reverse_move` decisions (vocab -> uttrykk) that log-v2-moves.mjs wrote to
// scripts/reclass/decisions/<level>.jsonl. The other apply scripts only do uttrykk -> vocab.
//
// The uttrykk entry is NOT retyped: it is the full entry stored in the decision (`d.uttrykk`), which
// log-v2-moves.mjs built from the live vocab entry (same id, `kind` and `definition` set, `verb_type`
// and `sense` removed). Retyping accented text through a chat tool has produced mismatches before.
//
// Order of writes (so an interrupted run can only leave an id in BOTH files, never in neither):
//   1. append the entries to uttrykk-<level>.json, read back, compare with the decision
//   2. delete the ids from vocab-<level>.json, read back
//   3. check every id is in exactly one of the two files and the combined count is as expected
//
// Idempotent: an id already gone from vocab and present in uttrykk is skipped. An id present in both
// files (step 1 done, step 2 not) only gets step 2. An id in neither file is an error: nothing is written.
import {
  levelDataPaths,
  loadJSON,
  saveJSON,
  loadActiveDecisions,
  collectAllEntries,
  normTextIgnoreA
} from './lib.mjs';

const args = process.argv.slice(2);
const level = args.includes('--level') ? args[args.indexOf('--level') + 1] : null;
const write = args.includes('--write');
if (!level) {
  console.error('Usage: node apply-reverse-moves.mjs --level <a1|a2|b1|b2|c> [--write]');
  process.exit(1);
}

const { uttrykk: uttrykkPath, vocab: vocabPath } = levelDataPaths(level);
const uttrykkList = loadJSON(uttrykkPath);
const vocabList = loadJSON(vocabPath);
const allEntries = collectAllEntries();
const canon = (o) => JSON.stringify(o, Object.keys(o).sort());

const decisions = loadActiveDecisions(level).filter(
  (d) => d.type === 'reverse_move' && d.phase === 'v2' && d.uttrykk?.id
);

const errors = [];
const toAdd = []; // decisions that need step 1 and step 2
const toDeleteOnly = []; // decisions where the uttrykk entry already exists (step 1 was done)
let alreadyApplied = 0;
const addedText = new Map(); // normalised text of entries accepted in this run -> norsk

// Fields log-v2-moves.mjs rewrites when it builds the uttrykk entry (norsk is checked separately)...
const REWRITTEN = new Set(['id', 'norsk', 'lemma', 'part', 'kind', 'category', 'definition']);
// ...and fields it removes on purpose.
const DROPPED = new Set(['verb_type', 'sense', 'kind', 'theme']);

for (const d of decisions) {
  const id = d.source?.id;
  const e = d.uttrykk;
  if (!id || e.id !== id) {
    errors.push(`"${d.source?.norsk}": decision source.id and uttrykk.id differ`);
    continue;
  }
  const inVocab = vocabList.find((x) => x.id === id);
  const inUttrykk = uttrykkList.find((x) => x.id === id);

  if (!inVocab && inUttrykk) {
    alreadyApplied++;
    continue;
  }
  if (!inVocab && !inUttrykk) {
    errors.push(
      `${id} "${d.source.norsk}": in neither vocab-${level} nor uttrykk-${level} (nothing written)`
    );
    continue;
  }
  if (inVocab.norsk !== d.source.norsk) {
    errors.push(`${id}: vocab norsk is now "${inVocab.norsk}", decision says "${d.source.norsk}"`);
    continue;
  }
  // Every field copied unchanged into d.uttrykk must still match the live vocab entry, in both
  // directions: a changed value, a field added to vocab after logging, or a field removed from vocab
  // would otherwise be overwritten by the stale copy in the decision and then deleted from vocab.
  // Excluded: fields the logger rewrites (REWRITTEN; norsk is checked above) and fields it drops on
  // purpose when it builds the uttrykk entry (DROPPED).
  const changedKey = [...new Set([...Object.keys(e), ...Object.keys(inVocab)])].find(
    (key) =>
      !REWRITTEN.has(key) &&
      !DROPPED.has(key) &&
      JSON.stringify(inVocab[key]) !== JSON.stringify(e[key])
  );
  if (changedKey) {
    const how = changedKey in e ? (changedKey in inVocab ? 'changed' : 'was removed') : 'was added';
    errors.push(
      `${id} "${d.source.norsk}": vocab "${changedKey}" ${how} since the decision was logged (re-log the move)`
    );
    continue;
  }
  if (inUttrykk) {
    if (canon(inUttrykk) !== canon(e)) {
      errors.push(`${id} "${e.norsk}": already in uttrykk-${level} but differs from the decision`);
      continue;
    }
    toDeleteOnly.push(d);
    continue;
  }

  // Text collisions: any other entry in any vocab/uttrykk file, or another entry added in this run.
  const keys = [...new Set([e.norsk, e.lemma].filter(Boolean).map((t) => normTextIgnoreA(t)))];
  let clash = null;
  for (const [otherId, o] of allEntries) {
    if (otherId === id) continue;
    if (
      keys.includes(normTextIgnoreA(o.norsk)) ||
      (o.lemma && keys.includes(normTextIgnoreA(o.lemma)))
    ) {
      clash = `${o.file} already has "${o.norsk}" (${otherId})`;
      break;
    }
  }
  if (!clash) {
    const k = keys.find((x) => addedText.has(x));
    if (k !== undefined) clash = `another reverse move in this run ("${addedText.get(k)}")`;
  }
  if (clash) {
    errors.push(`${id} "${e.norsk}": ${clash}`);
    continue;
  }
  for (const k of keys) addedText.set(k, e.norsk);
  toAdd.push(d);
}

if (errors.length) {
  console.error('Not writing anything. Resolve first:\n  ' + errors.join('\n  '));
  process.exit(1);
}
if (toAdd.length === 0 && toDeleteOnly.length === 0) {
  console.log(
    `Nothing to do for ${level}: ${alreadyApplied} reverse move(s) already applied, none pending.`
  );
  process.exit(0);
}

console.log(
  `${write ? 'APPLYING' : 'DRY RUN'}: ${toAdd.length} reverse move(s) (vocab -> uttrykk) for ${level}` +
    (toDeleteOnly.length
      ? `, plus ${toDeleteOnly.length} vocab deletion(s) to finish a half-applied move`
      : '') +
    (alreadyApplied ? `; ${alreadyApplied} already applied` : '') +
    ':\n'
);
for (const d of toAdd) {
  console.log(
    `  ${d.source.id}  "${d.uttrykk.norsk}"  -> uttrykk ${d.uttrykk.kind}/${d.uttrykk.category}  (${d.reason ?? ''})`
  );
}
for (const d of toDeleteOnly) {
  console.log(`  ${d.source.id}  "${d.uttrykk.norsk}"  -> delete from vocab only`);
}
console.log(
  `\nvocab-${level}: ${vocabList.length} -> ${vocabList.length - toAdd.length - toDeleteOnly.length}, ` +
    `uttrykk-${level}: ${uttrykkList.length} -> ${uttrykkList.length + toAdd.length}`
);

if (!write) {
  console.log('\nRe-run with --write to apply.');
  process.exit(0);
}

const combinedBefore = vocabList.length + uttrykkList.length;

// Step 1: uttrykk first.
if (toAdd.length) {
  const uttrykkAfter = [...uttrykkList, ...toAdd.map((d) => d.uttrykk)];
  saveJSON(uttrykkPath, uttrykkAfter);
  const verify = loadJSON(uttrykkPath);
  const bad = toAdd.filter((d) => {
    const onDisk = verify.find((x) => x.id === d.uttrykk.id);
    return !onDisk || canon(onDisk) !== canon(d.uttrykk);
  });
  const ids = verify.map((x) => x.id);
  const dupeIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (verify.length !== uttrykkAfter.length || bad.length || dupeIds.length) {
    console.error(
      'VERIFICATION FAILED after writing uttrykk. vocab is untouched. Investigate before continuing.',
      { bad: bad.map((d) => d.source.id), dupeIds }
    );
    process.exit(1);
  }
  console.log(
    `\nWrote uttrykk-${level}.json: ${uttrykkList.length} -> ${verify.length} entries. Verified by fresh read-back (fields match the decisions, no duplicate ids).`
  );
}

// Step 2: only now remove from vocab.
const removeIds = new Set([...toAdd, ...toDeleteOnly].map((d) => d.source.id));
const vocabAfter = vocabList.filter((x) => !removeIds.has(x.id));
saveJSON(vocabPath, vocabAfter);
const vocabVerify = loadJSON(vocabPath);
const stillThere = [...removeIds].filter((id) => vocabVerify.some((x) => x.id === id));
if (vocabVerify.length !== vocabAfter.length || stillThere.length) {
  console.error(
    'VERIFICATION FAILED after writing vocab. The entries are in uttrykk too, so nothing is lost: re-run this script to finish step 2.',
    { stillThere }
  );
  process.exit(1);
}
console.log(
  `Wrote vocab-${level}.json: ${vocabList.length} -> ${vocabVerify.length} entries. Verified by fresh read-back (all ${removeIds.size} ids gone).`
);

// Step 3: silent-loss check on the two files together.
const uFinal = loadJSON(uttrykkPath);
const lost = [...removeIds].filter(
  (id) => uFinal.filter((x) => x.id === id).length !== 1 || vocabVerify.some((x) => x.id === id)
);
// A full move keeps the combined total (+1 uttrykk, -1 vocab). Finishing a half-applied move (id
// already in both files) only deletes from vocab, so the total drops by exactly that many.
const expectedTotal = combinedBefore - toDeleteOnly.length;
if (lost.length || uFinal.length + vocabVerify.length !== expectedTotal) {
  console.error('SILENT-LOSS CHECK FAILED.', {
    lost,
    expectedTotal,
    combinedAfter: uFinal.length + vocabVerify.length
  });
  process.exit(1);
}
console.log(
  `Silent-loss check OK: every id is in exactly one file, vocab + uttrykk total as expected (${expectedTotal}). Next: pnpm content:index, status.mjs, pnpm check:data.`
);
