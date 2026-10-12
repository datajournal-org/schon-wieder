import { test, expect } from '@playwright/test';
import { SWITCH, scrollToBottom } from './helpers.js';

test('page loads and scrolls without script errors', async ({ page }) => {
	const errors: Error[] = [];
	page.on('pageerror', (error) => errors.push(error));

	await page.goto('/');
	await expect(page.locator(SWITCH).first()).toBeAttached();
	await scrollToBottom(page);
	await expect(page.locator(`${SWITCH}:not(.neu)`)).toHaveCount(0);

	expect(errors).toEqual([]);
});

test('document head carries title, language and social previews', async ({ page }) => {
	await page.goto('/');

	await expect(page).toHaveTitle('Schon wieder - Der Aufstieg der AfD/NSDAP');
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');
	await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
		'content',
		/width=device-width/,
	);

	const preview = 'https://datajournal.org/schon-wieder/preview.png';
	await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
		'content',
		'Schon wieder',
	);
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', preview);
	await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', preview);
	await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
		'content',
		'summary_large_image',
	);
});

test('structure: one headline, subtitle, chapters and the closing quote', async ({ page }) => {
	await page.goto('/');

	await expect(page.locator('.content h1')).toHaveCount(1);
	await expect(page.locator('.content h2')).toHaveCount(1);
	expect(await page.locator('.content h3').count()).toBeGreaterThan(3);
	await expect(page.locator('.content h3').first()).toHaveText('Die Anfänge');
	await expect(page.locator('.content blockquote')).toContainText('sie reimt sich lediglich');
});

test('donation card opens Stripe in a new tab', async ({ page }) => {
	await page.goto('/');

	const tip = page.locator('.donate a.tip');
	await expect(tip).toHaveText('Trinkgeld hinterlassen');
	await expect(tip).toHaveAttribute('href', /^https:\/\/donate\.stripe\.com\/.+schon-wieder$/);
	await expect(tip).toHaveAttribute('target', '_blank');
	await expect(tip).toHaveAttribute('rel', /noopener/);

	await tip.scrollIntoViewIfNeeded();
	await expect(tip).toBeVisible();
});

test('donation card and footer come after the text', async ({ page }) => {
	await page.goto('/');

	const bottom = (await page.locator('.content').boundingBox())!;
	const donate = (await page.locator('.donate').boundingBox())!;
	const footer = (await page.locator('footer').boundingBox())!;

	expect(donate.y).toBeGreaterThanOrEqual(bottom.y + bottom.height);
	expect(footer.y).toBeGreaterThanOrEqual(donate.y + donate.height);
});

test('footer names author, license and source', async ({ page }) => {
	await page.goto('/');

	const footer = page.locator('footer');
	await expect(footer.getByRole('link', { name: 'Michael Kreil' })).toHaveAttribute(
		'href',
		'https://michael-kreil.de/',
	);
	await expect(footer.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute(
		'href',
		'https://creativecommons.org/licenses/by/4.0/',
	);
	await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
		'href',
		'https://github.com/datajournal-org/schon-wieder',
	);
	await expect(footer.getByRole('link', { name: 'Impressum' })).toHaveAttribute(
		'href',
		'https://datajournal.org/impressum',
	);
});
