# Database Engine Benchmark

**Harness:** `apps/analytics-api/scripts/benchmarking/run-engine-benchmark.js`
**Shared modules:** `scripts/benchmarking/{dataset,workload,stats}.js`
**Tests:** `apps/analytics-api/tests/benchmarkHarness.test.js`
**Last executed:** 2026-08-28

> **This benchmark measures the specified workload on the specified environment.
> It does not establish that DuckDB is universally faster than PostgreSQL.**

---

## 1. Purpose

To produce *reproducible* measurements of analytical query execution time on the
two engines InsightTrack actually uses, so that any future performance statement
can point at evidence a third party can regenerate.

It exists because the previous benchmark could not support the project's public
claims — see [`PERFORMANCE_BENCHMARK_AUDIT.md`](./PERFORMANCE_BENCHMARK_AUDIT.md).

---

## 2. What is being measured

**Database execution time.** SQL is issued directly to each engine and timed with
`process.hrtime.bigint()` around the driver call.

| Measured | Excluded |
|---|---|
| Query planning + execution in the engine | HTTP / network |
| Driver round-trip to the local engine | Express routing, middleware |
| Result materialisation by the driver | Authentication / authorisation |
| | JSON serialisation |
| | **The application response cache** |

Connection establishment is measured **separately** (`setup.postgresConnectMs`,
`setup.duckdbConnectMs`) and is never included in query timings. Data-load time
is likewise reported separately.

## 3. What is NOT being measured

- **Not the API.** `scripts/benchmark.js` is a *separate* application/HTTP
  benchmark. Its numbers include Express, auth, serialisation and the response
  cache. **The two benchmarks must never be compared or combined.**
- **Not write throughput.** Ingest is not benchmarked here.
- **Not concurrency.** Queries run one at a time.
- **Not cold storage.** The S3/Parquet tier is not exercised.
- **Not a cold-cache measurement.** See §10.

---

## 4. Dataset generation

`scripts/benchmarking/dataset.js` generates rows deterministically from a seed
using a self-contained mulberry32 PRNG (`Math.random()` cannot be seeded and may
vary between Node versions).

**Same seed + same size ⇒ identical rows, on any machine.** Verified across
separate processes: three independent runs at `size=50000, seed=42` produced
fingerprint `c4f078e16b61a`; `seed=43` produced `1796141e0373f8`.

Timestamps are anchored to a fixed end instant (`2026-01-01T00:00:00Z`) so
datasets do not drift with wall-clock time.

### Why not uniform random data?

Uniform data would give every `GROUP BY` equal-sized buckets and every filter
equal selectivity — unrepresentative of analytics traffic, and liable to flatter
whichever engine prefers predictable cardinality. The generator instead mirrors
shapes the production schema implies:

| Dimension | Distribution | Rationale |
|---|---|---|
| Event type | Weighted, pageview-dominant (52%) | Matches the tracked `ALLOWED_TYPES` mix |
| Page path | Zipf-like over 20 paths | A few hot pages carry most traffic |
| Referrer | ~42% direct, long tail | Typical acquisition mix |
| Visitor | Bounded pool (rows ÷ 12), revisited | Makes `COUNT(DISTINCT user_id)` genuinely sub-linear |
| Session | 1–9 events, front-weighted | Most sessions are short |
| Timestamp | Diurnal curve + weekday/weekend | Non-uniform time buckets |
| Site | Skewed 70/20/10 across 3 sites | Single-site filters are selective, as in production |

### Dataset characteristics (seed 42)

| Size | Events | Sessions | Visitor pool | Sites | Date range | Fingerprint (first 5k) |
|---|---:|---:|---:|---:|---|---|
| 100K | 100,000 | 35,701 | 8,333 | 3 | 2025-10-03 → 2026-01-01 (90d) | `e683c0e3d355f` |
| 1M | 1,000,000 | 357,097 | 83,333 | 3 | 2025-10-03 → 2026-01-01 (90d) | `6a0a43bd5211f` |

