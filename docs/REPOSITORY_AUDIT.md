# InsightsTrack — Repository Audit for Research Publication

**Audit date:** 2026-08-28
**Repository:** `InsightTrack` (public-facing). The author's private working repo is out of scope — see §0.
**Commit audited:** `a70ca0a` (2026-08-09) — "Add Sentry integration (polling, webhooks, UI)"
**Branch:** `main` (clean working tree at audit start)
**Purpose:** Establish an evidence-based baseline for (a) a technical research paper, (b) a Zenodo deposit, and (c) a JOSS submission.

## How to read this document

Every substantive claim carries one of three markers:

| Marker | Meaning |
|---|---|
| **VERIFIED** | Directly confirmed by reading code, configuration, or by executing a command during this audit. The evidence is cited. |
| **INFERRED** | A reasonable reading of the evidence, but not directly confirmed. Could be wrong. |
| **NEEDS VERIFICATION** | Cannot be established from the repository as it stands. Requires running the system, measuring, or a decision by the author. |

No claim in this document is a guess. Where evidence was absent, that absence is recorded as a finding rather than filled in.

**Scope note:** this audit is read-only. No application code, configuration, or documentation was modified.

---

## 0. Repository topology (read this first)

**Scope of this audit: the public-facing `InsightTrack` repository only.**

The author maintains a separate private working repository (`traffic/`) for their own use. It is explicitly **out of scope**: it is not published, not deposited, and not part of any paper or JOSS artifact. It is not assessed anywhere in this document, and no finding depends on it.

**VERIFIED** — The public repository contains **no reference to the private repo** in any shipped file. A grep across all Markdown, JSON, and YAML found the private repo named in exactly one place: `CLAUDE.md` rule 9, which is a developer instruction file, not product code or user documentation. Nothing in the published artifact leaks or depends on it.

### 0.1 Two copies inside the public repository

**VERIFIED** — The public repo ships the product **twice**:

| Copy | Backend | Frontend | Compose file |
|---|---|---|---|
| `apps/` | `analytics-api` | `dashboard-web` | `docker-compose.yml` |
| `appsv2/` | `analytics-api` | `dashboard-web` | `docker-compose.v2.yml` |

Both are buildable and both are wired to their own Docker Compose stack (`docker-compose.v2.yml` builds `./appsv2/analytics-api` and `./appsv2/dashboard-web`).

**VERIFIED** — `CLAUDE.md` rule 9 requires the copies to be kept byte-identical after every feature. **They are not.** Measured this audit with `diff -rq apps appsv2`:

```
Files apps/analytics-api/.gitignore  and appsv2/analytics-api/.gitignore  differ
Files apps/analytics-api/Dockerfile  and appsv2/analytics-api/Dockerfile  differ
Only in appsv2/analytics-api/scripts: seed-hotcold.js
Only in appsv2/analytics-api/src/routes: sync.js
Only in apps/mcp-server:       package-lock.json
Only in apps/mcp-toolkit-core: package-lock.json
Only in appsv2: passmark-tests
… plus ~20 screenshots that differ, and 3 present only in apps/
```

So the divergence is **not** cosmetic. It spans:
- **Application code** — `appsv2` has a `routes/sync.js` that `apps` lacks.
- **Build configuration** — the two backend Dockerfiles differ.
- **Tooling** — a `passmark-tests` Playwright suite exists only in `appsv2`.
- **Dependency locking** — `mcp-server` and `mcp-toolkit-core` have `package-lock.json` only under `apps/`.

**INFERRED** — `appsv2` appears to be the newer line: it carries the hot/cold seed script (`seed-hotcold.js`) and the extra sync route, which matches the hot/cold storage work described in `docs/hot-cold-analytics-architecture.md`. This is a reading of the evidence, not a confirmed fact.

**NEEDS VERIFICATION** — Which copy the author considers canonical, and which one the published benchmarks (§14) and screenshots were produced against. This is a decision only the author can make, and it materially affects the paper: §5.5 flags an unresolved schema question in the hot/cold path, and the relevant seed script exists in only one of the two copies.

**Research-integrity implication (INFERRED):** shipping the same product twice, with real code and build differences and no stated canonicity, is a liability for a Zenodo deposit and a JOSS review. A reviewer cannot determine what to review, and a citing reader cannot determine what was measured. Resolving this is cheap — pick one, archive or delete the other, say so in the README — and it removes an otherwise avoidable objection. See P0-2.

### 0.2 Other top-level packages

**VERIFIED** — `apps/mcp-server` (stdio MCP bridge, 179 LOC), `apps/mcp-toolkit-core` (OpenAPI→MCP mapping engine), `archive/analytics-api-legacy`, `examples/demo-{site,website,blog}`, `marketing/landing-page`, `docs/` (37 files), `scripts/`, `screenshots/` (40 images).

## 1. Current architecture

### 1.1 Stack

**VERIFIED** from `apps/analytics-api/package.json` and `apps/dashboard-web/package.json`:

| Layer | Technology | Version (declared) |
|---|---|---|
| Frontend | React + Vite | 18.3.1 / 5.2.13 |
| State | Zustand | 4.5.2 |
| Charts | Recharts | 2.12.7 |
| Styling | Tailwind CSS | 3.4.4 |
| SQL editor UI | CodeMirror (`@uiw/react-codemirror`) | 4.25.10 |
| Maps | Leaflet + react-simple-maps | 1.9.4 / 3.0.0 |
| Backend | Express | 4.18.2 |
| Write DB driver | `pg` | 8.18.0 |
| Read DB | `duckdb` (embedded, Node binding) | 1.1.3 |
| Auth | `jsonwebtoken` + `bcryptjs` | 9.0.3 / 3.0.3 |
| Security middleware | `helmet`, `express-rate-limit`, `cors` | 8.1.0 / 8.2.1 / 2.8.5 |
| GeoIP | `geoip-lite` | 1.4.7 |
| Test runner | Vitest (both tiers) | 4.0.18 |
| E2E | Playwright | 1.40.0 |

**VERIFIED** — Both packages declare `"type": "module"`; the ES-modules-only invariant in `CLAUDE.md` holds in the code read.

### 1.2 ORM: there is none

**VERIFIED** — The audit brief asked about Prisma. **Prisma is not used anywhere in this repository.** Searches returned zero results for:
- any `schema.prisma` file (`find . -iname 'schema.prisma'` → empty)
- any `prisma` directory
- the string `prisma` in any `package.json` (→ empty)
- the string `prisma` anywhere under `apps/`, `appsv2/`, or `docs/` (→ empty)

Database access is **raw SQL via the `pg` driver** (PostgreSQL) and the **`duckdb` Node binding** (DuckDB). Schema management is imperative, not declarative — see §3.4.

**Paper implication:** any draft describing an ORM layer must be corrected. The absence of an ORM is itself a defensible design choice worth stating explicitly (it is what makes the dual-engine dialect split tractable), but it must be described accurately.

### 1.3 Process model

**VERIFIED** from `apps/analytics-api/src/index.js`:

A single Node process hosts the HTTP API, the embedded DuckDB instance, the PG→DuckDB sync loop, and the integration poll loop. On boot (`start()`, lines ~196-250):

1. `createPool()` — PostgreSQL pool.
2. `initializeDatabase()` — creates/migrates all PG tables (idempotent DDL).
3. `initDuckDB()` — opens DuckDB, wires S3/R2 httpfs when configured.
4. `runSync({silent:false})` — an initial full PG→DuckDB sync. Failure is caught and logged as a warning; **the server still starts and serves potentially stale analytics** (line ~213).
5. `setInterval(runSync, SYNC_INTERVAL_MS)` — default 60 s.
6. `setInterval(pollAllProviders, SENTRY_POLL_INTERVAL_MS)` — default 300 s.

**VERIFIED** — Graceful shutdown on SIGINT/SIGTERM closes DuckDB and the PG pool (`shutdown()`).

**INFERRED** — This is a single-node, single-process design. Horizontal scaling would require each replica to maintain its own DuckDB copy and run its own sync loop, which would multiply PG read load and produce per-replica divergence in `daily_stats`. The in-memory cache (§5.4), the assistant rate limiter, and the MCP `ReplayGuard` are all per-process and would not be shared across replicas. `docs/performance-architecture.md` acknowledges "Multiple instances + Redis" for the 500M+ tier, but no such implementation exists in the code.

**NEEDS VERIFICATION** — Whether the system has ever been run multi-replica, and what the observed behaviour was.

---

## 2. Data flow

### 2.1 Collection path (browser → PostgreSQL)

**VERIFIED** — The tracking script is **generated server-side per site**, not shipped as a static file. Route `GET /api/sites/:siteId/script` (`apps/analytics-api/src/routes/sites.js:110`) calls `sitesService.getRawTrackingScript(siteId, serverUrl)` and returns it as `application/javascript` with `Cache-Control: public, max-age=3600`.

**VERIFIED** — Demo sites embed it as: `<script src="http://localhost:3001/api/sites/site_230afff7/script"></script>` (`examples/demo-website/index.html:11`).

**VERIFIED** — Script behaviour, read from `getRawTrackingScript` in `apps/analytics-api/src/services/sitesService.js`:

- **Visitor ID**: `localStorage['_analytics_uid']`, generated as `'u_' + Math.random().toString(36).substr(2,9)`. Persistent across sessions and tabs.
- **Session ID**: `sessionStorage['_analytics_sid']`, same generator with an `s_` prefix.
- **Device/browser/OS**: derived from `navigator.userAgent` via regex.
- **Country**: derived **client-side** from `Intl.DateTimeFormat().resolvedOptions().timeZone` against a large hardcoded IANA-timezone→country map (~250 entries), with a fallback to `navigator.language` region via `Intl.Locale`, then a raw locale-tag suffix. Returns `'Unknown'` on failure.
- **Transport**: `fetch(..., {keepalive:true})`, or `navigator.sendBeacon` for the session-end event.
- **Endpoints used**: `POST /api/track/session`, `POST /api/track/event`, `POST /api/track/session/end`.

**VERIFIED** — Server-side ingestion (`apps/analytics-api/src/routes/tracking.js`):
- `enrichGeo()` fills `country`/`city` from `geoipService.getLocationFromRequest(req)` **only when the client did not supply them**.
- `trackingService.trackEvent()` performs a parameterized `INSERT` into PG `events`.
- `scheduleSyncDebounced(siteId)` schedules a sync (§4.3).

**VERIFIED** — Endpoints: `/event`, `/pageview`, `/session`, `/session/end`, `/batch`, `GET /pixel.gif` (1×1 GIF fallback), and a catch-all `POST /`.

**VERIFIED** — Validation in `trackingService.trackEvent()`: `siteId` and `userId` are required (throws otherwise); `type` is checked against a 20-entry `ALLOWED_TYPES` allowlist and coerced to `'custom'` if unknown; every string field is length-clamped by `safeStr()` (e.g. `url` 2048, `path` 512, `siteId` 64).

**VERIFIED — Security finding:** the tracking endpoints perform **no authentication and no site-ownership validation**. `/api/track` is mounted with `publicCors` (any origin) and is not behind `authMiddleware` — which is by design per `CLAUDE.md` rule 4. However, `trackEvent` never checks that `siteId` refers to an existing site. Any party who knows or guesses a `siteId` can inject arbitrary events into that site's dataset. See P1-3.

