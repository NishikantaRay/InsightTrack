# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth/login.spec.ts >> Login — authentication flow >> empty form shows validation messages
- Location: tests/auth/login.spec.ts:79:3

# Error details

```
Error: The accessibility snapshot shows the email textbox with the value 'notanemail', which is an invalid email format, but there is no visible toast or error message about an invalid email or required field present in the snapshot. Therefore, the assertion that such a message is visible does not pass based on the provided information.

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e6]:
    - generic [ref=e10]:
      - generic [ref=e11]:
        - img [ref=e13]
        - generic [ref=e15]: InsightTrack
      - paragraph [ref=e16]: Privacy-first web analytics
    - generic [ref=e17]:
      - heading "Understand your audience without compromising privacy." [level=2] [ref=e18]:
        - text: Understand your audience
        - text: without compromising privacy.
      - generic [ref=e19]:
        - generic [ref=e20]: Real-time visitor tracking
        - generic [ref=e22]: Conversion funnels & user flows
        - generic [ref=e24]: Multi-site management
        - generic [ref=e26]: Lightweight tracking script
    - paragraph [ref=e28]: © 2026 InsightTrack. Open-source analytics.
  - generic [ref=e31]:
    - generic [ref=e32]:
      - heading "Welcome back" [level=1] [ref=e33]
      - paragraph [ref=e34]: Sign in to your dashboard
    - generic [ref=e35]:
      - generic [ref=e36]:
        - generic [ref=e37]: Email
        - textbox "you@company.com" [active] [ref=e38]: notanemail
      - generic [ref=e39]:
        - generic [ref=e40]: Password
        - generic [ref=e41]:
          - textbox "Enter your password" [ref=e42]
          - button [ref=e43] [cursor=pointer]:
            - img [ref=e44]
      - button "Sign In" [ref=e47] [cursor=pointer]:
        - text: Sign In
        - img [ref=e48]
    - paragraph [ref=e50]:
      - text: Don't have an account?
      - link "Create one" [ref=e51] [cursor=pointer]:
        - /url: /register
```

# Test source

