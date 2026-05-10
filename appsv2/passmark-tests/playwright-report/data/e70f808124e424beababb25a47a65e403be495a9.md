# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard/settings.spec.ts >> Settings — site configuration >> alerts panel is accessible
- Location: tests/dashboard/settings.spec.ts:105:3

# Error details

```
StepExecutionError: 
Key limit exceeded (total limit). Manage it using https://openrouter.ai/settings/keys
Step: Navigate to /settings
```

# Test source

```ts
  8   | 
  9   | let _session: Awaited<ReturnType<typeof createTestSession>>;
  10  | 
  11  | test.beforeAll(async ({ request }) => {
  12  |   _session = await createTestSession(request, 'settings');
  13  | });
  14  | 
  15  | test.beforeEach(async ({ page }) => {
  16  |   await injectAuth(page, _session);
  17  | });
  18  | 
  19  | test.describe('Settings — site configuration', () => {
  20  |   test('Settings page loads with tab navigation', async ({ page }) => {
  21  |     test.setTimeout(240_000);
  22  | 
  23  |     await runSteps({
  24  |       page,
  25  |       userFlow: 'Settings page load',
  26  |       steps: [
  27  |         { description: 'Navigate to /settings' },
  28  |         {
  29  |           description: 'Wait until the Settings page content is visible',
  30  |           waitUntil: 'A Settings heading or Settings tab navigation is visible',
  31  |         },
  32  |       ],
  33  |       assertions: [
  34  |         { assertion: 'A "Settings" heading or section is visible' },
  35  |         {
  36  |           assertion:
  37  |             'Tab navigation with options like Sites, Tracking Code, Alerts, or similar settings categories is visible',
  38  |         },
  39  |       ],
  40  |       test,
  41  |       expect,
  42  |     });
  43  |   });
  44  | 
  45  |   test('tracking code snippet is shown', async ({ page }) => {
  46  |     test.setTimeout(240_000);
  47  | 
  48  |     await runSteps({
  49  |       page,
  50  |       userFlow: 'Settings tracking code',
  51  |       steps: [
  52  |         { description: 'Navigate to /settings' },
  53  |         {
  54  |           description: 'Wait for the page to load',
  55  |           waitUntil: 'The Settings content is visible',
  56  |         },
  57  |         {
  58  |           description:
  59  |             'Click the "Tracking Code" or "Script" tab or find the tracking code section',
  60  |         },
  61  |         {
  62  |           description: 'Scroll to find the tracking script snippet',
  63  |           waitUntil: 'A code block or script tag is visible',
  64  |         },
  65  |       ],
  66  |       assertions: [
  67  |         {
  68  |           assertion:
  69  |             'A code block containing a script tag or tracking snippet with a site ID is visible',
  70  |         },
  71  |         { assertion: 'A "Copy" button next to the tracking code is visible' },
  72  |       ],
  73  |       test,
  74  |       expect,
  75  |     });
  76  |   });
  77  | 
  78  |   test('site manager section lists the current site', async ({ page }) => {
  79  |     test.setTimeout(240_000);
  80  | 
  81  |     await runSteps({
  82  |       page,
  83  |       userFlow: 'Settings site manager',
  84  |       steps: [
  85  |         { description: 'Navigate to /settings' },
  86  |         {
  87  |           description: 'Wait for the page to load',
  88  |           waitUntil: 'The Settings content is visible',
  89  |         },
  90  |         {
  91  |           description: 'Click the "Sites" tab or find the Sites management section',
  92  |         },
  93  |       ],
  94  |       assertions: [
  95  |         {
  96  |           assertion:
  97  |             'At least one site entry is listed in the site manager — showing a domain name or site name',
  98  |         },
  99  |       ],
  100 |       test,
  101 |       expect,
  102 |     });
  103 |   });
  104 | 
  105 |   test('alerts panel is accessible', async ({ page }) => {
  106 |     test.setTimeout(240_000);
  107 | 
> 108 |     await runSteps({
      |     ^ StepExecutionError: 
  109 |       page,
  110 |       userFlow: 'Settings alerts panel',
  111 |       steps: [
  112 |         { description: 'Navigate to /settings' },
  113 |         {
  114 |           description: 'Wait for the page to load',
  115 |           waitUntil: 'The Settings content is visible',
  116 |         },
  117 |         {
  118 |           description: 'Click the "Alerts" or "Notifications" tab or section',
  119 |         },
  120 |       ],
  121 |       assertions: [
  122 |         {
  123 |           assertion:
  124 |             'An alerts panel, notification settings form, or alert configuration section is visible',
  125 |         },
  126 |       ],
  127 |       test,
  128 |       expect,
  129 |     });
  130 |   });
  131 | });
  132 | 
```