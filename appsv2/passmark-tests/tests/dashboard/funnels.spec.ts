/**
 * tests/dashboard/funnels.spec.ts
 * Passmark AI-powered tests for the Funnels page (/funnels).
 */
import { test, expect } from '@playwright/test';
import { runSteps } from 'passmark';
import { createTestSession, injectAuth } from '../../helpers/auth.js';

let _session: Awaited<ReturnType<typeof createTestSession>>;

test.beforeAll(async ({ request }) => {
  _session = await createTestSession(request, 'funnels');
});

test.beforeEach(async ({ page }) => {
  await injectAuth(page, _session);
});

test.describe('Funnels — conversion funnel builder', () => {
  test('Funnels page loads with builder UI', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Funnels page smoke test',
      steps: [
        { description: 'Navigate to /funnels' },
        {
          description: 'Wait until the Funnels heading is visible',
          waitUntil: 'A heading with the text Funnels is visible',
        },
      ],
      assertions: [
        { assertion: 'A "Funnels" heading is visible' },
        {
          assertion:
            'A funnel builder, step editor, or "Add Step" button is visible on the page',
        },
      ],
      test,
      expect,
    });
  });

  test('user can add a funnel step', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Add a funnel step',
      steps: [
        { description: 'Navigate to /funnels' },
        {
          description: 'Wait for the funnels page to fully load',
          waitUntil: 'The Funnels heading is visible',
        },
        { description: 'Click the "Add Step" button or the "+" button in the funnel builder' },
        {
          description: 'Wait for a step input or URL path field to appear',
          waitUntil: 'An input field for a funnel step URL or path is visible',
        },
        {
          description: 'Fill in a URL path for the funnel step',
          data: { value: '/home' },
        },
      ],
      assertions: [
        {
          assertion:
            'A funnel step with the path /home or a step entry has been added to the funnel builder',
        },
      ],
      test,
      expect,
    });
  });

  test('funnel chart section is present', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Funnels chart area',
      steps: [
        { description: 'Navigate to /funnels' },
        {
          description: 'Wait for the funnels page to load',
          waitUntil: 'The Funnels heading is visible',
        },
        { description: 'Scroll down to find the funnel visualisation or chart area' },
      ],
      assertions: [
        {
          assertion:
            'A funnel chart, bar chart, or a "no data / add steps" placeholder is visible in the content area',
        },
      ],
      test,
      expect,
    });
  });
});
