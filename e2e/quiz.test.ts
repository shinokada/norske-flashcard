import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { injectPlusPlan } from './helpers.js';

// ---------------------------------------------------------------------------
// Helper: answer one question regardless of type, then click Next
// ---------------------------------------------------------------------------
async function answerAndAdvance(page: Page) {
  // Wait for either the questioning state OR the summary to be visible.
  await Promise.race([
    page.getByText(/question \d+ of|spørsmål \d+ av/i).waitFor({ state: 'visible', timeout: 5000 }),
    page.getByText(/session complete|økt fullført/i).waitFor({ state: 'visible', timeout: 5000 })
  ]).catch(() => {});

  // If we already reached the summary, nothing left to do.
  if (
    await page
      .getByText(/session complete|økt fullført/i)
      .isVisible({ timeout: 100 })
      .catch(() => false)
  ) {
    return;
  }

  const optionA = page.getByRole('button', { name: /^A\b/ });
  const input = page.getByRole('textbox');

  if (await optionA.isVisible({ timeout: 2000 }).catch(() => false)) {
    await optionA.click();
  } else if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
    await input.fill('test');
    await input.press('Enter');
  } else {
    // Neither visible — still transitioning; yield and let the loop retry.
    await page.waitForTimeout(200);
    return;
  }

  // After answering, wait for the Next / See results button then click it.
  // Scope to button.bg-indigo-600 to avoid matching the SpeakButton whose
  // aria-label may contain "neste" when a Norwegian word/phrase has that text.
  const next = page.locator('button.bg-indigo-600').filter({
    hasText: /next|see results|neste|se resultater/i
  });
  await next.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await next.isVisible({ timeout: 500 }).catch(() => false)) {
    await next.click();
    // Wait for the UI to leave the reveal state (next question counter or summary appears)
    // rather than sleeping unconditionally.
    await Promise.race([
      page
        .getByText(/question \d+ of|spørsmål \d+ av/i)
        .waitFor({ state: 'visible', timeout: 3000 }),
      page.getByText(/session complete|økt fullført/i).waitFor({ state: 'visible', timeout: 3000 })
    ]).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Helper: run a full session until "Session complete!" or the safety guard
// ---------------------------------------------------------------------------
async function completeSession(page: Page, maxQuestions = 20) {
  const safetyLimit = maxQuestions * 2; // 2× gives ample room for retries
  let iterations = 0;
  while (
    !(await page
      .getByText(/session complete|økt fullført/i)
      .isVisible({ timeout: 100 })
      .catch(() => false))
  ) {
    if (++iterations > safetyLimit) break;
    await answerAndAdvance(page);
  }
  // Ensure the summary is actually visible before returning.
  await page
    .getByText(/session complete|økt fullført/i)
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => {});
}

// ===========================================================================
// Gate tests
// ===========================================================================

test('free user can access /quiz and sees free category picker', async ({ page }) => {
  await page.goto('/quiz');
  // Page loads without redirecting
  await expect(page).toHaveURL('/quiz');
  // Level select defaults to A1
  await expect(page.locator('select#quiz-level')).toHaveValue('A1');
  // Free category pills are visible (e.g. Greetings, Numbers, Colors for A1)
  await expect(
    page.getByRole('button', { name: /greetings|numbers|colors/i }).first()
  ).toBeVisible();
  // A1 is free in full: no "N with Plus" upsell link
  await expect(page.getByRole('link', { name: /with Plus/i })).toHaveCount(0);
  // Above A1 only 3 categories are free, so the upsell link appears
  await page.locator('select#quiz-level').selectOption('A2');
  await expect(page.getByRole('link', { name: /with Plus/i })).toBeVisible();
});

test('Plus user sees quiz start screen', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/quiz');
  await expect(page.getByRole('button', { name: /start quiz/i })).toBeVisible();
});

// ===========================================================================
// Full session
// ===========================================================================

test('Plus user can complete a quiz session and see summary', async ({ page }) => {
  test.setTimeout(30000);
  await injectPlusPlan(page);
  await page.goto('/quiz');

  // Limit the session to 3 questions — we're verifying the summary screen
  // renders correctly, not the full 10-question flow, so keep this fast.
  await page.evaluate(() => localStorage.setItem('vocab-quiz-limit', '3'));
  await injectPlusPlan(page);
  await page.reload();

  await page.getByRole('button', { name: /start quiz/i }).click();

  await completeSession(page, 5);

  await expect(page.getByText(/session complete|økt fullført/i)).toBeVisible();
  await expect(page.getByText(/of 3 correct|av 3 riktige/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /try again|prøv igjen/i })).toBeVisible();
});

