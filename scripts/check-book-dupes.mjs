#!/usr/bin/env node
/**
 * check-book-dupes.mjs
 *
 * Duplicate check for book-photo drafts (see
 * ai-docs/implementation/uttrykk-from-book-photos-3.md, "Duplicate check").
 * No dependencies.
 *
 * Items come from either
 *   - an inventory file ({ items: [{ n, key, expl, quiz }] }): every heading form
 *     (key, expl, quiz) of an item is checked, or
 *   - a draft entry array (uttrykk-*.json / vocab-*.json): `norsk` and `lemma`
 *     are checked.
 * They are compared with the ten production files (vocab/uttrykk a1..c) and
 * optional draft files (--draft), using both `norsk` and `lemma`.
 *
 * Classes (highest wins per item):
 *   EXACT  normalised text equal            -> skip, log the production ID
 *   NEAR   token overlap >= 0.75, one contains the other (shorter part has at
 *          least 3 words, or covers 60% of the longer and is 7+ characters), edit distance <= 2
 *          (length >= 8), or equal once å/være/bli/alt/helt/pronouns are
 *          dropped                           -> owner decides
 *   HEAD   item is one word and production has it only inside a longer
 *          phrase                            -> not a duplicate (information)
 *   INTRA  two items normalise to the same text -> owner decides
 * (The reverse HEAD case, a one-word production entry inside a longer item,
 * is not reported: it would flag most animal idioms.)
 *
 * Usage:
 *   node scripts/check-book-dupes.mjs --items draft/uttrykk/stolt-som-en-hane/inventory.json
 *   node scripts/check-book-dupes.mjs --items draft/b2/uttrykk-b2-new.json \
 *        --items draft/b2/vocab-b2-new.json            (Stage C: drafts vs production + each other)
 *   node scripts/check-book-dupes.mjs --validate
 *
 * Options:
 *   --items FILE     inventory or draft array (repeatable)
 *   --draft FILE     extra draft file to compare against (repeatable)
 *   --data-dir DIR   production data (default: src/lib/data)
 *   --out FILE       Markdown report (default: dupe-report.md next to the
 *                    first --items file if it is an inventory, else
 *                    scripts/outputs/book-dupes-report.md)
 *   --json FILE      also write the results as JSON
 *   --validate       run the self-test (known cases) and exit
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ---------------------------------------------------------------- normalise

const GENDER = /\s*\((en|et|ei|en\/ei|en\/et|en\/men)\)\s*$/i;
const PLURAL = /\s*\((b\.)?pl\.\)\s*$/i;
const UBOY = /\s*\(ubøy\.\)\s*$/i;
const CORE_DROP = new Set([
  'å', 'være', 'bli', 'alt', 'helt',
  'seg', 'meg', 'deg', 'oss', 'dere', 'dem', 'ham', 'henne', 'noen', 'noe',
]);

function tidy(s) {
  return s
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s.!?…,;:]+$/u, '')
    .replace(/^å\s+/u, '')
    .trim();
}

export function baseClean(raw) {
  let s = String(raw ?? '').toLowerCase().replace(/[«»"“”„]/gu, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(GENDER, '').replace(PLURAL, '').replace(UBOY, '');
  return s;
}

function expandParens(s) {
  const m = /\(([^()]*)\)/.exec(s);
  if (!m) return [s];
  const pre = s.slice(0, m.index);
  const post = s.slice(m.index + m[0].length);
  return [...expandParens(pre + m[1] + post), ...expandParens(pre + post)];
}

function expandSlash(s) {
  const m = /(\p{L}+)\s*\/\s*(\p{L}+)/u.exec(s);
  if (!m) return [s];
  const pre = s.slice(0, m.index);
  const post = s.slice(m.index + m[0].length);
  return [...expandSlash(pre + m[1] + post), ...expandSlash(pre + m[2] + post)];
}

/** All normalised forms of a heading: optional (parts) with and without, a/b variants split. */
export function forms(raw) {
  if (!raw || !String(raw).trim()) return [];
  const out = new Set();
  for (const a of expandParens(baseClean(raw))) {
    for (const b of expandSlash(a)) {
      const t = tidy(b);
      if (t) out.add(t);
    }
  }
  return [...out].slice(0, 16);
}