## 5. Dataset sizes

Implemented and supported: **100K**, **1M**, **10M** (any `--size` value).
Actually executed and reported here: **100K** and **1M** (see §16).

The harness refuses a size whose estimated working set exceeds ~35% of system
RAM, printing a clear message rather than thrashing. `--force` overrides.

## 6. Seed

Default `42`. Any integer works; the seed is recorded in every result file.

---

## 7. Query workload

Twelve queries in `scripts/benchmarking/workload.js`, each with a PostgreSQL and
a DuckDB statement that are **logically equivalent**.

| ID | Query | Category |
|---|---|---|
| Q01 | Total events | `COUNT(*)` |
| Q02 | Unique visitors | High-cardinality `COUNT(DISTINCT)` |
| Q03 | Total sessions | High-cardinality `COUNT(DISTINCT)` |
| Q04 | Daily event aggregation | Time-series `GROUP BY` |
| Q05 | Daily unique visitors | `GROUP BY` + `DISTINCT` aggregate |
| Q06 | Top pages (limit 20) | Filtered `GROUP BY` + `ORDER`/`LIMIT` |
| Q07 | Referrer / source aggregation | `GROUP BY` over an expression |
| Q08 | Date-range filter (30d, single site) | Selective indexed filter |
| Q09 | Multi-dimensional `GROUP BY` | 4 grouping columns |
| Q10 | Dashboard-style KPI | Composite single-pass aggregate |
| Q11 | UTM campaign breakdown | Filtered multi-column `GROUP BY` |
| Q12 | Hourly traffic pattern | `EXTRACT` + `GROUP BY` |

Constraints enforced by tests: read-only, no `daily_stats` or materialised view
for either engine, deterministic `ORDER BY` wherever rows are grouped, and
matching placeholder counts per dialect.

### 7.1 Query form — avoiding `COUNT(DISTINCT)` inside `GROUP BY`

Q05, Q06 and Q07 are written as a pre-distinct subquery or a pair of joined
aggregates rather than `COUNT(DISTINCT col)` inside a `GROUP BY`.

`EXPLAIN` showed why. The original form forced PostgreSQL into a serial
`GroupAggregate` that sorted **all 1M rows**:

```
GroupAggregate (actual time=142..338 rows=90)
  ->  Gather Merge (rows=1000000)
        ->  Sort  Sort Key: (date), user_id      <- sorting every row
```

Rewriting lets the planner use a hash aggregate instead. Measured at 1M:
Q05 283 ms → 143 ms, Q06 238 ms → 144 ms, Q07 406 ms → 294 ms.

**Measured on DuckDB the same rewrite is neutral to slightly worse** (Q06
16.2 ms → 19.1 ms). It is applied to **both** engines regardless: a fair
benchmark runs the same logical SQL on both sides, and letting each engine use
its own preferred phrasing would measure the tuner rather than the engines. The
cost of that decision is borne by DuckDB, not PostgreSQL.

The correctness gate (§14) re-verified all twelve queries after the rewrite:
**12/12 still return identical result sets**.

**Dialect note.** PostgreSQL's column is `TIMESTAMPTZ`; DuckDB's is `TIMESTAMP`.
Date-bucketing queries pin PostgreSQL to UTC (`AT TIME ZONE 'UTC'`) so both cut
days at the same boundary. This is a *correctness* adjustment to make the queries
semantically identical — not a performance optimisation for either side.

---

## 8. PostgreSQL configuration

- `postgres:16-alpine` (observed **16.15**) in a throwaway Docker container.
- Schema is a **verbatim copy of the production `events` table**.
- **All seven production indexes** are created — `site_id`, `timestamp`, `type`,
  `user_id`, `session_id`, `path`, and the composite `(site_id, timestamp)`.
  No index was removed to disadvantage PostgreSQL, and none was added that
  production does not create.
