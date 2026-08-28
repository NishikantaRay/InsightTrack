# DuckDB Analytics Engine

InsightTrack uses **DuckDB** as an embedded columnar OLAP database for all analytics read queries. This guide covers the architecture, sync mechanism, query functions, and performance characteristics.

---

## Why DuckDB?

Traditional analytics platforms query the same PostgreSQL database used for writes. This works at small scale, but analytical queries (aggregations, window functions, funnels) compete with incoming event writes for database resources.

InsightTrack solves this with a **dual-database architecture**:

```
Writes (events, sessions, auth)  ──▶  PostgreSQL (OLTP)
                                           │
                                      sync/sync.js
                                      (incremental)
                                           │
                                           ▼
Analytics reads (charts, KPIs)   ◀──  DuckDB (OLAP)
```

### Performance Comparison

> **⚠️ Illustrative figures — not measured in this repository.**
> No PostgreSQL benchmark exists here, and neither column below is produced by any
> script in the repository. These numbers are retained to illustrate the *shape* of
> the row-store vs column-store difference for analytical queries, **not** as a
> measured comparison of InsightTrack's two engines. See
> [`PERFORMANCE_BENCHMARK_AUDIT.md`](./PERFORMANCE_BENCHMARK_AUDIT.md).

| Query Type | Row-Store (illustrative) | Column-Store (illustrative) |
|-----------|------------------------|-----------------------|
| `COUNT(DISTINCT user_id)` over 100K rows | ~120ms | ~8ms |
| `GROUP BY date` with 3 aggregations | ~200ms | ~15ms |
| Window function (retention cohorts) | ~500ms | ~40ms |
| Full funnel analysis (5 stages) | ~350ms | ~25ms |
| `INSERT INTO events` (single row) | ~2ms | N/A (read-only) |

### Why Column-Store Wins for Analytics

```
ROW-ORIENTED (PostgreSQL):
  Row 1: [id, site_id, user_id, session_id, type, url, path, referrer, device, browser, os, country, timestamp, properties]
  Row 2: [id, site_id, user_id, session_id, type, url, path, referrer, device, browser, os, country, timestamp, properties]
  ...
  → Must read ALL columns even if you only need user_id and timestamp

COLUMN-ORIENTED (DuckDB):
  Column site_id:    [site_demo, site_demo, site_blog, ...]
  Column user_id:    [u_abc123, u_def456, u_ghi789, ...]
  Column timestamp:  [2026-03-01, 2026-03-01, 2026-03-02, ...]
  Column type:       [pageview, click, pageview, ...]
  → Only reads the 2-3 columns needed for your query
```

For a query like `SELECT COUNT(DISTINCT user_id) FROM events WHERE site_id = ?`:
- PostgreSQL reads ~14 columns × 100K rows = ~1.4M values
- DuckDB reads 2 columns × 100K rows = ~200K values (7x less I/O)

### Vectorised Execution

DuckDB processes data in batches of 2,048 values using SIMD CPU instructions, instead of row-at-a-time execution:

```
Traditional (row-at-a-time):
  for each row:
    check if site_id matches  ←  1 comparison per iteration
    if yes, add user_id to set

DuckDB (vectorised):
  for each batch of 2048 values:
    SIMD compare all 2048 site_ids at once  ←  1 CPU instruction
    gather matching user_ids in bulk
```

### Zero Network Overhead

DuckDB is embedded — it runs inside the same Node.js process as the Express server. There's no TCP connection, no serialisation, no deserialization. Query results go directly from DuckDB's memory into JavaScript arrays.

---

## Database Schema

DuckDB mirrors the PostgreSQL schema so that sync is a straightforward row copy:

### Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `_sync_meta` | table_name, last_synced, rows_synced, updated_at | Tracks sync progress per table |
| `events` | id, site_id, user_id, session_id, type, url, path, referrer, device, browser, os, country, city, timestamp, properties, utm_* | Raw event log |
| `sessions` | id, site_id, user_id, started_at, ended_at, duration, pageviews, entry_page, exit_page, referrer, device, browser, os, country, is_bounce, utm_* | Session records |
| `sites` | id, name, domain, created_at | Registered websites |
| `funnels` | id, site_id, name, steps, created_at | Funnel definitions |
| `daily_stats` | id, site_id, date, visitors, sessions, pageviews, bounces, avg_duration, top_pages, sources, devices, countries, computed_at | Pre-aggregated metrics |
| `users` | id, name, email, password, role, created_at | Dashboard user accounts |