// ===========================================================================
// Exhausted category (regression for the soonest-due top-up, vocab-multiple-senses Phase 0a)
// ===========================================================================

test('Try again on a small, fully-answered category still starts a full session', async ({
  page
}) => {
  test.setTimeout(60000);
  await injectPlusPlan(page);
  // A1 greetings is small (8 entries); a limit of 10 exceeds the pool, so every
  // card has progress after the first run and none is due.
  await page.goto('/quiz?level=a1&category=greetings');
  await page.evaluate(() => localStorage.setItem('vocab-quiz-limit', '10'));
  await page.reload();

  await page.getByRole('button', { name: /start quiz/i }).click();
  await completeSession(page, 10);

  await page.getByRole('button', { name: /try again|prøv igjen/i }).click();
  // Without the top-up the new session would be empty and no counter would show.
  await expect(page.getByText(/question 1 of \d+|spørsmål 1 av \d+/i)).toBeVisible({
    timeout: 10000
  });
});

// ===========================================================================
// FSRS / localStorage
// ===========================================================================

test('answering a question writes progress to localStorage', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/quiz');
  await page.getByRole('button', { name: /start quiz/i }).click();

  await answerAndAdvance(page);

  const keys = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith('progress-'))
  );
  expect(keys.length).toBeGreaterThan(0);
});

// ===========================================================================
// Keyboard shortcuts
// ===========================================================================

test('keyboard shortcut A selects first MC option', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/quiz');
  await page.getByRole('button', { name: /start quiz/i }).click();

  // Start now fetches the entries first, so wait for the first question to appear.
  await expect(page.getByText(/question 1 of|spørsmål 1 av/i)).toBeVisible({ timeout: 10000 });

  // The first question (index 0, mod 4 === 0) is always MC
  const optionA = page.getByRole('button', { name: /^A\b/ });
  if (await optionA.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.keyboard.press('a');
    // Scope to button.bg-indigo-600 to avoid matching the SpeakButton whose
    // aria-label may contain "neste" when the current entry contains that text.
    await expect(
      page.locator('button.bg-indigo-600').filter({ hasText: /next|neste/i })
    ).toBeVisible();
  }
});

test('Space advances from reveal to next question', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/quiz');
  await page.getByRole('button', { name: /start quiz/i }).click();

  // Start now fetches the entries first, so wait for the first question to appear.
  await expect(page.getByText(/question 1 of|spørsmål 1 av/i)).toBeVisible({ timeout: 10000 });

  // Answer the first question to reach reveal state
  const optionA = page.getByRole('button', { name: /^A\b/ });
  const input = page.getByRole('textbox');
  if (await optionA.isVisible({ timeout: 2000 }).catch(() => false)) {
    await optionA.click();
  } else if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
    await input.fill('test');
    await input.press('Enter');
  }

  // Now in reveal state — press Space to advance.
  // Target the indigo navigation button specifically to avoid matching the
  // pronounce button whose aria-label also contains "neste" (nb).
  const nextBtn = page.locator('button.bg-indigo-600', { hasText: /next|neste/i });
  await expect(nextBtn).toBeVisible();
  await page.keyboard.press('Space');

  // Should now be on question 2 (en: 'Question 2 of', nb: 'Spørsmål 2 av')
  await expect(page.getByText(/question 2 of|spørsmål 2 av/i)).toBeVisible();
});

// ===========================================================================
// Restart from summary
// ===========================================================================

test('Try again from summary resets the session', async ({ page }) => {
  test.setTimeout(30000);
  await injectPlusPlan(page);
  await page.goto('/quiz');

  // Limit the session to 3 questions to keep this test fast — we're only
  // verifying the "Try again" reset behavior, not the full 10-question flow.
  await page.evaluate(() => localStorage.setItem('vocab-quiz-limit', '3'));
  await injectPlusPlan(page);
  await page.reload();

  await page.getByRole('button', { name: /start quiz/i }).click();

  await completeSession(page, 5);

  await expect(page.getByText(/session complete|økt fullført/i)).toBeVisible();
  await page.getByRole('button', { name: /try again|prøv igjen/i }).click();

  // Should be back in the questioning state (en: 'Question 1 of', nb: 'Spørsmål 1 av')
  await expect(page.getByText(/question 1 of|spørsmål 1 av/i)).toBeVisible();
  await expect(page.getByText(/session complete|økt fullført/i)).not.toBeVisible();
});

