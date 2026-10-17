import { expect, test } from '@playwright/test';
import { injectPlusPlan } from './helpers.js';

test('home page shows all CEFR level cards linking to hub pages', async ({ page }) => {
  await page.goto('/');
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C']) {
    await expect(
      page
        .getByRole('link', { name: new RegExp(level) })
        .filter({ hasText: level })
        .first()
    ).toBeVisible();
  }
});

test('home page level cards link to /learn/[level]', async ({ page }) => {
  await page.goto('/');
  // Locate by href rather than a name regex: /c/i also matches unrelated links
  // such as the header's "Pricing" link, which made the C level check flaky.
  for (const level of ['a1', 'a2', 'b1', 'b2', 'c']) {
    await expect(page.locator(`a[href="/learn/${level}"]`).first()).toBeVisible();
  }
});

test('A1 greetings flashcard page loads and shows title', async ({ page }) => {
  await page.goto('/a1/greetings');
  // Phase 3 (ai-docs/implementation/quiz-i18n-and-categories.md): the h1 is
  // now a fixed Ord/Uttrykk mode label, not the category name — the
  // category name moved to the "Studying: X" breadcrumb above it.
  await expect(page.getByText(/studying:\s*greetings/i)).toBeVisible();
});

test('A1 greetings page has mode toggle buttons', async ({ page }) => {
  await page.goto('/a1/greetings');

  // Mode buttons show abbreviated direction labels e.g. "NO → EN" / "EN → NO"
  await expect(page.getByRole('button', { name: /NO → EN/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Word', exact: true })).toBeVisible();

  // Click the "NO → EN" direction button, then switch to phrase mode
  await page.getByRole('button', { name: /NO → EN/i }).click();
  await page.getByRole('button', { name: 'Word', exact: true }).click();
  await page.reload();

  // After reload, the reverse-direction button should be visible
  await expect(page.getByRole('button', { name: /EN → NO/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Phrase', exact: true })).toBeVisible();
});

// 3-A: free users (unauthenticated) do not see a Due mode toggle button
test('free user sees no Due toggle button', async ({ page }) => {
  await page.goto('/a1/greetings');
  await expect(page.getByRole('button', { name: /due/i })).not.toBeVisible();
});

// 3-A: free user sees no upsell banner when no cards are due
// (banner is only shown when dueCount > 0, which is never true on a fresh device)
test('free user sees no upsell banner when no cards are due', async ({ page }) => {
  await page.goto('/a1/greetings');
  await expect(page.getByText('Smart review is a Plus feature')).not.toBeVisible();
});

// Flip hint (ai-docs/implementation/flashcard-flip-hint-follow-up.md, Phase 4). Both labels are in
// the HTML and CSS (pointer-coarse) picks one, so the visible one depends on the input device.
// The default project has no touch, so it sees the desktop label.
test('front of a flashcard shows "Click to flip" on a desktop pointer', async ({ page }) => {
  await page.goto('/a1/greetings');
  await expect(page.getByRole('button', { name: /flashcard showing question/i })).toBeVisible({
    timeout: 10000
  });
  await expect(page.getByText('Click to flip', { exact: true })).toBeVisible();
  await expect(page.getByText('Tap to flip · Swipe to navigate', { exact: true })).toBeHidden();
});

// Depends on Playwright's `hasTouch` making Chromium report `(pointer: coarse)`. If this fails
// on the label while the desktop test passes, check that first before suspecting the CSS.
test.describe('touch device', () => {
  test.use({ hasTouch: true });

  test('front of a flashcard shows the tap label instead', async ({ page }) => {
    await page.goto('/a1/greetings');
    await expect(page.getByRole('button', { name: /flashcard showing question/i })).toBeVisible({
      timeout: 10000
    });
    await expect(page.getByText('Tap to flip · Swipe to navigate', { exact: true })).toBeVisible();
    await expect(page.getByText('Click to flip', { exact: true })).toBeHidden();
  });
});

test('B1 travel flashcard page loads', async ({ page }) => {
  await page.goto('/b1/travel');
  await expect(page.getByText(/studying:\s*travel/i)).toBeVisible();
});

// Plus member: C flashcard page loads with cards and FSRS rating buttons.
// Uses c/academic, which is one of the 3 free C categories (no server-side
// redirect; see FREE_VOCAB_CATEGORIES in config.ts), then injects plan:plus
// client-side so the due-mode deck rebuilds correctly.
test('Plus member C academic flashcard page loads and shows cards', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/c/academic');

  // breadcrumb shows correct category (Phase 3: category name lives here,
  // not in the h1 — see the A1 greetings test above). injectPlusPlan also
  // sets the Norwegian locale cookie (see helpers.ts), so the category label
  // renders in Norwegian; the regex accepts the Norwegian or English stem.
  await expect(page.getByText(/studying:\s*(akademi|academi)/i)).toBeVisible();

  // card counter is visible (format: "1/N") — wait for deck to build after onMount
  await expect(page.getByText(/^\d+\/\d+$/)).toBeVisible({ timeout: 10000 });

  // flip the card and confirm FSRS rating buttons appear (en: Again/Good, nb: Igjen/Bra)
  const flipCard = page.getByRole('button', { name: /flashcard showing question/i });
  await expect(flipCard).toBeVisible({ timeout: 10000 });
  await flipCard.click({ force: true });
  await expect(page.getByRole('button', { name: /again|igjen|gjenta/i })).toBeVisible({
    timeout: 10000
  });
  await expect(page.getByRole('button', { name: /good|bra/i })).toBeVisible();
});

// A free user on a Plus-only C category (linguistics) sees the locked teaser, not a
// redirect (locked-teaser-social-login.md, Phase 3). Leak and button checks are in
// e2e/teaser.test.ts.
test('free user sees the locked teaser on C linguistics, not a redirect', async ({ page }) => {
  await page.goto('/c/linguistics');
  await expect(page).toHaveURL(/\/c\/linguistics/);
  await expect(page.getByRole('img', { name: /preview of the first card/i })).toBeVisible();
  await expect(page.locator('a[href^="/plus?ref=teaser-vocab"]')).toBeVisible();
});

// Phase 9 (ai-docs/implementation/uttrykk-category.md): the virtual
// "study all" deck over every uttrykk-c.json entry. Same Plus-gating
// pattern as any other C category (see the linguistics test above), but
// applied to the whole route rather than a single category slug.
//
// fixme: unlike /c/philosophy above (free-tier-accessible, no server
// redirect), /c/uttrykk has no free slice at all — every request hits the
// real `redirect(302, ...)` in +page.server.ts based on locals.plan, which
// is derived server-side from an actual Supabase subscriptions-table
// lookup (see hooks.server.ts). injectPlusPlan/injectLoggedInUser only
// patch the HTML/__data.json *after* the real server response comes back,
// so they can't prevent this redirect — the fake plan never has a chance
// to matter. No seeded Plus test account exists in this e2e suite
// (playwright.config.ts has no auth setup), so this is untestable today.
// Re-enable once a real Plus test session mechanism exists.
test.fixme('Plus member C uttrykk page loads and shows cards', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/c/uttrykk');

  // Phase 3 (ai-docs/implementation/quiz-i18n-and-categories.md): the h1 is
  // now a fixed Ord/Uttrykk mode label driven by cardType (default 'word',
  // so 'Ord' here), not a static "Uttrykk" title — check the page's own
  // "fixed expressions" breadcrumb instead, which is unaffected by Phase 3.
  await expect(page.getByText(/fixed expressions/i)).toBeVisible();

  // card counter is visible (format: "1/N") — wait for deck to build after onMount
  await expect(page.getByText(/^\d+\/\d+$/)).toBeVisible({ timeout: 10000 });

  // flip the card and confirm FSRS rating buttons appear
  const flipCard = page.getByRole('button', { name: /flashcard showing question/i });
  await expect(flipCard).toBeVisible({ timeout: 10000 });
  await flipCard.click({ force: true });
  await expect(page.getByRole('button', { name: /again|igjen|gjenta/i })).toBeVisible({
    timeout: 10000
  });
});

test('free user is redirected from C uttrykk to /plus', async ({ page }) => {
  await page.goto('/c/uttrykk');
  await page.waitForURL(/\/plus/, { timeout: 10000 });
  await expect(page).toHaveURL(/\/plus/);
});

// fixme: same root cause as the test above — the breadcrumb only renders
// once entries.length > 0, which requires the real Plus gate to pass.
test.fixme('C uttrykk page links back to the /learn/c hub', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/c/uttrykk');
  await expect(page.getByRole('link', { name: /back to uttrykk/i })).toHaveAttribute(
    'href',
    '/learn/c#uttrykk'
  );
});

// /learn/c's Uttrykk section no longer has an aggregate "N fixed
// expressions" summary line linking to /c/uttrykk (removed — it was the
// only such line across A1–B2, an inconsistency rather than a pattern
// worth keeping). The C branch instead renders one pill per category with
// phrase-sourced entries, each linking back to that category's own
// /c/[category] page (?from=uttrykk), not to the /c/uttrykk virtual deck.
// /c/uttrykk itself still exists and is still linked from /my-progress
// (see stats.ts), just not from this hub page.
test('learn/c hub Uttrykk section links to c/[category] pages, not /c/uttrykk', async ({
  page
}) => {
  await page.goto('/learn/c');
  const uttrykkSection = page.locator('#uttrykk');
  await expect(uttrykkSection.getByRole('link', { name: /fixed expressions/i })).toHaveCount(0);

  // Pills are sorted by uttrykk count and only the first 8 show until "Show more".
  // The largest C categories are Plus-only, so for a free user the first 8 are all
  // locked (link to /plus); the free categories (rhetoric, formal-writing, ...) rank
  // lower. Expand first, otherwise this depends on how the counts happen to rank.
  const showMore = uttrykkSection.getByRole('button', { name: /show more/i });
  if (await showMore.count()) await showMore.click();

  const categoryPills = uttrykkSection.locator('a[href*="?from=uttrykk"]');
  await expect(categoryPills.first()).toBeVisible();

  // Free user: a locked C category (e.g. linguistics is Plus-only, see
  // config.ts PLUS_CATEGORIES) should render as a dimmed pill that opens the
  // category's teaser page with its ref kept (locked-teaser-social-login.md,
  // Phase 5), not be hidden or silently route to an unlocked category.
  const lockedCategoryPills = uttrykkSection
    .locator('a[href*="ref=hub-uttrykk-badge"]')
    .filter({ hasText: '🔒' });
  await expect(lockedCategoryPills.first()).toBeVisible();
  await expect(lockedCategoryPills.first()).toHaveAttribute(
    'href',
    /^\/c\/[^?]+\?from=uttrykk&ref=hub-uttrykk-badge$/
  );
});

test('about page has expected h1', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Guide to Norskeord');
});

// vocab-multiple-senses Phase 5: two A2 `home` entries share `norsk` (`kasse (en)`
// crate vs checkout, `gang (en)` hallway vs occasion). The ?id= deep link must
// put the exact sense first, and the NO → translation front must show its pill.
//
// fixme: A2 `home` is Plus-only since the free-tier simplification (only money,
// clothing and weather are free at A2), so a free user is redirected to /plus
// before the deck renders. Same root cause as the Plus C uttrykk tests above:
// the e2e suite has no real Plus session, and injectPlusPlan only patches the
// response after the server redirect. Re-enable once a real Plus test session
// exists, or move these to a free category that has two senses of one word.
test.fixme('deep link by id shows that sense pill on the card front (gang, hallway)', async ({
  page
}) => {
  await page.goto('/a2/home?id=w-010707&word=gang%20(en)');
  await page.getByRole('button', { name: /NO → EN/i }).click();
  await expect(page.getByText(/^\d+\/\d+$/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('korridor', { exact: true })).toBeVisible();
  await expect(page.getByText('hvor ofte', { exact: true })).not.toBeVisible();
});

// fixme: same root cause as the gang test above (A2 `home` is Plus-only).
test.fixme('deep link by id shows that sense pill on the card front (kasse, crate)', async ({
  page
}) => {
  await page.goto('/a2/home?id=w-001729&word=kasse%20(en)');
  await page.getByRole('button', { name: /NO → EN/i }).click();
  await expect(page.getByText(/^\d+\/\d+$/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('til flasker', { exact: true })).toBeVisible();
  await expect(page.getByText('i butikken', { exact: true })).not.toBeVisible();
});
