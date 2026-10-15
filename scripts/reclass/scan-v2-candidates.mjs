#!/usr/bin/env node
/**
 * scan-v2-candidates.mjs  (Phase 3 of ai-docs/implementation/vocab-uttrykk-v2-rollout.md)
 *
 * READ-ONLY scan of src/lib/data/{vocab,uttrykk}-{a1,a2,b1,b2,c}.json for entries that the
 * v2 rules (data-rules/vocab-and-uttrykk-v2.md) may place in the other file. It never edits
 * a data file. It writes:
 *   scripts/outputs/v2-candidates.json   machine-readable candidate list
 *   scripts/outputs/v2-candidates.md     report for the review sessions (Phase 4)
 *   scripts/outputs/v2-baseline-ids.json id snapshot for the silent-loss check (Phase 5),
 *                                        written ONLY IF IT DOES NOT EXIST (use --refresh-baseline
 *                                        to overwrite, which you should never need after a move)
 *
 * The output is a CANDIDATE LIST, not a decision: the rules are judgment calls (dictionary
 * headword test, communicative job), and these heuristics only look at the shape of `norsk`
 * and the `category`. Every candidate is reviewed with the user in batches of about 50.
 *
 * Buckets (uttrykk -> vocab):
 *   time_expression          time adverbials (i går, om morgenen, hver dag, for lenge siden)
 *   multiword_prep_conj      multi-word prepositions / conjunctions (i lys av, forutsatt at)
 *   fixed_adverbial_chunk    fixed prepositional / adverbial chunks (på gløtt, til sjøs)
 *   legacy_verb_collocation  verb + fixed preposition (ta vare på). FLAG ONLY: Decision 2
 *                            keeps these in uttrykk until touched
 * Buckets (vocab -> uttrykk):
 *   reverse_phrase_part      vocab entry with part "phrase"
 *   reverse_idiom_category   vocab entry whose category names idioms or proverbs
 *   reverse_sentence         vocab entry that is a sentence / saying (terminal punctuation, 7+ words)
 *   reverse_discourse        vocab entry in a discourse-marker or greeting category
 *
 * Confidence: clear | borderline | flag. "clear" still needs the user's approval.
 *
 * Usage:
 *   node scripts/reclass/scan-v2-candidates.mjs
 *   node scripts/reclass/scan-v2-candidates.mjs --level b1       # report for one level (the baseline always covers all levels)
 *   node scripts/reclass/scan-v2-candidates.mjs --refresh-baseline
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR, loadJSON, normTextIgnoreA } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../outputs');
const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c'];

const argv = process.argv.slice(2);
const levelArg = argv.includes('--level') ? argv[argv.indexOf('--level') + 1] : null;
if (levelArg && !LEVELS.includes(levelArg)) {
  console.error(`--level must be one of ${LEVELS.join(', ')}`);
  process.exit(2);
}
const REFRESH_BASELINE = argv.includes('--refresh-baseline');
const reportLevels = levelArg ? [levelArg] : LEVELS;

// ── Word lists ───────────────────────────────────────────────────────────────

const PREPS = new Set(
  (
    'i på av til med ved for om under over etter fra uten mot hos mellom gjennom blant rundt langs ' +
    'innen utenfor innenfor ovenfor nedenfor foran bak før siden ifølge angående overfor'
  ).split(' ')
);

// Common light verbs that head verb + preposition collocations (flag-only bucket).
const LIGHT_VERBS = new Set(
  (
    'ta ha være bli få gjøre komme gå sette legge holde stå ligge sørge minne tenke snakke ' +
    'vise gi se sitte føle passe falle slå trekke dra bære'
  ).split(' ')
);

// Categories whose entries are idioms, sayings or formulas: these stay in uttrykk.
const STAYS_CATEGORY =
  /idiom|proverb|embodied|behavioral|interpersonal|archaic|literary|greeting|classroom/;

const TIME_NOUNS =
  'dag|dagen|morgen|morgenen|kveld|kvelden|natt|natten|ettermiddag|ettermiddagen|formiddag|formiddagen|' +
  'uke|uka|helg|helga|måned|måneden|år|året|sommer|sommeren|vinter|vinteren|høst|høsten|vår|våren|' +
  'time|timen|minutt|sekund|stund|tid|tiden|gang|fjor|forfjor|går|forgårs|overmorgen|midten|slutten|begynnelsen';
const TIME_RE = new RegExp(
  [
    `^(i|om|på|hver|hele|til|fra|før|etter|siden|for) (en |ei |et |noen |to |tre |fire |fem |mange |neste |forrige |denne |dette |samme |hele )?(${TIME_NOUNS})( (siden|tidlig|sent|igjen|etterpå|før|etter))?$`,
    `^(nå for tiden|for tiden|etter hvert|av og til|fra tid til annen|før i tiden|en gang til|en gang i uka|en gang i måneden|en gang i året|i løpet av .+|i begynnelsen|til slutt|til å begynne med|for lenge siden|for en stund siden|for noen dager siden|i morgen tidlig|i går kveld|i kveld|i natt)$`,
    `^(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)( (morgen|kveld|ettermiddag|formiddag))?$`
  ].join('|')
);

// ── Helpers ──────────────────────────────────────────────────────────────────

const words = (s) => s.trim().split(/\s+/).filter(Boolean);
const bare = (s) =>
  (s || '')
    .trim()
    .replace(/^å\s+/i, '')
    .replace(/[.?!]+$/, '');

function isSentenceLike(raw) {
  const s = (raw || '').trim();
  const nw = words(bare(s)).length;
  if (/[.?!]$/.test(s)) return true;
  if (/,/.test(s)) return true;
  if (/^[A-ZÆØÅ]/.test(s) && nw >= 3) return true; // capitalised multi-word = sentence or saying
  if (/\b(jeg|du|vi|dere|man|meg|deg)\b/i.test(s) && nw >= 3) return true;
  if (/\//.test(s) || /\bnoe\b|\bnoen\b/.test(s)) return nw >= 3; // slot markers: usually a verb frame
  return false;
}

function lastIsPrepOrAt(w) {
  const l = w[w.length - 1];
  return PREPS.has(l) || l === 'at';
}

// ── Classify one uttrykk entry (returns null if it should stay) ──────────────

function classifyUttrykk(e) {
  const raw = e.norsk || '';
  const b = bare(raw).toLowerCase();
  const w = words(b);
  const nw = w.length;
  const cat = e.category || '';
  const signals = [];

  if (STAYS_CATEGORY.test(cat)) return null;
  if (nw === 0 || isSentenceLike(raw)) return null;

  // 1. time expressions
  const timeCat = /^(time-expressions|time|days-months)$/.test(cat);
  const timeRe = TIME_RE.test(b);
  // a verb frame in a time category (ha tid, finne sted) is not an adverbial
  if (timeCat && !timeRe && /^(har|ha|finne|bli|være|få)\b/.test(b)) return null;
  if (timeRe || timeCat) {
    if (timeCat) signals.push(`category ${cat}`);
    if (timeRe) signals.push('time-expression pattern');
    if (nw <= 5 && w[0] !== 'å' && !/^(hva|hvor|når|hvem|hvordan)\b/.test(b)) {
      return { bucket: 'time_expression', confidence: timeRe ? 'clear' : 'borderline', signals };
    }
    return {
      bucket: 'time_expression',
      confidence: 'borderline',
      signals: [...signals, `${nw} words`]
    };
  }

  // 2. multi-word prepositions and conjunctions
  const fixedCat = cat === 'fixed-prepositional-phrases';
  if (fixedCat) signals.push(`category ${cat}`);
  if (nw >= 2 && nw <= 5 && PREPS.has(w[0]) && lastIsPrepOrAt(w)) {
    signals.push('prep ... prep/at frame');
    return { bucket: 'multiword_prep_conj', confidence: nw <= 4 ? 'clear' : 'borderline', signals };
  }
  if (nw >= 2 && nw <= 4 && w[nw - 1] === 'at' && !/^(å|jeg|du|han|hun|vi|de|det)$/.test(w[0])) {
    signals.push('ends in "at" (conjunction frame)');
    return { bucket: 'multiword_prep_conj', confidence: 'borderline', signals };
  }
  if (fixedCat) {
    return { bucket: 'fixed_adverbial_chunk', confidence: 'clear', signals };
  }

  // 3. fixed prepositional / adverbial chunks
  if (nw >= 2 && nw <= 4 && PREPS.has(w[0])) {
    signals.push('starts with preposition, no verb');
    return { bucket: 'fixed_adverbial_chunk', confidence: 'borderline', signals };
  }

  // 4. legacy verb + preposition collocation (flag only)
  const hadA = /^å\s/i.test(raw.trim());
  if (nw >= 2 && nw <= 4 && lastIsPrepOrAt(w) && (hadA || LIGHT_VERBS.has(w[0]))) {
    signals.push('light verb + fixed preposition');
    return { bucket: 'legacy_verb_collocation', confidence: 'flag', signals };
  }
  return null;
}

// ── Classify one vocab entry for the reverse scan ────────────────────────────

function classifyVocab(e) {
  const raw = e.norsk || '';
  const b = bare(raw);
  const nw = words(b).length;
  const cat = e.category || '';
  const out = [];
  if (e.part === 'phrase') {
    out.push({
      bucket: 'reverse_phrase_part',
      confidence: 'borderline',
      signals: ['part phrase in vocab (allowed only for a headless collocation frame)']
    });
  }
  if (/idiom|proverb/.test(cat)) {
    out.push({
      bucket: 'reverse_idiom_category',
      confidence: /proverb/.test(cat) ? 'clear' : 'borderline',
      signals: [`category ${cat}`]
    });
  }
  if (e.part !== 'interjection' && (/[.?!]$/.test(raw.trim()) || nw >= 7)) {
    out.push({
      bucket: 'reverse_sentence',
      confidence: /[.?!]$/.test(raw.trim()) ? 'borderline' : 'flag',
      signals: [/[.?!]$/.test(raw.trim()) ? 'terminal punctuation' : `${nw} words`]
    });
  }
  if (/^(discourse-markers|greetings)$/.test(cat)) {
    out.push({
      bucket: 'reverse_discourse',
      confidence: 'borderline',
      signals: [`category ${cat}`]
    });
  }
  // One entry can match several signals: keep the first bucket, merge the signals.
  if (out.length <= 1) return out[0] ?? null;
  const merged = out[0];
  for (const o of out.slice(1)) merged.signals.push(...o.signals, `also ${o.bucket}`);
  return merged;
}

// ── Load, scan ───────────────────────────────────────────────────────────────

const uttrykkByLevel = {};
const vocabByLevel = {};
for (const lv of LEVELS) {
  uttrykkByLevel[lv] = loadJSON(path.join(DATA_DIR, `uttrykk-${lv}.json`));
  vocabByLevel[lv] = loadJSON(path.join(DATA_DIR, `vocab-${lv}.json`));
}

function buildIndex(byLevel, prefix) {
  const index = new Map();
  for (const lv of LEVELS) {
    for (const e of byLevel[lv]) {
      for (const k of new Set([normTextIgnoreA(e.norsk), normTextIgnoreA(e.lemma)])) {
        if (!k) continue;
        if (!index.has(k)) index.set(k, []);
        index.get(k).push(`${e.id} (${prefix}-${lv})`);
      }
    }
  }
  return index;
}
// Used to warn that a move would create a same-text entry in the destination.
const vocabIndex = buildIndex(vocabByLevel, 'vocab');
const uttrykkIndex = buildIndex(uttrykkByLevel, 'uttrykk');

const matchesFor = (index, e) =>
  [
    ...new Set([
      ...(index.get(normTextIgnoreA(e.norsk)) ?? []),
      ...(index.get(normTextIgnoreA(e.lemma)) ?? [])
    ])
  ].filter((m) => !m.startsWith(e.id));

const candidates = [];
const totals = {};
for (const lv of LEVELS) {
  totals[lv] = { uttrykk: uttrykkByLevel[lv].length, vocab: vocabByLevel[lv].length };

  for (const e of uttrykkByLevel[lv]) {
    const c = classifyUttrykk(e);
    if (!c) continue;
    candidates.push({
      direction: 'uttrykk_to_vocab',
      level: lv,
      id: e.id,
      norsk: e.norsk,
      lemma: e.lemma,
      category: e.category,
      part: e.part,
      hasDefinition: Boolean(e.definition),
      hasKind: e.kind !== undefined,
      ...c,
      existingMatch: matchesFor(vocabIndex, e)
    });
  }

  for (const e of vocabByLevel[lv]) {
    const c = classifyVocab(e);
    if (!c) continue;
    candidates.push({
      direction: 'vocab_to_uttrykk',
      level: lv,
      id: e.id,
      norsk: e.norsk,
      lemma: e.lemma,
      category: e.category,
      part: e.part,
      hasDefinition: Boolean(e.definition),
      hasKind: e.kind !== undefined,
      ...c,
      existingMatch: matchesFor(uttrykkIndex, e)
    });
  }
}

// ── Baseline snapshot (all levels, written once) ─────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });
const baselinePath = path.join(OUT_DIR, 'v2-baseline-ids.json');
let baselineNote;
if (!fs.existsSync(baselinePath) || REFRESH_BASELINE) {
  const files = {};
  const all = [];
  for (const lv of LEVELS) {
    files[`vocab-${lv}`] = vocabByLevel[lv].map((e) => e.id);
    files[`uttrykk-${lv}`] = uttrykkByLevel[lv].map((e) => e.id);
    all.push(...files[`vocab-${lv}`], ...files[`uttrykk-${lv}`]);
  }
  const unique = new Set(all);
  fs.writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        taken: new Date().toISOString(),
        note: 'Ids before any v2 move. Phase 5 silent-loss check: every id must still exist exactly once, except entries explicitly decided for deletion.',
        total: all.length,
        unique: unique.size,
        counts: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length])),
        files
      },
      null,
      2
    ) + '\n'
  );
  baselineNote = `written (${all.length} ids, ${unique.size} unique)`;
} else {
  baselineNote = 'already exists, left untouched';
}

// ── Reports ──────────────────────────────────────────────────────────────────

const shown = candidates.filter((c) => reportLevels.includes(c.level));
const BUCKETS = [
  'time_expression',
  'multiword_prep_conj',
  'fixed_adverbial_chunk',
  'legacy_verb_collocation',
  'reverse_phrase_part',
  'reverse_idiom_category',
  'reverse_sentence',
  'reverse_discourse'
];

const count = (lv, bucket, conf) =>
  shown.filter((c) => c.level === lv && c.bucket === bucket && (!conf || c.confidence === conf))
    .length;

let md = `# v2 candidate scan\n\n`;
md += `Generated by \`scripts/reclass/scan-v2-candidates.mjs\` (read-only). A candidate list, not a decision: every line needs review (Phase 4).\n\n`;
md += `Baseline id snapshot: ${baselineNote}.\n\n`;
md += `## Counts (clear / borderline / flag per bucket and level)\n\n`;
md += `| Bucket | ${reportLevels.map((l) => l.toUpperCase()).join(' | ')} | Total |\n| --- | ${reportLevels.map(() => '---').join(' | ')} | --- |\n`;
for (const b of BUCKETS) {
  const cells = reportLevels.map((lv) =>
    count(lv, b)
      ? `${count(lv, b, 'clear')}/${count(lv, b, 'borderline')}/${count(lv, b, 'flag')}`
      : '0'
  );
  md += `| ${b} | ${cells.join(' | ')} | ${shown.filter((c) => c.bucket === b).length} |\n`;
}
const clearU = shown.filter(
  (c) => c.direction === 'uttrykk_to_vocab' && c.confidence === 'clear'
).length;
md += `\n**Decision 2 check:** ${clearU} clear-cut uttrykk → vocab candidates in the scanned levels. A few dozen: one batch. Hundreds: revisit Decision 2.\n\n`;
md += `Totals scanned: ${reportLevels.map((lv) => `${lv.toUpperCase()} ${totals[lv].uttrykk} uttrykk / ${totals[lv].vocab} vocab`).join('; ')}.\n`;

const order = { clear: 0, borderline: 1, flag: 2 };
for (const b of BUCKETS) {
  const rows = shown.filter((c) => c.bucket === b);
  if (!rows.length) continue;
  md += `\n## ${b} (${rows.length})\n\n`;
  md += `| Level | id | norsk | category | part | conf | def | signals / existing match |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  rows.sort(
    (a, z) =>
      LEVELS.indexOf(a.level) - LEVELS.indexOf(z.level) ||
      order[a.confidence] - order[z.confidence] ||
      a.norsk.localeCompare(z.norsk, 'nb')
  );
  for (const r of rows) {
    const extra = [
      ...r.signals,
      ...(r.existingMatch.length ? [`SAME TEXT EXISTS: ${r.existingMatch.join(', ')}`] : [])
    ].join('; ');
    md += `| ${r.level.toUpperCase()} | ${r.id} | ${r.norsk.replace(/\|/g, '\\|')} | ${r.category} | ${r.part} | ${r.confidence} | ${r.hasDefinition ? 'yes' : 'no'} | ${extra} |\n`;
  }
}

fs.writeFileSync(path.join(OUT_DIR, 'v2-candidates.md'), md);
fs.writeFileSync(
  path.join(OUT_DIR, 'v2-candidates.json'),
  JSON.stringify(
    { generated: new Date().toISOString(), levels: reportLevels, totals, candidates: shown },
    null,
    2
  ) + '\n'
);

console.log(`Scanned ${LEVELS.length} levels. Baseline: ${baselineNote}.`);
console.log(
  `Wrote scripts/outputs/v2-candidates.md and .json (${shown.length} candidates, no data file modified).`
);
for (const b of BUCKETS) {
  const n = shown.filter((c) => c.bucket === b).length;
  if (n) {
    const clear = shown.filter((c) => c.bucket === b && c.confidence === 'clear').length;
    console.log(`  ${b.padEnd(26)} ${String(n).padStart(4)}   (clear ${clear})`);
  }
}
