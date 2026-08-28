# Data Flow — the lifecycle of an analytics event

How a single event travels from a visitor's browser to a number on a dashboard.

Every behaviour described here was read from the code; file and line references
are given so each claim can be checked. This document describes the system as it
is, including its failure modes — it does not propose changes.

```
Browser
  └─ tracking script          localStorage / sessionStorage IDs, DNT/GPC gate
      └─ POST /api/track/*    validation, geo enrichment, type allowlist
          └─ PostgreSQL       events table — system of record, SERIAL id
              └─ sync         keyset cursor (events) / timestamp watermark (others)
                  └─ DuckDB   columnar copy + daily_stats rollups
                      └─ queries.js → duckAll()
                          ├─ Dashboard (cached HTTP)
                          ├─ SQL Editor (allowlisted, site-scoped views)
                          ├─ Pulse (AI analyst, via MCP tools)
                          └─ MCP server (external clients, over HTTP)
```

---

## Stage 1 — Browser: the tracking script

**Source:** `apps/analytics-api/src/services/sitesService.js` (the script is
generated per site and served from `GET /api/sites/:siteId/script`)

**Input:** page loads and visitor interactions.

**Processing.** Before anything else — before any storage access or network
call — the script checks for an opt-out signal:

```js
var _dnt = navigator.doNotTrack === '1';
var _gpc = navigator.globalPrivacyControl === true;
if (_dnt || _gpc) { window.analytics = { track: …, optedOut: true }; return; }
```

If either is set the script installs an inert stub and returns, so no
identifiers are ever created for an opted-out visitor. If `navigator` is
unavailable the script falls through to normal behaviour, because a non-browser
host has no opt-out signal to honour.

Otherwise it derives, from the User-Agent, `device` (Desktop/Mobile/Tablet),
`browser`, and `os`, and infers `country` from the IANA timezone.

**Output:** a JSON body sent to `/api/track/*` via `navigator.sendBeacon` where
available, otherwise `fetch` with `keepalive: true` (`sitesService.js:326-331`).
`sendBeacon` is used for unload-time events so they survive page navigation.

**Storage:** two browser-side identifiers, and no cookies.

**Identifiers created here**

| ID | Where stored | Format | Lifetime |
|---|---|---|---|
| `userId` | `localStorage._analytics_uid` | `{ id, exp }` JSON; `u_` + `crypto.randomUUID` (base-36 fallback) | `VISITOR_ID_TTL_DAYS` (default 180) of no visits; the window slides on each visit |
| `sessionId` | `sessionStorage._analytics_sid` | `s_` + base-36 random | Until the tab closes |

**Failure points**

- **Blocked storage.** In private modes or with storage disabled, reads/writes
  can throw or return null, producing a new `userId` per page load — inflating
  visitor counts.
- **Random ID collisions.** Visitor IDs use `crypto.randomUUID` where available,
  falling back to `Math.random().toString(36).substr(2, 9)` on older browsers;
  session IDs still use the latter. Either way the value is client-controlled —
  a caller can send any `userId` it likes.
- **Ad blockers** may block the script or the request entirely; the event is
  simply never sent.
- **`sendBeacon` gives no delivery feedback** — a failed unload beacon is lost
  silently.
- **Timezone-based country** is a guess. A VPN or a traveller's laptop yields the
  wrong country, and the server may overwrite it (Stage 2).

---

## Stage 2 — API ingest

**Source:** `apps/analytics-api/src/routes/tracking.js`,
`apps/analytics-api/src/services/trackingService.js`

**Input:** `POST` to one of the ingest routes — `/event`, `/pageview`,
`/session`, `/session/end`, `/batch`, or the catch-all `/`. A no-JS fallback
exists at `GET /api/track/pixel.gif`.

**Processing**

1. **Opt-out, again.** `honourOptOut` runs on every `POST` route and rejects
   requests carrying `DNT: 1` or `Sec-GPC: 1`. It returns the endpoint's normal
   success shape (`{ success: true, optedOut: true }`) so a stale client script
   behaves exactly as it would on success. The pixel route honours the same
   signal but still returns a valid GIF, so the opt-out is not visible as a
   broken image (`tracking.js:194-216`).
