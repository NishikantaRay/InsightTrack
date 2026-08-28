# SQL Editor — Feature Guide

> Built-in SQL editor that lets you run read-only SELECT queries directly against
> your InsightTrack analytics database (DuckDB for `traffic2`, PostgreSQL for `traffic`).

---

## Table of Contents

1. [Overview](#1-overview)
2. [Accessing the SQL Editor](#2-accessing-the-sql-editor)
3. [Writing Queries](#3-writing-queries)
4. [The `{{site_id}}` Template Variable](#4-the-site_id-template-variable)
5. [Schema Browser](#5-schema-browser)
6. [Running Queries](#6-running-queries)
7. [Query Results](#7-query-results)
8. [Query History](#8-query-history)
9. [Example Queries](#9-example-queries)
10. [Security Model](#10-security-model)
11. [API Reference](#11-api-reference)
12. [Architecture Notes](#12-architecture-notes)

---

## 1. Overview

The SQL Editor gives you direct, read-only access to the analytics data behind your
InsightTrack dashboard. You can explore raw events and sessions, build custom aggregations,
export results in multiple formats, and preview data as charts — all without leaving the app.

Key characteristics:

| Feature | Detail |
|---|---|
| Database | DuckDB (analytics views) — `traffic2` / `appsv2` |
| Database | PostgreSQL (raw tables) — `traffic` (legacy) |
| Access | Authenticated · site-scoped |
| Permissions | SELECT / WITH / EXPLAIN only — writes are blocked server-side |
| Row limit | 1 000 rows per query (auto-appended) |
| Timeout | Configurable per-query timeout (default 15s) |
| Variables | `{{site_id}}` + custom template variables |
| Code Editor | CodeMirror 6 with SQL syntax highlighting, schema-aware autocomplete, Cmd+Enter to run |
| Saved Queries | Server-side saved query library with **folder grouping** (per user, per site) |
| Exports | CSV · JSON · **NDJSON/Parquet-compatible** · metadata JSON |
| Results UX | Table sorting/filter + quick chart preview |
| Audit | Query execution audit records in PostgreSQL |

---

## 2. Accessing the SQL Editor

Navigate to **SQL Editor** in the left sidebar (Terminal icon), or go to `/sql-editor`
in the URL.

---

## 3. Writing Queries

The editor uses **CodeMirror 6** with full SQL syntax highlighting, bracket matching, line numbers, and schema-aware autocomplete.

| Key | Action |
|---|---|
| `⌘ Enter` / `Ctrl Enter` | Run query |
| `Tab` | Accept autocomplete suggestion |
| Click schema column | Insert column name at cursor |
| Click table name | Insert table name at cursor |

The autocomplete engine is seeded with your site's live schema (table names + column names), so suggestions appear as you type table and column names.

Write standard SQL — the dialect follows whichever database backs your installation:

- **DuckDB SQL** for `traffic2/apps` and `traffic2/appsv2`
- **PostgreSQL SQL** for `traffic` (legacy project)

---

## 4. The `{{site_id}}` Template Variable

Every site in InsightTrack has a unique `site_id` (e.g. `site_a1b2c3d4`).

Use `{{site_id}}` anywhere in your query — the server replaces it with your verified
site ID before execution. This lets you scope queries to your own data without
hard-coding IDs:

```sql
SELECT path, COUNT(*) AS pageviews
FROM events
WHERE site_id = {{site_id}}
  AND type = 'pageview'
GROUP BY path
ORDER BY pageviews DESC
LIMIT 20
```

The replacement happens server-side on an already-ownership-verified ID, so it is safe.

---

## 5. Schema Browser

The left panel lists every available table alongside its columns and data types.
Click a table name to expand it. Available tables:

### DuckDB (`traffic2`)

| Table | Description |
|---|---|
| `events` | Union view of hot (last N days) + cold Parquet data |
| `sessions` | Aggregated session data (union view) |
| `events_hot` | Recent events stored in DuckDB managed tables |
| `sessions_hot` | Recent sessions stored in DuckDB managed tables |

Key columns on `events`:

| Column | Type | Notes |
|---|---|---|
| `site_id` | VARCHAR | Filter by this |
| `type` | VARCHAR | `pageview`, `click`, `custom`, … |
| `path` | VARCHAR | URL path |
| `timestamp` | TIMESTAMP | Event time |
| `country` | VARCHAR | ISO 3166-1 alpha-2 |
| `device` | VARCHAR | `desktop`, `mobile`, `tablet` |
| `browser` | VARCHAR | e.g. `Chrome` |
| `referrer` | VARCHAR | Full referrer URL |
| `utm_source` | VARCHAR | UTM source |
| `utm_campaign` | VARCHAR | UTM campaign |
| `properties` | JSON | Custom event properties |

Key columns on `sessions`:

| Column | Type | Notes |
|---|---|---|
| `site_id` | VARCHAR | Filter by this |
| `user_id` | VARCHAR | Pseudonymous visitor ID |
| `started_at` | TIMESTAMP | Session start |
| `ended_at` | TIMESTAMP | Session end |
| `page_count` | INTEGER | Pages viewed |
| `bounced` | BOOLEAN | Single-page session |
| `device` | VARCHAR | `desktop`, `mobile`, `tablet` |

### PostgreSQL (`traffic` legacy)

The schema browser lists whichever analytics tables exist in the `public` schema
(`events`, `sessions`, `pageviews`, `sites`).

---

## 6. Running Queries

1. Type (or paste) your SQL in the editor
2. Press **Run ⌘↵** or `⌘ Enter` / `Ctrl Enter`
3. A spinner appears while the query executes
4. Results appear below the editor when complete

### Timeout & cancel

The toolbar exposes a **Timeout (ms)** field (default `15000` ms). If the query
exceeds the timeout the request is aborted server-side. You can also click the
**Cancel** button (appears during execution) to abort immediately.

### EXPLAIN mode

Toggle **EXPLAIN** in the toolbar before running to retrieve the query execution
plan instead of row data. Useful for diagnosing slow queries — the plan is shown
in the results area as plain text.

If no `LIMIT` clause is present, the server automatically appends `LIMIT 1000` and
marks the response with `truncated: true`.

---

## 7. Query Results

Results appear below the editor in a scrollable table with:

- Row number column
- Sticky header row
- NULL values shown in italic
- Long values truncated in the cell (hover to see the full value)
- Status bar: row count · execution time · truncation warning

### Sorting

Click any **column header** to sort by that column ascending. Click again to sort
descending. A third click clears the sort.

### Filtering

A **Filter rows…** search box above the table performs a case-insensitive text
search across all column values in the displayed results.

### Chart preview

Click the **Chart** toggle button in the results toolbar to switch from the table
view to a bar chart. The first text column becomes the X-axis label and the first
numeric column becomes the bar value. Click **Table** to switch back.

### Exporting

Use the results action bar to export:

| Button | Format | Use case |
|---|---|---|
| **CSV** | `.csv` | Spreadsheets (Excel, Google Sheets) |
| **JSON** | `.json` | Programmatic use / APIs |
| **NDJSON** | `.ndjson` | DuckDB `COPY FROM`, pandas `read_json`, Parquet pipelines |
| **Meta** | `.json` | Execution metadata (`rowCount`, `duration`, `requestId`, `columns`) |

> **Parquet workflow:** Export as NDJSON → convert with DuckDB: `COPY (SELECT * FROM read_ndjson_auto('sql-results.ndjson')) TO 'out.parquet' (FORMAT PARQUET);`

---

## 8. Query History

Every successful query run is saved to `localStorage` under `sql-editor-history`
(last 50 entries). Access history via the **History** dropdown in the toolbar.

- Click any past query to restore it in the editor
- **Clear** removes all history entries

### Saved queries (server-side)

In addition to local history, you can save named queries to the server for the
current site and user. Saved queries persist across browsers/sessions.

**Folder grouping**: Enter an optional folder name when saving. Queries with the
same folder appear grouped in the sidebar with expand/collapse toggling. This lets
you organize queries by topic (e.g. `retention`, `funnels`, `debug`).

Saved queries support delete/update flows.

---

## 9. Example Queries

The **Examples** dropdown provides 6 starter queries. They all use `{{site_id}}` so
they work for any site immediately.

### Top pages (last 30 days)
```sql
SELECT path, COUNT(*) AS pageviews
FROM events
WHERE site_id = {{site_id}}
  AND type = 'pageview'
  AND timestamp >= NOW() - INTERVAL 30 DAYS
GROUP BY path
ORDER BY pageviews DESC
LIMIT 20
```

### Traffic by country
```sql
SELECT country, COUNT(*) AS visits
FROM events
WHERE site_id = {{site_id}}
  AND type = 'pageview'
GROUP BY country
ORDER BY visits DESC
LIMIT 20
```

### Bounce rate by page
```sql
SELECT e.path,
       COUNT(DISTINCT s.id) AS sessions,
       ROUND(100.0 * SUM(s.bounced::int) / COUNT(*), 1) AS bounce_rate_pct
FROM sessions s
JOIN events e ON e.session_id = s.id
WHERE s.site_id = {{site_id}}
GROUP BY e.path
ORDER BY sessions DESC
LIMIT 20
```

### Daily unique visitors (last 14 days)
```sql
SELECT CAST(timestamp AS DATE) AS date,
       COUNT(DISTINCT user_id) AS unique_visitors
FROM events
WHERE site_id = {{site_id}}
  AND type = 'pageview'
  AND timestamp >= NOW() - INTERVAL 14 DAYS
GROUP BY date
ORDER BY date
```

### UTM campaign performance
```sql
SELECT utm_source, utm_medium, utm_campaign,
       COUNT(*) AS events,
       COUNT(DISTINCT user_id) AS unique_users
FROM events
WHERE site_id = {{site_id}}
  AND utm_campaign IS NOT NULL
GROUP BY utm_source, utm_medium, utm_campaign
ORDER BY events DESC
```

---

## 10. Security Model

The SQL Editor enforces its boundary **server-side**. The frontend performs no
validation — the "DuckDB · read-only" label in the UI is informational, and every
guarantee below is enforced in `apps/analytics-api/src/routes/sqlGuard.js`.

**In brief:**

- **Read-only** — only `SELECT` / `WITH` / `EXPLAIN` are accepted; a single
  statement per request. `EXPLAIN ANALYZE` is rejected because it executes the
  query rather than only planning it.
- **Function allowlist** — queries may call analytical functions only. DuckDB's
  file and network readers (`read_csv`, `read_csv_auto`, `read_parquet`,
  `read_json`, `read_text`, `read_blob`, `glob`) and engine-metadata functions
  (`duckdb_settings`, `duckdb_databases`) are not on the allowlist and are
  rejected.
- **Table allowlist** — only analytics tables are reachable. The `users` table
  and the assistant/MCP tables are not, and schema-qualified references such as
  `main.events` are rejected.
- **Two validation layers** — a textual layer plus an AST parse. Both must pass,
  and a query the parser cannot understand is rejected rather than allowed.
- **Site scoping** — each referenced table is rewritten to a per-request view
  filtered to the site you are querying, so an unfiltered `SELECT * FROM events`
  cannot return another site's rows.
- **Resource limits** — a hard row cap that binds even if you supply your own
  larger `LIMIT`, and a server-capped query timeout.
- **Audit trail** — every execution, successful or failed, is recorded in
  `sql_query_audits`.

**Full details, verification evidence, and known limitations:**
[SQL_EDITOR_SECURITY.md](./SQL_EDITOR_SECURITY.md).

That document also records what is *not* guaranteed — notably that validation is
defence-in-depth rather than a proof, that a query timeout does not cancel work
already running in DuckDB, and that the AST layer uses a PostgreSQL grammar and
so rejects some valid DuckDB-specific syntax.

---

## 11. API Reference

### `GET /api/sql-editor/:siteId/schema`

Returns the available tables and their columns.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "schema": {
    "events": [
      { "name": "site_id", "type": "VARCHAR" },
      { "name": "timestamp", "type": "TIMESTAMP" }
    ],
    "sessions": [ ... ]
  }
}
```

---

### `POST /api/sql-editor/:siteId/run`

Executes a read-only query.

**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

**Body:**
```json
{ "query": "SELECT path, COUNT(*) FROM events WHERE site_id = {{site_id}} GROUP BY path LIMIT 10" }
```

**Success response:**
```json
{
  "columns": ["path", "count"],
  "rows": [["/home", 1234], ["/blog", 456]],
  "rowCount": 2,
  "duration": 38,
  "truncated": false
}
```

**Error response (400):**
```json
{ "error": "Only SELECT (and WITH … SELECT) queries are permitted." }
```

---

## 12. Architecture Notes

### DuckDB (`traffic2`)

Queries run against in-process DuckDB. The `events` and `sessions` views transparently
UNION hot tables (DuckDB managed) and cold Parquet files — see
[hot-cold-analytics-architecture.md](hot-cold-analytics-architecture.md) for details.

Because DuckDB is single-writer, the SQL editor only issues read-only queries through
the existing `duckAll()` helper — no connection isolation is needed for reads.

### PostgreSQL (`traffic` legacy)

Queries run against the analytics tables in PostgreSQL using the existing `query()`
pool helper. The same `LIMIT 1000` and keyword-blocking rules apply.

### Frontend state

| State | Storage |
|---|---|
| Schema | React state (fetched on mount, per site) |
| Query text | React state (not persisted) |
| Query history | `localStorage` key `sql-editor-history` |
| Results | React state (cleared on new run) |

---

## Security

The SQL Editor's security boundary (read-only enforcement, filesystem protection,
site scoping) and its verification evidence are documented in
[SQL_EDITOR_SECURITY.md](./SQL_EDITOR_SECURITY.md).
