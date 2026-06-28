# InsightsTrack — Unified Backend

The single backend server for InsightsTrack, combining **Express.js**, **PostgreSQL** (writes), and **DuckDB** (analytics reads) in one process.

```
       Tracking/Auth/Sites               Analytics Charts
              │                                  │
              ▼                                  ▼
       ┌──────────────┐                  ┌──────────────┐
       │  PostgreSQL  │  ── sync.js ──▶  │   DuckDB     │
       │   (OLTP)     │   incremental    │   (OLAP)     │
       │  Port 5432   │                  │  analytics   │
       └──────────────┘                  │  .duckdb     │
                                         └──────────────┘
```

## Quick Start

```bash
# 1. Start PostgreSQL
docker run -d --name analytics-pg \
  -e POSTGRES_USER=analytics \
  -e POSTGRES_PASSWORD=analytics123 \
  -e POSTGRES_DB=analytics_db \
  -p 5432:5432 postgres:16-alpine

# 2. Setup
npm install
cp .env.example .env
npm run migrate    # Create PostgreSQL tables
npm run seed       # Generate ~130K sample rows
npm run init       # Create DuckDB tables
npm run sync       # Copy PG data → DuckDB

# 3. Start
npm start          # http://localhost:3001
```

## Architecture

| Concern | Database | Why |
|---------|----------|-----|
| Event tracking, sessions | PostgreSQL | Optimized for single-row writes |
| User auth, site CRUD | PostgreSQL | ACID transactions |
| Analytics queries (charts, KPIs) | DuckDB | 10-100x faster aggregations |

PostgreSQL is the **source of truth**. DuckDB is a **read-only columnar replica** rebuilt via incremental sync.

## API Routes

| Group | Prefix | Database | Endpoints |
|-------|--------|----------|-----------|
| Analytics | `/api/analytics/:siteId/*` | DuckDB | 17 GET endpoints (traffic, kpi, funnel, etc.) |
| Tracking | `/api/track/*` | PostgreSQL | 7 endpoints (event, pageview, session, batch, pixel) |
| Sites | `/api/sites/*` | PostgreSQL | 7 endpoints (CRUD + tracking script) |
| Auth | `/api/auth/*` | PostgreSQL | 4 endpoints (register, login, profile) |
| Health | `/api/health` | — | Server health check |

## Folder Structure

```
apps/analytics-api/
├── src/
│   ├── index.js            # Express server entry point
│   ├── db/
│   │   ├── postgres.js     # PG pool, schema, seed data
│   │   └── duckdb.js       # DuckDB singleton + query helpers
│   ├── routes/
│   │   ├── analytics.js    # 17 GET endpoints → DuckDB
│   │   ├── tracking.js     # 7 endpoints → PG writes
│   │   ├── sites.js        # 7 endpoints → PG CRUD
│   │   └── auth.js         # 4 endpoints → PG auth
│   ├── services/
│   │   ├── trackingService.js
│   │   ├── authService.js
│   │   ├── sitesService.js
│   │   └── cache.js        # In-memory TTL cache
│   ├── middleware/
│   │   └── auth.js         # JWT Bearer verification
│   ├── schema/
│   │   └── schema.js       # DuckDB CREATE TABLE + sync config
│   ├── sync/
│   │   └── sync.js         # Incremental PG → DuckDB sync
│   └── queries/
│       └── queries.js      # 21 DuckDB query functions
├── scripts/
│   ├── migrate.js          # Create PostgreSQL tables
│   ├── seed.js             # Generate sample data
│   ├── init.js             # Create DuckDB tables
│   └── aggregate.js        # Daily stats rollup
├── duckdb/
│   └── analytics.duckdb    # DuckDB database file
├── .env.example
└── package.json
```

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start server (port 3001) |
| `npm run dev` | Start with auto-reload |
| `npm run migrate` | Create PostgreSQL tables |
| `npm run seed` | Generate ~130K sample rows |
| `npm run init` | Create DuckDB tables |
| `npm run sync` | Sync PostgreSQL → DuckDB |
| `npm run aggregate` | Compute daily_stats rollups |
| `npm test` | Run test suite |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `PG_HOST` | `localhost` | PostgreSQL host |
| `PG_PORT` | `5432` | PostgreSQL port |
| `PG_USER` | `analytics` | PostgreSQL user |
| `PG_PASSWORD` | `analytics123` | PostgreSQL password |
| `PG_DATABASE` | `analytics_db` | PostgreSQL database |
| `DUCKDB_PATH` | `duckdb/analytics.duckdb` | DuckDB file path |
| `JWT_SECRET` | (built-in) | JWT signing secret |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed origins |

