#!/usr/bin/env node
/**
 * merge-to-production.mjs
 *
 * Step 5 of ai-docs/instructions/work-flow.md — merges validated, ID-assigned
 * draft entries into the production data files.
 *
 * Expected to run after, in order:
 *   1. scripts/find_dupes.py    (Step 3A)
 *
 *   Also find diacritic issues
 *   node scripts/find-diacritic-issues-all.mjs b1 --dir prod
 *   node scripts/find-diacritic-issues-all.mjs b1 --dir prod --fix
 *
 *   2. scripts/check-vocab.mjs --draft / check-uttrykk.mjs --draft  (Step 3B)
 *   3. scripts/assign-ids.mjs                            (Step 4)
 *
 * For each of vocab / uttrykk, this script:
 *   1. Backs up src/lib/data/{kind}-{level}.json → {kind}-{level}.json.bak
 *      (overwrites any previous .bak, matching the project's existing convention).
 *   2. Appends draft/{level}/{kind}-{level}-new.json onto the production array
 *      and writes the merged array back to the production file.
 *   3. Renames the draft file to {kind}-{level}-new.json.merged on success, so
 *      re-running this script is a no-op instead of double-merging.
 *
 * Safety checks (abort that file's merge, others still proceed):
 *   - Every draft entry must have a non-empty id (otherwise run assign-ids.mjs first).
 *   - No duplicate id within the draft file itself.
 *   - No draft id already present in production (guards against assign-ids.mjs
 *     having run against a stale production snapshot, or merging twice).
 *   - Lemma collisions with production are reported as a warning only (not
 *     blocking) — find_dupes.py is the authoritative
 *     duplicate check (Step 3A); this is just a last-chance sanity net.
 *
 * Step 5.3 (spot-check a few entries in the running app) is manual — this
 * script does not start or query the app.
 *
 * Usage:
 *   node scripts/merge-to-production.mjs <level> [level2 ...] [options]
 *   node scripts/merge-to-production.mjs                        # all levels
 *
 * Options:
 *   --type vocab|uttrykk|both   Which file(s) to merge (default: both)
 *   --dry-run                   Report what would happen, write nothing
 *
 * Examples:
 *   node scripts/merge-to-production.mjs c --dry-run
 *   node scripts/merge-to-production.mjs c
 *   node scripts/merge-to-production.mjs c --type vocab
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync, renameSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../src/lib/data');
const DRAFT_DIR = join(__dirname, '../draft');

const ALL_LEVELS = ['a1', 'a2', 'b1', 'b2', 'c'];

const rawArgs = process.argv.slice(2);
const DRY_RUN = rawArgs.includes('--dry-run');
const typeIdx = rawArgs.indexOf('--type');
const TYPE = typeIdx !== -1 ? rawArgs[typeIdx + 1] : 'both';

if (!['vocab', 'uttrykk', 'both'].includes(TYPE)) {
  console.error(`❌  Unknown --type "${TYPE}" — must be "vocab", "uttrykk", or "both"`);
  process.exit(1);
}

const levelArgs = rawArgs.filter((a, i) => !a.startsWith('--') && rawArgs[i - 1] !== '--type');
const targetLevels = levelArgs.length > 0 ? levelArgs.map((a) => a.toLowerCase()) : ALL_LEVELS;

for (const lvl of targetLevels) {
  if (!ALL_LEVELS.includes(lvl)) {
    console.error(`❌  Unknown level "${lvl}" — must be one of ${ALL_LEVELS.join(', ')}`);
    process.exit(1);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ── Merge one file (vocab or uttrykk) for one level ──────────────────────────

function mergeOne(level, kind) {
  const prodFilename = `${kind}-${level}.json`;
  const draftFilename = `${kind}-${level}-new.json`;
  const prodPath = join(DATA_DIR, prodFilename);
  const draftPath = join(DRAFT_DIR, level, draftFilename);

  if (!existsSync(draftPath)) {
    console.log(`  ⏭️   ${draftFilename} not found — skipping`);
    return null;
  }

  const draftEntries = readJson(draftPath);
  if (draftEntries.length === 0) {
    console.log(`  ⏭️   ${draftFilename} is empty — skipping`);
    return null;
  }

  const prodEntries = existsSync(prodPath) ? readJson(prodPath) : [];

  console.log(
    `\n📄  ${draftFilename} (${draftEntries.length} entries) → ${prodFilename} (${prodEntries.length} entries)`
  );

  // 1. Every draft entry must have an id.
  const missingId = draftEntries.filter((e) => !e.id);
  if (missingId.length > 0) {
    console.log(
      `  ❌  ${missingId.length} entry(ies) missing an id — run: node scripts/assign-ids.mjs ${level} --type ${kind}`
    );
    for (const e of missingId.slice(0, 5)) console.log(`      norsk="${e.norsk ?? '(unknown)'}"`);
    if (missingId.length > 5) console.log(`      ...and ${missingId.length - 5} more`);
    console.log(`  \u2192 aborting merge for ${draftFilename}`);
    return { failed: true };
  }

  // 2. No duplicate id within the draft file itself.
  const idCounts = new Map();
  for (const e of draftEntries) idCounts.set(e.id, (idCounts.get(e.id) ?? 0) + 1);
  const draftDupes = [...idCounts.entries()].filter(([, c]) => c > 1);
  if (draftDupes.length > 0) {
    console.log(`  ❌  Duplicate id(s) within draft file:`);
    for (const [id, c] of draftDupes) console.log(`      "${id}" appears ${c} times`);
    console.log(`  \u2192 aborting merge for ${draftFilename}`);
    return { failed: true };
  }

  // 3. No draft id already present in production.
  const prodIds = new Set(prodEntries.map((e) => e.id).filter(Boolean));
  const collisions = draftEntries.filter((e) => prodIds.has(e.id));
  if (collisions.length > 0) {
    console.log(`  ❌  ${collisions.length} draft id(s) already exist in production:`);
    for (const e of collisions.slice(0, 5)) console.log(`      "${e.id}"  norsk="${e.norsk}"`);
    if (collisions.length > 5) console.log(`      ...and ${collisions.length - 5} more`);
    console.log(
      `  \u2192 aborting merge for ${draftFilename} (already merged? or assign-ids.mjs ran against a stale production file — re-run assign-ids.mjs)`
    );
    return { failed: true };
  }

  // 4. Lemma collisions with production — warning only. A draft entry whose `sense`
  //    is non-empty and different from the production entry's `sense` is a deliberate
  //    split sense (see data-rules/vocab-and-uttrykk-v2.md), not a possible duplicate.
  const prodByLemmaAll = new Map(); // lowercased lemma -> all production entries
  for (const e of prodEntries) {
    const key = (e.lemma ?? '').toLowerCase();
    if (!key) continue;
    if (!prodByLemmaAll.has(key)) prodByLemmaAll.set(key, []);
    prodByLemmaAll.get(key).push(e);
  }
  const normSense = (e) => (e.sense ?? '').trim().toLowerCase();
  const distinctSense = (a, b) =>
    normSense(a) !== '' && normSense(b) !== '' && normSense(a) !== normSense(b);
  // draft entry -> the production entry it may duplicate (first one with no distinct sense)
  const lemmaCollisions = [];
  for (const e of draftEntries) {
    if (!e.lemma) continue;
    const match = (prodByLemmaAll.get(e.lemma.toLowerCase()) ?? []).find(
      (p) => !distinctSense(e, p)
    );
    if (match) lemmaCollisions.push({ draft: e, match });
  }
  if (lemmaCollisions.length > 0) {
    console.log(
      `  ⚠️   ${lemmaCollisions.length} draft entry(ies) share a lemma with an existing production entry (possible duplicate — not blocking, double-check these):`
    );
    for (const { draft, match } of lemmaCollisions) {
      console.log(
        `      "lemma": "${draft.lemma}",  "draft_id": "${draft.id}" (${draftFilename}),  "prod_id": "${match.id ?? '?'}" (${prodFilename})\n`
      );
    }
  }

  console.log(
    `  ✅  ${draftEntries.length} entries ready to merge (production total: ${prodEntries.length} → ${prodEntries.length + draftEntries.length})`
  );

  if (DRY_RUN) {
    console.log(`  🧪  --dry-run: not writing changes`);
    return { failed: false, merged: draftEntries.length };
  }

  // Backup production file, then write the merged array.
  if (existsSync(prodPath)) {
    copyFileSync(prodPath, `${prodPath}.bak`);
  }
  const merged = [...prodEntries, ...draftEntries];
  writeJson(prodPath, merged);
  console.log(
    `  💾  Backed up ${prodFilename} → ${prodFilename}.bak and wrote ${merged.length} total entries`
  );

  // Mark the draft file as merged so re-running this script is a no-op.
  renameSync(draftPath, `${draftPath}.merged`);
  console.log(`  📦  Moved ${draftFilename} → ${draftFilename}.merged`);

  return { failed: false, merged: draftEntries.length };
}

// ── Main ──────────────────────────────────────────────────────────────────────

let anyFailure = false;
let totalMerged = 0;

for (const level of targetLevels) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🔍  Level: ${level.toUpperCase()}${DRY_RUN ? '  (dry run)' : ''}`);
  console.log(`${'═'.repeat(60)}`);

  if (TYPE === 'vocab' || TYPE === 'both') {
    const r = mergeOne(level, 'vocab');
    if (r?.failed) anyFailure = true;
    if (r?.merged) totalMerged += r.merged;
  }
  if (TYPE === 'uttrykk' || TYPE === 'both') {
    const r = mergeOne(level, 'uttrykk');
    if (r?.failed) anyFailure = true;
    if (r?.merged) totalMerged += r.merged;
  }
}

console.log(`\n${'═'.repeat(60)}`);
if (DRY_RUN) {
  console.log(`🧪  Dry run complete — ${totalMerged} entries would be merged. No files changed.`);
} else if (anyFailure) {
  console.log(`⚠️   Completed with errors — see above. Some files were not merged.`);
  process.exit(1);
} else {
  console.log(
    `✅  Done — ${totalMerged} entries merged into production. Now spot-check a few entries in the running app (Step 5.3).`
  );
}
