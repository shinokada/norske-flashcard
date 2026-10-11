#!/usr/bin/env node
/**
 * build-content-index.mjs
 *
 * Derives a slim, text-free content index from the ten vocab and uttrykk files
 * (src/lib/data/{vocab,uttrykk}-{a1,a2,b1,b2,c}.json, the single source of truth).
 *
 * Writes:
 *   - src/lib/data/content-index.json
 *       { [level]: { vocab: { [category]: [id, ...] }, uttrykk: { [category]: [id, ...] } } }
 *
 * Why: stats.ts, content-lookup.ts and uttrykk-c-stats.ts only need to know which
 * category an id is in and how many entries a category has. Importing the full
 * content files into them put every vocab and uttrykk entry, Plus ones included,
 * in the client bundle (ai-docs/implementation/stats-content-gating.md). The index
 * holds ids only: no norsk text, no translations, no examples.
 *
 * Categories are sorted; ids keep the order of their source file, so diffs stay
 * small and stable.
 *
 * Safety checks: exits non-zero, and writes nothing, when an id is missing, an
 * entry has no category, an id appears twice (ids are unique across vocab AND
 * uttrykk), or the index counts do not add up to the source files.
 *
 * Usage (from project root):
 *   pnpm content:index
 *   node scripts/build-content-index.mjs
 *
 * Run automatically by `pnpm dev` and `pnpm build`. The admin editors
 * (routes/admin/vocab, routes/admin/uttrykk) write the content files directly, so
 * the index is refreshed on the next dev or build run.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../src/lib/data');
const OUT_FILE = resolve(DATA_DIR, 'content-index.json');

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C'];
const TYPES = ['vocab', 'uttrykk'];

const errors = [];
const seen = new Map(); // id -> file it was first seen in
const index = {};
let sourceTotal = 0;

for (const level of LEVELS) {
  index[level] = {};
  for (const type of TYPES) {
    const file = `${type}-${level.toLowerCase()}.json`;
    let entries;
    try {
      entries = JSON.parse(readFileSync(resolve(DATA_DIR, file), 'utf-8'));
    } catch (err) {
      errors.push(
        `${file}: cannot read or parse (${err.message}). ` +
          'Is the src/lib/data submodule checked out? (git submodule update --init)'
      );
      index[level][type] = {};
      continue;
    }

    if (!Array.isArray(entries)) {
      errors.push(`${file} did not parse to an array (got ${typeof entries})`);
      continue;
    }
    sourceTotal += entries.length;

    const byCategory = {};
    for (const e of entries) {
      if (typeof e?.id !== 'string' || e.id === '') {
        errors.push(`${file}: an entry has no id (norsk: ${JSON.stringify(e?.norsk)})`);
        continue;
      }
      if (typeof e.category !== 'string' || e.category === '') {
        errors.push(`${file}: ${e.id} has no category`);
        continue;
      }
      if (seen.has(e.id)) {
        errors.push(`duplicate id ${e.id}: in ${seen.get(e.id)} and ${file}`);
        continue;
      }
      seen.set(e.id, file);
      (byCategory[e.category] ??= []).push(e.id);
    }

    index[level][type] = Object.fromEntries(
      Object.keys(byCategory)
        .sort()
        .map((category) => [category, byCategory[category]])
    );
  }
}

const indexTotal = LEVELS.reduce(
  (sum, level) =>
    sum +
    TYPES.reduce(
      (s, type) =>
        s + Object.values(index[level][type] ?? {}).reduce((n, ids) => n + ids.length, 0),
      0
    ),
  0
);
if (errors.length === 0 && indexTotal !== sourceTotal) {
  errors.push(`Index holds ${indexTotal} ids, the source files hold ${sourceTotal}`);
}

if (errors.length > 0) {
  console.error(`Content index not written, ${errors.length} problem(s):`);
  for (const e of errors.slice(0, 20)) console.error(`  ${e}`);
  if (errors.length > 20) console.error(`  ...and ${errors.length - 20} more`);
  process.exit(1);
}

// One category per line (inline id arrays) keeps the file small and diffs readable.
function serialize() {
  const levels = LEVELS.map((level) => {
    const types = TYPES.map((type) => {
      const cats = Object.entries(index[level][type]).map(
        ([category, ids]) => `      ${JSON.stringify(category)}: ${JSON.stringify(ids)}`
      );
      const body = cats.length > 0 ? `{\n${cats.join(',\n')}\n    }` : '{}';
      return `    ${JSON.stringify(type)}: ${body}`;
    });
    return `  ${JSON.stringify(level)}: {\n${types.join(',\n')}\n  }`;
  });
  return `{\n${levels.join(',\n')}\n}\n`;
}

const out = serialize();
writeFileSync(OUT_FILE, out, 'utf-8');

const bytes = Buffer.byteLength(out, 'utf-8');
console.log(
  `✅  content-index.json: ${indexTotal} ids across ${LEVELS.length} levels ` +
    `(${(bytes / 1024).toFixed(1)} KB)`
);
