# Running InsightTrack — Complete Setup Guide

Step-by-step instructions to run the entire InsightTrack platform from scratch.

---

## Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Node.js | v18+ | `node --version` |
| npm | v9+ | `npm --version` |
| Docker | Any recent | `docker --version` |

---

## Quick Start (5 Minutes)

```bash
# 1. Start PostgreSQL
docker run -d --name analytics-pg \
  -e POSTGRES_USER=analytics \
  -e POSTGRES_PASSWORD=analytics123 \
  -e POSTGRES_DB=analytics_db \
  -p 5432:5432 \
  postgres:16-alpine

# Wait for PG to be ready
sleep 3 && docker exec analytics-pg pg_isready -U analytics

# 2. Setup & start the backend
cd apps/analytics-api
npm install
cp .env.example .env
npm run migrate          # Create PostgreSQL tables
npm run seed             # Generate ~130K sample data rows
npm run init             # Create DuckDB tables
npm run sync             # Copy PG data → DuckDB
npm start                # Start server on port 3001

# 3. In a new terminal — start the frontend
cd apps/dashboard-web
npm install
npm run dev              # Start dashboard on port 5173
```

Open **http://localhost:5173** → Register an account → Dashboard loads with sample data.

> **E2E tests**: once both backend and frontend are running, you can exercise the Playwright suite by running `npm run test:e2e` from `apps/dashboard-web`. The tests verify that the landing page and documentation page render correctly.

---

## Detailed Step-by-Step

### Step 1: Start PostgreSQL (Docker)

```bash
docker run -d \
  --name analytics-pg \
  -e POSTGRES_USER=analytics \
  -e POSTGRES_PASSWORD=analytics123 \
  -e POSTGRES_DB=analytics_db \
  -p 5432:5432 \
  postgres:16-alpine
```

Verify:
```bash
docker exec analytics-pg pg_isready -U analytics
# → /var/run/postgresql:5432 - accepting connections
```

### Step 2: Install Backend Dependencies

```bash
cd apps/analytics-api
npm install
```

This installs: express, pg, duckdb, cors, helmet, bcryptjs, jsonwebtoken, and other dependencies.

### Step 3: Configure Environment

```bash
cp .env.example .env
```

The defaults work out of the box for local development. Edit `.env` only if you changed the Docker credentials or ports.

Default configuration:
```env
PORT=3001
PG_HOST=localhost
PG_PORT=5432
PG_USER=analytics
PG_PASSWORD=analytics123
PG_DATABASE=analytics_db
DUCKDB_PATH=duckdb/analytics.duckdb
JWT_SECRET=insighttrack-secret-change-in-production
```

### Step 4: Create PostgreSQL Tables

```bash
npm run migrate
```

Expected output:
```
🔧 Running PostgreSQL migrations...

🔧 Initializing PostgreSQL database tables...
  ✓ sites
  ✓ events (7 indexes)
  ✓ sessions (3 indexes)
  ✓ funnels
  ✓ daily_stats
  ✓ users
✅ All PostgreSQL tables initialized

✅ Migrations completed successfully!
```

This creates 6 tables with optimized indexes for the event tracking workload.

### Step 5: Seed Sample Data

```bash
npm run seed
```

Expected output:
```
🌱 Seeding PostgreSQL with sample data...

🌱 Generating sample data for Demo Website...
📊 Processing day 91/91...
✅ Generated 72,534 events (Demo Website)
✅ Generated 25,534 sessions (Demo Website)

🌱 Generating sample data for TechPulse Blog...
📊 Blog: Processing day 61/61...
✅ Generated 20,016 events (TechPulse Blog)
✅ Generated 10,933 sessions (TechPulse Blog)

✅ Seeding completed successfully!
```

This creates two demo sites with realistic data:

| Site | Site ID | Days | Events | Sessions |
|------|---------|------|--------|----------|
| Demo Website | `site_demo` | 91 | ~72K | ~25K |
| TechPulse Blog | `site_blog` | 61 | ~20K | ~10K |

The data includes realistic distributions of pageviews, clicks, purchases, devices, countries, referrers, and UTM parameters.

### Step 6: Initialize DuckDB

```bash
npm run init
```

Expected output:
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

### Step 7: Sync Data to DuckDB

```bash
npm run sync
```

Expected output:
```
╔══════════════════════════════════════════════╗
║   InsightTrack · PostgreSQL → DuckDB Sync   ║
╚══════════════════════════════════════════════╝

① Ensuring DuckDB schema…
② Syncing tables…
  ✓  events: 92550 rows synced
  ✓  sessions: 36467 rows synced
  ✓  sites: 2 rows synced
  ✓  funnels: already up-to-date
  ✓  daily_stats: already up-to-date
  ✓  users: already up-to-date

✅ Sync complete — 129019 total rows synced.
```

