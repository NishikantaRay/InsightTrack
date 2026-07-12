# InsightTrack — Deep Architecture Reference

Companion to the `insighttrack` skill. Read this when a task touches the sync
engine, storage layers, auth/team model, AI Analyst, or deployment.

## 1. Request lifecycle

### Tracking (write path, public)

1. `tracker.js` (embedded on customer sites, served from the demo sites /
   dashboard `public/`) POSTs to `/api/track/event`.
2. `src/index.js` applies `publicCors` (any origin), helmet, and the shared
   rate limiter (skips `/api/health` and `pixel.gif`).
3. `routes/tracking.js` validates payload → `services/trackingService.js`
   resolves geo (via `geoipService`), UA parsing, session upsert.
4. All inserts go to **PostgreSQL** (`events`, `sessions` tables). DuckDB is
   never written here.

### Dashboard analytics (read path, authenticated)

1. React page → `useAnalytics('getTopPages')` → `services/api.js` axios call
   with `Authorization: Bearer <jwt>` (from `localStorage['analytics-token']`).
2. `privateCors` (origin allowlist from `CORS_ORIGINS`) → `authMiddleware`
   (verifies JWT, sets `req.user`) → `validateSiteId` (sets `req.siteId`) →
   `authorizeSiteAccess` (looks up `site_members`, sets `req.site` +
   `req.userRole` = `owner | admin | viewer`).
3. Route handler → `analyticsCache.getOrFetch(key, ttl, fn)` → on miss,
   `queries/queries.js` runs a parameterized DuckDB query against the
   `events` / `sessions` **views**.
4. Response envelope: `{ success: true, data }`. Errors: `{ success: false,
   error: safeMsg(err) }` — 4xx messages pass through if they match safe
   patterns; 5xx are masked outside development.
5. Frontend: axios response interceptor unwraps `response.data`; on 401 it
   clears localStorage and dispatches the `auth:logout` CustomEvent (App-level
   listener redirects to login).

## 2. Dual-database + sync engine (`src/sync/sync.js`)

- **PostgreSQL** = source of truth for everything. **DuckDB** = derived,
  rebuildable OLAP replica (10-100× faster on aggregation queries).
- Incremental sync runs on startup and every `SYNC_INTERVAL_MS` (60 s):
  1. Reads high-water mark per table from `_sync_meta` (DuckDB).
  2. Pulls PG rows `WHERE ts > last_synced` in `SYNC_BATCH_SIZE` (5 000)
     batches.
  3. Upserts into DuckDB as DELETE-existing + `duckBulkInsert` (multi-row
     INSERT, 1 000-row chunks — the fast path since duckdb@1.x has no
     Appender binding).
  4. Advances the high-water mark.
- `--full` / `{ fullSync: true }` truncates DuckDB tables and re-syncs.
  First run is effectively full (epoch mark). A module-level `_syncRunning`
  flag prevents concurrent syncs. Manual trigger: `POST /api/sync?full=true`.
- **daily_stats rollup** (`computeDailyRollups`): after each sync, one row per
  site×day (visitors, sessions, pageviews). Only recomputes days newer than
  the last rollup; "today" is always answered from raw events for live
  numbers. KPI/traffic queries use it for ranges > 1 day.
- Tables synced are declared in `src/schema/schema.js` (`SYNCABLE_TABLES`,
  `SCHEMA_SQL` = DuckDB DDL). Adding a synced table means: PG DDL in
  `db/postgres.js#initializeDatabase`, DuckDB DDL in `schema.js`, entry in
  `SYNCABLE_TABLES`.

## 3. Hot/cold storage (appsv2 has the fullest version)

- Hot: DuckDB managed tables `events_hot`, `sessions_hot` (recent days).
- Cold: Parquet partitions `data-lake/events/site_id=*/event_date=*/*.parquet`
  (and `sessions/…/session_date=*`).
- `queries.js#refreshAnalyticsViews()` creates views `events`/`sessions` that
  `UNION ALL` hot tables with `read_parquet(...)` when cold files exist, else
  alias the hot tables. **All query functions read the views** — they work
  unchanged whether or not cold storage exists.
- Optional S3/R2 (`src/storage/s3.js`): DuckDB `httpfs` extension; archive to
  object storage + unified views over remote Parquet. `s3Enabled()` gates
  everything (no-op without env config). Endpoints: `GET /api/storage/status`,
  `POST /api/storage/archive`.

## 4. Databases — connection layers

- `src/db/postgres.js`: single `pg.Pool` (`createPool`/`getPool`/`query`).
  `initializeDatabase()` is idempotent bootstrap-and-migrate: `CREATE TABLE IF
  NOT EXISTS` plus inline `DO $$ … EXCEPTION WHEN duplicate_column …` guards
  for added columns. There are no separate migration files — schema evolution
  happens here (plus `scripts/migrate.js`).
- `src/db/duckdb.js`: one `duckdb.Database` + small connection pool
  (`DUCKDB_POOL_SIZE`, default 4) so concurrent analytics queries don't
  serialize. API: `duckAll(sql, params)`, `duckRun`, `duckBulkInsert(table,
  columns, rows)`, `poolStats()`, `initDuckDB()` (also wires S3), `closeDuck()`.
  Only the API process opens the DuckDB file (single-writer lock) — external
  consumers (MCP server) must go through HTTP.

## 5. Auth & team model

- `authService`: bcryptjs (12 rounds), JWT signed with `JWT_SECRET`
  (7-day expiry), `verifyToken` used by `middleware/auth.js`.
- Multi-user sites: `site_members(site_id, user_id, role)`;
  `teamService.getMemberRole` powers `authorizeSiteAccess`. Roles:
  `owner` (full control), `admin` (manage), `viewer` (read). Invites are
  token links (`/api/invite/:token`, mounted from `routes/team.js`).
