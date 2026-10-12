import type { Locator, Page } from '@playwright/test';

export const SWITCH = '.content span.switch';

/**
 * Scrolls so that the vertical center of `target` ends up `offset` pixels below
 * the viewport center (negative values put it above).
 */
export async function scrollToCenter(target: Locator, offset = 0): Promise<void> {
	await target.evaluate((element, offset) => {
		const rect = element.getBoundingClientRect();
		window.scrollBy(0, rect.top + rect.height / 2 - window.innerHeight / 2 - offset);
	}, offset);
}

export async function scrollToBottom(page: Page): Promise<void> {
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
}

export async function scrollToTop(page: Page): Promise<void> {
	await page.evaluate(() => window.scrollTo(0, 0));
}

export function stage(page: Page): Promise<number> {
	return page.evaluate(() =>
		Number(getComputedStyle(document.documentElement).getPropertyValue('--stage')),
	);
}
