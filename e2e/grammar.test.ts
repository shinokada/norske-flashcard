import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { injectPlusPlan } from './helpers.js';

// ---------------------------------------------------------------------------
// Helper: answer one grammar question (fill or order) and advance
// ---------------------------------------------------------------------------
async function answerGrammarAndAdvance(page: Page) {
  // Wait for either a question or the summary
  await Promise.race([
    page.getByText(/question \d+ of|spørsmål \d+ av/i).waitFor({ state: 'visible', timeout: 5000 }),
    page.getByText(/session complete|økt fullført/i).waitFor({ state: 'visible', timeout: 5000 })
  ]).catch(() => {});

  if (
    await page
      .getByText(/session complete|økt fullført/i)
      .isVisible({ timeout: 100 })
      .catch(() => false)
  ) {
    return;
  }

  // Fill-blank: type into the text input
  const input = page.getByRole('textbox');
  if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
    await input.fill('ikke');
    await input.press('Enter');
  } else {
    // Order type: click all word chips to build the answer, then submit
    const chips = await page.locator('button[data-chip]').all();
    for (const chip of chips) {
      await chip.click().catch(() => {});
    }
    const submitBtn = page.getByRole('button', { name: /check|sjekk/i });
    if (await submitBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
  }

  // Click Next / See results (scoped to indigo button to avoid accidental matches)
  const next = page.locator('button.bg-indigo-600').filter({
    hasText: /next|see results|neste|se resultater/i
  });
  await next.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await next.isVisible({ timeout: 500 }).catch(() => false)) {
    await next.click();
    // Wait for the UI to leave the reveal state rather than sleeping unconditionally.
    await Promise.race([
      page
        .getByText(/question \d+ of|spørsmål \d+ av/i)
        .waitFor({ state: 'visible', timeout: 3000 }),
      page.getByText(/session complete|økt fullført/i).waitFor({ state: 'visible', timeout: 3000 })
    ]).catch(() => {});
  }
}

async function completeGrammarSession(page: Page, maxQuestions = 20) {
  const safetyLimit = maxQuestions * 2; // 2× gives ample room for retries
  let iterations = 0;
  while (
    !(await page
      .getByText(/session complete|økt fullført/i)
      .isVisible({ timeout: 100 })
      .catch(() => false))
  ) {
    if (++iterations > safetyLimit) break;
    await answerGrammarAndAdvance(page);
  }
  await page
    .getByText(/session complete|økt fullført/i)
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => {});
}

// Topic pages open on the Regel tab for new visitors (grammar-update.md, Phase 6a);
// practice sits behind the Øv tab. The page is server-rendered (Phase 6b), so the tab
// exists before hydration and an early click is silently lost. Retry until the tab is
// really selected; clicking an already-selected tab is harmless.
async function openPractice(page: Page) {
  const tab = page.getByTestId('topic-tab-practice');
  await expect(async () => {
    await tab.click({ timeout: 2000 });
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 1000 });
  }).toPass({ timeout: 10000 });
}

// ===========================================================================
// Grammar index page (/grammar)
// ===========================================================================

test('grammar index page loads and shows chapter cards in Parts', async ({ page }) => {
  await page.goto('/grammar');
  await expect(page).toHaveURL('/grammar');
  // The map is Parts > chapter cards (book order); topics live on chapter pages.
  await expect(page.getByTestId('chapter-card').first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('grammar-part').first()).toBeVisible();
  await expect(page.getByTestId('chapter-card').first()).toHaveAttribute(
    'href',
    /^\/grammar\/chapter\/[\w-]+$/
  );
});

test('free user sees Plus upsell on grammar index when locked topics exist', async ({ page }) => {
  await page.goto('/grammar');
  // Wait for CSR hydration: the chapter map must be rendered first
  await expect(page.getByTestId('chapter-card').first()).toBeVisible({ timeout: 8000 });
  // The upsell banner is a <p> tag with text like "7 more topics with Plus"
  await expect(page.getByText(/\d+ more topics with Plus/i)).toBeVisible({ timeout: 5000 });
});

// ===========================================================================
// Grammar topic page (/grammar/[topic])
// ===========================================================================

test('ikke-placement topic page loads and shows first question', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/grammar/ikke-placement');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 8000 });
  // The session question counter should appear
  await openPractice(page);
  await expect(page.getByText(/question \d+ of|spørsmål \d+ av/i)).toBeVisible({ timeout: 8000 });
});

