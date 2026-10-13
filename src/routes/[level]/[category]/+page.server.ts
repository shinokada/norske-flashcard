import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { VocabEntry } from '$lib/types';
import { CATEGORIES_BY_LEVEL } from '$lib/config';
import { isPlusCategory } from '$lib/access';
import { isFreeUttrykkTheme } from '$lib/uttrykk-gating';
import { uttrykkCCategoryCounts } from '$lib/uttrykk-c-stats';
import type { CEFRLevel } from '$lib/types';
import type { UttrykkThemeLevel } from '$lib/config';
import type { MetaProps } from 'runes-meta-tags';
import { removeHyphensAndCapitalize } from '$lib/utils';
import { partitionUttrykkThemes, UTTRYKK_OTHERS_THEME } from '$lib/vocab-helpers';
import { buildTeaser } from '$lib/teaser';

// ---------------------------------------------------------------------------
// Vocab loaders — imported server-side so the JSON is never bundled into the
// client chunk. Dynamic import() works fine in a +page.server.ts context.
// ---------------------------------------------------------------------------

const vocabLoaders: Record<string, () => Promise<{ default: VocabEntry[] }>> = {
  a1: () => import('$lib/data/vocab-a1.json') as unknown as Promise<{ default: VocabEntry[] }>,
  a2: () => import('$lib/data/vocab-a2.json') as unknown as Promise<{ default: VocabEntry[] }>,
  b1: () => import('$lib/data/vocab-b1.json') as unknown as Promise<{ default: VocabEntry[] }>,
  b2: () => import('$lib/data/vocab-b2.json') as unknown as Promise<{ default: VocabEntry[] }>,
  // C1/C2 were merged into a single combined deck — see vocab-c.json
  c: () => import('$lib/data/vocab-c.json') as unknown as Promise<{ default: VocabEntry[] }>
};

// Full uttrykk decks — gated per-theme (see $lib/uttrykk-gating), not
// per-category. A free user can only ever end up with entries from
// FREE_UTTRYKK_THEMES for their level; everything else redirects to /plus
// (see the gating check right after groupByTheme() is called, below).
const uttrykkLoaders: Record<string, () => Promise<{ default: VocabEntry[] }>> = {
  'a1/uttrykk': () =>
    import('$lib/data/uttrykk-a1.json') as unknown as Promise<{ default: VocabEntry[] }>,
  'a2/uttrykk': () =>
    import('$lib/data/uttrykk-a2.json') as unknown as Promise<{ default: VocabEntry[] }>,
  'b1/uttrykk': () =>
    import('$lib/data/uttrykk-b1.json') as unknown as Promise<{ default: VocabEntry[] }>,
  'b2/uttrykk': () =>
    import('$lib/data/uttrykk-b2.json') as unknown as Promise<{ default: VocabEntry[] }>
};

// C-level uttrykk — fixed expressions/idioms, each tagged with a real C
// category slug (see ai-docs/implementation/uttrykk-category.md Phase 4).
// Unlike A1–B2, C has no separate "uttrykk" route/gate — these are merged
// in at read time alongside the matching vocab-c category below, rather
// than being folded into vocab-c.json itself (that would misclassify
// idioms as vocab lemmas — see data-rules/vocab-and-uttrykk-v2.md).
const uttrykkCLoader = () =>
  import('$lib/data/uttrykk-c.json') as unknown as Promise<{ default: VocabEntry[] }>;

// ---------------------------------------------------------------------------
// Server load — runs on every request; HTML is pre-rendered for Google.
// locals.plan is set by hooks.server.ts before this runs.
// ---------------------------------------------------------------------------

