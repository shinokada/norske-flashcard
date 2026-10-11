import type { PageServerLoad } from './$types';
import { getQuizCategoryCounts } from '$lib/server/quiz-sources';

export const ssr = false;

// ai-docs/implementation/quiz-server-gating.md, Phase 2.
//
// This load used to import all ten vocab and uttrykk files in the browser, so every
// visitor downloaded every Plus entry. It now returns only counts per level and
// category, which are the same for everyone and carry no entry content. The entries
// themselves come from POST /api/quiz-entries when the user clicks Start, and that
// endpoint applies the plan gate.
//
// Whether a category is free is decided in the page from the counts and the access
// config (`quizPoolSize`), not from content.

export const load: PageServerLoad = async ({ url, parent }) => {
  const { currentLevel } = await parent();

  // Optional ?level= and ?category= query params pre-select the picker.
  // The level is validated below; an unknown value falls back to the profile level.
  const levelParam = url.searchParams.get('level')?.toLowerCase() ?? null;
  const categoryParam = url.searchParams.get('category') ?? null;

  const allLevels = ['a1', 'a2', 'b1', 'b2', 'c'];
  const profileLevel = typeof currentLevel === 'string' ? currentLevel.toLowerCase() : null;
  const rawLevel = levelParam ?? profileLevel;
  const validLevel = rawLevel && allLevels.includes(rawLevel) ? rawLevel : null;

  return {
    categories: await getQuizCategoryCounts(),
    // Pass back the validated/normalised params so the page can pre-select
    // the picker without re-reading the URL.
    // `level` reflects the URL param first; falls back to profile target_level.
    level: validLevel,
    category: categoryParam
  };
};
