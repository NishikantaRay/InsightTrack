# Claude Settings — InsightTrack

## Project Overview

InsightTrack is a self-hosted web analytics platform with a dual-database architecture:
- **PostgreSQL** for all WRITE operations (tracking, auth, sites)
- **DuckDB** for READ/analytics queries (10-100× faster OLAP)
- **React + Vite** dashboard frontend
- **Express** API backend
- **Docker** deployment with nginx reverse proxy

## Monorepo Structure

```
apps/dashboard-web/            → React 18 + Vite 5 frontend (port 4173)
apps/analytics-api/            → Unified backend (port 3001), PG writes + DuckDB reads
archive/analytics-api-legacy/  → Legacy API kept for reference and migration safety
examples/demo-blog/            → Demo site with embedded tracking script
examples/demo-website/         → Demo site with embedded tracking script
marketing/landing-page/        → Marketing landing page
design/pencil-new.pen          → Pencil design source
docs/                          → Project documentation
```

Grouped paths above are the canonical locations for development, testing, and deployment.

## Tech Stack

| Layer       | Stack                                                    |
|-------------|----------------------------------------------------------|
| Frontend    | React 18, Vite 5, Zustand, Tailwind CSS 3, Recharts     |
| Backend     | Node.js 20, Express 4, ES modules                       |
| Database    | PostgreSQL 16 (writes), DuckDB 1.1 (reads)              |
| Auth        | JWT (7-day), bcryptjs (12 rounds)                        |
| Security    | Helmet, CORS, express-rate-limit, parameterized queries  |
| Testing     | Vitest 4, Testing Library, Playwright 1.40               |
| Deployment  | Docker multi-stage, nginx, docker-compose                |

## Key Commands

```bash
# Development
cd apps/dashboard-web && npm run dev                 # Frontend dev server
cd apps/analytics-api && npm start                  # Unified backend
cd archive/analytics-api-legacy && npm start        # Legacy backend reference

# Testing
cd apps/dashboard-web && npm test                   # Vitest unit tests
cd apps/dashboard-web && npx playwright test        # E2E tests
cd apps/analytics-api && npm test                   # Backend tests
cd archive/analytics-api-legacy && npm test         # Legacy backend tests

# Database
cd apps/analytics-api && npm run migrate          # Create PG schema
cd apps/analytics-api && npm run seed             # Seed sample data
cd apps/analytics-api && npm run init             # Init DuckDB tables
cd apps/analytics-api && npm run sync -- --full   # Full PG→DuckDB sync

# Docker
docker-compose up --build                   # Full stack
docker-compose down -v                      # Teardown
```

## Environment Variables

```
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/analytics
JWT_SECRET=<secure-random>
CORS_ORIGINS=http://localhost:4173
DUCKDB_PATH=./duckdb/analytics.duckdb
SYNC_INTERVAL_MS=60000
NODE_ENV=development
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```