## Deploying to Railway (Monorepo)

This service lives inside a monorepo. Railway supports monorepos natively — you point it at a sub-directory and it builds only that service.

### 1. Create a Railway project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login
```

### 2. Add a PostgreSQL plugin

In the Railway dashboard → **New** → **Database** → **Add PostgreSQL**.  
Railway injects `DATABASE_URL` automatically. The app now reads `DATABASE_URL` first, falling back to individual `PG_*` variables for local development. No extra connection config is needed on Railway.

### 3. Configure the service root directory

In Railway dashboard → your service → **Settings** → **Root Directory**: set it to `apps/analytics-api`.

This tells Railway to run `npm install` and `npm start` from `apps/analytics-api/` instead of the repo root.

### 4. Set environment variables

In **Variables** tab, add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | (auto-injected by Railway PostgreSQL plugin — no manual config needed) |
| `JWT_SECRET` | a long random string |
| `CORS_ORIGINS` | `https://your-dashboard.pages.dev` |
| `NODE_ENV` | `production` |
| `DUCKDB_PATH` | `/data/analytics.duckdb` (see note below) |

> **DuckDB persistence**: Railway volumes are ephemeral by default. Attach a **Volume** (Railway dashboard → your service → **Volumes**) mounted at `/data` so the DuckDB file survives redeploys.

### 5. Set the start command

Railway auto-detects `npm start` from `package.json`. No extra config needed unless you want a custom command:

In **Settings** → **Deploy** → **Start Command**:
```
npm run migrate && npm run init && npm start
```
This runs PostgreSQL migrations (`migrate.js`) and DuckDB table creation (`init.js`) on every deploy before starting the server. Both scripts are idempotent — safe to run repeatedly.

> **Why run migrations on every deploy?** Railway containers are stateless. Running migrations at startup guarantees the schema is always in sync with the code, even after a fresh container spin-up or a rollback.

### 6. Deploy

```bash
# From the repo root
railway up --service analytics-api
```

Or simply push to your linked GitHub branch — Railway redeploys automatically.

### 7. Get the public URL

Railway assigns a URL like `https://<your-backend>.up.railway.app`.  
Use this as `VITE_API_URL` when deploying the dashboard to Cloudflare Pages (see next section).

---

## Deploying the Dashboard to Cloudflare Pages (Monorepo)

The `apps/dashboard-web` frontend is a Vite/React SPA deployed to Cloudflare Pages.

### 1. Connect the repo in Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Select this repository.

### 2. Configure the build

| Setting | Value |
|---------|-------|
| **Framework preset** | `Vite` |
| **Root directory** | `apps/dashboard-web` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |

> Setting **Root directory** to `apps/dashboard-web` scopes the build to only that sub-folder, which is required for monorepos.

### 3. Set environment variables

In Cloudflare Pages → your project → **Settings** → **Environment variables**:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://traffic.com` |

### 4. Deploy

Push to your production branch. Cloudflare Pages builds and deploys automatically.  
Preview deployments are created for every PR branch.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Docker Setup](../docs/docker-setup.md) | PostgreSQL container + DuckDB file management |
| [DuckDB Guide](../docs/duckdb-guide.md) | Columnar engine, sync mechanism, query catalog |
| [Backend Architecture](../docs/backend-architecture.md) | Route map, caching, security layers |
| [Running Locally](../docs/running-locally.md) | Step-by-step setup from scratch |
| [API Reference](../docs/api-reference.md) | Full REST API documentation |
| [Deployment](../docs/deployment.md) | Production deployment guide |

### Zero Network Overhead

DuckDB runs in-process — no TCP connection, no serialisation. Data goes directly
from the column store into your Node.js arrays.

## License

MIT