- `ANALYZE events` is run after load so the planner has statistics — omitting it
  would unfairly handicap PostgreSQL.
- **Tuning applied (see §8.1).** Earlier runs used image defaults; those numbers
  turned out to reflect a conservative planner cost model rather than the engine.

### 8.1 Why PostgreSQL is tuned — and how that was established

The first version of this benchmark ran both engines on defaults. `EXPLAIN
(ANALYZE, BUFFERS)` on the heaviest query then showed two problems:

```
Sort Method: external merge  Disk: 23560kB     <- spilling to disk (work_mem = 4MB)
GroupAggregate ... (actual time=599..718)      <- fully SERIAL
```

Two experiments settled what mattered:

| Experiment | Q05 median | Conclusion |
|---|---:|---|
| Defaults | 636 ms | baseline |
| `work_mem = 256MB` alone | 638 ms | disk spill removed (`quicksort Memory: 63MB`) but **no gain** — sorting was not the bottleneck |
| `force_parallel_mode = on` | 372 ms | the executor **can** parallelise it; the **planner** was declining |
| Lowered parallel cost estimates | 310 ms | same effect achieved legitimately |

So the final configuration lowers the parallel cost estimates rather than forcing
parallelism. `force_parallel_mode` is deliberately **not** used: it overrides the
planner instead of informing it, and would not represent a realistic deployment.

```
SET work_mem = '256MB'
SET max_parallel_workers_per_gather = 4
SET parallel_setup_cost = 200
SET parallel_tuple_cost = 0.01
SET min_parallel_table_scan_size = '1MB'
```

`work_mem` is retained even though it did not help on its own — and on one query
it *hurt* — because eliminating disk spill makes the measurement about the engine
rather than about temp-file I/O.

**This tuning helps PostgreSQL, not DuckDB.** It was added because reporting an
untuned PostgreSQL number would have understated it, which would have made the
comparison less fair, not more.

## 9. DuckDB configuration

- `duckdb` npm binding (observed engine **v1.4.4**), file-backed database.
- Schema mirrors the production DuckDB `events` table.
- **All three production `events` indexes** created: `(site_id, timestamp)`,
  `(type, site_id)`, `(path, site_id)`.
- No pre-aggregation, no `daily_stats`, no hot/cold Parquet tier — DuckDB reads
  the same raw `events` table PostgreSQL does.
- **Equivalent tuning applied for symmetry:** `SET threads = <core count>` and
  `SET memory_limit = '4GB'`. Measured effect: essentially none — DuckDB already
  defaults to using every core (observed `threads = 10`). The settings are made
  explicit so both engines are configured deliberately rather than one by
  accident.

---

## 10. Warmup methodology

Each query runs **5 warmup iterations per engine**, discarded. Warmup absorbs JIT
compilation, first-touch page faults, and initial buffer population.

**On cache state — what is and is not claimed.** These are *warmed* measurements.
No attempt is made to establish a cold-cache condition: PostgreSQL's shared
buffers and the OS page cache are populated by warmup and remain so, and DuckDB
likewise benefits from OS-level caching. This is stated rather than worked
around, because a genuine cold-cache benchmark would require dropping OS caches
between every iteration — not portable, and arguably less representative of a
warm production server. **Do not describe these numbers as cold-cache results.**

## 11. Measurement methodology

- **30 measured iterations** per query per engine (configurable via `--iterations`).
- **Alternating execution order**: on even iterations PostgreSQL runs first, on
  odd iterations DuckDB runs first, so neither engine is systematically
  advantaged by intra-iteration cache state or thermal drift.
- Timing uses `process.hrtime.bigint()` (nanosecond resolution).
- Connection setup and data loading are timed separately and excluded.

## 12. Statistical reporting

Every query/engine pair reports **n, min, max, mean, median, p95, p99, and sample
standard deviation**. Percentiles use the nearest-rank method. **All raw
per-iteration samples are retained** in the output so the numbers can be
re-analysed independently.