test('back navigation: ?from=b1 shows ← B1 link', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/grammar/ikke-placement?from=b1');
  await expect(page.getByRole('link', { name: /← B1/i })).toBeVisible({ timeout: 5000 });
});

test('back navigation: without ?from shows Grammar topics link', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/grammar/ikke-placement');
  // Scope to <a href="/grammar"> and match the back-link text (EN: "Grammar topics",
  // NB: "Grammatikktemaer"). This avoids colliding with the navbar "Grammatikk" link,
  // which also points to /grammar but uses a shorter label.
  await expect(
    page.locator('a[href="/grammar"]').filter({ hasText: /grammar topics|grammatikktemaer/i })
  ).toBeVisible({ timeout: 5000 });
});

test('free user sees an A1-only session for a topic that also has plusOnly items at other levels (noun-plurals)', async ({
  page
}) => {
  // noun-plurals is free only at A1 per FREE_GRAMMAR_TOPICS (A1-only policy —
  // see ai-docs/gating-rules.md); its A2/B1 content stays Plus-gated even
  // though the topic itself spans A1/A2/B1. Gating is per (topic, cefr), not
  // a fixed count — free users get every non-plusOnly A1 question, capped
  // only by the session's own SESSION_SIZE (10) if the free pool exceeds it.
  // noun-plurals has 8 free A1 questions (none plusOnly), so the free session
  // here is 8 questions, not the full 10-question cap.
  // The lock screen (🔒) only shows when playable.length === 0, i.e. when ALL
  // questions are plusOnly:true, which isn't the case here.
  await page.goto('/grammar/noun-plurals');
  await page.waitForSelector('[data-testid], h1, .bg-amber-50', { timeout: 8000 }).catch(() => {});
  await openPractice(page);
  const questionCounter = page.getByText(/question \d+ of|spørsmål \d+ av/i);
  await expect(questionCounter).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/of 8|av 8/i)).toBeVisible({ timeout: 5000 });
});

test('Plus user can answer a grammar question and progress is written to localStorage', async ({
  page
}) => {
  await injectPlusPlan(page);
  await page.goto('/grammar/ikke-placement');

  await openPractice(page);
  await page.getByText(/question \d+ of|spørsmål \d+ av/i).waitFor({ timeout: 8000 });
  await answerGrammarAndAdvance(page);

  const keys = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith('grammar-'))
  );
  expect(keys.length).toBeGreaterThan(0);
});

test('Plus user can complete a grammar session and see the summary', async ({ page }) => {
  test.setTimeout(90000);
  await injectPlusPlan(page);
  await page.goto('/grammar/ikke-placement');

  await openPractice(page);
  await page.getByText(/question \d+ of|spørsmål \d+ av/i).waitFor({ timeout: 8000 });
  await completeGrammarSession(page);

  await expect(page.getByText(/session complete|økt fullført/i)).toBeVisible({ timeout: 15000 });
});

// ===========================================================================
// Topic page layout: Regel / Øv tabs, breadcrumb, prev/next, related
// (grammar-update.md, Phase 6a)
// ===========================================================================

test('topic page opens on the Regel tab for a new visitor', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/grammar/ikke-placement');
  await expect(page.getByTestId('topic-rule')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('topic-practice')).toBeHidden();
  await expect(page.getByTestId('topic-tab-rule')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('topic-tab-practice')).toHaveAttribute('aria-selected', 'false');
});

test('Regel tab: the start button switches to the practice tab', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/grammar/ikke-placement');
  await page.getByTestId('topic-start-practice').click({ timeout: 8000 });
  await expect(page.getByTestId('topic-practice')).toBeVisible();
  await expect(page.getByTestId('topic-rule')).toBeHidden();
  await expect(page.getByText(/question \d+ of|spørsmål \d+ av/i)).toBeVisible({ timeout: 8000 });
});

test('?tab=practice opens the practice tab directly', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/grammar/ikke-placement?tab=practice');
  await expect(page.getByText(/question \d+ of|spørsmål \d+ av/i)).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('topic-tab-practice')).toHaveAttribute('aria-selected', 'true');
});

