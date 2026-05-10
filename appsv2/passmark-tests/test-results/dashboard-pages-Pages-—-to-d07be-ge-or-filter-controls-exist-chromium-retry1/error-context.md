# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard/pages.spec.ts >> Pages — top pages analytics >> date range or filter controls exist
- Location: tests/dashboard/pages.spec.ts:69:3

# Error details

```
StepExecutionError: 
Key limit exceeded (total limit). Manage it using https://openrouter.ai/settings/keys
Step: Navigate to /pages
```

# Test source

```ts
  1  | /**
  2  |  * tests/dashboard/pages.spec.ts
  3  |  * Passmark AI-powered tests for the Pages analytics view (/pages).
  4  |  */
  5  | import { test, expect } from '@playwright/test';
  6  | import { runSteps } from 'passmark';
  7  | import { createTestSession, injectAuth } from '../../helpers/auth.js';
  8  | 
  9  | let _session: Awaited<ReturnType<typeof createTestSession>>;
  10 | 
  11 | test.beforeAll(async ({ request }) => {
  12 |   _session = await createTestSession(request, 'pages-view');
  13 | });
  14 | 
  15 | test.beforeEach(async ({ page }) => {
  16 |   await injectAuth(page, _session);
  17 | });
  18 | 
  19 | test.describe('Pages — top pages analytics', () => {
  20 |   test('Pages heading and data table render correctly', async ({ page }) => {
  21 |     test.setTimeout(240_000);
  22 | 
  23 |     await runSteps({
  24 |       page,
  25 |       userFlow: 'Pages view smoke test',
  26 |       steps: [
  27 |         { description: 'Navigate to /pages' },
  28 |         {
  29 |           description: 'Wait until the Pages heading or page content is visible',
  30 |           waitUntil: 'A heading with the text Pages is visible',
  31 |         },
  32 |       ],
  33 |       assertions: [
  34 |         { assertion: 'A "Pages" heading is visible at the top of the content area' },
  35 |         {
  36 |           assertion:
  37 |             'Either a data table with page paths and metrics OR a "no data" empty state is visible',
  38 |         },
  39 |       ],
  40 |       test,
  41 |       expect,
  42 |     });
  43 |   });
  44 | 
  45 |   test('PageNote info box is present', async ({ page }) => {
  46 |     test.setTimeout(240_000);
  47 | 
  48 |     await runSteps({
  49 |       page,
  50 |       userFlow: 'Pages view info note',
  51 |       steps: [
  52 |         { description: 'Navigate to /pages' },
  53 |         {
  54 |           description: 'Wait for page to load',
  55 |           waitUntil: 'The main content of the Pages page is visible',
  56 |         },
  57 |       ],
  58 |       assertions: [
  59 |         {
  60 |           assertion:
  61 |             'An informational note or info box explaining what the Pages section shows is visible',
  62 |         },
  63 |       ],
  64 |       test,
  65 |       expect,
  66 |     });
  67 |   });
  68 | 
  69 |   test('date range or filter controls exist', async ({ page }) => {
  70 |     test.setTimeout(240_000);
  71 | 
> 72 |     await runSteps({
     |     ^ StepExecutionError: 
  73 |       page,
  74 |       userFlow: 'Pages filter controls',
  75 |       steps: [
  76 |         { description: 'Navigate to /pages' },
  77 |         {
  78 |           description: 'Wait for page to load fully',
  79 |           waitUntil: 'The Pages heading is visible',
  80 |         },
  81 |         { description: 'Scroll the page to look for filter or date range controls' },
  82 |       ],
  83 |       assertions: [
  84 |         {
  85 |           assertion:
  86 |             'Date range selector, time period filter, or search controls are visible on the page',
  87 |         },
  88 |       ],
  89 |       test,
  90 |       expect,
  91 |     });
  92 |   });
  93 | });
  94 | 
```