2. **Geo enrichment.** `enrichGeo` fills `country`/`city` from the request IP,
   but only where the client did not supply them.
3. **Validation.** `siteId` and `userId` are required; anything else throws.
   `type` is checked against a 20-value allowlist and silently coerced to
   `'custom'` if unrecognised. Every string field is truncated to a fixed maximum
   (`safeStr`) — `url`/`referrer` to 2048, `path` to 512, IDs to 64.
4. **Session fallback.** A missing `sessionId` is replaced with a server-side
   `uuidv4()`.
5. **URL sanitisation.** `url`, `path` and `referrer` pass through
   `utils/urlPrivacy.js`, which redacts sensitive query parameters (`token`,
   `password`, `api_key`, `session`, `otp`, `code`, `email`, …) and drops the
   fragment. UTM and ordinary parameters are preserved. This runs server-side so
   sites still serving an older cached script are covered.
6. **Insert**, as a parameterised query with 19 bind parameters — no string
   interpolation.
7. **Schedule a sync** (Stage 4).

**Output:** `201` with `{ success: true, sessionId }`.

**Storage:** one row in PostgreSQL `events`.

> **Note on `timestamp`:** the server stamps `new Date().toISOString()` at insert
> time. It does **not** use a client-supplied timestamp, so a queued or delayed
> beacon is recorded at arrival time, not at the moment it occurred.

**Failure points**

- **No authentication.** Ingest routes are deliberately unauthenticated so the
  script can post from any page — so anyone who knows a `siteId` can inject
  events. `siteId` is not verified to exist.
- **Rate limiting is global**, not per-site: `app.use('/api/', limiter)` at
  `index.js:86`, default 1000 requests per 60s window per IP.
- **Unknown event types are silently coerced** to `'custom'` rather than
  rejected, so a client-side typo fails quietly.
- **Over-long values are silently truncated**, not rejected.
- **A PostgreSQL outage fails the request** with a 400 and the event is lost —
  there is no server-side retry queue.

---

## Stage 3 — PostgreSQL: the system of record

**Source:** `apps/analytics-api/src/db/postgres.js`

**Input:** parameterised `INSERT`s from Stage 2.

**Storage.** `events` has `id SERIAL PRIMARY KEY` — a monotonically increasing
integer. **This column is what makes the sync in Stage 4 correct**, because it
gives append-only data a stable ordering independent of clock skew.

**Identifiers**

| Column | Meaning |
|---|---|
| `id` | Auto-increment PK; the sync cursor for `events` |
| `site_id` | Tenant boundary — `site_` + 8 hex chars (`sitesService.js:16`) |
| `user_id` | Client-generated visitor ID |
| `session_id` | Client-generated session ID, or a server UUID |

**Invariant:** every write in the system goes to PostgreSQL. Nothing writes to
DuckDB except the sync process.

**Failure points**

- **`SERIAL` gaps.** Rolled-back transactions consume sequence values. The
  keyset cursor uses `>` on ordered rows, so gaps are harmless — but the column
  cannot be used to count events.
- **Unbounded growth.** `events` grows without limit unless a retention policy is
  configured. Retention deletes from PostgreSQL *and* DuckDB
  (`sync.js:143`, `applyRetentionDeletionToDuck`).

---

## Stage 4 — Synchronisation

**Source:** `apps/analytics-api/src/sync/sync.js`,
`apps/analytics-api/src/schema/schema.js`

**Input:** rows in PostgreSQL newer than the stored cursor.

**Triggers.** Three, all calling the same `runSync`:

| Trigger | Timing | Where |
|---|---|---|
| Startup | Once, on boot | `index.js:210` |
| Periodic | `SYNC_INTERVAL_MS`, default 60s | `index.js:217-224` |
| Debounced | `SYNC_DEBOUNCE_MS` after an event, default 5s | `tracking.js:23` |

