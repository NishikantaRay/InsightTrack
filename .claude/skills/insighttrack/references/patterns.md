# InsightTrack — Implementation Patterns & Utilities

Copy-paste-grade examples matching the real codebase. Paths use the `traffic`
layout (`analytics-db`, `analytics-dashboard`); translate for traffic2 per the
skill's layout table.

## 1. Backend: analytics read endpoint (DuckDB)

Query function — `analytics-db/src/queries/queries.js`:

```js
export async function getMyMetric(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);   // handles '7d' | 'custom:from:to'
    const rows = await duckAll(
        `SELECT path, COUNT(*) AS views, COUNT(DISTINCT user_id) AS visitors
         FROM events
         WHERE site_id = ? AND timestamp BETWEEN ? AND ? AND type = 'pageview'
         GROUP BY path
         ORDER BY views DESC
         LIMIT ?`,
        [siteId, start, end, 10],
    );
    // Normalize types for JSON (DuckDB returns BigInt for COUNT)
    return rows.map((r) => ({ ...r, views: Number(r.views), visitors: Number(r.visitors) }));
}
```

Rules: always `FROM events` / `FROM sessions` (the hot+cold union views,
never `events_hot` directly); always `?` placeholders; convert BigInt →
Number before returning; date columns via `toDateStr()`.

Route — `analytics-db/src/routes/analytics.js` (router already applies
`authMiddleware` + `validateSiteId` + `authorizeSiteAccess` at the top):

```js
// GET /api/analytics/:siteId/my-metric
router.get('/:siteId/my-metric', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('my-metric', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.GENERAL, () =>
            queries.getMyMetric(req.siteId, dateRange)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching my-metric:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});
```

Cache TTLs (`services/cache.js`): `REALTIME` 10 s, `KPI` 30 s, `TRAFFIC` 60 s,
`PAGES` 60 s, `GENERAL` 120 s — all overridable via `CACHE_TTL_*_MS` env vars.

## 2. Backend: write endpoint (PostgreSQL service)

Service — `analytics-db/src/services/<domain>Service.js`:

```js
import { query } from '../db/postgres.js';
import { v4 as uuidv4 } from 'uuid';

export async function createThing(userId, name) {
    if (!name?.trim()) {
        const err = new Error('name is required');   // matches SAFE_4XX_PATTERNS
        err.status = 400;
        throw err;
    }
    const id = `thing_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const result = await query(
        `INSERT INTO things (id, user_id, name, created_at)
         VALUES ($1, $2, $3, NOW()) RETURNING *`,
        [id, userId, name.trim()],
    );
    return result.rows[0];
}
```

Route:

```js
router.post('/', authMiddleware, async (req, res) => {
    try {
        const thing = await createThing(req.user.id, req.body.name);
        res.status(201).json({ success: true, data: thing });
    } catch (err) {
        res.status(err.status || 500).json({ success: false, error: safeMsg(err, err.status) });
    }
});
```

Conventions: services throw `Error` with `.status`; ID prefixes are
domain-specific (`site_`, `user_`, …); validation happens in the service;
role checks use `req.userRole` (set by `authorizeSiteAccess`) — e.g. mutating
team routes require `owner`/`admin`.

New PG table? Add idempotent DDL in `db/postgres.js#initializeDatabase`
(`CREATE TABLE IF NOT EXISTS` + `DO $$ … duplicate_column …` guards for new
columns + indexes). If analytics needs it, also add DuckDB DDL to
`schema/schema.js` and register it in `SYNCABLE_TABLES`.

## 3. Frontend: API map + hook + page

`analytics-dashboard/src/services/api.js` — add to the relevant export
(`analyticsAPI`, `sitesAPI`, `authAPI`, …):

```js
getMyMetric: (siteId, dateRange) =>
    api.get(`/analytics/${siteId}/my-metric`, { params: { dateRange } }),
```

The axios instance already: injects the Bearer token, unwraps
`response.data`, auto-logs-out on 401, strips stacks from errors.

Page/component:

```jsx
import { useAnalytics } from '../hooks/useAnalytics';
import ChartCard from '../components/ui/ChartCard';
import { formatNumber, CHART_COLORS } from '../utils/formatters';

export default function MyPage() {
    const { data, loading, error } = useAnalytics('getMyMetric');

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                My Page
            </h1>
            <ChartCard title="My Metric" loading={loading} error={error} empty={!data?.length}>
                {/* Recharts chart here, colors from CHART_COLORS */}
            </ChartCard>
        </div>
    );
}
```

Register the route in `App.jsx` (lazy import + `<Route>` inside the protected
layout) and add a Sidebar entry (`components/layout/Sidebar.jsx`, lucide-react
icon).

