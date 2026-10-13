#!/usr/bin/env node
/**
 * normalise-norsk-field.mjs
 *
 * Normalises the `norsk` field in vocab-*.json files to the agreed format
 * (data-rules/vocab-and-uttrykk-v2.md):
 *
 *   noun       → "<lemma> (en)", "<lemma> (et)", or "<lemma> (en/ei)"  e.g. "hus (et)", "bil (en)", "ferje (en/ei)"
 *                Plural and indeclinable cards are left untouched: "bøker (pl.)", "bøkene (b.pl.)", "fjor (ubøy.)"
 *   verb       → "å <lemma>"                         e.g. "å få", "å henge"
 *   adjective  → <lemma> as-is                       e.g. "glad"
 *   other      → <lemma> as-is (no change)
 *
 * NOTE: legacy round-1 API tooling, not used in the v2 rollout
 * (ai-docs/implementation/vocab-uttrykk-v2-rollout.md). There, gender and
 * format for moved entries are set by hand in the chat batches, per the
 * per-entry move checklist. If you do run this script, run it with --dry-run first.
 *
 * For nouns the script CANNOT know the gender without a dictionary, so it uses
 * the Claude API to look up the correct article (en/et) for each noun that
 * needs one.  Verbs and adjectives require no API call.
 *
 * Usage (from repo root):
 *   node scripts/normalise-norsk-field.mjs [options]
 *
 * Options:
 *   --files   Comma-separated filenames in src/lib/data/ (default: all vocab-*.json)
 *   --dry-run Show planned changes without writing anything or calling the API
 *   --batch   Nouns per API call (default: 40)
 *   --force   Re-process entries that already look correct
 *
 * Prerequisites:
 *   ANTHROPIC_API_KEY in environment or .env file in project root
 *
 * The script writes a .bak backup of each file before overwriting it.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Resolve paths ────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../src/lib/data');

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

/** Return the value for --flag=value or --flag value, or undefined if absent. */
function getArg(flag) {
  const eqForm = args.find((a) => a.startsWith(`${flag}=`));
  if (eqForm) return eqForm.slice(flag.length + 1);
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) {
    return args[idx + 1];
  }
  return undefined;
}

const filesArg = getArg('--files');
const batchArg = getArg('--batch');

const BATCH_SIZE = batchArg ? parseInt(batchArg, 10) : 40;

// Default: every vocab-*.json file (excluding .bak)
const TARGET_FILES = filesArg
  ? filesArg.split(',').map((f) => f.trim())
  : fs
      .readdirSync(DATA_DIR)
      .filter((f) => f.startsWith('vocab-') && f.endsWith('.json') && !f.endsWith('.bak'));

