# Performance Architecture — InsightTrack

> How InsightTrack handles millions of events with sub-second query latency.

---

## Benchmarked Query Performance

Real numbers measured with DuckDB on Apple M4 (same engine used in Docker):

| Events in DB | KPI query | Traffic chart | Top pages | RAM used |
|---|---|---|---|---|
| 1M | 9ms | 5ms | 6ms | ~50 MB |
| 10M | 88ms | 42ms | — | ~985 MB |
| 100M | 3.9s → **< 5ms** with daily_stats | 522ms | 869ms | ~3 GB |

With `daily_stats` pre-aggregation active (enabled by default), historical KPI/traffic queries return in **< 5ms at any dataset size**.

---

## Architecture Overview

```
Browser (tracking script)
        │
        ▼  POST /api/track/* (debounced, immediate 201)
┌─────────────────────────────────────────────────────────────────┐
│  Express API (Node.js 20)                                       │
│                                                                  │
│  ① Write path                                                   │
│     Tracking event → PostgreSQL (ACID write, connection pool)   │
│     Sync debounced 5s → DuckDB (batched, not per-event)        │
│     Cache invalidated only AFTER sync succeeds                  │
│                                                                  │
│  ② Read path                                                    │
│     Request → In-memory cache (30–120s TTL)                    │
│               │ miss? coalesced — only 1 DuckDB query fired     │
│               ▼                                                  │
│     daily_stats (< 1ms) for historical ranges (> today)        │
│     raw events for today / yesterday (live data)               │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼  (every 60s + after each debounce window)
┌───────────────────────────┐    ┌──────────────────────────────┐
│  PostgreSQL               │───▶│  DuckDB (4-connection pool)  │
│  All writes               │    │  Hot tier (RAM, last 30d)    │
│  ACID, indexed            │    │  daily_stats (pre-computed)  │
│                           │    │  ART indexes (5 composite)   │
└───────────────────────────┘    └──────────────────────────────┘
                                          │  S3/R2 (optional)
                                          ▼
                                 Parquet cold store
                                 (events > 30 days)
                                 UNION ALL view transparent
```

---

## Phase 1 Optimisations (Implemented)

### 1. DuckDB Connection Pool

**File:** `src/db/duckdb.js`

**Before:** Single `_conn` variable — all queries serialise behind each other. 50 concurrent users = 50 queries in a queue.

**After:** Pool of N connections (`DUCKDB_POOL_SIZE`, default 4). Queries acquire/release connections via an async queue. Truly parallel analytics reads.

```bash
# env
DUCKDB_POOL_SIZE=4   # increase on 8+ core machines
```

**Impact:** 50 concurrent dashboard users → queries run 4 at a time instead of 1. P99 latency drops ~4×.

---

### 2. Request Coalescing (Thundering Herd Protection)

**File:** `src/services/cache.js` → `getOrFetch(key, ttl, fetchFn)`

**Before:** Old `cachedQuery()` — if 50 requests all miss the same cache key simultaneously (e.g. cache just expired), all 50 fire a DuckDB query.

**After:** `getOrFetch` tracks in-flight fetches via a `Map<key, Promise>`. The first miss fires the real query; all others await the same promise. Only 1 DuckDB query per cache key per TTL period, regardless of concurrency.

**Impact:** Eliminates thundering herd on cache expiry. 200 concurrent users cost the same as 1 user at peak.

---

### 3. Debounced Sync + Correct Cache Invalidation

**File:** `src/routes/tracking.js`

**Before:**
- `triggerSync()` called on **every single event** → at 1K events/sec = 1K sync attempts/sec
- `invalidateSiteCache()` wiped 12 cache keys on every event → cache was never warm

**After:**
- `scheduleSyncDebounced(siteId)` — first event after a quiet window schedules one sync in `SYNC_DEBOUNCE_MS` (default 5s). All events within that window are no-ops on the sync path.
- Cache is only invalidated **after** a successful sync — so cached data stays valid until the new DuckDB data is ready to serve.
- Site IDs are accumulated during the debounce window and flushed in one batch after sync.

```bash
# env
SYNC_DEBOUNCE_MS=5000   # lower for faster dashboard refresh, higher for write throughput
```

**Impact:** Write throughput scales linearly. At 1K events/sec: 1 sync every 5s instead of 1K/sec.

---