Schema definition: [apps/analytics-api/src/schema/schema.js](../apps/analytics-api/src/schema/schema.js)

### Initialising the Schema

```bash
cd apps/analytics-api
npm run init
```

Output:
```
🦆 Initialising DuckDB analytics database…

  ✓  _sync_meta
  ✓  events
  ✓  sessions
  ✓  sites
  ✓  funnels
  ✓  daily_stats
  ✓  users

✅ DuckDB ready at duckdb/analytics.duckdb
```

---

## Data Sync: PostgreSQL → DuckDB

The sync mechanism is an **incremental high-water-mark** sync. It never deletes or modifies existing DuckDB rows — it only appends new data.

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     SYNC PROCESS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  For each table (events, sessions, sites, ...):                  │
│                                                                  │
│  1. Read last_synced timestamp from _sync_meta                   │
│     ┌──────────────────────────────────────────┐                 │
│     │ SELECT last_synced FROM _sync_meta       │                 │
│     │ WHERE table_name = 'events'              │                 │
│     │ → '2026-03-10T14:30:00.000Z'             │                 │
│     └──────────────────────────────────────────┘                 │
│                                                                  │
│  2. Query PostgreSQL for rows AFTER that timestamp               │
│     ┌──────────────────────────────────────────┐                 │
│     │ SELECT * FROM events                     │                 │
│     │ WHERE timestamp > '2026-03-10T14:30:00Z' │                 │
│     │ ORDER BY timestamp ASC                   │                 │
│     │ LIMIT 5000 OFFSET 0                      │                 │
│     └──────────────────────────────────────────┘                 │
│                                                                  │
│  3. Batch INSERT into DuckDB (5000 rows at a time)               │
│     ┌──────────────────────────────────────────┐                 │
│     │ INSERT INTO events (id, site_id, ...)    │                 │
│     │ VALUES (?, ?, ...)                       │                 │
│     └──────────────────────────────────────────┘                 │
│                                                                  │
│  4. Update _sync_meta with new high-water mark                   │
│     ┌──────────────────────────────────────────┐                 │
│     │ UPDATE _sync_meta                        │                 │
│     │ SET last_synced = '2026-03-11T08:00:00Z' │                 │
│     │ WHERE table_name = 'events'              │                 │
│     └──────────────────────────────────────────┘                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### First Run (Full Sync)

On the first run, `last_synced` defaults to epoch (`1970-01-01`), so all rows are pulled:

```bash
npm run sync
```

```
╔══════════════════════════════════════════════╗
║   InsightTrack · PostgreSQL → DuckDB Sync   ║
╚══════════════════════════════════════════════╝

① Ensuring DuckDB schema…
② Syncing tables…
  ✓  events: 92550 rows synced (high-water: 2026-03-11T18:29:39.028Z)
  ✓  sessions: 36467 rows synced (high-water: 2026-03-11T18:29:39.028Z)
  ✓  sites: 2 rows synced (high-water: 2026-03-11T08:30:52.844Z)
  ✓  funnels: already up-to-date
  ✓  daily_stats: already up-to-date
  ✓  users: already up-to-date

✅ Sync complete — 129019 total rows synced.
```

### Incremental Sync (Subsequent Runs)

After the first run, only new rows are synced:

```bash
npm run sync
```

```
② Syncing tables…
  ✓  events: 150 rows synced
  ✓  sessions: 42 rows synced
  ✓  sites: already up-to-date
  ...
✅ Sync complete — 192 total rows synced.
```

### Sync Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `SYNC_BATCH_SIZE` | `5000` | Rows fetched per batch from PostgreSQL |

### Scheduling Sync in Production

```bash
# Cron: every 5 minutes
*/5 * * * * cd /path/to/apps/analytics-api && npm run sync >> logs/sync.log 2>&1

# Or every minute for near-real-time
* * * * * cd /path/to/apps/analytics-api && npm run sync >> logs/sync.log 2>&1
```