export const load: PageServerLoad = async ({ params, locals, url, setHeaders }) => {
  const { level, category } = params;
  const isPlus = locals.plan === 'plus';

  // Redirect old c1/c2 category URLs to the combined /c/ route
  if (level === 'c1' || level === 'c2') {
    redirect(301, `/c/${category}`);
  }

  // Phase 3 (ai-docs/implementation/uttrykk-gate.md): the old flat 10-item
  // teaser deck is retired now that uttrykk is gated per-theme (Phase 1) —
  // every old preview link/bookmark now points at the real deck instead.
  // Applies to both free and Plus users; Plus was already silently
  // redirected internally to the full deck when hitting this URL, this just
  // makes that explicit and applies it to free users too. A free user
  // landing on `/{level}/uttrykk` with no `?theme=` then hits the per-theme
  // gate's own redirect to /plus below, same as any other "study all"
  // request.
  if (category === 'uttrykk-preview') {
    redirect(301, `/${level.toLowerCase()}/uttrykk`);
  }

  // Gate. A free visitor on a Plus-only vocab category gets the locked teaser
  // (Phase 3, ai-docs/implementation/locked-teaser-social-login.md) instead of a
  // redirect. `uttrykk` is never in PLUS_CATEGORIES (it is gated per theme, see
  // the uttrykk branch below, Phase 5), so `locked` is only true for vocab.
  const locked = !isPlus && isPlusCategory(level, category);

  const key = `${level.toLowerCase()}/${category}`;
  const levelUpper = level.toUpperCase() as CEFRLevel;
  const categoryName = removeHyphensAndCapitalize(category);

  // ── Prev / Next category navigation ────────────────────────────────────────
  // Build the visible category list for this level. `uttrykk` itself is
  // excluded for free users (same as any other locked stop) — the full deck
  // (`/{level}/uttrykk` with no ?theme=) is still Plus-only even though
  // individual free themes are reachable via the hub's per-pill links (see
  // ai-docs/implementation/uttrykk-gate.md Phase 1) — prev/next nav only
  // ever points at the plain, theme-less URL, so including it here would
  // send a free user straight into the /plus redirect mid-flashcard-session.
  const allCats: string[] = [...(CATEGORIES_BY_LEVEL[levelUpper] ?? [])];
  const visibleCats: string[] = isPlus
    ? allCats
    : allCats.filter((c) => c !== 'uttrykk' && !isPlusCategory(level, c));

  const idx = visibleCats.indexOf(category);
  const prevSlug = idx > 0 ? visibleCats[idx - 1] : null;
  const nextSlug = idx !== -1 && idx < visibleCats.length - 1 ? visibleCats[idx + 1] : null;

  // C's Uttrykk hub pills link to this same /{level}/{category} page (see
  // Phase 8 — C has no separate uttrykk route, its idioms are merged into
  // the matching vocab category), so this one boolean drives two things
  // below: which prev/next sequence to use, and whether to show the
  // "came from Uttrykk" breadcrumb on the page itself.
  const fromUttrykk = levelUpper === 'C' && url.searchParams.get('from') === 'uttrykk';

  const prevCategory = prevSlug
    ? {
        slug: prevSlug,
        label: removeHyphensAndCapitalize(prevSlug),
        href: `/${level.toLowerCase()}/${prevSlug}`
      }
    : null;
  const nextCategory = nextSlug
    ? {
        slug: nextSlug,
        label: removeHyphensAndCapitalize(nextSlug),
        href: `/${level.toLowerCase()}/${nextSlug}`
      }
    : null;

  // When a free user reaches the end of the visible category list, show a
  // Plus badge for the level's locked categories instead of hiding the arrow.
  const nextLocked =
    !isPlus && !nextCategory
      ? (() => {
          const lockedCount = allCats.filter((c) => isPlusCategory(level, c)).length;
          return lockedCount > 0
            ? { count: lockedCount, href: '/plus?ref=flashcard-nav-end' }
            : null;
        })()
      : null;

  // C's Uttrykk hub pills reuse this same /{level}/{category} page (see
  // Phase 8 — C has no separate uttrykk route, its idioms are merged into
  // the matching vocab category), so a click there and a click on the
  // Vocabulary pill for the same category land on an identical URL. Without
  // a marker, prevCategory/nextCategory above (built from the level's full,
  // alphabetical CATEGORIES_BY_LEVEL order) silently take over regardless of
  // which section the visitor actually came from — e.g. "Interpersonal
  // Conflict", reached via its Uttrykk pill (sorted by entry count, matching
  // the hub), would step Next into "Intensifiers Degree" (its alphabetical
  // vocab neighbour) instead of "Character Temperament" (its Uttrykk-count
  // neighbour) — the same class of bug fixed earlier for A1–B2's uttrykk
  // theme nav. The hub tags its C Uttrykk pills with `?from=uttrykk` so this
  // page can tell the two entry points apart and switch the nav sequence.
  let prevCategoryFinal = prevCategory;
  let nextCategoryFinal = nextCategory;
  let nextLockedFinal = nextLocked;

  if (fromUttrykk) {
    const uttrykkCList = [...uttrykkCCategoryCounts().entries()]
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count);
    const uttrykkCVisible = isPlus
      ? uttrykkCList
      : uttrykkCList.filter((t) => !isPlusCategory(level, t.theme));

    const cIdx = uttrykkCVisible.findIndex((t) => t.theme === category);
    const cPrev = cIdx > 0 ? uttrykkCVisible[cIdx - 1] : null;
    const cNext =
      cIdx !== -1 && cIdx < uttrykkCVisible.length - 1 ? uttrykkCVisible[cIdx + 1] : null;

    prevCategoryFinal = cPrev
      ? {
          slug: cPrev.theme,
          label: removeHyphensAndCapitalize(cPrev.theme),
          href: `/${level.toLowerCase()}/${cPrev.theme}?from=uttrykk`
        }
      : null;
    nextCategoryFinal = cNext
      ? {
          slug: cNext.theme,
          label: removeHyphensAndCapitalize(cNext.theme),
          href: `/${level.toLowerCase()}/${cNext.theme}?from=uttrykk`
        }
      : null;
    nextLockedFinal =
      !isPlus && !cNext
        ? (() => {
            const lockedCount = uttrykkCList.length - uttrykkCVisible.length;
            return lockedCount > 0
              ? { count: lockedCount, href: '/plus?ref=uttrykk-c-nav-end' }
              : null;
          })()
        : null;
  }

  // Build shared meta
  const ogImage = `https://norskeord.no/og/deck/${level.toLowerCase()}/${category}.png`;
  const pageTitle = `Norwegian ${levelUpper} ${categoryName} Vocabulary — Norskeord`;
  // C is the combined C1/C2 "Mastery" level — keep its distinct SEO copy
  // A locked page must not claim to be free: its description names Plus.
  const pageDescription = locked
    ? `Preview ${categoryName} vocabulary at ${levelUpper} level. Unlock the full audio flashcards with Norskeord Plus.`
    : levelUpper === 'C'
      ? `Learn Norwegian ${categoryName} words at C (Mastery) level. Free on Norskeord.`
      : `Learn Norwegian ${categoryName} words with audio flashcards at ${levelUpper} level. Free on Norskeord.`;

  const learningResourceSchema = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: pageTitle,
    description: pageDescription,
    educationalLevel: levelUpper,
    inLanguage: 'nb',
    learningResourceType: 'Flashcards',
    url: `https://norskeord.no/${level.toLowerCase()}/${category}`,
    image: ogImage,
    provider: {
      '@type': 'Organization',
      name: 'Norskeord',
      url: 'https://norskeord.no'
    }
  };

  // C isn't part of the Norskprøven exam, so it gets its own keyword set
  // instead of the "Norskprøven {level}" term used for A1–B2.
  const pageKeywords = (
    levelUpper === 'C'
      ? [
          `Norwegian C vocabulary`,
          `Norwegian ${categoryName} words`,
          `learn Norwegian ${categoryName}`,
          `${categoryName} Norwegian flashcards`,
          `C Norwegian`,
          `advanced Norwegian vocabulary`,
          `Norwegian ${category}`
        ]
      : [
          `Norwegian ${levelUpper} vocabulary`,
          `Norwegian ${categoryName} words`,
          `learn Norwegian ${categoryName}`,
          `${categoryName} Norwegian flashcards`,
          `${levelUpper} Norwegian`,
          `Norskprøven ${levelUpper}`,
          `Norwegian ${category}`
        ]
  ).join(', ');

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
      imageAlt: `${categoryName} — ${levelUpper} Norwegian vocabulary`
    },
    twitter: {
      title: pageTitle,
      description: pageDescription,
      image: ogImage,
      imageAlt: `${categoryName} — ${levelUpper} Norwegian vocabulary`
    }
  };

  // Phase 3 (ai-docs/implementation/uttrykk-category.md): group the full
  // uttrykk deck by `category` and support an optional ?theme= pre-filter
  // (query param name kept as `theme` for existing bookmarks/links — see
  // ai-docs/implementation/uttrykk-theme-category-unification.md — even
  // though it now reads the entry's `category` field). A1–B2 only — C's
  // uttrykk entries are merged in via uttrykkCLoader below instead of going
  // through this grouping, so this just yields an empty `themes` array for
  // C, which the client treats as "no breakdown to show".
  function groupByTheme(all: VocabEntry[]) {
    const counts = new Map<string, number>();
    for (const e of all) {
      if (e.category) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    }
    const themes = [...counts.entries()]
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count);

    const requested = url.searchParams.get('theme');

    // Hub links to "Others" for any theme under UTTRYKK_OTHERS_THRESHOLD
    // (see partitionUttrykkThemes) rather than a real theme slug — match
    // entries against the same minor-theme set the hub used to build that
    // chip, so the two stay in sync.
    if (requested === UTTRYKK_OTHERS_THEME) {
      const { minor } = partitionUttrykkThemes(themes);
      if (minor.length > 0) {
        const minorNames = new Set(minor.map((t) => t.theme));
        const entries = all.filter((e) => e.category && minorNames.has(e.category));
        return { entries, themes, selectedTheme: UTTRYKK_OTHERS_THEME };
      }
      // No minor themes for this level — fall through to "no filter" below.
    }

    const selectedTheme = requested && counts.has(requested) ? requested : null;
    const entries = selectedTheme ? all.filter((e) => e.category === selectedTheme) : all;
    return { entries, themes, selectedTheme };
  }

  // Full uttrykk deck — gated per-theme, not per-category (see
  // ai-docs/implementation/uttrykk-gate.md Phase 1). A free user may only
  // ever land on a theme in FREE_UTTRYKK_THEMES for this level; "study all"
  // (no ?theme=), the ?theme=others bucket, and any other single theme all
  // redirect to /plus, same as the blanket category-lock redirect above
  // does for every other Plus-only category.
  const uttrykkLoader = uttrykkLoaders[key];
  if (uttrykkLoader) {
    const data = await uttrykkLoader();
    const { entries, themes, selectedTheme } = groupByTheme(data.default);

    if (!isPlus && !isFreeUttrykkTheme(levelUpper as UttrykkThemeLevel, selectedTheme)) {
      // Phase 5 (ai-docs/implementation/locked-teaser-social-login.md): the same
      // teaser as a locked vocab category, for the selected theme (or the whole
      // deck when there is no ?theme=). Only the first word and the count leave
      // the server; `themes` is empty and there is no prev/next on the teaser.
      const teaser = buildTeaser(entries);
      if (!teaser) redirect(302, '/plus?ref=uttrykk-theme-lock');
      // The page differs by account, so it must never be shared from a cache.
      setHeaders({ 'Cache-Control': 'private, no-store' });

      const themeName =
        selectedTheme && selectedTheme !== UTTRYKK_OTHERS_THEME
          ? ` (${removeHyphensAndCapitalize(selectedTheme)})`
          : '';
      // The shared description above says "Free on Norskeord"; a locked page must not.
      const lockedDescription = `Preview ${levelUpper} Norwegian expressions${themeName}. Unlock the full audio flashcards with Norskeord Plus.`;
      const lockedMetaTags: MetaProps = {
        ...pageMetaTags,
        description: lockedDescription,
        og: { ...pageMetaTags.og, description: lockedDescription },
        twitter: { ...pageMetaTags.twitter, description: lockedDescription }
      };

      return {
        entries: [] as VocabEntry[],
        level: levelUpper,
        category,
        section: 'uttrykk' as const,
        themes: [] as { theme: string; count: number }[],
        selectedTheme,
        prevCategory: null,
        nextCategory: null,
        nextLocked: null,
        locked: true as const,
        teaser,
        uttrykkContext: null,
        pageMetaTags: lockedMetaTags,
        learningResourceSchema: null
      };
    }

    // Prev/next nav for a theme-filtered uttrykk page must step through
    // *themes*, not the level's vocab category list — `prevCategory` /
    // `nextCategory` above were built from `visibleCats` (indexOf('uttrykk')
    // among vocab slugs), which pointed "back" at whatever vocab category
    // happens to sit next to 'uttrykk' in CATEGORIES_BY_LEVEL (e.g.
    // Communication) — a real bug, not a themed nav. Build the sequence from
    // the same major-theme + Others ordering the hub pills use
    // (partitionUttrykkThemes), so "previous/next" always lands on an
    // adjacent theme pill instead. Free users only ever step through free
    // themes here, mirroring how visibleCats above excludes locked vocab
    // categories for them.
    const {
      major: uttrykkMajor,
      minor: uttrykkMinor,
      othersCount
    } = partitionUttrykkThemes(themes);
    const uttrykkThemeList: { theme: string; count: number }[] = [...uttrykkMajor];
    if (uttrykkMinor.length > 0) {
      uttrykkThemeList.push({ theme: UTTRYKK_OTHERS_THEME, count: othersCount });
    }
    const uttrykkNavList = isPlus
      ? uttrykkThemeList
      : uttrykkThemeList.filter((t) =>
          isFreeUttrykkTheme(levelUpper as UttrykkThemeLevel, t.theme)
        );

    const themeLabel = (theme: string) =>
      theme === UTTRYKK_OTHERS_THEME ? 'Others' : removeHyphensAndCapitalize(theme);

    const tIdx = selectedTheme ? uttrykkNavList.findIndex((t) => t.theme === selectedTheme) : -1;
    const prevTheme = tIdx > 0 ? uttrykkNavList[tIdx - 1] : null;
    const nextTheme =
      tIdx !== -1 && tIdx < uttrykkNavList.length - 1 ? uttrykkNavList[tIdx + 1] : null;

    const uttrykkPrevCategory = prevTheme
      ? {
          slug: prevTheme.theme,
          label: themeLabel(prevTheme.theme),
          href: `/${level.toLowerCase()}/uttrykk?theme=${prevTheme.theme}`
        }
      : null;
    const uttrykkNextCategory = nextTheme
      ? {
          slug: nextTheme.theme,
          label: themeLabel(nextTheme.theme),
          href: `/${level.toLowerCase()}/uttrykk?theme=${nextTheme.theme}`
        }
      : null;
    const uttrykkNextLocked =
      !isPlus && !nextTheme
        ? (() => {
            const lockedCount = uttrykkThemeList.length - uttrykkNavList.length;
            return lockedCount > 0
              ? { count: lockedCount, href: '/plus?ref=uttrykk-nav-end' }
              : null;
          })()
        : null;

    return {
      entries,
      level: levelUpper,
      category,
      section: 'uttrykk' as const,
      themes,
      selectedTheme,
      prevCategory: uttrykkPrevCategory,
      nextCategory: uttrykkNextCategory,
      nextLocked: uttrykkNextLocked,
      locked: false as const,
      teaser: null,
      uttrykkContext: null,
      pageMetaTags,
      learningResourceSchema
    };
  }

  // Regular vocab categories — filter by category from the level's full JSON
  const loader = vocabLoaders[level.toLowerCase()];
  if (!loader) {
    return {
      entries: [] as VocabEntry[],
      level: levelUpper,
      category,
      section: (fromUttrykk ? 'uttrykk' : 'vocab') as 'uttrykk' | 'vocab',
      themes: [] as { theme: string; count: number }[],
      selectedTheme: null as string | null,
      prevCategory,
      nextCategory,
      nextLocked,
      locked: false as const,
      teaser: null,
      uttrykkContext: null,
      pageMetaTags,
      learningResourceSchema
    };
  }

  const vocab = await loader();
  let entries = vocab.default.filter((e) => e.category === category);

  // C has no separate uttrykk route (see uttrykkCLoader above) — merge in
  // any uttrykk-c.json entries tagged with this category so they appear
  // alongside regular vocab entries for the same topic.
  let uttrykkContext: { count: number; backHref: string } | null = null;
  if (level.toLowerCase() === 'c') {
    const uttrykkC = await uttrykkCLoader();
    const uttrykkEntries = uttrykkC.default.filter((e) => e.category === category);
    entries = [...entries, ...uttrykkEntries];

    // Only show the "came from Uttrykk" breadcrumb when that's actually how
    // the visitor got here — a plain Vocabulary-pill visit shouldn't
    // advertise idiom content the visitor didn't ask about.
    if (fromUttrykk && uttrykkEntries.length > 0) {
      uttrykkContext = {
        count: uttrykkEntries.length,
        backHref: `/learn/${level.toLowerCase()}#uttrykk`
      };
    }
  }

  if (locked) {
    // Only the first word and the count leave the server (see $lib/teaser). No
    // entries, no backs, no other cards, and no prev/next links on the teaser.
    const teaser = buildTeaser(entries);
    if (!teaser) redirect(302, '/plus?ref=category-lock');
    // The page differs by account, so it must never be shared from a cache.
    setHeaders({ 'Cache-Control': 'private, no-store' });
    return {
      entries: [] as VocabEntry[],
      level: levelUpper,
      category,
      section: 'vocab' as const,
      themes: [] as { theme: string; count: number }[],
      selectedTheme: null as string | null,
      prevCategory: null,
      nextCategory: null,
      nextLocked: null,
      locked: true as const,
      teaser,
      uttrykkContext: null,
      pageMetaTags,
      learningResourceSchema: null
    };
  }

  return {
    entries,
    level: levelUpper,
    category,
    section: (fromUttrykk ? 'uttrykk' : 'vocab') as 'uttrykk' | 'vocab',
    themes: [] as { theme: string; count: number }[],
    selectedTheme: null as string | null,
    prevCategory: prevCategoryFinal,
    nextCategory: nextCategoryFinal,
    nextLocked: nextLockedFinal,
    locked: false as const,
    teaser: null,
    uttrykkContext,
    pageMetaTags,
    learningResourceSchema
  };
};
