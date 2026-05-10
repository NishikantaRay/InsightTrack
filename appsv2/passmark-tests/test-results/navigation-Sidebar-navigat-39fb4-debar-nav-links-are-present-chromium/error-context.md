# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> Sidebar navigation — end-to-end routing >> all 14 sidebar nav links are present
- Location: tests/navigation.spec.ts:134:3

# Error details

```
StepExecutionError: 
Key limit exceeded (total limit). Manage it using https://openrouter.ai/settings/keys
Step: Navigate to /
```

# Test source

```ts
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
  50  |     await runSteps({
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
> 137 |     await runSteps({
      |     ^ StepExecutionError: 
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
  151 |         { assertion: 'Conversions link is visible in the sidebar' },
  152 |         { assertion: 'Audience link is visible in the sidebar' },
  153 |         { assertion: 'Content link is visible in the sidebar' },
  154 |         { assertion: 'Acquisition link is visible in the sidebar' },
  155 |         { assertion: 'Performance link is visible in the sidebar' },
  156 |         { assertion: 'Realtime link is visible in the sidebar' },
  157 |         { assertion: 'User Flow link is visible in the sidebar' },
  158 |         { assertion: 'Engagement link is visible in the sidebar' },
  159 |         { assertion: 'Reporting link is visible in the sidebar' },
  160 |         { assertion: 'Privacy link is visible in the sidebar' },
  161 |         { assertion: 'Settings link is visible in the sidebar' },
  162 |       ],
  163 |       test,
  164 |       expect,
  165 |     });
  166 |   });
  167 | });
  168 | 
```