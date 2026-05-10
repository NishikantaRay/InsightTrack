/**
 * tests/public/landing.spec.ts
 * Passmark AI-powered tests for the public Landing page.
 */
import { test, expect } from '@playwright/test';
import { runSteps, assert } from 'passmark';

test.describe('Landing page — public entry point', () => {
  test('hero section is visible with CTA buttons', async ({ page, request: _r }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Landing page smoke test',
      steps: [
        { description: 'Navigate to /landing' },
        {
          description: 'Wait until the hero heading is visible',
          waitUntil: 'A large heading about web analytics is visible',
        },
      ],
      assertions: [
        { assertion: 'The page contains a prominent heading mentioning web analytics' },
        { assertion: 'A "Create Free Account" or "Get Started" call-to-action button is visible' },
        { assertion: 'A "Sign in" or "Login" link is visible' },
      ],
      test,
      expect,
    });
  });

  test('navigating from landing → register → login works', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Landing to register to login navigation',
      steps: [
        { description: 'Navigate to /landing' },
        { description: 'Click the "Create Free Account" or "Get Started" button' },
        {
          description: 'Wait until the registration page is loaded',
          waitUntil: 'A form with email and password fields is visible',
        },
        { description: 'Click the "Sign in" link on the register page' },
        {
          description: 'Wait until the login page is loaded',
          waitUntil: 'A login form with email and password fields is visible',
        },
      ],
      assertions: [
        { assertion: 'The URL ends with /login' },
        { assertion: 'A login form with email and password inputs is visible' },
      ],
      test,
      expect,
    });
  });

  test('dark mode toggle switches the theme', async ({ page }) => {
    test.setTimeout(240_000);

    await runSteps({
      page,
      userFlow: 'Theme toggle on landing page',
      steps: [
        { description: 'Navigate to /landing' },
        { description: 'Click the dark mode / theme toggle button' },
        {
          description: 'Wait 1 second for the theme transition to complete',
          waitUntil: 'The page has applied a dark background colour',
        },
      ],
      assertions: [
        { assertion: 'The page background is dark or the html element has the dark class applied' },
      ],
      test,
      expect,
    });
  });
});
