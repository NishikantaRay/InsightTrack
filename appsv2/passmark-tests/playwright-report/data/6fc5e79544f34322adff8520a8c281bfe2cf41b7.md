# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard/funnels.spec.ts >> Funnels — conversion funnel builder >> funnel chart section is present
- Location: tests/dashboard/funnels.spec.ts:78:3

# Error details

```
StepExecutionError: 
Key limit exceeded (total limit). Manage it using https://openrouter.ai/settings/keys
Step: Navigate to /funnels
```

# Test source

```ts
  1   | /**
  2   |  * tests/dashboard/funnels.spec.ts
  3   |  * Passmark AI-powered tests for the Funnels page (/funnels).
  4   |  */
  5   | import { test, expect } from '@playwright/test';
  6   | import { runSteps } from 'passmark';
  7   | import { createTestSession, injectAuth } from '../../helpers/auth.js';
  8   | 
  9   | let _session: Awaited<ReturnType<typeof createTestSession>>;
  10  | 
  11  | test.beforeAll(async ({ request }) => {
  12  |   _session = await createTestSession(request, 'funnels');
  13  | });
  14  | 
  15  | test.beforeEach(async ({ page }) => {
  16  |   await injectAuth(page, _session);
  17  | });
  18  | 
  19  | test.describe('Funnels — conversion funnel builder', () => {
  20  |   test('Funnels page loads with builder UI', async ({ page }) => {
  21  |     test.setTimeout(240_000);
  22  | 
  23  |     await runSteps({
  24  |       page,
  25  |       userFlow: 'Funnels page smoke test',
  26  |       steps: [
  27  |         { description: 'Navigate to /funnels' },
  28  |         {
  29  |           description: 'Wait until the Funnels heading is visible',
  30  |           waitUntil: 'A heading with the text Funnels is visible',
  31  |         },
  32  |       ],
  33  |       assertions: [
  34  |         { assertion: 'A "Funnels" heading is visible' },
  35  |         {
  36  |           assertion:
  37  |             'A funnel builder, step editor, or "Add Step" button is visible on the page',
  38  |         },
  39  |       ],
  40  |       test,
  41  |       expect,
  42  |     });
  43  |   });
  44  | 
  45  |   test('user can add a funnel step', async ({ page }) => {
  46  |     test.setTimeout(240_000);
  47  | 
  48  |     await runSteps({
  49  |       page,
  50  |       userFlow: 'Add a funnel step',
  51  |       steps: [
  52  |         { description: 'Navigate to /funnels' },
  53  |         {
  54  |           description: 'Wait for the funnels page to fully load',
  55  |           waitUntil: 'The Funnels heading is visible',
  56  |         },
  57  |         { description: 'Click the "Add Step" button or the "+" button in the funnel builder' },
  58  |         {
  59  |           description: 'Wait for a step input or URL path field to appear',
  60  |           waitUntil: 'An input field for a funnel step URL or path is visible',
  61  |         },
  62  |         {
  63  |           description: 'Fill in a URL path for the funnel step',
  64  |           data: { value: '/home' },
  65  |         },
  66  |       ],
  67  |       assertions: [
  68  |         {
  69  |           assertion:
  70  |             'A funnel step with the path /home or a step entry has been added to the funnel builder',
  71  |         },
  72  |       ],
  73  |       test,
  74  |       expect,
  75  |     });
  76  |   });
  77  | 
  78  |   test('funnel chart section is present', async ({ page }) => {
  79  |     test.setTimeout(240_000);
  80  | 
> 81  |     await runSteps({
      |     ^ StepExecutionError: 
  82  |       page,
  83  |       userFlow: 'Funnels chart area',
  84  |       steps: [
  85  |         { description: 'Navigate to /funnels' },
  86  |         {
  87  |           description: 'Wait for the funnels page to load',
  88  |           waitUntil: 'The Funnels heading is visible',
  89  |         },
  90  |         { description: 'Scroll down to find the funnel visualisation or chart area' },
  91  |       ],
  92  |       assertions: [
  93  |         {
  94  |           assertion:
  95  |             'A funnel chart, bar chart, or a "no data / add steps" placeholder is visible in the content area',
  96  |         },
  97  |       ],
  98  |       test,
  99  |       expect,
  100 |     });
  101 |   });
  102 | });
  103 | 
```