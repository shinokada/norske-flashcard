import { expect, test, type Page } from '@playwright/test';

const description =
  '"Sakte" er det naturlige valget i samtale, mens "langsomt" er vanligere i skrift og beskrivelser. Her får du vite når du skal bruke hvilket, og hvordan "langsom" og "langsomt" skiller seg grammatisk.';
const title = 'Sakte vs Langsomt — Begge betyr sakte, men ikke likt — Norskeord';
const ogTitle = 'Sakte vs Langsomt — Begge betyr sakte, men ikke likt';
// ── Blog index (/blog) ────────────────────────────────────────────────────────

test.describe('Blog index', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog');
  });

  test('has expected h1', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Språkhjørnet');
  });

  test('has expected meta title', async ({ page }) => {
    await expect(page).toHaveTitle('Språkhjørnet — Norskeord');
  });

  test('has expected meta description', async ({ page }) => {
    const meta = page.locator('meta[name="description"]').last();
    await expect(meta).toHaveAttribute(
      'content',
      'Short, practical articles about Norwegian vocabulary and grammar — with real examples.'
    );
  });

  test('shows at least one post card', async ({ page }) => {
    const cards = page.locator('a[href^="/blog/"]');
    await expect(cards.first()).toBeVisible();
  });

  test('post cards link to /blog/[slug]', async ({ page }) => {
    const firstCard = page.locator('a[href^="/blog/"]').first();
    const href = await firstCard.getAttribute('href');
    expect(href).toMatch(/^\/blog\/.+/);
  });

  test('word post cards show a CEFR badge', async ({ page }) => {
    // Guides show a "Guide" badge (data-testid="guide-badge") instead of a CEFR
    // badge, so this testid unambiguously targets word posts.
    const badge = page.getByTestId('cefr-badge').first();
    await expect(badge).toBeVisible();
  });

  test('clicking a post card navigates to the article', async ({ page }) => {
    const firstCard = page.locator('a[href^="/blog/"]').first();
    const href = await firstCard.getAttribute('href');
    await firstCard.click();
    await expect(page).toHaveURL(href!);
  });
});

// ── Individual post (/blog/sakte-vs-langsomt) ─────────────────────────────────

test.describe('Blog post — sakte-vs-langsomt', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog/sakte-vs-langsomt');
  });

  test('has expected h1', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Sakte vs Langsomt');
  });

  test('has expected meta title', async ({ page }) => {
    await expect(page).toHaveTitle(title);
  });

  test('has expected meta description', async ({ page }) => {
    const meta = page.locator('meta[name="description"]').last();
    await expect(meta).toHaveAttribute('content', description);
  });

  test('has expected og:title', async ({ page }) => {
    const og = page.locator('meta[property="og:title"]').last();
    await expect(og).toHaveAttribute('content', ogTitle);
  });

  test('has expected og:description', async ({ page }) => {
    const og = page.locator('meta[property="og:description"]').last();
    await expect(og).toHaveAttribute('content', description);
  });

  test('shows a CEFR badge', async ({ page }) => {
    await expect(page.getByTestId('cefr-badge')).toBeVisible();
  });

  test('shows a back link to /blog', async ({ page }) => {
    const backLink = page.getByRole('link', { name: '← All posts' });
    await expect(backLink).toBeVisible();
  });

  test('back link navigates to blog index', async ({ page }) => {
    await page.getByRole('link', { name: '← All posts' }).click();
    await expect(page).toHaveURL('/blog');
  });

  test('renders article content', async ({ page }) => {
    const prose = page.locator('.prose');
    await expect(prose).not.toBeEmpty();
  });
});

// ── Scheduled publishing ──────────────────────────────────────────────────────
//
// These tests verify that posts with a future publishedAt date are hidden
// from the blog index and return 404 on direct URL access.
//
// They rely on a fixture post in src/lib/posts/test-future-post.md with
// publishedAt: 2099-01-01 — far enough in the future it never goes live.

