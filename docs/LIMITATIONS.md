# Limitations

What InsightTrack does not do well, or at all.

Every item here was verified against the implementation or against the committed
benchmark results. Limitations that would apply to any web application in general
are deliberately omitted — this lists what is specific to *this* system.

If you are evaluating InsightTrack, read this before the README's feature list.

---

## Scalability

**The whole system is designed around a single API process.** Three separate
pieces of state live in that process's memory or its local filesystem:

| State | Where | Consequence of a second process |
|---|---|---|
| DuckDB analytics store | An embedded file at `DUCKDB_PATH` | Each process opens its own handle to the same file |
| Sync lock | `let _syncRunning` in `sync/sync.js` | Purely in-process; two processes would sync concurrently |
| Query cache | An in-memory `Map` in `services/cache.js` | Each process caches independently; invalidation reaches only one |

**You cannot horizontally scale the API by running more replicas.** Doing so
would give you two sync loops writing to one DuckDB file with no coordination
between them. This is not a configuration gap — nothing in the code arbitrates
across processes. Scale vertically instead.

Consequences that follow from this:

- No high-availability deployment. A single API process is a single point of
  failure, and restarting it interrupts ingest.
- Rate limiting is per-process and per-IP (`express-rate-limit` with an in-memory
  store), so it is neither shared across replicas nor per-site.
- The sync loop is serial: `runSync` walks `SYNCABLE_TABLES` one table at a time.

