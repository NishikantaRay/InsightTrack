---
name: insighttrack
description: >-
  Project skill for InsightTrack, a self-hosted web analytics platform
  (PostgreSQL writes + DuckDB reads, React/Vite dashboard, Express API,
  MCP/AI Analyst). Use whenever working in this repository — adding features,
  fixing bugs, reviewing code, writing tests, or answering questions about the
  architecture. Encodes the repo layout map (traffic / traffic2/apps /
  traffic2/appsv2), critical invariants, coding patterns, and workflows.
---

# InsightTrack Project Skill

InsightTrack is a self-hosted, privacy-friendly web analytics platform (a
Plausible/GA alternative). One Express backend ingests tracking events and
serves analytics; a React SPA renders the dashboard; an AI Analyst (LLM +
MCP tool layer) answers questions about the data in natural language.

## 1. The three synced copies (READ THIS FIRST)

The same product lives in **three places**, and they must be kept
**byte-identical** (modulo package names/paths) after every feature:

| Copy | Frontend | Backend | Extras |
|------|----------|---------|--------|
| `traffic/` (repo root) | `analytics-dashboard/` | `analytics-db/` | legacy `analytics-server/` kept for reference |
| `traffic2/apps/` | `dashboard-web/` | `analytics-api/` | — |
| `traffic2/appsv2/` | `dashboard-web/` | `analytics-api/` | `data-lake/` Parquet cold storage, `routes/sync.js`, `passmark-tests/` |

Path translation when porting a change:

```
traffic/analytics-dashboard/…  ⇄  traffic2/{apps,appsv2}/dashboard-web/…
traffic/analytics-db/…         ⇄  traffic2/{apps,appsv2}/analytics-api/…
traffic/mcp-server/…           ⇄  traffic2/{apps,appsv2}/mcp-server/…
traffic/mcp-toolkit-core/…     ⇄  traffic2/{apps,appsv2}/mcp-toolkit-core/…
traffic/docs/…                 ⇄  traffic2/docs/…
```

After finishing a change in one copy, port it to the other two (`diff -rq`
between the `src/` trees to verify). `traffic/analytics-server/` is the
**legacy** backend (archived as `archive/analytics-api-legacy` in traffic2) —
do not add features there.

## 2. Golden rules (invariants — never break these)

1. **No SQL string interpolation, ever.** Parameterized queries only:
   `$1, $2…` for PostgreSQL, `?` for DuckDB.
2. **Writes → PostgreSQL only.** Tracking events, auth, sites, goals, team,
   settings. Never INSERT/UPDATE/DELETE directly in DuckDB (the sync engine
   owns DuckDB contents).
3. **Analytics reads → DuckDB only** (via `src/queries/queries.js`). Dashboard
   data never comes from PG.
4. **Every API route requires `authMiddleware`** except `/api/track/*`,
   `/api/auth/login`, `/api/auth/register`, `/api/health`, `/api/openapi.json`,
   and public share/invite endpoints. Site-scoped routes additionally chain
   `validateSiteId` + `authorizeSiteAccess` (checks `site_members` role).
5. **ES modules only** (`"type": "module"` everywhere). No `require()`.
6. **All UI supports dark mode** via Tailwind `dark:` variants and the custom
   theme tokens (`bg-card dark:bg-card-dark`, `text-text-primary
   dark:text-text-primary-dark`, …).
7. **Data fetching in React goes through `useAnalytics(endpoint)`** (or
   `useRealtime`), not raw `useEffect` + axios.
8. **Never leak internals in errors.** Use `safeMsg`/`sendError` from
   `src/utils/safeError.js`; response envelope is
   `{ success: true, data }` / `{ success: false, error }`.
9. **Update `docs/` after completing any feature** (and create a doc for
   significant new features).
10. **Port every change to all three copies** (section 1).

## 3. Architecture in one page

```
tracker.js on customer site
        │  POST /api/track/event  (public CORS, rate-limited)
        ▼
Express backend (port 3001)  src/index.js
        │  trackingService → INSERT INTO PostgreSQL (events, sessions)
        ▼
PostgreSQL 16 ──(sync engine, every 60 s + on startup)──▶ DuckDB
   writes         src/sync/sync.js: incremental high-water    reads
                  mark in _sync_meta, duckBulkInsert 1000-row
                  chunks, daily_stats rollups, optional S3/R2
                  Parquet cold storage + union views
        ▲                                            │
        │ auth/sites/goals/team (services/*)         │ queries/queries.js
        │                                            ▼
React dashboard (port 4173) ── axios services/api.js ── /api/analytics/:siteId/*
   Zustand stores · useAnalytics hook (60 s refresh) · Recharts · Tailwind

AI Analyst: /api/assistant (SSE streaming) + /api/mcp (connect tokens)
   └─ shared tool registry (src/mcp/tools/registry.js) — same tools power the
      in-dashboard panel and the external MCP server (mcp-server/, stdio proxy
      that calls the HTTP API; it never touches the DB directly)
```

