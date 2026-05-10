/**
 * tests/dashboard/pages.spec.ts
 * Passmark AI-powered tests for the Pages analytics view (/pages).
 */
import { test, expect } from '@playwright/test';
import { runSteps } from 'passmark';
import { createTestSession, injectAuth } from '../../helpers/auth.js';

let _session: Awaited<ReturnType<typeof createTestSession>>;

test.beforeAll(async ({ request }) => {
  _session = await createTestSession(request, 'pages-view');
});

test.beforeEach(async ({ page }) => {
  await injectAuth(page, _session);
});

test.describe('Pages — top pages analytics', () => {
  test('Pages heading and data table render correctly', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Pages view smoke test',
      steps: [
        { description: 'Navigate to /pages' },
        {
          description: 'Wait until the Pages heading or page content is visible',
          waitUntil: 'A heading with the text Pages is visible',
        },
      ],
      assertions: [
        { assertion: 'A "Pages" heading is visible at the top of the content area' },
        {
          assertion:
            'Either a data table with page paths and metrics OR a "no data" empty state is visible',
        },
      ],
      test,
      expect,
    });
  });

  test('PageNote info box is present', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Pages view info note',
      steps: [
        { description: 'Navigate to /pages' },
        {
          description: 'Wait for page to load',
          waitUntil: 'The main content of the Pages page is visible',
        },
      ],
      assertions: [
        {
          assertion:
            'An informational note or info box explaining what the Pages section shows is visible',
        },
      ],
      test,
      expect,
    });
  });

  test('date range or filter controls exist', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Pages filter controls',
      steps: [
        { description: 'Navigate to /pages' },
        {
          description: 'Wait for page to load fully',
          waitUntil: 'The Pages heading is visible',
        },
        { description: 'Scroll the page to look for filter or date range controls' },
      ],
      assertions: [
        {
          assertion:
            'Date range selector, time period filter, or search controls are visible on the page',
        },
      ],
      test,
      expect,
    });
  });
});
