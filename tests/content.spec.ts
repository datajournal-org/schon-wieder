import { test, expect } from '@playwright/test';
import { SWITCH, scrollToBottom } from './helpers.js';

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.locator(SWITCH).first()).toBeAttached();
});

test('no markup of the source syntax leaks into the page', async ({ page }) => {
	const text = await page.locator('.content').evaluate((element) => element.textContent ?? '');

	expect(text).not.toMatch(/[[\]$]/);
	expect(text).not.toMatch(/[]/);
});

test('every switch holds exactly an old and a new variant', async ({ page }) => {
	const broken = await page.evaluate(
		(selector) =>
			[...document.querySelectorAll(selector)].filter(
				(element) =>
					element.children.length !== 2 ||
					[...element.children].some((child) => child.tagName !== 'SPAN') ||
					// One side may be empty, but never both.
					element.textContent!.trim() === '',
			).length,
		SWITCH,
	);
	expect(broken).toBe(0);
});

test('old variants tell the story of the NSDAP, new ones that of the AfD', async ({ page }) => {
	const alt = await page.locator(`${SWITCH} > span:first-child`).allTextContents();
	const neu = await page.locator(`${SWITCH} > span:last-child`).allTextContents();

	expect(alt).toContain('NSDAP');
	expect(alt).not.toContain('AfD');
	expect(neu).toContain('AfD');
	expect(neu).not.toContain('NSDAP');
});

test('headline reads NSDAP first and AfD after scrolling', async ({ page }) => {
	const span = page.locator(`.content h1 ${SWITCH.replace('.content ', '')}`);

	await expect(span.locator('> span').first()).toHaveText('NSDAP');
	await expect(span.locator('> span').last()).toHaveText('AfD');
	await expect(span).not.toHaveClass(/neu/);

	await scrollToBottom(page);
	await expect(span).toHaveClass(/neu/);
});

test('„Schon wieder.“ only exists in the new variant', async ({ page }) => {
	const span = page.locator(SWITCH).last();

	await expect(span.locator('> span').first()).toHaveText('');
	await expect(span.locator('> span').last()).toHaveText('Schon wieder.');
});

test('$ markers align the variants towards the rest of the word', async ({ page }) => {
	// [Reich/Bunde$]stag — the word continues on the right.
	const right = page.locator(SWITCH).filter({ hasText: 'Reich' }).first();
	await expect(right).toHaveCSS('text-align', 'right');

	// [Lenin/Wagenknecht$]-[$Bund/Bündnis] — the word continues on the left.
	const left = page.locator(SWITCH).filter({ hasText: 'Bündnis' }).first();
	await expect(left).toHaveCSS('text-align', 'left');

	// Without a marker the variants are centered.
	const center = page.locator(SWITCH).filter({ hasText: 'historischer' }).first();
	await expect(center).toHaveCSS('text-align', 'center');
});

test('a switch inside a word is glued to the rest of that word', async ({ page }) => {
	const loose = await page.evaluate((selector) => {
		const isWordChar = (char: string | undefined) => !!char && /[\p{L}\p{N}]/u.test(char);
		return [...document.querySelectorAll(selector)]
			.filter((element) => {
				const before = element.previousSibling;
				const after = element.nextSibling;
				const touchesWord =
					(before?.nodeType === Node.TEXT_NODE && isWordChar(before.textContent!.at(-1))) ||
					(after?.nodeType === Node.TEXT_NODE && isWordChar(after.textContent![0]));
				return touchesWord && !element.closest('nobr');
			})
			.map((element) => element.textContent);
	}, SWITCH);
	expect(loose).toEqual([]);

	await expect(page.locator('.content nobr').filter({ hasText: 'stagswahl' }).first()).toHaveText(
		'ReichBundestagswahl',
	);
});

test('added sections are labelled with their date', async ({ page }) => {
	const sections = page.locator('.content section.added');

	expect(await sections.count()).toBeGreaterThan(0);
	for (const section of await sections.all()) {
		await expect(section).toHaveAttribute('data-added', /\d{1,2}\.\d{1,2}\.\d{4}/);
		const label = await section.evaluate(
			(element) => getComputedStyle(element, '::before').content,
		);
		expect(label).toBe(`"${await section.getAttribute('data-added')}"`);
	}
});

test('links in the text point to https targets', async ({ page }) => {
	const hrefs = await page
		.locator('.content a')
		.evaluateAll((links) => links.map((link) => link.getAttribute('href')));

	expect(hrefs.length).toBeGreaterThan(0);
	for (const href of hrefs) expect(href).toMatch(/^https:\/\//);
});