- `POST /api/demo/join` grants the logged-in user viewer access to the public
  demo site (used by the landing-page CTA).
- Public dashboard sharing: `SharedDashboard.jsx` + share-token endpoints in
  `routes/reporting.js`/`sites.js` (no auth, read-only, token-scoped).

## 6. AI Analyst & MCP toolkit (`src/mcp/`, `mcp-server/`, `mcp-toolkit-core/`)

One **shared tool registry** (`src/mcp/tools/registry.js`) powers both:

1. **In-dashboard AI Analyst** — `routes/assistant.js`: SSE streaming chat.
   `mcp/llm/provider.js` abstracts the LLM (server key or user BYO key; BYO
   keys stored AES-256-GCM-encrypted via `utils/secretBox.js`, managed in
   `services/aiSettings.js` + Settings UI). Frontend:
   `components/assistant/AssistantPanel.jsx`, `services/assistantStream.js`
   (SSE client), `store/useAssistantStore.js`.
2. **External MCP server** — `mcp-server/` (stdio transport for Claude
   Desktop/Cursor). It is a thin HTTP proxy: every tool call hits the running
   API with a connect token (`INSIGHTTRACK_API_URL` + `INSIGHTTRACK_TOKEN`
   from `POST /api/mcp/connect`). It never opens the database.

`mcp-toolkit-core/` is the extracted provider-agnostic engine: OpenAPI→MCP
tool mapping (`mapOpenApiToTools`) and Platform Connect request signing
(`signRequest`/`verifyRequest`/`ReplayGuard`). The backend's
`src/mcp/openapi/insighttrack-spec.js` declares the public OpenAPI 3.1 spec
(served at `/api/openapi.json`) from which tools are generated.

Docs: `docs/ai-analyst.md` (user guide), `docs/mcp-toolkit.md` (architecture
and build phases).

## 7. Frontend architecture

- **Routing** (`App.jsx`): all pages lazy-loaded. Wrappers: `ProtectedRoute`
  (auth required → else `/landing`), `GuestRoute` (redirects authed users,
  honors `?redirect=`), `SiteGate` (loads the user's sites, auto-selects the
  first, sends new users to `/onboarding`; trusts a cached
  `analytics-site-id` on transient API failure, retries with backoff on 429).
- **State** (Zustand, one store per concern): `useAuthStore` (token+profile,
  listens for `auth:logout`), `useSiteStore` (siteId + sites),
  `useDateFilterStore` (dateRange or custom range), `useThemeStore`
  (dark/light, `dark` class on `<html>`), `useAssistantStore`,
  `useFunnelStore`, `useFeatureStore`, `useFocusModeStore`. Stores persist
  to localStorage with `analytics-*` keys; no middleware libraries.
- **Data**: `useAnalytics(endpoint, { params, enabled })` — resolves the
  fetcher from `analyticsAPI[endpoint]`, re-fetches when site/date-filter
  change, 60 s polling, AbortController cancellation, returns
  `{ data, loading, error, refetch }`. `useRealtime` polls 15 s;
  `useRealtimeEventStream` 10 s.
- **Theme**: Tailwind `darkMode: 'class'`; custom tokens in
  `tailwind.config.js` — `accent`, `surface`, `card`, `bg`, `border`,
  `text-{primary,secondary,muted}` each with `-dark` twins, `chart.1–5`.
  A `.card` utility class exists in `index.css`. Charts use `CHART_COLORS`
  from `utils/formatters.js`.
- **SEO**: `useSeo.js` + `scripts/prerender.mjs` (`npm run build:seo`)
  prerender public pages (Landing, Blog from `data/blogPosts.js`, docs).

## 8. Deployment

- Docker multi-stage builds per package; dashboard served by nginx
  (`analytics-dashboard/nginx.conf`) which also proxies `/api` → backend.
- `docker-compose.yml` at repo root: postgres + backend + dashboard
  (+ demo sites in traffic). `docker-compose down -v` resets volumes.
- Env: see `.env.production.example` at repo root and `.env.example` in the
  backend. Key vars: `DATABASE_URL`/`PG_*`, `JWT_SECRET`, `ENCRYPTION_KEY`,
  `CORS_ORIGINS`, `DUCKDB_PATH`, `SYNC_INTERVAL_MS`, `RATE_LIMIT_*`,
  `CACHE_TTL_*`, `VITE_API_URL` (frontend), S3/R2 vars for cold storage.
- Production guard: startup warns loudly if `CORS_ORIGINS` is unset or
  localhost-only when `NODE_ENV=production`.
- `app.set('trust proxy', 1)` — required behind nginx for rate limiting.

## 9. Design decisions worth knowing (the "why")

- **PG+DuckDB instead of one DB**: OLTP inserts stay cheap and durable in PG;
  OLAP aggregations run 10-100× faster in DuckDB. DuckDB is treated as a
  disposable cache — losing it only costs a re-sync.
- **DELETE+INSERT upserts in sync**: DuckDB lacks a practical UPSERT for this
  workload; delete-then-bulk-insert with a high-water mark is simple and fast.
- **Coalesced cache** (`getOrFetch`): concurrent requests for the same key
  await one in-flight promise — prevents thundering herd on cache expiry.
- **MCP server as HTTP proxy**: keeps per-user site scoping enforced by the
  API and respects DuckDB's single-writer lock.
- **No ORM, no migration framework**: raw parameterized SQL + idempotent
  bootstrap keeps the self-hosted install path to `npm start`.
- **Legacy `analytics-server`**: the original PG-only backend, superseded by
  the unified backend; kept read-only for reference.
