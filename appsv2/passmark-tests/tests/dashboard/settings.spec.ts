/**
 * tests/dashboard/settings.spec.ts
 * Passmark AI-powered tests for the Settings page (/settings).
 */
import { test, expect } from '@playwright/test';
import { runSteps } from 'passmark';
import { createTestSession, injectAuth } from '../../helpers/auth.js';

let _session: Awaited<ReturnType<typeof createTestSession>>;

test.beforeAll(async ({ request }) => {
  _session = await createTestSession(request, 'settings');
});

test.beforeEach(async ({ page }) => {
  await injectAuth(page, _session);
});

test.describe('Settings — site configuration', () => {
  test('Settings page loads with tab navigation', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Settings page load',
      steps: [
        { description: 'Navigate to /settings' },
        {
          description: 'Wait until the Settings page content is visible',
          waitUntil: 'A Settings heading or Settings tab navigation is visible',
        },
      ],
      assertions: [
        { assertion: 'A "Settings" heading or section is visible' },
        {
          assertion:
            'Tab navigation with options like Sites, Tracking Code, Alerts, or similar settings categories is visible',
        },
      ],
      test,
      expect,
    });
  });

  test('tracking code snippet is shown', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Settings tracking code',
      steps: [
        { description: 'Navigate to /settings' },
        {
          description: 'Wait for the page to load',
          waitUntil: 'The Settings content is visible',
        },
        {
          description:
            'Click the "Tracking Code" or "Script" tab or find the tracking code section',
        },
        {
          description: 'Scroll to find the tracking script snippet',
          waitUntil: 'A code block or script tag is visible',
        },
      ],
      assertions: [
        {
          assertion:
            'A code block containing a script tag or tracking snippet with a site ID is visible',
        },
        { assertion: 'A "Copy" button next to the tracking code is visible' },
      ],
      test,
      expect,
    });
  });

  test('site manager section lists the current site', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Settings site manager',
      steps: [
        { description: 'Navigate to /settings' },
        {
          description: 'Wait for the page to load',
          waitUntil: 'The Settings content is visible',
        },
        {
          description: 'Click the "Sites" tab or find the Sites management section',
        },
      ],
      assertions: [
        {
          assertion:
            'At least one site entry is listed in the site manager — showing a domain name or site name',
        },
      ],
      test,
      expect,
    });
  });

  test('alerts panel is accessible', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Settings alerts panel',
      steps: [
        { description: 'Navigate to /settings' },
        {
          description: 'Wait for the page to load',
          waitUntil: 'The Settings content is visible',
        },
        {
          description: 'Click the "Alerts" or "Notifications" tab or section',
        },
      ],
      assertions: [
        {
          assertion:
            'An alerts panel, notification settings form, or alert configuration section is visible',
        },
      ],
      test,
      expect,
    });
  });
});