Key facts:
- **Hot/cold data**: DuckDB tables `events_hot`/`sessions_hot` hold recent
  days; older data lives in Parquet partitions under `data-lake/`. Views
  `events` and `sessions` UNION both — query code always uses the views.
- **daily_stats rollup**: one row per site per day, recomputed after each
  sync; KPI queries use it for ranges > 1 day, raw events for today.
- **Caching**: `analyticsCache.getOrFetch(key, ttl, fn)` — coalesced
  (thundering-herd-proof) in-memory cache; TTLs in `CACHE_TTL`.
- **Auth**: JWT (Bearer), bcryptjs; multi-user sites via `site_members` with
  roles `owner | admin | viewer` (`req.userRole` after `authorizeSiteAccess`).
- **Secrets at rest** (BYO AI keys): `src/utils/secretBox.js` (AES-256-GCM,
  key derived from `ENCRYPTION_KEY` or `JWT_SECRET`).
- **CORS is two-tier**: `publicCors` for `/api/track`, `privateCors`
  (env `CORS_ORIGINS` allowlist) for everything else.
- **Date ranges**: strings like `'24h' | '7d' | '30d' | '90d'` or
  `'custom:YYYY-MM-DD:YYYY-MM-DD'`, parsed by `getDateRange()` in queries.js.

Deep dive: read [references/architecture.md](references/architecture.md).

## 4. Where things live

Backend (`analytics-db/` or `apps*/analytics-api/`):

```
src/index.js        Express app: CORS, helmet, rate limit, route mounts, sync loop
src/db/             postgres.js (pool + idempotent schema/migrations), duckdb.js (conn pool, duckAll/duckRun/duckBulkInsert)
src/routes/         One router per domain: analytics, sites, tracking, auth, goals, reporting, sqlEditor, team, mcp, assistant
src/services/       PG-backed business logic (sitesService, teamService, trackingService, authService, …)
src/queries/        queries.js — ALL DuckDB analytics SQL lives here
src/schema/         schema.js — DuckDB DDL (SCHEMA_SQL) + SYNCABLE_TABLES
src/sync/           sync.js — PG→DuckDB incremental sync + rollups
src/storage/        s3.js — S3/R2 Parquet cold storage (httpfs)
src/mcp/            AI toolkit: tools/registry.js, llm/provider.js, openapi/mapper.js, connect/signing.js
src/middleware/     auth.js (authMiddleware)
src/utils/          safeError.js, secretBox.js
tests/              Vitest + testHelper.js (real PG, site_test% cleanup)
```

Frontend (`analytics-dashboard/` or `apps*/dashboard-web/`):

```
src/App.jsx             Lazy routes + ProtectedRoute/GuestRoute/SiteGate
src/pages/              One PascalCase component per route (Dashboard, Audience, SqlEditor, …)
src/components/ui/      Shared primitives: ChartCard, MetricCard, DataTable, EmptyState, LoadingSkeleton, InfoTooltip
src/components/charts/  Recharts wrappers (TrafficChart, SourcesChart, …)
src/components/layout/  DashboardLayout, Sidebar, Navbar
src/components/assistant/  AI Analyst panel
src/hooks/              useAnalytics.js (data fetching), useSeo.js
src/store/              Zustand: useAuthStore, useSiteStore, useDateFilterStore, useThemeStore, useAssistantStore, …
src/services/           api.js (axios instance + endpoint maps), assistantStream.js (SSE), aiSettings.js
src/utils/              formatters.js (formatNumber/Duration/Percent/Date, CHART_COLORS, DATE_RANGES), exportUtils.js (CSV/JSON/PNG)
src/__tests__/          Vitest + Testing Library unit tests
e2e/                    Playwright specs (*.spec.ts)
```

Naming: camelCase functions/variables, PascalCase components,
`use<Thing>Store` for Zustand stores, `use<Thing>` for hooks, kebab-case
URLs/API paths, `<domain>Service.js`, localStorage keys prefixed `analytics-`.

## 5. Canonical patterns (copy these shapes)

New analytics endpoint (read path) — three edits:

```js
// 1. src/queries/queries.js — parameterized DuckDB query
export async function getMyMetric(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    return duckAll(
        `SELECT path, COUNT(*) AS views FROM events
         WHERE site_id = ? AND timestamp BETWEEN ? AND ?
         GROUP BY path ORDER BY views DESC`,
        [siteId, start, end],
    );
}

// 2. src/routes/analytics.js — route with cache + envelope
router.get('/:siteId/my-metric', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('my-metric', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.GENERAL, () =>
            queries.getMyMetric(req.siteId, dateRange));
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching my-metric:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// 3. dashboard src/services/api.js — endpoint map entry
getMyMetric: (siteId, dateRange) =>
    api.get(`/analytics/${siteId}/my-metric`, { params: { dateRange } }),
```

Consuming it in a page:

```jsx
const { data, loading, error } = useAnalytics('getMyMetric');
return (
    <ChartCard title="My Metric" loading={loading} error={error} empty={!data?.length}>
        {/* Recharts chart using CHART_COLORS */}
    </ChartCard>
);
```

Write path (PG): route → `<domain>Service.js` → `query('… $1 …', [v])`.
Services return plain objects and throw `Error` with `.status`; routes catch
and respond. Never put SQL in route files.

More full examples (stores, tracking, team roles, MCP tools, tests):
[references/patterns.md](references/patterns.md).

## 6. Commands

Run from the package directory (`analytics-dashboard`/`analytics-db` in
traffic; `apps/dashboard-web`/`apps/analytics-api` in traffic2):

```bash
npm run dev            # frontend: Vite dev server | backend: node --watch
npm start              # backend: production start (runs sync loop)
npm test               # Vitest (both packages)
npx playwright test    # frontend e2e
npm run migrate && npm run seed && npm run init   # backend: PG schema, sample data, DuckDB init
npm run sync -- --full # full PG→DuckDB re-sync
docker-compose up --build    # full stack from repo root
```

Backend tests need PostgreSQL running (they use the real `analytics_db` and
clean up `site_test%` rows via `tests/testHelper.js`).

## 7. Verify against code, not prose (how to not get misled)

Docs and checklists in this repo have drifted before (e.g. references to an
`authenticateToken` middleware that is actually `authMiddleware`, or a
`getCached/setCached` cache API that is actually `analyticsCache.getOrFetch`).
When this skill, a doc, and the code disagree — **the code wins**. Before
building on any claimed name or pattern, ground yourself:

```bash
# The five files that define the backend's truth
src/index.js  src/middleware/auth.js  src/services/cache.js  src/db/duckdb.js  src/schema/schema.js

# The four files that define the frontend's truth
src/App.jsx  src/services/api.js  src/hooks/useAnalytics.js  tailwind.config.js

# Confirm a symbol actually exists before using it
grep -rn "authMiddleware\|getOrFetch" src/ --include='*.js' -l

# Confirm copy drift before and after any change
diff -rq traffic/analytics-db/src traffic2/apps/analytics-api/src
```

Copy an existing neighbor (the route above yours, the store next to yours)
rather than writing from memory — every layer has a canonical local example.
If you find drift between this skill and the code, fix the skill in the same
change.

## 8. Things to avoid

- Adding npm dependencies for anything achievable with the existing stack.
- Querying PG for dashboard analytics, or DuckDB for writes.
- Raw `useEffect` + axios data fetching in components.
- Hard-coded hex colors in JSX — use Tailwind theme tokens / `CHART_COLORS`.
- Echoing request URLs, stack traces, paths, or env names in API errors.
- Editing `dist/`, `node_modules/`, `duckdb/*.duckdb`, or `data-lake/` files.
- Touching the legacy `analytics-server/` (traffic) / `archive/` (traffic2).
- Skipping the three-copy sync or the `docs/` update after a feature.

## 9. Workflows & further reading

- Feature development, testing, debugging, and the three-copy sync procedure:
  [references/workflows.md](references/workflows.md)
- Deep architecture (request lifecycle, sync engine, hot/cold storage, AI
  Analyst/MCP): [references/architecture.md](references/architecture.md)
- Full code examples per layer + utilities catalog:
  [references/patterns.md](references/patterns.md)
- Code review, PR review, and security audit (threat model, checklists,
  report formats): [references/review-security.md](references/review-security.md)
- Product/feature docs: `docs/` — index at `docs/index.md` (e.g.
  `sql-editor.md`, `custom-dashboards.md`, `reporting-studio.md`,
  `ai-analyst.md`, `mcp-toolkit.md`, `pg-duckdb-sync.md`, `security.md`,
  `testing.md`)
