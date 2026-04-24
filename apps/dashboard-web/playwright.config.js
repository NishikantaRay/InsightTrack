import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    workers: 1,
    use: {
        // front-end server under test
        baseURL: process.env.PW_BASE_URL || 'http://localhost:5173',
        headless: true,
        viewport: { width: 1280, height: 720 },
        actionTimeout: 5_000,
        trace: 'on-first-retry',
    },
    retries: 2,
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
        { name: 'firefox', use: { browserName: 'firefox' } },
        { name: 'webkit', use: { browserName: 'webkit' } },
    ],
});