# Testing Guide

How to run, write, and debug tests in InsightTrack.

---

## Test Types
- **Unit tests:** For functions, hooks, and components (Jest/Vitest)
- **Integration tests:** For API endpoints and DB sync (Vitest)
- **E2E tests:** For dashboard UI (Playwright)

## Running Tests
- **Frontend:**
  ```bash
  cd apps/dashboard-web
  npm test
  # or
  npx playwright test
  ```
- **Backend/DB:**
  ```bash
  cd apps/analytics-api
  npm test
  ```

## Writing Tests
- Place unit tests in `__tests__` or next to the code
- Use descriptive test names
- Mock network and DB calls for unit tests
- Use Playwright for full UI flows

## Debugging
- Use `console.log` or Playwright's UI mode for E2E
- Check test coverage with `--coverage`

---

## See Also
- [api-reference.md](./api-reference.md)
- [frontend-structure.md](./frontend-structure.md)
