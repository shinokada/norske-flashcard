import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { VocabEntry } from '$lib/types';
import type { MetaProps } from 'runes-meta-tags';
import {
  recordContentUsage,
  shouldBlock,
  secondsUntilUtcMidnight
} from '$lib/server/content-usage';

// Phase 9 (ai-docs/implementation/uttrykk-category.md): a virtual, read-only
// "study all" deck over every uttrykk-c.json entry, regardless of category.
// Unlike [level]/[category]'s uttrykkCLoader (which only ever surfaces C's
// idioms merged into their matching vocab category page), this route exists
// purely so C has the same "study all fixed expressions" entry point A1–B2
// get via /{level}/uttrykk. uttrykk-c.json and vocab-c.json are both
// completely untouched by this route — no category filtering, no `theme`
// field, no CATEGORIES_BY_LEVEL.C change. See Phase 9's Non-goal: this route
// deliberately has no ?theme= filter — C's real categories already serve as
// its browse dimension via the existing c/{category} pages.
const uttrykkCLoader = () =>
  import('$lib/data/uttrykk-c.json') as unknown as Promise<{ default: VocabEntry[] }>;

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
  const isPlus = locals.plan === 'plus';

  // Same Plus lock as every other C category (every C category outside
  // FREE_VOCAB_CATEGORIES.C is Plus), but applied to the whole route rather
  // than a partial slice: this deck pulls entries from all 37 C categories at once,
  // so there's no clean free preview to carve out. This mirrors how A1–B2's
  // "study all" (no ?theme=) is Plus-only too — see isFreeUttrykkTheme in
  // [level]/[category]/+page.server.ts.
  if (!isPlus) {
    redirect(302, '/plus?ref=category-lock');
  }

  const uttrykkC = await uttrykkCLoader();
  const entries = uttrykkC.default;

  // Plus calls are counted (content-scraping-hardening.md, Phase 1); log-only for now.
  // Free and guest callers were redirected above, so they cost no write. A page load
  // has no JSON body to return, so a blocked call is a 429 error page.
  const usage = await recordContentUsage({
    userId: locals.user?.id,
    plan: locals.plan,
    endpoint: 'c-uttrykk',
    entries: entries.length
  });
  if (shouldBlock(usage)) {
    setHeaders({
      'Cache-Control': 'private, no-store',
      'Retry-After': String(secondsUntilUtcMidnight())
    });
    error(429, 'Too many requests today. Please try again tomorrow.');
  }

  // No dedicated OG image exists for this virtual route (scripts/generate-og.mjs
  // only pre-renders one PNG per real CATEGORIES_BY_LEVEL slug) — reuse the
  // site default rather than pointing at a path that would 404. Worth
  // revisiting with a real generated image if this route gets traction.
  const ogImage = 'https://norskeord.no/og/default.png';
  const pageTitle = 'Norwegian C Fixed Expressions & Idioms — Norskeord';
  const pageDescription = `Study all ${entries.length} advanced Norwegian idioms, proverbs, and fixed expressions at C (Mastery) level. Plus feature on Norskeord.`;

  const learningResourceSchema = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: pageTitle,
    description: pageDescription,
    educationalLevel: 'C',
    inLanguage: 'nb',
    learningResourceType: 'Flashcards',
    url: 'https://norskeord.no/c/uttrykk',
    image: ogImage,
    provider: {
      '@type': 'Organization',
      name: 'Norskeord',
      url: 'https://norskeord.no'
    }
  };

  const pageKeywords = [
    'Norwegian idioms',
    'Norwegian fixed expressions',
    'Norwegian proverbs',
    'advanced Norwegian idioms',
    'C level Norwegian uttrykk',
    'Norwegian mastery level phrases'
  ].join(', ');

  const pageMetaTags: MetaProps = {
    title: pageTitle,
    description: pageDescription,
    keywords: pageKeywords,
    og: {
      title: pageTitle,
      description: pageDescription,
      image: ogImage,
      imageWidth: '1200',
      imageHeight: '630',
      imageAlt: 'C level Norwegian fixed expressions and idioms'
    },
    twitter: {
      title: pageTitle,
      description: pageDescription,
      image: ogImage,
      imageAlt: 'C level Norwegian fixed expressions and idioms'
    }
  };

  return {
    entries,
    level: 'C' as const,
    pageMetaTags,
    learningResourceSchema
  };
};
