import { test, expect } from '@playwright/test';

test('scroll toggles .neu class as spans cross viewport center', async ({ page }) => {
	await page.goto('/');

	const all = page.locator('.content span.switch');
	const neu = page.locator('.content span.switch.neu');

	await expect(all.first()).toBeAttached();
	const total = await all.count();
	expect(total).toBeGreaterThan(10);

	// After scrolling to the bottom every span has crossed the viewport center.
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
	await expect(neu).toHaveCount(total);

	// After scrolling back to the top, far fewer spans are .neu.
	await page.evaluate(() => window.scrollTo(0, 0));
	await expect.poll(() => neu.count()).toBeLessThan(total);
});
