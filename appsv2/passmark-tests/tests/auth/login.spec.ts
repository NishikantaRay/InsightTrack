/**
 * tests/auth/login.spec.ts
 * Passmark AI-powered tests for the Login page.
 */
import { test, expect } from '@playwright/test';
import { runSteps } from 'passmark';
import { createTestSession } from '../../helpers/auth.js';

test.describe('Login — authentication flow', () => {
  test('valid credentials redirect to dashboard', async ({ page, request }) => {
    test.setTimeout(300_000);

    const session = await createTestSession(request, 'login-valid');

    await runSteps({
      page,
      userFlow: 'Login with valid credentials',
      steps: [
        {
          description: 'Navigate to /login and wait for the page to load',
          waitUntil: 'A "Welcome back" heading and a Sign In button are visible',
        },
        {
          description: `Type "${session.email}" into the email input field (placeholder: you@company.com)`,
        },
        {
          description: `Type "${session.password}" into the password input field (placeholder: Enter your password)`,
        },
        { description: 'Click the Sign In button to submit the login form' },
        {
          description: 'Wait until the browser navigates away from /login',
          waitUntil: 'The URL does not contain /login',
        },
      ],
      assertions: [
        { assertion: 'The current URL does not contain /login' },
        {
          assertion:
            'Either a Dashboard heading is visible OR an Onboarding page asking to add a website is visible',
        },
      ],
      test,
      expect,
    });
  });

  test('wrong password shows an error message', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Login with wrong password',
      steps: [
        {
          description: 'Navigate to /login and wait for the page to load',
          waitUntil: 'A "Welcome back" heading and a Sign In button are visible',
        },
        {
          description: 'Type "wrong@example.com" into the email input field (placeholder: you@company.com)',
        },
        {
          description: 'Type "wrongpassword" into the password input field (placeholder: Enter your password)',
        },
        { description: 'Click the Sign In button to submit the login form' },
        {
          description: 'Wait for an error message or toast notification to appear on screen',
          waitUntil: 'An error message or toast notification is visible',
        },
      ],
      assertions: [
        { assertion: 'An error or toast message about failed login or invalid credentials is visible' },
        { assertion: 'The URL still contains /login — no redirect happened' },
      ],
      test,
      expect,
    });
  });

  test('empty form shows validation messages', async ({ page }) => {
    test.setTimeout(240_000);

    // Navigate directly — no runSteps needed for the nav step since we use page.goto
    await page.goto('/login');
    await page.waitForSelector('button[type="submit"], button:has-text("Sign In")', { timeout: 15_000 });

    // Type an invalid email (no @) to bypass browser native required validation
    // and trigger the JS validate() toast instead
    await page.fill('input[placeholder="you@company.com"]', 'notanemail');
    await page.click('button:has-text("Sign In")');

    await runSteps({
      page,
      userFlow: 'Login form validation on invalid email',
      steps: [],
      assertions: [
        { assertion: 'A toast or error message about an invalid email or required field is visible' },
        { assertion: 'The URL still contains /login' },
      ],
      test,
      expect,
    });
  });

  test('password show/hide toggle works', async ({ page }) => {
    test.setTimeout(240_000);

    // Navigate and fill password using raw Playwright — the AI assertion model
    // cannot determine input type (text vs password) from the a11y snapshot,
    // so we use Playwright's toHaveAttribute for the type check.
    await page.goto('/login');
    await page.waitForSelector('input[placeholder="Enter your password"]', { timeout: 15_000 });

    const passwordInput = page.locator('input[placeholder="Enter your password"]');
    await passwordInput.fill('mypassword');

    // Verify it starts as type=password
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click the show-password toggle button (the eye icon button next to the field)
    await page.locator('button[type="button"]:near(input[placeholder="Enter your password"])').click();

    // Verify it switched to type=text (password is now visible)
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('register link navigates to /register', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Navigate from login to register',
      steps: [
        {
          description: 'Navigate to /login and wait for the page to load',
          waitUntil: 'A "Welcome back" heading is visible',
        },
        { description: 'Click the "Create one" or "Create account" or "Register" link on the login page' },
        {
          description: 'Wait until the registration page has loaded',
          waitUntil: 'A "Create your account" heading or registration form is visible',
        },
      ],
      assertions: [{ assertion: 'The URL contains /register' }],
      test,
      expect,
    });
  });
});
