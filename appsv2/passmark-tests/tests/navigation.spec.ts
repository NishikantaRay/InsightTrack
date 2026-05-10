/**
 * tests/navigation.spec.ts
 * Passmark AI-powered tests for sidebar navigation between all sections.
 */
import { test, expect } from '@playwright/test';
import { runSteps } from 'passmark';
import { createTestSession, injectAuth } from '../helpers/auth.js';

let _session: Awaited<ReturnType<typeof createTestSession>>;

test.beforeAll(async ({ request }) => {
  _session = await createTestSession(request, 'navigation');
});

test.beforeEach(async ({ page }) => {
  await injectAuth(page, _session);
});

test.describe('Sidebar navigation — end-to-end routing', () => {
  test('navigates from Dashboard to Pages via sidebar', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Dashboard to Pages navigation',
      steps: [
        { description: 'Navigate to /' },
        {
          description: 'Wait for the Dashboard to load',
          waitUntil: 'The Dashboard heading is visible',
        },
        { description: 'Click the "Pages" link in the sidebar navigation' },
        {
          description: 'Wait for the Pages section to load',
          waitUntil: 'A heading with the text Pages is visible',
        },
      ],
      assertions: [
        { assertion: 'The URL contains /pages' },
        { assertion: 'A "Pages" heading is visible in the main content area' },
      ],
      test,
      expect,
    });
  });

  test('navigates from Dashboard to Realtime via sidebar', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Dashboard to Realtime navigation',
      steps: [
        { description: 'Navigate to /' },
        {
          description: 'Wait for the Dashboard to load',
          waitUntil: 'The sidebar navigation is visible',
        },
        { description: 'Click the "Realtime" link in the sidebar navigation' },
        {
          description: 'Wait for the Realtime section to load',
          waitUntil: 'A Realtime heading and active visitor counter is visible',
        },
      ],
      assertions: [
        { assertion: 'The URL contains /realtime' },
        { assertion: 'A "Realtime" heading is visible' },
      ],
      test,
      expect,
    });
  });

  test('navigates to Funnels and back to Dashboard', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Funnels round-trip navigation',
      steps: [
        { description: 'Navigate to /' },
        {
          description: 'Wait for sidebar to appear',
          waitUntil: 'The sidebar navigation is visible',
        },
        { description: 'Click the "Funnels" link in the sidebar' },
        {
          description: 'Wait for the Funnels page to load',
          waitUntil: 'A Funnels heading is visible',
        },
        { description: 'Click the "Dashboard" or home icon link in the sidebar' },
        {
          description: 'Wait for the Dashboard to load',
          waitUntil: 'The Dashboard heading or KPI cards are visible',
        },
      ],
      assertions: [
        { assertion: 'The URL is now / or /dashboard — back on the Dashboard' },
        { assertion: 'KPI metric cards for visitors and pageviews are visible' },
      ],
      test,
      expect,
    });
  });

  test('sidebar collapse toggle works', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Sidebar collapse toggle',
      steps: [
        { description: 'Navigate to /' },
        {
          description: 'Wait for the sidebar to be visible',
          waitUntil: 'The sidebar with navigation links is visible',
        },
        {
          description:
            'Click the collapse button or chevron icon at the bottom of the sidebar to collapse it',
        },
      ],
      assertions: [
        {
          assertion:
            'The sidebar is now collapsed — navigation text labels are hidden and only icons are visible, OR the sidebar width has reduced significantly',
        },
      ],
      test,
      expect,
    });
  });

  test('all 14 sidebar nav links are present', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Sidebar completeness check',
      steps: [
        { description: 'Navigate to /' },
        {
          description: 'Wait for the sidebar to load',
          waitUntil: 'The sidebar navigation with multiple links is visible',
        },
      ],
      assertions: [
        { assertion: 'Dashboard link is visible in the sidebar' },
        { assertion: 'Pages link is visible in the sidebar' },
        { assertion: 'Funnels link is visible in the sidebar' },
        { assertion: 'Conversions link is visible in the sidebar' },
        { assertion: 'Audience link is visible in the sidebar' },
        { assertion: 'Content link is visible in the sidebar' },
        { assertion: 'Acquisition link is visible in the sidebar' },
        { assertion: 'Performance link is visible in the sidebar' },
        { assertion: 'Realtime link is visible in the sidebar' },
        { assertion: 'User Flow link is visible in the sidebar' },
        { assertion: 'Engagement link is visible in the sidebar' },
        { assertion: 'Reporting link is visible in the sidebar' },
        { assertion: 'Privacy link is visible in the sidebar' },
        { assertion: 'Settings link is visible in the sidebar' },
      ],
      test,
      expect,
    });
  });
});
