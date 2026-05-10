# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> Sidebar navigation — end-to-end routing >> navigates from Dashboard to Realtime via sidebar
- Location: tests/navigation.spec.ts:47:3

# Error details

```
StepExecutionError: 
Key limit exceeded (total limit). Manage it using https://openrouter.ai/settings/keys
Step: Navigate to /
```

# Test source

```ts
  1   | /**
  2   |  * tests/navigation.spec.ts
  3   |  * Passmark AI-powered tests for sidebar navigation between all sections.
  4   |  */
  5   | import { test, expect } from '@playwright/test';
  6   | import { runSteps } from 'passmark';
  7   | import { createTestSession, injectAuth } from '../helpers/auth.js';
  8   | 
  9   | let _session: Awaited<ReturnType<typeof createTestSession>>;
  10  | 
  11  | test.beforeAll(async ({ request }) => {
  12  |   _session = await createTestSession(request, 'navigation');
  13  | });
  14  | 
  15  | test.beforeEach(async ({ page }) => {
  16  |   await injectAuth(page, _session);
  17  | });
  18  | 
  19  | test.describe('Sidebar navigation — end-to-end routing', () => {
  20  |   test('navigates from Dashboard to Pages via sidebar', async ({ page }) => {
  21  |     test.setTimeout(240_000);
  22  | 
  23  |     await runSteps({
  24  |       page,
  25  |       userFlow: 'Dashboard to Pages navigation',
  26  |       steps: [
  27  |         { description: 'Navigate to /' },
  28  |         {
  29  |           description: 'Wait for the Dashboard to load',
  30  |           waitUntil: 'The Dashboard heading is visible',
  31  |         },
  32  |         { description: 'Click the "Pages" link in the sidebar navigation' },
  33  |         {
  34  |           description: 'Wait for the Pages section to load',
  35  |           waitUntil: 'A heading with the text Pages is visible',
  36  |         },
  37  |       ],
  38  |       assertions: [
  39  |         { assertion: 'The URL contains /pages' },
  40  |         { assertion: 'A "Pages" heading is visible in the main content area' },
  41  |       ],
  42  |       test,
  43  |       expect,
  44  |     });
  45  |   });
  46  | 
  47  |   test('navigates from Dashboard to Realtime via sidebar', async ({ page }) => {
  48  |     test.setTimeout(240_000);
  49  | 
> 50  |     await runSteps({
      |     ^ StepExecutionError: 
  51  |       page,
  52  |       userFlow: 'Dashboard to Realtime navigation',
  53  |       steps: [
  54  |         { description: 'Navigate to /' },
  55  |         {
  56  |           description: 'Wait for the Dashboard to load',
  57  |           waitUntil: 'The sidebar navigation is visible',
  58  |         },
  59  |         { description: 'Click the "Realtime" link in the sidebar navigation' },
  60  |         {
  61  |           description: 'Wait for the Realtime section to load',
  62  |           waitUntil: 'A Realtime heading and active visitor counter is visible',
  63  |         },
  64  |       ],
  65  |       assertions: [
  66  |         { assertion: 'The URL contains /realtime' },
  67  |         { assertion: 'A "Realtime" heading is visible' },
  68  |       ],
  69  |       test,
  70  |       expect,
  71  |     });
  72  |   });
  73  | 
  74  |   test('navigates to Funnels and back to Dashboard', async ({ page }) => {
  75  |     test.setTimeout(240_000);
  76  | 
  77  |     await runSteps({
  78  |       page,
  79  |       userFlow: 'Funnels round-trip navigation',
  80  |       steps: [
  81  |         { description: 'Navigate to /' },
  82  |         {
  83  |           description: 'Wait for sidebar to appear',
  84  |           waitUntil: 'The sidebar navigation is visible',
  85  |         },
  86  |         { description: 'Click the "Funnels" link in the sidebar' },
  87  |         {
  88  |           description: 'Wait for the Funnels page to load',
  89  |           waitUntil: 'A Funnels heading is visible',
  90  |         },
  91  |         { description: 'Click the "Dashboard" or home icon link in the sidebar' },
  92  |         {
  93  |           description: 'Wait for the Dashboard to load',
  94  |           waitUntil: 'The Dashboard heading or KPI cards are visible',
  95  |         },
  96  |       ],
  97  |       assertions: [
  98  |         { assertion: 'The URL is now / or /dashboard — back on the Dashboard' },
  99  |         { assertion: 'KPI metric cards for visitors and pageviews are visible' },
  100 |       ],
  101 |       test,
  102 |       expect,
  103 |     });
  104 |   });
  105 | 
  106 |   test('sidebar collapse toggle works', async ({ page }) => {
  107 |     test.setTimeout(240_000);
  108 | 
  109 |     await runSteps({
  110 |       page,
  111 |       userFlow: 'Sidebar collapse toggle',
  112 |       steps: [
  113 |         { description: 'Navigate to /' },
  114 |         {
  115 |           description: 'Wait for the sidebar to be visible',
  116 |           waitUntil: 'The sidebar with navigation links is visible',
  117 |         },
  118 |         {
  119 |           description:
  120 |             'Click the collapse button or chevron icon at the bottom of the sidebar to collapse it',
  121 |         },
  122 |       ],
  123 |       assertions: [
  124 |         {
  125 |           assertion:
  126 |             'The sidebar is now collapsed — navigation text labels are hidden and only icons are visible, OR the sidebar width has reduced significantly',
  127 |         },
  128 |       ],
  129 |       test,
  130 |       expect,
  131 |     });
  132 |   });
  133 | 
  134 |   test('all 14 sidebar nav links are present', async ({ page }) => {
  135 |     test.setTimeout(240_000);
  136 | 
  137 |     await runSteps({
  138 |       page,
  139 |       userFlow: 'Sidebar completeness check',
  140 |       steps: [
  141 |         { description: 'Navigate to /' },
  142 |         {
  143 |           description: 'Wait for the sidebar to load',
  144 |           waitUntil: 'The sidebar navigation with multiple links is visible',
  145 |         },
  146 |       ],
  147 |       assertions: [
  148 |         { assertion: 'Dashboard link is visible in the sidebar' },
  149 |         { assertion: 'Pages link is visible in the sidebar' },
  150 |         { assertion: 'Funnels link is visible in the sidebar' },
```