Median is the headline figure; a mean alone would hide the tail.

## 13. Environment capture

Captured automatically into every result file: OS and release, platform, arch,
CPU model and core count, total RAM, Node version, npm version, Docker version,
DuckDB engine version, PostgreSQL server version, git commit, and whether the
working tree was dirty. No secrets or credentials are recorded.

## 14. Correctness validation

**Before any timing**, every query is executed once on each engine and the result
sets compared. A query whose engines disagree is **excluded from the benchmark**
rather than measured.

Comparison normalises across driver differences: BigInt vs numeric counts, `Date`
objects vs ISO strings, and `DATE`-typed values that the two drivers localise
differently. Floating-point values are compared to **6 decimal places**
(`floatToleranceDecimalPlaces` in the output).

This gate proved its worth: on the first run it caught a genuine timezone
discrepancy in Q04/Q05 (`TIMESTAMPTZ` vs `TIMESTAMP` day boundaries) and excluded
them. Both were fixed, and the final runs verified **12/12 queries equivalent,
0 excluded**.

## 15. Reproduction command

```bash
cd apps/analytics-api
npm install                 # once
npm run benchmark:engine -- --size 100000 --seed 42
npm run benchmark:engine -- --size 1000000 --seed 42
```

| Flag | Default | Meaning |
|---|---|---|
| `--size` | `100000` | Event rows to generate |
| `--seed` | `42` | PRNG seed |
| `--warmup` | `5` | Discarded warmup iterations |
| `--iterations` | `30` | Measured iterations |
| `--pg-port` | `55833` | Host port for the throwaway container |
| `--keep` | off | Retain container + DuckDB file for inspection |
| `--force` | off | Override the memory guard |

Requires **Docker**. The harness starts its own `postgres:16-alpine` container
and its own DuckDB file, and removes both afterwards. It never touches the
developer's database, the application DuckDB file, or any existing data.

Results are written to `benchmark-results/` as JSON (full detail, including raw
samples) and CSV (one row per measurement).

---

## 16. Measurements

Executed 2026-08-28. **12/12 queries verified equivalent, 0 excluded, 30
iterations each, 720 samples per run.** The 100K run shown was produced from the
`appsv2/` copy and the 1M run from `apps/`; both copies share the harness
byte-for-byte and produced closely matching numbers (e.g. Q07 at 100K: 47.3 ms
from `appsv2` vs 48.0 ms from `apps`), which is itself a reproducibility check.

**Environment:** Darwin 25.5.0 (arm64) · Apple M4, 10 cores · 16 GB RAM ·
Node v22.19.0 · PostgreSQL 16.15 · DuckDB v1.4.4 · Docker 29.7.2 · commit `a70ca0a`

### 100,000 events — median / p95 / stddev (ms)

