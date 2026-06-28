# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth/register.spec.ts >> Register — new account creation >> successful registration redirects away from /register
- Location: tests/auth/register.spec.ts:9:3

# Error details

```
Error: The current URL is 'https://example.com/register', which clearly contains '/register'. Therefore, the assertion that the URL no longer contains '/register' is false.

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - heading "Example Domain" [level=1] [ref=e3]
  - paragraph [ref=e4]: This domain is for use in documentation examples without needing permission. Avoid use in operations.
  - paragraph [ref=e5]:
    - link "Learn more" [ref=e6] [cursor=pointer]:
      - /url: https://iana.org/domains/example
```

# Test source

```ts
  1   | /**
  2   |  * tests/auth/register.spec.ts
  3   |  * Passmark AI-powered tests for the Register page.
  4   |  */
  5   | import { test, expect } from '@playwright/test';
  6   | import { runSteps } from 'passmark';
  7   | 
  8   | test.describe('Register — new account creation', () => {
  9   |   test('successful registration redirects away from /register', async ({ page }) => {
  10  |     test.setTimeout(240_000);
  11  | 
> 12  |     await runSteps({
      |     ^ Error: The current URL is 'https://example.com/register', which clearly contains '/register'. Therefore, the assertion that the URL no longer contains '/register' is false.
  13  |       page,
  14  |       userFlow: 'Register a new user account',
  15  |       steps: [
  16  |         { description: 'Navigate to /register' },
  17  |         {
  18  |           description: 'Fill in the full name field',
  19  |           data: { value: '{{run.fullName}}' },
  20  |         },
  21  |         {
  22  |           description: 'Fill in the email field with a unique test email',
  23  |           data: { value: '{{run.email}}' },
  24  |         },
  25  |         {
  26  |           description: 'Fill in the password field',
  27  |           data: { value: 'Passmark$ecure123' },
  28  |         },
  29  |         { description: 'Click the Create Account or Register submit button' },
  30  |         {
  31  |           description: 'Wait until the URL is no longer /register',
  32  |           waitUntil: 'The URL does not contain /register',
  33  |         },
  34  |       ],
  35  |       assertions: [
  36  |         { assertion: 'The URL no longer contains /register' },
  37  |         {
  38  |           assertion:
  39  |             'Either the Onboarding page, the Dashboard, or a success message is visible',
  40  |         },
  41  |       ],
  42  |       test,
  43  |       expect,
  44  |     });
  45  |   });
  46  | 
  47  |   test('duplicate email shows an error', async ({ page, request }) => {
  48  |     test.setTimeout(240_000);
  49  | 
  50  |     // Pre-register a user via API so we can attempt duplicate registration
  51  |     const email = `dup-${Date.now()}@insightstrack.local`;
  52  |     await request.post(`${process.env.API_BASE_URL || 'http://localhost:3001'}/api/auth/register`, {
  53  |       data: { name: 'Dupe User', email, password: 'Passmark$ecure123' },
  54  |     });
  55  | 
  56  |     await runSteps({
  57  |       page,
  58  |       userFlow: 'Register with duplicate email',
  59  |       steps: [
  60  |         { description: 'Navigate to /register' },
  61  |         { description: 'Fill in the full name field', data: { value: 'Dupe User' } },
  62  |         { description: 'Fill in the email field', data: { value: email } },
  63  |         { description: 'Fill in the password field', data: { value: 'Passmark$ecure123' } },
  64  |         { description: 'Click the Create Account submit button' },
  65  |         {
  66  |           description: 'Wait for an error or toast message to appear',
  67  |           waitUntil: 'An error or toast notification is visible',
  68  |         },
  69  |       ],
  70  |       assertions: [
  71  |         { assertion: 'An error or toast message indicates this email is already registered or taken' },
  72  |         { assertion: 'The URL still contains /register — registration did not succeed' },
  73  |       ],
  74  |       test,
  75  |       expect,
  76  |     });
  77  |   });
  78  | 
  79  |   test('short password shows validation error', async ({ page }) => {
  80  |     test.setTimeout(240_000);
  81  | 
  82  |     await runSteps({
  83  |       page,
  84  |       userFlow: 'Register with short password',
  85  |       steps: [
  86  |         { description: 'Navigate to /register' },
  87  |         { description: 'Fill in the full name field', data: { value: 'Test User' } },
  88  |         { description: 'Fill in the email field', data: { value: '{{run.email}}' } },
  89  |         { description: 'Fill in the password field with only 3 characters', data: { value: 'abc' } },
  90  |         { description: 'Click the Create Account submit button' },
  91  |         {
  92  |           description: 'Wait for validation feedback',
  93  |           waitUntil: 'A validation error or toast is visible',
  94  |         },
  95  |       ],
  96  |       assertions: [
  97  |         { assertion: 'A validation message about password length or strength is displayed' },
  98  |       ],
  99  |       test,
  100 |       expect,
  101 |     });
  102 |   });
  103 | 
  104 |   test('login link on register page navigates to /login', async ({ page }) => {
  105 |     test.setTimeout(240_000);
  106 | 
  107 |     await runSteps({
  108 |       page,
  109 |       userFlow: 'Navigate from register to login',
  110 |       steps: [
  111 |         { description: 'Navigate to /register' },
  112 |         { description: 'Click the "Sign in" or "Already have an account" link' },
```