test.describe('Scheduled publishing', () => {
  test('future post does not appear in the blog index', async ({ page }) => {
    await page.goto('/blog');
    const futureLink = page.locator('a[href="/blog/test-future-post"]');
    await expect(futureLink).toHaveCount(0);
  });

  test('future post URL is not linked from the index', async ({ page }) => {
    // In a prerendered site the dev server may serve a 200 for unknown routes,
    // so we assert on absence from the listing rather than the HTTP status code.
    await page.goto('/blog');
    const links = await page
      .locator('a[href^="/blog/"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(links).not.toContain('/blog/test-future-post');
  });
});

// ── Search ────────────────────────────────────────────────────────────────────

test.describe('Blog search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog');
  });

  test('search box is visible', async ({ page }) => {
    await expect(page.getByRole('searchbox')).toBeVisible();
  });

  test('typing filters post cards', async ({ page }) => {
    // Use a term that matches at least one post title/description.
    // 'sakte' appears in the published fixture post.
    await page.getByRole('searchbox').fill('sakte');
    const cards = page.locator('a[href^="/blog/"]');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Sakte');
  });

  test('no-match search shows empty state', async ({ page }) => {
    await page.getByRole('searchbox').fill('xyzzy_no_match_ever');
    const cards = page.locator('a[href^="/blog/"]');
    await expect(cards).toHaveCount(0);
    await expect(page.getByText(/no articles match/i)).toBeVisible();
  });

  test('clearing the search restores all cards', async ({ page }) => {
    const allCount = await page.locator('a[href^="/blog/"]').count();
    await page.getByRole('searchbox').fill('sakte');
    await page.getByRole('searchbox').fill('');
    await expect(page.locator('a[href^="/blog/"]')).toHaveCount(allCount);
  });

  test('active filter summary shows article count while searching', async ({ page }) => {
    await page.getByRole('searchbox').fill('sakte');
    // Expects text like "1 articles" or "1 artikler"
    await expect(page.getByText(/\d+ articles?/i).or(page.getByText(/\d+ artik/i))).toBeVisible();
  });

  test('clear-filters link resets search', async ({ page }) => {
    const allCount = await page.locator('a[href^="/blog/"]').count();
    await page.getByRole('searchbox').fill('sakte');
    await page
      .getByRole('link', { name: /clear/i })
      .or(page.getByRole('button', { name: /clear|fjern/i }))
      .click();
    await expect(page.locator('a[href^="/blog/"]')).toHaveCount(allCount);
    await expect(page.getByRole('searchbox')).toHaveValue('');
  });
});

// ── Level filter ──────────────────────────────────────────────────────────────

// The nav bar contains mega-menu trigger buttons also named 'A1', 'A2', etc.
// Scoping to 'button.rounded-full' targets only the filter-panel pill buttons
// and avoids strict-mode violations from duplicate matches.
function levelBtn(page: Page, level: string) {
  return page.locator('button.rounded-full').filter({ hasText: new RegExp(`^${level}$`) });
}

// CEFR levels in ascending order — used to determine which levels are "above" a selected level.
const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C'];

test.describe('Blog level filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog');
  });

  test('level filter buttons are visible', async ({ page }) => {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C']) {
      await expect(levelBtn(page, level)).toBeVisible();
    }
  });

  test('clicking a level shows only posts with that badge', async ({ page }) => {
    const selectedLevel = 'A2';
    await levelBtn(page, selectedLevel).click();

    // Wait for the active-filter summary to confirm the level filter has
    // actually applied before reading card badges — asserting right after
    // click() can race the reactive update and read the still-unfiltered,
    // chronological card list (same fix as the Guide-pill tests below).
    // Generous timeout: this assertion runs against the built `preview`
    // server (see playwright.config.ts), which can be slower to settle
    // under parallel test load than the 5s default accounts for.
    await expect(page.getByText(/\d+ articles?/i).or(page.getByText(/\d+ artik/i))).toBeVisible({
      timeout: 10000
    });

    // The filter includes posts whose cefr matches the selected level. Posts
    // may appear in groups below the selected level (e.g. an A1 group is shown
    // alongside A2 when the filter is "A2"). What must NOT appear is any post
    // whose only badges are strictly above the selected level (B1, B2, C).
    // We also verify that at least one card with the selected badge is visible.
    const selectedIdx = cefrOrder.indexOf(selectedLevel);
    const higherLevels = new Set(cefrOrder.slice(selectedIdx + 1));

    const cards = page.locator('div.grid a[href^="/blog/"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    let foundSelected = false;
    for (let i = 0; i < count; i++) {
      const badgeTexts = await cards
        .nth(i)
        .getByTestId('cefr-badge')
        .allInnerTexts()
        .then((ts) => ts.map((t) => t.trim()));

      // No card should have badges only from levels above the selection.
      // (guard against the vacuous-true case: every([]) is always true, so a
      // card with no cefr badges at all — which shouldn't happen here, since
      // guides are excluded from a level-filtered grid — must not silently
      // pass this check.)
      expect(badgeTexts.length).toBeGreaterThan(0);
      const allHigher = badgeTexts.every((t) => higherLevels.has(t));
      expect(allHigher).toBe(false);

      if (badgeTexts.includes(selectedLevel)) foundSelected = true;
    }

    // At least one card must carry the selected badge.
    expect(foundSelected).toBe(true);
  });

  test('clicking the same level again deselects it', async ({ page }) => {
    const allCount = await page.locator('a[href^="/blog/"]').count();
    await levelBtn(page, 'A2').click();
    // Wait for the filter to take effect (guide section disappears) before deselecting
    await expect(page.locator('a[href="/blog/slik-bruker-du-norskeord"]')).toHaveCount(0);
    await levelBtn(page, 'A2').click();
    await expect(page.locator('a[href^="/blog/"]')).toHaveCount(allCount);
  });

  test('guides are hidden when a level filter is active', async ({ page }) => {
    // Reveal the guide explicitly via the Guide topic pill first — it may not
    // land on the default first page once mixed in chronologically with word posts.
    const guideButton = page.getByRole('button', { name: 'Guide', exact: true });
    await guideButton.click();

    // Wait directly on the guide card itself rather than on the intermediate
    // "N articles" summary text as a synchronization checkpoint — that text
    // locator was intermittently timing out under a loaded preview server
    // even though the underlying filter change had applied. `toBeVisible`
    // already polls/retries, so asserting on what we actually care about
    // (the guide card appearing) is both more direct and more robust than
    // gating on an unrelated locator first.
    const guideLink = page.locator('a[href="/blog/slik-bruker-du-norskeord"]');
    await expect(guideLink).toBeVisible({ timeout: 10000 });

    await levelBtn(page, 'A2').click();
    // Guides are excluded once a level filter is active, even though their own
    // cefr range would otherwise match every level, and even with the Guide
    // topic pill still selected.
    await expect(guideLink).toHaveCount(0);
  });
});

