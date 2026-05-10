# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: theme.spec.ts >> Dark mode — Tailwind dark: variant coverage >> dashboard dark mode persists after navigation
- Location: tests/theme.spec.ts:43:3

# Error details

```
StepExecutionError: 
Key limit exceeded (total limit). Manage it using https://openrouter.ai/settings/keys
Step: Navigate to /
```

# Test source

```ts
  1  | /**
  2  |  * tests/theme.spec.ts
  3  |  * Passmark AI-powered tests verifying dark-mode support across key pages.
  4  |  * All new UI must support dark mode (see CLAUDE.md).
  5  |  */
  6  | import { test, expect } from '@playwright/test';
  7  | import { runSteps } from 'passmark';
  8  | import { createTestSession, injectAuth } from '../helpers/auth.js';
  9  | 
  10 | let _session: Awaited<ReturnType<typeof createTestSession>>;
  11 | 
  12 | test.beforeAll(async ({ request }) => {
  13 |   _session = await createTestSession(request, 'theme');
  14 | });
  15 | 
  16 | test.describe('Dark mode — Tailwind dark: variant coverage', () => {
  17 |   test('landing page supports dark mode toggle', async ({ page }) => {
  18 |     test.setTimeout(240_000);
  19 | 
  20 |     await runSteps({
  21 |       page,
  22 |       userFlow: 'Landing dark mode',
  23 |       steps: [
  24 |         { description: 'Navigate to /landing' },
  25 |         {
  26 |           description: 'Wait for the landing page to load',
  27 |           waitUntil: 'The hero heading about web analytics is visible',
  28 |         },
  29 |         { description: 'Click the dark mode toggle button in the navigation bar' },
  30 |         {
  31 |           description: 'Wait for the theme to switch',
  32 |           waitUntil: 'The page background has changed to dark',
  33 |         },
  34 |       ],
  35 |       assertions: [
  36 |         { assertion: 'The page now shows a dark background and lighter text colours' },
  37 |       ],
  38 |       test,
  39 |       expect,
  40 |     });
  41 |   });
  42 | 
  43 |   test('dashboard dark mode persists after navigation', async ({ page }) => {
  44 |     test.setTimeout(240_000);
  45 | 
  46 |     await injectAuth(page, _session);
  47 | 
> 48 |     await runSteps({
     |     ^ StepExecutionError: 
  49 |       page,
  50 |       userFlow: 'Dashboard dark mode persistence',
  51 |       steps: [
  52 |         { description: 'Navigate to /' },
  53 |         {
  54 |           description: 'Wait for the Dashboard to load',
  55 |           waitUntil: 'The Dashboard heading is visible',
  56 |         },
  57 |         { description: 'Click the theme toggle or dark mode button in the top navbar' },
  58 |         {
  59 |           description: 'Wait for the dark theme to apply',
  60 |           waitUntil: 'The dashboard has a dark background',
  61 |         },
  62 |         { description: 'Click the "Pages" link in the sidebar' },
  63 |         {
  64 |           description: 'Wait for the Pages section to load',
  65 |           waitUntil: 'The Pages heading is visible',
  66 |         },
  67 |       ],
  68 |       assertions: [
  69 |         {
  70 |           assertion:
  71 |             'The Pages section is still displayed with a dark background — the dark mode theme persisted across navigation',
  72 |         },
  73 |       ],
  74 |       test,
  75 |       expect,
  76 |     });
  77 |   });
  78 | });
  79 | 
```