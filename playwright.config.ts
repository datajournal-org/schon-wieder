import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: 'http://localhost:8080',
	},
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:8080',
		reuseExistingServer: !process.env.CI,
		timeout: 30_000,
	},
	projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