| Query | PostgreSQL median | PG p95 | PG σ | DuckDB median | Duck p95 | Duck σ |
|---|---:|---:|---:|---:|---:|---:|
| Total events | 3.984 | 4.347 | 0.208 | 0.578 | 1.065 | 0.277 |
| Unique visitors | 27.763 | 35.427 | 2.157 | 2.827 | 4.429 | 0.902 |
| Total sessions | 27.631 | 28.385 | 0.807 | 7.902 | 9.732 | 1.039 |
| Daily event aggregation | 12.016 | 12.571 | 0.271 | 2.956 | 4.171 | 0.658 |
| Daily unique visitors | 19.92 | 20.7 | 0.328 | 6.14 | 9.302 | 1.72 |
| Page aggregation (top 20) | 19.008 | 19.416 | 0.262 | 6.134 | 8.395 | 1.013 |
| Referrer / source aggregation | 26.741 | 27.548 | 0.444 | 12.276 | 14.053 | 0.836 |
| Date-range filter (30 days, singl… | 10.121 | 10.371 | 0.177 | 3.47 | 4.601 | 1.04 |
| Multi-dimensional GROUP BY | 8.894 | 9.314 | 0.362 | 2.591 | 3.577 | 0.533 |
| Dashboard-style KPI (single site,… | 12.641 | 13.056 | 0.234 | 4.517 | 5.361 | 0.471 |
| UTM campaign breakdown (30 days) | 14.03 | 14.531 | 0.241 | 4.35 | 6.789 | 1.026 |
| Hourly traffic pattern | 12.375 | 12.706 | 0.27 | 3.358 | 4.634 | 0.592 |

### 1,000,000 events — median / p95 / stddev (ms)

| Query | PostgreSQL median | PG p95 | PG σ | DuckDB median | Duck p95 | Duck σ |
|---|---:|---:|---:|---:|---:|---:|
| Total events | 9.193 | 9.823 | 0.288 | 0.884 | 1.286 | 0.235 |
| Unique visitors | 36.805 | 45.777 | 3.308 | 7.546 | 16.367 | 3.92 |
| Total sessions | 42.836 | 43.669 | 0.573 | 8.708 | 15.285 | 3.662 |
| Daily event aggregation | 75.743 | 78.856 | 1.166 | 5.193 | 6.955 | 0.94 |
| Daily unique visitors | 142.2 | 145.635 | 4.459 | 19.225 | 27.439 | 5.716 |
| Page aggregation (top 20) | 145.006 | 169.068 | 9.211 | 24.754 | 40.148 | 7.599 |
| Referrer / source aggregation | 297.151 | 320.409 | 10.581 | 41.542 | 65.038 | 11.178 |
| Date-range filter (30 days, singl… | 73.709 | 78.476 | 2.226 | 9.648 | 15.37 | 3.995 |
| Multi-dimensional GROUP BY | 58.675 | 89.727 | 8.968 | 6.818 | 16.435 | 4.937 |
| Dashboard-style KPI (single site,… | 107.087 | 122.404 | 7.336 | 12.324 | 24.058 | 4.831 |
| UTM campaign breakdown (30 days) | 118.474 | 133.405 | 5.49 | 8.966 | 19.061 | 4.784 |
| Hourly traffic pattern | 91.765 | 95.544 | 2.014 | 5.377 | 9.104 | 2.244 |

### Three rounds of optimisation (1M, PostgreSQL median ms)

Each round was driven by `EXPLAIN (ANALYZE, BUFFERS)`, not by guesswork.

| Query | Defaults | +planner tuning | +rewrite r1 | +rewrite r2 | Total |
|---|---:|---:|---:|---:|---:|
| Q01 total events | 16.3 | 8.9 | 9.2 | 9.2 | −43% |
| Q02 unique visitors | 36.0 | 36.9 | 36.4 | 36.8 | −2% |
| Q03 sessions | 43.1 | 43.3 | 43.3 | 42.8 | −1% |
| Q04 daily events | 110.2 | 76.1 | 76.2 | 75.7 | −31% |
| Q05 daily unique visitors | 637.4 | 280.4 | 142.7 | **142.2** | **−78%** |
| Q06 top pages | 586.7 | 239.1 | 144.2 | **145.0** | **−75%** |
| Q07 referrer sources | 491.0 | 427.3 | 294.6 | **297.2** | **−39%** |
| Q08 date-range filter | 175.5 | 76.5 | 72.5 | 73.7 | −58% |
| Q09 multi-dim GROUP BY | 79.0 | 59.5 | 54.5 | 58.7 | −26% |
| Q10 dashboard KPI | 337.9 | 208.4 | 207.7 | **107.1** | **−68%** |
| Q11 UTM breakdown | 305.2 | 118.2 | 112.9 | 118.5 | −61% |
| Q12 hourly pattern | 153.3 | 93.3 | 88.0 | 91.8 | −40% |

**Total PostgreSQL workload: 2,972 ms → 1,199 ms (−60%).**
DuckDB total across the same twelve queries: 151.0 ms.

Q02 and Q03 are essentially unchanged throughout. They are bare
`COUNT(DISTINCT col)` over the whole table with no `GROUP BY`, so neither the
planner tuning nor any rewrite has structure to exploit — an honest null result.

**Q07 is the remaining outlier (297 ms).** Its cost is intrinsic to the shape:
a `CASE` expression evaluated per row across 1M rows, producing ~728k distinct
`(source, session_id)` pairs that must be materialised before roll-up. A
functional index on the `CASE` expression would help, but production does not
create one, and adding a benchmark-only index would break the "same indexes as
production" rule (§8). It is left slow and documented rather than special-cased.

### Setup costs (reported separately, excluded from query timings)

| Size | PG connect | PG load | DuckDB connect | DuckDB load |
|---|---:|---:|---:|---:|
| 100K | 20 ms | 2,346 ms | 14 ms | 4,759 ms |
| 1M | 18 ms | 23,139 ms | 15 ms | 47,617 ms |

DuckDB's bulk load was roughly **2× slower** than PostgreSQL's in this harness.
That is a property of the loading method used here (chunked literal `INSERT`
rather than a native bulk path) and should not be read as a general ingest
comparison.

---

## 17. Limitations

1. **One environment.** A single Apple M4 / 16 GB machine. Results on other
   hardware, OS, or storage will differ.
2. **Warmed cache only.** §10. Not a cold-start measurement.
3. **Default engine configuration.** Neither engine was tuned. A
   PostgreSQL tuned for OLAP (`work_mem`, parallel workers, possibly columnar
   extensions) would likely perform differently.
4. **Single-threaded client, sequential queries.** No concurrency dimension.
5. **Synthetic data.** Distributions are modelled on the production schema but
   are not real traffic.
6. **Reads only.** Ingest, sync, and write throughput are not measured.
7. **12 queries.** Representative of this dashboard's workload, not of analytical
   SQL in general.
8. **10M not executed.** Supported by the harness but not run here (§16 reports
   only what was actually measured).
9. **Load method differs per engine.** PostgreSQL uses multi-row parameterised
   `INSERT`; DuckDB uses chunked literal `INSERT`. This affects the *load* timing
   only, not query timings.

## 18. Interpretation guidance

**What these measurements support.** On this machine, with this dataset, this
schema, these indexes, and these twelve queries, DuckDB's median execution time
was lower than PostgreSQL's for every query measured, with the gap widening at
1M rows. PostgreSQL retained all its production indexes, up-to-date statistics,
**and** planner settings tuned in its favour after profiling (§8.1) — the
comparison is against a PostgreSQL configured better than default, not worse.

**What they do not support.**

- **Not a universal claim.** This is one workload on one machine. It says nothing
  about PostgreSQL's behaviour when tuned for analytics, under concurrency, on
  different hardware, or on query shapes outside this set.
- **Not a product-latency claim.** These are engine timings. End-user latency
  additionally includes HTTP, auth, serialisation, and the response cache — see
  `scripts/benchmark.js` for that separate measurement.
- **Not a write comparison.** The load figures in §16 are not an ingest benchmark.
- **Not a fixed multiplier.** Ratios vary by query (roughly 5× to 15× at 1M after
  three optimisation rounds) and by dataset size. Quoting a single "N× faster" number would misrepresent
  the spread; the per-query table is the result.

Any public performance claim derived from this document should state the dataset
size, the query, the measurement boundary, and the environment.

---

## See also

- [`PERFORMANCE_BENCHMARK_AUDIT.md`](./PERFORMANCE_BENCHMARK_AUDIT.md) — why this harness was built
- [`benchmarking.md`](./benchmarking.md) — the separate application/HTTP benchmark
- [`performance-architecture.md`](./performance-architecture.md) — architectural context
