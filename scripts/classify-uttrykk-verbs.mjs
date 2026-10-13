#!/usr/bin/env node
/**
 * classify-uttrykk-verbs.mjs
 *
 * Mirror of classify-vocab-phrases.mjs, for the reverse direction.
 *
 * Reads all uttrykk-xx.json files, pre-filters entries that are
 * *structurally shaped* like a verb-headed phrase (reflexive verb, particle
 * verb), and uses the Claude API to decide whether each one actually
 * functions as a single conjugatable verb lemma (→ belongs in vocab) or is
 * a figurative idiom, ordtak or communicative formula (→ stays in
 * uttrykk), per the rules in data-rules/vocab-and-uttrykk-v2.md.
 *
 * NOTE: round-1 API tooling. The v2 rollout reviews candidates in chat
 * batches of about 50 (no API), and the v2 candidate scan is
 * scripts/reclass/scan-v2-candidates.mjs (Phase 3 of
 * ai-docs/implementation/vocab-uttrykk-v2-rollout.md). This script only
 * covers verb-shaped entries; its prompt mirrors the v2 rules and does not
 * read the rules file, so update both together.
 *
 * Outputs:
 *   scripts/output/uttrykk-verb-classification.json   (machine-readable)
 *   scripts/output/uttrykk-verb-classification.md      (human-readable report)
 *
 * Usage:
 *   node scripts/classify-uttrykk-verbs.mjs
 *   node scripts/classify-uttrykk-verbs.mjs --batch-size=10   (default 20)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'src/lib/data');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'scripts/output');

const UTTRYKK_FILES = [
  'uttrykk-a1.json',
  'uttrykk-a2.json',
  'uttrykk-b1.json',
  'uttrykk-b2.json',
  'uttrykk-c.json'
];

const BATCH_SIZE = parseInt(
  process.argv.find((a) => a.startsWith('--batch-size='))?.split('=')[1] ?? '20'
);

// Kept in sync by hand with CATEGORIES_BY_LEVEL in src/lib/config.ts
// ("uttrykk" / "uttrykk-preview" stripped — not valid destinations for a
// migrated vocab entry). Passed to the model so its suggested_category is
// always a real, existing category rather than an invented one.
const VOCAB_CATEGORIES_BY_LEVEL = {
  a1: [
    'greetings',
    'numbers',
    'colors',
    'family',
    'body',
    'food',
    'animals',
    'home',
    'days-months',
    'classroom',
    'adjectives',
    'verbs',
    'pronouns-and-questions',
    'feelings',
    'weather',
    'transportation',
    'household-items',
    'places',
    'clothes',
    'actions'
  ],
  a2: [
    'shopping',
    'transport',
    'clothing',
    'hobbies',
    'directions',
    'occupations',
    'sports',
    'health',
    'weather',
    'time',
    'descriptive-adjectives',
    'cooking',
    'nature',
    'house-chores',
    'communication',
    'body',
    'social-life',
    'technology',
    'environment',
    'money'
  ],
  b1: [
    'travel',
    'environment',
    'media',
    'culture',
    'technology',
    'relationships',
    'education',
    'work',
    'city-life',
    'traditions',
    'expressing-opinions',
    'cooking',
    'accommodation',
    'health',
    'finance',
    'personal-growth',
    'reasoning',
    'society',
    'communication-skills',
    'urban-life',
    'mental-wellbeing',
    'fitness',
    'arts-culture',
    'economics',
    'sustainability',
    'science-nature',
    'journalism',
    'workplace',
    'family',
    'politics',
    'language-learning',
    'healthcare'
  ],
  b2: [
    'politics',
    'economics',
    'social-issues',
    'arts',
    'science',
    'emotions',
    'history',
    'law',
    'literature',
    'advanced-adjectives',
    'philosophy',
    'medicine',
    'psychology',
    'business',
    'religion',
    'environment',
    'technology',
    'media',
    'education',
    'language',
    'argumentation',
    'abstract-nouns',
    'advanced-verbs',
    'geography',
    'culture',
    'global-issues',
    'academic-language',
    'discourse-markers',
    'work-career',
    'relationships',
    'communication'
  ],
  c: [
    'philosophy',
    'academic',
    'formal-writing',
    'rhetoric',
    'complex-emotions',
    'professional',
    'abstract-concepts',
    'politics-democracy',
    'linguistics',
    'media-journalism',
    'architecture-design',
    'diplomacy-international',
    'finance-economics',
    'medicine-healthcare',
    'psychology-advanced',
    'literary',
    'archaic',
    'proverbs',
    'highly-formal',
    'technical',
    'advanced-law-justice',
    'neuroscience-cognition',
    'climate-environment-policy',
    'sociology-anthropology',
    'advanced-business-strategy',
    'existential-abstract',
    'nature-landscape',
    'sensory-sound',
    'physical-appearance',
    'everyday-objects',
    'character-temperament',
    'embodied-emotion',
    'manner-of-motion',
    'interpersonal-conflict',
    'intensifiers-degree',
    'gastronomy',
    'cultural-heritage'
  ]
};

// ── Load API key from .env if present ────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const [k, ...rest] = line.split('=');
    if (k && rest.length) {
      process.env[k.trim()] = rest
        .join('=')
        .trim()
        .replace(/^["']|["']$/g, '');
    }
  }
}

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY is not set.');
  console.error('   Add it to your .env file or run:');
  console.error('   ANTHROPIC_API_KEY=your-key node scripts/classify-uttrykk-verbs.mjs');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Heuristic pre-filter — collect uttrykk entries shaped like verb phrases
// ---------------------------------------------------------------------------

// Common Norwegian verb particles / directional adverbs. A two-to-four-word
// entry whose second token is one of these is structurally identical to a
// particle verb (slå av, kle på, gå ut) — cheap, high-recall signal.
const PARTICLES = new Set([
  'av',
  'på',
  'opp',
  'ned',
  'ut',
  'inn',
  'ute',
  'inne',
  'fram',
  'frem',
  'tilbake',
  'sammen',
  'bort',
  'vekk',
  'igjen',
  'unna',
  'forbi',
  'gjennom',
  'over',
  'under',
  'til',
  'fra',
  'med',
  'etter',
  'omkring',
  'rundt',
  'imot',
  'mot'
]);

function looksVerbShaped(norsk) {
  const text = norsk.toLowerCase().trim();
  // Full sentences / dialogue lines are never verb-lemma candidates.
  if (text.includes('?') || text.includes('!') || /[.][^$]/.test(text.slice(0, -1))) {
    return false;
  }
  const words = text.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;

  // Reflexive shape: "... seg" or "... seg ..." (ta seg tid, føle seg vel)
  if (words.includes('seg')) return true;

  // Particle-verb shape: second word is a known particle
  if (PARTICLES.has(words[1])) return true;

  return false;
}

function collectCandidateEntries() {
  const results = [];
  for (const file of UTTRYKK_FILES) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠ Not found, skipping: ${file}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const level = file.replace('uttrykk-', '').replace('.json', '');
    for (const entry of data) {
      if (looksVerbShaped(entry.norsk)) {
        results.push({ ...entry, _level: level, _sourceFile: file });
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// 2. Claude API call — classify a batch
// ---------------------------------------------------------------------------

function systemPromptForLevel(level) {
  const categories = VOCAB_CATEGORIES_BY_LEVEL[level] ?? [];
  return `You are a Norwegian language pedagogy expert helping classify expressions, per the rules in data-rules/vocab-and-uttrykk-v2.md.

Each entry currently lives in an uttrykk-xx.json file (usually part: "phrase"). All of them are structurally shaped like a reflexive or particle verb phrase (contain "seg", or a verb followed by a directional particle like "av", "på", "opp", "ut").

Apply the v2 decision rule in order:
1. Is it a figurative idiom (non-literal meaning tied to a situation) or an ordtak? Then it stays in uttrykk, even if it starts with a conjugating verb.
2. Dictionary-headword test: would Bokmålsordboka/NAOB list it as a verb (or sub-headword with a word class) that a learner conjugates and uses productively? Then it belongs in vocab. This includes reflexive verbs, particle verbs, ordinary verb + fixed preposition collocations ("sørge for", "ta hensyn til") and literal verb + fixed complement frames ("være i stand til", "bli kvitt").
3. Is it a communicative formula (greeting, politeness, discourse marker)? Then it stays in uttrykk.

The question is NOT "is the meaning compositional?"; it is whether the entry works as a dictionary verb headword.

Classify each entry as exactly one of:
- "move_to_vocab": A reflexive verb, particle verb, verb + fixed preposition collocation or literal verb + fixed complement frame that a dictionary would list as a verb with its own conjugation (present/past/perfect), even though it's written as more than one word. Examples: "kle på seg", "føle seg", "slå av", "snakke med", "ta seg tid", "gi opp", "ta vare på", "være i stand til". These belong in vocab-xx.json as part: "verb". Note: legacy verb collocations such as "ta vare på" and "ha lyst til" are only flagged here; the rollout leaves them in uttrykk until touched (Decision 2 in the rules doc).
- "stays_uttrykk": A figurative idiom, ordtak or communicative formula that happens to contain "seg" or a particle-like word, but is not a verb headword a learner would look up — e.g. the meaning is figurative ("slå seg til ro", "ha is i magen"), it is frozen in one form, or it works as a discourse marker.
- "borderline": Cases where reasonable people could disagree, or where you'd want to check a Norwegian dictionary (NAOB/Bokmålsordboka) before deciding.

For "move_to_vocab" entries, also suggest:
- "suggested_category": pick the single best-fitting category from this exact list for level ${level.toUpperCase()} (do not invent a new one): ${JSON.stringify(categories)}

Respond ONLY with a valid JSON array (no markdown, no explanation) with one object per entry:
{
  "id": "<entry id>",
  "classification": "move_to_vocab" | "stays_uttrykk" | "borderline",
  "suggested_category": "<one of the allowed categories, or null if not move_to_vocab>",
  "reason": "<one concise sentence explaining why>"
}`;
}

async function classifyBatch(entries, level) {
  const userContent = JSON.stringify(
    entries.map((e) => ({
      id: e.id,
      norsk: e.norsk,
      english: e.english,
      level: e._level
    })),
    null,
    2
  );

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPromptForLevel(level),
      messages: [{ role: 'user', content: userContent }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content.map((b) => b.text || '').join('');

  try {
    return JSON.parse(text);
  } catch {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  }
}

// ---------------------------------------------------------------------------
// 3. Generate markdown report
// ---------------------------------------------------------------------------

function generateMarkdown(allEntries, classifications) {
  const byId = Object.fromEntries(classifications.map((c) => [c.id, c]));

  const moveToVocab = allEntries.filter((e) => byId[e.id]?.classification === 'move_to_vocab');
  const staysUttrykk = allEntries.filter((e) => byId[e.id]?.classification === 'stays_uttrykk');
  const borderline = allEntries.filter((e) => byId[e.id]?.classification === 'borderline');
  const failed = allEntries.filter((e) => !byId[e.id]);

  const row = (e) => {
    const c = byId[e.id];
    return `| ${e.id} | ${e.norsk} | ${e.english} | ${e._level} | ${c?.suggested_category ?? '—'} | ${c?.reason ?? '—'} |`;
  };

  const table = (entries) =>
    entries.length === 0
      ? '_None_\n'
      : `| ID | Norsk | English | Level | Suggested category | Reason |\n|---|---|---|---|---|---|\n${entries.map(row).join('\n')}\n`;

  return `# Uttrykk → Vocab Verb Classification Report

Generated: ${new Date().toISOString()}

## Summary

| Type | Count | Action |
|------|-------|--------|
| Move to vocab (genuine reflexive/particle verb) | ${moveToVocab.length} | → Move to vocab-xx.json as part: "verb" |
| Stays uttrykk (genuine idiom, not a conjugatable verb) | ${staysUttrykk.length} | → No change |
| Borderline | ${borderline.length} | → Needs manual review |
| Failed to classify | ${failed.length} | → Check logs |
| **Total candidates scanned** | **${allEntries.length}** | |

---

## Move to Vocab

${table(moveToVocab)}

---

## Stays Uttrykk

${table(staysUttrykk)}

---

## Borderline — Needs Manual Review

${table(borderline)}

${failed.length > 0 ? `---\n\n## Failed to Classify\n\n${failed.map((e) => `- ${e.id}: ${e.norsk}`).join('\n')}\n` : ''}
---

_Next step: review the "Move to Vocab" entries above, then run \`migrate-to-vocab.mjs\` with this JSON output._
`;
}

// ---------------------------------------------------------------------------
// 4. Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('📂 Collecting verb-shaped candidates from uttrykk files…');
  const allEntries = collectCandidateEntries();
  console.log(`   Found ${allEntries.length} structurally verb-shaped entries\n`);

  if (allEntries.length === 0) {
    console.log('Nothing to classify. Exiting.');
    return;
  }

  // Group by level so each batch gets the right category list in its system prompt
  const byLevel = {};
  for (const e of allEntries) {
    if (!byLevel[e._level]) byLevel[e._level] = [];
    byLevel[e._level].push(e);
  }

  const allClassifications = [];

  for (const [level, levelEntries] of Object.entries(byLevel)) {
    const batches = [];
    for (let i = 0; i < levelEntries.length; i += BATCH_SIZE) {
      batches.push(levelEntries.slice(i, i + BATCH_SIZE));
    }

    console.log(
      `🤖 [${level.toUpperCase()}] Classifying ${levelEntries.length} entries in ${batches.length} batch(es)…`
    );

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      process.stdout.write(`   Batch ${i + 1}/${batches.length} (${batch.length} entries)… `);
      try {
        const results = await classifyBatch(batch, level);
        allClassifications.push(...results);
        console.log(`✓ (${results.length} classified)`);
      } catch (err) {
        console.log(`✗ ERROR: ${err.message}`);
        console.error('   Entries in failed batch:', batch.map((e) => e.id).join(', '));
      }
      if (i < batches.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  const byId = Object.fromEntries(allClassifications.map((c) => [c.id, c]));
  const enriched = allEntries.map((e) => ({
    ...e,
    classification: byId[e.id]?.classification ?? null,
    suggested_category: byId[e.id]?.suggested_category ?? null,
    reason: byId[e.id]?.reason ?? null
  }));

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const jsonPath = path.join(OUTPUT_DIR, 'uttrykk-verb-classification.json');
  fs.writeFileSync(jsonPath, JSON.stringify(enriched, null, 2), 'utf8');

  const mdPath = path.join(OUTPUT_DIR, 'uttrykk-verb-classification.md');
  fs.writeFileSync(mdPath, generateMarkdown(allEntries, allClassifications), 'utf8');

  const counts = { move_to_vocab: 0, stays_uttrykk: 0, borderline: 0 };
  for (const c of allClassifications)
    counts[c.classification] = (counts[c.classification] ?? 0) + 1;

  console.log(`
✅ Done!

   Move to vocab:  ${counts.move_to_vocab}
   Stays uttrykk:  ${counts.stays_uttrykk}
   Borderline:     ${counts.borderline}
   Failed:         ${allEntries.length - allClassifications.length}

   Output files:
   → ${jsonPath}
   → ${mdPath}
`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