Dark mode: every color utility needs its `dark:` twin using theme tokens —
`bg-card dark:bg-card-dark`, `border-border dark:border-border-dark`,
`text-text-secondary dark:text-text-secondary-dark`. Never raw hex in JSX.

## 4. Frontend: Zustand store

```js
import { create } from 'zustand';

export const useMyStore = create((set) => ({
    value: localStorage.getItem('analytics-my-value') || null,
    setValue: (value) => {
        localStorage.setItem('analytics-my-value', value);
        set({ value });
    },
}));
```

Select narrowly in components: `useMyStore((s) => s.value)` — not the whole
store. localStorage keys are prefixed `analytics-`.

## 5. Shared UI primitives (use these, don't reinvent)

| Component | Purpose |
|-----------|---------|
| `ChartCard` | Card with title/subtitle, loading/error/empty states, CSV + auto-detected PNG export, `info` tooltip, `headerActions` slot |
| `MetricCard` | KPI tile (value, delta, icon) |
| `DataTable` | Sortable table with consistent styling |
| `EmptyState` / `LoadingSkeleton` | Empty & loading placeholders (`type="page"` for full page) |
| `InfoTooltip` | Metric explanation hover |
| `DateFilter` | Global date-range picker (writes `useDateFilterStore`) |
| `SiteSwitcher` / `SiteManager` | Site selection / CRUD |

Utilities: `formatNumber` (1.2K/3.4M), `formatDuration` (m s), `formatPercent`,
`formatDate`/`formatDateFull`, `CHART_COLORS`, `DATE_RANGES`
(`utils/formatters.js`); `exportToCSV`, `exportToJSON`, `exportChartToPNG`,
`printReport` (`utils/exportUtils.js`).

Backend utilities: `safeMsg`/`sendError` (`utils/safeError.js`),
`encrypt`/`decrypt` secret box (`utils/secretBox.js`), `analyticsCache`
(`services/cache.js`), `duckAll`/`duckRun`/`duckBulkInsert` (`db/duckdb.js`),
`query`/`getPool` (`db/postgres.js`).

## 6. Adding an AI Analyst / MCP tool

1. Add the endpoint to the OpenAPI spec
   (`src/mcp/openapi/insighttrack-spec.js`) — the tool registry
   (`src/mcp/tools/registry.js`) generates MCP tools from it via
   `mcp-toolkit-core`'s `mapOpenApiToTools`.
2. Make sure the underlying REST endpoint exists and is auth-scoped (tools run
   with the user's token — scoping is enforced server-side, not by the LLM).
3. The in-panel assistant (`routes/assistant.js`) and the external
   `mcp-server/` pick the tool up automatically from the shared registry.
4. Update `docs/ai-analyst.md` / `docs/mcp-toolkit.md`.

## 7. Tests

Backend (`analytics-db/tests/*.test.js`, Vitest + real PostgreSQL):

```js
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { setupTestDB, cleanTestDB, closeTestDB, insertTestSite, TEST_SITE_ID } from './testHelper.js';
import { sitesService } from '../src/services/sitesService.js';

describe('sitesService', () => {
    beforeAll(setupTestDB);
    beforeEach(cleanTestDB);
    afterAll(async () => { await cleanTestDB(); await closeTestDB(); });

    it('creates a site with generated id', async () => {
        const site = await sitesService.createSite('My Blog', 'myblog.com');
        expect(site.id).toMatch(/^site_/);
    });
});
```

Test data must use `site_test%` ids / `%@test.example.com` emails so
`cleanTestDB()` removes it. Route tests use supertest (see `tests/routes/`).
Backend tests hit the **real** PostgreSQL — do not mock the pool; backend
`vitest.config.js` runs files sequentially (`fileParallelism: false`, 30 s
timeouts) for DB isolation.

Frontend (`src/__tests__/*.test.jsx`, Vitest + Testing Library, jsdom with
`globals: true`, setup in `src/test/setup.js`): render, assert visible
behavior; mock `services/api` with `vi.mock`. E2E (`e2e/*.spec.ts`,
Playwright): real flows against the preview server
(`playwright.config.js` handles baseURL/webServer, retries).

What to test per layer: services → business logic, param handling, errors;
routes → status codes, auth, response envelope; components → rendering,
interaction, loading/empty/error props; stores → state transitions +
localStorage; e2e → critical flows only (login, dashboard load, CRUD).
Skip: framework internals, Tailwind class names, chart-library rendering.

## 8. Tracking script changes

The tracker lives in the demo sites and dashboard `public/` (e.g.
`public/tracker.js`). It must stay dependency-free, tiny, and send only to
`/api/track/*`. Update `docs/tracking-script.md` when its payload changes —
and remember the payload shape is mirrored in `trackingService.js`
validation, PG DDL, DuckDB schema, and `SYNCABLE_TABLES`.