### Step 8: Start the Backend Server

```bash
npm start
```

Expected output:
```
✅ PostgreSQL initialized

🚀 InsightTrack server running on http://localhost:3001
   Analytics queries powered by DuckDB
   Writes (tracking, auth, sites) → PostgreSQL
   Run "npm run sync" to sync PG → DuckDB
```

**Verify the server:**
```bash
# Health check
curl http://localhost:3001/api/health
# → {"status":"ok","timestamp":"...","uptime":5.2}

# Test KPI endpoint
curl 'http://localhost:3001/api/analytics/site_demo/kpi'
# → {"success":true,"data":{"totalVisitors":2840,...}}

# List sites
curl 'http://localhost:3001/api/sites'
# → {"success":true,"data":[{"id":"site_demo",...},{"id":"site_blog",...}]}
```

### Step 9: Start the Frontend Dashboard

Open a **new terminal**:

```bash
cd apps/dashboard-web
npm install
npm run dev
```

Expected output:
```
  VITE v5.4.21  ready in 129 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Step 10: Access the Dashboard

1. Open **http://localhost:5173** in your browser
2. Click **Register** to create an account
3. After registration, you'll see the dashboard with:
   - KPI cards (visitors, pageviews, bounce rate, avg session)
   - Traffic chart (area chart over time)
   - Top pages, sources, devices, countries
   - Session duration distribution
   - Conversion funnel

---

## Running Individual Components

### Backend Only

```bash
cd apps/analytics-api
npm start
# Or with auto-reload:
npm run dev
```

### Frontend Only (Requires Backend Running)

```bash
cd apps/dashboard-web
npm run dev
```

### Sync Only (Requires Server Stopped)

DuckDB only allows single-process access. Stop the server before syncing:

```bash
# Kill server
lsof -ti :3001 | xargs kill -9

# Sync
cd apps/analytics-api
npm run sync

# Restart server
npm start
```

### Demo Website

```bash
cd examples/demo-website
# Serve with any static file server:
npx serve .
# Or:
python3 -m http.server 8080
```

Then open http://localhost:8080 — the tracking script will send events to port 3001.

---

## Common Issues

### "ECONNREFUSED" When Running Migrate/Seed

**Cause:** PostgreSQL Docker container isn't running.

```bash
# Check if container exists
docker ps -a | grep analytics-pg

# Start it
docker start analytics-pg

# Or create a new one
docker run -d --name analytics-pg \
  -e POSTGRES_USER=analytics \
  -e POSTGRES_PASSWORD=analytics123 \
  -e POSTGRES_DB=analytics_db \
  -p 5432:5432 postgres:16-alpine
```

### "Port 3001 Already in Use"

```bash
# Find what's using it
lsof -ti :3001

# Kill it
lsof -ti :3001 | xargs kill -9
```

### DuckDB "Connection was never established"

**Cause:** Another process has the DuckDB file locked.

```bash
# Stop the backend server first
lsof -ti :3001 | xargs kill -9

# Then run your DuckDB operation
npm run sync   # or npm run init
```

### Frontend Shows "No Data" or Empty Charts

1. **Check VITE_SITE_ID** in `apps/dashboard-web/.env` — must match a seeded site ID (`site_demo` or `site_blog`)
2. **Check backend is running** — `curl http://localhost:3001/api/health`
3. **Check DuckDB has data** — run sync if needed: `npm run sync`

### "ERR_MODULE_NOT_FOUND" Errors

Make sure you're in the correct directory:
```bash
# Must run from apps/analytics-api/
cd apps/analytics-api
npm start      # ✅ Correct
```

---

## Reset Everything (Start Over)

```bash
# Stop all processes
lsof -ti :3001 | xargs kill -9 2>/dev/null
lsof -ti :5173 | xargs kill -9 2>/dev/null

# Remove Docker container and create fresh
docker rm -f analytics-pg
docker run -d --name analytics-pg \
  -e POSTGRES_USER=analytics \
  -e POSTGRES_PASSWORD=analytics123 \
  -e POSTGRES_DB=analytics_db \
  -p 5432:5432 postgres:16-alpine

sleep 3

# Reset backend
cd apps/analytics-api
rm -f duckdb/analytics.duckdb duckdb/analytics.duckdb.wal
npm run migrate
npm run seed
npm run init
npm run sync
npm start

# In new terminal: start frontend
cd apps/dashboard-web
npm run dev
```
