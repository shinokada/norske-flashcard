#!/usr/bin/env tsx
/**
 * check-slugs.ts
 *
 * Blog slug and internal-link integrity check for src/lib/posts/*.md.
 *
 * Errors (exit 1 with --strict):
 *   - a post with no `slug:` in its front matter
 *   - the same slug used by two posts (the loader matches slugs exactly, so one
 *     post would shadow the other)
 *   - a `(/blog/slug)` link, or a grammar-rule `blogSlug`, that points at a slug
 *     no post declares (404)
 *   - a vercel.json `/blog/...` redirect whose destination slug does not exist
 *   - a post links to a post that has not published yet (its `publishedAt` is after
 *     today AND after the linking post's own date), so the link is dead until the
 *     target goes live. Links inside <!-- comments --> are ignored, so park such a
 *     link as:  <!-- TODO: re-add link to [Title](/blog/slug) once ... -->
 *
 * Warnings (never fail the run):
 *   - a parked `TODO: re-add link to [..](/blog/slug)` comment whose target is now
 *     live, i.e. the link can be restored.
 *
 * Not checked: filename vs slug. They may differ on purpose
 * (fram-vs-frem.md -> fram-frem, tidspreposisjoner.md -> tidspreposisjoner-2).
 *
 * Usage:
 *   npx tsx scripts/check-slugs.ts            # report; always exit 0
 *   npx tsx scripts/check-slugs.ts --strict   # exit 1 if any error is found
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const POSTS_DIR = join(ROOT, 'src/lib/posts');
const EXTRA_DIRS = [join(ROOT, 'src/lib/data'), join(ROOT, 'src/lib/grammar')];
const STRICT = process.argv.includes('--strict');
// Local date, YYYY-MM-DD (same format as `publishedAt`).
const TODAY = new Date().toLocaleDateString('en-CA');

interface Post {
  file: string;
  slug: string | null;
  publishedAt: string | null;
  body: string;
}

const errors: string[] = [];
const warnings: string[] = [];

function rel(path: string): string {
  return relative(ROOT, path);
}

function parsePost(filename: string): Post {
  const file = join(POSTS_DIR, filename);
  const text = readFileSync(file, 'utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const front = match ? match[1] : '';
  const slug = front.match(/^slug:\s*['"]?([^'"\s]+)['"]?\s*$/m)?.[1] ?? null;
  const publishedAt = front.match(/^publishedAt:\s*['"]?(\d{4}-\d{2}-\d{2})/m)?.[1] ?? null;
  return { file, slug, publishedAt, body: match ? text.slice(match[0].length) : text };
}

// Links parked in <!-- comments --> (e.g. "re-add once published") are intentional.
function stripComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

const MD_LINK = /\]\(\/blog\/([a-z0-9-]+)(?:[#?][^)]*)?\)/g;

function linkedSlugs(text: string): string[] {
  return [...stripComments(text).matchAll(MD_LINK)].map((m) => m[1]);
}

// ── Load posts ───────────────────────────────────────────────────────────────

const posts = readdirSync(POSTS_DIR)
  .filter((f) => f.endsWith('.md'))
  .sort()
  .map(parsePost);

const bySlug = new Map<string, Post>();
for (const post of posts) {
  if (!post.slug) {
    errors.push(`${rel(post.file)}: no slug in front matter`);
    continue;
  }
  const existing = bySlug.get(post.slug);
  if (existing) {
    errors.push(
      `duplicate slug "${post.slug}": ${rel(existing.file)} and ${rel(post.file)} (one shadows the other)`
    );
    continue;
  }
  bySlug.set(post.slug, post);
}

// ── Links between posts ──────────────────────────────────────────────────────

for (const post of posts) {
  const seen = new Set<string>();
  for (const target of linkedSlugs(post.body)) {
    if (seen.has(target)) continue;
    seen.add(target);

    const targetPost = bySlug.get(target);
    if (!targetPost) {
      errors.push(`${rel(post.file)}: links to /blog/${target}, but no post has that slug`);
      continue;
    }
    if (
      post.publishedAt &&
      targetPost.publishedAt &&
      targetPost.publishedAt > post.publishedAt &&
      targetPost.publishedAt > TODAY
    ) {
      const when = post.publishedAt <= TODAY ? 'is live but' : `goes live ${post.publishedAt} and`;
      errors.push(
        `${rel(post.file)} ${when} links to /blog/${target}, ` +
          `which publishes ${targetPost.publishedAt} (park the link in a TODO comment)`
      );
    }
  }

  // A parked "re-add link" TODO whose target is now live is ready to be restored.
  for (const m of post.body.matchAll(/TODO: re-add link to \[[^\]]*\]\(\/blog\/([a-z0-9-]+)\)/g)) {
    const target = bySlug.get(m[1]);
    if (target?.publishedAt && target.publishedAt <= TODAY) {
      warnings.push(`${rel(post.file)}: /blog/${m[1]} is now live, re-add the parked link`);
    }
  }
}

// ── Links from data and grammar files ────────────────────────────────────────

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => /\.(json|ts)$/.test(f) && !f.includes('.test.'))
    .map((f) => join(dir, f));
}

const BLOG_SLUG_FIELD = /blogSlug['"]?\s*:\s*['"]([^'"]+)['"]/g;

for (const file of EXTRA_DIRS.flatMap(walk)) {
  const text = readFileSync(file, 'utf8');
  const targets = new Set([
    ...linkedSlugs(text),
    ...[...text.matchAll(BLOG_SLUG_FIELD)].map((m) => m[1])
  ]);
  for (const target of targets) {
    if (!bySlug.has(target)) {
      errors.push(`${rel(file)}: refers to blog slug "${target}", but no post has that slug`);
    }
  }
}

// ── vercel.json redirects ────────────────────────────────────────────────────

const vercelPath = join(ROOT, 'vercel.json');
if (existsSync(vercelPath)) {
  const vercel = JSON.parse(readFileSync(vercelPath, 'utf8')) as {
    redirects?: { source: string; destination: string }[];
  };
  for (const { source, destination } of vercel.redirects ?? []) {
    const m = destination.match(/^\/blog\/([a-z0-9-]+)\/?$/);
    if (m && !bySlug.has(m[1])) {
      errors.push(
        `vercel.json: redirect ${source} -> ${destination}, but no post has slug "${m[1]}"`
      );
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

console.log(`\n🔗  Blog slugs and links: ${posts.length} posts, ${bySlug.size} unique slugs`);

if (warnings.length) {
  console.log(`\n⚠️   ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  - ${w}`);
}
if (errors.length) {
  console.log(`\n❌  ${errors.length} error(s):`);
  for (const e of errors) console.log(`  - ${e}`);
} else {
  console.log('\n✅  No duplicate slugs, broken links or bad redirects');
}

if (STRICT && errors.length) process.exit(1);
