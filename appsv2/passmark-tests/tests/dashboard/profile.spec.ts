/**
 * tests/dashboard/profile.spec.ts
 * Passmark AI-powered tests for the Profile page (/profile).
 */
import { test, expect } from '@playwright/test';
import { runSteps } from 'passmark';
import { createTestSession, injectAuth } from '../../helpers/auth.js';

let _session: Awaited<ReturnType<typeof createTestSession>>;

test.beforeAll(async ({ request }) => {
  _session = await createTestSession(request, 'profile');
});

test.beforeEach(async ({ page }) => {
  await injectAuth(page, _session);
});

test.describe('Profile — user account management', () => {
  test('Profile page loads with user information', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Profile page smoke test',
      steps: [
        { description: 'Navigate to /profile' },
        {
          description: 'Wait until the Profile page content is visible',
          waitUntil: 'A Profile heading or user account form is visible',
        },
      ],
      assertions: [
        { assertion: 'A "Profile" heading or profile management section is visible' },
        { assertion: 'An email field or display name field is visible' },
      ],
      test,
      expect,
    });
  });

  test('profile is accessible from navbar avatar or user menu', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Access profile from navbar',
      steps: [
        { description: 'Navigate to /' },
        {
          description: 'Wait for the dashboard to load',
          waitUntil: 'The navbar is visible',
        },
        {
          description:
            'Click the user avatar, profile icon, or user menu in the top navbar',
        },
        {
          description: 'Wait for a dropdown or profile link to appear',
          waitUntil: 'A profile link or dropdown menu is visible',
        },
        { description: 'Click the "Profile" link in the dropdown menu' },
        {
          description: 'Wait for the profile page to load',
          waitUntil: 'The Profile page is visible',
        },
      ],
      assertions: [
        { assertion: 'The URL contains /profile' },
        { assertion: 'Profile information or a user settings form is visible' },
      ],
      test,
      expect,
    });
  });
});