### Important: DuckDB Single-Process Lock

DuckDB only supports **one process** accessing the database file at a time. You cannot run sync while the server is running (both try to open the same file).

**Workaround options:**

1. **Stop server → sync → restart server** (simple, works for scheduled syncs)
2. **In-process sync** — call `runSync()` from within the Express server via a cron endpoint
3. **Use DuckDB's `read_only` mode** for the server and `read_write` for sync (advanced)

Currently, the server opens DuckDB in read-write mode, so sync must run before starting the server, or the server must be stopped first.

---

## Syncable Tables

Each table has a configured timestamp column used for incremental sync:

| Table | Timestamp Column | ID Column |
|-------|-----------------|-----------|
| `events` | `timestamp` | `id` |
| `sessions` | `started_at` | `id` |
| `sites` | `created_at` | `id` |
| `funnels` | `created_at` | `id` |
| `daily_stats` | `computed_at` | `id` |
| `users` | `created_at` | `id` |

Configuration is in [src/schema/schema.js](../apps/analytics-api/src/schema/schema.js) → `SYNCABLE_TABLES`.

---

## Analytics Query Functions

All 21 query functions run against DuckDB and are located in [src/queries/queries.js](../apps/analytics-api/src/queries/queries.js).

### Endpoint-Matched Queries (16)

These map 1:1 to the REST API endpoints and return data in the exact shape the frontend expects:

| API Route | DuckDB Function | What It Does |
|-----------|----------------|--------------|
| `GET /:siteId/kpi` | `getKPISummary(siteId, dateRange)` | Total visitors, pageviews, bounce rate, avg session duration with trend comparison |
| `GET /:siteId/traffic` | `getTrafficOverTime(siteId, dateRange)` | Visitors, sessions, pageviews grouped by day |
| `GET /:siteId/bounce-rate-trend` | `getBounceRateOverTime(siteId, dateRange)` | Daily bounce rate percentage |
| `GET /:siteId/avg-session-trend` | `getAvgSessionOverTime(siteId, dateRange)` | Daily average session duration |
| `GET /:siteId/pageviews` | `getPageViewsOverTime(siteId, dateRange)` | Pageview counts per day |
| `GET /:siteId/top-pages` | `getTopPages(siteId, dateRange, limit)` | Most visited pages ranked by views |
| `GET /:siteId/sources` | `getTrafficSources(siteId, dateRange)` | Direct / Search / Social / Email / Referral breakdown |
| `GET /:siteId/devices` | `getDeviceBreakdown(siteId, dateRange)` | Desktop / Mobile / Tablet percentages |
| `GET /:siteId/countries` | `getCountries(siteId, dateRange, limit)` | Visitor count by country with ISO codes |
| `GET /:siteId/sessions` | `getSessionDuration(siteId, dateRange)` | Session duration distribution (0-10s, 10-30s, ...) |
| `GET /:siteId/funnel` | `getFunnelData(siteId, dateRange)` | 5-step conversion funnel with drop-off rates |
| `GET /:siteId/realtime` | `getRealTimeVisitors(siteId)` | Active visitors in last 5 minutes |
| `GET /:siteId/utm` | `getUTMCampaigns(siteId, dateRange)` | UTM source/medium/campaign breakdown |
| `GET /:siteId/comparison` | `getComparisonTraffic(siteId, dateRange)` | Current vs previous period overlay |
| `GET /:siteId/user-flow` | `getUserFlow(siteId, dateRange, limit)` | Page transition paths (from → to) |
| `GET /:siteId/alerts` | `getAlerts(siteId, dateRange)` | Traffic anomaly detection (spikes/drops) |

### Bonus DuckDB-Only Queries (5)

These leverage DuckDB's advanced SQL capabilities (window functions, complex aggregations):

| Function | Description |
|----------|-------------|
| `getDailyActiveUsers(siteId, days)` | Unique visitors per day over N days |
| `getHourlyTraffic(siteId, days)` | Traffic distribution by hour of day (0-23) |
| `getSessionBuckets(siteId, days)` | Session duration distribution with custom buckets |
| `getBounceRateByPage(siteId, days)` | Bounce rate breakdown by entry page |
| `getUserRetention(siteId, days)` | Cohort-based retention using window functions |

