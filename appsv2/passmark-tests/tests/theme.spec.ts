/**
 * tests/theme.spec.ts
 * Passmark AI-powered tests verifying dark-mode support across key pages.
 * All new UI must support dark mode (see CLAUDE.md).
 */
import { test, expect } from '@playwright/test';
import { runSteps } from 'passmark';
import { createTestSession, injectAuth } from '../helpers/auth.js';

let _session: Awaited<ReturnType<typeof createTestSession>>;

test.beforeAll(async ({ request }) => {
  _session = await createTestSession(request, 'theme');
});

test.describe('Dark mode — Tailwind dark: variant coverage', () => {
  test('landing page supports dark mode toggle', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Landing dark mode',
      steps: [
        { description: 'Navigate to /landing' },
        {
          description: 'Wait for the landing page to load',
          waitUntil: 'The hero heading about web analytics is visible',
        },
        { description: 'Click the dark mode toggle button in the navigation bar' },
        {
          description: 'Wait for the theme to switch',
          waitUntil: 'The page background has changed to dark',
        },
      ],
      assertions: [
        { assertion: 'The page now shows a dark background and lighter text colours' },
      ],
      test,
      expect,
    });
  });

  test('dashboard dark mode persists after navigation', async ({ page }) => {
    test.setTimeout(240_000);

    await injectAuth(page, _session);

    await runSteps({
      page,
      userFlow: 'Dashboard dark mode persistence',
      steps: [
        { description: 'Navigate to /' },
        {
          description: 'Wait for the Dashboard to load',
          waitUntil: 'The Dashboard heading is visible',
        },
        { description: 'Click the theme toggle or dark mode button in the top navbar' },
        {
          description: 'Wait for the dark theme to apply',
          waitUntil: 'The dashboard has a dark background',
        },
        { description: 'Click the "Pages" link in the sidebar' },
        {
          description: 'Wait for the Pages section to load',
          waitUntil: 'The Pages heading is visible',
        },
      ],
      assertions: [
        {
          assertion:
            'The Pages section is still displayed with a dark background — the dark mode theme persisted across navigation',
        },
      ],
      test,
      expect,
    });
  });
});
