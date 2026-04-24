import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

async function apiPostWithRetry(request, url, data) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const res = await request.post(url, { data });
        if (res.status() === 429) {
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            continue;
        }
        return res;
    }
    throw new Error(`Rate limited after retries: ${url}`);
}

test('documentation page loads and contains sync section', async ({ page, request }) => {
    // Register + login so we can access the protected docs page
    const random = randomUUID().slice(0, 6);
    const email = `docs${random}@example.com`;
    const password = 'password123';
    await apiPostWithRetry(request, '/api/auth/register', { name: 'Docs Tester', email, password });
    const loginRes = await apiPostWithRetry(request, '/api/auth/login', { email, password });
    const { token } = await loginRes.json();

    // Create a site so SiteGate doesn't redirect to onboarding
    const siteRes = await apiPostWithRetry(request, '/api/sites', { name: 'Test Site', domain: `test-${random}.example.com` });
    const siteData = await siteRes.json();
    const siteId = siteData.data?.id || siteData.id;

    // Set auth token + site ID in localStorage before navigating
    await page.goto('/');
    await page.evaluate(({ token, siteId }) => {
        localStorage.setItem('analytics-token', token);
        localStorage.setItem('analytics-site-id', siteId);
    }, { token, siteId });

    await page.goto('/docs');
    await expect(page.locator('h1')).toHaveText('Documentation', { timeout: 10000 });
    await expect(page.locator('text=Data Sync (PG → DuckDB)')).toBeVisible();
});