test('topic page shows a breadcrumb, prev/next in book order and related topics', async ({
  page
}) => {
  // subjekt-og-verbal is the first topic in book order (1.1), free at A1.
  await page.goto('/grammar/subjekt-og-verbal');
  const crumb = page.getByTestId('topic-page-breadcrumb');
  await expect(crumb).toBeVisible({ timeout: 8000 });
  await expect(crumb.locator('a[href="/grammar/chapter/setningsledd"]')).toBeVisible();

  await expect(page.getByTestId('topic-prev')).toHaveCount(0);
  await expect(page.getByTestId('topic-next')).toHaveAttribute(
    'href',
    '/grammar/sammensatt-verbtid'
  );
  // sammensatt-verbtid is the next topic, so related lists the other sibling.
  await expect(
    page.getByTestId('topic-related').locator('a[href="/grammar/setningsledd-identifikasjon"]')
  ).toBeVisible();

  await page.getByTestId('topic-next').click();
  await expect(page).toHaveURL('/grammar/sammensatt-verbtid');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 8000 });
});

// ===========================================================================
// SEO (grammar-update.md, Phase 6b): the rule and meta are server-rendered, so
// these run with JavaScript disabled, as a crawler's first pass would see them.
// ===========================================================================

test('A1 topic page is server-rendered with the rule, a title and no noindex', async ({
  browser
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto('/grammar/subjekt-og-verbal');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('topic-rule')).toBeVisible();
    await expect(page.getByTestId('topic-page-breadcrumb')).toBeVisible();
    await expect(page).toHaveTitle(/Norwegian Grammar/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('a topic without free A1 content is noindex', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto('/grammar/uttrykk');
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);
    // The Plus teaser is in the server HTML too (grammar-update.md, Phase 6c).
    await expect(page.getByTestId('topic-teaser')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('sitemap lists A1 topics and leaves out a Plus-only topic', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  const xml = await res.text();
  // The body carries super-sitemap's error message when a route has no paramValues.
  expect(res.status(), xml.slice(0, 300)).toBe(200);
  expect(xml).toContain('/grammar/subjekt-og-verbal');
  expect(xml).not.toContain('/grammar/uttrykk<');
  expect(xml).not.toContain('/grammar/chapter/');
});

// ===========================================================================
// Plus teaser and locked-level notice (grammar-update.md, Phase 6c)
// ===========================================================================

test('free user on a Plus-only topic sees a teaser with level counts and the upsell', async ({
  page
}) => {
  // uttrykk has no free level, so a free learner gets the teaser, not a session.
  await page.goto('/grammar/uttrykk');
  await expect(page.getByTestId('topic-teaser')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('topic-teaser-text')).not.toBeEmpty();
  await expect(page.getByTestId('topic-teaser-levels')).toContainText(/\d+/);
  await expect(page.getByText(/This topic is a Plus feature|Plus-funksjon/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /get plus|få plus/i })).toBeVisible();
  await expect(page.getByText(/question \d+ of|spørsmål \d+ av/i)).toHaveCount(0);
});

test('free user on a mixed-level topic sees how many questions Plus adds', async ({ page }) => {
  // noun-plurals: free at A1 only, so its A2/B1 questions are Plus.
  await page.goto('/grammar/noun-plurals');
  const notice = page.getByTestId('topic-locked-levels');
  await expect(notice).toBeVisible({ timeout: 8000 });
  await expect(notice.locator('a')).toHaveAttribute('href', /^\/plus\?ref=grammar-topic-levels/);
  await expect(page.getByTestId('topic-teaser')).toHaveCount(0);
});

test('the locked-level notice is hidden for a Plus user', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/grammar/noun-plurals');
  await expect(page.getByTestId('topic-rule')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('topic-locked-levels')).toHaveCount(0);
});

test('the locked-level notice is hidden when scoped to a free level', async ({ page }) => {
  // ?level=A1: every question in scope is free, so there is nothing to upsell.
  await page.goto('/grammar/noun-plurals?level=A1');
  await expect(page.getByTestId('topic-rule')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('topic-locked-levels')).toHaveCount(0);
});

// ===========================================================================
// Level chips on the map: a filter (hides non-matching chapters), never a
// re-sort, and the active level is forwarded into the chapter links
// (grammar-update.md decision #19)
// ===========================================================================

test('level chip hides chapters with no questions at that level and is forwarded into chapter links', async ({
  page
}) => {
  await page.goto('/grammar');
  const cards = page.getByTestId('chapter-card');
  await expect(cards.first()).toBeVisible({ timeout: 8000 });
  const all = await cards.count();

  // A1: fewer chapters (not every chapter has A1 content), and the global
  // upsell banner is hidden while a filter is active.
  await page.getByRole('button', { name: 'A1', exact: true }).click();
  await expect.poll(() => cards.count()).toBeLessThan(all);
  await expect(page.getByText(/\d+ more topics with Plus/i)).toHaveCount(0);
  await expect(cards.first()).toHaveAttribute('href', /\?level=A1$/);

  // Deselecting restores the full map and plain links.
  await page.getByRole('button', { name: 'A1', exact: true }).click();
  await expect.poll(() => cards.count()).toBe(all);
  await expect(cards.first()).toHaveAttribute('href', /^\/grammar\/chapter\/[\w-]+$/);
});

test('search results are topic rows with a breadcrumb', async ({ page }) => {
  await page.goto('/grammar');
  await expect(page.getByTestId('chapter-card').first()).toBeVisible({ timeout: 8000 });
  await page.getByRole('searchbox', { name: /grammar|grammatikk/i }).fill('ikke');
  await expect(page.getByTestId('topic-title').first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('topic-breadcrumb').first()).toBeVisible();
  await expect(page.getByTestId('chapter-card')).toHaveCount(0);
});

// ===========================================================================
// Chapter page (/grammar/chapter/[slug])
// ===========================================================================

test('clicking a chapter card opens its chapter page with sections and topics', async ({
  page
}) => {
  await page.goto('/grammar');
  const first = page.getByTestId('chapter-card').first();
  await expect(first).toBeVisible({ timeout: 8000 });
  await first.click();
  await expect(page).toHaveURL(/\/grammar\/chapter\/[\w-]+$/);
  await expect(page.getByTestId('chapter-heading')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('chapter-section').first()).toBeVisible();
  await expect(page.getByTestId('topic-title').first()).toBeVisible();
});

test('chapter page: topic links keep the /grammar/[topic] URL', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/grammar/chapter/helsetninger');
  await expect(page.getByTestId('topic-title').first()).toBeVisible({ timeout: 8000 });
  await page.locator('a:has([data-testid="topic-title"])').first().click();
  await expect(page).toHaveURL(/\/grammar\/(?!chapter\/)[\w-]+$/);
});

