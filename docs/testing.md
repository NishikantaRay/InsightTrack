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

  The DB-backed suites need PostgreSQL. `npm test` provisions one
  automatically: a throwaway `postgres:15-alpine` container (the same image as
  `docker-compose.yml`) is started on port `55433` before the run and removed
  afterwards, so **no manual database setup is required** and your own
  PostgreSQL is never touched.

  Requires Docker to be running. Without it, the DB-backed suites fail unless
  you point `PG_*` at a database yourself.

  | Variable | Purpose |
  |---|---|
  | `TEST_PG_PORT` | Host port for the test container (default `55433`) |
  | `TEST_PG_EXTERNAL=1` | Skip the container and use the existing `PG_*` settings |

  To run against your own database instead:

  ```bash
  TEST_PG_EXTERNAL=1 PG_HOST=localhost PG_PORT=5432 \
    PG_USER=analytics PG_PASSWORD=analytics123 PG_DATABASE=analytics_db \
    npm test
  ```

  Note that `tests/testHelper.js` cleans up by pattern (`site_test%`,
  `%.test.example.com`), so pointing the suite at a database with real data can
  delete matching rows. The default containerised path avoids this entirely.

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
