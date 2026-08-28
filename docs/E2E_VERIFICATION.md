# Live End-to-End Verification

**Date:** 2026-08-28
**Canonical copy tested:** `apps/` (`apps/analytics-api` + `apps/dashboard-web`)
**Type:** Verification only. No application code, tests, or configuration was modified.

This exercises the flow the reproducibility audit ([REPRODUCIBILITY_AUDIT.md](./REPRODUCIBILITY_AUDIT.md)) explicitly could **not** verify: a real user registering, creating a site, the real generated tracking script firing real requests, and that data flowing through PostgreSQL → DuckDB → dashboard → SQL Editor.

**Every PASS below was exercised against the running system.** No step is marked PASS on the basis of reading code.

---

## Summary

| # | Step | Result |
|---|---|---|
| 1 | Start the stack | **PASS** |
| 2 | Register / log in a test user | **PASS** |
| 3 | Create a test site | **PASS** |
| 4 | Send a real tracking event | **PASS** |
| 5 | Verify PostgreSQL | **PASS** |
| 6 | Verify PG → DuckDB sync | **PASS** |
| 7 | Verify dashboard analytics | **PASS** |
| 8 | Verify SQL Editor | **PASS** |
| 8b | Cross-site isolation | **PASS** |
| 9 | Pulse (LLM chat) | **NOT VERIFIED** — no provider key configured |
| 9b | MCP tool path (Pulse's read path) | **PASS** |
| — | DNT opt-out (bonus) | **PASS** |

**The full analytics path works end to end.** No bugs were discovered in application behaviour.

---

## Environment

| Item | Value |
|---|---|
| Platform | macOS (darwin 25.5.0), Node.js v22.19.0 |
| PostgreSQL | `postgres:16-alpine` in Docker, **throwaway**, host port 55601 |
| DuckDB | isolated file `duckdb/e2e-verify.duckdb` |
| API | `apps/analytics-api`, port **3099** |
| Dashboard | `apps/dashboard-web` (Vite), port **5199** |
| Credentials | throwaway only — test user `e2e-tester@test.example.com`, disposable password |

**Isolation:** a dedicated container, database, port set, and DuckDB file were used throughout. No existing analytics data, no personal database, and no default ports (5432 / 3001 / 5173) were touched.

---

## 1. Start the stack — PASS

Followed `docs/running-locally.md` (the authoritative manual procedure, now linked from the README).

```bash
docker run -d --name e2e-pg -e POSTGRES_USER=… -p 55601:5432 postgres:16-alpine
cd apps/analytics-api && npm run migrate && npm run init && npm start
cd apps/dashboard-web && npx vite --port 5199
```

| Check | Result |
|---|---|
| PostgreSQL reachable | ✅ `pg_isready` after **2s** |
| `npm run migrate` | ✅ "All PostgreSQL tables initialized" |
| `npm run init` | ✅ "DuckDB ready" |
| API startup | ✅ listening on 3099; initial sync completed ("0 total rows synced" on an empty DB) |
| Dashboard | ✅ HTTP 200, Vite ready in 124ms |
| Startup errors / warnings | **none** |

One incidental finding: port 55555 was already in use on this machine, so 55601 was selected. Not a project issue.

---

## 2. Register / log in — PASS

Performed through the real API, not by inserting rows.

| Check | Result |
|---|---|
| `POST /api/auth/register` | ✅ `success: true`, user id 1, JWT returned (208 chars) |
| `POST /api/auth/login` (independent) | ✅ `success: true`, token returned |
| `GET /api/auth/me` with token | ✅ returns the correct user |
| `GET /api/auth/me` without token | ✅ **HTTP 401** |

Note: `/api/auth/profile` returns 404 — the route is `/api/auth/me`. This was an error in the verification approach, not an application defect.

---

## 3. Create a test site — PASS

| Site | ID | Domain | Owner |
|---|---|---|---|
| A | `site_d3be2960` | e2e-a.test.example.com | user 1 ✅ |
| B | `site_c894a480` | e2e-b.test.example.com | user 1 ✅ |

Ownership confirmed by joining `sites` to `users` in PostgreSQL.

---

## 4. Send a real tracking event — PASS

The **actual generated tracking script** was fetched from the running server and executed in a browser-like sandbox with **real network calls**. No rows were fabricated.

```
GET /api/sites/site_d3be2960/script
  → HTTP 200, 27 032 bytes, content-type: application/javascript
  → embeds the correct siteId and the DNT/GPC opt-out guard
```

On execution the script:

| Observation | Result |
|---|---|
| Requests issued | 2 — `POST /api/track/event`, `POST /api/track/session` |
| localStorage written | `_analytics_uid` |
| sessionStorage written | `_analytics_sid`, `_analytics_pageviews`, `_analytics_session_active`, `_analytics_entry_page` |

The same was repeated for Site B with a distinct page (`/B-SECRET-PAGE`) to give the isolation test a detectable target.

---

## 5. Verify PostgreSQL — PASS

Queried the database directly:

```
events:
  site_d3be2960 | pageview | /pricing       | https://e2e-a.test.example.com/pricing
  site_c894a480 | pageview | /B-SECRET-PAGE | https://e2e-b.test.example.com/B-SECRET-PAGE

sessions:
  site_d3be2960 | /pricing       | Desktop | United States
  site_c894a480 | /B-SECRET-PAGE | Desktop | United States
```

| Check | Result |
|---|---|
| Event exists | ✅ both sites |
| Session exists | ✅ both sites |
| `site_id` correct | ✅ |
| Full URL and path captured | ✅ |
| Server-side geo enrichment | ✅ device + country populated |
| Site ownership | ✅ both sites → test user |

---

## 6. PG → DuckDB synchronization — PASS

Latency was **measured**, not assumed: a new event was posted and DuckDB polled until it appeared.

| Check | Result |
|---|---|
| Event reaches DuckDB | ✅ |
| Manual SQL intervention required | ✅ **none** — the debounced sync ran on its own |
| **Measured latency** | **~6 seconds** (consistent with `SYNC_DEBOUNCE_MS=5000`) |
| Data matches PostgreSQL | ✅ same `site_id`, `path` |

**Note on method.** A direct DuckDB connection from a second process failed with a `Connection` error because the running API holds the database file. DuckDB is embedded and single-writer, so this is expected, not a defect. Verification was therefore done through the API's own read path (SQL Editor + analytics endpoints), which is what real users exercise.

---

## 7. Dashboard analytics — PASS

Authenticated requests as the test user:

| Endpoint | Response |
|---|---|
| `/kpi` | `totalVisitors: 2, totalPageviews: 2, totalSessions: 1, pagesPerSession: 2.00` |
| `/top-pages` | `/pricing` (1 view), `/latency` (1 view) |
| `/traffic` | `2026-08-28 → visitors 2, sessions 2, pageviews 2` |
| `/devices` | `Desktop: 2 (100%)` |
| `/countries` | `United States: 1`, `Unknown: 1` |

| Check | Result |
|---|---|
| Event count reflects tracked data | ✅ |
| Visitor / session information | ✅ |
| Date correct | ✅ |
| **Site filtering** | ✅ Site B's `/B-SECRET-PAGE` absent from Site A's results |
| Unauthenticated access | ✅ **HTTP 401** |

**Dashboard ↔ API connection** was verified as a browser would make it:

- CORS preflight `OPTIONS` from `http://localhost:5199` → **HTTP 204**
- Cross-origin `GET` with bearer token → **HTTP 200**, `Access-Control-Allow-Origin: http://localhost:5199`

---

## 8. SQL Editor — PASS

```sql
SELECT COUNT(*) AS total FROM events;   -- → 1
```

The count is **1, not 2**, even though two events exist in DuckDB. That is the tenant-scoping layer working: the query was rewritten against a view filtered to Site A.

### 8b. Cross-site isolation — PASS

| Query (as Site A) | Result |
|---|---|
| `SELECT site_id, path FROM events` | `[["site_d3be2960","/pricing"]]` — only Site A |
| `… WHERE site_id = '<site B>'` | `[]` — **empty** |
| Same query as Site B | `[["site_c894a480","/B-SECRET-PAGE"]]` — proves B's data *is* present in DuckDB and simply unreachable from A |

### Security boundary, exercised live

| Attempt | Result |
|---|---|
| `SELECT * FROM users` | ✅ blocked |
| `SELECT * FROM read_text('/etc/hosts')` | ✅ blocked |
| `DROP TABLE events` | ✅ blocked |
| `SELECT 1; DROP TABLE events` | ✅ blocked |
| `SELECT * FROM "users"` (quoted) | ✅ blocked |
| `SELECT * FROM duckdb_settings()` | ✅ blocked |

These confirm against a running system what `SQL_EDITOR_SECURITY.md` verified in isolation.

---

## 9. Pulse / MCP

### Pulse LLM chat — NOT VERIFIED

`GET /api/assistant/status` → `available: false, serverProvider: null, toolCount: 19`.

No LLM provider key is configured, and per the task brief external services outside the local reproducibility path were not provisioned. Marked NOT VERIFIED rather than failed — the endpoint responds correctly and reports its own unavailability.

### 9b. MCP tool path — PASS

The tools Pulse calls need no LLM, so the read path *was* verified:

```
POST /api/mcp/run  {"name":"get_top_pages","siteId":"<A>"}
  → "Top page was /pricing with 1 views (30d)."
  → data: /pricing, /latency

POST /api/mcp/run  {"name":"get_top_pages","siteId":"<B>"}
  → "Top page was /B-SECRET-PAGE with 1 views (30d)."
```

Returns data belonging to the authorized site, and scopes correctly per site.

---

## Bonus: DNT opt-out — PASS

| Step | Result |
|---|---|
| Events before | 2 |
| `POST /api/track/event` with `DNT: 1` | `{"success":true,"optedOut":true}` |
| Events after | **2 — nothing persisted** ✅ |

---

## Failures and warnings

**No application failures were observed.**

| Observation | Assessment |
|---|---|
| `/api/auth/profile` → 404 | Not a defect — the route is `/api/auth/me`. My error. |
| Direct DuckDB connection from a 2nd process fails | Expected — DuckDB is embedded/single-writer while the API holds the file. |
| Port 55555 already in use | Local machine condition, not a project issue. |
| API startup log | No errors or warnings (excluding routine "already up-to-date" sync lines). |
| Dashboard startup log | No errors or warnings. |

One cosmetic issue carried over from the reproducibility audit (**not** re-fixed here): `scripts/init.js` prints `✅ DuckDB ready at duckdb/analytics.duckdb` as hardcoded text regardless of `DUCKDB_PATH`. The path *is* honoured — the isolated file was created correctly — only the log line is wrong.

---

## Cleanup

- Throwaway PostgreSQL container removed.
- Isolated DuckDB file (`duckdb/e2e-verify.duckdb`) and WAL removed.
- API (:3099) and dashboard (:5199) processes stopped.
- No changes to the developer's own database, DuckDB file, or `.env`.
- Test data existed only inside the throwaway container.

---

## Scope

- **A live browser was not driven.** The tracking script was executed in a browser-like sandbox making real HTTP calls, and the dashboard's API connection was verified at the CORS/HTTP level. Visual rendering in a real browser was not exercised; the Playwright E2E suite was not run.
- **Pulse's LLM turn is unverified.** Only the tool layer beneath it was exercised.
- This verifies that the documented flow **works on this machine, at this commit, with this configuration**. It is not a statement that the system is production-ready or fully secure.

---

*Verification only. No application code, tests, configuration, or documentation other than this file was modified.*