function tokenize(s) {
  return s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function makeVariants(pairs) {
  const seen = new Map();
  for (const [label, raw] of pairs) {
    for (const text of forms(raw)) {
      if (seen.has(text)) continue;
      const tokens = tokenize(text);
      const coreTokens = tokens.filter((t) => !CORE_DROP.has(t));
      seen.set(text, {
        text,
        label,
        tokens,
        tokSet: new Set(tokens),
        core: coreTokens.join(' '),
      });
    }
  }
  return [...seen.values()];
}

// -------------------------------------------------------------------- match

function editDistanceAtMost(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function containsSeq(longer, shorter) {
  if (shorter.length > longer.length) return false;
  outer: for (let i = 0; i + shorter.length <= longer.length; i++) {
    for (let j = 0; j < shorter.length; j++) if (longer[i + j] !== shorter[j]) continue outer;
    return true;
  }
  return false;
}

function matchPair(f, p) {
  if (f.text === p.text) return { cls: 'EXACT', via: p.label };
  const reasons = [];
  if (f.core && f.core === p.core) reasons.push('differs only by å/være/bli/alt/helt/pronoun');
  if (f.tokens.length >= 2 && p.tokens.length >= 2) {
    let shared = 0;
    for (const t of f.tokSet) if (p.tokSet.has(t)) shared++;
    if (shared) {
      const j = shared / (f.tokSet.size + p.tokSet.size - shared);
      if (j >= 0.75) reasons.push(`token overlap ${j.toFixed(2)}`);
      const [s, l] = f.tokens.length <= p.tokens.length ? [f.tokens, p.tokens] : [p.tokens, f.tokens];
      if (containsSeq(l, s) && (s.length >= 3 || (s.length / l.length >= 0.6 && s.join(' ').length >= 7))) reasons.push('one contains the other');
    }
  }
  if (Math.min(f.text.length, p.text.length) >= 8) {
    const d = editDistanceAtMost(f.text, p.text, 2);
    if (d <= 2) reasons.push(`edit distance ${d}`);
  }
  if (reasons.length) return { cls: 'NEAR', reason: reasons.join('; '), via: p.label };
  if (f.tokens.length === 1 && p.tokens.length >= 2 && p.tokens.includes(f.text)) {
    return { cls: 'HEAD', via: p.label };
  }
  return null;
}

const RANK = { EXACT: 3, NEAR: 2, HEAD: 1 };

// ------------------------------------------------------------------ loading

const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c'];

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function entryRecord(file, i, e) {
  return {
    uid: `${file}#${i}`,
    src: path.basename(file, '.json'),
    id: e.id || '',
    norsk: e.norsk || '',
    lemma: e.lemma || '',
    sense: (e.sense || '').trim().toLowerCase(),
    variants: makeVariants([['norsk', e.norsk], ['lemma', e.lemma]]),
  };
}

function loadProduction(dataDir) {
  const recs = [];
  const missing = [];
  for (const type of ['vocab', 'uttrykk']) {
    for (const lvl of LEVELS) {
      const file = path.join(dataDir, `${type}-${lvl}.json`);
      if (!fs.existsSync(file)) { missing.push(file); continue; }
      readJson(file).forEach((e, i) => recs.push(entryRecord(file, i, e)));
    }
  }
  return { recs, missing };
}

function loadDraft(file) {
  const abs = path.resolve(file);
  const data = readJson(abs);
  if (!Array.isArray(data)) throw new Error(`${file}: expected an array of entries`);
  return data.map((e, i) => entryRecord(abs, i, e));
}

function loadItems(file) {
  const abs = path.resolve(file);
  const data = readJson(abs);
  if (Array.isArray(data)) {
    return {
      kind: 'entries',
      file: abs,
      items: data.map((e, i) => ({
        uid: `${abs}#${i}`,
        label: `${path.basename(abs)}:${i + 1}`,
        shown: e.norsk || e.lemma || '',
        sense: (e.sense || '').trim().toLowerCase(),
        variants: makeVariants([['norsk', e.norsk], ['lemma', e.lemma]]),
      })),
    };
  }
  if (data && Array.isArray(data.items)) {
    return {
      kind: 'inventory',
      file: abs,
      items: data.items.map((it) => ({
        uid: `${abs}#n${it.n}`,
        label: `#${it.n}`,
        shown: it.quiz || it.key || it.expl || '',
        sense: '',
        variants: makeVariants([['quiz', it.quiz], ['key', it.key], ['expl', it.expl]]),
      })),
    };
  }
  throw new Error(`${file}: neither an inventory ({items}) nor an array of entries`);
}

// ------------------------------------------------------------------ analyse

function analyse(items, sources) {
  const results = [];
  for (const item of items) {
    const byProd = new Map();
    for (const rec of sources) {
      if (rec.uid === item.uid) continue;
      for (const f of item.variants) {
        for (const p of rec.variants) {
          let m = matchPair(f, p);
          if (!m) continue;
          // deliberately split senses are not duplicates (find_dupes.py rule)
          if (m.cls === 'EXACT' && item.sense && rec.sense && item.sense !== rec.sense) continue;
          let slot = byProd.get(rec.uid);
          if (!slot) { slot = { rec, best: m.cls, forms: new Map() }; byProd.set(rec.uid, slot); }
          if (RANK[m.cls] > RANK[slot.best]) slot.best = m.cls;
          const prev = slot.forms.get(f.label);
          if (!prev || RANK[m.cls] > RANK[prev.cls]) {
            slot.forms.set(f.label, { cls: m.cls, reason: m.reason, form: f.text, matched: p.text, via: p.label });
          }
        }
      }
    }
    const matches = [...byProd.values()].sort((a, b) => RANK[b.best] - RANK[a.best]);
    const cls = matches.length ? matches[0].best : 'CLEAN';
    results.push({ item, cls, matches });
  }
  return results;
}

function findIntra(items) {
  const byText = new Map();
  for (const item of items) {
    for (const v of item.variants) {
      if (!byText.has(v.text)) byText.set(v.text, new Map());
      byText.get(v.text).set(item.uid, item);
    }
  }
  const groups = new Map();
  for (const [text, m] of byText) {
    if (m.size < 2) continue;
    const key = [...m.keys()].sort().join('|');
    if (!groups.has(key)) groups.set(key, { items: [...m.values()], texts: [] });
    groups.get(key).texts.push(text);
  }
  return [...groups.values()];
}

// ------------------------------------------------------------------- report

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|');

function formSummary(slot) {
  return [...slot.forms.entries()].map(([l, f]) => `${l}: ${f.cls}`).join(', ');
}

function buildReport(results, intra, ctx) {
  const count = (c) => results.filter((r) => r.cls === c).length;
  const L = [];
  L.push(`# Duplicate report (${ctx.title})`);
  L.push('');
  L.push(`Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/check-book-dupes.mjs\`.`);
  L.push(`Items: ${results.length} from ${ctx.itemFiles.join(', ')}. `
    + `Compared with ${ctx.prodCount} production entries and ${ctx.draftCount} draft entries (both \`norsk\` and \`lemma\`).`);
  if (ctx.missing.length) L.push(`Missing production files: ${ctx.missing.join(', ')}.`);
  L.push('');
  L.push('| Class | Items | Action |');
  L.push('| --- | --- | --- |');
  L.push(`| EXACT | ${count('EXACT')} | skip, log production ID |`);
  L.push(`| NEAR | ${count('NEAR')} | owner decides |`);
  L.push(`| HEAD | ${count('HEAD')} | not a duplicate (head word only), information |`);
  L.push(`| INTRA groups | ${intra.length} | owner decides |`);
  L.push(`| CLEAN | ${count('CLEAN')} | no match |`);
  L.push('');
  L.push('An item is reported with its highest class. EXACT beats NEAR beats HEAD. '
    + 'The reverse HEAD case (a one-word production entry inside a longer item) is not reported.');
  L.push('');

  const section = (cls, title, head, row, cap) => {
    const rs = results.filter((r) => r.cls === cls);
    L.push(`## ${title} (${rs.length})`);
    L.push('');
    if (!rs.length) { L.push('None.'); L.push(''); return; }
    L.push(head[0]); L.push(head[1]);
    for (const r of rs) {
      const ms = r.matches.filter((m) => m.best === cls);
      ms.slice(0, cap).forEach((m, i) => L.push(row(r, m, i)));
      if (ms.length > cap) L.push(`| ${r.item.label} | | … +${ms.length - cap} more | | | |`);
    }
    L.push('');
  };

  section('EXACT', 'EXACT (skip)',
    ['| Item | Heading | Production | ID | File | Forms |', '| --- | --- | --- | --- | --- | --- |'],
    (r, m) => `| ${r.item.label} | ${esc(r.item.shown)} | ${esc(m.rec.norsk)} | ${m.rec.id || '(draft)'} | ${m.rec.src} | ${esc(formSummary(m))} |`, 5);
  section('NEAR', 'NEAR (owner decides)',
    ['| Item | Heading | Production | ID | File | Why | Forms |', '| --- | --- | --- | --- | --- | --- | --- |'],
    (r, m) => {
      const f = [...m.forms.values()].find((x) => x.cls === 'NEAR');
      return `| ${r.item.label} | ${esc(r.item.shown)} | ${esc(m.rec.norsk)} | ${m.rec.id || '(draft)'} | ${m.rec.src} | ${esc(f?.reason)} | ${esc(formSummary(m))} |`;
    }, 8);
  section('HEAD', 'HEAD (not duplicates, information)',
    ['| Item | Heading | Production phrases containing it | ID | File | |', '| --- | --- | --- | --- | --- | --- |'],
    (r, m) => `| ${r.item.label} | ${esc(r.item.shown)} | ${esc(m.rec.norsk)} | ${m.rec.id || '(draft)'} | ${m.rec.src} | |`, 4);

  L.push(`## INTRA (${intra.length})`);
  L.push('');
  if (!intra.length) L.push('None.');
  for (const g of intra) {
    L.push(`- ${g.items.map((i) => `${i.label} \`${i.shown}\``).join(' and ')} normalise to: ${g.texts.map((t) => `\`${t}\``).join(', ')}`);
  }
  L.push('');
  const clean = results.filter((r) => r.cls === 'CLEAN').map((r) => r.item.label);
  L.push(`## CLEAN (${clean.length})`);
  L.push('');
  L.push(clean.length ? clean.join(' ') : 'None.');
  L.push('');
  return L.join('\n');
}

// ----------------------------------------------------------------- validate

function validate(dataDir) {
  let fail = 0;
  const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fail++; };

  // normalisation
  ok(forms('«Å VÆRE FULL SOM EN ALKE»')[0] === 'være full som en alke', 'guillemets, capitals and å are removed');
  ok(forms('Din gjøk!').includes('din gjøk'), 'final ! is removed');
  ok(forms('Ingen vet hvor haren hopper....').includes('ingen vet hvor haren hopper'), 'trailing dots are removed');
  ok(forms('Å smake /lukte pyton').includes('smake pyton') && forms('Å smake /lukte pyton').includes('lukte pyton'), 'a /b variants are split');
  ok(forms('Å være dau/død som ei sild').includes('være død som ei sild'), 'dau/død variants are split');
  ok(forms('ta (alt) for god fisk').includes('ta for god fisk') && forms('ta (alt) for god fisk').includes('ta alt for god fisk'), 'optional (parts) with and without');
  ok(forms('elv (en/ei)')[0] === 'elv', 'gender marker is removed');
  ok(forms('Å skyte gullfuglen')[0] !== forms('Å skyte gullfugl')[0], 'no stemming (gullfuglen stays distinct from gullfugl)');

  const { recs, missing } = loadProduction(dataDir);
  ok(missing.length === 0 && recs.length > 1000, `production loaded (${recs.length} entries)`);

  const mk = (label, heads) => ({
    uid: `validate#${label}`, label, shown: heads[0][1], sense: '',
    variants: makeVariants(heads),
  });
  const run = (item) => analyse([item], recs)[0];

  const hk = run(mk('holde kjeft', [['key', 'Å holde kjeft']]));
  const hkHit = hk.matches.find((m) => m.rec.id === 'w-008709');
  ok(!!hkHit, `"holde kjeft" finds w-008709 (class ${hkHit?.best ?? 'none'})`);

  const f159 = run(mk('159', [['key', 'Å ta for god fisk'], ['expl', 'Å ta alt for god fisk']]));
  const hit = f159.matches.find((m) => m.rec.id === 'w-008587');
  ok(hit?.best === 'EXACT', `item 159 is EXACT against w-008587 (class ${hit?.best ?? 'none'})`);
  ok(hit?.forms.get('key')?.cls === 'EXACT', 'item 159 key form is EXACT');
  ok(['NEAR', 'EXACT'].includes(hit?.forms.get('expl')?.cls), `item 159 explanation form is NEAR or better (${hit?.forms.get('expl')?.cls ?? 'none'})`);

  const neg = run(mk('neg', [['key', 'Å flomgurgle snurrepiperen']]));
  ok(neg.cls === 'CLEAN', 'an unrelated made-up phrase has no match');

  console.log(fail ? `\n${fail} check(s) failed` : '\nAll checks passed');
  return fail ? 1 : 0;
}

// --------------------------------------------------------------------- main

function parseArgs(argv) {
  const o = { items: [], draft: [], dataDir: path.join(root, 'src', 'lib', 'data'), out: null, json: null, validate: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--items') o.items.push(argv[++i]);
    else if (a === '--draft') o.draft.push(argv[++i]);
    else if (a === '--data-dir') o.dataDir = path.resolve(argv[++i]);
    else if (a === '--out') o.out = path.resolve(argv[++i]);
    else if (a === '--json') o.json = path.resolve(argv[++i]);
    else if (a === '--validate') o.validate = true;
    else { console.error(`Unknown argument: ${a}`); process.exit(2); }
  }
  return o;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.validate) process.exit(validate(args.dataDir));
  if (!args.items.length) {
    console.error('Usage: node scripts/check-book-dupes.mjs --items FILE [--items FILE] [--draft FILE] [--out FILE] [--validate]');
    process.exit(2);
  }
  const loaded = args.items.map(loadItems);
  const items = loaded.flatMap((l) => l.items);
  const { recs: prod, missing } = loadProduction(args.dataDir);
  const drafts = args.draft.flatMap(loadDraft);
  // item files that are draft entry arrays are also comparison sources (Stage C: drafts vs each other)
  const itemSources = loaded.filter((l) => l.kind === 'entries').flatMap((l) =>
    readJson(l.file).map((e, i) => entryRecord(l.file, i, e)));
  const sources = [...prod, ...drafts, ...itemSources];

  const results = analyse(items, sources);
  const intra = findIntra(items);

  const first = loaded[0];
  const inventoryMode = first.kind === 'inventory';
  const out = args.out
    ?? (inventoryMode ? path.join(path.dirname(first.file), 'dupe-report.md')
      : path.join(__dirname, 'outputs', 'book-dupes-report.md'));
  const report = buildReport(results, intra, {
    title: inventoryMode ? 'Stage A, inventory' : 'drafts',
    itemFiles: loaded.map((l) => path.relative(root, l.file)),
    prodCount: prod.length,
    draftCount: drafts.length + itemSources.length,
    missing,
  });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, report);

  if (args.json) {
    const json = results.map((r) => ({
      item: r.item.label,
      heading: r.item.shown,
      class: r.cls,
      matches: r.matches.map((m) => ({ class: m.best, id: m.rec.id, file: m.rec.src, norsk: m.rec.norsk, forms: Object.fromEntries(m.forms) })),
    }));
    fs.writeFileSync(args.json, JSON.stringify({ results: json, intra: intra.map((g) => ({ items: g.items.map((i) => i.label), texts: g.texts })) }, null, 2));
  }

  const c = (k) => results.filter((r) => r.cls === k).length;
  console.log(`Items ${results.length}: EXACT ${c('EXACT')}, NEAR ${c('NEAR')}, HEAD ${c('HEAD')}, CLEAN ${c('CLEAN')}, INTRA groups ${intra.length}`);
  console.log(`Report: ${out}`);
  // Stage C gate: unresolved matches mean a non-zero exit
  if (!inventoryMode && (c('EXACT') || c('NEAR') || intra.length)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