// ── Load .env if present ─────────────────────────────────────────────────────

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^['"]|['"]$/g, '');
  }
}

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY && !DRY_RUN) {
  console.error('❌  ANTHROPIC_API_KEY is not set. Export it or add it to .env');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * True if norsk already matches the expected format for the given part.
 * Mirrors the rules in data-rules/vocab-and-uttrykk-v2.md:
 *   noun        → "<word> (en)", "<word> (et)", or "<word> (en/ei)"
 *                 (en/ei) is valid Bokmål for feminine nouns that accept both
 *                 the common and feminine article, e.g. "ferje (en/ei)".
 *                 Also valid: plural cards "<plural> (pl.)" / "<plural> (b.pl.)"
 *                 and indeclinable "<word> (ubøy.)". For these the lemma is the
 *                 singular or bare form, so they must never be rebuilt from it.
 *   verb        → "å <lemma>"
 *   all others  → identical to lemma (adjective, adverb, conjunction,
 *                 preposition, pronoun, numeral, interjection, phrase)
 */
function isNormalised(norsk, lemma, part) {
  if (part === 'verb') return norsk === `å ${lemma}`;
  if (part === 'noun') return /^.+\s+\((en|et|en\/ei|ei|pl\.|b\.pl\.|ubøy\.)\)$/.test(norsk);
  // Every other part: norsk should equal lemma exactly
  return norsk === lemma;
}

/**
 * Build the normalised norsk value for non-noun parts (no API needed).
 *   verb        → "å <lemma>"
 *   all others  → lemma as-is (adjective, adverb, conjunction, preposition,
 *                 pronoun, numeral, interjection, phrase)
 */
function normaliseWithoutApi(lemma, part) {
  if (part === 'verb') return `å ${lemma}`;
  return lemma;
}

// ── Claude API: look up noun genders ─────────────────────────────────────────

async function fetchNounGenders(nouns) {
  // nouns: Array<{ id, lemma }>
  // Returns: Map<id, 'en' | 'et' | null>

  const numbered = nouns.map((n, i) => `${i + 1}. ${n.lemma}`).join('\n');

  const prompt = `You are a Norwegian language expert.
For each Norwegian noun listed below, give its grammatical gender using one of these values:
- "en"    — common gender only (hankjønn or felleskjønn, e.g. "bil", "hund")
- "et"    — neuter only (intetkjønn, e.g. "hus", "barn")
- "en/ei" — dual gender: accepted as both common AND feminine in Bokmål (e.g. "ferje", "skam", "jente")

Respond ONLY with a JSON object mapping the 1-based number to the article, for example:
{"1":"en","2":"et","3":"en/ei"}
Do not include any other text, explanation, or markdown.

Nouns:
${numbered}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content?.find((b) => b.type === 'text')?.text ?? '';

  let parsed;
  try {
    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`Failed to parse gender response: ${text}`);
  }

  const result = new Map();
  nouns.forEach((n, i) => {
    const article = parsed[String(i + 1)];
    result.set(n.id, article === 'en' || article === 'et' || article === 'en/ei' ? article : null);
  });
  return result;
}

// ── Process a single file ─────────────────────────────────────────────────────

async function processFile(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found, skipping: ${filename}`);
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📄  ${filename}  (${data.length} entries)`);

  // ── Separate entries by what they need ──────────────────────────────────

  const needsApiNoun = []; // nouns that need gender lookup
  const directFixes = []; // verbs / adjectives / other that can be fixed locally
  const alreadyOk = []; // nothing to do
  const changes = new Map(); // id → new norsk value (populated during the loop and after)

  for (const entry of data) {
    const { id, norsk, lemma, part } = entry;
    if (!lemma || !part) continue; // skip malformed entries

    // Plural and indeclinable noun cards: norsk is built from the plural/bare
    // form, not from lemma (the singular), so never rebuild it, even with --force.
    if (part === 'noun' && /\s\((pl\.|b\.pl\.|ubøy\.)\)$/.test(norsk)) {
      alreadyOk.push(id);
      continue;
    }

    if (isNormalised(norsk, lemma, part) && !FORCE) {
      alreadyOk.push(id);
      continue;
    }

    if (part === 'noun') {
      // ── Legacy format detection ──────────────────────────────────────────
      // Older data sometimes used "en hus" prefix or "hus/et" slash notation
      // before the canonical "hus (et)" format was established. These should
      // no longer appear in the data, but the detection is kept here as a
      // safety net to avoid sending them to the API unnecessarily.
      const prefixMatch = norsk.match(/^(en|et)\s+(.+)$/);
      const slashMatch = norsk.match(/^.+\/(en|et|n)$/);
      // ────────────────────────────────────────────────────────────────────
      if (prefixMatch) {
        const article = prefixMatch[1];
        changes.set(id, `${lemma} (${article})`);
      } else if (slashMatch) {
        // "/n" is short for common gender → treat as "en"
        const article = slashMatch[1] === 'n' ? 'en' : slashMatch[1];
        changes.set(id, `${lemma} (${article})`);
      } else {
        needsApiNoun.push({ id, lemma });
      }
    } else {
      directFixes.push({ id, part, lemma });
    }
  }

  console.log(
    `   Already OK: ${alreadyOk.length}  |  ` +
      `Verbs/adj to fix: ${directFixes.length}  |  ` +
      `Nouns needing gender lookup: ${needsApiNoun.length}`
  );

  // ── Apply non-noun fixes immediately ───────────────────────────────────

  for (const { id, part, lemma } of directFixes) {
    changes.set(id, normaliseWithoutApi(lemma, part));
  }

  // ── Fetch noun genders in batches ───────────────────────────────────────

  if (needsApiNoun.length > 0) {
    if (DRY_RUN) {
      console.log(
        `   [DRY RUN] Would call API for ${needsApiNoun.length} nouns in batches of ${BATCH_SIZE}`
      );
      for (const { id, lemma } of needsApiNoun) {
        changes.set(id, `${lemma} (en/et?)`); // placeholder in dry-run
      }
    } else {
      console.log(`   Fetching genders for ${needsApiNoun.length} nouns…`);
      for (let i = 0; i < needsApiNoun.length; i += BATCH_SIZE) {
        const batch = needsApiNoun.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(needsApiNoun.length / BATCH_SIZE);
        process.stdout.write(`   Batch ${batchNum}/${totalBatches}… `);

        let genderMap;
        let lastErr;
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            genderMap = await fetchNounGenders(batch);
            break;
          } catch (err) {
            lastErr = err;
            const wait = attempt * 2000;
            process.stdout.write(`retry ${attempt} (${wait / 1000}s)… `);
            await sleep(wait);
          }
        }

        if (!genderMap) {
          console.error(`\n❌  All retries failed for batch ${batchNum}: ${lastErr?.message}`);
          continue;
        }

        for (const { id, lemma } of batch) {
          const article = genderMap.get(id);
          if (article) {
            changes.set(id, `${lemma} (${article})`);
          } else {
            console.warn(`\n   ⚠️  No gender returned for ${id} (${lemma}), skipping`);
          }
        }

        process.stdout.write('done\n');

        // Polite pause between batches
        if (i + BATCH_SIZE < needsApiNoun.length) await sleep(1000);
      }
    }
  }

  // ── Print plan ──────────────────────────────────────────────────────────

  if (changes.size === 0) {
    console.log('   ✅  Nothing to change.');
    return;
  }

  console.log(`\n   Changes planned (${changes.size}):`);
  for (const entry of data) {
    if (!changes.has(entry.id)) continue;
    const newVal = changes.get(entry.id);
    console.log(`   ${entry.id}`);
    console.log(`     ${entry.norsk}  →  ${newVal}`);
  }

  // ── Write ────────────────────────────────────────────────────────────────

  if (DRY_RUN) {
    console.log('\n   [DRY RUN] File not written.');
    return;
  }

  // Apply changes
  for (const entry of data) {
    if (changes.has(entry.id)) {
      entry.norsk = changes.get(entry.id);
    }
  }

  // Backup
  fs.writeFileSync(filePath + '.bak', raw, 'utf-8');

  // Write
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`\n   ✅  Written → ${filename}  (backup: ${filename}.bak)`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('\n=== normalise-norsk-field.mjs ===');
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}  |  Files: ${TARGET_FILES.join(', ')}`);
console.log(`Noun batch size: ${BATCH_SIZE}${FORCE ? '  |  --force ON' : ''}\n`);

for (const filename of TARGET_FILES) {
  await processFile(filename);
}

console.log('\n=== Done ===\n');
