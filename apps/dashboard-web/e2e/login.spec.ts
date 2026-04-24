import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

// Helper to register a user via API with retry on rate limit
async function createUser(request, email, password, name = 'Playwright') {
    for (let attempt = 0; attempt < 3; attempt++) {
        const res = await request.post('/api/auth/register', {
            data: { name, email, password },
        });
        if (res.status() === 429) {
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            continue;
        }
        if (res.status() < 200 || res.status() >= 300) throw new Error('Failed to create user: ' + res.status());
        return res.json();
    }
    throw new Error('Failed to create user: rate limited after retries');
}

test('existing user can login', async ({ page, request }) => {
    const random = randomUUID().slice(0, 6);
    const email = `login${random}@example.com`;
    const password = 'password123';
    await createUser(request, email, password);

    // Create a site so SiteGate doesn't redirect to onboarding after login
    const siteRes = await request.post('/api/sites', {
        data: { name: 'Login Test Site', domain: `login-${random}.example.com` },
    });
    const siteData = await siteRes.json();
    const siteId = siteData.data?.id || siteData.id;

    await page.goto('/login');
    // Pre-set site ID so SiteGate finds it after login
    await page.evaluate((id) => localStorage.setItem('analytics-site-id', id), siteId);
    await page.fill('input[placeholder="you@company.com"]', email);
    await page.fill('input[placeholder="Enter your password"]', password);
    await page.click('button[type="submit"]');

    // After login, should reach dashboard
    await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible({ timeout: 15000 });
});