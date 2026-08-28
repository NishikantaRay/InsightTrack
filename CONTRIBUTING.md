# Contributing to InsightTrack

Thanks for your interest. This guide covers getting the project running,
testing a change, and submitting it.

Every command below was run against this repository before being documented.

---

## Requirements

| Tool | Version | Why |
|---|---|---|
| **Node.js** | **20+** | Both Dockerfiles and CI use Node 20; Vitest requires ≥20. Node 22 also works. |
| **npm** | 10+ | Ships with Node 20. |
| **Docker** | any recent | Needed for the quick start, and for the API test suite's throwaway database. |
| **PostgreSQL** | 15 | Only for manual setup — Docker provides it otherwise. |

There is no `.nvmrc`; set your Node version manually (`nvm use 20`).

## Repository layout

`apps/` is **canonical** — make your changes there.

| Path | What |
|---|---|
| `apps/analytics-api/` | Express API, PostgreSQL writes, DuckDB reads, sync worker (`:3001`) |
| `apps/dashboard-web/` | React + Vite dashboard (`:5173` dev, `:4173` preview) |
| `appsv2/` | A synchronised second copy — **not** a newer version. See [`appsv2/README.md`](appsv2/README.md). |
| `archive/` | Legacy service, reference only. Do not modify. |

Changes to shared code must be applied to **both** `apps/` and `appsv2/`.

---

## Quick start (Docker)

The fastest way to get a working stack:

```bash
cp .env.example .env
docker compose up --build
```

This starts PostgreSQL, the API (`:3001`), the dashboard (`:4173`), a demo site
(`:8080`), and pgAdmin (`:5050`). PostgreSQL and pgAdmin are bound to
`127.0.0.1` only.

Tear down, including volumes:

```bash
docker compose down -v
```

## Manual setup (no Docker)

Requires a running PostgreSQL.

```bash
# 1. Backend
cd apps/analytics-api
npm install
cp .env.example .env     # set PG_* and JWT_SECRET
npm run migrate          # create PostgreSQL tables
npm run seed             # sample data (optional)
npm run init             # create DuckDB tables
npm run sync             # sync PostgreSQL -> DuckDB
npm start                # -> http://localhost:3001

# 2. Dashboard, in a second terminal
cd apps/dashboard-web
npm install
cp .env.example .env      # sets VITE_API_URL=http://localhost:3001
npm run dev               # -> http://localhost:5173
```

[`docs/running-locally.md`](docs/running-locally.md) is the authoritative
walkthrough, including troubleshooting.

### Database setup

The two databases have different roles, and this is enforced by convention:

- **PostgreSQL** is the system of record — every write goes here.
- **DuckDB** serves every analytics read. Never write to it directly; the sync
  worker populates it from PostgreSQL.

| Command | Effect |
|---|---|
| `npm run migrate` | Create/update PostgreSQL tables |
| `npm run seed` | Generate sample data (creates `site_demo` and `site_blog`) |
| `npm run init` | Create DuckDB tables |
| `npm run sync` | Incremental PostgreSQL → DuckDB sync |
| `npm run sync:full` | Full re-sync |

Run from `apps/analytics-api`. Seeding is **not** restart-safe — re-running it
against a partially-seeded database can fail on a primary-key collision. Reset
with `docker compose down -v` if that happens.

---

## Running tests

```bash
cd apps/analytics-api && npm test     # 383 tests
cd apps/dashboard-web && npm test     #  55 tests
```

Both use Vitest. Use `npm run test:watch` while developing.

The API suite needs **no manual database setup** — it provisions a throwaway
`postgres:15-alpine` container on port 55433 and removes it afterwards, so it
never touches your own PostgreSQL. Docker must be running. To use an existing
database instead, set `TEST_PG_EXTERNAL=1` and point `PG_*` at it.

### End-to-end tests

117 Playwright tests across 5 files:

```bash
cd apps/dashboard-web
npx playwright install    # first run only
npm run test:e2e          # or test:e2e:headed to watch
```

These need the app already running — the Playwright config has no `webServer`,
and defaults to `http://localhost:5173`. Start `npm run dev` first, or set
`PW_BASE_URL`.

### Build

```bash
cd apps/dashboard-web && npm run build
```

## Lint and type checks

**There are none.** The project has no ESLint or Prettier configuration, neither
is installed as a dependency, and there is no lint script — so there is no lint
command to run. The main apps are plain JavaScript with no `tsconfig.json`, so
there are no type checks either.

Match the style of the surrounding code. CI runs tests and the build, not
linting.

---

## Code conventions

These are enforced by review; the first two are architectural invariants:

1. **Never interpolate strings into SQL.** Use parameterised queries — `$1` for
   PostgreSQL, `?` for DuckDB.
2. **Writes go to PostgreSQL; analytics reads come from DuckDB.** Never write to
   DuckDB directly, and don't query PostgreSQL for dashboard data.
3. **Every API route needs `authenticateToken`**, except tracking
   (`/api/track/*`) and `/api/auth/login` / `/api/auth/register`.
4. **ES modules only** — `import`/`export`, never `require()`.
5. **New UI must support dark mode** via Tailwind `dark:` variants.
6. **Fetch data with the `useAnalytics` hook** in React components, not raw
   `useEffect` + axios.
7. **Update `docs/`** when you change a feature that has a doc file there.

---

## Submitting issues

Search existing issues first. A useful report includes:

- what you expected and what happened instead
- steps to reproduce
- whether you used Docker or manual setup
- Node version (`node -v`) and OS
- relevant logs — `docker compose logs backend` for the API

For **security vulnerabilities, do not open an issue.** Follow
[SECURITY.md](SECURITY.md), which uses private reporting.

## Submitting pull requests

1. Fork, then branch from `main`: `git checkout -b feature/your-change`
2. Make the change in `apps/`, and mirror it into `appsv2/`
3. Add or update tests
4. Run the suites for whatever you touched, plus the dashboard build if you
   changed frontend code
5. Update `docs/` if you changed documented behaviour
6. Open a PR describing what changed and why, and how you verified it

CI runs the API tests, the dashboard tests and build, and a Docker Compose smoke
test that boots the stack and checks an event survives the PostgreSQL → DuckDB
sync. All three must pass.

Keep PRs focused — one concern per PR is easier to review than several bundled
together.

---

## See also

- [docs/testing.md](docs/testing.md) — testing conventions
- [docs/index.md](docs/index.md) — documentation index
- [SECURITY.md](SECURITY.md) — vulnerability reporting
