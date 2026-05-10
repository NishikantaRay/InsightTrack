/**
 * tests/dashboard/dashboard.spec.ts
 * Passmark AI-powered tests for the main Dashboard page (/).
 */
import { test, expect } from '@playwright/test';
import { runSteps, assert } from 'passmark';
import { createTestSession, injectAuth } from '../../helpers/auth.js';

let _session: Awaited<ReturnType<typeof createTestSession>>;

test.beforeAll(async ({ request }) => {
  _session = await createTestSession(request, 'dashboard');
});

test.beforeEach(async ({ page }) => {
  await injectAuth(page, _session);
});

test.describe('Dashboard — main analytics overview', () => {
  test('KPI metric cards are visible', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Dashboard KPI cards',
      steps: [
        { description: 'Navigate to /' },
        {
          description: 'Wait until the Dashboard heading is visible',
          waitUntil: 'A heading with the text Dashboard is visible',
        },
      ],
      assertions: [
        { assertion: 'A "Unique Visitors" or "Visitors" metric card is visible' },
        { assertion: 'A "Pageviews" metric card is visible' },
        { assertion: 'A "Bounce Rate" metric card is visible' },
        { assertion: 'An "Avg. Session" or session duration metric card is visible' },
      ],
      test,
      expect,
    });
  });

  test('traffic chart renders without errors', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Dashboard traffic chart',
      steps: [
        { description: 'Navigate to /' },
        {
          description: 'Wait for the dashboard to fully load',
          waitUntil: 'The main dashboard content area is visible',
        },
        { description: 'Scroll down slightly to reveal the charts section' },
      ],
      assertions: [
        {
          assertion:
            'At least one chart, graph, or "no data" placeholder is visible in the charts area',
        },
      ],
      test,
      expect,
    });
  });

  test('refresh button triggers data reload', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Dashboard refresh button',
      steps: [
        { description: 'Navigate to /' },
        {
          description: 'Wait for the dashboard to load',
          waitUntil: 'The Dashboard heading is visible',
        },
        {
          description: 'Click the refresh or reload button (typically a rotating arrows icon)',
        },
        {
          description: 'Wait for the refresh to complete',
          waitUntil: 'The loading spinner disappears or the data reloads',
        },
      ],
      assertions: [
        { assertion: 'The dashboard content is still visible after the refresh' },
        { assertion: 'No error message has appeared after refreshing' },
      ],
      test,
      expect,
    });
  });

  test('PageNote info box can be expanded and collapsed', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Dashboard PageNote accordion',
      steps: [
        { description: 'Navigate to /' },
        {
          description: 'Wait until the PageNote summary or "What is the Dashboard?" text is visible',
          waitUntil: 'An informational note or info box about the Dashboard is visible',
        },
        {
          description: 'Click the "What is the Dashboard?" info note to expand or collapse it',
        },
      ],
      assertions: [
        {
          assertion:
            'The info note or accordion panel has toggled — it is now either expanded showing details or collapsed',
        },
      ],
      test,
      expect,
    });
  });

  test('sidebar navigation links are visible', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Dashboard sidebar presence',
      steps: [
        { description: 'Navigate to /' },
        {
          description: 'Wait until the page has loaded',
          waitUntil: 'The sidebar or navigation menu is visible',
        },
      ],
      assertions: [
        { assertion: 'A sidebar or left navigation panel with links is visible' },
        { assertion: 'The InsightTrack logo or brand name is visible in the sidebar' },
        { assertion: 'A "Pages" navigation link is present in the sidebar' },
        { assertion: 'A "Realtime" navigation link is present in the sidebar' },
        { assertion: 'A "Settings" navigation link is present in the sidebar' },
      ],
      test,
      expect,
    });
  });

  test('dark mode is supported on the dashboard', async ({ page }) => {
    test.setTimeout(240_000);

    // Navigate and wait for load — the theme toggle has aria-label="Toggle theme"
    await page.goto('/');
    await page.waitForSelector('h1, h2', { timeout: 15_000 });

    const toggle = page.getByRole('button', { name: 'Toggle theme' });
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    // Read current theme from localStorage to know direction of toggle
    const currentTheme = await page.evaluate(() => localStorage.getItem('analytics-theme') ?? 'light');

    await toggle.click();

    // App.jsx renders <div class="dark"> when dark mode is active
    if (currentTheme === 'light') {
      // Toggling light → dark: a div.dark wrapper should appear
      await expect(page.locator('div.dark').first()).toBeVisible({ timeout: 5_000 });
    } else {
      // Toggling dark → light: the div.dark wrapper should disappear
      await expect(page.locator('div.dark').first()).not.toBeVisible({ timeout: 5_000 });
    }
  });
});