test('free user sees one upsell banner on a chapter with locked topics', async ({ page }) => {
  // helsetninger: sporresetninger is free at A1 only, so it is a mixed topic.
  await page.goto('/grammar/chapter/helsetninger');
  await expect(page.getByTestId('topic-title').first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('chapter-upsell')).toHaveCount(1);
});

test('Plus user sees no upsell banner on a chapter page', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/grammar/chapter/helsetninger');
  await expect(page.getByTestId('topic-title').first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('chapter-upsell')).toHaveCount(0);
});

test('chapter page: ?level=A1 shows the scope note and a see-all link', async ({ page }) => {
  await page.goto('/grammar/chapter/helsetninger?level=A1');
  await expect(page.getByText(/Showing A1 only/i)).toBeVisible({ timeout: 8000 });
  // Every A1 topic is free at A1, so there is nothing to upsell.
  await expect(page.getByTestId('chapter-upsell')).toHaveCount(0);
  await page.getByRole('link', { name: /see all levels/i }).click();
  await expect(page).toHaveURL('/grammar/chapter/helsetninger');
});

test('free user can practise a chapter and gets a mixed-topic session', async ({ page }) => {
  await page.goto('/grammar/chapter/helsetninger');
  await page.getByTestId('practise-chapter').click({ timeout: 8000 });
  await expect(page.getByText(/question \d+ of|spørsmål \d+ av/i)).toBeVisible({
    timeout: 8000
  });
  // Back to the chapter overview.
  await page.getByRole('button', { name: /back to chapter|tilbake til kapittelet/i }).click();
  await expect(page.getByTestId('chapter-section').first()).toBeVisible();
});

test('unknown grammar chapter shows a 404 error', async ({ page }) => {
  await page.goto('/grammar/chapter/this-chapter-does-not-exist');
  await expect(page.getByRole('heading', { name: '404', level: 1 })).toBeVisible({ timeout: 8000 });
});

// ===========================================================================
// Level-scoped topic page: ?level= must gate free users to that level even
// when the topic has free content at a different level
// (ai-docs/implementation/grammar-fix.md §5/§7)
// ===========================================================================

test("free user hitting a locked segment via ?level= sees the paywall, not the topic's free content at another level", async ({
  page
}) => {
  // noun-plurals is free at A1 but Plus-gated at B1. A locked-segment link
  // or a level-hub link that points at ?level=B1 must show the paywall for
  // a free user, instead of silently falling back to the free A1 questions.
  await page.goto('/grammar/noun-plurals?level=B1');
  await expect(page.getByText(/This topic is a Plus feature|Plus-funksjon/i)).toBeVisible({
    timeout: 8000
  });
  // Confirm it's genuinely the lock screen, not a session that happens to
  // also render some text — the question counter must not appear.
  await expect(page.getByText(/question \d+ of|spørsmål \d+ av/i)).toHaveCount(0);
});

