import { test, expect } from '@playwright/test';

test('/ and /index.html serve the same fresh build', async ({ request }) => {
	const root = await request.get('/');
	const index = await request.get('/index.html');

	expect(root.status()).toBe(200);
	expect(index.status()).toBe(200);
	expect(root.headers()['content-type']).toContain('text/html');
	expect(root.headers()['cache-control']).toBe('no-store');
	expect(await index.text()).toBe(await root.text());
});

test('template placeholders are filled in', async ({ request }) => {
	const html = await (await request.get('/')).text();

	expect(html).not.toContain('<!--content-->');
	expect(html).not.toContain('/*style*/');
	expect(html).toContain('span.switch');
	expect(html).toContain('<span class="switch"');
});

test('static assets are served from docs/', async ({ request }) => {
	const paper = await request.get('/paper.webp');
	expect(paper.status()).toBe(200);
	expect(paper.headers()['content-type']).toBe('image/webp');

	const preview = await request.get('/preview.png');
	expect(preview.status()).toBe(200);
	expect(preview.headers()['content-type']).toBe('image/png');

	const meta = await request.get('/meta.json');
	expect(meta.status()).toBe(200);
	expect(await meta.json()).toMatchObject({ title: 'Schon wieder', preview: 'preview.png' });
});

test('unknown paths answer with 404', async ({ request }) => {
	expect((await request.get('/does-not-exist')).status()).toBe(404);
});

test('paper texture is loaded by the page', async ({ page }) => {
	const response = page.waitForResponse((response) => response.url().endsWith('/paper.webp'));
	await page.goto('/');

	expect((await response).status()).toBe(200);
});

test('reload channel greets with the server generation', async ({ page }) => {
	await page.goto('/');

	const first = () =>
		page.evaluate(
			() =>
				new Promise<string>((resolve, reject) => {
					const source = new EventSource('/__reload');
					source.onmessage = (event) => {
						source.close();
						resolve(event.data);
					};
					source.onerror = () => reject(new Error('EventSource failed'));
				}),
		);

	const generation = await first();
	expect(generation).toMatch(/^\d+$/);
	// Same process, same generation — otherwise the page would reload in a loop.
	expect(await first()).toBe(generation);
});