// ===========================================================================
// Quiz session limit preference
// ===========================================================================

test('quiz respects vocab-quiz-limit from localStorage', async ({ page }) => {
  test.setTimeout(30000);
  await injectPlusPlan(page);
  await page.goto('/quiz');

  // Set quiz limit to 3 — enough to verify the limit is respected without
  // completing a longer session than necessary.
  await page.evaluate(() => localStorage.setItem('vocab-quiz-limit', '3'));
  await injectPlusPlan(page);
  await page.reload();

  await page.getByRole('button', { name: /start quiz/i }).click();

  // The question counter should show "of 3" (en) or "av 3" (nb)
  await expect(page.getByText(/of 3|av 3/i)).toBeVisible();

  await completeSession(page, 5);
  await expect(page.getByText(/session complete|økt fullført/i)).toBeVisible({ timeout: 10000 });
  // Score should be out of 3 (en: 'of 3 correct', nb: 'av 3 riktige')
  await expect(page.getByText(/of 3 correct|av 3 riktige/i)).toBeVisible({ timeout: 5000 });
});

test('quiz uses 10 questions by default (no localStorage key)', async ({ page }) => {
  await injectPlusPlan(page);
  await page.goto('/quiz');

  // Ensure no limit is set
  await page.evaluate(() => localStorage.removeItem('vocab-quiz-limit'));
  await page.reload();

  await page.getByRole('button', { name: /start quiz/i }).click();
  // en: 'Question 1 of 10', nb: 'Spørsmål 1 av 10'
  await expect(page.getByText(/of 10|av 10/i)).toBeVisible();
});

// ===========================================================================
// Plus page — quiz row visible in comparison table
// ===========================================================================

test('/plus page includes quiz mode in the feature table', async ({ page }) => {
  await page.goto('/plus');
  await expect(page.getByRole('cell', { name: /quiz mode/i })).toBeVisible();
});

test('/plus page includes quiz feature card', async ({ page }) => {
  await page.goto('/plus');
  await expect(page.getByText(/quiz yourself, not just flip/i)).toBeVisible();
});

// ===========================================================================
// Server-side gating (ai-docs/implementation/quiz-server-gating.md, Phases 2 and 3).
// The `request` fixture has no session cookie, so the server treats it as a guest.
// injectPlusPlan cannot test the Plus side: it only patches what the browser sees,
// the server still thinks the visitor is a guest. Check Plus by hand.
// ===========================================================================

type RawEntry = { id: string; level: string; category: string };
type QuizPayload = { entries: RawEntry[]; distractors: RawEntry[] };

function readEntries(file: string): RawEntry[] {
  return JSON.parse(readFileSync(join(process.cwd(), 'src/lib/data', file), 'utf-8'));
}

const categoriesOf = (entries: RawEntry[]) => new Set(entries.map((e) => e.category));

test('the quiz page data carries counts, not entries', async ({ request }) => {
  const res = await request.get('/quiz/__data.json');
  expect(res.status()).toBe(200);
  const body = await res.text();
  // A vocab-c entry id and its example sentence must not be anywhere in the data.
  const sample = readEntries('vocab-c.json')[0] as RawEntry & { example: string };
  expect(body).not.toContain(sample.id);
  expect(body).not.toContain(sample.example);
  // A few hundred category rows, not megabytes of entries.
  expect(body.length).toBeLessThan(100_000);
});

test('a guest gets only free entries from /api/quiz-entries', async ({ request }) => {
  // B2 is free in three categories only; the file has many more.
  const inFile = categoriesOf(readEntries('vocab-b2.json'));
  expect(inFile.size).toBeGreaterThan(3);

  const res = await request.post('/api/quiz-entries', { data: { level: 'B2' } });
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toBe('private, no-store');
  const payload = (await res.json()) as QuizPayload;

  expect(payload.entries.length).toBeGreaterThan(0);
  expect(payload.entries.every((e) => e.level === 'B2')).toBe(true);
  expect(categoriesOf(payload.entries).size).toBeLessThanOrEqual(3);
  // Without a category the pool is the whole free set, so there are no extra options.
  expect(payload.distractors).toEqual([]);
});

