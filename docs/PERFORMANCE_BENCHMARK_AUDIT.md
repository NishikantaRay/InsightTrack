# Performance & Benchmark Reproducibility Audit

**Date:** 2026-08-28
**Canonical copy audited:** `apps/`
**Type:** Audit only. No benchmark code, performance documentation, published numbers, application code, schemas, or indexes were modified.

---

## 1. Scope

This audit answers two questions, and deliberately does **not** answer a third.

| | Question | In scope |
|---|---|---|
| **A** | *Is DuckDB actually faster than PostgreSQL for this workload?* | **No.** This audit takes no position on it. |
| **B** | *Does the current benchmark demonstrate the published claims?* | **Yes** |
| **C** | *Can another researcher reproduce the published numbers?* | **Yes** |

Conflating A with B and C is the central risk here. It is entirely possible that DuckDB *is* substantially faster for these queries — columnar engines usually are for aggregations — while the repository still contains **no evidence** of it. Those are different statements, and this document is only about the second.

**In scope:** every user-facing performance claim in `README.md`, `docs/*.md`, and dashboard content; `scripts/benchmark.js`; `scripts/load-test-data.js`; dataset generation; the PostgreSQL baseline question.

**Out of scope:** optimisation, benchmark rewriting, adding datasets or baselines, changing or removing claims.

---

## 2. Search methodology

1. Keyword sweep over `README.md`, `docs/*.md`, and `apps/` for `10x`, `100x`, `10–100`, `100ms`, `8ms`, `15ms`, `120ms`, `200ms`, `1M`, `10M`, `100M`, `DuckDB`, `PostgreSQL`, `benchmark`, `performance`. Audit documents were excluded from results to avoid self-reference.
2. Every hit reviewed in context; marketing prose separated from numeric claims.
3. `scripts/benchmark.js` and `scripts/load-test-data.js` read in full.
4. **The benchmark was executed** against a live, isolated stack — not inspected only.
5. Claims traced to code. Documentation was never accepted as evidence that a benchmark exists.

**11 distinct performance claims** were identified.

---

## 3. Inventory of performance claims

| ID | Exact claim | Location | Metric | Dataset | Workload | Engine | Hardware | Runs | Cache | Baseline | Script | Generator | Reproducible? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **C-01** | "answers 90-day queries in under 100 ms even over millions of events" | `README.md:31` | HTTP latency | "millions" (unspecified) | 90-day query | DuckDB via API | none stated | — | unstated | none | none | none | **PARTIAL** |
| **C-02** | "10–100× faster than a row store" | `README.md:52` | ratio | unspecified | "analytics read" | DuckDB vs PostgreSQL | none | — | — | **none exists** | none | none | **NO** |
| **C-03** | "10-100× faster aggregation queries" | `docs/api-reference.md:137` | ratio | unspecified | aggregation | DuckDB vs PG | none | — | — | **none exists** | none | none | **NO** |
| **C-04** | "reads in DuckDB are 10‑100× faster than equivalent SQL on a row-store" | `docs/pg-duckdb-sync.md:8` | ratio | unspecified | reads | DuckDB vs PG | none | — | — | **none exists** | none | none | **NO** |
| **C-05** | 1M rows → KPI 9ms, Traffic 5ms, Top pages 6ms, ~50 MB RAM | `docs/performance-architecture.md:13` | query time | **1M** | KPI/traffic/top-pages | DuckDB | "Apple M4" | unstated | unstated | none | none | **none for 1M** | **NO** |
| **C-06** | 10M rows → KPI 88ms, Traffic 42ms, ~985 MB RAM | `docs/performance-architecture.md:14` | query time | **10M** | same | DuckDB | "Apple M4" | unstated | unstated | none | none | **none for 10M** | **NO** |
| **C-07** | 100M rows → KPI 3.9s → <5ms with daily_stats; Traffic 522ms; Top pages 869ms; ~3 GB | `docs/performance-architecture.md:15` | query time | **100M** | same | DuckDB | "Apple M4" | unstated | unstated | none | none | **none for 100M** | **NO** |
| **C-08** | "P99 latency drops ~4×" (connection pooling) | `docs/performance-architecture.md:74` | P99 ratio | unspecified | 50 concurrent users | DuckDB | none | — | — | none | none | none | **NO** |
| **C-09** | "5–20× speedup" (ART indexes) | `docs/performance-architecture.md:126` | ratio | unspecified | selective queries | DuckDB | none | — | — | none | none | none | **NO** |
| **C-10** | Hot+Cold before/after table: 1.5×–25× (six rows) | `docs/hot-cold-analytics-architecture.md:269-274` | query time | unspecified | KPI/traffic/top-pages | DuckDB v1 vs v2 | none | unstated | unstated | v1 DuckDB | none | none | **NO** |
| **C-11** | PostgreSQL vs DuckDB table: 120ms→8ms, 200ms→15ms, 500ms→40ms, 350ms→25ms over 100K rows | `docs/duckdb-guide.md:26-31` | query time | **100K** | 4 query types | **both engines** | none | unstated | unstated | **PostgreSQL numbers present but not produced by any script** | none | none | **NO** |

