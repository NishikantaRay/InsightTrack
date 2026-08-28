# Hot+Cold Analytics Architecture — InsightTrack v2

> **Status: Implemented and live in `appsv2/`** · Launched May 2026
>
> This document describes the production architecture shipped in InsightTrack v2.

---

## Table of Contents

1. [Why we changed the architecture](#1-why-we-changed-the-architecture)
2. [Architecture overview](#2-architecture-overview)
3. [Data flow — end to end](#3-data-flow--end-to-end)
4. [Database design](#4-database-design)
5. [The sync worker](#5-the-sync-worker)
6. [Transparent union views](#6-transparent-union-views)
7. [Storage layout — Parquet cold partitions](#7-storage-layout--parquet-cold-partitions)
8. [Performance results](#8-performance-results)
9. [Configuration reference](#9-configuration-reference)
10. [API endpoints](#10-api-endpoints)
11. [How to run and test](#11-how-to-run-and-test)
12. [Reference and prior art](#12-reference-and-prior-art)

---

## 1. Why we changed the architecture

InsightTrack v1 synced every event from PostgreSQL into a single flat DuckDB table. This had problems as data grew:

| Problem | Impact |
|---------|--------|
| Single large DuckDB file | Startup sync slowed down linearly with history |
| All rows scanned for every query | 90-day queries scanned data unchanged for weeks |
| No historical partitioning | Impossible to archive old data without losing query capability |
| Re-sync on crash = full table rebuild | Recovery time grew with dataset size |

**v2 solution**: split data by age into a **hot tier** (DuckDB in-memory tables, last N days) and a **cold tier** (Parquet files on disk, older data). Transparent DuckDB VIEWs union the tiers — every existing query keeps working.

---

## 2. Architecture overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                    InsightTrack v2 — Data Flow                       │
├──────────────────────────────────────────────────────────────────────┤
│  Your Website                                                        │
│  ┌──────────┐  POST /api/track/*   ┌──────────────────────────────┐ │
│  │ tracking │ ──────────────────▶  │  Express API (port 3001)     │ │
│  │ script   │                      │  ┌──────────┐  ┌──────────┐ │ │
│  └──────────┘                      │  │PostgreSQL│  │  DuckDB  │ │ │
│                                    │  │ (writes) │  │ (reads)  │ │ │
│  Dashboard                         │  └────┬─────┘  └────▲─────┘ │ │
│  ┌──────────┐  GET /api/analytics/ │       │  Sync worker │       │ │
│  │ React SPA│ ◀────────────────────│       └──────────────┘       │ │
│  └──────────┘                      └──────────────────────────────┘ │
│                                                                      │
│  DuckDB tiers:                                                       │
│  ┌─────────────────────┐    ┌────────────────────────────────────┐  │
│  │  events_hot         │    │  data-lake/events/                 │  │
│  │  sessions_hot       │    │    site_id=X/event_date=Y/         │  │
│  │  (last HOT_DAYS)    │    │    part-0001.parquet               │  │
│  └──────────┬──────────┘    └────────────────┬───────────────────┘  │
│             └──────────┬─────────────────────┘                      │
│                        ▼                                             │
│              VIEW events  (UNION ALL)   ← all dashboard queries     │
│              VIEW sessions (UNION ALL)    use these views            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data flow — end to end

### Write path (unchanged from v1)

PostgreSQL is the **single source of truth for all writes**. DuckDB is never written from the tracking endpoint.

```
Browser → POST /api/track/event
        → Express validates + enriches (country, device, UTM)
        → INSERT into PostgreSQL events / sessions
        → HTTP 200 returned immediately
```

### Sync path (new in v2)

Runs every `SYNC_INTERVAL_MS` (default 5 min) and on demand via `/api/sync/full`:

```
1. Read watermark from DuckDB _sync_meta
   (last_event_id for events, last_synced for sessions)

2. Fetch new rows from PostgreSQL in batches of SYNC_BATCH_SIZE
   events:   WHERE id > last_event_id
   sessions: WHERE started_at > last_synced

3. Split by age (cutoff = NOW() - HOT_DAYS):
   recent rows  → INSERT into events_hot / sessions_hot
   older rows   → write to Parquet via DuckDB COPY TO

4. Advance watermark in _sync_meta (after successful write)

5. Evict rows older than HOT_DAYS from hot tables (already safe in Parquet)

6. refreshAnalyticsViews()
   → CREATE OR REPLACE VIEW events  = events_hot UNION ALL read_parquet(glob)
   → CREATE OR REPLACE VIEW sessions = sessions_hot UNION ALL read_parquet(glob)
```

### Read path (transparent to dashboard)

```
GET /api/analytics/:siteId/kpi?dateRange=90d
  → Check in-memory cache (10s–120s TTL)
  → DuckDB query: SELECT ... FROM events WHERE ...
     ↳ VIEW automatically scans events_hot (RAM) + Parquet files (disk)
  → Return JSON
```

---

## 4. Database design

### PostgreSQL additions

```sql
-- Deduplication key for idempotent re-sync
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_uuid UUID DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS events_uuid_idx ON events (event_uuid);

-- Pipeline state (audit + recovery)
CREATE TABLE IF NOT EXISTS sync_state (
  pipeline_name           TEXT PRIMARY KEY,
  last_event_id           BIGINT,
  last_updated_at         TIMESTAMPTZ,
  last_exported_partition DATE,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### DuckDB schema

```sql
-- Hot tables (frequently queried recent data)
CREATE TABLE IF NOT EXISTS events_hot (
  id BIGINT, site_id VARCHAR, user_id VARCHAR, session_id VARCHAR,
  type VARCHAR, url VARCHAR, path VARCHAR, referrer VARCHAR,
  device VARCHAR, country VARCHAR, timestamp TIMESTAMP,
  properties VARCHAR, utm_source VARCHAR, utm_medium VARCHAR,
  utm_campaign VARCHAR, event_uuid VARCHAR
);

CREATE TABLE IF NOT EXISTS sessions_hot (
  id VARCHAR PRIMARY KEY, site_id VARCHAR, user_id VARCHAR,
  started_at TIMESTAMP, ended_at TIMESTAMP, duration INTEGER,
  pageviews INTEGER, entry_page VARCHAR, exit_page VARCHAR,
  referrer VARCHAR, device VARCHAR, country VARCHAR, is_bounce BOOLEAN,
  utm_source VARCHAR, utm_medium VARCHAR, utm_campaign VARCHAR
);

-- Sync watermarks (observability)
CREATE TABLE IF NOT EXISTS _sync_meta (
  table_name    VARCHAR PRIMARY KEY,
  last_synced   TIMESTAMP,
  last_event_id BIGINT DEFAULT 0,
  rows_synced   BIGINT DEFAULT 0,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Transparent union views

```sql
-- When cold Parquet files exist:
CREATE OR REPLACE VIEW events AS
  SELECT * FROM events_hot
  UNION ALL
  SELECT * FROM read_parquet(
    'data-lake/events/site_id=*/event_date=*/part-0001.parquet',
    hive_partitioning = true
  );

-- Fallback (no cold files yet — fresh install):
CREATE OR REPLACE VIEW events AS SELECT * FROM events_hot;
```

---

## 5. The sync worker

**File**: `appsv2/analytics-api/src/sync/sync.js`

### Dual-watermark strategy

| Table | Watermark | Query |
|-------|-----------|-------|
| `events` | `last_event_id` (BIGINT) | `WHERE id > last_event_id` |
| `sessions` | `last_synced` (TIMESTAMP) | `WHERE started_at > last_synced` |

Events are append-only; the integer ID watermark guarantees no duplicates and no gaps. Sessions may close (get an `ended_at`) after initial insert, so the timestamp watermark re-syncs recently updated sessions.

### Hot/cold split

```js
const cutoff = new Date(Date.now() - HOT_DAYS * 86_400_000);
for (const row of pgRows) {
  if (row[tsColumn] >= cutoff) hotBatch.push(row);   // → events_hot
  else                         coldBatch.push(row);  // → Parquet
}
```

### Parquet write

```sql
COPY (SELECT * FROM staging_XXXXX)
TO 'data-lake/events/site_id=SITE/event_date=DATE/part-0001.parquet'
(FORMAT PARQUET);
```

---

## 6. Transparent union views

**File**: `appsv2/analytics-api/src/queries/queries.js` — `refreshAnalyticsViews()`

- Called on server startup and after every sync cycle
- Checks `data-lake/` for existing `.parquet` files
- If found: creates UNION ALL view (hot + cold)
- If not found: creates alias view (hot only — works on day one)

**No dashboard query was modified.** All `FROM events` / `FROM sessions` queries work via the view.

---

## 7. Storage layout — Parquet cold partitions

```
data-lake/
└── events/
    └── site_id=site_d0fa12f3/       ← Hive partition: site_id
        ├── event_date=2026-01-09/   ← Hive partition: event_date
        │   └── part-0001.parquet
        ├── event_date=2026-01-10/
        │   └── part-0001.parquet
        └── event_date=2026-03-31/
            └── part-0001.parquet
```

The `site_id=X/event_date=Y/` naming follows the **Hive partition convention** understood natively by DuckDB, Spark, Trino, and Athena:

- **Partition pruning** — only relevant `site_id=` directories are opened
- **Predicate pushdown** — only relevant `event_date=` folders are scanned per query
- **Engine-agnostic** — files can be queried by any tool without conversion

Observed stats: **90 cold days, 69 612 events → 182 Parquet files, ~3 MB compressed**.

---

## 8. Performance results

Tested on: Apple M1, Docker, 98 837 events + 39 669 sessions, 120-day window.

### Query latency

> **⚠️ Historical, internal measurements — not a reproducible benchmark.**
> The v1 configuration cannot be reconstructed from repository artifacts, the
> dataset and environment were not recorded, and the measurement boundary is
> unknown. Retained for context only. See
> [`PERFORMANCE_BENCHMARK_AUDIT.md`](./PERFORMANCE_BENCHMARK_AUDIT.md).

| Query | v1 flat DuckDB | v2 Hot+Cold | Ratio (as recorded) |
|-------|---------------|-------------|---------|
| KPI summary — 7 days | ~80 ms | **55 ms** | 1.5× |
| KPI summary — 30 days | ~210 ms | **64 ms** | 3.3× |
| KPI summary — 90 days | ~620 ms | **25 ms** | **25×** |
| Traffic chart — 30 days | ~180 ms | **24 ms** | 7.5× |
| Traffic chart — 90 days | ~490 ms | **44 ms** | **11×** |
| Top pages — 90 days | ~520 ms | **39 ms** | **13×** |

### Storage efficiency

| Store | Format | Size |
|-------|--------|------|
| PostgreSQL (write store) | Row | ~45 MB |
| DuckDB hot tables (30d) | Columnar | ~2 MB |
| Parquet cold store (90d) | Columnar compressed | ~3 MB |
| **Total analytics read store** | | **~5 MB** |

---

## 9. Configuration reference

| Variable | Default | Description |
|----------|---------|-------------|
| `HOT_DAYS` | `30` | Days to keep in DuckDB hot tables |
| `DUCKDB_PATH` | `duckdb/analytics.duckdb` | DuckDB file path |
| `SYNC_INTERVAL_MS` | `300000` | Sync worker interval (ms) |
| `SYNC_BATCH_SIZE` | `5000` | Max rows per PostgreSQL fetch per cycle |

Tuning: `HOT_DAYS=7` for minimal RAM · `HOT_DAYS=90` for 90d-heavy dashboards · `SYNC_BATCH_SIZE=10000` for high-traffic catch-up.

---

## 10. API endpoints

New in v2 (all require JWT auth):

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sync/full` | Full re-sync — rebuilds all hot tables from PostgreSQL |
| `POST` | `/api/sync/run` | Incremental sync — advances watermark only |
| `GET` | `/api/sync/status` | Returns watermarks from `_sync_meta` |

---

## 11. How to run and test

```bash
# Start v2 stack
docker-compose -f docker-compose.v2.yml up --build -d

# Seed 120 days of realistic data (~100k events)
docker exec traffic-backend-1 node scripts/seed-hotcold.js --days 120 --visitors 300

# Get a token and trigger full sync
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@insighttrack.dev","password":"Demo@2024!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

curl -X POST http://localhost:3001/api/sync/full -H "Authorization: Bearer $TOKEN"
curl      http://localhost:3001/api/sync/status  -H "Authorization: Bearer $TOKEN"

# Count Parquet files
docker exec traffic-backend-1 find /app/data-lake -name "*.parquet" | wc -l

# Demo credentials
# Email    : demo@insighttrack.dev
# Password : Demo@2024!
# Dashboard: http://localhost:4173
# Site ID  : site_d0fa12f3
```

### Run all tests

```bash
cd appsv2/analytics-api && npm test                                          # 26/26
cd appsv2/dashboard-web && npm test                                          # 55/55
PW_BASE_URL=http://localhost:4173 npx playwright test --project=chromium     # 31/31
```

---

## 12. Reference and prior art

| Pattern | Origin | How InsightTrack v2 uses it |
|---------|--------|-----------------------------|
| **Lambda Architecture** | Nathan Marz (2011) | Cold Parquet = batch; hot DuckDB = speed; union VIEW = serving |
| **Lakehouse Pattern** | Databricks (2020) | Parquet on disk + DuckDB as warehouse engine |
| **Hive partitioning** | Apache Hive | `site_id=X/event_date=Y/` for partition pruning |
| **High-watermark CDC** | Airbyte / Kafka Connect | `last_event_id` + `last_synced` watermarks |
| **DuckDB Parquet** | DuckDB docs | `read_parquet(glob, hive_partitioning=true)` |

- [DuckDB Parquet docs](https://duckdb.org/docs/data/parquet/overview)
- [DuckDB Hive partitioning](https://duckdb.org/docs/data/partitioning/hive_partitioning)
- [Lambda Architecture](https://en.wikipedia.org/wiki/Lambda_architecture)
- [Lakehouse paper — CIDR 2021](https://www.cidrdb.org/cidr2021/papers/cidr2021_paper17.pdf)

---

*For deployment, see [docs/deployment.md](deployment.md). For the REST API, see [docs/api-reference.md](api-reference.md).*
