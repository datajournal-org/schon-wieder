import { test, expect } from '@playwright/test';
import { SWITCH, scrollToBottom } from './helpers.js';

test('switching does not move the surrounding text', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator(SWITCH).first()).toBeAttached();

	// Document coordinates, so the scroll position does not matter.
	const boxes = () =>
		page.evaluate(
			(selector) =>
				[...document.querySelectorAll(selector)].map((element) => {
					const rect = element.getBoundingClientRect();
					return [rect.left, rect.top + window.scrollY, rect.width].map(Math.round);
				}),
			SWITCH,
		);

	const before = await boxes();
	const height = await page.evaluate(() => document.body.scrollHeight);

	await scrollToBottom(page);
	await expect(page.locator(`${SWITCH}:not(.neu)`)).toHaveCount(0);

	expect(await boxes()).toEqual(before);
	expect(await page.evaluate(() => document.body.scrollHeight)).toBe(height);
});

test('both variants of a switch share the same line', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator(SWITCH).first()).toBeAttached();

	const apart = await page.evaluate(
		(selector) =>
			[...document.querySelectorAll(selector)].filter((element) => {
				const [alt, neu] = [...element.children].map((child) => child.getBoundingClientRect());
				return Math.abs(alt.top - neu.top) > 1 || Math.abs(alt.height - neu.height) > 1;
			}).length,
		SWITCH,
	);
	expect(apart).toBe(0);
});

test('the headline starts at the center line', async ({ page }) => {
	await page.goto('/');

	const offset = await page.locator('.content h1').evaluate((element) => {
		const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
		return element.getBoundingClientRect().top + lineHeight - window.innerHeight / 2;
	});
	// The first line of the headline sits directly on top of the line.
	expect(Math.abs(offset)).toBeLessThan(2);
});

for (const width of [320, 375, 768]) {
	test.describe(`at ${width}px width`, () => {
		test.use({ viewport: { width, height: 700 } });

		test('the text column fits the viewport', async ({ page }) => {
			await page.goto('/');
			await expect(page.locator(SWITCH).first()).toBeAttached();

			const box = (await page.locator('.content').boundingBox())!;
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(width);
			expect(box.width).toBeLessThanOrEqual(600);

			expect(await page.evaluate(() => window.scrollX)).toBe(0);
		});

		test('no switch sticks out of the viewport', async ({ page }) => {
			await page.goto('/');
			await expect(page.locator(SWITCH).first()).toBeAttached();

			const outside = await page.evaluate((selector) => {
				return [...document.querySelectorAll(selector)]
					.filter((element) => {
						const rect = element.getBoundingClientRect();
						return rect.left < 0 || rect.right > window.innerWidth;
					})
					.map((element) => [...element.children].map((child) => child.textContent).join('/'));
			}, SWITCH);
			expect(outside).toEqual([]);
		});

		test('words with a switch are not broken across lines', async ({ page }) => {
			await page.goto('/');
			await expect(page.locator(SWITCH).first()).toBeAttached();

			const broken = await page.evaluate(() =>
				[...document.querySelectorAll('.content nobr')]
					.filter((element) => {
						// Every part of the word has to overlap vertically with the first one.
						const rects = [...element.getClientRects()];
						return rects.some(
							(rect) => rect.top >= rects[0].bottom || rect.bottom <= rects[0].top,
						);
					})
					.map((element) => element.textContent),
			);
			expect(broken).toEqual([]);
		});
	});
}