**C-11 is the only place in the repository where PostgreSQL and DuckDB numbers appear side by side.** No code produces either column.

---

## 4. Current benchmark architecture

`scripts/benchmark.js`, read in full.

### What it actually measures

```js
const t0 = Date.now();
const r  = await req('GET', path, null, token);   // http.request → localhost:3001
times.push(Date.now() - t0);
```

**It measures end-to-end HTTP round-trip latency from a Node client to the Express API.** That figure includes: TCP/HTTP overhead, Express routing, JWT verification, site-authorization lookup, the analytics cache layer, DuckDB execution (only on a miss), BigInt serialisation, and JSON encoding.

**It does not measure DuckDB execution time.** No timing is taken at the engine boundary.

| Question | Finding |
|---|---|
| HTTP/API latency or DB execution time? | **HTTP/API latency**, `Date.now()` around `http.request` |
| Can responses come from cache? | **Yes.** The API's TTL cache (10–120s) sits in front of every measured endpoint |
| Iterations | **3** (`bench(..., runs = 3)`) |
| Warmup | **None.** Run 1 is reported as "cold"; runs 2–3 are averaged as "warm" |
| Cache cleared between runs? | **No.** Two cases are explicitly named "cache hit" / "cache-warm" |
| Dataset required | An existing site with data; **not** generated by this script |
| Dataset generated automatically? | **No** |
| Database state controlled? | **No.** Whatever is in the target instance |
| PostgreSQL measured? | **No.** Zero PG references in the file |
| DuckDB measured? | **Only indirectly**, through the API and its cache |
| Equivalent workloads across engines? | **N/A** — only one engine is exercised |
| Identical queries across engines? | **N/A** |
| Timing includes network? | **Yes** (loopback) |
| Timing includes application processing? | **Yes** |
| Engine-only timing? | **No** |
| Aggregation method | `cold` = run 1; `warm` = **mean of runs 2–3** |
| Median / p95 / p99 | **None** |
| Outlier handling | **None** |
| Random variation controlled? | **No.** No seed, no repetition beyond n=3, no variance reported |

### The self-labelling problem

The script grades its own results by latency band:

```js
const cacheIcon = warm < 3 ? '🚀' : warm < 20 ? '⚡' : warm < 100 ? '✔' : '🔄';
```

The `🚀` tier is described in the output as "cache hot". The script therefore **acknowledges internally that its fastest numbers are cache hits**, while the same class of number appears in documentation as query performance.

### Hardcoded target

`const API = 'http://localhost:3001'` and `port: 3001` are hardcoded (lines 9, 41); the port is not configurable. Credentials come from `BENCHMARK_EMAIL` / `BENCHMARK_PASSWORD` / `BENCHMARK_SITE_ID` and the script fails closed with a clear message when they are unset (verified).

---

## 5. Dataset reproducibility

| Published dataset | Generator exists? | Status |
|---|---|---|
| **1M events** (C-05) | No script targets this size specifically | **NOT REPRODUCIBLE** |
| **10M events** (C-06) | — | **NOT REPRODUCIBLE** |
| **100M events** (C-07) | — | **NOT REPRODUCIBLE** |
| **100K rows** (C-11) | — | **NOT REPRODUCIBLE** |

`scripts/load-test-data.js` **does exist** and can generate an arbitrary number of events (`--events=N`, default 1,000,000). It was executed successfully during this audit.

But it does not make the published datasets reproducible, for three reasons:

1. **It is not seeded.** Data is randomly generated per run — page paths, referrers, devices, countries, and timestamps differ every time. Two runs at the same `--events` value produce different datasets, so query selectivity differs.
2. **It writes through the tracking API**, not directly to the database, so throughput and the resulting time distribution depend on the running server.
3. **Nothing ties it to the published table.** No documentation states that the 1M/10M/100M figures were produced with this script, at what flags, or against what schema state.

`scripts/seed.js` generates a fixed ~130K-row demo dataset for two demo sites — useful for a working demo, not for the published benchmark sizes.

**Verdict: the published datasets cannot be reconstructed from repository contents.**

---

## 6. PostgreSQL baseline analysis

**No PostgreSQL benchmark exists in the repository.**

Verified by:
- `grep -niE "pg|postgres|5432" scripts/benchmark.js` → one match, an unrelated log string ("data may still be syncing from PG"). No `pg` import, no connection, no query.
- No other script in `scripts/` measures PostgreSQL query latency.

Against the required comparison criteria:

| Criterion | Status |
|---|---|
| Same dataset | ✗ — no PG measurement at all |
| Same query | ✗ |
| Same hardware | ✗ |
| Same indexing | ✗ |
| Same cold/warm state | ✗ |
| Same result requirements | ✗ |
| Same number of runs | ✗ |
| Same measurement boundary | ✗ |

**C-02, C-03, C-04, and C-11 are therefore UNSUPPORTED.** The "10–100×" figure — which appears in the README, the API reference, and the sync documentation — has no measurement behind it anywhere in the repository.

**This audit did not run an improvised PostgreSQL comparison.** Doing so and presenting it alongside the published numbers would manufacture a baseline that never existed. The absence is the finding.

---

## 7. Current benchmark execution

The benchmark was run **exactly as documented in `docs/benchmarking.md`**, against a fully isolated stack.

### Setup

```bash
docker run -d --name bench-pg -e POSTGRES_USER=… -p 55701:5432 postgres:16-alpine
cd apps/analytics-api && npm run migrate && npm run init && npm start   # PORT=3001
# register a throwaway account + site through the API
node scripts/load-test-data.js --events=100000 --batch=500
```

Dataset landed: **101,000 events in PostgreSQL, 101,000 in DuckDB** after normal sync (verified in both stores).

Event mix produced by the generator: pageview 37,874 · click 12,679 · web_vital 12,662 · heatmap_click 12,655 · scroll_depth 12,643 · js_error 12,487.

### Command

```bash
BENCHMARK_EMAIL=… BENCHMARK_PASSWORD=… BENCHMARK_SITE_ID=… \
  node scripts/benchmark.js
```

### Raw results (101K events)

| Endpoint | cold | warm |
|---|---:|---:|
| KPI Summary (30d) | 8 ms | 3 ms |
| KPI Summary (90d) | 8 ms | 3 ms |
| KPI — all time | 8 ms | 3 ms |
| Traffic Over Time (30d) | 7 ms | 3 ms |
| Traffic Over Time (90d) | 12 ms | 3 ms |
| Pageviews (30d) | 4 ms | 3 ms |
| Top Pages (30d) | 6 ms | 6 ms |
| Top Pages (90d) | 7 ms | 8 ms |
| Traffic Sources (30d) | 13 ms | 3 ms |
| Device Breakdown (30d) | 4 ms | 6 ms |
| Countries (30d) | 5 ms | 5 ms |
| Period Comparison (30d) | 11 ms | 2 ms |

### Reported summary

```
Endpoints tested:   45      Passed: 45/45
Avg cold query:     5ms     Avg warm (cached): 4ms
Slowest:  Social Media (30d) — 16ms cold
Fastest:  Traffic Over Time (90d) — 1ms cold
Sub-3ms (cache hot): 14 endpoints
3-50ms cold:         32 endpoints
>300ms cold:          0 endpoints
```

**The benchmark runs successfully and produces internally consistent output.**

---

## 8. Published vs observed