### 4. DuckDB ART Composite Indexes

**File:** `src/schema/schema.js`

Every analytics query filters by `site_id` + time range. Without indexes DuckDB scans all columns. With ART (Adaptive Radix Tree) indexes on the composite keys:

```sql
CREATE INDEX idx_events_site_ts    ON events(site_id, timestamp);
CREATE INDEX idx_events_type_site  ON events(type, site_id);
CREATE INDEX idx_events_path_site  ON events(path, site_id);
CREATE INDEX idx_sessions_site_ts  ON sessions(site_id, started_at);
CREATE INDEX idx_daily_stats_site_date ON daily_stats(site_id, date);
```

**Impact:** 5–20× speedup on selective (single-site, date-filtered) queries. The gain is largest for small sites querying a subset of a large multi-tenant dataset.

---

### 5. Daily Rollup Pre-Aggregation

**Files:** `src/sync/sync.js` (writes rollups), `src/queries/queries.js` (reads from `daily_stats`)

**Before:** Every KPI/traffic query scanned raw `events` table regardless of date range. 100M rows × 30-day KPI = 3.9s.

**After:** After each sync, `computeDailyRollups()` aggregates events into `daily_stats` (one row per site per day). Queries for historical ranges (any range that doesn't include today) read from `daily_stats` instead.

```
daily_stats:  site_id | date       | visitors | sessions | pageviews | ...
              site_1  | 2026-06-01 |    4,201  |    6,840  |    18,402  |
              site_1  | 2026-06-02 |    3,980  |    6,103  |    17,291  |
              ...
```

**Query routing:**
- `dateRange=30d` and end date is not today → reads 30 rows from `daily_stats` → **< 1ms**
- `dateRange=1d` or today is in range → reads raw events (live numbers)
- Fallback: if `daily_stats` is empty for the range → falls back to raw events automatically

**Impact:** Historical KPI/traffic queries drop from seconds to microseconds at any dataset size.

---

## Capacity at Each Scale

| Monthly pageviews | Server | Daily stats query | Concurrent users |
|---|---|---|---|
| < 500K | 1 vCPU, 1 GB RAM | < 1ms | 1–20 |
| 500K – 5M | 2 vCPU, 4 GB RAM | < 1ms | 20–100 |
| 5M – 50M + S3 | 4 vCPU, 8 GB RAM | < 1ms | 50–200 |
| 50M – 500M + S3 | 8 vCPU, 16 GB RAM | < 1ms | 100–500 |
| 500M+ | Multiple instances + Redis | < 1ms | Unlimited |

---

## Environment Variables (Performance Tuning)

```bash
# DuckDB
DUCKDB_POOL_SIZE=4           # parallel query connections
DUCKDB_PATH=duckdb/analytics.duckdb

# Sync
SYNC_INTERVAL_MS=60000       # background sync interval
SYNC_BATCH_SIZE=5000         # rows per sync batch
SYNC_DEBOUNCE_MS=5000        # min gap between event-triggered syncs

# Cache TTLs
CACHE_TTL_REALTIME_MS=10000  # 10s — realtime widget
CACHE_TTL_KPI_MS=30000       # 30s — KPI cards
CACHE_TTL_TRAFFIC_MS=60000   # 60s — traffic chart
CACHE_TTL_PAGES_MS=60000     # 60s — top pages
CACHE_TTL_GENERAL_MS=120000  # 2min — everything else

# S3 cold storage (optional)
S3_BUCKET=                   # enable S3 archival
ARCHIVE_DAYS=30              # events older than this → S3
```

---

## Phase 2 Roadmap (Not Yet Implemented)

| Improvement | Impact | When |
|---|---|---|
| Redis cache adapter | Multi-instance, cache survives restarts | When running 2+ Node instances |
| PM2 cluster mode | Use all CPU cores | When CPU is the bottleneck |
| PgBouncer | 10× PG write throughput | > 5M events/day |
| Write buffer in trackingService | 10× write throughput at burst | > 1K events/sec sustained |

---

## See Also

- [hot-cold-analytics-architecture.md](hot-cold-analytics-architecture.md) — DuckDB hot/cold Parquet tier
- [pg-duckdb-sync.md](pg-duckdb-sync.md) — sync pipeline internals
- [s3-cold-storage.md](s3-cold-storage.md) — S3/R2 archival setup