```ts
  1   | /**
  2   |  * tests/auth/login.spec.ts
  3   |  * Passmark AI-powered tests for the Login page.
  4   |  */
  5   | import { test, expect } from '@playwright/test';
  6   | import { runSteps } from 'passmark';
  7   | import { createTestSession } from '../../helpers/auth.js';
  8   | 
  9   | test.describe('Login — authentication flow', () => {
  10  |   test('valid credentials redirect to dashboard', async ({ page, request }) => {
  11  |     test.setTimeout(300_000);
  12  | 
  13  |     const session = await createTestSession(request, 'login-valid');
  14  | 
  15  |     await runSteps({
  16  |       page,
  17  |       userFlow: 'Login with valid credentials',
  18  |       steps: [
  19  |         {
  20  |           description: 'Navigate to /login and wait for the page to load',
  21  |           waitUntil: 'A "Welcome back" heading and a Sign In button are visible',
  22  |         },
  23  |         {
  24  |           description: `Type "${session.email}" into the email input field (placeholder: you@company.com)`,
  25  |         },
  26  |         {
  27  |           description: `Type "${session.password}" into the password input field (placeholder: Enter your password)`,
  28  |         },
  29  |         { description: 'Click the Sign In button to submit the login form' },
  30  |         {
  31  |           description: 'Wait until the browser navigates away from /login',
  32  |           waitUntil: 'The URL does not contain /login',
  33  |         },
  34  |       ],
  35  |       assertions: [
  36  |         { assertion: 'The current URL does not contain /login' },
  37  |         {
  38  |           assertion:
  39  |             'Either a Dashboard heading is visible OR an Onboarding page asking to add a website is visible',
  40  |         },
  41  |       ],
  42  |       test,
  43  |       expect,
  44  |     });
  45  |   });
  46  | 
  47  |   test('wrong password shows an error message', async ({ page }) => {
  48  |     test.setTimeout(240_000);
  49  | 
  50  |     await runSteps({
  51  |       page,
  52  |       userFlow: 'Login with wrong password',
  53  |       steps: [
  54  |         {
  55  |           description: 'Navigate to /login and wait for the page to load',
  56  |           waitUntil: 'A "Welcome back" heading and a Sign In button are visible',
  57  |         },
  58  |         {
  59  |           description: 'Type "wrong@example.com" into the email input field (placeholder: you@company.com)',
  60  |         },
  61  |         {
  62  |           description: 'Type "wrongpassword" into the password input field (placeholder: Enter your password)',
  63  |         },
  64  |         { description: 'Click the Sign In button to submit the login form' },
  65  |         {
  66  |           description: 'Wait for an error message or toast notification to appear on screen',
  67  |           waitUntil: 'An error message or toast notification is visible',
  68  |         },
  69  |       ],
  70  |       assertions: [
  71  |         { assertion: 'An error or toast message about failed login or invalid credentials is visible' },
  72  |         { assertion: 'The URL still contains /login — no redirect happened' },
  73  |       ],
  74  |       test,
  75  |       expect,
  76  |     });
  77  |   });
  78  | 
  79  |   test('empty form shows validation messages', async ({ page }) => {
  80  |     test.setTimeout(240_000);
  81  | 
  82  |     // Navigate directly — no runSteps needed for the nav step since we use page.goto
  83  |     await page.goto('/login');
  84  |     await page.waitForSelector('button[type="submit"], button:has-text("Sign In")', { timeout: 15_000 });
  85  | 
  86  |     // Type an invalid email (no @) to bypass browser native required validation
  87  |     // and trigger the JS validate() toast instead
  88  |     await page.fill('input[placeholder="you@company.com"]', 'notanemail');
  89  |     await page.click('button:has-text("Sign In")');
  90  | 
> 91  |     await runSteps({
      |     ^ Error: The accessibility snapshot shows the email textbox with the value 'notanemail', which is an invalid email format, but there is no visible toast or error message about an invalid email or required field present in the snapshot. Therefore, the assertion that such a message is visible does not pass based on the provided information.
  92  |       page,
  93  |       userFlow: 'Login form validation on invalid email',
  94  |       steps: [],
  95  |       assertions: [
  96  |         { assertion: 'A toast or error message about an invalid email or required field is visible' },
  97  |         { assertion: 'The URL still contains /login' },
  98  |       ],
  99  |       test,
  100 |       expect,
  101 |     });
  102 |   });
  103 | 
  104 |   test('password show/hide toggle works', async ({ page }) => {
  105 |     test.setTimeout(240_000);
  106 | 
  107 |     // Navigate and fill password using raw Playwright — the AI assertion model
  108 |     // cannot determine input type (text vs password) from the a11y snapshot,
  109 |     // so we use Playwright's toHaveAttribute for the type check.
  110 |     await page.goto('/login');
  111 |     await page.waitForSelector('input[placeholder="Enter your password"]', { timeout: 15_000 });
  112 | 
  113 |     const passwordInput = page.locator('input[placeholder="Enter your password"]');
  114 |     await passwordInput.fill('mypassword');
  115 | 
  116 |     // Verify it starts as type=password
  117 |     await expect(passwordInput).toHaveAttribute('type', 'password');
  118 | 
  119 |     // Click the show-password toggle button (the eye icon button next to the field)
  120 |     await page.locator('button[type="button"]:near(input[placeholder="Enter your password"])').click();
  121 | 
  122 |     // Verify it switched to type=text (password is now visible)
  123 |     await expect(passwordInput).toHaveAttribute('type', 'text');
  124 |   });
  125 | 
  126 |   test('register link navigates to /register', async ({ page }) => {
  127 |     test.setTimeout(240_000);
  128 | 
  129 |     await runSteps({
  130 |       page,
  131 |       userFlow: 'Navigate from login to register',
  132 |       steps: [
  133 |         {
  134 |           description: 'Navigate to /login and wait for the page to load',
  135 |           waitUntil: 'A "Welcome back" heading is visible',
  136 |         },
  137 |         { description: 'Click the "Create one" or "Create account" or "Register" link on the login page' },
  138 |         {
  139 |           description: 'Wait until the registration page has loaded',
  140 |           waitUntil: 'A "Create your account" heading or registration form is visible',
  141 |         },
  142 |       ],
  143 |       assertions: [{ assertion: 'The URL contains /register' }],
  144 |       test,
  145 |       expect,
  146 |     });
  147 |   });
  148 | });
  149 | 
```