| Claim | Published | Observed | Comparable? |
|---|---:|---:|---|
| C-05 KPI @ 1M | 9 ms | — | **No** — could not construct a 1M dataset |
| C-06 KPI @ 10M | 88 ms | — | **No** |
| C-07 KPI @ 100M | 3.9 s | — | **No** |
| C-01 90-day query <100 ms | <100 ms | **8 ms cold / 3 ms warm** at 101K | **Directionally consistent, not equivalent** |
| C-02/03/04 "10–100×" | 10–100× | — | **No** — nothing measures PostgreSQL |
| C-10 hot/cold speedups | 1.5×–25× | — | **No** — requires v1-vs-v2 configurations that cannot be reconstructed |
| C-11 PG vs DuckDB | 120→8 ms etc. | — | **No** |

**The one claim with supporting evidence is C-01**, and only partially: 90-day queries did return well under 100 ms. But this was at **101K events, not "millions"**, and the measurement is HTTP latency including a cache layer, not query time. It supports the *spirit* of the claim at a smaller scale; it does not verify it.

**No published number was reproduced.**

---

## 9. Environment

Captured during execution. No secrets or personal paths.

| Item | Value |
|---|---|
| OS | macOS 26.5.2 (arm64) |
| CPU | Apple M4, 10 cores |
| RAM | 16 GB |
| Node.js | v22.19.0 |
| npm | 10.9.3 |
| Docker | 29.7.2 |
| PostgreSQL | 16.15 (`postgres:16-alpine`, container) |
| DuckDB | `^1.1.3` (npm binding) |
| Dataset | 101,000 events, ~90-day span |
| API | localhost:3001, `NODE_ENV=development` |
| Cache | **enabled** (defaults) |

Note: this hardware is the same *class* the documentation cites ("Apple M4"), yet the published numbers still could not be checked — the blocker is dataset and methodology, not hardware.

---

## 10. Statistical and methodological concerns

| # | Concern | Detail |
|---|---|---|
| **M-1** | **Cache contamination** | Every measured endpoint sits behind a 10–120s TTL cache. "Warm" numbers are substantially cache-hit latency. The script's own `🚀 (cache hot)` label concedes this. Presenting them as query performance conflates two different things. |
| **M-2** | **n = 3** | One cold sample and a two-sample mean. Far too few for a performance claim; a single scheduling hiccup moves the result materially. |
| **M-3** | **Mean only** | No median, p95, or p99. For latency, tail behaviour is usually the interesting part, and a mean of two samples has no meaningful distribution. |
| **M-4** | **No warmup** | Run 1 conflates genuine cold-cache cost with JIT warmup, connection setup, and first-touch page faults. |
| **M-5** | **No variance reported** | No standard deviation or confidence interval, so results cannot be compared across runs. |
| **M-6** | **No outlier handling** | A single GC pause silently shifts the reported mean. |
| **M-7** | **Wrong measurement boundary** | HTTP + Express + auth + cache + serialisation are all inside the timing window, but the numbers are documented as DuckDB query times. |
| **M-8** | **Uncontrolled dataset** | The generator is unseeded, so query selectivity varies run to run. |
| **M-9** | **No baseline** | The headline comparative claim has no comparator. |
| **M-10** | **Underspecified environment** | "Apple M4" alone omits RAM, OS, Node, DuckDB version, and thermal state. |
| **M-11** | **No raw data committed** | Only prose summary tables; no CSV/JSON artifacts to re-analyse. |

`docs/benchmarking.md` **already carries an honest disclaimer** stating the harness is not publication-grade and pointing at the audit findings. That is to the project's credit and is why several items below are P2 rather than P1.

---

## 11. Claim-by-claim classification

| ID | Claim | Classification |
|---|---|---|
| C-01 | 90-day queries under 100 ms | **PARTIALLY REPRODUCIBLE** — directionally confirmed at 101K events (8 ms cold), but not at the "millions" scale claimed, and measured at the wrong boundary |
| C-02 | "10–100× faster than a row store" (README) | **UNSUPPORTED** — no PostgreSQL baseline exists |
| C-03 | "10-100× faster aggregation" (api-reference) | **UNSUPPORTED** |
| C-04 | "10‑100× faster than a row-store" (pg-duckdb-sync) | **UNSUPPORTED** |
| C-05 | 1M table (9/5/6 ms) | **UNREPRODUCIBLE** — no 1M dataset generator |
| C-06 | 10M table (88/42 ms) | **UNREPRODUCIBLE** |
| C-07 | 100M table (3.9s → <5ms) | **UNREPRODUCIBLE** |
| C-08 | "P99 drops ~4×" | **UNSUPPORTED** — no P99 is ever computed by any script |
| C-09 | "5–20× speedup" (ART indexes) | **UNSUPPORTED** — no A/B measurement exists |
| C-10 | Hot/cold 1.5×–25× table | **UNREPRODUCIBLE** — v1 configuration cannot be reconstructed |
| C-11 | PG vs DuckDB comparison table | **UNSUPPORTED** — neither column is produced by any code |