test('free user hitting the same topic without ?level= still sees its free A1 content', async ({
  page
}) => {
  // Sanity check for the above: omitting ?level= entirely preserves the
  // pre-existing "any free level" behavior, so old links/bookmarks without
  // the param don't regress.
  await page.goto('/grammar/noun-plurals');
  await openPractice(page);
  await expect(page.getByText(/question \d+ of|spørsmål \d+ av/i)).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/of 8|av 8/i)).toBeVisible({ timeout: 5000 });
});

// ===========================================================================
// Server-side gating (ai-docs/implementation/grammar-server-gating.md, Phase 2).
// The `request` fixture has no session cookie, so the server treats it as a
// guest. A guest must never be sent a locked question, neither in the HTML
// (server-rendered data) nor in the __data.json a client navigation fetches.
// injectPlusPlan cannot test the Plus side: it only patches what the browser
// sees, the server still thinks the visitor is a guest.
// ===========================================================================

type RawGrammarQuestion = { id: string; topic: string; cefr: string; plusOnly?: boolean };

function grammarQuestions(): RawGrammarQuestion[] {
  return JSON.parse(readFileSync(join(process.cwd(), 'src/lib/data/grammar.json'), 'utf-8'));
}

// Policy (free-policy.test.ts): only A1 is free, and never a plusOnly question.
const isFreeForGuest = (q: RawGrammarQuestion) => q.cefr === 'A1' && !q.plusOnly;

test('a guest is not sent the locked questions of a mixed-level topic', async ({ request }) => {
  // noun-plurals: free at A1, Plus at A2, B1 and B2.
  const questions = grammarQuestions().filter((q) => q.topic === 'noun-plurals');
  const free = questions.filter(isFreeForGuest);
  const locked = questions.filter((q) => !isFreeForGuest(q));
  expect(free.length).toBeGreaterThan(0);
  expect(locked.length).toBeGreaterThan(0);

  for (const path of ['/grammar/noun-plurals', '/grammar/noun-plurals/__data.json']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    const body = await res.text();
    // The free questions are still delivered ...
    expect(body, `${path} is missing a free question`).toContain(free[0].id);
    // ... and no locked one is.
    const leaked = locked.filter((q) => body.includes(q.id)).map((q) => q.id);
    expect(leaked, `${path} leaks locked questions`).toEqual([]);
  }
});

test('a guest is not sent any question of a fully locked topic', async ({ request }) => {
  const questions = grammarQuestions().filter((q) => q.topic === 'uttrykk');
  expect(questions.length).toBeGreaterThan(0);
  expect(questions.every((q) => !isFreeForGuest(q))).toBe(true);

  for (const path of ['/grammar/uttrykk', '/grammar/uttrykk/__data.json']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    const body = await res.text();
    const leaked = questions.filter((q) => body.includes(q.id)).map((q) => q.id);
    expect(leaked, `${path} leaks locked questions`).toEqual([]);
  }
});

test('the topic page is never shared from a cache', async ({ request }) => {
  // The payload differs by plan, so no shared cache may keep one for the other.
  const res = await request.get('/grammar/noun-plurals');
  expect(res.headers()['cache-control']).toBe('private, no-store');
});

test('free user on a mixed-level topic with ?level=B1 still sees the paywall and its level count', async ({
  page
}) => {
  // The server sends no B1 questions to a free user, so the teaser must come from
  // the server-computed counts, not from the (absent) questions.
  await page.goto('/grammar/noun-plurals?level=B1');
  await expect(page.getByTestId('topic-teaser-levels')).toContainText(/B1/, { timeout: 8000 });
  await expect(page.getByText(/question \d+ of|spørsmål \d+ av/i)).toHaveCount(0);
});

test('unknown grammar topic shows a 404 error', async ({ page }) => {
  await page.goto('/grammar/this-topic-does-not-exist');
  // The topic route is server-rendered since Phase 6b, so this is a real 404.
  // SvelteKit renders a level-1 heading containing "404" and a paragraph with the message.
  await expect(page.getByRole('heading', { name: '404', level: 1 })).toBeVisible({ timeout: 8000 });
});