The debounce is leading-edge-scheduled: the first event schedules a sync, and
every event inside that window is a no-op.

**Processing — two cursor strategies.** Which one applies is decided by
`appendOnly && !!idColumn` (`sync.js:301`):

| Strategy | Used for | Cursor | Why |
|---|---|---|---|
| **Keyset** | `events` (append-only) | `_sync_meta.last_id`, `WHERE id > ?` | Immune to timestamp gaps when rows arrive mid-sync |
| **Timestamp watermark** | `sessions`, `sites`, `goals`, … | `_sync_meta.last_synced`, `WHERE ts > ?` | Mutable rows must be re-read after edits |

Append-only batches become a single bulk `INSERT`. Mutable tables are upserted
row-by-row as `DELETE` by id, then `INSERT`, so edits propagate.

The keyset cursor is persisted **after every committed batch**, so a crash
mid-table never re-inserts what was already written.

After the tables, `computeDailyRollups()` (`sync.js:28`) derives the
`daily_stats` table inside DuckDB.

**Output / storage:** rows in DuckDB, plus updated `_sync_meta`.

**Two tables are deliberately excluded** from `SYNCABLE_TABLES`
(`schema.js:123-143`):

- **`users`** — it carries bcrypt password hashes, and replicating it would put
  every account's email and hash inside the SQL Editor's reach.
- **`daily_stats`** — it is DuckDB-derived. Syncing it from PostgreSQL too would
  create two competing writers and double-count metrics.

**Concurrency.** A module-level `_syncRunning` flag guards the process. `runSync`
**skips** if a sync is already running; `withSyncLock` **waits** instead
(`sync.js:105`). Note this is per-process — it does not coordinate across
multiple API instances.

**Failure points**

- **Sync lag is the dominant staleness source.** Analytics are behind by up to
  the debounce (5s) or the periodic interval (60s).
- **A skipped sync is not queued.** If `runSync` finds one already running it
  returns immediately; the caller's work is picked up by the next cycle.
- **A failed debounced sync re-queues its sites and reschedules**, and
  deliberately does *not* invalidate the cache — invalidating would reload the
  same stale data (`tracking.js:33-45`).
- **Startup sync failure is non-fatal** — it logs `analytics may be stale` and the
  API serves whatever DuckDB already holds (`index.js:212`).
- **Single-writer assumption.** Two API processes against one DuckDB file would
  each run their own sync loop; the in-process lock does not prevent that.
- **`DUCKDB_PATH` on ephemeral storage** means the analytics store is lost on
  restart and must fully resync.

---

## Stage 5 — DuckDB: the analytics store

**Source:** `apps/analytics-api/src/db/duckdb.js`

**Input:** writes from the sync process only.

**Processing.** A connection pool of `DUCKDB_POOL_SIZE` (default 4) serves reads,
with a queue when all connections are busy (`duckdb.js:21-39`).

**Storage:** a single file at `DUCKDB_PATH`, default `duckdb/analytics.duckdb`.

**Invariant:** analytics reads come from DuckDB; the dashboard never queries
PostgreSQL for them.

**Failure points**

- **Eventually consistent by design.** DuckDB always trails PostgreSQL.
- **Pool exhaustion** queues requests rather than failing them — visible as
  latency, not errors.
- **Not a durable store.** It is a derived copy; PostgreSQL is the source of
  truth, and DuckDB can be rebuilt with a full sync.

---

## Stage 6 — Analytics queries

**Source:** `apps/analytics-api/src/queries/queries.js` (91 `duckAll` call sites)

**Input:** a `siteId` and a date range.

**Processing:** parameterised SQL against DuckDB (`?` placeholders), wrapped in a
TTL cache (`services/cache.js`):

| Cache | Default TTL |
|---|---|
| `REALTIME` | 10s |
| `KPI` | 30s |
| `TRAFFIC`, `PAGES` | 60s |
| `GENERAL` | 120s |

