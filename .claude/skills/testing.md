# Testing Skill — InsightTrack

You are a test engineer for InsightTrack. Write and maintain tests across unit, integration, and E2E layers.

## Test Architecture

```
                          ┌─────────────┐
                          │  Playwright  │  E2E: Full user flows
                          │  (Browser)   │  login → dashboard → data
                          └──────┬───────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              ┌─────┴─────┐           ┌───────┴───────┐
              │  Vitest    │           │   Vitest      │
              │  Frontend  │           │   Backend     │
              │ (jsdom)    │           │ (node)        │
              └────────────┘           └───────────────┘
              Component tests          Service/route tests
              Store tests              DB query tests
              Hook tests               Cache tests
              Util tests               Sync tests
```

## Running Tests

```bash
# All backend tests
cd apps/analytics-api && npm test

# All frontend tests
cd apps/dashboard-web && npm test

# Specific test file
cd apps/analytics-api && npx vitest run tests/trackingService.test.js
cd apps/dashboard-web && npx vitest run src/__tests__/MetricCard.test.jsx

# Watch mode (dev)
cd apps/dashboard-web && npx vitest --watch

# E2E tests
cd apps/dashboard-web && npx playwright test
cd apps/dashboard-web && npx playwright test e2e/login.spec.ts  # specific
cd apps/dashboard-web && npx playwright test --headed            # see browser

# Coverage
cd apps/analytics-api && npx vitest run --coverage
cd apps/dashboard-web && npx vitest run --coverage
```

## Test Configuration

### Backend (apps/analytics-api/vitest.config.js)
- Sequential execution (`fileParallelism: false`)
- 30s timeout for test + hooks
- No concurrent tests (DB state isolation)

### Frontend (apps/dashboard-web, via vite.config.js)
- Environment: `jsdom`
- Globals: `true` (no explicit imports for describe/it/expect)
- CSS excluded from tests
- Setup file: `src/test/setup.js` (Testing Library matchers)

### E2E (apps/dashboard-web/playwright.config.js)
- Browsers: Chromium, Firefox, WebKit
- Base URL: `http://localhost:4173`
- Timeout: 30s, Action timeout: 5s
- Retries: 2

## Test Conventions

### Backend Service Tests
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ServiceName', () => {
  let mockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      query: vi.fn(),
      all: vi.fn(),
    };
  });

  it('should describe the expected behavior', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: '1', name: 'Test' }] });
    const result = await service.method(mockDb, params);
    
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      expect.arrayContaining(['param1'])
    );
    expect(result).toEqual({ id: '1', name: 'Test' });
  });

  it('should handle errors gracefully', async () => {
    mockDb.query.mockRejectedValue(new Error('Connection failed'));
    await expect(service.method(mockDb, params)).rejects.toThrow('Connection failed');
  });
});
```

### Frontend Component Tests
```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

describe('ComponentName', () => {
  const defaultProps = {
    title: 'Test',
    value: '100',
    onClick: vi.fn(),
  };

  it('renders with provided props', () => {
    render(<Component {...defaultProps} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    render(<Component {...defaultProps} />);
    fireEvent.click(screen.getByRole('button'));
    expect(defaultProps.onClick).toHaveBeenCalledOnce();
  });

  it('shows loading state', () => {
    render(<Component {...defaultProps} loading={true} />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });
});
```

### Zustand Store Tests
```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../store/useAuthStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
    localStorage.clear();
  });

  it('should set auth state on login', () => {
    useAuthStore.getState().setAuth({ id: '1', email: 'a@b.com' }, 'jwt-token');
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('jwt-token');
  });

  it('should clear state on logout', () => {
    useAuthStore.getState().setAuth({ id: '1' }, 'token');
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
```

### E2E Tests (Playwright)
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Login or setup state
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should display expected content', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('[data-testid="metric-card"]')).toHaveCount(4);
  });

  test('should handle error states', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/analytics/**', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) })
    );
    await page.reload();
    await expect(page.locator('.error-message')).toBeVisible();
  });
});
```

## What to Test

| Layer | What to Test | What NOT to Test |
|-------|-------------|-----------------|
| Backend Services | Business logic, query params, error handling | Express framework, DuckDB internals |
| Routes | Status codes, auth middleware, response shape | Service implementation details |
| Components | Rendering, user interaction, prop variations | Tailwind class names, Recharts internals |
| Stores | State transitions, persistence, computed values | Zustand library behavior |
| E2E | Critical user flows (login, dashboard, CRUD) | Visual styling, animations |
| Utils | Pure function I/O, edge cases | Obvious one-liner functions |