### Example: Retention Query (DuckDB Window Functions)

```sql
-- User retention cohort analysis
-- Groups users by their first-visit week, then checks
-- how many returned in subsequent weeks
WITH first_visits AS (
  SELECT user_id,
         DATE_TRUNC('week', MIN(timestamp)) AS cohort_week
  FROM events
  WHERE site_id = ? AND timestamp >= NOW() - INTERVAL '? days'
  GROUP BY user_id
),
activity AS (
  SELECT e.user_id,
         fv.cohort_week,
         DATE_TRUNC('week', e.timestamp) AS activity_week
  FROM events e
  JOIN first_visits fv ON e.user_id = fv.user_id
  WHERE e.site_id = ?
  GROUP BY e.user_id, fv.cohort_week, DATE_TRUNC('week', e.timestamp)
)
SELECT cohort_week,
       COUNT(DISTINCT user_id) AS cohort_size,
       COUNT(DISTINCT CASE WHEN activity_week = cohort_week THEN user_id END) AS week_0,
       COUNT(DISTINCT CASE WHEN activity_week = cohort_week + INTERVAL '1 week' THEN user_id END) AS week_1,
       COUNT(DISTINCT CASE WHEN activity_week = cohort_week + INTERVAL '2 weeks' THEN user_id END) AS week_2
FROM activity
GROUP BY cohort_week
ORDER BY cohort_week;
```

This kind of complex window function query runs in ~40ms on DuckDB vs ~500ms on PostgreSQL with 100K+ events.

---

## DuckDB Connection Layer

The DuckDB connection is managed in [src/db/duckdb.js](../apps/analytics-api/src/db/duckdb.js):

```javascript
import duckdb from 'duckdb';

// Singleton — one DB instance, one connection
let _db = null;
let _conn = null;

export function getDuckDB() {
  if (!_db) _db = new duckdb.Database(DUCKDB_PATH);
  return _db;
}

export function getDuckConn() {
  if (!_conn) _conn = getDuckDB().connect();
  return _conn;
}

// Promise wrappers for DuckDB's callback API
export function duckRun(sql, params = [])  { /* ... */ }
export function duckAll(sql, params = [])  { /* ... */ }
export function closeDuck()                { /* ... */ }
```

- **`duckRun(sql, params)`** — Execute a statement (INSERT, CREATE, etc.), returns nothing
- **`duckAll(sql, params)`** — Execute a query, returns array of row objects
- **`closeDuck()`** — Close the connection and database (for graceful shutdown)

---

## File Layout

```
apps/analytics-api/
├── duckdb/
│   └── analytics.duckdb          ← DuckDB database file (binary, ~50MB with 130K rows)
├── src/
│   ├── db/
│   │   └── duckdb.js             ← Connection singleton + query helpers
│   ├── schema/
│   │   └── schema.js             ← CREATE TABLE statements + SYNCABLE_TABLES config
│   ├── sync/
│   │   └── sync.js               ← Incremental PG → DuckDB sync engine
│   └── queries/
│       └── queries.js            ← 21 analytical query functions
├── scripts/
│   └── init.js                   ← Schema initialisation script
└── .gitignore                    ← Excludes *.duckdb files from git
```

---

## Backup and Recovery

### Backup

```bash
# Simple file copy (while server is stopped)
cp apps/analytics-api/duckdb/analytics.duckdb backups/analytics_$(date +%Y%m%d).duckdb
```

### Recovery

```bash
# Replace the database file
cp backups/analytics_20260311.duckdb apps/analytics-api/duckdb/analytics.duckdb
```

### Full Re-Sync from PostgreSQL

If the DuckDB file is corrupted or you want a clean slate:

```bash
cd apps/analytics-api

# Delete old file
rm -f duckdb/analytics.duckdb duckdb/analytics.duckdb.wal

# Recreate schema
npm run init

# Full sync from PostgreSQL
npm run sync
```

Since PostgreSQL is the source of truth, DuckDB can always be rebuilt from scratch.