test('a guest asking for a Plus-only category gets nothing, not even answer options', async ({
  request
}) => {
  const free = categoriesOf(
    (
      (await (
        await request.post('/api/quiz-entries', { data: { level: 'B2' } })
      ).json()) as QuizPayload
    ).entries
  );
  const locked = [...categoriesOf(readEntries('vocab-b2.json'))].find((c) => !free.has(c));
  expect(locked).toBeDefined();

  const res = await request.post('/api/quiz-entries', {
    data: { level: 'B2', category: locked }
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ entries: [], distractors: [] });
});

test('a free category narrows the pool and its answer options stay free', async ({ request }) => {
  const all = (await (
    await request.post('/api/quiz-entries', { data: { level: 'B2' } })
  ).json()) as QuizPayload;
  const freeCategories = categoriesOf(all.entries);
  const category = [...freeCategories][0];

  const res = await request.post('/api/quiz-entries', { data: { level: 'B2', category } });
  const payload = (await res.json()) as QuizPayload;
  expect(payload.entries.every((e) => e.category === category)).toBe(true);
  expect(payload.distractors.length).toBeGreaterThan(0);
  // Every option comes from another free category.
  expect(payload.distractors.every((e) => freeCategories.has(e.category))).toBe(true);
  expect(payload.distractors.every((e) => e.category !== category)).toBe(true);
});

test('/api/quiz-entries rejects a bad request', async ({ request }) => {
  for (const data of [{}, { level: 'D9' }, { level: 'A1', category: 42 }]) {
    const res = await request.post('/api/quiz-entries', { data });
    expect(res.status(), JSON.stringify(data)).toBe(400);
  }
});

test('free user can start a quiz on a free category', async ({ page }) => {
  await page.goto('/quiz');
  await page.getByRole('button', { name: /greetings/i }).click();
  await page.getByRole('button', { name: /start quiz/i }).click();
  await expect(page.getByText(/question 1 of|spørsmål 1 av/i)).toBeVisible({ timeout: 10000 });
});

test('quiz shows an error when the entries fail to load, and retrying works', async ({ page }) => {
  // First request fails, the next one goes through.
  let calls = 0;
  await page.route('**/api/quiz-entries', (route) => {
    calls += 1;
    return calls === 1 ? route.fulfill({ status: 500, body: 'boom' }) : route.continue();
  });

  await page.goto('/quiz');
  await page.getByRole('button', { name: /greetings/i }).click();
  const start = page.getByRole('button', { name: /start quiz/i });
  await start.click();

  await expect(page.getByTestId('quiz-start-error')).toBeVisible({ timeout: 8000 });
  await expect(start).toBeEnabled();
  await expect(page.getByText(/question 1 of|spørsmål 1 av/i)).toHaveCount(0);

  await start.click();
  await expect(page.getByText(/question 1 of|spørsmål 1 av/i)).toBeVisible({ timeout: 10000 });
  expect(calls).toBe(2);
});

// ===========================================================================
// Regression: Enter in a typed answer must show the feedback, not skip it
// ===========================================================================

test('Enter in a typed answer shows the feedback instead of skipping to the next question', async ({
  page
}) => {
  test.setTimeout(30000);
  // Free user: progress goes to localStorage, which resolves within the same key event
  // (the case that used to skip the feedback).
  await page.goto('/quiz');
  await page.getByRole('button', { name: /greetings/i }).click();
  await page.getByRole('button', { name: /start quiz/i }).click();
  await expect(page.getByText(/question 1 of|spørsmål 1 av/i)).toBeVisible({ timeout: 10000 });

  const input = page.getByRole('textbox');
  const nextButton = page.locator('button.bg-indigo-600').filter({
    hasText: /next|see results|neste|se resultater/i
  });

  // Multiple-choice questions come first; answer them by clicking until a typed one shows.
  for (let i = 0; i < 6 && !(await input.isVisible().catch(() => false)); i++) {
    await page.getByRole('button', { name: /^A\b/ }).click();
    await nextButton.click();
    await expect(
      page.getByText(new RegExp(`(question|spørsmål) ${i + 2} (of|av)`, 'i'))
    ).toBeVisible();
  }
  await expect(input).toBeVisible();

  const counter = (await page
    .getByText(/(question|spørsmål) \d+ (of|av) \d+/i)
    .first()
    .textContent())!;
  await input.fill('test');
  await input.press('Enter');

  // The feedback for this question is on screen: the Next button, and the same counter.
  await expect(nextButton).toBeVisible();
  await expect(page.getByText(counter.trim())).toBeVisible();
});
