# Caching in InsightTrack

This document explains how caching is handled across the InsightTrack analytics platform.

## Overview
InsightTrack uses a dual-database architecture and a combination of polling, in-memory, and database-level caching to balance real-time analytics with performance.

---

## 1. Frontend (`apps/dashboard-web`)
- **Polling:**
  - The React dashboard fetches analytics data from the API at a fixed interval (default: 60 seconds, configurable).
  - No explicit client-side cache; each poll requests fresh data from the backend.

---

## 2. API Backend (`apps/analytics-api`)
- **In-Memory Caching:**
  - May use in-memory caching (e.g., Node.js memory or libraries like `node-cache`) for short-term storage of computed analytics results (e.g., hot queries).
  - JWT tokens for authentication are cached in the client (browser) using localStorage/sessionStorage.

---

## 3. Analytics DB Layer (`apps/analytics-api`)
- **Database-Level Caching:**
  - All analytics reads are served from DuckDB, which acts as a fast OLAP cache for analytics queries.
  - Writes (tracking events, site management) go to PostgreSQL.
  - Data is periodically synced from PostgreSQL to DuckDB (interval/TTL configurable), so analytics queries always hit DuckDB for speed.
  - This sync interval acts as a cache refresh mechanism.

---

## 4. Tracking Script (demo sites)
- No caching; events are sent directly to the backend using `fetch`.

---

## Methods Used
- **Polling intervals** (frontend) to avoid over-fetching.
- **In-memory cache** (backend) for hot analytics data (if enabled).
- **Database-level cache** (DuckDB) for fast analytics reads, with periodic sync from PostgreSQL.

---

## Configuration
- **Polling interval:** Set in `apps/dashboard-web/src/hooks/useAnalytics.js` (default: 60s).
- **Sync interval:** Set in the unified backend sync scripts (see `apps/analytics-api/src/sync/`).
- **Cache libraries:** If used, they live under `apps/analytics-api/src/services/`.

---

## See Also
- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [docs/pg-duckdb-sync.md](pg-duckdb-sync.md)
- [docs/backend-architecture.md](backend-architecture.md)
