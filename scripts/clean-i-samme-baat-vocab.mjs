#!/usr/bin/env node
/**
 * clean-i-samme-baat-vocab.mjs
 *
 * Phase 2 of ai-docs/implementation/c-vocab-uttrykk-i-samme-baat-arbeidsbok.md.
 *
 * Reads draft/c/i-samme-baat-arbeidsbok/extracted-vocabularliste.json and, for
 * each entry's `norsk` field, extracts the trailing/embedded dictionary
 * markers (gender, verb conjugation class, adj./adv./prep.) into proper
 * fields — `part`, `verb_type`, and a reformatted `norsk`/`lemma` — following
 * the conventions in data-rules/vocab-and-uttrykk-v2.md.
 *
 * Also renames `explanation` → `definition` (matches VocabEntry) and keeps
 * the existing `note` field as-is (it already matches the new `note`
 * semantics documented in Phase 1 — no `explanation`-to-`note` copy needed,
 * that was based on a stale read of the source data before this field was
 * inspected directly).
 *
 * Only auto-processes entries with exactly ONE classifiable parenthetical
 * marker. Everything else (no marker at all, 2+ markers, or an
 * unrecognized marker like a spelled-out conjugation or "(flertall)") is
 * left untouched and listed in the review report — these need a human
 * decision, most of them because they're idioms with no single lexical
 * head and are likely uttrykk candidates (see Phase 4).
 *
 * Multi-word entries that DO get auto-classified as `noun` (gender marker)
 * are also flagged in the review report when they're 3+ words — a gender
 * marker on a noun buried inside a multi-word phrase doesn't necessarily
 * mean the whole phrase belongs in vocab as `part: "noun"`; it's exactly
 * the "i sin fulle tyngde" pattern the vocab-vs-uttrykk decision rule in
 * data-rules/vocab-and-uttrykk-v2.md is designed to catch in Phase 4. The
 * entry IS still auto-processed (part/verb_type/norsk are filled in), the
 * flag is just a "double check this one" note for the Phase 3/4 pass.
 *
 * Outputs:
 *   draft/c/i-samme-baat-arbeidsbok/extracted-vocabularliste-clean.json
 *   draft/c/i-samme-baat-arbeidsbok/clean-review.md
 *
 * The original extracted-vocabularliste.json is left untouched.
 *
 * Usage:
 *   node scripts/clean-i-samme-baat-vocab.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'draft/c/i-samme-baat-arbeidsbok');
const SRC_FILE = path.join(SRC_DIR, 'extracted-vocabularliste.json');
const OUT_FILE = path.join(SRC_DIR, 'extracted-vocabularliste-clean.json');
const REVIEW_FILE = path.join(SRC_DIR, 'clean-review.md');

// ── Marker classification (mirrors GENDER_PATTERN etc. in check-vocab.mjs) ──

const VERB_TYPE_RE = /^(v[1-4]|ureg\.?)(\s*,\s*(v[1-4]|ureg\.?))*$/i;
const ADJ_RE = /^adj\.?$/i;
const ADV_RE = /^adv\.?$/i;
const PREP_RE = /^prep\.?$/i;
const GENDER_M_RE = /^m$/i;
const GENDER_F_RE = /^f$/i;
const GENDER_N_RE = /^n$/i;
const GENDER_MF_RE = /^(m\/f|f\/m)$/i;

const GENDER_MARKER = {
  GENDER_M: 'en',
  GENDER_F: 'ei',
  GENDER_N: 'et',
  GENDER_MF: 'en/ei'
};

function classify(groupText) {
  const t = groupText.trim();
  if (VERB_TYPE_RE.test(t)) return 'VERB_TYPE';
  if (ADJ_RE.test(t)) return 'ADJ';
  if (ADV_RE.test(t)) return 'ADV';
  if (PREP_RE.test(t)) return 'PREP';
  if (GENDER_M_RE.test(t)) return 'GENDER_M';
  if (GENDER_F_RE.test(t)) return 'GENDER_F';
  if (GENDER_N_RE.test(t)) return 'GENDER_N';
  if (GENDER_MF_RE.test(t)) return 'GENDER_MF';
  return 'UNRECOGNIZED';
}

function normalizeVerbType(t) {
  return t
    .split(',')
    .map((p) => p.trim().toLowerCase().replace(/\.$/, ''))
    .join(', ');
}

// ── Main ──────────────────────────────────────────────────────────────────

const data = JSON.parse(fs.readFileSync(SRC_FILE, 'utf8'));

const stats = {
  auto_verb: 0,
  auto_adj: 0,
  auto_adv: 0,
  auto_prep: 0,
  auto_noun: 0,
  review_zero: 0,
  review_multi: 0,
  review_unrecognized: 0
};

const reviewItems = [];
const cleaned = [];

for (const raw of data) {
  const entry = { ...raw };
  const norsk = entry.norsk ?? '';

  // explanation -> definition (matches VocabEntry field name)
  if ('explanation' in entry) {
    entry.definition = entry.explanation ?? '';
    delete entry.explanation;
  }
  if (!('note' in entry)) entry.note = '';

  const groups = [...norsk.matchAll(/\(([^)]*)\)/g)];

  if (groups.length === 0) {
    stats.review_zero++;
    reviewItems.push({ norsk, reason: 'no marker' });
    cleaned.push(entry);
    continue;
  }

  if (groups.length > 1) {
    stats.review_multi++;
    reviewItems.push({ norsk, reason: `${groups.length} parenthetical groups` });
    cleaned.push(entry);
    continue;
  }

  const g = groups[0];
  const cls = classify(g[1]);
  const bare = (norsk.slice(0, g.index) + norsk.slice(g.index + g[0].length))
    .replace(/\s+/g, ' ')
    .trim();

  if (cls === 'VERB_TYPE') {
    stats.auto_verb++;
    entry.verb_type = normalizeVerbType(g[1]);
    entry.part = 'verb';
    entry.norsk = bare.startsWith('å ') ? bare : `å ${bare}`;
    entry.lemma = bare;
  } else if (cls === 'ADJ') {
    stats.auto_adj++;
    entry.part = 'adjective';
    entry.norsk = bare;
    entry.lemma = bare;
  } else if (cls === 'ADV') {
    stats.auto_adv++;
    entry.part = 'adverb';
    entry.norsk = bare;
    entry.lemma = bare;
  } else if (cls === 'PREP') {
    stats.auto_prep++;
    entry.part = 'preposition';
    entry.norsk = bare;
    entry.lemma = bare;
  } else if (cls in GENDER_MARKER) {
    stats.auto_noun++;
    const marker = GENDER_MARKER[cls];
    entry.part = 'noun';
    entry.norsk = `${bare} (${marker})`;
    entry.lemma = bare;
    if (bare.split(' ').length >= 3) {
      reviewItems.push({
        norsk,
        reason: `multi-word noun (${bare.split(' ').length} words) — check vocab vs uttrykk in Phase 4`
      });
    }
  } else {
    stats.review_unrecognized++;
    reviewItems.push({ norsk, reason: `unrecognized marker: (${g[1]})` });
  }

  cleaned.push(entry);
}

fs.writeFileSync(OUT_FILE, JSON.stringify(cleaned, null, 2), 'utf8');

const autoTotal =
  stats.auto_verb + stats.auto_adj + stats.auto_adv + stats.auto_prep + stats.auto_noun;
const reviewTotal = stats.review_zero + stats.review_multi + stats.review_unrecognized;

let md = `# Clean review — I samme båt vocabularliste\n\n`;
md += `Auto-processed: ${autoTotal} / ${cleaned.length}\n\n`;
md += `- verb: ${stats.auto_verb}\n- adjective: ${stats.auto_adj}\n- adverb: ${stats.auto_adv}\n- preposition: ${stats.auto_prep}\n- noun: ${stats.auto_noun}\n\n`;
md += `Needs manual review: ${reviewTotal} entries with no marker / multiple markers / an unrecognized marker (these are left untouched in the clean file — \`part\` is missing), plus any multi-word \`noun\` entries flagged below for a vocab-vs-uttrykk sanity check.\n\n`;
md += `## Review items\n\n`;
for (const { norsk, reason } of reviewItems) {
  md += `- \`${norsk}\` — ${reason}\n`;
}

fs.writeFileSync(REVIEW_FILE, md, 'utf8');

console.log(`Auto-processed: ${autoTotal} / ${cleaned.length}`);
console.log(stats);
console.log(`Review items: ${reviewItems.length}`);
console.log(`\nWrote:\n  ${OUT_FILE}\n  ${REVIEW_FILE}`);