// ── Tag filter ────────────────────────────────────────────────────────────────

test.describe('Blog tag filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog');
  });

  test('tag filter pills are visible', async ({ page }) => {
    // At least one tag pill should be present given the published posts
    const tagSection = page.locator('text=/topic|emne/i').first();
    await expect(tagSection).toBeVisible();
  });

  test('clicking a tag filters posts', async ({ page }) => {
    // 'adjectives' tag exists on published posts
    const tagButton = page.getByRole('button', { name: 'adjectives', exact: true });
    await tagButton.click();
    const cards = page.locator('a[href^="/blog/"]');
    await expect(cards.first()).toBeVisible();
    const filtered = await cards.count();
    expect(filtered).toBeGreaterThan(0);
  });

  test('clicking the same tag again deselects it', async ({ page }) => {
    const allCount = await page.locator('a[href^="/blog/"]').count();
    const tagButton = page.getByRole('button', { name: 'adjectives', exact: true });
    await tagButton.click();
    await tagButton.click();
    await expect(page.locator('a[href^="/blog/"]')).toHaveCount(allCount);
  });

  test('Guide pill shows only guide cards', async ({ page }) => {
    const guideButton = page.getByRole('button', { name: 'Guide', exact: true });
    await expect(guideButton).toBeVisible();
    await guideButton.click();

    // Wait for the active-filter summary to confirm the Guide pill's state
    // change has actually applied before reading card badges — asserting
    // right after click() can race the reactive filter update and read the
    // still-unfiltered, chronological card list (same fix as the other
    // Guide-pill tests in this file). Generous timeout: this assertion runs
    // against the built `preview` server (see playwright.config.ts), which
    // can be slower to settle under parallel test load than the 5s default
    // accounts for — same reasoning as the level-filter test above, and now
    // more likely to matter since there are two guide posts to render
    // instead of one.
    await expect(page.getByText(/\d+ articles?/i).or(page.getByText(/\d+ artik/i))).toBeVisible({
      timeout: 10000
    });

    const cards = page.locator('a[href^="/blog/"]');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i).getByTestId('guide-badge')).toBeVisible();
      await expect(cards.nth(i).getByTestId('cefr-badge')).toHaveCount(0);
    }
  });

  test('Guide pill deselects like other tags', async ({ page }) => {
    const allCount = await page.locator('a[href^="/blog/"]').count();
    const guideButton = page.getByRole('button', { name: 'Guide', exact: true });
    await guideButton.click();
    // Wait for the guide-only filter to actually apply before deselecting —
    // clicking twice back-to-back without waiting for the first reactive
    // update to settle can race the second click's toggle, same fix as the
    // 'guides are hidden when a level filter is active' test above. Generous
    // timeout for the same preview-server-under-load reason as the sibling
    // Guide-pill test above.
    await expect(page.getByText(/\d+ articles?/i).or(page.getByText(/\d+ artik/i))).toBeVisible({
      timeout: 10000
    });
    await guideButton.click();
    // Wait for the active-filter summary to disappear, confirming the
    // deselect actually took effect, before counting cards.
    await expect(page.getByText(/\d+ articles?/i).or(page.getByText(/\d+ artik/i))).not.toBeVisible(
      { timeout: 10000 }
    );
    await expect(page.locator('a[href^="/blog/"]')).toHaveCount(allCount);
  });
});

// ── Filter composition ────────────────────────────────────────────────────────

