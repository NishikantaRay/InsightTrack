# Backend Architecture

InsightTrack uses a **unified backend** (`apps/analytics-api/`) that combines Express.js, PostgreSQL, and DuckDB into a single server process.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     UNIFIED BACKEND (apps/analytics-api)                    │
│                          Port: 3001                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐     │
│   │                    Express.js Server                              │     │
│   │                                                                   │     │
│   │  Middleware: helmet → cors → rate-limit → json parser             │     │
│   │                                                                   │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │     │
│   │  │ /api/    │  │ /api/    │  │ /api/    │  │ /api/    │         │     │
│   │  │ track/*  │  │ auth/*   │  │ sites/*  │  │analytics │         │     │
│   │  │          │  │          │  │          │  │ /:siteId │         │     │
│   │  │ WRITES   │  │ WRITES   │  │ WRITES   │  │ READS    │         │     │
│   │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘         │     │
│   │       │              │              │              │               │     │
│   │       ▼              ▼              ▼              ▼               │     │
│   │  ┌─────────────────────────┐  ┌─────────────────────────┐        │     │
│   │  │    Service Layer        │  │    Query Layer           │        │     │
│   │  │                         │  │                          │        │     │
│   │  │  trackingService.js     │  │  queries.js              │        │     │
│   │  │  authService.js         │  │  (21 DuckDB queries)     │        │     │
│   │  │  sitesService.js        │  │                          │        │     │
│   │  │  cache.js               │  │  cache.js (TTL caching)  │        │     │
│   │  └────────┬────────────────┘  └────────┬─────────────────┘        │     │
│   │           │                             │                         │     │
│   └───────────┼─────────────────────────────┼─────────────────────────┘     │
│               │                             │                               │
│               ▼                             ▼                               │
│   ┌───────────────────────┐    ┌───────────────────────┐                   │
│   │    PostgreSQL          │    │    DuckDB              │                   │
│   │    (via pg Pool)       │    │    (embedded, in-proc) │                   │
│   │                        │    │                        │                   │
│   │  ✏️  Events INSERT     │    │  📊 Traffic over time  │                   │
│   │  ✏️  Sessions UPSERT   │    │  📊 KPI summaries      │                   │
│   │  ✏️  User CRUD         │───▶│  📊 Funnels            │                   │
│   │  ✏️  Site CRUD         │sync│  📊 Device breakdown   │                   │
│   │                        │    │  📊 Retention cohorts  │                   │
│   │  Port 5432 (Docker)    │    │  File: analytics.duckdb│                   │
│   └────────────────────────┘    └────────────────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Design Principles

### 1. Write-Read Separation

All **write operations** (event tracking, session management, user auth, site CRUD) go to PostgreSQL. All **read operations** (analytics charts, KPIs, funnels) query DuckDB.

This means:
- Incoming events never slow down dashboard queries
- Heavy analytical aggregations don't impact tracking endpoint latency
- Each database is optimised for its workload

### 2. Single Process, Dual Database

Both PostgreSQL (via `pg` connection pool) and DuckDB (embedded, in-process) are accessed from the same Node.js process. No inter-service communication, no message queues, no microservice overhead.

### 3. PostgreSQL as Source of Truth

PostgreSQL holds the canonical data. DuckDB is a derived read replica that can be rebuilt from scratch at any time using `npm run sync`.

---

## Directory Structure

```
apps/analytics-api/
├── src/
│   ├── index.js                  ← Express server entry point
│   │
│   ├── db/
│   │   ├── postgres.js           ← PG pool, schema, seed data, query helper
│   │   └── duckdb.js             ← DuckDB singleton, duckRun/duckAll helpers
│   │
│   ├── routes/
│   │   ├── analytics.js          ← 17 GET endpoints → DuckDB queries
│   │   ├── tracking.js           ← 7 endpoints → PG writes
│   │   ├── sites.js              ← 7 endpoints → PG CRUD
│   │   └── auth.js               ← 4 endpoints → PG auth
│   │
│   ├── services/
│   │   ├── trackingService.js    ← Event validation + PG insertion
│   │   ├── authService.js        ← bcrypt + JWT (register, login, profile)
│   │   ├── sitesService.js       ← Site CRUD + tracking script generation
│   │   └── cache.js              ← In-memory TTL cache for analytics
│   │
│   ├── middleware/
│   │   └── auth.js               ← JWT Bearer token verification
│   │
│   ├── schema/
│   │   └── schema.js             ← DuckDB CREATE TABLE + sync config
│   │
│   ├── sync/
│   │   └── sync.js               ← Incremental PG → DuckDB sync
│   │
│   └── queries/
│       └── queries.js            ← 21 analytical DuckDB queries
│
├── scripts/
│   ├── migrate.js                ← Create PostgreSQL tables
│   ├── seed.js                   ← Generate sample data in PG
│   ├── init.js                   ← Create DuckDB tables
│   └── aggregate.js              ← Daily stats rollup
│
├── duckdb/
│   └── analytics.duckdb          ← DuckDB database file
│
├── .env                          ← Environment configuration
├── .env.example                  ← Template with defaults
└── package.json                  ← Scripts: start, dev, init, sync, seed, migrate
```

---

## Route Map

### Tracking Routes (`/api/track/*`) → PostgreSQL

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | `/event` | `trackingService.trackEvent()` | Track any event type |
| POST | `/pageview` | `trackingService.trackEvent()` | Track a pageview (shortcut) |
| POST | `/session` | `trackingService.upsertSession()` | Create/update session |
| POST | `/session/end` | `trackingService.endSession()` | End a session |
| POST | `/batch` | `trackingService.trackBatch()` | Batch event ingestion |
| GET | `/pixel.gif` | `trackingService.trackEvent()` | 1×1 pixel tracking (email/no-JS) |
| POST | `/` | `trackingService.trackEvent()` | Generic tracking endpoint |

### Auth Routes (`/api/auth/*`) → PostgreSQL

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | `/register` | `authService.register()` | Create account (bcrypt + JWT) |
| POST | `/login` | `authService.login()` | Authenticate (returns JWT) |
| GET | `/me` | `authService.getProfile()` | Get current user (requires JWT) |
| PUT | `/me` | `authService.updateProfile()` | Update profile (requires JWT) |

### Sites Routes (`/api/sites/*`) → PostgreSQL

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/` | `sitesService.getAllSites()` | List all sites |
| POST | `/` | `sitesService.createSite()` | Create a new site |
| GET | `/:siteId` | `sitesService.getSiteById()` | Get site details |
| PUT | `/:siteId` | `sitesService.updateSite()` | Update site config |
| DELETE | `/:siteId` | `sitesService.deleteSite()` | Delete a site |
| GET | `/:siteId/script` | `sitesService.getTrackingScript()` | Raw JS tracking script |
| GET | `/:siteId/snippet` | `sitesService.getRawTrackingScript()` | HTML snippet |

### Analytics Routes (`/api/analytics/*`) → DuckDB

| Method | Path | Query Function | Cached | TTL |
|--------|------|---------------|--------|-----|
| GET | `/:siteId/kpi` | `getKPISummary()` | Yes | 30s |
| GET | `/:siteId/traffic` | `getTrafficOverTime()` | Yes | 60s |
| GET | `/:siteId/bounce-rate-trend` | `getBounceRateOverTime()` | No | — |
| GET | `/:siteId/avg-session-trend` | `getAvgSessionOverTime()` | No | — |
| GET | `/:siteId/pageviews` | `getPageViewsOverTime()` | No | — |
| GET | `/:siteId/top-pages` | `getTopPages()` | No | — |
| GET | `/:siteId/sources` | `getTrafficSources()` | Yes | 120s |
| GET | `/:siteId/devices` | `getDeviceBreakdown()` | No | — |
| GET | `/:siteId/countries` | `getCountries()` | No | — |
| GET | `/:siteId/sessions` | `getSessionDuration()` | No | — |
| GET | `/:siteId/funnel` | `getFunnelData()` | No | — |
| GET | `/:siteId/realtime` | `getRealTimeVisitors()` | Yes | 10s |
| GET | `/:siteId/utm` | `getUTMCampaigns()` | No | — |
| GET | `/:siteId/comparison` | `getComparisonTraffic()` | Yes | 60s |
| GET | `/:siteId/user-flow` | `getUserFlow()` | No | — |
| GET | `/:siteId/alerts` | `getAlerts()` | No | — |
| GET | `/:siteId/all` | All 10 queries in parallel | No | — |

---

## Caching Layer

Analytics responses are cached in memory to reduce DuckDB query load:

```javascript
// src/services/cache.js
export const CACHE_TTL = {
    REALTIME: 10,     // 10 seconds (near real-time)
    KPI:     30,      // 30 seconds (key metrics)
    TRAFFIC: 60,      // 60 seconds (chart data)
    PAGES:   60,      // 60 seconds (page analytics)
    GENERAL: 120,     // 2 minutes (sources, countries)
};
```

Cache keys are structured as `{endpoint}:{siteId}:{dateRange}`:
```
kpi:site_demo:30d
traffic:site_demo:7d
realtime:site_demo
```

The cache is an in-memory `Map` with automatic TTL expiration — no Redis required.

---

## Security Layers

```
Request → helmet (HTTP headers)
        → CORS (origin whitelist)
        → Rate Limiter (100 req/min per IP)
        → JSON parser (1MB limit)
        → Route handler
        → JWT verification (for protected routes)
        → Service layer (input validation)
        → Database query
```

| Layer | Technology | Purpose |
|-------|-----------|---------|
| HTTP Headers | `helmet` | XSS protection, HSTS, no-sniff, frame-guard |
| CORS | `cors` | Only allow configured origins |
| Rate Limiting | `express-rate-limit` | 100 req/min per IP (configurable) |
| Body Limit | `express.json` | 1MB max request body |
| Authentication | JWT (Bearer token) | 7-day expiry, bcrypt-12 passwords |
| Input Validation | Service layer | Type checking, field sanitization |

---

## Environment Variables

```env
# Server
PORT=3001                          # Express server port
NODE_ENV=development               # development | production

# PostgreSQL  
PG_HOST=localhost                   # Docker host
PG_PORT=5432                        # PostgreSQL port
PG_USER=analytics                   # Database user
PG_PASSWORD=analytics123            # Database password
PG_DATABASE=analytics_db            # Database name

# DuckDB
DUCKDB_PATH=duckdb/analytics.duckdb # Relative to apps/analytics-api/

# Sync
SYNC_BATCH_SIZE=5000                # Rows per batch during PG → DuckDB sync

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:8080

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000          # 1 minute window
RATE_LIMIT_MAX_REQUESTS=100         # Max requests per window per IP

# JWT
JWT_SECRET=insighttrack-secret-change-in-production
JWT_EXPIRES_IN=7d                   # Token expiry
```

---

## Graceful Shutdown

The server handles `SIGINT` and `SIGTERM` for clean shutdown:

```
Signal received (Ctrl+C or kill)
    │
    ├── Close DuckDB connection
    ├── Close PostgreSQL pool
    └── Exit process
```

This ensures no in-flight queries are interrupted and all connections are properly released.

---

## npm Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `npm start` | `node src/index.js` | Start the production server |
| `npm run dev` | `node --watch src/index.js` | Start with auto-reload on file changes |
| `npm run migrate` | `node scripts/migrate.js` | Create PostgreSQL tables |
| `npm run seed` | `node scripts/seed.js` | Generate sample data in PostgreSQL |
| `npm run init` | `node scripts/init.js` | Create DuckDB tables |
| `npm run sync` | `node src/sync/sync.js` | Sync PostgreSQL → DuckDB |
| `npm run aggregate` | `node scripts/aggregate.js` | Compute daily_stats rollups |
| `npm run queries` | `node src/queries/queries.js` | Run demo queries (CLI) |
| `npm test` | `vitest run` | Run test suite |
| `npm run test:watch` | `vitest` | Run tests in watch mode |
