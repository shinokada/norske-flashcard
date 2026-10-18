#!/usr/bin/env node
/**
 * fix-diacritics-c-phase4-de2.mjs
 *
 * Phase 4 of ai-docs/implementation/uttrykk-kind-follow-up.md, German pass 3.
 * After fix-diacritics-c-phase4.mjs: words the dictionary treated as valid
 * (Luge, Tranen, Kalte, spurte, ...), compounds no dictionary knows
 * (Fingerknochel, Ruckwartsgang, Volksmarchen, ...), a few plain typos, and the
 * subjunctives (wurde -> würde, hatte -> hätte) that need the sentence.
 * Every hit was read in its sentence.
 *
 *  - MAP: whole-word replacements that are safe everywhere in the C files.
 *  - OVERRIDES: [id, field, from, to, snippet]. Replace ONE word: the whole-word
 *    occurrence of `from` that lies inside `snippet` in that entry's field. The snippet
 *    must occur exactly once and contain exactly one such word, else the run aborts
 *    before anything is written.
 *
 * Touches ONLY `german` and `example_german`.
 *
 * Usage (from the repo root):
 *   node scripts/fix-diacritics-c-phase4-de2.mjs            # dry run, prints counts
 *   node scripts/fix-diacritics-c-phase4-de2.mjs --write    # writes the files
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['src/lib/data/vocab-c.json', 'src/lib/data/uttrykk-c.json'];
const FIELDS = ['german', 'example_german'];
const WRITE = process.argv.includes('--write');

const MAP = {
  // words the dictionary accepted, or plain umlaut losses
  spurte: 'spürte',
  ware: 'wäre',
  gelahmt: 'gelähmt',
  Luge: 'Lüge',
  Lugen: 'Lügen',
  Tranen: 'Tränen',
  Kalte: 'Kälte',
  Hohe: 'Höhe',
  Starke: 'Stärke',
  qualkten: 'quälten',
  // compounds and rare words
  Angelgluck: 'Angelglück',
  Eroffnungszeile: 'Eröffnungszeile',
  Fingerknochel: 'Fingerknöchel',
  Fruhgeborene: 'Frühgeborene',
  Hefegeback: 'Hefegebäck',
  hinuberwandern: 'hinüberwandern',
  naherkam: 'näherkam',
  Pflegekraften: 'Pflegekräften',
  pflichterfullend: 'pflichterfüllend',
  Purzelbaume: 'Purzelbäume',
  Quantenverschrankung: 'Quantenverschränkung',
  Ruckwartsgang: 'Rückwärtsgang',
  Schlusselperson: 'Schlüsselperson',
  sudnorwegischen: 'südnorwegischen',
  taubgefuhlt: 'taubgefühlt',
  uberhandnehmen: 'überhandnehmen',
  vorwartskampfen: 'vorwärtskämpfen',
  vorwartsschlagen: 'vorwärtsschlagen',
  vorzukampfen: 'vorzukämpfen',
  durchkampfen: 'durchkämpfen',
  Volksmarchen: 'Volksmärchen',
  Mopkopfe: 'Mopköpfe',
  Himmelsgewolbe: 'Himmelsgewölbe',
  Eisenstuhle: 'Eisenstühle',
  Grasbushel: 'Grasbüschel',
  Grasbundel: 'Grasbündel',
  Unterflache: 'Unterfläche',
  Prufungsdatum: 'Prüfungsdatum',
  uberweltigend: 'überwältigend',
  gefraessig: 'gefräßig',
  groessten: 'größten',
  Fleischbaellchen: 'Fleischbällchen',
  // typos
  bestatigste: 'bestätigte',
  wurdenvoll: 'würdevoll',
  gruSte: 'grüßte',
  fruih: 'früh',
  prasgen: 'prägen',
  puntklich: 'pünktlich',
  Strase: 'Straße',
  Glasssplitter: 'Glassplitter',
  aufegen: 'aufregen',
  schlangte: 'schlängelte',
  angestauerter: 'angestauter',
  Schlussellochs: 'Schlüsselloch'
};

const OVERRIDES = [
  // subjunctives
  ['w-006187', 'example_german', 'wurde', 'würde', 'erwähnen wurde'],
  ['w-006962', 'example_german', 'wurde', 'würde', 'fest genug wurde'],
  ['w-009353', 'example_german', 'wurde', 'würdevoll', 'so wurde,'],
  ['w-006178', 'example_german', 'hatte', 'hätte', 'was hatte passieren'],
  ['w-006508', 'example_german', 'hatten', 'hätten', 'hatten einige der Punkte'],
  ['w-009395', 'example_german', 'hatte', 'hätte', 'Stecknadel hatte fallen'],
  // valid words that are wrong in their sentence
  ['w-006202', 'example_german', 'Bar', 'Bär', 'Der Bar fiel'],
  ['w-006190', 'example_german', 'spuren', 'spüren', 'zu spuren'],
  ['w-005845', 'example_german', 'schonen', 'schönen', 'einer schonen lyrischen'],
  ['w-006076', 'german', 'ausdrucken', 'ausdrücken', 'Händen ausdrucken'],
  ['w-009298', 'german', 'ausdrucken', 'ausdrücken', 'gut ausdrucken lernen'],
  ['w-006028', 'example_german', 'losen', 'lösen', 'zu losen'],
  ['w-006001', 'example_german', 'horten', 'hörten', 'Wir horten'],
  ['w-006436', 'example_german', 'klaren', 'klären', 'zu klaren'],
  ['w-006178', 'german', 'qualen', 'quälen', 'qualen; peinigen'],
  ['w-009344', 'german', 'halt', 'hält', 'Eis halt das'],
  ['w-005977', 'example_german', 'Stuck', 'Stücke', 'in Stuck'],
  ['w-006179', 'example_german', 'Fallen', 'Fällen', 'in vielen Fallen']
];

const WORD = /[A-Za-zÄÖÜäöüß]+/g;
const used = new Map();
const ovDone = new Set();
const problems = [];
let total = 0;

function applyOverride(entry, field, ov, n) {
  const [, , from, to, snippet] = ov;
  const s = entry[field];
  const at = s.indexOf(snippet);
  if (at < 0 || s.indexOf(snippet, at + 1) >= 0) {
    problems.push(
      `#${n} ${ov[0]} ${field}: snippet "${snippet}" found ${at < 0 ? 0 : 'more than 1'} time(s)`
    );
    return s;
  }
  const hits = [];
  for (const m of s.matchAll(WORD)) {
    if (m[0] === from && m.index >= at && m.index + from.length <= at + snippet.length)
      hits.push(m.index);
  }
  if (hits.length !== 1) {
    problems.push(
      `#${n} ${ov[0]} ${field}: "${from}" matched ${hits.length} time(s) in snippet "${snippet}"`
    );
    return s;
  }
  ovDone.add(n);
  return s.slice(0, hits[0]) + to + s.slice(hits[0] + from.length);
}

const loaded = [];
for (const rel of FILES) {
  const path = join(ROOT, rel);
  const raw = readFileSync(path, 'utf8');
  const data = JSON.parse(raw);
  const list = Array.isArray(data) ? data : Object.values(data).find(Array.isArray);
  const indent = raw.match(/^[[{]\n( +)/)?.[1].length ?? 2;
  const tail = raw.endsWith('\n') ? '\n' : '';
  if (JSON.stringify(data, null, indent) + tail !== raw) {
    console.error(`❌ ${rel}: round-trip changes the file formatting, aborting (nothing written).`);
    process.exit(1);
  }
  let fileChanges = 0;
  for (const entry of list) {
    for (const f of FIELDS) {
      if (typeof entry[f] !== 'string') continue;
      let out = entry[f];
      OVERRIDES.forEach((ov, n) => {
        if (ov[0] === entry.id && ov[1] === f) out = applyOverride({ [f]: out }, f, ov, n);
      });
      out = out.replace(WORD, (w) => {
        const fix = Object.prototype.hasOwnProperty.call(MAP, w) ? MAP[w] : null;
        if (!fix) return w;
        used.set(w, (used.get(w) ?? 0) + 1);
        return fix;
      });
      if (out !== entry[f]) {
        entry[f] = out;
        fileChanges++;
      }
    }
  }
  total += fileChanges;
  console.log(`${rel}: ${fileChanges} field(s) changed`);
  loaded.push({ path, data, indent, tail });
}
OVERRIDES.forEach((ov, n) => {
  if (!ovDone.has(n) && !problems.some((p) => p.startsWith(`#${n} `)))
    problems.push(`#${n} ${ov[0]} ${ov[1]}: entry or field not found`);
});
const unused = Object.keys(MAP).filter((k) => !used.has(k));
console.log(
  `total: ${total} field(s), ${[...used.values()].reduce((a, b) => a + b, 0)} MAP token(s) + ${ovDone.size}/${OVERRIDES.length} override(s)`
);
if (unused.length) console.log(`MAP keys never matched (${unused.length}): ${unused.join(', ')}`);
if (problems.length) {
  console.error(
    `❌ ${problems.length} override problem(s), nothing written:\n  ${problems.join('\n  ')}`
  );
  process.exit(1);
}
if (WRITE) {
  for (const { path, data, indent, tail } of loaded)
    writeFileSync(path, JSON.stringify(data, null, indent) + tail);
  console.log('✅ written');
} else {
  console.log('dry run only, nothing written (add --write)');
}
