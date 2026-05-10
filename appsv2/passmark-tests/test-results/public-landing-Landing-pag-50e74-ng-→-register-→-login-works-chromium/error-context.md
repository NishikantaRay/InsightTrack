# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public/landing.spec.ts >> Landing page — public entry point >> navigating from landing → register → login works
- Location: tests/public/landing.spec.ts:32:3

# Error details

```
StepExecutionError: 
Key limit exceeded (total limit). Manage it using https://openrouter.ai/settings/keys
Step: Navigate to /landing
```

# Test source

```ts
  1  | /**
  2  |  * tests/public/landing.spec.ts
  3  |  * Passmark AI-powered tests for the public Landing page.
  4  |  */
  5  | import { test, expect } from '@playwright/test';
  6  | import { runSteps, assert } from 'passmark';
  7  | 
  8  | test.describe('Landing page — public entry point', () => {
  9  |   test('hero section is visible with CTA buttons', async ({ page, request: _r }) => {
  10 |     test.setTimeout(240_000);
  11 | 
  12 |     await runSteps({
  13 |       page,
  14 |       userFlow: 'Landing page smoke test',
  15 |       steps: [
  16 |         { description: 'Navigate to /landing' },
  17 |         {
  18 |           description: 'Wait until the hero heading is visible',
  19 |           waitUntil: 'A large heading about web analytics is visible',
  20 |         },
  21 |       ],
  22 |       assertions: [
  23 |         { assertion: 'The page contains a prominent heading mentioning web analytics' },
  24 |         { assertion: 'A "Create Free Account" or "Get Started" call-to-action button is visible' },
  25 |         { assertion: 'A "Sign in" or "Login" link is visible' },
  26 |       ],
  27 |       test,
  28 |       expect,
  29 |     });
  30 |   });
  31 | 
  32 |   test('navigating from landing → register → login works', async ({ page }) => {
  33 |     test.setTimeout(240_000);
  34 | 
> 35 |     await runSteps({
     |     ^ StepExecutionError: 
  36 |       page,
  37 |       userFlow: 'Landing to register to login navigation',
  38 |       steps: [
  39 |         { description: 'Navigate to /landing' },
  40 |         { description: 'Click the "Create Free Account" or "Get Started" button' },
  41 |         {
  42 |           description: 'Wait until the registration page is loaded',
  43 |           waitUntil: 'A form with email and password fields is visible',
  44 |         },
  45 |         { description: 'Click the "Sign in" link on the register page' },
  46 |         {
  47 |           description: 'Wait until the login page is loaded',
  48 |           waitUntil: 'A login form with email and password fields is visible',
  49 |         },
  50 |       ],
  51 |       assertions: [
  52 |         { assertion: 'The URL ends with /login' },
  53 |         { assertion: 'A login form with email and password inputs is visible' },
  54 |       ],
  55 |       test,
  56 |       expect,
  57 |     });
  58 |   });
  59 | 
  60 |   test('dark mode toggle switches the theme', async ({ page }) => {
  61 |     test.setTimeout(240_000);
  62 | 
  63 |     await runSteps({
  64 |       page,
  65 |       userFlow: 'Theme toggle on landing page',
  66 |       steps: [
  67 |         { description: 'Navigate to /landing' },
  68 |         { description: 'Click the dark mode / theme toggle button' },
  69 |         {
  70 |           description: 'Wait 1 second for the theme transition to complete',
  71 |           waitUntil: 'The page has applied a dark background colour',
  72 |         },
  73 |       ],
  74 |       assertions: [
  75 |         { assertion: 'The page background is dark or the html element has the dark class applied' },
  76 |       ],
  77 |       test,
  78 |       expect,
  79 |     });
  80 |   });
  81 | });
  82 | 
```