/**
 * search-index.ts (server only)
 *
 * In-memory search index for /api/search, built from the private data
 * submodule on the first request and cached for the life of the server
 * instance. Nothing is written to disk and no index file is served, so the
 * full vocab/uttrykk data is never one download away
 * (ai-docs/implementation/search-index-gate.md).
 *
 * Replaces scripts/build-search-index.ts, which wrote a public
 * static/data/search-index.json.
 */

import type { SearchEntry } from '$lib/search';

export type SearchSource = 'vocab' | 'uttrykk';

export interface SourceRows {
  source: SearchSource;
  rows: Record<string, unknown>[];
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/**
 * Route a result opens. A1–B2 expressions live on the /{level}/uttrykk page
 * filtered by ?theme=; C has no uttrykk route (its expressions are merged into
 * /c/{category}, and ?from=uttrykk selects the expression breadcrumb and nav).
 * Vocab always opens /{level}/{category}.
 */
export function hrefFor(source: SearchSource, level: string, category: string): string {
  const l = level.toLowerCase();
  if (source !== 'uttrykk') return `/${l}/${category}`;
  return l === 'c' ? `/c/${category}?from=uttrykk` : `/${l}/uttrykk?theme=${category}`;
}

/**
 * Pure mapping from raw data rows to SearchEntry[]. Kept separate from the
 * loader so it can be unit-tested without the data submodule.
 * `id` is a positional key unique within one build; the stable id is `entryId`.
 */
export function buildSearchEntries(files: SourceRows[]): SearchEntry[] {
  const index: SearchEntry[] = [];

  for (const { source, rows } of files) {
    for (const e of rows) {
      const level = str(e.level) ?? '';
      const category = str(e.category) ?? '';
      const norsk = str(e.norsk) ?? '';
      index.push({
        id: `${source}-${level.toLowerCase()}-${String(index.length).padStart(5, '0')}`,
        entryId: str(e.id),
        sense: str(e.sense),
        norsk,
        lemma: str(e.lemma) ?? norsk,
        english: str(e.english) ?? '',
        spanish: str(e.spanish),
        ukrainian: str(e.ukrainian),
        german: str(e.german),
        example: str(e.example) ?? '',
        example_english: str(e.example_english) ?? '',
        example_spanish: str(e.example_spanish),
        example_ukrainian: str(e.example_ukrainian),
        example_german: str(e.example_german),
        definition: str(e.definition),
        level,
        category,
        part: str(e.part),
        source,
        href: hrefFor(source, level, category)
      });
    }
  }

  return index;
}

// Same dynamic-import pattern as /api/review-entries: the JSON stays in the
// server bundle and out of every client chunk.
type Loader = () => Promise<{ default: unknown }>;

const SOURCES: { file: string; source: SearchSource; load: Loader }[] = [
  { file: 'vocab-a1.json', source: 'vocab', load: () => import('$lib/data/vocab-a1.json') },
  { file: 'vocab-a2.json', source: 'vocab', load: () => import('$lib/data/vocab-a2.json') },
  { file: 'vocab-b1.json', source: 'vocab', load: () => import('$lib/data/vocab-b1.json') },
  { file: 'vocab-b2.json', source: 'vocab', load: () => import('$lib/data/vocab-b2.json') },
  { file: 'vocab-c.json', source: 'vocab', load: () => import('$lib/data/vocab-c.json') },
  { file: 'uttrykk-a1.json', source: 'uttrykk', load: () => import('$lib/data/uttrykk-a1.json') },
  { file: 'uttrykk-a2.json', source: 'uttrykk', load: () => import('$lib/data/uttrykk-a2.json') },
  { file: 'uttrykk-b1.json', source: 'uttrykk', load: () => import('$lib/data/uttrykk-b1.json') },
  { file: 'uttrykk-b2.json', source: 'uttrykk', load: () => import('$lib/data/uttrykk-b2.json') },
  { file: 'uttrykk-c.json', source: 'uttrykk', load: () => import('$lib/data/uttrykk-c.json') }
];

async function loadAll(): Promise<SearchEntry[]> {
  const files: SourceRows[] = [];
  const failed: string[] = [];
  for (const { file, source, load } of SOURCES) {
    try {
      const mod = await load();
      if (Array.isArray(mod.default)) {
        files.push({ source, rows: mod.default as Record<string, unknown>[] });
      } else {
        failed.push(file);
        console.error(`[search-index] ${file} is not an array`);
      }
    } catch (err) {
      failed.push(file);
      console.error(`[search-index] could not load ${file}:`, (err as Error).message);
    }
  }
  // Reject instead of returning a partial index: getSearchIndex does not cache a
  // rejection, so the next request retries, and the endpoint answers 503 rather
  // than 200 with missing results (503 'unavailable', see the endpoint).
  if (failed.length > 0) {
    throw new Error(`[search-index] failed to load: ${failed.join(', ')}`);
  }
  return buildSearchEntries(files);
}

let indexPromise: Promise<SearchEntry[]> | null = null;

/** Builds the index on first use; later calls reuse the same promise. */
export function getSearchIndex(): Promise<SearchEntry[]> {
  indexPromise ??= loadAll().catch((err) => {
    indexPromise = null; // allow a retry on the next request
    throw err;
  });
  return indexPromise;
}