### 2.2 Read path (dashboard → DuckDB)

**VERIFIED** — Chain: React page → `useAnalytics(endpoint)` hook (`apps/dashboard-web/src/hooks/useAnalytics.js`) → `analyticsAPI[endpoint]` (axios) → `GET /api/analytics/:siteId/*` → `authMiddleware` → `validateSiteId` → `authorizeSiteAccess` → `analyticsCache.getOrFetch(...)` → `queries.*` → `duckAll()` → DuckDB.

**VERIFIED** — `useAnalytics` polls on a **60-second `setInterval`** and aborts in-flight requests via `AbortController` on dependency change. `dateRange` is read from a Zustand store and serialized as `custom:START:END` for custom ranges.

**VERIFIED** — PostgreSQL is never queried for dashboard analytics; `routes/analytics.js` imports only `queries/queries.js` (DuckDB). The `CLAUDE.md` read/write split invariant holds. PG *is* queried directly for non-analytics concerns (auth, saved SQL queries, audit log, assistant threads), which is consistent with the stated design.

### 2.3 End-to-end latency

**INFERRED** — Worst-case visibility lag for a new event = sync debounce (5 s default) + sync duration + cache TTL (10–120 s depending on metric). A realtime widget with a 10 s TTL therefore reflects data up to roughly 15 s + sync time old.

**NEEDS VERIFICATION** — Actual measured end-to-end lag. No instrumentation records it.

---

## 3. Database architecture

### 3.1 The dual-engine split

**VERIFIED** — PostgreSQL is the system of record for all writes; DuckDB is a derived read replica for analytics. Confirmed by `src/db/postgres.js`, `src/db/duckdb.js`, and the import graph of `routes/analytics.js`.

### 3.2 PostgreSQL schema

**VERIFIED** — All DDL lives in `initializeDatabase()` in `src/db/postgres.js` (~500 lines of imperative `CREATE TABLE IF NOT EXISTS` plus `DO $$ ... EXCEPTION WHEN duplicate_column` migration blocks). Tables created:

`sites`, `events`, `sessions`, `funnels`, `daily_stats`, `users`, `goals`, `ab_tests`, `annotations`, `report_schedules`, `custom_dashboards`, `data_retention_policies`, `site_integrations`, `sentry_issues`, `sentry_stats`, `utm_links`, `sql_saved_queries`, `sql_query_audits`, `site_members`, `site_invitations`, `site_custom_roles`, `assistant_threads`, `assistant_messages`, `assistant_memory`, `assistant_settings`, `assistant_usage`, `mcp_connect_tokens`.

**VERIFIED** — 27 tables. `events` carries 7 indexes including the composite `idx_events_site_ts (site_id, timestamp)`; `sessions` carries 3.

**VERIFIED** — Referential integrity is **partial**. `site_members`, `site_invitations`, `site_custom_roles`, `site_integrations`, and the `assistant_*` tables use real `REFERENCES ... ON DELETE CASCADE`. But the highest-volume tables — `events`, `sessions`, `daily_stats`, `goals`, `annotations`, `sentry_issues`, `sentry_stats` — carry `site_id VARCHAR(64) NOT NULL` with **no foreign key** to `sites(id)`. Deleting a site therefore orphans its event data.

**VERIFIED** — Type inconsistency in the identity model: `users.id` is `SERIAL` (integer) and `site_members.user_id` is `INTEGER`, but `sites.user_id` is `VARCHAR(64)`. The backfill query in `initializeDatabase()` works around this with a regex guard (`WHERE s.user_id ~ '^[0-9]+$'`) and a `::INTEGER` cast inside a CTE, with an in-code comment explaining that older rows may hold UUIDs and would raise error 22P02. This is a real, acknowledged schema-design defect. See P1-5.

### 3.3 DuckDB schema

**VERIFIED** — Declared as a single `SCHEMA_SQL` template string in `src/schema/schema.js`. Mirrors 15 of the PG tables with DuckDB-native types (`VARCHAR` instead of `VARCHAR(n)`, `DOUBLE` instead of `NUMERIC`, JSONB columns flattened to `VARCHAR` holding serialized JSON).

**VERIFIED** — Plus a control table `_sync_meta (table_name PK, last_synced TIMESTAMP, last_id BIGINT, rows_synced BIGINT, updated_at)`.

**VERIFIED** — Five ART indexes are declared: `idx_events_site_ts`, `idx_events_type_site`, `idx_events_path_site`, `idx_sessions_site_ts`, `idx_daily_stats_site_date`. The in-file comment claims these give "5-20× additional speedup on selective (single-site) queries."

**NEEDS VERIFICATION** — That 5-20× figure has no accompanying measurement artifact in the repository. It is a code comment, not a benchmark result. See §14 and P0-4.

### 3.4 Schema management

**VERIFIED** — There are **no versioned migration files**. `apps/analytics-api/scripts/migrate.js` exists and is wired into the Dockerfile `CMD`, but schema evolution is implemented as idempotent `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS` + `DROP CONSTRAINT IF EXISTS` executed on **every boot**.

**Consequences (INFERRED):**
- No schema version is recorded anywhere, so there is no way to state "this deposit corresponds to schema version N" — a problem for a Zenodo artifact.
- No rollback path.
- Migration blocks accumulate permanently (the `sentry_issues` block alone re-runs three `ADD COLUMN` guards on every start).
- Boot time grows with schema history.

### 3.5 Connection management

**VERIFIED** — PG: `pg.Pool`, `max` default 10, configurable via `PG_POOL_MAX`.

**VERIFIED** — DuckDB: a **hand-rolled connection pool** in `src/db/duckdb.js` — `POOL_SIZE` default 4 (`DUCKDB_POOL_SIZE`), with an array of idle connections and a FIFO waiter queue (`acquireConn`/`releaseConn`). All queries go through `duckRun`/`duckAll`, which acquire and release around the callback.

**VERIFIED — Correctness concern:** `duckRun` and `duckAll` are constructed as `new Promise(async (resolve, reject) => { ... })`. If `acquireConn()` were ever to reject, the rejection would be swallowed rather than propagating — the async-executor anti-pattern. In the current code `acquireConn` returns a promise that only ever resolves, so this is **latent rather than live**. It is worth noting in a paper's threats-to-validity section but is not a live bug.

**VERIFIED** — `duckBulkInsert()` collapses N row inserts into multi-row `INSERT ... VALUES (...),(...)` statements, chunked at 1000 rows. The in-code comment claims "~50-100× faster than the per-row INSERT/DELETE loop." **NEEDS VERIFICATION** — again a comment, not a measurement.

---

## 4. PostgreSQL → DuckDB synchronization

This is the most novel component in the system and the strongest candidate for a paper contribution. It is also where the sharpest correctness questions live.

### 4.1 Design

**VERIFIED** from `src/sync/sync.js` (388 lines). Two strategies, selected per table by config in `src/schema/schema.js`:

**(a) Keyset / append-only** — used when `appendOnly: true` **and** an `idColumn` is present. Currently only `events`.
- Cursor: `_sync_meta.last_id` (BIGINT).
- Query: `SELECT ... WHERE id > $1 ORDER BY id ASC LIMIT $2`.
- Write: `duckBulkInsert()` — pure append, no delete.
- **Watermark is persisted after every batch**, making a crash mid-table resumable without duplicates.

**(b) Timestamp watermark / mutable** — all other tables.
- Cursor: `_sync_meta.last_synced` (TIMESTAMP).
- Query: `SELECT ... WHERE ts_col > $1 ORDER BY ts_col ASC LIMIT $2 OFFSET $3`.
- Write: per-row `DELETE FROM t WHERE id = ?` then `INSERT` (upsert emulation).
- Watermark persisted **once, after the whole table completes**.