### Totals

| Classification | Count |
|---|---|
| VERIFIED | **0** |
| PARTIALLY REPRODUCIBLE | **1** |
| UNREPRODUCIBLE | **4** |
| UNSUPPORTED | **6** |
| OUTDATED | **0** |
| **Total** | **11** |

**No performance claim in the repository is fully reproducible from repository contents.**

A note on what this does *not* say: none of these classifications means a claim is **false**. C-02's "10–100×" may well be accurate — columnar engines commonly achieve that range on aggregation workloads. The finding is that **the repository contains no evidence for it**, which is a different and narrower statement.

---

## 12. Recommended next actions

Not performed in this task.

### Documentation-only (lowest cost, highest immediate honesty)

1. Qualify or remove C-02/C-03/C-04 until a baseline exists, **or** attribute the range to published third-party benchmarks rather than to InsightTrack's own measurements.
2. Mark the `performance-architecture.md` and `hot-cold-analytics-architecture.md` tables as historical, one-off measurements with the environment and methodology stated — or remove them.
3. Note on the `duckdb-guide.md` table (C-11) that it is illustrative rather than measured, if that is the case.
4. State the measurement boundary wherever numbers appear ("HTTP latency including cache" vs "DuckDB query time").

### Benchmark methodology (required before any claim is publishable)

5. **Seeded, deterministic dataset generator** for 1M/10M/100M, writing directly to the database.
6. **Measure at the engine boundary** with the application cache bypassed; measure cache benefit separately and label it as such.
7. **n ≥ 30**, reporting median, p95, p99, and standard deviation, with warmup iterations discarded.
8. **A real PostgreSQL baseline**: same dataset, same logical query, same hardware, documented indexing, documented cold/warm state.
9. **Full environment capture** emitted by the harness itself into the results file.
10. **Commit raw results** (CSV/JSON) alongside any summary table.

### Configuration

11. Make the benchmark's target host/port configurable (currently hardcoded to `localhost:3001`).

---

## 13. Exact commands used

```bash
# Claim discovery
grep -rniF "10x|100x|10–100|100ms|8ms|15ms|120ms|200ms|1M|10M|100M" README.md docs/*.md apps/
grep -rnE "10–100×|[0-9]+× (faster|speedup)" README.md docs/*.md

# PostgreSQL baseline search (result: none)
grep -niE "pg|postgres|5432" scripts/benchmark.js
grep -rlniE "pg\.query|getPgPool|postgres" scripts/

# Harness inspection
sed -n '40,90p' scripts/benchmark.js
grep -n "runs = \|cacheIcon\|const API\|port: 3001" scripts/benchmark.js

# Isolated stack
docker run -d --name bench-pg -e POSTGRES_USER=… -e POSTGRES_DB=… -p 55701:5432 postgres:16-alpine
cd apps/analytics-api && npm run migrate && npm run init && npm start

# Dataset
node scripts/load-test-data.js --events=100000 --batch=500
docker exec bench-pg psql -U … -c "SELECT COUNT(*) FROM events;"     # 101000

# Benchmark
BENCHMARK_EMAIL=… BENCHMARK_PASSWORD=… BENCHMARK_SITE_ID=… node scripts/benchmark.js

# Environment
sw_vers; uname -m; sysctl -n machdep.cpu.brand_string hw.ncpu hw.memsize
node -v; npm -v; docker --version
docker exec bench-pg postgres --version
```

All test infrastructure (container, isolated DuckDB file, throwaway account) was removed afterwards. No existing analytics data was touched.

---

*Audit only. No benchmark code, performance documentation, published numbers, application code, schemas, indexes, or tests were modified. This document takes no position on whether DuckDB is faster than PostgreSQL for this workload — only on whether the repository demonstrates it and whether a third party could reproduce the published figures.*
