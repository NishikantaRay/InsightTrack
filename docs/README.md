# InsightTrack — Passmark AI Test Suite

AI-powered end-to-end tests for the InsightTrack analytics dashboard. Instead of CSS selectors and brittle `getByTestId` calls, every test is written in **plain English** — the AI reads the page like a human and acts on it.

> **Test suite location:** `appsv2/passmark-tests/`

---

## What Is This?

This is the test suite for the InsightTrack dashboard, built with [Passmark](https://github.com/bug0inc/passmark) — an AI-native testing layer that sits on top of Playwright.

The key idea: you describe **what to do** and **what to assert** in natural language. Passmark converts those descriptions into real browser actions using an LLM, evaluates assertions against a live DOM snapshot, and reports pass/fail just like a normal Playwright test.

```
"Navigate to /login and wait for the Sign In button"
            ↓
    Passmark calls the AI with a DOM snapshot
            ↓
    AI emits tool calls: browser_navigate("/login"), browser_wait_for_element(...)
            ↓
    Playwright executes them in a real Chromium browser
            ↓
    "The current URL does not contain /login" → PASS / FAIL
```

No XPaths. No `data-testid` attributes. No re-writing tests when you rename a component.

---

## Project Structure

```
appsv2/passmark-tests/
├── .env                    # API keys and base URLs (never commit this)
├── .env.example            # Template — copy to .env and fill in
├── playwright.config.ts    # Passmark + Playwright configuration
├── helpers/
│   └── auth.ts             # createTestSession() + injectAuth() utilities
└── tests/
    ├── auth/
    │   ├── login.spec.ts           # 5 login flow tests
    │   └── register.spec.ts        # 4 registration flow tests
    ├── dashboard/
    │   ├── dashboard.spec.ts       # 6 main dashboard tests
    │   ├── analytics-sections.spec.ts  # 9 analytics page smoke tests
    │   ├── realtime.spec.ts        # 4 realtime page tests
    │   ├── funnels.spec.ts         # 3 funnels page tests
    │   ├── pages.spec.ts           # 3 pages report tests
    │   ├── settings.spec.ts        # 4 settings tests
    │   ├── profile.spec.ts         # 2 profile page tests
    │   └── docs.spec.ts            # 2 docs page tests
    ├── navigation.spec.ts          # 5 sidebar navigation tests
    ├── theme.spec.ts               # 2 dark/light mode tests
    └── public/
        └── landing.spec.ts         # 3 landing page tests
```

**52 tests total across 17 routes.**

---

## How It Works

### 1. Writing a Test

A Passmark test has two parts: **steps** (actions) and **assertions** (checks).

```typescript
import { test, expect } from '@playwright/test';
import { runSteps } from 'passmark';

test('KPI metric cards are visible', async ({ page }) => {
  test.setTimeout(240_000); // AI calls need time

  await runSteps({
    page,
    userFlow: 'Dashboard KPI cards',     // human-readable label for logs
    steps: [
      { description: 'Navigate to /' },
      {
        description: 'Wait until the Dashboard heading is visible',
        waitUntil: 'A heading with the text Dashboard is visible',
      },
    ],
    assertions: [
      { assertion: 'A "Unique Visitors" or "Visitors" metric card is visible' },
      { assertion: 'A "Pageviews" metric card is visible' },
      { assertion: 'A "Bounce Rate" metric card is visible' },
    ],
    test,
    expect,
  });
});
```

### 2. What Happens Under the Hood

Each `runSteps()` call:

1. **Snapshots the DOM** — takes an accessibility tree snapshot (not a screenshot) to feed the AI context
2. **Sends each step to the LLM** — the AI produces browser tool calls (`browser_navigate`, `browser_click`, `browser_fill`, etc.) which Playwright executes
3. **Evaluates `waitUntil` conditions** — after each step, Passmark polls the DOM snapshot and asks the AI if the condition is met (up to 2 minutes)
4. **Runs assertions** — each assertion string is sent to the AI along with a fresh DOM snapshot; the AI returns `pass`/`fail` with a reason

### 3. Auth Helpers

Most tests require a logged-in user. The `helpers/auth.ts` module handles this:

```typescript
import { createTestSession, injectAuth } from '../../helpers/auth.js';

let _session: Awaited<ReturnType<typeof createTestSession>>;

test.beforeAll(async ({ request }) => {
  // Registers (or logs in) a test user via the REST API,
  // creates a site, and returns { token, userId, siteId, email, password }
  _session = await createTestSession(request, 'my-suite');
});

test.beforeEach(async ({ page }) => {
  // Injects JWT + siteId into localStorage via page.addInitScript,
  // so the app loads already authenticated on every navigation
  await injectAuth(page, _session);
});
```

`createTestSession` is idempotent — if the user already exists (409 from the API) it falls back to login. Safe to run multiple times.

### 4. Mixing AI and Raw Playwright

For interactions that the AI can't reliably handle (e.g. checking `input[type]` attributes that are invisible in the accessibility tree), you can drop into raw Playwright assertions inside the same test:

```typescript
// Raw Playwright for navigation and attribute checks
await page.goto('/login');
const input = page.locator('input[placeholder="Enter your password"]');
await expect(input).toHaveAttribute('type', 'password');

// Click toggle button by its aria-label
await page.getByRole('button', { name: 'Toggle theme' }).click();

// Back to AI for visual assertions
await runSteps({ page, userFlow: '...', steps: [], assertions: [...], test, expect });
```

---

## Setup

### Prerequisites

- Node.js 20+
- The InsightTrack API running on `http://localhost:3001`
- The InsightTrack dashboard running on `http://localhost:4173`
- An [OpenRouter](https://openrouter.ai) API key with credits

### Install

```bash
cd appsv2/passmark-tests
npm install
npx playwright install chromium
```

### Configure

Copy `.env.example` to `.env` and fill in:

```env
# Your OpenRouter API key — get one at https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-...

# Where the dashboard and API are running
PW_BASE_URL=http://localhost:4173
API_BASE_URL=http://localhost:3001

# Test account (auto-created on first run if it doesn't exist)
TEST_USER_EMAIL=passmark-tester@insighttrack.local
TEST_USER_PASSWORD=Passmark$ecure123
```

### Start the App

Before running tests you need both servers up:

```bash
# Terminal 1 — API
cd appsv2/analytics-api && npm start

# Terminal 2 — Dashboard
cd appsv2/dashboard-web && npm run dev
```

---

## Running Tests

```bash
# All 52 tests (~40-50 min with gpt-4.1-mini)
cd appsv2/passmark-tests && npm test

# One spec file
npx playwright test tests/auth/login.spec.ts --project chromium

# One specific test by line number
npx playwright test tests/auth/login.spec.ts:10 --project chromium

# Live output as each test runs
npx playwright test --project chromium --reporter=line

# Open the HTML report after a run
npm run test:report
```

---

## Model Configuration

Passmark routes all AI calls through [OpenRouter](https://openrouter.ai), configured in `appsv2/passmark-tests/playwright.config.ts`. You can tune which model handles which part of the pipeline:

```typescript
configure({
  ai: {
    gateway: 'openrouter',
    models: {
      stepExecution: 'openai/gpt-4.1-mini',   // executes browser tool calls
      userFlowLow:   'openai/gpt-4.1-mini',   // plans simple flows
      userFlowHigh:  'openai/gpt-4.1-mini',   // plans complex flows
      assertionPrimary:   'openai/gpt-4.1-mini',  // first assertion judge
      assertionSecondary: 'openai/gpt-4.1-mini',  // second opinion
      assertionArbiter:   'openai/gpt-4.1-mini',  // tiebreaker
      utility:       'openai/gpt-4.1-mini',   // DOM condition checks
    },
  },
});
```

**Recommended model strategy:**

| Budget | stepExecution | assertionPrimary | Cost per full run |
|--------|--------------|-----------------|-------------------|
| Cheap (current) | `openai/gpt-4.1-mini` | `openai/gpt-4.1-mini` | ~$0.30–0.60 |
| Balanced | `openai/gpt-4.1-mini` | `google/gemini-2.5-flash` | ~$0.80–1.50 |
| High quality | `openai/gpt-4.1` | `google/gemini-2.5-pro` | ~$3–8 |

Check your balance before a full run:
```bash
curl https://openrouter.ai/api/v1/auth/key -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

---

## The Best Parts

### No Selectors to Maintain

Traditional Playwright test:
```typescript
await page.locator('[data-testid="kpi-unique-visitors"]').waitFor();
```
If someone renames the component or removes the test ID — broken test.

Passmark equivalent:
```typescript
{ assertion: 'A "Unique Visitors" or "Visitors" metric card is visible' }
```
The app can be completely redesigned. As long as there's a visitors metric somewhere on the page, this passes.

### `waitUntil` in Plain English

Instead of `page.waitForSelector('.spinner:not(:visible)')`, you write:

```typescript
{
  description: 'Click the refresh button',
  waitUntil: 'The loading spinner disappears or the data reloads',
}
```

The AI reads the DOM every 2 seconds until it decides the condition is true.

### Self-Healing on Retry

When Playwright retries a failed test (`retries: 1` in config), Passmark automatically switches from cached step results to a full fresh AI run — so a flaky first attempt often heals itself on retry.

### Reads Like a QA Spec

Tests double as living documentation. A new engineer can read `tests/dashboard/realtime.spec.ts` and understand exactly what the Realtime page is supposed to do — without knowing any React, CSS, or HTML structure.

---

## Timeouts

AI calls are slow. The config sets:

| Setting | Value | Reason |
|---------|-------|--------|
| `timeout` | `180_000` | Global per-test ceiling (3 min) |
| `test.setTimeout` | `240_000` | Per-test override (4 min) |
| `actionTimeout` | `10_000` | Max time for a single browser action |
| `STEP_EXECUTION_TIMEOUT` | `180_000` | Max time for one Passmark step |
| `WAIT_CONDITION_TIMEOUT` | `120_000` | Max time for a `waitUntil` to resolve |
| `retries` | `1` | One automatic retry on failure |

With `retries: 1`, each test can consume up to `2 × 240s = 8 minutes` before permanently failing.

---

## Troubleshooting

**Tests fail immediately with "User not found" or 401**
→ Your `OPENROUTER_API_KEY` is wrong or expired. Check with:
```bash
curl https://openrouter.ai/api/v1/auth/key -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

**Tests time out at exactly 3.0m every time**
→ A `test.setTimeout(90_000)` is overriding the global config. With `retries: 1` that burns exactly `2 × 90s`. All timeouts in this suite are set to `240_000`.

**"Rate limited by Venice" error with a free model**
→ OpenRouter is routing to a `:free` suffix model that has been rate-limited. Make sure your `OPENROUTER_API_KEY` has credits and is not a free-tier key.

**`waitUntil` never resolves**
→ The condition string is too specific (exact text match) or relies on something invisible in the accessibility tree (e.g. CSS animations, `input[type]` attributes). Use more flexible wording or switch to raw Playwright for that check.

**API 409 on `createTestSession`**
→ Expected and handled — the helper falls back to login. Not an error.

---

## Related Docs

- [testing.md](testing.md) — general testing conventions for the project
- [running-locally.md](running-locally.md) — how to start the full stack locally
- [getting-started.md](getting-started.md) — project overview and first steps
