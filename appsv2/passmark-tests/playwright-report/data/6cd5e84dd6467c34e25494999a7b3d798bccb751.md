# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard/profile.spec.ts >> Profile — user account management >> profile is accessible from navbar avatar or user menu
- Location: tests/dashboard/profile.spec.ts:42:3

# Error details

```
StepExecutionError: 
Key limit exceeded (total limit). Manage it using https://openrouter.ai/settings/keys
Step: Navigate to /
```

# Test source

```ts
  1  | /**
  2  |  * tests/dashboard/profile.spec.ts
  3  |  * Passmark AI-powered tests for the Profile page (/profile).
  4  |  */
  5  | import { test, expect } from '@playwright/test';
  6  | import { runSteps } from 'passmark';
  7  | import { createTestSession, injectAuth } from '../../helpers/auth.js';
  8  | 
  9  | let _session: Awaited<ReturnType<typeof createTestSession>>;
  10 | 
  11 | test.beforeAll(async ({ request }) => {
  12 |   _session = await createTestSession(request, 'profile');
  13 | });
  14 | 
  15 | test.beforeEach(async ({ page }) => {
  16 |   await injectAuth(page, _session);
  17 | });
  18 | 
  19 | test.describe('Profile — user account management', () => {
  20 |   test('Profile page loads with user information', async ({ page }) => {
  21 |     test.setTimeout(240_000);
  22 | 
  23 |     await runSteps({
  24 |       page,
  25 |       userFlow: 'Profile page smoke test',
  26 |       steps: [
  27 |         { description: 'Navigate to /profile' },
  28 |         {
  29 |           description: 'Wait until the Profile page content is visible',
  30 |           waitUntil: 'A Profile heading or user account form is visible',
  31 |         },
  32 |       ],
  33 |       assertions: [
  34 |         { assertion: 'A "Profile" heading or profile management section is visible' },
  35 |         { assertion: 'An email field or display name field is visible' },
  36 |       ],
  37 |       test,
  38 |       expect,
  39 |     });
  40 |   });
  41 | 
  42 |   test('profile is accessible from navbar avatar or user menu', async ({ page }) => {
  43 |     test.setTimeout(240_000);
  44 | 
> 45 |     await runSteps({
     |     ^ StepExecutionError: 
  46 |       page,
  47 |       userFlow: 'Access profile from navbar',
  48 |       steps: [
  49 |         { description: 'Navigate to /' },
  50 |         {
  51 |           description: 'Wait for the dashboard to load',
  52 |           waitUntil: 'The navbar is visible',
  53 |         },
  54 |         {
  55 |           description:
  56 |             'Click the user avatar, profile icon, or user menu in the top navbar',
  57 |         },
  58 |         {
  59 |           description: 'Wait for a dropdown or profile link to appear',
  60 |           waitUntil: 'A profile link or dropdown menu is visible',
  61 |         },
  62 |         { description: 'Click the "Profile" link in the dropdown menu' },
  63 |         {
  64 |           description: 'Wait for the profile page to load',
  65 |           waitUntil: 'The Profile page is visible',
  66 |         },
  67 |       ],
  68 |       assertions: [
  69 |         { assertion: 'The URL contains /profile' },
  70 |         { assertion: 'Profile information or a user settings form is visible' },
  71 |       ],
  72 |       test,
  73 |       expect,
  74 |     });
  75 |   });
  76 | });
  77 | 
```