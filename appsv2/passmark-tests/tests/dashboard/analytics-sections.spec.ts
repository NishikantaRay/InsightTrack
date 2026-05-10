/**
 * tests/dashboard/analytics-sections.spec.ts
 * Passmark AI-powered smoke tests for all remaining analytics sections:
 *   Conversions, Audience, Content, Acquisition, Performance,
 *   User Flow, Engagement, Reporting, Privacy.
 *
 * These tests verify that each page renders without an uncaught JS error,
 * shows its section heading, and has either data or a meaningful empty state.
 */
import { test, expect } from '@playwright/test';
import { runSteps } from 'passmark';
import { createTestSession, injectAuth } from '../../helpers/auth.js';

let _session: Awaited<ReturnType<typeof createTestSession>>;

test.beforeAll(async ({ request }) => {
  _session = await createTestSession(request, 'analytics-sections');
});

test.beforeEach(async ({ page }) => {
  await injectAuth(page, _session);
});

// ─── Conversions ──────────────────────────────────────────────────────────────

test.describe('Conversions (/conversions)', () => {
  test('renders heading and conversion metrics', async ({ page }) => {
    test.setTimeout(240_000);
    await runSteps({
      page,
      userFlow: 'Conversions section smoke test',
      steps: [
        {
          description: 'Navigate to /conversions',
          waitUntil: 'A heading containing the word Conversions is visible',
        },
      ],
      assertions: [
        { assertion: 'A heading with "Conversions" or "Conversions & Funnels" is visible' },
        {
          assertion:
            'Conversion goal metrics, a table, a chart, or an empty-state message is visible',
        },
      ],
      test,
      expect,
    });
  });
});

// ─── Audience ─────────────────────────────────────────────────────────────────

test.describe('Audience (/audience)', () => {
  test('renders heading and audience breakdown', async ({ page }) => {
    test.setTimeout(240_000);
    await runSteps({
      page,
      userFlow: 'Audience section smoke test',
      steps: [
        {
          description: 'Navigate to /audience',
          waitUntil: 'An "Audience" heading or an "New vs Returning Visitors" section heading is visible',
        },
      ],
      assertions: [
        { assertion: 'An "Audience" heading OR a "New vs Returning Visitors" heading is visible' },
        {
          assertion:
            'Device type, browser, or location breakdown charts or tables are visible, OR an empty-state placeholder',
        },
      ],
      test,
      expect,
    });
  });
});

// ─── Content ──────────────────────────────────────────────────────────────────

test.describe('Content (/content)', () => {
  test('renders heading and content analytics', async ({ page }) => {
    test.setTimeout(240_000);
    await runSteps({
      page,
      userFlow: 'Content section smoke test',
      steps: [
        {
          description: 'Navigate to /content',
          waitUntil: 'A heading containing the word Content is visible',
        },
      ],
      assertions: [
        { assertion: 'A "Content Analytics" or "Content" heading is visible' },
        {
          assertion:
            'Content performance data, top articles, or an empty-state placeholder is visible',
        },
      ],
      test,
      expect,
    });
  });
});

// ─── Acquisition ──────────────────────────────────────────────────────────────

test.describe('Acquisition (/acquisition)', () => {
  test('renders heading and traffic source breakdown', async ({ page }) => {
    test.setTimeout(240_000);
    await runSteps({
      page,
      userFlow: 'Acquisition section smoke test',
      steps: [
        {
          description: 'Navigate to /acquisition',
          waitUntil: 'An "Acquisition" heading is visible',
        },
      ],
      assertions: [
        { assertion: 'An "Acquisition" heading is visible' },
        {
          assertion:
            'Traffic source charts (direct, referral, social, organic) or an empty-state placeholder is visible',
        },
      ],
      test,
      expect,
    });
  });
});

// ─── Performance ──────────────────────────────────────────────────────────────

test.describe('Performance (/performance)', () => {
  test('renders heading and performance metrics', async ({ page }) => {
    test.setTimeout(240_000);
    await runSteps({
      page,
      userFlow: 'Performance section smoke test',
      steps: [
        {
          description: 'Navigate to /performance',
          waitUntil: 'A "Performance" heading is visible',
        },
      ],
      assertions: [
        { assertion: 'A "Performance" heading is visible' },
        {
          assertion:
            'Page load time, LCP, TTFB, or other web vitals metrics, OR an empty-state placeholder is visible',
        },
      ],
      test,
      expect,
    });
  });
});

// ─── User Flow ────────────────────────────────────────────────────────────────

test.describe('User Flow (/user-flow)', () => {
  test('renders heading and flow visualization', async ({ page }) => {
    test.setTimeout(240_000);
    await runSteps({
      page,
      userFlow: 'User Flow section smoke test',
      steps: [
        {
          description: 'Navigate to /user-flow',
          waitUntil: 'A "User Flow" heading is visible',
        },
      ],
      assertions: [
        { assertion: 'A "User Flow" heading is visible' },
        {
          assertion:
            'A flow diagram, Sankey chart, tree visualisation, or an empty-state message is visible',
        },
      ],
      test,
      expect,
    });
  });
});

// ─── Engagement ───────────────────────────────────────────────────────────────

test.describe('Engagement (/engagement)', () => {
  test('renders heading and engagement metrics', async ({ page }) => {
    test.setTimeout(240_000);
    await runSteps({
      page,
      userFlow: 'Engagement section smoke test',
      steps: [
        {
          description: 'Navigate to /engagement',
          waitUntil: 'An "Engagement" heading is visible',
        },
      ],
      assertions: [
        { assertion: 'An "Engagement" heading is visible' },
        {
          assertion:
            'Scroll depth, click heatmap, time on page, or other engagement metrics OR an empty-state placeholder is visible',
        },
      ],
      test,
      expect,
    });
  });
});

// ─── Reporting ────────────────────────────────────────────────────────────────

test.describe('Reporting (/reporting)', () => {
  test('renders heading and report controls', async ({ page }) => {
    test.setTimeout(240_000);
    await runSteps({
      page,
      userFlow: 'Reporting section smoke test',
      steps: [
        {
          description: 'Navigate to /reporting',
          waitUntil: 'A "Reporting" heading is visible',
        },
      ],
      assertions: [
        { assertion: 'A "Reporting" heading is visible' },
        {
          assertion:
            'Report download buttons, scheduled report controls, date range selectors, or an empty-state message is visible',
        },
      ],
      test,
      expect,
    });
  });
});

// ─── Privacy ──────────────────────────────────────────────────────────────────

test.describe('Privacy (/privacy)', () => {
  test('renders heading and privacy controls', async ({ page }) => {
    test.setTimeout(240_000);
    await runSteps({
      page,
      userFlow: 'Privacy section smoke test',
      steps: [
        {
          description: 'Navigate to /privacy',
          waitUntil: 'A heading containing the word Privacy is visible',
        },
      ],
      assertions: [
        { assertion: 'A "Privacy & Compliance" or "Privacy" heading is visible' },
        {
          assertion:
            'Data retention settings, GDPR compliance info, anonymisation options, or a privacy policy section is visible',
        },
      ],
      test,
      expect,
    });
  });
});
