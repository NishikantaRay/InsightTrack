# InsightTrack — Development Workflows

## 1. Environment bootstrap (once per machine)

```bash
# PostgreSQL 16 in Docker
docker run -d --name analytics-pg \
  -e POSTGRES_USER=analytics -e POSTGRES_PASSWORD=analytics123 \
  -e POSTGRES_DB=analytics_db -p 5432:5432 postgres:16

# Backend (traffic: analytics-db | traffic2: apps/analytics-api)
cd analytics-db && npm install
npm run migrate && npm run seed && npm run init   # PG schema, sample data, DuckDB
npm run dev                                        # port 3001, starts sync loop

# Frontend (traffic: analytics-dashboard | traffic2: apps/dashboard-web)
cd analytics-dashboard && npm install && npm run dev   # Vite, port 5173 dev / 4173 preview
```

Full stack alternative: `docker-compose up --build` from the repo root.
Details: `docs/getting-started.md`, `docs/running-locally.md`,
`docs/docker-setup.md`.

## 2. Feature development checklist

1. **Locate the layer(s)**: analytics read → `queries.js` + `routes/analytics.js`;
   domain write → service + route; UI → page/component + `api.js` entry.
2. **Implement** following `references/patterns.md` shapes.
3. **Guard the invariants**: parameterized SQL, auth middleware chain,
   PG-writes/DuckDB-reads split, dark-mode classes, `useAnalytics` for data.
4. **Test**: unit tests next to the layer you touched (backend `tests/`,
   frontend `src/__tests__/`); Playwright only for new user-facing flows.
5. **Run the suites** from each touched package: `npm test`
   (backend tests need PG up), `npx playwright test` if e2e affected.
6. **Update docs**: the matching `docs/<feature>.md` (create one for
   significant new features). This is a hard project rule.
7. **Sync the three copies** (section 4 below).
8. Commit only when asked; never commit `dist/`, `duckdb/*.duckdb`,
   `data-lake/`, `.env*` (except `*.example`).

## 3. Debugging quick paths

- **Dashboard shows stale/no data** → check the sync loop: backend logs
  (`Periodic sync failed`), then `POST /api/sync?full=true`, then
  `npm run sync -- --full`. DuckDB is disposable — full re-sync fixes drift.
- **401s in dashboard** → JWT expired (7 d) or `JWT_SECRET` changed; the
  axios interceptor auto-logs-out. Check `localStorage['analytics-token']`.
- **CORS errors** → origin missing from `CORS_ORIGINS` (privateCors). Tracking
  endpoints use publicCors and should never CORS-fail.
- **DuckDB "database is locked"** → a second process opened the file (e.g., a
  stray CLI). Only the API process may open it.
- **Rate-limit 429 during dev** → raise `RATE_LIMIT_MAX_REQUESTS` in `.env`.
- **Tests failing on leftover rows** → they must use `site_test%` ids so
  `cleanTestDB()` catches them.
- **Tracking not working on a demo site** → is `tracker.js` loading (Network
  tab)? `data-site-id` correct? Does `POST /api/track/event` return 200?
  Then confirm the row landed in PG before blaming the sync.

Hands-on probes:

```bash
# Poke the API directly
curl -s localhost:3001/api/health
curl -s -X POST localhost:3001/api/track/event -H 'Content-Type: application/json' \
  -d '{"siteId":"site_test1","type":"pageview","path":"/"}'
curl -s -X POST localhost:3001/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"…"}'          # → { token }

# Inspect the databases
docker exec -it <pg-container> psql -U analytics -d analytics_db \
  -c "SELECT COUNT(*), MAX(timestamp) FROM events"
# DuckDB: do NOT open the .duckdb file while the API is running (single writer);
# query through the API or the SQL Editor instead.

# Docker triage
docker-compose ps && docker-compose logs -f <service>
docker-compose logs <backend> 2>&1 | grep -iE "error|fail|sync"
lsof -i :3001 -i :4173 -i :5432        # port conflicts
```

Remember: the Docker backend bakes source into the image — schema/route
changes need `docker compose build <backend>`, not just a restart.

## 4. Three-copy sync procedure (mandatory after every feature)

Copies: `traffic/` (root layout), `traffic2/apps/`, `traffic2/appsv2/`.
Mapping: `analytics-dashboard ⇄ dashboard-web`, `analytics-db ⇄
analytics-api`; `mcp-server`, `mcp-toolkit-core`, `docs` map by name.

```bash
# Set these to wherever the copies live on your machine. `traffic` is a
# separate private repository, not part of this checkout.
T=${TRAFFIC_REPO:?set TRAFFIC_REPO to the traffic/ checkout}
T2=${INSIGHTTRACK_REPO:-$(git rev-parse --show-toplevel)}

# 1. Verify current drift (expect: only files you just changed)
diff -rq $T/analytics-db/src        $T2/apps/analytics-api/src
diff -rq $T2/apps/analytics-api/src $T2/appsv2/analytics-api/src   # appsv2 also has routes/sync.js
diff -rq $T/analytics-dashboard/src $T2/apps/dashboard-web/src

# 2. Copy changed files (per file — do NOT rsync whole trees blindly;
#    appsv2 legitimately differs: routes/sync.js, data-lake/, passmark-tests/)
cp $T/analytics-db/src/routes/foo.js $T2/apps/analytics-api/src/routes/foo.js
cp $T/analytics-db/src/routes/foo.js $T2/appsv2/analytics-api/src/routes/foo.js

# 3. Re-run the diffs, then run tests in each copy you touched
```

Known intentional differences — never "fix" these: `appsv2` extras
(`routes/sync.js`, `data-lake*/`, `scripts/seed-hotcold.js`,
`passmark-tests/`, and its backend Dockerfile's extra `data-lake` mkdir),
package `name` fields and path-naming header comments (e.g.
`tests/testHelper.js` line 2, Dockerfile line 1), each repo's `CLAUDE.md`
package-structure section, and docs that exist in only one repo (e.g.
`alerts.md` in traffic; `blogs/`, `hot-cold-analytics-architecture.md` in
traffic2). The entire `.claude/` directory is identical in both repos — the
skill describes all layouts.

Everything else must match. Full sweep (expect only the items above):

```bash
diff -rq $T/analytics-db/src   $T2/apps/analytics-api/src
diff -rq $T/analytics-db/tests $T2/apps/analytics-api/tests
diff -rq $T/analytics-dashboard/src $T2/apps/dashboard-web/src
diff -rq $T/analytics-dashboard/e2e $T2/apps/dashboard-web/e2e
diff -rq $T/mcp-server/src $T2/apps/mcp-server/src
# …and each of those again for apps vs appsv2
```

## 5. Code review / security review

Full checklists, threat model, PR risk/impact tables, and report formats:
[review-security.md](review-security.md). The instant-reject items:

- Any SQL built with template literals or concatenation.
- New route without `authMiddleware` (or missing
  `validateSiteId`/`authorizeSiteAccess` on site-scoped data), unless
  it's tracking/auth/health/share-by-token.
- Missing role checks on mutations (owner/admin).
- Client-facing errors not built via `safeMsg`/`sendError`.
- DuckDB write outside `sync.js`/`storage/s3.js`.
- Secrets outside env/`secretBox`, or logged.

## 6. Keeping the skill current

When architecture or conventions change (new package, new store pattern, new
invariant), update `.claude/skills/insighttrack/` in the same PR — SKILL.md
for rules/layout, `references/*` for details — and mirror to both repos.
Treat a stale skill as a bug: it misleads every future session.