Cache entries are invalidated per site **only after a successful sync**, by
prefix across 24 known key prefixes (`tracking.js:59`).

**Failure points**

- **Two independent staleness sources compound**: sync lag *plus* cache TTL. A
  KPI figure can be up to ~90s behind reality (60s sync + 30s TTL).
- **Prefix-based invalidation** depends on that hardcoded prefix list; a new
  metric with a new prefix would not be invalidated until its TTL expires.

---

## Stage 7 — Consumers

All four consumers converge on the same `queries.js` → `duckAll()` path. They
differ in how they are authenticated and what they are permitted to ask.

### Dashboard

React SPA calling `/api/analytics/*`, JWT-authenticated. Reads the cached query
layer above.

### SQL Editor

**Source:** `apps/analytics-api/src/routes/sqlEditor.js`, `sqlGuard.js`

Accepts user-written SQL, validated in two layers — regex plus an AST parse — and
governed by **allowlists rather than denylists**: 201 functions and 12 tables.

Per request, 11 tables are replaced by `TEMP VIEW`s filtered to the caller's
site, so a query cannot read another tenant's rows. Validation runs **again**
after template substitution. Results are capped at 1000 rows and the timeout is
clamped to `SQL_EDITOR_MAX_TIMEOUT_MS` (default 30s). Filesystem paths are
stripped from error messages.

Full model: [`SQL_EDITOR_SECURITY.md`](SQL_EDITOR_SECURITY.md).

**Failure points:** an allowlist rejects unfamiliar-but-safe SQL — the failure
mode is a false rejection, which is the intended trade. The boundary has not
been externally audited.

### Pulse (AI analyst)

**Source:** `apps/analytics-api/src/routes/assistant.js`,
`src/mcp/tools/registry.js`

Natural-language questions are answered by an LLM that may call the MCP tools
(`get_kpi`, `get_traffic`, `get_top_pages`, …). Each tool calls the same cached
`queries.*` functions — **Pulse has no independent database access**. Tool
results are capped at `ASSISTANT_TOOL_MAX_ROWS` (default 100).

**Failure points:** LLM output is not deterministic and may misread correct data;
the provider is a third party and an outage disables the feature; rate limits
differ for a user's own key (30/h) versus the server key (10/h).

### MCP server

**Source:** `apps/mcp-server/src/index.js`

An external process for MCP clients such as Claude Desktop. It holds **no
database credentials** — it calls the HTTP API with a bearer token from
`POST /api/mcp/connect` (`index.js:34-38`), so it inherits the same auth and
site-scoping as every other consumer.

---

## Where an event can be lost or delayed

| Stage | Symptom | Cause |
|---|---|---|
| 1 | Event never sent | Ad blocker, DNT/GPC, storage blocked, `sendBeacon` failure |
| 1 | Visitor over-counted | New `userId` per load when storage is unavailable |
| 2 | `400`, event lost | Missing `siteId`/`userId`, or PostgreSQL unreachable |
| 2 | Wrong event type | Unknown `type` silently coerced to `'custom'` |
| 2 | Truncated data | Field exceeded its `safeStr` cap |
| 4 | Up to ~60s stale | Periodic sync interval |
| 4 | Longer staleness | Sync skipped (already running) or failed and retried |
| 5 | Analytics reset | `DUCKDB_PATH` on ephemeral storage |
| 6 | Up to ~90s stale | Sync lag plus cache TTL |
| 7 | Query rejected | Function or table absent from the SQL Editor allowlist |

## Related documentation

- [`pg-duckdb-sync.md`](pg-duckdb-sync.md) — sync internals
- [`hot-cold-analytics-architecture.md`](hot-cold-analytics-architecture.md) — hot/cold storage
- [`SQL_EDITOR_SECURITY.md`](SQL_EDITOR_SECURITY.md) — SQL Editor boundary
- [`ai-analyst.md`](ai-analyst.md) — Pulse
- [`mcp-toolkit.md`](mcp-toolkit.md) — MCP architecture
