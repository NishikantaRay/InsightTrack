import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

const SCREENSHOT_DIR = '../screenshots';

async function apiPost(request, url, data) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const res = await request.post(url, { data });
        if (res.status() === 429) {
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            continue;
        }
        return res;
    }
    throw new Error(`Rate limited: ${url}`);
}

async function fullPageScreenshot(page, name) {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}

async function viewportScreenshot(page, name) {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` });
}

// ─── Guest pages (no auth needed) ───────────────────────────────

test.describe('Guest Pages', () => {

    test('Landing - Full Page', async ({ page }) => {
        await page.goto('/landing');
        await fullPageScreenshot(page, '01-landing-full');
    });

    test('Landing - Hero Section', async ({ page }) => {
        await page.goto('/landing');
        await viewportScreenshot(page, '02-landing-hero');
    });

    test('Landing - Features Section', async ({ page }) => {
        await page.goto('/landing');
        await page.locator('#features').scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await viewportScreenshot(page, '03-landing-features');
    });

    test('Landing - How It Works', async ({ page }) => {
        await page.goto('/landing');
        await page.locator('#how-it-works').scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await viewportScreenshot(page, '04-landing-how-it-works');
    });

    test('Landing - Tech Stack', async ({ page }) => {
        await page.goto('/landing');
        await page.locator('#tech-stack').scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await viewportScreenshot(page, '05-landing-tech-stack');
    });

    test('Landing - Comparison Table', async ({ page }) => {
        await page.goto('/landing');
        // Scroll to the comparison section (after tech-stack)
        await page.evaluate(() => {
            const tables = document.querySelectorAll('table');
            if (tables.length > 0) tables[0].scrollIntoView({ behavior: 'instant', block: 'center' });
        });
        await page.waitForTimeout(300);
        await viewportScreenshot(page, '06-landing-comparison');
    });

    test('Landing - Footer & CTA', async ({ page }) => {
        await page.goto('/landing');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(300);
        await viewportScreenshot(page, '07-landing-footer');
    });

    test('Login Page', async ({ page }) => {
        await page.goto('/login');
        await fullPageScreenshot(page, '08-login');
    });

    test('Register Page', async ({ page }) => {
        await page.goto('/register');
        await fullPageScreenshot(page, '09-register');
    });
});

// ─── Authenticated pages ────────────────────────────────────────

test.describe('Authenticated Pages', () => {
    let token: string;
    let siteId: string;

    test.beforeAll(async ({ request }) => {
        const random = randomUUID().slice(0, 6);
        const email = `screenshots${random}@example.com`;
        const password = 'password123';

        await apiPost(request, '/api/auth/register', {
            name: 'Screenshot User', email, password,
        });
        const loginRes = await apiPost(request, '/api/auth/login', {
            email, password,
        });
        const loginData = await loginRes.json();
        token = loginData.token;

        const siteRes = await apiPost(request, '/api/sites', {
            name: 'Demo Site', domain: `demo-${random}.example.com`,
        });
        const siteData = await siteRes.json();
        siteId = siteData.data?.id || siteData.id;
    });

    async function loginPage(page) {
        await page.goto('/');
        await page.evaluate(({ token, siteId }) => {
            localStorage.setItem('analytics-token', token);
            localStorage.setItem('analytics-site-id', siteId);
        }, { token, siteId });
    }

    test('Onboarding Page', async ({ page }) => {
        // Show onboarding by only setting token (no site)
        await page.goto('/');
        await page.evaluate((t) => {
            localStorage.setItem('analytics-token', t);
            localStorage.removeItem('analytics-site-id');
        }, token);
        await page.goto('/onboarding');
        await fullPageScreenshot(page, '10-onboarding');
    });

    test('Dashboard - Full Page', async ({ page }) => {
        await loginPage(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        await fullPageScreenshot(page, '11-dashboard-full');
    });

    test('Dashboard - KPI Cards', async ({ page }) => {
        await loginPage(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        await viewportScreenshot(page, '12-dashboard-kpi-cards');
    });

    test('Dashboard - Charts', async ({ page }) => {
        await loginPage(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        await page.evaluate(() => window.scrollTo(0, 500));
        await page.waitForTimeout(500);
        await viewportScreenshot(page, '13-dashboard-charts');
    });

    test('Dashboard - Bottom Section', async ({ page }) => {
        await loginPage(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        await viewportScreenshot(page, '14-dashboard-bottom');
    });

    test('Pages View', async ({ page }) => {
        await loginPage(page);
        await page.goto('/pages');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        await fullPageScreenshot(page, '15-pages-view');
    });

    test('Funnels', async ({ page }) => {
        await loginPage(page);
        await page.goto('/funnels');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        await fullPageScreenshot(page, '16-funnels');
    });

    test('Realtime', async ({ page }) => {
        await loginPage(page);
        await page.goto('/realtime');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        await fullPageScreenshot(page, '17-realtime');
    });

    test('User Flow', async ({ page }) => {
        await loginPage(page);
        await page.goto('/user-flow');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        await fullPageScreenshot(page, '18-user-flow');
    });

    test('Settings', async ({ page }) => {
        await loginPage(page);
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        await fullPageScreenshot(page, '19-settings');
    });

    test('Profile', async ({ page }) => {
        await loginPage(page);
        await page.goto('/profile');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        await fullPageScreenshot(page, '20-profile');
    });

    test('Documentation - Full Page', async ({ page }) => {
        await loginPage(page);
        await page.goto('/docs');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        await fullPageScreenshot(page, '21-docs-full');
    });

    test('Documentation - API Reference (expanded)', async ({ page }) => {
        await loginPage(page);
        await page.goto('/docs');
        await page.waitForLoadState('networkidle');
        // Click to expand the API Reference section
        const apiSection = page.locator('button', { hasText: 'API Reference' });
        if (await apiSection.isVisible()) {
            await apiSection.click();
            await page.waitForTimeout(300);
        }
        await viewportScreenshot(page, '22-docs-api-reference');
    });

    test('Sidebar Navigation', async ({ page }) => {
        await loginPage(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        // Capture just the sidebar area
        const sidebar = page.locator('aside').first();
        if (await sidebar.isVisible()) {
            await sidebar.screenshot({ path: `${SCREENSHOT_DIR}/23-sidebar.png` });
        } else {
            await viewportScreenshot(page, '23-sidebar');
        }
    });

    test('Navbar', async ({ page }) => {
        await loginPage(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        const navbar = page.locator('header').first();
        if (await navbar.isVisible()) {
            await navbar.screenshot({ path: `${SCREENSHOT_DIR}/24-navbar.png` });
        } else {
            await viewportScreenshot(page, '24-navbar');
        }
    });

    // ─── Dark Mode variants ──────────────────────────────────────

    test('Dashboard - Dark Mode', async ({ page }) => {
        await loginPage(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        // Toggle dark mode via localStorage
        await page.evaluate(() => {
            localStorage.setItem('theme', 'dark');
            document.documentElement.classList.add('dark');
            document.querySelector('.min-h-screen')?.classList.add('dark');
        });
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        await viewportScreenshot(page, '25-dashboard-dark-mode');
    });

    test('Landing - Dark Mode', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.goto('/landing');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        await viewportScreenshot(page, '26-landing-dark-mode');
    });
});
