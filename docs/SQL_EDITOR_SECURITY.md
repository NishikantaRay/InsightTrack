# SQL Editor — Security Model & Verification Evidence

**Component:** SQL Editor (`/api/sql-editor/*`)
**Last verified:** 2026-08-28
**Status:** Hardened and verified against the tests recorded below. **Not** certified secure — see [Remaining limitations](#7-remaining-limitations).

The SQL Editor lets an authenticated user run ad-hoc analytical SQL against the DuckDB read replica. Because it accepts arbitrary SQL text, it is the most security-sensitive surface in the product, and this document records what the boundary actually enforces and how that was verified.

---

## 1. Security boundary

### 1.1 Request path

```
Browser (SqlEditor.jsx)
   │  POST /api/sql-editor/:siteId/run  { query, variables, explain, timeoutMs }
   ▼
privateCors                         CORS allowlist (CORS_ORIGINS)
   ▼
authMiddleware                      JWT required — sqlEditor.js:21 (router-level)
   ▼
requireSiteAccess(req, res, siteId) Site ownership — sqlEditor.js:107
   ▼
validateQuery(query)                Pre-substitution validation — sqlEditor.js:299
   ▼
applyTemplateVariables(...)         {{var}} → SQL literal
   ▼
validateQuery(withVars)             POST-substitution re-validation — sqlEditor.js:328
   ▼
scopeQueryToSite(withVars, siteId)  Tenant-scoped TEMP views — sqlGuard.js:413
   ▼
applyRowCap(rewritten)              Hard outer LIMIT — sqlGuard.js:452
   ▼
duckRun(createSql) × N              Create the scoped views
duckAll(finalQuery)                 Execute, wrapped in clampTimeout()
   ▼
BigInt serialisation → JSON response
   │
   └─ every execution (success and failure) is written to `sql_query_audits` in PostgreSQL
```

### 1.2 Enforcement does not depend on the frontend

**The frontend performs no security validation whatsoever.** `apps/dashboard-web/src/pages/SqlEditor.jsx` contains a `SQL_KEYWORDS` array used only to populate an autocomplete toolbar, five example queries, and one cosmetic label:

```jsx
<span className="…">DuckDB · read-only</span>   // SqlEditor.jsx:545
```

That label is a statement to the user, **not a control**. The editor posts whatever text the textarea holds.

This is the correct arrangement — client-side checks are trivially bypassed by calling the API directly — but it means **every guarantee in this document is enforced server-side**, in `apps/analytics-api/src/routes/sqlGuard.js` and `sqlEditor.js`. Anyone reasoning about this boundary should ignore the frontend entirely.

### 1.3 Which database is reachable

User SQL executes **only against DuckDB**. PostgreSQL is touched by this route solely for saved-query CRUD and audit logging, always through `$n` parameterised statements. No user SQL text reaches PostgreSQL.

---

## 2. Read-only enforcement

### 2.1 Where it happens

One function: **`validateQuery()` in `apps/analytics-api/src/routes/sqlGuard.js:245`**. It is the single entry point for all validation and is called from four places in `sqlEditor.js` — saved-query create (:187), saved-query update (:223), and `/run` both before (:299) and after (:328) template substitution.

`sqlGuard.js` was extracted from the route specifically so these rules are unit-testable in isolation.

### 2.2 Layered validation

Checks run in this order; the first failure returns a 400.

| # | Check | Mechanism |
|---|---|---|
| 1 | Type and length (≤ 20 000 chars) | direct |
| 2 | Comment stripping (`--`, `/* */`) — **before** all later checks | regex |
| 3 | Prefix allowlist: must start `SELECT` / `WITH` / `EXPLAIN` | regex |
| 4 | `EXPLAIN ANALYZE` rejected (it *executes* the statement) | regex |
| 5 | Single statement — any `;` outside a string literal is rejected | regex |
| 6 | Keyword denylist (20 mutating/admin verbs) | regex |
| 7 | **Function allowlist** — 201 permitted analytical functions | regex |
| 8 | **Table allowlist** — 12 permitted tables | regex |
| 9 | **AST validation** — parse, then re-check functions and tables structurally | parser |

**Normalisation.** Before checks 5–8, the query is passed through `normalise()` (`sqlGuard.js:161`), which blanks string literals and then strips double-quote identifier quoting. Without this, `"users"` and `users` look different to a regex while DuckDB treats them as the same relation — a one-character bypass. String literals are blanked *first*, so a quote inside a string is never mistaken for an identifier delimiter.

### 2.3 Allowlist, not denylist

Checks 7 and 8 are the substantive boundary. A denylist can only enumerate known-bad names, so anything it has not heard of is permitted by default — that is how DuckDB's table functions (`read_csv`, `read_text`, `glob`) originally slipped through a denylist that correctly blocked all 20 mutating verbs. The allowlists invert this: an unrecognised function or table is rejected.

The denylist (check 6) is retained as a cheap first layer that produces a clearer error for the common mistake of pasting a write statement.

### 2.4 AST validation

`validateAst()` (`sqlGuard.js:309`) parses the query with `node-sql-parser` and re-checks functions and tables against the same allowlists using the parse tree rather than regex.

This exists because the textual layer is approximate. Testing bypassed it with quoted identifiers, comma-separated `FROM` lists, and functions nested in scalar subqueries. Parsing resolves those properly: the parser normalises quoting and schema qualification, `tableList()` resolves table references including CTE bindings, and `collectAstFunctions()` walks the entire tree to find function calls wherever they appear — including `window_func`, which is a distinct node type.

**Both layers must pass.** A gap in either one alone is not sufficient to admit a query.

**It fails closed.** A query the parser cannot understand is rejected, not waved through.

### 2.5 Pre- and post-substitution validation

`{{var}}` template values come from the request body and are interpolated as SQL literals. Validating only the original text would leave an injected value entering an already-approved query.

The route therefore validates **twice** — once on the raw query (:299) and again on the post-substitution text (:328). `{{site_id}}` itself is always overridden with the ownership-verified site id from the URL, so a body payload cannot redirect it.

### 2.6 Prohibited operations

Rejected: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `COPY`, `ATTACH`, `DETACH`, `INSTALL`, `LOAD`, `PRAGMA`, `CHECKPOINT`, `VACUUM`, `EXPORT`, `IMPORT`, `CALL`, `EXECUTE`, `GRANT`, `REVOKE`, `EXPLAIN ANALYZE`, and multiple statements.

### 2.7 Important limitation

**This is defence-in-depth validation, not a proof.**

Two independent layers must agree, and the allowlist model fails closed — but neither property amounts to a mathematical guarantee that no accepted query can do something unintended. The validation reasons about SQL text and a parse tree; it does not reason about DuckDB's execution semantics.

The practical evidence for that caution is this component's own history: two rounds of hardening were each followed by adversarial testing that found further bypasses (quoted identifiers, comma-separated `FROM` lists, `EXPLAIN ANALYZE`, and a cross-tenant leak in the view rewriter). The current state is *verified against everything tested*, which is a weaker and more honest claim than *secure*.

---

## 3. Filesystem protection

User SQL cannot use DuckDB's file-access capabilities to read server-side files.

**Blocked classes** (all absent from the function allowlist, so rejected at validation):

| Class | Examples |
|---|---|
| CSV readers | `read_csv`, `read_csv_auto` |
| Parquet readers | `read_parquet`, `parquet_scan` |
| JSON readers | `read_json`, `read_json_auto` |
| Raw file readers | `read_text`, `read_blob` |
| Directory listing | `glob` |
| Database attach | `ATTACH`, `DETACH` (also denylisted) |
| Extension loading | `INSTALL`, `LOAD` (also denylisted) |
| Engine metadata | `duckdb_settings`, `duckdb_databases`, `duckdb_extensions` |
| Remote I/O | `http(s)://` and `s3://` paths — reachable only through the reader functions above |

`duckdb_settings()` matters beyond reconnaissance: when S3 cold storage is configured, `storage/s3.js` sets `s3_access_key_id` and `s3_secret_access_key` on the shared DuckDB instance, and that function would return them in plaintext.

### 3.1 What is *not* claimed

**Future DuckDB capabilities are not automatically blocked — but the allowlist model means they are rejected by default.**

That distinction is worth stating precisely. A new DuckDB function added in a future release will not be in `ALLOWED_FUNCTIONS`, so it will be rejected. That is a real structural property, not an accident. What is *not* guaranteed:

- A future release could add **syntax** (not a function call) that reaches the filesystem — the function allowlist would not see it.
- The AST layer uses a **PostgreSQL grammar** (see §7), so new DuckDB syntax may be unparseable and rejected, or parse into a shape the walker does not classify as a function.
- `enable_external_access` remains `true` at the engine level (see §7), so these capabilities exist and are blocked *by validation*, not by the engine.

**A DuckDB upgrade should be treated as a security-relevant change** and re-verified against the tests in §6.

---

## 4. Tenant / site isolation

### 4.1 Authorization

`requireSiteAccess()` (`sqlEditor.js:107`) loads the site and compares `site.user_id` to `req.user.id` from the verified JWT. All six SQL Editor endpoints call it. Failures return 404 (unknown site) or 403 (not the owner).

### 4.2 Query scoping

Authorization alone is insufficient: it validates the `:siteId` in the URL but places no constraint on the SQL, so an unfiltered `SELECT * FROM events` would otherwise read every tenant's rows.

`scopeQueryToSite()` (`sqlGuard.js:413`) closes this. For each of the 11 scoped tables the query references, it:

1. creates a per-request `TEMP VIEW` filtered to the caller's site, and
2. rewrites the table reference in the query to point at that view.

```sql
-- generated per request; site id comes from the ownership-verified record
CREATE OR REPLACE TEMP VIEW _sqled_<site>_events AS
  SELECT * FROM main.events WHERE site_id = '<site>'
```

Rewriting covers references after `FROM`/`JOIN`, after a comma in a `FROM` list, and quoted forms. The comma case was a real defect found in verification: `FROM events, sessions` scoped only `events`, leaking the second table's other tenants.

The site id used is `req.params.siteId` — the ownership-verified value — **never** a body field. DuckDB cannot bind parameters in DDL (`Unexpected prepared parameter`), so the id is embedded as a quote-escaped literal; single quotes are doubled and the value does not originate from user input.

Any explicit schema qualifier (`main.events`) is rejected outright, since it would address the base table directly.

### 4.3 How isolation was verified

Two tenants were created with distinctly labelled data, then 14 escape attempts were run as a user authorized on one site only: unfiltered reads of `events`/`sessions`/`daily_stats`, explicit `WHERE site_id='<other>'`, `OR`-injection, `WHERE 1=1`, `site_id <> '<own>'`, comma joins, explicit joins, `UNION`, CTEs, subqueries, and cross-site aggregates.

**No attempt returned the other tenant's data.** Aggregates confirm the scoping is real rather than cosmetic: `SUM(visitors)` over `daily_stats` returned only the authorized site's total.

Payload tampering was tested separately: supplying `variables: { site_id: "<other site>" }` does not redirect scoping, because the route overrides `site_id` with the URL parameter after merging body variables.

---

## 5. Execution-path audit

The review looked for alternate routes to raw SQL rather than assuming the SQL Editor is the only one.

- **Four files execute DuckDB SQL:** `routes/sqlEditor.js`, `queries/queries.js`, `storage/s3.js`, `sync/sync.js`.
- **Only `sqlEditor.js` accepts user SQL.** A search for request-body SQL fields across all routes returns no other consumer.
- **`queries.js`** exposes fixed-shape analytics functions (`getTopPages(siteId, dateRange, limit)` and similar). Callers pass values, not SQL; 83 of 90 `duckAll` call sites bind `siteId` as a parameter, and the remainder interpolate clause skeletons whose values are bound.
- **`s3.js` and `sync.js`** are internal (archive and replication); neither takes request input.
- **MCP and Pulse expose 19 tools**, all fixed-shape analytics functions (`get_kpi`, `get_traffic`, `get_top_pages`, …). **No raw-SQL tool exists.** They authorize via `getMemberRole()` before execution.
- **Saved queries are validated on create (:187) and update (:223)**, and again on execution through `/run`, so a stored query cannot be replayed unvalidated.
- **Three `duckAll`/`duckRun` call sites exist in `sqlEditor.js`:** the schema endpoint (:131, a fixed query with no user input), scoped-view DDL (:351, built by `sqlGuard`), and the validated user query (:354).

**Result: no alternate raw-SQL execution path was found.**

---

## 6. Verification evidence

All results below are from the verification performed on 2026-08-28. Tests exercised the real `sqlGuard.js` module and, where behavioural, a real DuckDB instance using the application's own binding.

| Security property | Verification | Result |
|---|---|---|
| Read-only enforcement | 52 vectors: 11 prohibited verbs, plus case, whitespace, comment, multi-statement, CTE and quoted-identifier variants, and 12 legitimate analytical queries | **PASS** (52/52) |
| Filesystem access | 18 DuckDB file/network/metadata function tests against a canary file | **PASS** (18/18 blocked at validation, before DuckDB; canary never returned) |
| Cross-site isolation | 14 escape attempts across two live tenants + payload tampering | **PASS** (no tenant data leaked) |
| Alternate SQL paths | code-path review of all DuckDB callers, MCP/Pulse tools, saved queries | **PASS** (none found) |
| Frontend bypass | code review + direct guard invocation | **PASS** (frontend has no validation; all enforcement server-side) |
| Resource limits | timeout clamp, row cap, query-length cap, cancellation | **PARTIAL** — caps enforced; cancellation not implemented (§7.1) |
| Regression suites | full backend suite in all three copies | **PASS** (315/315 each; 98/98 SQL-Editor-specific) |

### 6.1 Automated regression tests

`apps/analytics-api/tests/sqlEditorSecurity.test.js` — **98 tests**, no database required, covering: legitimate analytics, mutating/administrative statements, file-reading functions, engine metadata functions, non-analytics tables, site binding, resource limits, identifier-quoting and syntax evasion, comma-list rewriting, AST-layer-only constructs, and identifier extraction.

Every rejection case corresponds to a vector that was confirmed exploitable before the fix, so a regression in this file is a genuine security regression — in particular, a DuckDB or parser upgrade that widens the surface should break it.

> **Note:** some `describe` block titles in that file reference finding ids (`F-01`, `F-02`, …) from an earlier audit document that has since been deleted. The ids no longer resolve to anything; the test names and assertions remain accurate on their own.

### 6.2 Candidate findings that were investigated and dismissed

Recorded so they are not re-reported as open issues:

- **`read_text()` injected through a template variable.** A probe flagged it, but the value is quote-escaped into an inert string literal. Verified against a real engine: the canary was not read and the query returned zero rows. **Not a bypass.**
- **A JOIN that errored during tenant testing.** Caused by a wrong column name in the test fixture, not the guard. Re-tested with the real schema: the JOIN works and stays scoped.

---

## 7. Remaining limitations

Open items. None is believed to be remotely exploitable on its own, but all are real and should be weighed before the SQL Editor is exposed on a shared or public instance.

### 7.1 Query timeout does not cancel execution

`withTimeout()` is `Promise.race`, which rejects the caller's promise but cannot cancel work already submitted to DuckDB.

Measured: the caller received a timeout at **402 ms** while the engine continued to **1777 ms**. The pooled connection is released only when the engine finishes. `DUCKDB_POOL_SIZE` defaults to **4**, and that pool is shared with the dashboard, Pulse, and MCP — so sustained SQL Editor abuse can degrade unrelated features. The user sees a prompt 408 and may retry immediately, building an invisible backlog.

Mitigations in place: the timeout is capped server-side (`clampTimeout`, ceiling `SQL_EDITOR_MAX_TIMEOUT_MS`, default 30 s) so a client cannot request an unbounded wait, and a hard row cap bounds result size.

Proper fixes — engine-level interrupt, or a dedicated connection destroyed on timeout — were out of scope.

### 7.2 No engine-level backstop

The DuckDB connection is opened read-write (`duckdb_databases()` reports `readonly: false`) and no `access_mode=READ_ONLY` is set. Validation is the only barrier to a write, albeit now two-layered.

`enable_external_access` also remains `true`. The audit's original recommendation to disable it is **not viable**: the setting is database-wide rather than per-connection, DuckDB refuses to change it once the database is running (`Cannot change enable_external_access setting while database is running`), and the application's own cold-storage path calls `read_parquet` on the same instance. Disabling it globally would break S3 archiving.

### 7.3 Parser dialect mismatch

`node-sql-parser` has no DuckDB grammar; PostgreSQL is the closest available. Valid DuckDB syntax that PostgreSQL does not accept is rejected as unparseable. Measured examples:

```sql
SELECT * EXCLUDE (col) FROM events
SELECT * REPLACE (lower(path) AS path) FROM events
SELECT path[1:3] FROM events          -- list slicing
SELECT {'a': 1} FROM events           -- struct literals
FROM events SELECT path               -- FROM-first
SELECT path FROM events QUALIFY …
SELECT COLUMNS('^utm') FROM events
```

Failing closed is deliberate — a rejected legitimate query is an inconvenience; an accepted malicious one is a breach — but this is a genuine usability regression. Widening support means finding a DuckDB grammar, not relaxing the check.

### 7.4 Dependence on the current DuckDB version

Verification was performed against **DuckDB 1.1.3** (`apps/analytics-api` dependency). The function allowlist rejects unknown names by default, but §3.1 describes cases a version change could still affect.

**On any DuckDB upgrade:** re-run `tests/sqlEditorSecurity.test.js`, re-probe the file-access vectors in §6, and confirm no new syntax parses into a shape the AST walker misclassifies.

### 7.5 Authorization model inconsistency

The SQL Editor uses an owner-only check (`site.user_id === req.user.id`) while the analytics routes, Pulse, and MCP use `site_members` role lookup via `getMemberRole()`. A user legitimately invited to a site as admin or viewer is therefore **denied** SQL Editor access.

This is restrictive rather than permissive — it is not a security hole — but it is inconsistent, and the string comparison is fragile given that `sites.user_id` is `VARCHAR` while `users.id` is `INTEGER`.

### 7.6 S3 credentials remain on the shared connection

`duckdb_settings()` is blocked, so the disclosure path is closed. But `storage/s3.js` still sets S3 credentials on the same DuckDB instance user SQL executes against, so the secrets remain within reach of any future gap in the function allowlist. Isolating them on a dedicated connection would remove the exposure entirely.

### 7.7 Scope of the validation model

Restating §2.7 because it governs how the rest of this document should be read: the boundary is **verified against the tests recorded here**, not proven. Two rounds of hardening were each followed by testing that found more bypasses. Treat "no known bypass" as the claim.

---

## See also

- `apps/analytics-api/src/routes/sqlGuard.js` — the boundary implementation
- `apps/analytics-api/src/routes/sqlEditor.js` — endpoints and execution path
- `apps/analytics-api/tests/sqlEditorSecurity.test.js` — 98 regression tests
- [`docs/sql-editor.md`](./sql-editor.md) — user-facing feature guide
- [`docs/security.md`](./security.md) — platform-wide security practices

---

## Scope of this document

This document covers the **SQL Editor only**, and its claims are limited to what
was verified on the date above.

It is not a statement about the platform's other security claims. In particular,
`docs/security.md` currently asserts that the tracking script honours Do Not
Track and Global Privacy Control signals, and that retention cleanup deletes
expired data. Neither was verified here, and a check performed while writing this
document found **no DNT/GPC implementation in the tracking script generator**.
Those claims are tracked separately as P0-1 in
[`REPOSITORY_AUDIT.md`](./REPOSITORY_AUDIT.md) and are out of scope for this
task — they are noted here only so that linking to a verified document is not
mistaken for endorsement of the unverified ones alongside it.
