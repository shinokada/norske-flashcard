import { expect, test } from '@playwright/test';

test('index page has expected h1', async ({ page }) => {
	await page.goto('/');
	expect(await page.textContent('h1')).toBe('Nivå A1');
});

test('a2 page has expected h1', async ({ page }) => {
	await page.goto('/a2');
	expect(await page.textContent('h1')).toBe('Nivå A2');
});

test('verbs page has expected h1', async ({ page }) => {
	await page.goto('/verbs');
	expect(await page.textContent('h1')).toBe('Verbs');
});

test('adjectives page has expected h1', async ({ page }) => {
	await page.goto('/adjectives');
	expect(await page.textContent('h1')).toBe('Adjectives');
});

test('vocab page has expected h1', async ({ page }) => {
	await page.goto('/vocab');
	expect(await page.textContent('h1')).toBe('Vocabulary');
});

test('education page has expected h1', async ({ page }) => {
	await page.goto('/education');
	expect(await page.textContent('h1')).toBe('Grunnopplæringen');
});

test('credits page has expected h1', async ({ page }) => {
	await page.goto('/credits');
	expect(await page.textContent('h1')).toBe('Credits');
});
