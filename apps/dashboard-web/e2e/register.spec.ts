import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

test('user can register and reach onboarding', async ({ page }) => {
    // Retry registration up to 3 times if rate limited
    for (let attempt = 0; attempt < 3; attempt++) {
        const random = randomUUID().slice(0, 6);
        const name = `Test User ${random}`;
        const email = `test${random}@example.com`;
        const password = 'password123';

        await page.goto('/register');
        await page.waitForLoadState('networkidle');

        const responsePromise = page.waitForResponse(
            (res) => res.url().includes('/api/auth/register'),
            { timeout: 20000 }
        );

        await page.getByPlaceholder('John Doe').fill(name);
        await page.getByPlaceholder('you@company.com').fill(email);
        await page.getByPlaceholder('Create a password').fill(password);
        await page.getByPlaceholder('Confirm your password').fill(password);
        await page.click('button[type="submit"]');

        const response = await responsePromise;
        if (response.status() === 429) {
            // Rate limited — wait and retry with new credentials
            await page.waitForTimeout(3000 * (attempt + 1));
            continue;
        }

        // Wait for URL to change (client-side navigation)
        await expect(page).not.toHaveURL(/\/register/, { timeout: 15000 });

        // Should end up on onboarding (no sites) or dashboard (if sites exist)
        const url = page.url();
        if (url.includes('onboarding')) {
            await expect(page.locator('h1', { hasText: 'Add your website' })).toBeVisible();
        } else {
            await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible({ timeout: 10000 });
        }
        return; // test passed
    }
    throw new Error('Registration failed after retries due to rate limiting');
});