**VERIFIED** — `SYNCABLE_TABLES` covers 13 tables. `daily_stats` is **deliberately excluded**, with an explicit code comment: syncing it from PG as well would create two competing writers (PG upsert-by-id vs. the DuckDB rollup's delete-by-date + insert) and double-count metrics. This is a well-reasoned, well-documented design decision and good paper material.

**VERIFIED** — Column discovery is dynamic: `getColumns()` reads `information_schema.columns` from PG at sync time, so DuckDB inherits PG's column set without a hardcoded mapping.

**VERIFIED** — Concurrency control is a **process-local boolean mutex** (`let _syncRunning`). A second concurrent call returns 0 immediately.

**VERIFIED** — Per-table errors are caught and logged; the loop continues to the next table. A single failing table does not abort the sync.

### 4.2 Correctness analysis

**VERIFIED — Weakness 1 (lost updates on mutable tables).** The timestamp-watermark path advances the high-water mark to `MAX(ts_column)` of the last synced batch. Any row whose `ts_column` is not bumped on update will never re-sync. For `sites` the watermark column is `created_at` — which by definition never changes on update. A renamed site therefore propagates to DuckDB **only by luck** (if it happens to fall in a later batch window) or **never**. The same applies to `funnels`, `goals`, `ab_tests`, `annotations`, `custom_dashboards`, and `report_schedules`, all of which use `created_at` as `tsColumn`. Only `sentry_issues` and `sentry_stats` correctly use `updated_at`.

This is a genuine soundness gap in the sync protocol and must not be described in a paper as "eventually consistent" without this caveat. See P0-3.

**VERIFIED — Weakness 2 (no deletion propagation).** No table's sync path detects rows deleted in PG. `runRetentionCleanup()` (§9.3) issues `DELETE FROM events` against **PostgreSQL only**. Those rows remain in DuckDB indefinitely. Since every dashboard read goes to DuckDB, **executing a retention policy does not actually remove the data from what users see.** This directly undermines the GDPR/retention claims in `docs/security.md`. See P0-1.

**VERIFIED — Weakness 3 (OFFSET drift).** The mutable path paginates with `LIMIT/OFFSET` over a live table ordered by timestamp. Rows inserted concurrently shift the offset window and can cause skips. The code comments acknowledge exactly this and cite it as the motivation for the keyset path — but the keyset path is only applied to `events`.

**VERIFIED — Weakness 4 (non-atomic upsert).** The mutable path performs `DELETE` then `INSERT` as two separate statements with no surrounding transaction. A crash between them loses the row from DuckDB until a later sync happens to re-fetch it — which, given Weakness 1, may be never.

**VERIFIED — Weakness 5 (single-writer assumption).** The mutex is process-local. Two API replicas against one PG and their own DuckDB files would each sync independently — tolerable, since each owns its own DuckDB. But `runSync` is also exposed via `POST /api/sync` (any authenticated user) and via the debounced tracking path, so within one process there are three trigger sources coordinating only through that boolean.

### 4.3 Sync triggering

**VERIFIED** — Three independent triggers:
1. **Boot** — one full sync in `start()`.
2. **Periodic** — `setInterval` at `SYNC_INTERVAL_MS` (default 60 s).
3. **Debounced-on-write** — `scheduleSyncDebounced()` in `routes/tracking.js`; the first event after a quiet window schedules a sync `SYNC_DEBOUNCE_MS` (default 5 s) later; events inside the window are no-ops.
4. **Manual** — `POST /api/sync?full=true`, requiring only `authMiddleware` (**any authenticated user**, no role check). Triggering a full sync truncates and rebuilds every DuckDB table — an expensive operation available to the lowest-privileged account. See P1-4.

**VERIFIED** — Cache invalidation is correctly ordered: `invalidateSiteCache()` runs **only after** the sync resolves. On failure the pending site IDs are re-queued and a retry is scheduled, so a failed sync does not flush the cache into staleness. This is careful engineering and worth citing.

### 4.4 Daily rollup

**VERIFIED** — `computeDailyRollups()` runs after every sync. It finds `MAX(date)` already in `daily_stats`, then recomputes from the following day up to **but not including today** (today is always read live from raw events). Implemented as `DELETE` over the date range then a single `INSERT ... SELECT ... GROUP BY site_id, CAST(timestamp AS DATE)`.

**VERIFIED — Data-quality finding:** the rollup writes literal `0 AS bounces` and `0.0 AS avg_duration`. Those two columns of `daily_stats` are **always zero**, despite being real columns that a SQL Editor user or a `daily_stats`-reading query could consume. `getTrafficOverTime()` reads `visitors, sessions, pageviews` only, so the dashboard is unaffected — but the table is a documented, user-queryable surface. See P1-6.

**VERIFIED — Correctness finding:** late-arriving events are not handled. Because the recompute window starts at `MAX(date)+1`, an event that arrives with a timestamp older than the last rollup date is counted in raw-event queries but never folded into `daily_stats`. Since `getTrafficOverTime` prefers `daily_stats` for any range not including today, historical numbers can silently diverge from the raw data. This is a **measurable, publishable consistency property** — see §16.

---

## 5. Analytics query architecture

### 5.1 Surface

**VERIFIED** — 52 `GET` routes in `routes/analytics.js` (779 LOC), backed by `queries/queries.js` (2357 LOC). Route families: traffic, pageviews, top-pages, sources, devices, countries/cities/geo-map, sessions, KPI, funnels, realtime, UTM, comparison, user-flow, alerts, engagement (scroll depth, heatmap, rage clicks, time-on-page), goals, A/B tests, audience (new-vs-returning, cohorts, segments), revenue, content (entry/exit/site-search), acquisition (campaigns, social, keywords), performance (Web Vitals, JS errors), Sentry, annotations.

### 5.2 SQL injection posture

This was audited specifically, since `CLAUDE.md` rule 1 forbids interpolation.

**VERIFIED** — 24 occurrences of `${` inside `queries.js`. Each was individually inspected and classified:

| Category | Sites | Verdict |
|---|---|---|
| Parquet glob paths in `CREATE VIEW` (lines 66, 90) | 2 | **Safe** — derived from `__dirname`, never from request input. |
| Structural clause assembly — `${where}`, `${filterSql}`, `${dateFilter}`, `${selectParts.join()}` (lines 797, 1772-1785, 2308) | ~8 | **Safe** — these interpolate *clause skeletons built from `?` placeholders*; every user value is bound as a parameter. Verified by reading `getVisitorSegments` and `getUTMLinkStats` in full. |
| Non-SQL string building (line 1116, alert message) | 1 | **Safe** — not SQL. |
| `INTERVAL '${days} days'` (lines 1139, 1154, 1175, 1194, 1210) | 5 | **Safe in practice — dead code.** See below. |

**VERIFIED** — The five `INTERVAL '${days} days'` sites in `getDailyActiveUsers`, `getHourlyTraffic`, `getSessionBuckets`, `getBounceRateByPage`, `getUserRetention` interpolate a JavaScript value directly into SQL. However, a reachability check (`grep` for each function name across `routes/`, `mcp/`, `scripts/`) returned **zero call sites**. These five functions are **unreferenced dead code** and are not reachable from any HTTP route or MCP tool.

**Conclusion: no exploitable SQL injection was found in the analytics read path.** But the pattern is present in the codebase and would become live the moment anyone wired a route to those functions. For a paper making a security claim, and for a JOSS reviewer running a linter, these should be removed or parameterized. See P1-1.

**VERIFIED** — The write path (`trackingService`, `authService`, `sitesService`, `sqlEditor` persistence) uses `$n` placeholders throughout. No interpolation found.

### 5.3 Date-range handling

**VERIFIED** — `getDateRange(range)` accepts `today`/`1d`, `7d`, `30d`, `90d`, `custom:YYYY-MM-DD:YYYY-MM-DD`, defaulting to `30d`. Custom dates go through `new Date()` with `isNaN` validation and are returned as ISO strings, then **bound as parameters**. Unrecognized input silently falls back to 30d rather than erroring.

### 5.4 Caching

**VERIFIED** — `src/services/cache.js`: an in-process `Map` with TTL plus **request coalescing**. `getOrFetch(key, ttl, fn)` returns a cached value; if a fetch for the same key is already in flight it returns that same promise rather than issuing a duplicate DuckDB query. An `inFlight` map is cleaned on both resolve and reject. A `setInterval` sweeps expired entries every 5 minutes.

**VERIFIED** — TTLs: realtime 10 s, KPI 30 s, traffic 60 s, pages 60 s, general 120 s — all env-overridable.

**VERIFIED** — The MCP/AI tool registry deliberately reuses **the same cache keys and TTLs** as the REST routes (`const cached = (key, ttl, fn) => analyticsCache.getOrFetch(...)`, with a comment stating the intent), so a question the dashboard already answered is a cache hit for the assistant. This cross-surface cache sharing is a genuinely interesting design detail and good paper material.

**VERIFIED — Limitation:** the cache is unbounded in entry count (no LRU/max-size); only TTL expiry and the 5-minute sweep reclaim memory. With many sites × many metrics × many date ranges, peak memory is unbounded between sweeps.

### 5.5 Hot/cold storage

**VERIFIED** — `refreshAnalyticsViews()` in `queries.js` creates DuckDB `VIEW`s named `events` and `sessions`. When Parquet partitions exist under `data-lake/events/site_id=*/event_date=*/*.parquet`, the view is `SELECT ... FROM events_hot UNION ALL SELECT ... FROM read_parquet(glob)`; otherwise it aliases `events_hot` alone. All 52 query functions read `FROM events` / `FROM sessions` and are therefore agnostic to which tier serves the data.

**VERIFIED** — `src/storage/s3.js` (257 LOC) provides `s3Enabled()`, `initS3()`, `archiveAllToS3()`, `refreshUnifiedViews()`. Archiving runs inside `runSync` only when S3 env vars are set, and archive failures are explicitly non-fatal.

**Schema mismatch worth noting (VERIFIED):** the view definitions select an `event_uuid` column and a `sessions.updated_at` column. Neither appears in `SCHEMA_SQL`'s `events`/`sessions` definitions nor in the PG DDL. **INFERRED** — the hot/cold path likely requires a different table definition (`events_hot` vs. `events`) that is created elsewhere, or this path is currently non-functional. **NEEDS VERIFICATION** — whether the hot/cold path has been exercised end-to-end at this commit. This matters because `docs/hot-cold-analytics-architecture.md` publishes a benchmark table for it (§14).

---

## 6. Pulse (AI analyst) architecture

**VERIFIED** — `src/routes/assistant.js` (519 LOC) + `src/mcp/llm/provider.js` (315 LOC) + `src/mcp/tools/registry.js` (515 LOC).

### 6.1 Loop

**VERIFIED** — `POST /api/assistant/chat` streams **Server-Sent Events** with event types `text` (token deltas), `tool` (a tool ran; carries the render envelope), `done`, `error`. The agent loop: call LLM with tools attached → if tool calls are requested, execute them via the registry scoped to the caller's site → feed results back → repeat. Capped at `MAX_TOOL_ROUNDS = 5`.

### 6.2 Providers

**VERIFIED** — Three providers, no SDK dependency — raw `fetch` against HTTP APIs (Node 20+):
- Anthropic (`/v1/messages`), native adapter.
- OpenAI (`/v1/chat/completions`).
- Google Gemini — reuses the **OpenAI adapter verbatim** against Gemini's OpenAI-compatible endpoint.

**VERIFIED** — Defaults (env-overridable): `claude-sonnet-5`, `gpt-4o-mini`, `gemini-2.5-flash`. All three stream; a hand-rolled `sseEvents()` async generator parses the SSE bodies. `MAX_TOKENS` default 1500.

**VERIFIED** — Key precedence: request-supplied key → user's stored BYO key → server env key.

### 6.3 Tools

**VERIFIED** — 19 tools in the registry: `get_kpi`, `get_traffic`, `get_top_pages`, `get_sources`, `get_devices`, `get_countries`, `get_funnel`, `get_realtime`, `get_acquisition_utm`, `get_engagement`, `compare_ranges`, `list_sites`, `get_goals`, `get_user_flow`, `get_js_errors`, `get_performance`, `get_page_detail`, `get_error_summary`, `get_error_issues`.

**VERIFIED** — Every tool returns a **result envelope**: `{summary, data, render:{type,chart,columns}, download:{csv,filename}, deepLink:{label,to}}`. The envelope drives dashboard rendering (chart/table/KPI card, CSV download, one-click deep link to the matching page).

**VERIFIED** — Tools are read-only and site-scoped. `ctx = {siteId, userId}`; tools flagged `siteless` (e.g. `list_sites`) operate on `userId`. Authorization is enforced by the caller via `getMemberRole(siteId, req.user.id)` before `runTool` — verified in all three call paths (`/assistant/chat`, `/api/mcp/run`, `handleMcpMessage`).

### 6.4 Cost and context controls

**VERIFIED** — Several distinct fences, which together are a real contribution:
- **Per-user sliding-window rate limit**, stricter on the server's key (10/min) than on a BYO key (30/min) — `assistantRateLimited()`.
- **`capToolData()`** caps tool output at `MAX_ROWS` (100) and `MAX_DATA_CHARS` (20 000), halving row counts until the payload fits, and appends a note so the model knows it received a sample.
- **Asymmetric rendering**: the **full** envelope goes to the browser; only the **capped** copy (`envelopeForModel`) goes to the LLM. The user sees complete data; the context window sees a bounded sample. This split is a genuinely good idea and is publishable.
- **`MAX_TOOL_ROUNDS = 5`** bounds the agent loop.
- **`assistant_usage` table** meters tokens in/out, provider, model, latency, tool-call count, rounds, and whether the user's own key paid.

### 6.5 Secret handling

**VERIFIED** — `src/utils/secretBox.js`: AES-256-GCM via `node:crypto`, key derived with `scryptSync` from `ENCRYPTION_KEY` or (fallback) `JWT_SECRET`, static salt `'insighttrack.secretbox.v1'`, per-secret random 12-byte IV, output `iv.tag.ciphertext` base64url. `decrypt()` returns `null` on any failure (wrong key, tampering, rotation) and the app treats that as "no key on file."

**VERIFIED — Cryptographic assessment:** AES-256-GCM with a random per-secret IV and an authentication tag is correct. Two properties to disclose in a paper rather than defend:
1. **Static salt** — deliberate (deterministic derivation), documented in-code, and acceptable given unique IVs. But it means identical secrets under the same master key are *not* linkable only because of the IV — the design relies entirely on IV uniqueness.
2. **`JWT_SECRET` fallback** — couples secret-encryption to token-signing. Rotating `JWT_SECRET` to invalidate sessions silently destroys every stored BYO API key and Sentry token. This is documented in-code as intentional, but it is a coupling a reviewer will flag.

---

## 7. MCP architecture

This is the most standards-conformant part of the system.

**VERIFIED** — Three surfaces share **one** tool registry:

1. **In-dashboard assistant** — `/api/assistant/chat`.
2. **Remote Streamable HTTP** — `POST /api/mcp/http` (`src/mcp/protocol.js`, 148 LOC).
3. **stdio bridge** — `apps/mcp-server` (179 LOC), published as `@insighttrack/mcp-server` with bin `insighttrack-mcp`, dependency `@modelcontextprotocol/sdk ^1.0.0`.

**VERIFIED** — Protocol version `2025-06-18`; server info `{name:'insighttrack', version:'0.1.0'}`. Methods implemented: `initialize`, `tools/list`, `tools/call`, `ping`, plus `notifications/initialized` and `notifications/cancelled` (correctly returning no response for notifications). JSON-RPC error codes are standard (-32700/-32600/-32601/-32602/-32603). Batch arrays are supported. `GET /api/mcp/http` returns 405 with a JSON-RPC envelope, since the server does not push server-initiated events.

**VERIFIED** — `buildToolList(userId)` dynamically injects a `siteId` property into each site-scoped tool's input schema, **enumerating the user's actual sites** (`enum: [...siteIds]`) and defaulting to the first. When the user has no default site, `siteId` is added to `required`. This is a nice piece of per-user schema specialization.

**VERIFIED** — `renderEnvelope()` returns both `content` (text + fenced JSON — the universal fallback) and `structuredContent` (machine-readable), both size-capped. Tool-level failures are returned as `isError: true` content rather than transport errors, so the model can read and adapt. This is correct MCP practice.

**VERIFIED** — **Connect tokens**: long-lived JWTs with `scope:'mcp'` and a `jti`, default 365 d. The `mcp_connect_tokens` table stores **only the `jti`** (never the token). Router-level middleware checks `revoked_at` on every request for `scope:'mcp'` tokens and best-effort stamps `last_used_at` without blocking. Regular dashboard JWTs pass through. **This revocation design is correct and worth describing.**

**VERIFIED** — `src/mcp/connect/signing.js`: HMAC-SHA256 over a fixed canonical payload `token\ntimestamp\nnonce`, verified with `timingSafeEqual`, a ±300 s freshness window rejecting **both** stale and future timestamps, and a nonce `ReplayGuard` with TTL eviction. Cryptographically sound.

**VERIFIED** — The toolkit demo endpoints (`/tools`, `/sign`, `/verify`) that accept caller-supplied OpenAPI specs are **off by default**, gated behind `MCP_TOOLKIT_DEMOS=1`, and 404 when disabled — with an in-code comment explaining that the in-memory `ReplayGuard` is not fleet-safe. Correctly handled.

**VERIFIED** — `apps/mcp-toolkit-core` is a separate provider-agnostic package (OpenAPI→MCP mapping + Connect signing) with its own Vitest setup. `InMemoryKeyStore` is explicitly documented as a stand-in for a Vault-backed store with an identical interface.

---

## 8. Security

### 8.1 What is correct

**VERIFIED** — Genuine strengths, each confirmed in code:

- **Password hashing**: bcrypt, cost factor **12** (`authService.register`).
- **Split CORS**: `publicCors` (any origin) on `/api/track` and `/api/integrations` only; `privateCors` (allowlist from `CORS_ORIGINS`) on every authenticated route. A production guard warns loudly at boot if `CORS_ORIGINS` is unset or localhost-only.
- **Helmet** with `crossOriginResourcePolicy: cross-origin`.
- **Rate limiting**: `express-rate-limit`, 1000 req/min default, skipping `/api/health` and the tracking pixel.
- **`trust proxy: 1`** set for correct client IPs behind nginx/Docker.
- **Error hygiene**: `src/utils/safeError.js` returns a generic message for 5xx in non-development, passing 4xx through only when it matches an explicit safe-pattern allowlist. Stack traces, PG error codes, and file paths are never forwarded. The 404 handler deliberately does **not** echo the requested URL (prevents reflected path disclosure).
- **JWT secret is mandatory**: `authService.js` throws at import time if `JWT_SECRET` is unset (with a `test`-env fallback only).
- **Webhook ordering**: `/api/integrations` is mounted **before** `express.json()` so the raw body is available for HMAC signature verification — a subtle detail done correctly.
- **MCP token revocation** — §7.
- **Encrypted secrets at rest** — §6.5.

### 8.2 SQL Editor threat model

**VERIFIED** — `src/routes/sqlEditor.js`, defence in depth:

1. Length cap 20 000 chars.
2. Comments stripped (`--` and `/* */`) *before* validation, so keywords cannot hide in comments.
3. Must start with `SELECT`/`WITH`/`EXPLAIN`.
4. Single-statement only — any `;` after stripping a trailing one is rejected.
5. A 20-keyword denylist regex blocks `INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|PRAGMA|ATTACH|DETACH|COPY|EXPORT|IMPORT|LOAD|INSTALL|CHECKPOINT|VACUUM|CALL|EXECUTE|GRANT|REVOKE` anywhere in the query.
6. Site ownership verified before execution.
7. `{{site_id}}` is substituted from the **ownership-verified DB record**, not raw input.
8. `LIMIT 1000` appended when absent.
9. Timeout (default 15 s) via `Promise.race`.
10. Every execution is audit-logged to `sql_query_audits` (query text, duration, row count, status, error) — on both success and failure paths.

This is a well-constructed sandbox and the audit trail is a real strength.

**VERIFIED — Residual risks that must be disclosed in a paper, not claimed away:**

- **Denylist, not allowlist.** `ATTACH` and `LOAD` are blocked by keyword, but DuckDB's surface is large and evolving. A future DuckDB function that reads the filesystem (the `read_*` family) or performs network I/O and does not match one of the 20 keywords would pass. Notably `read_parquet`, `read_csv`, and `read_json` are **not** in the denylist — and the hot/cold architecture depends on `read_parquet` being available. **NEEDS VERIFICATION** — whether `SELECT * FROM read_csv('/etc/passwd')` is blocked at this commit. This is the single most important security test to run before publication. See P0-5.
- **Cross-tenant reads.** The `{{site_id}}` substitution is a *convenience*, not an enforcement boundary. Nothing compels a user's query to filter by `site_id`. An authenticated user who owns *any* site can run `SELECT * FROM events` and read **every tenant's data** in the DuckDB file. For a single-tenant self-hosted deployment this is arguably acceptable; for the multi-tenant demo instance it is a real isolation failure. See P0-6.
- **`variables` are interpolated as SQL literals.** `applyTemplateVariables` + `toSqlLiteral` build literals with `'` doubling. That escaping is correct for standard SQL strings, but it is hand-rolled interpolation reaching DuckDB — precisely the pattern `CLAUDE.md` rule 1 forbids. Numeric-looking strings bypass quoting entirely (`Number(value)` path).
- **Raw DuckDB error messages** are returned to the client with `res.status(400).json({error: rawMessage})`, bypassing `safeMsg`. Error text can disclose schema details (column names, table names, types).

### 8.3 Authorization model inconsistency

**VERIFIED — This is a significant finding.** Two different authorization models coexist:

| Surface | Check | Location |
|---|---|---|
| `/api/analytics/*` | `getMemberRole(siteId, userId)` → `site_members` table | `routes/analytics.js:30` |
| `/api/assistant/chat` | `getMemberRole(...)` | `routes/assistant.js` |
| `/api/mcp/run`, `/api/mcp/http` | `getMemberRole(...)` | `routes/mcp.js`, `mcp/protocol.js` |
| **`/api/sql-editor/*`** | **`String(site.user_id) === String(req.user.id)`** — direct owner comparison | `routes/sqlEditor.js:requireSiteAccess` |

The SQL Editor **ignores `site_members` entirely**. A site admin or viewer legitimately invited to a site is denied SQL Editor access, and the multi-user model is bypassed. Given §3.2's `sites.user_id VARCHAR` vs `users.id INTEGER` type mismatch, this string comparison is also fragile. See P1-2.

### 8.4 Dependency vulnerabilities

**VERIFIED** — `npm audit` executed during this audit, after `npm ci`:

| Package | Critical | High | Moderate | Low | **Total** |
|---|---|---|---|---|---|
| `apps/analytics-api` | **2** | **12** | 6 | 2 | **22** |
| `apps/dashboard-web` | **1** | **9** | 5 | 1 | **16** |

**3 critical and 21 high-severity advisories across the two packages.** For a JOSS submission and a Zenodo deposit that will be cited, this is a P0. Specific advisories were not enumerated in this pass; `npm audit` output should be captured as an artifact.

### 8.5 Other findings

**VERIFIED** — Three committed scripts hardcoded a personal account. `scripts/benchmark.js` held them as constants; `scripts/load-test-data.js` held the same values as `||` fallback defaults behind env vars; `scripts/generate-report-pdf.js` embedded the email/password pair into the **generated PDF report** and its footer.

**RESOLVED (2026-08-28)** — All three were migrated to required environment variables with fail-fast validation, and `docs/benchmarking.md` was added. No credential literal remains in any tracked file.

**Author statement (NOT INDEPENDENTLY VERIFIED):** the password was a dummy used only for a local Docker stack. On that basis rotation and a git-history rewrite were judged unnecessary and are **not** recommended. The credential does remain in history (commits `bcd29d3`, `a813c78`); this is accepted risk, not an oversight.

**NEEDS VERIFICATION** — that this account is not also valid on the **public demo instance**. The repo ships a live-demo CTA and a `POST /api/demo/join` endpoint (§1), so a hosted deployment exists. If the same credentials authenticate there, §8.2's SQL Editor cross-tenant read (`SELECT * FROM events` with no `site_id` filter) becomes remotely reachable by anyone reading the git history. This is a five-minute check and the only reason the finding is not fully closed.

**Independent of the credential question**, the hardcoding made all three scripts unrunnable by anyone else — a reproducibility defect that stands on its own. See §14.1 and P0-4.

**VERIFIED** — `POST /api/sync` requires only `authMiddleware` — no role check. Any authenticated user can trigger `?full=true`, truncating and rebuilding all DuckDB tables.

**VERIFIED** — `docker-compose.yml` exposes PostgreSQL on host port `5432` and pgAdmin on `5050` by default. Convenient for development, unsafe as a production default.

**VERIFIED** — `helmet({contentSecurityPolicy: false})` — CSP is explicitly disabled.

**VERIFIED** — In production, PG SSL is configured as `{rejectUnauthorized: false}` (`db/postgres.js`), which accepts any certificate and does not protect against an active MITM on the DB connection.

---

## 9. Privacy

This section carries the audit's most serious finding, because privacy is the project's headline claim.

### 9.1 What is genuinely true

**VERIFIED**:
- **No cookies.** The tracking script uses `localStorage` and `sessionStorage` only. No `document.cookie` anywhere in the script.
- **No IP persistence.** `events` and `sessions` have no IP column. `geoipService` resolves an IP to country/city in memory and the IP is discarded. This claim holds.
- **No third-party transmission.** The script posts only to the origin that served it.
- **Self-hosted.** All data stays in the operator's PG + DuckDB.
- **No fingerprinting.** No canvas, WebGL, font enumeration, or audio fingerprinting. Identity is a random ID in `localStorage`.

### 9.2 Documented-but-not-implemented: DNT and GPC

**VERIFIED — CRITICAL.** The project claims, in at least four public places, that it honors Do Not Track and Global Privacy Control:

- `README.md:30` — "no cookies, no fingerprinting, anonymous visitor IDs, GDPR-compliant, **DNT/GPC honored**."
- `docs/security.md` — "**Do Not Track (DNT)**: Tracking script checks `navigator.doNotTrack` and disables collection if enabled" and "**Global Privacy Control (GPC)**: Respects `navigator.globalPrivacyControl` signal."
- `apps/dashboard-web/src/pages/Privacy.jsx:130` — "The tracking script checks `navigator.doNotTrack === "1"` and `navigator.globalPrivacyControl === true` at initialisation. If either is set, the script exits immediately — no events or sessions are created."
- `apps/dashboard-web/src/data/blogPosts.js:153` — "Tools like InsightsTrack also honor the browser **Do Not Track (DNT)** and **Global Privacy Control (GPC)** signals automatically."

**No such check exists in the tracking script.** Verified by direct grep against the generator in **both** copies of the public repo:

```
grep -n "doNotTrack\|globalPrivacyControl\|dnt\|DNT" apps/analytics-api/src/services/sitesService.js    → exit 1 (no match)
grep -n "doNotTrack\|globalPrivacyControl"          appsv2/analytics-api/src/services/sitesService.js    → exit 1 (no match)
```

The full body of `getRawTrackingScript` was additionally read end-to-end; it proceeds directly from `getUserId()`/`getSessionId()` to `trackPageview()` with no opt-out gate of any kind.

**This is a documented feature that does not exist, in the exact domain the paper will claim as its contribution.** Publishing a privacy-focused paper while the repository's own privacy page describes an unimplemented control is a research-integrity problem, not merely a bug. It must be fixed (implement the check) or every such claim retracted, **before** submission. See P0-1.

### 9.3 Retention does not delete what users see

**VERIFIED** — `docs/security.md` claims "**Retention cleanup**: Manual or automated deletion of expired events and sessions."

Two defects:

1. **Not automated.** `runRetentionCleanup()` exists in `reportingService.js` and is exposed at `POST /api/reporting/:siteId/retention/cleanup`, but nothing calls it on a schedule. The only `setInterval` calls in the entire backend are the sync loop, the integration poll loop, and the cache sweep (verified by `grep -rn "setInterval" apps/analytics-api/src/`). There is **no scheduler**.
2. **It does not delete from the read path.** The function issues `DELETE FROM events` and `DELETE FROM sessions` against **PostgreSQL only**. Per §4.2 Weakness 2, deletions never propagate to DuckDB. Since **every** dashboard query reads DuckDB, expired data remains fully visible in the dashboard, the SQL Editor, and all AI tools after a "successful" cleanup that reports a non-zero `deletedEvents` count.

**For a GDPR erasure claim this is the most serious issue in the repository.** A data subject's data would be reported as deleted while remaining queryable. See P0-1.

### 9.4 Anonymity of the visitor ID

**VERIFIED** — The ID is `'u_' + Math.random().toString(36).substr(2,9)` in `localStorage`, persisting indefinitely across sessions until the user clears site data.

**Assessment for a paper (INFERRED, but well-grounded):**
- `Math.random()` is **not cryptographically secure**. With ~9 base-36 characters the space is large enough that accidental collision is unlikely at realistic scale, but it is not a CSPRNG and should not be described as one. `crypto.randomUUID()` is available in all target browsers.
- Under GDPR, a persistent unique identifier tied to a device is generally treated as **personal data** even without a name attached (Recital 30, and the Article 29 WP opinion on device identifiers). Describing this as "anonymous" is legally contestable. **"Pseudonymous"** is the defensible term, and a paper should use it.
- The claim "no cookie banner needed" is a **legal** conclusion, not a technical one, and jurisdictions differ on whether `localStorage` writes fall under ePrivacy/PECR Article 5(3) — many regulators hold that they do, since the provision is technology-neutral about "storing information on terminal equipment." `Privacy.jsx` does hedge with "in most jurisdictions" and "confirm with your own legal counsel," which is appropriate; the README's unqualified "GDPR-compliant" is not.

### 9.5 Client-side geolocation

**VERIFIED** — Country is inferred **in the browser** from the IANA timezone, with a `navigator.language` fallback. This is a genuinely privacy-preserving design (no server-side IP geolocation needed) and is a **defensible, publishable contribution** — but it has an accuracy cost that must be quantified, not asserted:
- VPN and remote users report the timezone's country, not their location.
- Travellers report their current timezone.
- Users with a non-local locale fall back incorrectly.
- Many timezones are absent from the ~250-entry map and yield `'Unknown'`.

**NEEDS VERIFICATION** — No accuracy measurement exists. Comparing timezone-derived country against `geoip-lite`'s IP-derived country over a real traffic sample would be a **strong, cheap, novel empirical result** for the paper. See §16.

### 9.6 Missing privacy controls

**VERIFIED** — All absent from the codebase:
- No DNT/GPC (§9.2).
- No user-facing opt-out mechanism of any kind.
- No consent management integration.
- No data-subject export endpoint (GDPR Art. 15).
- No data-subject erasure endpoint (GDPR Art. 17) — retention cleanup is per-site, not per-subject, and does not work (§9.3).
- No IP truncation/salting option (moot, since IPs are not stored).
- No documented lawful basis or DPIA.

---

## 10. Testing

### 10.1 Measured results

**VERIFIED** — Both suites were executed during this audit after `npm ci`.

**Backend** (`apps/analytics-api`, `npm test` → Vitest 4.0.18):

```
Test Files  10 failed | 10 passed (20)
     Tests  84 passed | 133 skipped (217)
  Duration  2.82s
```

**The 10 failures are all `ECONNREFUSED ::1:5432`** — no PostgreSQL was running. The 133 skipped tests are the DB-dependent ones. Only **84 of 217 tests (38.7%) actually executed**.

The 10 files that pass without a database:

| File | Tests |
|---|---|
| `tests/mcpRegistry.test.js` | 23 |
| `tests/sync.test.js` | 11 |
| `tests/cache.test.js` | 10 |
| `tests/providerDefaults.test.js` | 8 |
| `tests/secretBox.test.js` | 7 |
| `tests/assistantHistory.test.js` | 7 |
| `tests/toolGuardrails.test.js` | 6 |
| `tests/provider.test.js` | 4 |
| `tests/integrationRegistry.test.js` | 4 |
| `tests/vendoring.test.js` | 4 |

The 10 that require PostgreSQL: `routes/tracking`, `routes/sites`, `routes/assistant`, `routes/mcp`, `routes/sentryIntegration`, `routes/sentryWebhook`, `routes/sentryLatestEvent`, `sitesService`, `trackingService`, `sentryService`.

**Frontend** (`apps/dashboard-web`, `npm test`):

```
Test Files  9 passed (9)
     Tests  55 passed (55)
  Duration  905ms
```

All green: `formatters` (21), `ChartCard` (6), `MetricCard` (5), `exportUtils` (5), `useAuthStore` (4), `useDateFilterStore` (4), `useThemeStore` (4), `useSiteStore` (3), `api` (3).

**E2E** — 5 Playwright specs exist (`docs`, `landing`, `login`, `register`, `screenshots`) with `playwright.config.js`. **NEEDS VERIFICATION** — not executed in this audit (requires a running stack). Note that the specs are weighted toward marketing/auth pages; there is no E2E coverage of the analytics dashboard, SQL Editor, or Pulse.

### 10.2 Assessment

**VERIFIED — Structural problems for a JOSS submission:**

1. **Tests cannot run from a clean checkout.** `tests/testHelper.js` connects to the developer's **real local `analytics_db` on port 5432** and cleans by pattern (`DELETE FROM events WHERE site_id LIKE 'site_test%'`). There is no ephemeral database, no testcontainer, no fixture. A reviewer following the README gets 10 failing files.
2. **No CI** (§13.1), so this failure mode is invisible and unregressed.
3. **No coverage measurement.** No `--coverage` config, no threshold, no reported number. `docs/testing.md` mentions `--coverage` as a debugging tip only.
4. **Test data pollution risk.** Cleaning the developer's real database by `LIKE` pattern will delete any production row whose `site_id` happens to start with `site_test` or whose domain ends `.test.example.com`.
5. **`fileParallelism: false`** and `sequence.concurrent: false` — the suite is fully serialized, presumably because of the shared database.

**VERIFIED — Coverage gaps by component:**

| Component | Coverage |
|---|---|
| MCP tool registry | Good (23 tests) |
| Sync logic | Partial (11 tests — unit-level; `serialise()` and config, not the sync protocol end-to-end) |
| Cache + coalescing | Good (10 tests) |
| secretBox crypto | Good (7 tests) |
| LLM providers | Partial (12 across 2 files) |
| Tracking / sites / services | **Blocked on DB** |
| **`queries/queries.js` (2357 LOC)** | **No dedicated test file at all** |
| **SQL Editor validation** | **No dedicated test file at all** |
| **Auth / authorization** | **No dedicated test file at all** |
| `routes/analytics.js` (52 routes) | **No dedicated test file at all** |

The three untested areas are exactly the three that carry the security claims. See P0-8.

---

## 11. Documentation

**VERIFIED** — 37 files in `docs/`, plus root `README.md` (17.5 KB), `ARCHITECTURE.md` (46 KB), `DOCKER.md`, `CLAUDE.md`, and a project skill at `.claude/skills/insighttrack/`.

**Strengths (VERIFIED)** — Genuinely unusual breadth for a solo project: per-feature guides (`sql-editor.md`, `custom-dashboards.md`, `reporting-studio.md`, `ai-analyst.md`, `mcp-toolkit.md`), architecture deep-dives (`hot-cold-analytics-architecture.md`, `pg-duckdb-sync.md`, `performance-architecture.md`, `caching.md`), a `docs/dashboard-pages/` directory documenting each UI page, `docs/diagrams/`, and 40 screenshots. In-code comments are consistently high quality and often explain *why* (the `daily_stats` exclusion rationale in `schema.js` is a good example).

**VERIFIED — Accuracy defects.** Documentation describes behaviour that does not exist:

| Claim | Location | Reality |
|---|---|---|
| DNT honored | `README.md:30`, `docs/security.md`, `Privacy.jsx:130`, `blogPosts.js:153` | **Not implemented** (§9.2) |
| GPC honored | same | **Not implemented** (§9.2) |
| Automated retention cleanup | `docs/security.md` | **No scheduler exists** (§9.3) |
| Retention deletes data | `docs/security.md` | **Deletes from PG only; DuckDB retains** (§9.3) |
| MIT licensed | `README.md:7` badge, `README.md:38` | **No LICENSE file exists** (§13.2) |
| "17 analytics pages" | `README.md:32` | 30 page components exist (incl. marketing/auth). **NEEDS VERIFICATION** of the intended count. |
| "~2 KB script" | `README.md:34` | The generated script contains a ~250-entry timezone map and a ~100-entry ISO map; it is plainly larger than 2 KB uncompressed. **NEEDS VERIFICATION** — measure actual bytes, and gzip. |

**VERIFIED — Missing for a research/OSS release:** no `CONTRIBUTING.md` (a `docs/contributing.md` exists, but not at root where GitHub surfaces it), no `CODE_OF_CONDUCT.md`, no `LICENSE`, no `CITATION.cff`, no `codemeta.json`, no `.zenodo.json`, no issue/PR templates, no `SECURITY.md`, no changelog beyond a single dated `CHANGELOG-2026-05-02.md`.

**VERIFIED** — `docs/` is shared by both `apps/` and `appsv2/`, so where the two copies' behaviour diverges (§0.1) the documentation cannot describe both accurately.

---

## 12. Deployment

**VERIFIED** — `docker-compose.yml` defines 5 services: `db` (postgres:15-alpine, healthchecked with `pg_isready`), `backend`, `ui`, `demo-site`, `pgadmin`. Named volumes `pgdata` and `duckdb_data`. `backend` correctly waits on `db` via `condition: service_healthy`. A second `docker-compose.v2.yml` exists for the `appsv2` copy.

**VERIFIED** — `apps/analytics-api/Dockerfile`: `node:20-slim` (Debian, not Alpine — with an in-file comment noting DuckDB needs glibc, which is correct), `npm ci --omit=dev`, `CMD` runs `migrate.js && init.js && src/index.js`.

**VERIFIED** — `apps/dashboard-web/Dockerfile`: multi-stage — `node:20-alpine` builder → `nginx:alpine` runtime with a custom `nginx.conf` reverse-proxying `/api`.

**VERIFIED** — Env templates: `.env.example` (1.2 KB) and `.env.production.example` (4.7 KB).

**VERIFIED — Deployment concerns:**

1. **No image tags / digests pinned** beyond `postgres:15-alpine`, `nginx:alpine`, `dpage/pgadmin4:latest`. `:latest` for pgAdmin is non-reproducible — a direct problem for a Zenodo artifact claiming reproducibility.
2. **PG (5432) and pgAdmin (5050) published to the host** by default.
3. **The API container runs as root** — no `USER node` directive in the Dockerfile.
4. **No resource limits** (`mem_limit`, `cpus`) on any service; DuckDB is memory-hungry.
5. **No healthcheck on `backend` or `ui`**, only on `db`.
6. **DuckDB in a Docker named volume**: the analytics DB is a single file with a 4-connection in-process pool. Two backend replicas mounting the same volume would corrupt it. Nothing prevents `docker compose up --scale backend=2`.
7. **No production reverse-proxy/TLS configuration** is shipped.
8. **`scripts/test-docker.sh`** exists (5.8 KB) — **NEEDS VERIFICATION**, not executed here.

---

## 13. Current release & versioning

### 13.1 Version state

**VERIFIED**:

| Item | State |
|---|---|
| Git tags | **None** (`git tag` → empty) |
| Total commits | **22** |
| Latest commit | `a70ca0a`, 2026-08-09 |
| `apps/analytics-api` version | `1.0.0` |
| `apps/dashboard-web` version | `1.0.0` |
| `apps/mcp-server` version | `0.1.0` |
| `apps/mcp-toolkit-core` version | `0.1.0` |
| MCP `serverInfo.version` | `0.1.0` (hardcoded in `protocol.js`) |
| Root package | **Does not exist** |
| Release notes | One file, `CHANGELOG-2026-05-02.md` (24 KB), not in Keep-a-Changelog form and not tied to any tag |

**VERIFIED — No CI/CD whatsoever.** `.github/` contains exactly one file: `FUNDING.yml`. There are no workflows, no automated tests on push, no release automation, no dependency scanning, no build verification.

**Consequence (VERIFIED):** there is no versioned artifact to deposit. A Zenodo DOI is minted from a **GitHub release**, which requires a tag. Nothing is currently taggable in a way that maps to a citable version.

### 13.2 Licensing

**VERIFIED — CRITICAL.** 

- **No `LICENSE` file** exists at the repository root (`ls LICENSE* COPYING*` → no matches).
- **No `license` field** in any `package.json` (`grep '"license"' apps/*/package.json appsv2/*/package.json` → no matches).
- `README.md:7` renders a badge reading **"Open Source — MIT"** that **links to `LICENSE`** — a broken link to a file that does not exist.
- `README.md:38` states "**Free forever** — MIT licensed."

Under the Berne Convention, code published without a license is **"all rights reserved"** by default. Despite the README's assertion, **this repository is not currently open source in any legally operative sense.** Nobody may lawfully copy, modify, or redistribute it.

This is simultaneously:
- a **hard JOSS blocker** (an OSI-approved license in a `LICENSE` file is a submission requirement),
- a **Zenodo problem** (the deposit would carry no usable license), and
- a **factual error in the README** that must be corrected either way.

See P0-9.

---

## 14. Existing benchmarks

**VERIFIED** — Two sets of published numbers exist in the documentation, plus one script.

**(a) `docs/performance-architecture.md`** — "Real numbers measured with DuckDB on Apple M4 (same engine used in Docker)":

| Rows | KPI query | Traffic | Top pages | DB size |
|---|---|---|---|---|
| 1M | 9 ms | 5 ms | 6 ms | ~50 MB |
| 10M | 88 ms | 42 ms | — | ~985 MB |
| 100M | 3.9 s → **< 5 ms** with `daily_stats` | 522 ms | 869 ms | ~3 GB |

Plus: "P99 latency drops ~4×" (connection pooling), "5–20× speedup" (ART indexes), "~50-100× faster" (bulk insert), and a capacity-planning table claiming "< 1 ms" from < 500K rows to 500M+.

**(b) `docs/hot-cold-analytics-architecture.md`** — a before/after table:

| Query | Before | After | Speedup |
|---|---|---|---|
| KPI — 7 days | ~80 ms | 55 ms | 1.5× |
| KPI — 30 days | ~210 ms | 64 ms | 3.3× |
| KPI — 90 days | ~620 ms | 25 ms | **25×** |
| Traffic — 30 days | ~180 ms | 24 ms | 7.5× |
| Traffic — 90 days | ~490 ms | 44 ms | **11×** |
| Top pages — 90 days | ~520 ms | 39 ms | **13×** |

**(c) `scripts/benchmark.js`** — an executable harness that logs in, runs a `SELECT COUNT(*)`, then times ~N endpoints with 3 runs each (reporting cold = run 1, warm = mean of runs 2–3) and a concurrency test reporting req/s.

### 14.1 Why none of this is publishable as-is

**VERIFIED — the benchmarks fail essentially every reproducibility requirement:**

1. **Not reproducible (partially resolved).** `benchmark.js` authenticated as a specific personal account against one hardcoded site ID, so no third party could run it. Credentials now come from the environment (§8.5), but the harness still targets *an* operator-supplied account and site rather than provisioning a reproducible fixture — so the reproducibility gap is narrowed, not closed.
2. **No dataset.** The 1M/10M/100M datasets are not in the repository, and no generator is provided that reproduces them. `scripts/load-test-data.js` exists but is unverified as the source of these numbers.
3. **No environment spec.** "Apple M4" is the entire specification. No RAM, no macOS version, no Node version, no DuckDB build, no thermal state, no whether Docker was involved (the doc says "same engine used in Docker," which is ambiguous).
4. **n=3, no distribution.** Three runs, reported as a single cold value and a 2-run mean. No median, no p95/p99, no standard deviation, no confidence interval, no outlier handling.
5. **No baseline comparison.** The headline claim is "10–100× faster than a row store" (`README.md:52`), but **no PostgreSQL-side measurement exists anywhere in the repository.** The comparison is asserted, never made. This is the single largest evidentiary gap for the paper's central claim.
6. **Cache contamination.** "Warm" numbers include the application's own 10–120 s TTL cache. Several sub-3 ms figures are almost certainly cache hits, not DuckDB query times — the script itself labels `warm < 3ms` with a rocket emoji, implicitly acknowledging this. Measuring the cache and calling it query performance would be a serious methodological error in a paper.
7. **Unclear provenance for the hot/cold table.** Given §5.5's unresolved `event_uuid` schema question, it is not established that the measured configuration matches the committed code.
8. **No raw data.** No CSV, JSON, or log artifacts are committed. Only summary tables in prose.

**Bottom line: the repository contains performance *claims*, not benchmarks.** Every number in §14 must be either regenerated under a documented, reproducible methodology or removed from the paper. See P0-4.

---

## 15. Technical debt

Consolidated from the sections above, ordered by severity.

### Critical
1. **DNT/GPC documented but not implemented** (§9.2) — integrity issue.
2. **Deletes never propagate PG→DuckDB** (§4.2, §9.3) — retention/erasure silently ineffective.
3. **No LICENSE** (§13.2) — repository is legally closed despite MIT claims.
4. **Two divergent shipped copies** (`apps/` vs `appsv2/`) (§0.1) — differ in application code, Dockerfiles, and test tooling; canonicity undeclared.
5. **3 critical + 21 high dependency vulnerabilities** (§8.4).

### High
6. **Mutable-table sync misses updates** where `tsColumn` is `created_at` (§4.2 W1) — affects 7 tables.
7. **SQL Editor uses a different authorization model** than every other surface (§8.3).
8. **SQL Editor denylist does not cover `read_csv`/`read_parquet`/`read_json`** (§8.2) — unverified file-read exposure.
9. **SQL Editor permits cross-tenant reads** (§8.2).
10. **Tests cannot run from a clean checkout** (§10.2) — 10/20 backend files fail without a manually provisioned DB.
11. **No CI** (§13.1).
12. **Zero test coverage** of `queries.js`, SQL Editor validation, auth, and all 52 analytics routes (§10.2).
13. **`sites.user_id VARCHAR` vs `users.id INTEGER`** type mismatch requiring regex-guarded casts (§3.2).
14. **No FK from `events`/`sessions` to `sites`** (§3.2) — orphaned data on site deletion.
15. ~~Hardcoded credentials in benchmark scripts~~ — **resolved** 2026-08-28; migrated to required env vars across all three scripts (§8.5). Residual: still present in git history, accepted by the author as a dummy local password.
16. **No schema versioning / migration history** (§3.4).

### Medium
17. **`daily_stats.bounces` and `.avg_duration` always 0** (§4.4).
18. **Late-arriving events never enter `daily_stats`** (§4.4).
19. **Five dead functions with SQL interpolation** (§5.2) — latent injection.
20. **Unbounded cache** (no LRU/max entries) (§5.4).
21. **`POST /api/sync?full=true` available to any authenticated user** (§4.3).
22. **No site-existence validation on tracking ingest** (§2.1).
23. **`event_uuid`/`sessions.updated_at` referenced by views but absent from schema** (§5.5).
24. **`new Promise(async …)` anti-pattern** in `duckRun`/`duckAll` (§3.5).
25. **Raw DuckDB errors returned to SQL Editor clients** (§8.2).
26. **API container runs as root; PG/pgAdmin published to host; `:latest` tag** (§12).
27. **CSP disabled**; **PG SSL `rejectUnauthorized:false`** (§8.5).
28. **README factual errors** — page count, script size, license (§11).

### Low
29. Repeated per-boot migration guards accumulate (§3.4).
30. No `CONTRIBUTING.md`/`CODE_OF_CONDUCT.md`/`SECURITY.md` at root (§11).
31. Single 24 KB dated changelog, not tied to releases (§13.1).
32. `Math.random()` rather than `crypto.randomUUID()` for visitor IDs (§9.4).
33. E2E specs cover marketing/auth pages only (§10.1).

---

## 16. Potential research contributions

Assessed for genuine novelty. The field (Plausible, Umami, Matomo, PostHog, Fathom, Countly) is crowded, and several plausible-sounding angles are **not** novel. Honest triage follows.

### Tier 1 — Defensible, with work

**C1. Timezone-derived geolocation as an IP-free alternative — with a measured accuracy cost.**
The most genuinely novel element. Deriving country **client-side** from `Intl.DateTimeFormat().resolvedOptions().timeZone` means the server never needs the IP for geolocation at all — a categorically stronger privacy position than IP-anonymization (the Plausible/Fathom approach), because the identifying input never reaches the server. What makes this publishable is that the cost is **directly measurable**: run both methods over the same traffic and report the confusion matrix, per-country precision/recall, and `Unknown` rate. A privacy/utility trade-off curve with real numbers is a contribution; the technique alone is not.
*Status: implementation VERIFIED, evaluation entirely absent.*

**C2. A single tool registry serving three consumption surfaces.**
One registry (`mcp/tools/registry.js`) backs the in-dashboard assistant, a remote Streamable-HTTP MCP endpoint, and a stdio MCP bridge, with identical authorization on all three paths (verified in §7). The **asymmetric envelope** — full data to the human, `capToolData`-bounded data to the model — is a clean, generalizable pattern for LLM-facing analytics tools, as is the per-user dynamic `siteId` enum injection in `buildToolList`. Framed as an architecture/patterns paper with a cost evaluation (tokens and dollars per query with and without capping), this stands up.
*Status: implementation VERIFIED and genuinely good; no evaluation.*

**C3. Consistency semantics of a debounce-triggered asymmetric replication pipeline.**
Not "we replicate PG to DuckDB" — that is ordinary CDC and is **not novel**. The publishable framing is the honest characterization of what these specific mechanisms guarantee and where they fail: keyset-vs-watermark strategy selection per table, per-batch watermark persistence for crash-safety, the deliberate `daily_stats` single-writer exclusion, and the **staleness bound** induced by composing a 5 s debounce with a 60 s interval and 10–120 s cache TTLs. The four failure modes this audit documented (§4.2) are part of the result, not an embarrassment — a paper that states and measures its staleness envelope is stronger than one that claims eventual consistency.
*Status: mechanism VERIFIED; no formalization, no measurement.*

### Tier 2 — Supporting material, not a paper on its own

**C4. LLM-facing SQL sandbox on an embedded OLAP engine.** The layered validation (§8.2) plus audit logging is solid engineering, but validation-by-denylist is well-trodden. Publishable only as a hardening case study **with an adversarial evaluation** — and only after P0-5 and P0-6 are resolved, since the current implementation has open questions.

**C5. Cost-control mechanisms for embedded LLM analysts.** The layered fences (§6.4) are practical and under-discussed in the literature, but constitute a section, not a paper.

### Explicitly NOT novel — do not claim these

- **"PostgreSQL for writes, DuckDB for reads."** This is standard HTAP/CDC architecture. DuckDB-as-serving-layer is widely deployed. Claiming novelty here will draw a sharp reviewer response.
- **"Cookieless analytics."** Plausible, Fathom, and Umami have shipped this for years.
- **"Self-hosted GA alternative."** A crowded product category, not a research contribution.
- **"10–100× faster than a row store."** Both an unmeasured claim (§14) and an expected, well-documented property of columnar engines. Not a finding.

### Recommended framing

The strongest single paper is **C1 + C3**: *"Privacy-preserving web analytics without server-side IP processing: measuring the accuracy cost of client-side geolocation and the staleness envelope of a debounced OLAP replication pipeline."* That is honest, measurable from this codebase, and makes a real trade-off legible. C2 is a natural second paper or a systems-track submission.

---

## 17. Missing evidence for a research paper

Ordered by how badly the paper needs it.

### Must have

**E1. A reproducible benchmark harness.** Replace `scripts/benchmark.js`. Requirements: no hardcoded credentials; a seeded, deterministic data generator producing 1M/10M/100M row datasets; documented hardware, OS, Node, DuckDB, and Docker versions; n ≥ 30 runs; report median, p95, p99, and standard deviation; **cache explicitly disabled or bypassed** for engine-level measurement (and measured separately when characterizing the cache); raw results committed as CSV.

**E2. The PostgreSQL baseline.** The central claim — 10–100× — has **no comparison measurement anywhere**. Run the identical analytical query set against PostgreSQL with equivalent indexing, on identical data and hardware. Without this the paper's headline is unsupported. If PG turns out to be closer than claimed, that is still a publishable result; an unmeasured multiplier is not.

**E3. Geolocation accuracy measurement (C1).** Timezone-derived vs. IP-derived country over a real or realistically simulated traffic sample. Report the confusion matrix, per-country precision/recall, overall accuracy, `Unknown` rate, and a VPN-user sensitivity analysis. This is the paper's most novel empirical result and it does not exist yet.

**E4. Sync staleness measurement (C3).** Instrument event-write→DuckDB-visible→dashboard-visible. Report the distribution under varying write rates (10, 100, 1 000, 10 000 events/s) and varying `SYNC_DEBOUNCE_MS`/`SYNC_INTERVAL_MS`. Include the failure modes from §4.2 as measured, not just described.

**E5. Correctness validation of the sync pipeline.** A differential test: after N mixed operations (inserts, updates, deletes, late-arriving events) against PG, assert that DuckDB agrees. This will fail on updates and deletes today (§4.2) — which is exactly why it must be run and reported before publication.

### Should have

**E6. Ingest throughput.** Max sustained events/sec before latency degrades or errors appear; PG pool saturation behaviour; the effect of the debounce on write throughput. `docs/performance-architecture.md` asserts "write throughput scales linearly" with no evidence.

**E7. Tracking script weight.** Measure the generated script's actual bytes, raw and gzipped, and compare against `gtag.js`, Plausible, Umami, and Fathom. The "~2 KB" and "~50× smaller than gtag.js" claims are currently unverified and, given the two large embedded lookup maps, likely wrong.

**E8. Concurrency scaling.** Dashboard latency vs. concurrent users (1 → 500), with and without request coalescing, to substantiate the "P99 drops ~4×" claim.

**E9. LLM cost/accuracy evaluation (C2).** Tokens and dollars per query with and without `capToolData`; answer accuracy against a labelled question set; tool-selection precision across the three providers.

**E10. Hot/cold measurement on verified code.** Re-run the §14(b) table after resolving the `event_uuid` schema question (§5.5), on a configuration confirmed to match the committed code.

### Nice to have

**E11.** Memory profile under sustained load (DuckDB + unbounded cache).
**E12.** Multi-tenant isolation validation.
**E13.** A feature/architecture comparison table against Plausible, Umami, Matomo, PostHog.
**E14.** Cold-start and boot-time measurement (§3.4 flags growth with schema history).

---

## 18. JOSS-readiness issues

Assessed against the JOSS review checklist (`joss.readthedocs.io`).

### Hard blockers — submission will be rejected or desk-rejected

| # | Requirement | Status | Evidence |
|---|---|---|---|
| J1 | **OSI-approved license in a `LICENSE` file** | ❌ **ABSENT** | No `LICENSE`; no `license` field in any `package.json`; README badge links to a nonexistent file (§13.2) |
| J2 | **Software must be research software with a substantial scholarly contribution** | ⚠️ **AT RISK** | JOSS explicitly excludes "minor utility" and thin wrappers. As presented, this reads as a product/GA-alternative. Requires the C1/C3 reframing of §16 (§16) |
| J3 | **Automated tests, runnable by a reviewer** | ❌ **FAILS** | 10/20 backend files fail from a clean checkout; 133/217 tests skip; no CI (§10) |
| J4 | **A `paper.md` + `paper.bib`** | ❌ **ABSENT** | Neither exists |
| J5 | **Statement of need** | ❌ **ABSENT** | README is marketing copy, not a scholarly statement of need |
| J6 | **A tagged, archived release with a DOI** | ❌ **ABSENT** | Zero git tags; no Zenodo deposit (§13.1) |

### Serious concerns — will generate reviewer objections

| # | Issue | Detail |
|---|---|---|
| J7 | **Documented features do not exist** | DNT/GPC (§9.2) and working retention (§9.3). A reviewer who tests the privacy claims will find them false. This is the most damaging finding for credibility. |
| J8 | **Dependency vulnerabilities** | 3 critical, 21 high (§8.4) |
| J9 | **Two divergent shipped copies** | `apps/` and `appsv2/` differ in code, Dockerfiles, and tests, with no stated canonical copy — a reviewer cannot determine what to review or which stack to build (§0.1) |
| J10 | **Installation instructions do not yield a working test run** | Requires an undocumented, manually provisioned PostgreSQL with a specific database name (§10.2) |
| J11 | ~~Committed credentials~~ | **Resolved** — env vars + fail-fast across all three scripts (§8.5). Still in git history; author states it was a dummy local password. A JOSS reviewer browsing history may still raise it, so a one-line note in the README or `SECURITY.md` would pre-empt the question. |
| J12 | **No contribution guidelines at root** | No `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, or issue templates (§11) |
| J13 | **No community/support channel** | No `SECURITY.md`, no documented issue-reporting or support process |
| J14 | **Authorship and affiliation undeclared** | No `CITATION.cff`; no ORCID; no affiliation |

### Satisfied

| # | Requirement | Status |
|---|---|---|
| J15 | Public version-controlled repository | ✅ Git, GitHub |
| J16 | Functionality documentation | ✅ Strong — 37 docs files (accuracy caveats aside) |
| J17 | API/usage documentation | ✅ `docs/api-reference.md`, OpenAPI 3.1 at `/api/openapi.json` |
| J18 | Example usage | ✅ Three demo sites, 40 screenshots |
| J19 | Installation instructions | ✅ Docker Compose + manual (though see J10) |

### JOSS scope assessment (candid)

**INFERRED, and this deserves direct attention:** JOSS reviewers routinely reject submissions that are products rather than research software. A "self-hosted Google Analytics alternative" as currently framed by the README is likely to be judged out of scope on J2 alone.

Two viable paths:
1. **Reframe for JOSS** around C1/C3 from §16, with the evaluation from §17 — presenting the software as an *instrument* for studying privacy/utility trade-offs in web measurement.
2. **Target a different venue.** A systems or measurement conference/journal (or arXiv + Zenodo, skipping JOSS) may fit the work better. Zenodo deposit has no scope test — only J1 (license) genuinely blocks it.

Given the effort involved, path 2 for the technical paper plus a Zenodo DOI is the lower-risk route; JOSS becomes worthwhile only if the C1/C3 reframing and evaluation are actually done.

---

## Prioritized action list

Ordered by blocking severity. P0 items block publication; the rest improve the submission.

### P0 — Critical (must be resolved before any publication or deposit)

**P0-1. Resolve the privacy claims: implement DNT/GPC and fix retention, or retract the claims.**
Either add `navigator.doNotTrack === '1'` / `navigator.globalPrivacyControl === true` early-exit to `getRawTrackingScript` (in whichever copy is canonical per P0-2, and any copy that ships), or remove the claim from `README.md:30`, `docs/security.md`, `Privacy.jsx:130`, and `blogPosts.js:153`. Separately, make retention propagate deletions to DuckDB (§4.2 W2), or stop describing it as deletion. **Publishing a privacy paper against a repository whose privacy page describes unimplemented controls is a research-integrity failure.** (§9.2, §9.3)

**P0-2. Collapse `apps/` and `appsv2/` to one shipped copy.** They are not identical (§0.1): `appsv2` has an extra `routes/sync.js` and `seed-hotcold.js`, a different backend Dockerfile, and a `passmark-tests` suite; `apps` has lock files that `appsv2` lacks. Pick the canonical line, port anything worth keeping from the other, delete or clearly archive the loser, and drop the now-redundant Compose file. State the result in the README. A Zenodo deposit that ships the product twice, with two build stacks and no declared canonical version, is not citable. (§0.1)

**P0-3. Fix or formally document the sync correctness gaps.** At minimum: switch mutable tables from `created_at` to a real `updated_at` watermark (7 tables affected), and implement deletion propagation. If any gap is left unfixed, it must be explicitly stated as a limitation in the paper. (§4.2)

**P0-4. Rebuild the benchmarks to a reproducible standard.** Remove hardcoded credentials; add a deterministic data generator; document the environment fully; n ≥ 30 with median/p95/p99; bypass the application cache; commit raw results. **Then produce the missing PostgreSQL baseline (E2)** — the "10–100×" headline currently has no measurement behind it. (§14, E1, E2)

**P0-5. Verify the SQL Editor against file-read functions.** Test `SELECT * FROM read_csv('/etc/passwd')`, `read_parquet`, `read_json`, `read_text`, and `glob`. None is in the denylist. If any succeeds, this is arbitrary file read by any authenticated user and must be fixed before the repository is publicized. (§8.2)

**P0-6. Decide and document the SQL Editor tenancy boundary.** `SELECT * FROM events` with no `site_id` filter currently returns every tenant's rows. Either enforce site scoping (rewrite/wrap the query, or use per-site DuckDB views) or document loudly that the SQL Editor is single-tenant-only. (§8.2)

**P0-7. ~~Rotate the committed credential and purge it.~~ — RESOLVED / DOWNGRADED.** The hardcoded values were removed from all three scripts on 2026-08-28 (§8.5). The author states the password was a dummy used only against a local Docker stack, so rotation and history rewriting are **not** recommended — the disruption of rewriting every commit hash is not justified for a throwaway local credential.

**One open check remains (now P1-16):** confirm the account is not valid on the public demo instance. If it is, this reverts to P0 because of the SQL Editor cross-tenant read in §8.2.

**P0-8. Make tests runnable from a clean checkout.** Containerized ephemeral PostgreSQL (testcontainers or a compose test service), a fixture database, and no dependence on the developer's local `analytics_db`. All 217 tests must run for a reviewer. (§10.2)

**P0-9. Add a `LICENSE` file.** MIT, matching the README's existing claim. Add `"license": "MIT"` to every `package.json`. Without this the repository is legally closed, JOSS rejects on J1, and the Zenodo deposit carries no usable license. (§13.2)

**P0-10. Remediate critical dependency vulnerabilities.** 3 critical + 21 high across the two packages. Run `npm audit fix`, upgrade what needs manual intervention, and commit the resulting `npm audit` output as an artifact. (§8.4)

### P1 — Important (needed for a credible submission)

**P1-1.** Remove or parameterize the five dead `INTERVAL '${days} days'` functions (§5.2).
**P1-2.** Unify the SQL Editor onto `getMemberRole`/`site_members` like every other surface (§8.3).
**P1-3.** Validate `siteId` against the `sites` table on tracking ingest; reject unknown sites (§2.1).
**P1-4.** Require `admin`/`owner` for `POST /api/sync` (§4.3).
**P1-5.** Reconcile `sites.user_id VARCHAR` with `users.id INTEGER`; add FKs from `events`/`sessions` to `sites` (§3.2).
**P1-6.** Compute real `bounces` and `avg_duration` in `computeDailyRollups`, or drop the columns (§4.4).
**P1-7.** Handle late-arriving events in the rollup (recompute a trailing window, not just `MAX(date)+1`) (§4.4).
**P1-8.** Add CI: test both packages on push, plus `npm audit` and a lint step (§13.1).
**P1-9.** Add tests for the three untested security-critical areas — SQL Editor validation, auth/authorization, and `queries.js` (§10.2).
**P1-10.** Add `CITATION.cff`, `codemeta.json`, and a root `CONTRIBUTING.md` + `CODE_OF_CONDUCT.md` + `SECURITY.md` (§11).
**P1-11.** Tag `v1.0.0` and cut a GitHub release to mint the Zenodo DOI (§13.1).
**P1-12.** Correct the README's factual errors — license, page count, script size, DNT/GPC (§11).
**P1-13.** Resolve the `event_uuid` / `sessions.updated_at` schema question and confirm whether the hot/cold path works at this commit (§5.5).
**P1-14.** Run the geolocation accuracy study (E3) — the paper's most novel result (§16 C1, §17 E3).
**P1-15.** Instrument and measure sync staleness (E4) and write the differential correctness test (E5) (§17).
**P1-16.** Verify `nishikantaray1@gmail.com` cannot authenticate against the **public demo instance**. If it can, disable that account and treat §8.2's cross-tenant SQL Editor read as remotely exploitable (§8.5).

### P2 — Useful (strengthens the work)

**P2-1.** Bound the cache (LRU or max entries) (§5.4).
**P2-2.** Fix the `new Promise(async …)` pattern in `duckRun`/`duckAll` (§3.5).
**P2-3.** Route SQL Editor errors through `safeMsg` (§8.2).
**P2-4.** Docker hardening: `USER node`, drop the host PG/pgAdmin port publishing, pin image digests, add resource limits and backend/ui healthchecks (§12).
**P2-5.** Introduce versioned migrations with a recorded schema version (§3.4).
**P2-6.** Switch visitor IDs to `crypto.randomUUID()` (§9.4).
**P2-7.** Measure the tracking script's real size, gzipped, against competitors (E7) (§17).
**P2-8.** Extend E2E coverage to the dashboard, SQL Editor, and Pulse (§10.1).
**P2-9.** Add throughput (E6) and concurrency-scaling (E8) benchmarks (§17).
**P2-10.** Adopt "pseudonymous" rather than "anonymous" throughout, and qualify the GDPR claims (§9.4).
**P2-11.** Add coverage measurement with a CI threshold (§10.2).
**P2-12.** Enable CSP; fix PG SSL `rejectUnauthorized` (§8.5).

### P3 — Optional (polish)

**P3-1.** GDPR data-subject export and erasure endpoints (§9.6).
**P3-2.** LLM cost/accuracy evaluation (E9) (§17).
**P3-3.** Feature comparison table vs. Plausible/Umami/Matomo/PostHog (E13) (§17).
**P3-4.** Consolidate the migration guards accumulated in `initializeDatabase()` (§3.4).
**P3-5.** Adopt Keep-a-Changelog and tie entries to tags (§13.1).
**P3-6.** Architecture diagrams generated from code rather than maintained by hand (§11).
**P3-7.** Memory profiling under sustained load (E11) (§17).
**P3-8.** Redis-backed cache, rate limiter, and `ReplayGuard` to make multi-replica deployment viable (§1.3).

---

## Appendix A — Commands executed during this audit

Reproducible verification steps, for the record:

```bash
# Topology and divergence
diff -rq apps appsv2                      # full tree, not just src/
diff -rq apps/analytics-api/src appsv2/analytics-api/src
grep -rn "traffic/" --include=*.md --include=*.json --include=*.yml .   # private-repo leakage check

# Prisma (absence)
find . -iname 'schema.prisma'
grep -ril prisma --include=package.json .
grep -ril prisma apps/ appsv2/ docs/

# Licensing / citation (absence)
ls LICENSE* COPYING* CITATION* codemeta* .zenodo* CONTRIBUTING* CODE_OF_CONDUCT*
grep -rn '"license"' apps/*/package.json appsv2/*/package.json
git tag

# DNT / GPC (absence, both copies)
grep -n "doNotTrack\|globalPrivacyControl" apps/analytics-api/src/services/sitesService.js
grep -n "doNotTrack\|globalPrivacyControl" appsv2/analytics-api/src/services/sitesService.js

# Scheduler (absence)
grep -rn "setInterval" apps/analytics-api/src/

# SQL interpolation review
grep -n '${' apps/analytics-api/src/queries/queries.js

# Tests
cd apps/analytics-api  && npm ci && npm test
cd apps/dashboard-web  && npm ci && npm test

# Dependency audit
npm audit --json   # in each package
```

## Appendix B — Evidence summary

| Metric | Value | Method |
|---|---|---|
| Backend source | ~12 046 LOC (`src/`) | `wc -l` |
| `queries/queries.js` | 2 357 LOC | `wc -l` |
| `routes/analytics.js` | 779 LOC | `wc -l` |
| Analytics GET routes | 52 | `grep -c router.get` |
| MCP/AI tools | 19 | registry enumeration |
| PostgreSQL tables | 27 | `initializeDatabase()` |
| DuckDB tables | 15 + `_sync_meta` | `SCHEMA_SQL` |
| Synced tables | 13 | `SYNCABLE_TABLES` |
| Frontend pages | 30 | `ls src/pages \| wc -l` |
| Frontend components | 9 | `ls src/components \| wc -l` |
| Backend tests | 84 passed / 133 skipped / 217 total | `npm test` |
| Backend test files | 10 passed / 10 failed / 20 | `npm test` |
| Frontend tests | 55 passed / 55 total | `npm test` |
| E2E specs | 5 | `ls e2e/` |
| Docs files | 37 | `ls docs/` |
| Git commits | 22 | `git log --oneline \| wc -l` |
| Git tags | 0 | `git tag` |
| Backend vulnerabilities | 2 critical, 12 high, 6 moderate, 2 low | `npm audit` |
| Frontend vulnerabilities | 1 critical, 9 high, 5 moderate, 1 low | `npm audit` |

---

*This audit was produced by static reading of the repository at commit `a70ca0a`, plus execution of the test suites and `npm audit`. No application code, configuration, or documentation was modified. Claims marked NEEDS VERIFICATION require running the system or making measurements not currently possible from the repository alone.*
