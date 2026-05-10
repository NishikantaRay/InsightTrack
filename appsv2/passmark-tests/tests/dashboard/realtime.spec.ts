/**
 * tests/dashboard/realtime.spec.ts
 * Passmark AI-powered tests for the Realtime dashboard (/realtime).
 */
import { test, expect } from '@playwright/test';
import { runSteps } from 'passmark';
import { createTestSession, injectAuth } from '../../helpers/auth.js';

let _session: Awaited<ReturnType<typeof createTestSession>>;

test.beforeAll(async ({ request }) => {
  _session = await createTestSession(request, 'realtime');
});

test.beforeEach(async ({ page }) => {
  await injectAuth(page, _session);
});

test.describe('Realtime — live visitor monitoring', () => {
  test('active visitor counter is displayed', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Realtime active visitor count',
      steps: [
        { description: 'Navigate to /realtime' },
        {
          description: 'Wait until the Realtime page heading is visible',
          waitUntil: 'A heading with the text Realtime is visible',
        },
      ],
      assertions: [
        { assertion: 'A "Realtime" heading is visible' },
        {
          assertion:
            'A large number or counter showing active visitors or "visitors right now" is displayed',
        },
        {
          assertion:
            'Text indicating "Active right now" or "visitors in the last 5 minutes" is visible',
        },
      ],
      test,
      expect,
    });
  });

  test('live visitor map section exists', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Realtime visitor map',
      steps: [
        { description: 'Navigate to /realtime' },
        {
          description: 'Wait for the page to load',
          waitUntil: 'The Realtime heading is visible',
        },
        { description: 'Scroll down to find the Live Visitor Map section' },
      ],
      assertions: [
        {
          assertion:
            'A "Live Visitor Map" section header or a world map visualization is visible, OR a "No geographic data" placeholder is shown',
        },
      ],
      test,
      expect,
    });
  });

  test('live event stream section is present', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Realtime event stream',
      steps: [
        { description: 'Navigate to /realtime' },
        {
          description: 'Wait for the page to load',
          waitUntil: 'The Realtime heading is visible',
        },
        { description: 'Scroll down to find the Live Event Stream section' },
      ],
      assertions: [
        {
          assertion:
            'A "Live Event Stream" or event feed section is visible, showing recent page loads or events',
        },
      ],
      test,
      expect,
    });
  });

  test('active ping animation is visible', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Realtime pulse animation',
      steps: [
        { description: 'Navigate to /realtime' },
        {
          description: 'Wait until the active visitor counter area loads',
          waitUntil: 'The active visitors counter section is visible',
        },
      ],
      assertions: [
        {
          assertion:
            'A green pulsing circle, dot, or ping animation is visible near the active visitor counter, indicating live status',
        },
      ],
      test,
      expect,
    });
  });
});
