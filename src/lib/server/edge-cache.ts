/**
 * edge-cache.ts (server only)
 *
 * Which paths may be cached publicly at Vercel's edge for anonymous visitors.
 *
 * Vercel keys its cache by URL and ignores cookies (measured 2026-10-10: a
 * request carrying a session cookie got an `x-vercel-cache: HIT` for a copy
 * made from an anonymous request). So a path whose response differs by account
 * (auth UI, Plus gating, redirects) must never be cached publicly, or a
 * signed-in user is served the anonymous version. Only fully static/marketing
 * pages are cacheable (home, /plus, /resources, /blog/[slug]).
 * See ai-docs/implementation/locked-teaser-social-login.md (Phase 0 and 3).
 */

const CACHE_EXCLUDED_PREFIXES = [
  '/api/', // dynamic JSON endpoints
  '/auth/', // login, callback, sync
  '/learn/', // hub pages show auth-sensitive UI (avatar, Plus badges)
  '/daily/', // login- and Plus-gated lessons; guests get a redirect that must not be shared
  '/plus/success', // redirects anonymous visitors to login and polls the plan
  '/grammar/', // auth-gated
  '/quiz', // auth-gated
  '/norskproven', // auth-gated
  '/my-progress', // auth-required
  '/my-profile' // auth-required
];

// The `[level]/[category]` flashcard routes. Level is matched case-insensitively
// because the route lower-cases it itself, so `/A2/transport` serves the same page.
const LEVEL_ROUTE = /^\/(a1|a2|b1|b2|c)\//i;

export function isCacheExcluded(pathname: string): boolean {
  return (
    CACHE_EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname === '/blog' || // blog index shows auth-sensitive nav (individual posts stay cacheable)
    LEVEL_ROUTE.test(pathname)
  );
}
