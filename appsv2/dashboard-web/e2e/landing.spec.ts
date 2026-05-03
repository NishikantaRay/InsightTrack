import { test, expect } from '@playwright/test';

// simple smoke test for the public landing page

test.describe('Landing page', () => {
    test('has hero heading and register button', async ({ page }) => {
        await page.goto('/landing');
        await expect(page.locator('h1')).toContainText('Web analytics');
        await expect(page.getByText(/Create Free Account/i)).toBeVisible();
    });

    test('can navigate to register page and back', async ({ page }) => {
        await page.goto('/landing');
        await page.click('text=Create Free Account');
        await expect(page).toHaveURL(/\/register$/);
        await expect(page.locator('h1', { hasText: 'Create your account' })).toBeVisible();

        await page.click('a:has-text("Sign in")');
        await expect(page).toHaveURL(/\/login$/);
    });
});