**Largest dataset actually tested: 1,000,000 events.** Behaviour beyond that is
unmeasured, not "known to scale" — see [Benchmark limitations](#benchmark-limitations).

## Synchronisation delay

**Analytics are always behind the write store.** The dashboard reads DuckDB,
which is populated from PostgreSQL by a background process. Nothing in the read
path queries PostgreSQL.

Three timers determine the lag:

| Trigger | Default | Set by |
|---|---|---|
| Debounced sync after an event | 5s | `SYNC_DEBOUNCE_MS` |
| Periodic sync | 60s | `SYNC_INTERVAL_MS` |
| Query cache TTL | 10s (realtime) – 120s (general) | `CACHE_TTL_*_MS` |

**Worst-case staleness compounds**: a KPI figure can be roughly 90 seconds behind
reality (60s sync interval + 30s KPI cache TTL). "Realtime" in the dashboard
means a 10-second cache over data that itself may be up to a minute old — it is
not live.

Further specifics:

- **A skipped sync is not queued.** `runSync` returns immediately if a sync is
  already in flight; that work waits for the next cycle.
- **A failed debounced sync deliberately does not invalidate the cache**, because
  invalidating would only reload the same stale data. It re-queues and retries.
- **Startup sync failure is non-fatal.** The API logs `analytics may be stale`
  and serves whatever DuckDB already holds.

## Database consistency

The two stores are **eventually consistent by design**, and the sync is additive
in both of its modes. That has concrete consequences:

- **`events` is append-only with no deduplication.** If the keyset cursor in
  `_sync_meta` is rewound while the rows are already in DuckDB, those rows are
  inserted again. This is why the cursor is persisted after every committed
  batch rather than once per table. There is regression cover for this in
  `tests/syncScenarios.test.js`.
- **Deletes propagate only through retention.** Neither cursor strategy can
  observe a row that is simply gone from PostgreSQL, so a manual `DELETE` against
  PostgreSQL leaves the row queryable in DuckDB indefinitely. Only
  `runRetentionCleanup` mirrors deletions across both stores.
- **`daily_stats` is DuckDB-derived, not synced.** It is rebuilt by
  `computeDailyRollups()`. Syncing it from PostgreSQL as well would create two
  competing writers and double-count metrics.
- **`users` is deliberately never synced**, so any analytics query joining to
  user records is impossible by design. This is a security decision — the table
  carries bcrypt hashes.
- **There is no cross-store transaction.** A retention cleanup deletes from
  PostgreSQL, then from DuckDB. If the process dies between the two, PostgreSQL
  has lost rows that DuckDB still serves until the next cleanup.

## Storage

- **DuckDB is a derived copy, not a durable store.** Losing the file costs no
  data — PostgreSQL is the system of record — but it forces a full resync, whose
  duration grows with the dataset.
- **`DUCKDB_PATH` defaults to a relative path** (`duckdb/analytics.duckdb`). On
  an ephemeral or serverless host that means the analytics store is discarded on
  every restart and must rebuild before the dashboard shows anything.
- **PostgreSQL `events` grows without bound** unless a retention policy is
  explicitly enabled. Retention is **off by default** (`enabled BOOLEAN DEFAULT
  FALSE`), so the realistic default for an unattended deployment is indefinite
  growth.
- **Cold storage exists but is opt-in and unmeasured.** S3/R2/MinIO archival to
  Parquet is implemented (`storage/s3.js`) and gated on `S3_BUCKET` plus
  credentials. With those unset — the default — DuckDB holds a single flat table
  and no tiering occurs. The archival path has no benchmark results in this
  repository.
- **No backup tooling ships with the project.** Backing up PostgreSQL is left
  entirely to the operator.

## Privacy

A full technical audit is in [`PRIVACY_AUDIT.md`](PRIVACY_AUDIT.md). The residual
limitations after the fixes described there:

- **Query-parameter redaction is a denylist, not an allowlist.** Well-known
  credential-ish parameter names are redacted at ingest; a site using an unusual
  parameter name for a secret is not covered. It closes the common accidental
  leak — it is not a guarantee.
- **Site-search terms are stored verbatim.** That is the feature's purpose, but
  search boxes receive free text and can capture personal information.
- **JS error messages are stored** (truncated to 200 characters). Truncation
  bounds volume, not sensitivity — an error string can embed application data.
- **`window.analytics.identify()` accepts any value with no validation.** Passing
  an email or account ID makes every subsequent event directly identifying, and
  nothing in the code or UI prevents it.
- **IP addresses reach application logs** when a GeoIP lookup fails, and any
  reverse proxy in front of the API keeps its own logs. Neither is covered by the
  retention system. The "no stored IP addresses" claim is accurate for the
  database only.
- **Visitor IDs are client-controlled.** Ingest is unauthenticated by necessity,
  so any caller who knows a `siteId` can submit arbitrary `user_id` values.
- **No compliance claim is made.** InsightTrack is not certified against GDPR,
  CCPA, or any other regime; compliance depends on how you deploy and operate it.

## Self-hosting

- **Defaults target a local evaluation, not the public internet.** The shipped
  `.env.example` contains placeholders, not secrets, and must be replaced.
- **The API speaks plain HTTP.** TLS termination is your responsibility.
- **PostgreSQL TLS is not verified.** Connections enable SSL when
  `NODE_ENV=production`, but with `rejectUnauthorized: false` — so the
  certificate is not validated and the connection is not protected against an
  active man-in-the-middle. Outside production, SSL is off entirely.
- **No Content-Security-Policy.** `helmet` is applied but CSP is explicitly
  disabled (`contentSecurityPolicy: false`), so the other helmet headers are set
  and CSP is not.
- **No external security audit** has been performed on any part of the system.
- **Ingest routes are unauthenticated** (`/api/track/*`), necessarily — the
  tracking script must post from any page. Anyone who learns a `siteId` can
  inject events, and `siteId` is not verified to exist. There is no per-site rate
  limit to bound this.
- **Sample-data seeding is not restart-safe.** It generates random session IDs
  and its "already seeded?" guard inspects only `events`, so a run interrupted
  partway leaves rows in `sessions` that collide on the primary key. Seeding no
  longer gates startup, but a partially-seeded database stays that way until
  volumes are reset.
- **No migration/rollback tooling.** `scripts/migrate.js` creates tables if
  absent; there are no versioned, reversible migrations.
- **The repository ships two synchronised copies** (`apps/` and `appsv2/`) that
  must be kept aligned by hand. `apps/` is canonical.

## SQL Editor

The security model is documented in
[`SQL_EDITOR_SECURITY.md`](SQL_EDITOR_SECURITY.md). Its limitations are mostly
the intended cost of that model:

- **Allowlists, not denylists.** 201 functions and 12 tables are permitted;
  everything else is rejected. **Legitimate but unrecognised SQL is refused** —
  a false rejection is the deliberate trade against a false acceptance.
- **Validation is done by a PostgreSQL-dialect parser** (`node-sql-parser`), so
  DuckDB-specific syntax that PostgreSQL cannot parse is rejected even when
  DuckDB would accept it.
- **Results are capped at 1,000 rows** and the query timeout is clamped to
  `SQL_EDITOR_MAX_TIMEOUT_MS` (default 30s). It is not an export mechanism.
- **Read-only, and scoped to one site.** Eleven tables are replaced per request
  by temporary views filtered to the caller's site; cross-site queries are
  impossible, as is any write.
- **`users` is unreachable**, so no query can join analytics to account records.
- **Not externally audited.** The boundary has regression tests and a documented
  model; it carries no assurance beyond that.

## Pulse (AI analyst)

- **Requires a third-party API key.** With no key configured the feature is
  unavailable; there is no local model option.
- **Analytics data leaves your deployment.** Answering a question sends the
  relevant data to Anthropic, OpenAI, or Google. This is the one part of the
  system that contradicts a strict self-hosting posture, and it is why the
  "no third-party data sharing" claim elsewhere needs qualifying.
- **Rate limited to 10 requests/hour on a server key**, 30 on a user's own key.
- **Tool results are capped at 100 rows**, so questions requiring a wide scan get
  a truncated view, and the model is told only that truncation occurred.
- **Answers are not deterministic and can be wrong.** The model may misread
  correct data or state a confident conclusion the numbers do not support.
  Treat output as a starting point, not a result.
- **It can only see what its 19 tools expose.** It cannot write arbitrary SQL,
  and questions outside those tools' shape cannot be answered.
- **Conversation history is truncated** to the most recent turns, so long
  sessions silently lose earlier context.

## MCP

- **Read-only.** All 19 tools are `get_*`/`list_*`; there is no write, no
  configuration change, and no deletion.
- **It is an HTTP client, not a database client.** The MCP server holds no
  database credentials and calls the same API as everything else, inheriting its
  auth and site scoping. It cannot bypass those, and it cannot run faster than
  the API.
- **Requires a long-lived bearer token** from `POST /api/mcp/connect`, defaulting
  to **365 days** (`MCP_TOKEN_EXPIRES_IN`). Connections can be revoked from
  Settings and revocation is checked on every request, but a token that leaks
  before anyone notices grants a year of read access to that user's sites.
- **Subject to the same sync delay and cache TTLs** as the dashboard — an MCP
  client sees the same stale data, with no way to force a fresh read.
- **Tool results are capped** at `MCP_TOOL_MAX_ROWS` (default 100).

## Browser tracking

These are inherent to client-side analytics; they bound how accurate the numbers
can be:

- **Ad blockers and privacy extensions block the script**, so those visits are
  never recorded. Expect undercounting relative to server logs.
- **Opt-out is honoured, which means opted-out visitors are invisible.** DNT and
  GPC are respected in the script and at the API; those visits produce no data at
  all. This is intentional and it makes totals lower than tools that ignore the
  signal.
- **Blocked storage inflates visitor counts.** With `localStorage` unavailable
  (private modes, storage disabled), a new visitor ID is minted per page load.
- **Visitor IDs expire after 180 days of inactivity** by default
  (`VISITOR_ID_TTL_DAYS`), so a returning visitor after a long gap counts as new.
  Clearing site data has the same effect at any time.
- **Country detection is a guess.** The script infers it from the browser's
  timezone and locale; the server falls back to IP lookup only when the client
  sends nothing. A VPN or a travelling laptop yields the wrong country.
- **Device, browser, and OS are coarse buckets** derived from the User-Agent —
  three device types, roughly six browsers, six operating systems. The raw
  User-Agent is never stored, so finer analysis is impossible after the fact.
- **Timestamps record arrival, not occurrence.** The server stamps the insert
  time and ignores any client-supplied value, so a queued `sendBeacon` from a
  closing tab is attributed to when it arrived.
- **`sendBeacon` gives no delivery confirmation** — a failed unload beacon is
  lost silently.
- **The script is 29.3 KB raw / 8.7 KB gzipped.** Not tiny; it includes timezone
  and country maps, Web Vitals collection, heatmap and scroll tracking, and error
  capture.
- **A no-JS pixel fallback exists** (`/api/track/pixel.gif`) but records only a
  bare event — no device, no path detail, no session continuity.

## Benchmark limitations

Results are in [`PERFORMANCE_BENCHMARK.md`](PERFORMANCE_BENCHMARK.md); raw data
is in `benchmark-results/`. The measurements are honest, and narrow:

**What was measured.** 12 queries, 5 warmup plus 30 measured iterations each,
alternating engine order per iteration, with result-equality verified between
engines before any timing was recorded. Median totals across the suite:

| Dataset | PostgreSQL | DuckDB | Ratio |
|---|---|---|---|
| 100,000 events | 195 ms | 57 ms | 3.4× |
| 1,000,000 events | 1,199 ms | 151 ms | 7.9× |

**What those numbers do not establish:**

- **One machine, one run.** Apple M4, 10 cores, 16 GB RAM, macOS, PostgreSQL
  16.15 in Docker against an in-process DuckDB 1.4.4. No cloud instance, no
  spinning disk, no constrained container, no repetition across machines. There
  are no confidence intervals across runs — only across iterations within one run.
- **Database execution time only.** HTTP, JSON serialisation, authentication, and
  the query cache are all excluded. End-user latency is not what was measured.
- **1M events is the ceiling tested.** Nothing here supports a claim about 10M or
  100M rows.
- **In-process versus over-a-socket is an unequal comparison.** DuckDB runs
  embedded in the Node process; PostgreSQL is reached over a network socket to a
  container. Some of the gap is architectural rather than engine capability, and
  the benchmark does not separate the two.
- **The dataset is synthetic**, generated by a seeded PRNG. Its cardinality and
  distribution are plausible, not real traffic.
- **The queries were rewritten to avoid `COUNT(DISTINCT)` inside `GROUP BY`.**
  This cut PostgreSQL's suite total from 2,972 ms to 1,199 ms. The same SQL runs
  on both engines, so DuckDB bears the cost of a rewrite that helps PostgreSQL —
  the comparison is not tilted, but it is also not "default" SQL.
- **DuckDB won all 12 queries at both sizes.** That is the measured outcome, not
  a claim that it always wins; the workload is analytical aggregation, which is
  what columnar engines are for. A workload of selective point lookups would be
  expected to look different, and was not tested.
- **Load time is not a strength.** Loading 1M rows took 47.5 s into DuckDB versus
  23.2 s into PostgreSQL — roughly 2× slower.
- **The benchmark commit was recorded as dirty** (`gitDirty: true`), so the exact
  tree state is not reproducible from the commit hash alone.

## Related documentation

- [`DATA_FLOW.md`](DATA_FLOW.md) — full event lifecycle and per-stage failure points
- [`PRIVACY_AUDIT.md`](PRIVACY_AUDIT.md) — data inventory and privacy findings
- [`PERFORMANCE_BENCHMARK.md`](PERFORMANCE_BENCHMARK.md) — benchmark methodology
- [`SQL_EDITOR_SECURITY.md`](SQL_EDITOR_SECURITY.md) — SQL Editor boundary
- [`../SECURITY.md`](../SECURITY.md) — vulnerability reporting and stated limitations
