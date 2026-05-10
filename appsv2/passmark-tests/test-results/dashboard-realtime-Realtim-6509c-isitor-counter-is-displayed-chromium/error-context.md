# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard/realtime.spec.ts >> Realtime — live visitor monitoring >> active visitor counter is displayed
- Location: tests/dashboard/realtime.spec.ts:20:3

# Error details

```
StepExecutionError: 
Key limit exceeded (total limit). Manage it using https://openrouter.ai/settings/keys
Step: Navigate to /realtime
```

# Test source

```ts
  1   | /**
  2   |  * tests/dashboard/realtime.spec.ts
  3   |  * Passmark AI-powered tests for the Realtime dashboard (/realtime).
  4   |  */
  5   | import { test, expect } from '@playwright/test';
  6   | import { runSteps } from 'passmark';
  7   | import { createTestSession, injectAuth } from '../../helpers/auth.js';
  8   | 
  9   | let _session: Awaited<ReturnType<typeof createTestSession>>;
  10  | 
  11  | test.beforeAll(async ({ request }) => {
  12  |   _session = await createTestSession(request, 'realtime');
  13  | });
  14  | 
  15  | test.beforeEach(async ({ page }) => {
  16  |   await injectAuth(page, _session);
  17  | });
  18  | 
  19  | test.describe('Realtime — live visitor monitoring', () => {
  20  |   test('active visitor counter is displayed', async ({ page }) => {
  21  |     test.setTimeout(240_000);
  22  | 
> 23  |     await runSteps({
      |     ^ StepExecutionError: 
  24  |       page,
  25  |       userFlow: 'Realtime active visitor count',
  26  |       steps: [
  27  |         { description: 'Navigate to /realtime' },
  28  |         {
  29  |           description: 'Wait until the Realtime page heading is visible',
  30  |           waitUntil: 'A heading with the text Realtime is visible',
  31  |         },
  32  |       ],
  33  |       assertions: [
  34  |         { assertion: 'A "Realtime" heading is visible' },
  35  |         {
  36  |           assertion:
  37  |             'A large number or counter showing active visitors or "visitors right now" is displayed',
  38  |         },
  39  |         {
  40  |           assertion:
  41  |             'Text indicating "Active right now" or "visitors in the last 5 minutes" is visible',
  42  |         },
  43  |       ],
  44  |       test,
  45  |       expect,
  46  |     });
  47  |   });
  48  | 
  49  |   test('live visitor map section exists', async ({ page }) => {
  50  |     test.setTimeout(240_000);
  51  | 
  52  |     await runSteps({
  53  |       page,
  54  |       userFlow: 'Realtime visitor map',
  55  |       steps: [
  56  |         { description: 'Navigate to /realtime' },
  57  |         {
  58  |           description: 'Wait for the page to load',
  59  |           waitUntil: 'The Realtime heading is visible',
  60  |         },
  61  |         { description: 'Scroll down to find the Live Visitor Map section' },
  62  |       ],
  63  |       assertions: [
  64  |         {
  65  |           assertion:
  66  |             'A "Live Visitor Map" section header or a world map visualization is visible, OR a "No geographic data" placeholder is shown',
  67  |         },
  68  |       ],
  69  |       test,
  70  |       expect,
  71  |     });
  72  |   });
  73  | 
  74  |   test('live event stream section is present', async ({ page }) => {
  75  |     test.setTimeout(240_000);
  76  | 
  77  |     await runSteps({
  78  |       page,
  79  |       userFlow: 'Realtime event stream',
  80  |       steps: [
  81  |         { description: 'Navigate to /realtime' },
  82  |         {
  83  |           description: 'Wait for the page to load',
  84  |           waitUntil: 'The Realtime heading is visible',
  85  |         },
  86  |         { description: 'Scroll down to find the Live Event Stream section' },
  87  |       ],
  88  |       assertions: [
  89  |         {
  90  |           assertion:
  91  |             'A "Live Event Stream" or event feed section is visible, showing recent page loads or events',
  92  |         },
  93  |       ],
  94  |       test,
  95  |       expect,
  96  |     });
  97  |   });
  98  | 
  99  |   test('active ping animation is visible', async ({ page }) => {
  100 |     test.setTimeout(240_000);
  101 | 
  102 |     await runSteps({
  103 |       page,
  104 |       userFlow: 'Realtime pulse animation',
  105 |       steps: [
  106 |         { description: 'Navigate to /realtime' },
  107 |         {
  108 |           description: 'Wait until the active visitor counter area loads',
  109 |           waitUntil: 'The active visitors counter section is visible',
  110 |         },
  111 |       ],
  112 |       assertions: [
  113 |         {
  114 |           assertion:
  115 |             'A green pulsing circle, dot, or ping animation is visible near the active visitor counter, indicating live status',
  116 |         },
  117 |       ],
  118 |       test,
  119 |       expect,
  120 |     });
  121 |   });
  122 | });
  123 | 
```