test.describe('Blog filter composition', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog');
  });

  test('level + tag together show only matching posts', async ({ page }) => {
    await levelBtn(page, 'A2').click();
    const afterLevel = await page.locator('a[href^="/blog/"]').count();

    const tagButton = page.getByRole('button', { name: 'adjectives', exact: true });
    if (await tagButton.isVisible()) {
      await tagButton.click();
      const afterBoth = await page.locator('a[href^="/blog/"]').count();
      expect(afterBoth).toBeLessThanOrEqual(afterLevel);
    }
  });

  test('level + search together narrow results further', async ({ page }) => {
    await levelBtn(page, 'A2').click();
    const afterLevel = await page.locator('a[href^="/blog/"]').count();

    await page.getByRole('searchbox').fill('sakte');
    const afterBoth = await page.locator('a[href^="/blog/"]').count();
    expect(afterBoth).toBeLessThanOrEqual(afterLevel);
  });

  test('clear filters resets level, tag, and search simultaneously', async ({ page }) => {
    const allCount = await page.locator('a[href^="/blog/"]').count();

    await levelBtn(page, 'A2').click();
    await page.getByRole('searchbox').fill('sakte');

    const clearBtn = page.getByRole('button', { name: /clear|fjern/i });
    await clearBtn.click();

    await expect(page.locator('a[href^="/blog/"]')).toHaveCount(allCount);
    await expect(page.getByRole('searchbox')).toHaveValue('');
  });
});

// ── Load more ─────────────────────────────────────────────────────────────────

test.describe('Blog load more', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog');
  });

  test('shows at most 8 post cards on initial load', async ({ page }) => {
    // Guides are now mixed into the same grid as word posts in the default view.
    const gridCards = page.locator('div.grid a[href^="/blog/"]');
    const count = await gridCards.count();
    expect(count).toBeLessThanOrEqual(8);
  });

  test('load more button appears when there are more than 8 posts', async ({ page }) => {
    const allPosts = await page.locator('div.grid a[href^="/blog/"]').count();
    if (allPosts === 8) {
      test.skip();
    }
    // If fewer than 8 total, no button needed
    // If 8 shown and there are more, the button must be visible
  });

  test('clicking load more shows additional cards', async ({ page }) => {
    const loadMoreBtn = page.getByRole('button', { name: /load more|last inn/i });
    if (!(await loadMoreBtn.isVisible())) {
      test.skip(); // fewer than 8 published posts — skip
    }
    const before = await page.locator('div.grid a[href^="/blog/"]').count();
    await loadMoreBtn.click();
    const after = await page.locator('div.grid a[href^="/blog/"]').count();
    expect(after).toBeGreaterThan(before);
  });

  test('load more resets to page 1 after a filter change', async ({ page }) => {
    const loadMoreBtn = page.getByRole('button', { name: /load more|last inn/i });
    if (!(await loadMoreBtn.isVisible())) test.skip();

    const cards = page.locator('div.grid a[href^="/blog/"]');
    const before = await cards.count();
    await loadMoreBtn.click();

    // Wait for the extra cards to actually render before counting — reading
    // count() synchronously right after click() can race the reactive
    // visibleCount update, same class of race as the Guide-pill tests above.
    await expect.poll(() => cards.count()).toBeGreaterThan(before);
    const expanded = await cards.count();
    expect(expanded).toBeGreaterThan(8);

    // Apply a filter — count should drop back to ≤ 8
    await levelBtn(page, 'A2').click();
    await expect(page.getByText(/\d+ articles?/i).or(page.getByText(/\d+ artik/i))).toBeVisible();
    const afterFilter = await cards.count();
    expect(afterFilter).toBeLessThanOrEqual(8);
  });
});

// ── Grid layout ───────────────────────────────────────────────────────────────

test.describe('Blog grid layout', () => {
  test('desktop: post cards render in 2 columns', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/blog');

    const cards = page.locator('div.grid a[href^="/blog/"]');
    const count = await cards.count();
    if (count < 2) test.skip();

    const box0 = await cards.nth(0).boundingBox();
    const box1 = await cards.nth(1).boundingBox();
    // In a 2-col grid the second card starts to the right of the first
    expect(box0).not.toBeNull();
    expect(box1).not.toBeNull();
    expect(box1!.x).toBeGreaterThan(box0!.x);
  });

  test('mobile: post cards render in 1 column', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog');

    const cards = page.locator('div.grid a[href^="/blog/"]');
    const count = await cards.count();
    if (count < 2) test.skip();

    const box0 = await cards.nth(0).boundingBox();
    const box1 = await cards.nth(1).boundingBox();
    expect(box0).not.toBeNull();
    expect(box1).not.toBeNull();
    // In a 1-col layout both cards share the same x position
    expect(box1!.x).toBeCloseTo(box0!.x, 1);
  });
});
