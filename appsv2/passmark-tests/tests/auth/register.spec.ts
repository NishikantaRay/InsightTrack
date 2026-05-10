/**
 * tests/auth/register.spec.ts
 * Passmark AI-powered tests for the Register page.
 */
import { test, expect } from '@playwright/test';
import { runSteps } from 'passmark';

test.describe('Register — new account creation', () => {
  test('successful registration redirects away from /register', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Register a new user account',
      steps: [
        { description: 'Navigate to /register' },
        {
          description: 'Fill in the full name field',
          data: { value: '{{run.fullName}}' },
        },
        {
          description: 'Fill in the email field with a unique test email',
          data: { value: '{{run.email}}' },
        },
        {
          description: 'Fill in the password field',
          data: { value: 'Passmark$ecure123' },
        },
        { description: 'Click the Create Account or Register submit button' },
        {
          description: 'Wait until the URL is no longer /register',
          waitUntil: 'The URL does not contain /register',
        },
      ],
      assertions: [
        { assertion: 'The URL no longer contains /register' },
        {
          assertion:
            'Either the Onboarding page, the Dashboard, or a success message is visible',
        },
      ],
      test,
      expect,
    });
  });

  test('duplicate email shows an error', async ({ page, request }) => {
    test.setTimeout(240_000);

    // Pre-register a user via API so we can attempt duplicate registration
    const email = `dup-${Date.now()}@insighttrack.local`;
    await request.post(`${process.env.API_BASE_URL || 'http://localhost:3001'}/api/auth/register`, {
      data: { name: 'Dupe User', email, password: 'Passmark$ecure123' },
    });

    await runSteps({
      page,
      userFlow: 'Register with duplicate email',
      steps: [
        { description: 'Navigate to /register' },
        { description: 'Fill in the full name field', data: { value: 'Dupe User' } },
        { description: 'Fill in the email field', data: { value: email } },
        { description: 'Fill in the password field', data: { value: 'Passmark$ecure123' } },
        { description: 'Click the Create Account submit button' },
        {
          description: 'Wait for an error or toast message to appear',
          waitUntil: 'An error or toast notification is visible',
        },
      ],
      assertions: [
        { assertion: 'An error or toast message indicates this email is already registered or taken' },
        { assertion: 'The URL still contains /register — registration did not succeed' },
      ],
      test,
      expect,
    });
  });

  test('short password shows validation error', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Register with short password',
      steps: [
        { description: 'Navigate to /register' },
        { description: 'Fill in the full name field', data: { value: 'Test User' } },
        { description: 'Fill in the email field', data: { value: '{{run.email}}' } },
        { description: 'Fill in the password field with only 3 characters', data: { value: 'abc' } },
        { description: 'Click the Create Account submit button' },
        {
          description: 'Wait for validation feedback',
          waitUntil: 'A validation error or toast is visible',
        },
      ],
      assertions: [
        { assertion: 'A validation message about password length or strength is displayed' },
      ],
      test,
      expect,
    });
  });

  test('login link on register page navigates to /login', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Navigate from register to login',
      steps: [
        { description: 'Navigate to /register' },
        { description: 'Click the "Sign in" or "Already have an account" link' },
        {
          description: 'Wait for the login page to load',
          waitUntil: 'A login form is visible',
        },
      ],
      assertions: [{ assertion: 'The URL contains /login' }],
      test,
      expect,
    });
  });
});
