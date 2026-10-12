import { test, expect } from '@playwright/test';
import { SWITCH, scrollToBottom, scrollToCenter, scrollToTop, stage } from './helpers.js';

test('scroll toggles .neu class as spans cross viewport center', async ({ page }) => {
	await page.goto('/');

	const all = page.locator(SWITCH);
	const neu = page.locator(`${SWITCH}.neu`);

	await expect(all.first()).toBeAttached();
	const total = await all.count();
	expect(total).toBeGreaterThan(10);

	// After scrolling to the bottom every span has crossed the viewport center.
	await scrollToBottom(page);
	await expect(neu).toHaveCount(total);

	// After scrolling back to the top, far fewer spans are .neu.
	await scrollToTop(page);
	await expect.poll(() => neu.count()).toBeLessThan(total);
});

test('nothing is switched before the first scroll', async ({ page }) => {
	await page.goto('/');

	await expect(page.locator(SWITCH).first()).toBeAttached();
	await expect(page.locator(`${SWITCH}.neu`)).toHaveCount(0);
});

test('a span switches exactly at the viewport center, in both directions', async ({ page }) => {
	await page.goto('/');

	const all = page.locator(SWITCH);
	await expect(all.first()).toBeAttached();
	const span = all.nth(Math.floor((await all.count()) / 2));
	const inner = span.locator('> span').first();

	await scrollToCenter(inner, 4);
	await expect(span).not.toHaveClass(/neu/);

	await scrollToCenter(inner, -4);
	await expect(span).toHaveClass(/neu/);

	await scrollToCenter(inner, 4);
	await expect(span).not.toHaveClass(/neu/);
});

test('the center line splits the text into switched and unswitched spans', async ({ page }) => {
	await page.goto('/');

	const all = page.locator(SWITCH);
	await expect(all.first()).toBeAttached();
	await scrollToCenter(
		all
			.nth(Math.floor((await all.count()) / 2))
			.locator('> span')
			.first(),
	);

	// Spans exactly on the line are skipped, they may go either way.
	const wrong = () =>
		page.evaluate((selector) => {
			const center = window.innerHeight / 2;
			return [...document.querySelectorAll(selector)].filter((element) => {
				const rect = element.firstElementChild!.getBoundingClientRect();
				const middle = rect.top + rect.height / 2;
				if (Math.abs(middle - center) < 2) return false;
				return element.classList.contains('neu') !== middle < center;
			}).length;
		}, SWITCH);
	await expect.poll(wrong).toBe(0);
});

test('switching crossfades the two inner spans', async ({ page }) => {
	await page.goto('/');

	const span = page.locator(SWITCH).nth(5);
	const alt = span.locator('> span').first();
	const neu = span.locator('> span').last();

	await expect(alt).toHaveCSS('opacity', '1');
	await expect(neu).toHaveCSS('opacity', '0');

	await scrollToCenter(alt, -50);
	await expect(span).toHaveClass(/neu/);
	await expect(alt).toHaveCSS('opacity', '0');
	await expect(neu).toHaveCSS('opacity', '1');
});

test('resizing the viewport re-evaluates the spans', async ({ page }) => {
	await page.goto('/');

	const neu = page.locator(`${SWITCH}.neu`);
	await page.evaluate(() => window.scrollTo(0, 3000));
	await expect.poll(() => neu.count()).toBeGreaterThan(0);
	const before = await neu.count();

	// In a narrow column the text runs longer, so fewer spans are above the center.
	await page.setViewportSize({ width: 320, height: 720 });
	await expect.poll(() => neu.count()).toBeLessThan(before);
});

test.describe('--stage', () => {
	test('is 1 at the top and 0 at the bottom', async ({ page }) => {
		await page.goto('/');

		expect(await stage(page)).toBe(1);
		await expect(page.locator('.white')).toHaveCSS('opacity', '1');

		await scrollToBottom(page);
		await expect.poll(() => stage(page)).toBe(0);
		await expect(page.locator('.white')).toHaveCSS('opacity', '0');

		await scrollToTop(page);
		await expect.poll(() => stage(page)).toBe(1);
	});

	test('fades over 200px once the center passes „Schon wieder.“', async ({ page }) => {
		await page.goto('/');

		const anchor = page.locator('.content blockquote').locator('xpath=preceding-sibling::*[1]');
		await expect(anchor).toHaveText('Schon wieder.');

		// Puts the bottom edge of the anchor `passed` pixels above the viewport center.
		const scrollPast = (passed: number) =>
			anchor.evaluate((element, passed) => {
				const bottom = element.getBoundingClientRect().bottom;
				window.scrollBy(0, bottom - window.innerHeight / 2 + passed);
			}, passed);

		await scrollPast(-10);
		await expect.poll(() => stage(page)).toBe(1);

		await scrollPast(100);
		await expect.poll(() => stage(page)).toBeCloseTo(0.5, 1);

		// A little further than needed, scroll positions are rounded to device pixels.
		await scrollPast(205);
		await expect.poll(() => stage(page)).toBe(0);
	});
});
