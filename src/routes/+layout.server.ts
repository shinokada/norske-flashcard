import { ANALYTICS_ID_LANGUAGE_APP, ADMIN_EMAIL } from '$env/static/private';
import { dev } from '$app/environment';
import type { MetaProps } from 'runes-meta-tags';
import { metaTitle, metaDescription } from 'runes-meta-tags';
import { countryFromRequest } from '$lib/server/country';

const SITE_NAME = 'Norskeord';
const SITE_URL = 'https://norskeord.no';
const DEFAULT_DESC =
  'Free Norwegian flashcards from A1 to C. 90+ vocabulary categories with audio, spaced repetition, and Norskprøven preparation. No credit card required.';
const KEYWORDS =
  'Norwegian vocabulary, learn Norwegian, flashcards, Norskprøven, CEFR, A1 A2 B1 B2 C, spaced repetition, Norwegian words';

export const load = async ({ url, locals, request }) => {
  const title = metaTitle(url.pathname, __NAME__);
  const description = metaDescription(url.pathname, DEFAULT_DESC);
  const image = `${SITE_URL}/og/default.png`;
  const canonical = `${SITE_URL}${url.pathname}`;

  const layoutMetaTags: MetaProps = {
    title,
    description,
    keywords: KEYWORDS,
    canonical,
    twitter: {
      card: 'summary_large_image',
      site: '@shinokada',
      creator: '@shinokada',
      title,
      description,
      image,
      imageAlt: title
    },
    og: {
      type: 'website',
      title,
      description,
      url: canonical,
      image,
      imageAlt: title,
      siteName: SITE_NAME,
      imageWidth: '1200',
      imageHeight: '630'
    }
  };

  // Fetch display_name and target_level for the nav and quiz defaults.
  // Single-row select — minimal overhead on every request.
  let displayName: string | null = null;
  let currentLevel: string | null = null;
  // undefined = guest or no profile row (the client falls back to localStorage),
  // null = the profile chose "All cards", number = that limit.
  let sessionLimit: number | null | undefined = undefined;
  let showExample: boolean = false;
  let onboardingDone: boolean = false;
  let onboardingSnoozedAt: string | null = null;
  let flashcardLanguage: string | null = null;
  let fsrsRetention: number | null = null;

  if (locals.user) {
    const { data } = await locals.supabase
      .from('profiles')
      .select(
        'display_name, current_level, session_limit, show_example, onboarding_done, onboarding_snoozed_at, flashcard_language, fsrs_retention, country'
      )
      .eq('id', locals.user.id)
      .maybeSingle();
    displayName = data?.display_name ?? null;
    currentLevel = data?.current_level ?? null;
    sessionLimit = data ? data.session_limit : undefined;
    showExample = data?.show_example ?? false;
    onboardingDone = data?.onboarding_done ?? false;
    onboardingSnoozedAt = data?.onboarding_snoozed_at ?? null;
    flashcardLanguage = data?.flashcard_language ?? null;
    fsrsRetention = data?.fsrs_retention ?? null;

    // Record the visitor's country once (ai-docs/implementation/profile-country.md).
    // UPDATE only, never an upsert: creating the profile row here would change how the app treats
    // a first login (sessionLimit, currentLevel, flashcardLanguage, ui_language defaults). Only the
    // two-letter code is kept, never the IP. Awaited so a serverless function is not cut off early.
    if (data && data.country == null) {
      const country = countryFromRequest(request);
      if (country) {
        const { error } = await locals.supabase
          .from('profiles')
          .update({ country })
          .eq('id', locals.user.id)
          .is('country', null);
        if (error) console.error('[layout] set country failed:', error.message);
      }
    }
  }

  return {
    layoutMetaTags,
    ANALYTICS_ID_LANGUAGE_APP,
    user: locals.user,
    plan: locals.plan,
    displayName,
    currentLevel,
    sessionLimit,
    showExample,
    isAdmin: dev && locals.user?.email === ADMIN_EMAIL,
    // Onboarding
    onboardingDone,
    onboardingSnoozedAt,
    flashcardLanguage,
    fsrsRetention
  };
};
