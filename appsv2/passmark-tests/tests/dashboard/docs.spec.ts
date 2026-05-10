/**
 * tests/dashboard/docs.spec.ts
 * Passmark AI-powered tests for the Documentation page (/docs).
 */
import { test, expect } from '@playwright/test';
import { runSteps } from 'passmark';
import { createTestSession, injectAuth } from '../../helpers/auth.js';

let _session: Awaited<ReturnType<typeof createTestSession>>;

test.beforeAll(async ({ request }) => {
  _session = await createTestSession(request, 'docs');
});

test.beforeEach(async ({ page }) => {
  await injectAuth(page, _session);
});

test.describe('Documentation — in-app reference', () => {
  test('Docs page renders with content sections', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Documentation page smoke test',
      steps: [
        { description: 'Navigate to /docs' },
        {
          description: 'Wait until the Documentation page has loaded',
          waitUntil: 'A Documentation or Docs heading is visible',
        },
      ],
      assertions: [
        { assertion: 'A "Documentation" or "Docs" heading is visible' },
        {
          assertion:
            'At least one documentation section, API reference, or guide content is visible',
        },
      ],
      test,
      expect,
    });
  });

  test('docs page has searchable content or categories', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Documentation search or categories',
      steps: [
        { description: 'Navigate to /docs' },
        {
          description: 'Wait for the docs to load',
          waitUntil: 'The Docs heading or documentation content is visible',
        },
        { description: 'Scroll down to explore the content sections' },
      ],
      assertions: [
        {
          assertion:
            'The docs page contains multiple sections, categories, or links to different topics such as API, tracking, or configuration',
        },
      ],
      test,
      expect,
    });
  });
});
