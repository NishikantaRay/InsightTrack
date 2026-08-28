# InsightTrack: A Self-Hosted Web Analytics Platform with a Dual-Database Read/Write Split

**Nishikanta Ray**

> **Status: first draft.** Sections marked **[GAP]** identify claims that the
> repository cannot currently support; they are placeholders for work that must
> be done, not text to be published. Citation placeholders are written as
> `[CITATION NEEDED]` — no reference has been invented. See
> [`PAPER_EVIDENCE_MAP.md`](PAPER_EVIDENCE_MAP.md) for the underlying inventory.

---

## Abstract

Self-hosted web analytics platforms face a structural tension: the transactional
store that best absorbs a high-frequency stream of tracking events is not the
store that best answers the wide aggregate queries a dashboard issues. Operators
who resolve this by adding a separate data warehouse acquire a second system to
deploy, secure, and maintain — a cost that is disproportionate for a single
website's traffic.

We describe InsightTrack, a self-hosted analytics platform that separates its
write path from its read path across two databases within a single process.
PostgreSQL is the system of record for all writes; an embedded DuckDB instance,
maintained by an incremental synchronisation process, serves every analytical
read. Because DuckDB runs in-process and stores its data in a single file, the
split introduces no additional service to operate.

We report a reproducible evaluation comparing both engines on identical generated
data. On a twelve-query analytical workload over one million events, executed on
a single machine, the DuckDB read path completed the suite in 151 ms against
1,199 ms for an indexed and tuned PostgreSQL configuration. We describe the
privacy-oriented design of the tracking layer, which stores no cookies, no IP
addresses, and no raw User-Agent strings, and which honours Do Not Track and
Global Privacy Control signals in both the client script and the server.

We make no claim of novelty for the read/write split itself, which is established
practice; the contribution is an integrated, reproducible, and honestly
characterised implementation of it at a scale where a warehouse is not
justified. We report the limits of our evaluation and of the architecture,
including a single-process ceiling that prevents horizontal scaling.

---

## 1. Statement of Need

Web analytics workloads have an asymmetric shape. Writes arrive as a continuous
stream of small, independent events — one row per pageview or interaction — for
which a row-oriented transactional database is well suited. Reads, by contrast,
are almost entirely aggregate: counts, distinct counts, and grouped rollups over
wide time ranges. Answering "how many unique visitors did each page receive last
month" requires touching a small number of columns across a large number of rows,
the access pattern for which column-oriented engines are designed
`[CITATION NEEDED: columnar storage for analytical workloads]`.

A self-hosted operator running analytics for one or a few websites has three
unattractive options. They can serve dashboards directly from the transactional
store, accepting that aggregate queries degrade as history accumulates. They can
deploy a separate analytical database, adding a service to install, secure,
back up, and keep synchronised. Or they can use a hosted third-party service and
give up the data custody that motivated self-hosting.

InsightTrack targets the operator for whom the second option is disproportionate:
the traffic volume does not justify a warehouse, but the query pattern still
suffers on a purely transactional store. The design question is whether the
benefits of a columnar read path can be obtained without the operational cost of
a second service.

**What this work does not claim.** We do not claim that existing tools are
inadequate for their users, nor that this need is unmet in general. Establishing
that would require a survey of self-hosted analytics operators, which we have not
conducted.

> **[GAP — user evidence]** This section currently argues from the shape of the
> problem, not from evidence of demand. The repository contains no deployment
> count, no third-party issue reports, and no user study. A submission should
> either gather such evidence or confine its claims to the technical argument
> above.

---

## 2. Related Work

> **[GAP — this section cannot presently be written.]** The repository contains
> no bibliography and no comparison against the relevant peer set. What follows
> states what the section must establish and what is currently missing, so the
> gap is explicit rather than concealed.

A credible related-work section must situate InsightTrack against at least four
bodies of work:

1. **Privacy-oriented self-hosted analytics.** The tools occupying the same
   niche — Plausible, Fathom, Umami, GoatCounter, Matomo — differ in storage
   engine, identifier strategy, and data retained. `[CITATION NEEDED]`
2. **Embedded analytical engines.** DuckDB's design and its positioning as an
   in-process OLAP system have their own literature, which a paper building its
   central argument on DuckDB must engage with. `[CITATION NEEDED]`
3. **Transactional-to-analytical replication.** Change-data-capture and
   read-replica patterns for feeding OLAP stores from OLTP systems are
   well established; our dual-cursor design is a simple instance of this family
   and should be positioned as such. `[CITATION NEEDED]`
4. **Query validation for untrusted SQL.** Our SQL editor uses allowlist
   validation over an embedded engine. This is a well-trodden technique, and the
   repository's own audit notes it would be publishable only alongside an
   adversarial evaluation we have not performed.

The single comparative document in the repository evaluates InsightTrack against
PostHog, and that document itself observes the two are different classes of
product. It therefore does not constitute a comparison against the relevant peer
set.

**No novelty claim is made for the architecture.** Separating an OLTP write path
from an OLAP read replica is established practice. What we offer is an
implementation with documented internals, a reproducible evaluation, and an
honest account of its limits.

---

## 3. Technical Architecture

InsightTrack comprises a React dashboard, an Express API, and two databases. The
API is a single Node.js process that also hosts the embedded analytical engine
and the synchronisation loop.

### 3.1 The write path

A tracking script served per-site posts events to unauthenticated ingest
endpoints. Ingest must be unauthenticated because the script executes on arbitrary
third-party pages; the security consequences are discussed in §7.

The server validates each event, constrains `type` to a twenty-value allowlist,
truncates every string field to a fixed maximum, and inserts one row into
PostgreSQL using a parameterised statement. Timestamps are assigned server-side
at insertion; client-supplied timestamps are ignored, so a delayed beacon is
recorded at arrival rather than occurrence.

PostgreSQL is the system of record. Every write in the system reaches it, and
nothing else writes to the analytical store.

### 3.2 Synchronisation

An incremental process replicates PostgreSQL rows into DuckDB. It runs on three
triggers: once at startup, periodically (default 60 s), and debounced 5 s after
an ingest event.

The process distinguishes two table classes, and the distinction is the design's
main point of care:

| Class | Example | Cursor | Rationale |
|---|---|---|---|
| Append-only | `events` | Keyset on `id SERIAL`, `WHERE id > ?` | Immune to timestamp collisions and to rows arriving mid-sync |
| Mutable | `sessions`, `sites` | Timestamp watermark, `WHERE ts > ?` | Edited rows must be re-read and upserted |

Using a monotonic integer rather than a timestamp for the append-only table
avoids a specific failure: with a timestamp cursor advanced by strict inequality,
any row sharing the exact high-water instant is skipped permanently. Because
events arrive concurrently and share timestamps at millisecond resolution, this
is not a rare edge case. The keyset cursor is persisted after every committed
batch, so an interruption mid-table cannot lose or repeat rows.

Two tables are deliberately excluded from replication. `users` carries password
hashes and is never copied, which keeps credentials outside the reach of the SQL
editor described in §3.4. `daily_stats` is derived inside DuckDB by a rollup
function; replicating it from PostgreSQL as well would create two competing
writers and double-count metrics.

### 3.3 The read path

All analytical queries execute against DuckDB through a connection pool, wrapped
in a TTL cache with per-metric expiry (10 s for realtime figures, 30 s for
headline KPIs, up to 120 s for general queries). Cache entries are invalidated
per site only after a synchronisation run succeeds; invalidating after a failed
run would merely reload the same stale data.

The dashboard never queries PostgreSQL. This is an invariant of the design, not
a convention.

### 3.4 Secondary capabilities

Three further capabilities exist. We describe them briefly and do not present
them as contributions of this paper, because the evidence does not support that
weight.

**SQL editor.** Users may run read-only SQL against their own data. Queries are
validated in two layers — a lexical pass and an AST parse — against allowlists of
201 functions and 12 tables, then rewritten so that eleven tables resolve to
temporary views filtered to the caller's site. Results are capped and timeouts
clamped. The design favours false rejections over false acceptances. It has
regression tests but no adversarial evaluation and no external audit.

**Pulse (AI analyst).** A natural-language interface answers questions by calling
a fixed set of read-only tools over the same cached query layer; it has no
independent database access. It requires a third-party API key, and answering a
question transmits the relevant analytics data to an external provider. This is
the one component that departs from the self-hosting posture, and we note it as a
limitation rather than a feature.

**MCP server.** An external process exposes nineteen read-only tools to Model
Context Protocol clients. It holds no database credentials and calls the same
HTTP API, inheriting its authentication and site scoping.

---

## 4. Privacy-Oriented Design

The tracking layer was designed so that the data most commonly used to identify
individuals is either never collected or never stored. The following properties
were verified against the implementation and are covered by automated tests.

**Not collected.** No cookies are set or read. No canvas, WebGL, audio, or font
fingerprinting is performed; `navigator.plugins`, `hardwareConcurrency`, and
`deviceMemory` are never accessed, and screen resolution is never read.

**Collected but not stored.** Client IP addresses reach the server as request
metadata and are used for a geographic lookup, but no table has an IP column. Raw
User-Agent strings are never transmitted: the script reduces them client-side to
one of three device types and a small set of browser and OS labels, which carry
substantially less entropy than the full string.

**Identifiers.** Two pseudonymous identifiers are generated client-side. A
visitor identifier is stored in `localStorage` with a sliding expiry (180 days by
default); a session identifier lives in `sessionStorage` and expires with the
tab. The visitor identifier's expiry bounds how far back one visitor can be
correlated, which an unbounded identifier would not.

**Opt-out.** Do Not Track and Global Privacy Control are honoured at two
independent layers. The client script checks both signals before any storage
access or network request and installs an inert stub if either is set, so no
identifier is created for an opted-out visitor. The server independently rejects
requests carrying `DNT: 1` or `Sec-GPC: 1` on all ingest routes, which covers
sites still serving a cached copy of an older script.

**Stored URLs are sanitised.** Full page URLs and referrers would otherwise
capture whatever a site places in query strings, including reset tokens and
prefilled email addresses. Sensitive parameters are redacted and fragments
dropped at the ingest boundary, server-side, so sites serving an older script
benefit without redeploying. This is a denylist of well-known parameter names: it
closes the common accidental leak and is not a guarantee.

**Retention.** A configurable policy deletes expired rows from both stores. The
ordering matters — PostgreSQL first, then DuckDB — because the synchronisation
process is additive in both modes and can never observe a row that is simply
gone. Without the mirrored deletion, data reported as deleted would remain
queryable everywhere users actually look.

### 4.1 What we do not claim

**We make no compliance claim.** InsightTrack is not claimed to satisfy GDPR,
CCPA, or any other regime. Compliance is a property of a deployment and its
operator, not of software.

Several residual limitations are documented rather than resolved. Site-search
terms and JavaScript error messages are stored as free text and can incidentally
contain personal data. The `identify()` API accepts any value without validation,
so an operator passing an email address converts pseudonymous records into
directly identifying ones. Ingest is unauthenticated, so identifiers are
client-controlled.

> **[GAP — adversarial evaluation]** We have not attempted to re-identify
> visitors from stored data, nor measured the entropy reduction achieved by the
> coarse device buckets relative to full User-Agent strings. A privacy claim in a
> published paper invites exactly this test, and the repository cannot currently
> answer it.

---

## 5. PostgreSQL and Embedded OLAP: Reproducible Evaluation

### 5.1 Method

We compare the two engines on identical data using a fixed workload of twelve
queries spanning cheap scans and expensive wide aggregations. Both engines read
the same logical tables; no materialised views or pre-aggregation are used on
either side.

Data is produced by a seeded generator (mulberry32, `seed: 42`), and each result
file records a fingerprint of the generated rows, making datasets reproducible
across runs. We report results at 100,000 and 1,000,000 events; the 1M dataset
comprises 357,097 sessions drawn from a pool of 83,333 visitors across 3 sites
over 90 days.

Four aspects of the protocol are intended to prevent a favourable result by
construction:

1. **Correctness gates timing.** Both engines must return identical result sets
   for a query before any measurement is recorded.
2. **Execution order alternates** per iteration, so cache-warming effects do not
   accrue systematically to one engine.
3. **PostgreSQL is indexed and tuned** — seven indexes, with `work_mem`,
   parallelism costs, and minimum parallel scan size adjusted for the workload.
   No indexes were withheld to flatter the comparison.
4. **Queries were rewritten to help PostgreSQL.** Replacing `COUNT(DISTINCT)`
   inside `GROUP BY` with pre-distinct subqueries reduced PostgreSQL's suite
   total from 2,972 ms to 1,199 ms. The same SQL runs on both engines, so DuckDB
   bears the cost of a rewrite that benefits its competitor.

Each query is executed 5 times as warmup and 30 times measured; we report medians.

### 5.2 Results

Suite totals (sum of per-query medians):

| Dataset | PostgreSQL | DuckDB | Ratio |
|---|---|---|---|
| 100,000 events | 195 ms | 57 ms | 3.4× |
| 1,000,000 events | 1,199 ms | 151 ms | 7.9× |

Per-query medians at 1M events:

| Query | PostgreSQL | DuckDB | Ratio |
|---|---|---|---|
| Q01 Total events | 9.2 ms | 0.9 ms | 10.4× |
| Q02 Unique visitors | 36.8 ms | 7.5 ms | 4.9× |
| Q03 Total sessions | 42.8 ms | 8.7 ms | 4.9× |
| Q04 Daily event aggregation | 75.7 ms | 5.2 ms | 14.6× |
| Q05 Daily unique visitors | 142.2 ms | 19.2 ms | 7.4× |
| Q06 Page aggregation (top 20) | 145.0 ms | 24.8 ms | 5.9× |
| Q07 Referrer/source aggregation | 297.2 ms | 41.5 ms | 7.2× |
| Q08 Date-range filter | 73.7 ms | 9.6 ms | 7.6× |
| Q09 Multi-dimensional GROUP BY | 58.7 ms | 6.8 ms | 8.6× |
| Q10 Dashboard KPI composite | 107.1 ms | 12.3 ms | 8.7× |
| Q11 UTM campaign breakdown | 118.5 ms | 9.0 ms | 13.2× |
| Q12 Hourly traffic pattern | 91.8 ms | 5.4 ms | 17.1× |

DuckDB was faster on all twelve queries at both dataset sizes. The margin widens
with dataset size, consistent with the expectation that columnar scans amortise
better over more rows.

**A result in the other direction.** Loading the 1M-row dataset took 47.5 s into
DuckDB against 23.2 s into PostgreSQL — approximately 2× slower. We report this
because an evaluation that only reports favourable measurements is not an
evaluation.

### 5.3 What these measurements do not establish

The evaluation is reproducible but narrow, and the following qualifications are
load-bearing rather than perfunctory.

- **Single machine, single run.** All measurements come from one Apple M4 system
  (10 cores, 16 GB RAM) with PostgreSQL 16.15 in Docker and DuckDB 1.4.4
  in-process. Variance is reported *within* a run across iterations, not across
  independent runs or machines; there are no confidence intervals in the sense a
  reviewer would expect.
- **The comparison is partly architectural.** DuckDB executes in-process while
  PostgreSQL is reached over a socket to a container. Some portion of the
  difference is transport rather than engine capability, and this design does not
  separate the two. A reader should treat the ratios as characterising *this
  deployment shape*, not the engines in isolation.
- **One million events is the ceiling tested.** Nothing here supports a claim
  about ten or a hundred million rows.
- **The workload is analytical aggregation**, which is what columnar engines are
  built for. A point-lookup or write-heavy workload, where PostgreSQL would be
  expected to do better, was not tested. This is the most significant omission.
- **Database execution time only.** HTTP handling, serialisation, authentication,
  and the cache are excluded, so these are not user-perceived latencies.
- **All measurements are single-client.** No concurrency was tested.
- **The data is synthetic.** Cardinalities and distributions are plausible but
  not drawn from real traffic.

> **[GAP — clean-tree reproduction]** Both result files record
> `gitDirty: true`, meaning the benchmarked working tree cannot be reconstructed
> from the recorded commit hash. The benchmark must be re-run from a clean tree
> before submission.

---

## 6. Research Applicability

We describe what the software makes possible, and distinguish that carefully from
what has been done with it.

**What the artifact provides.** The platform stores event-level data in an
open, queryable form rather than as pre-aggregated counters. Two interfaces
expose it: a read-only SQL editor scoped to the querying user's own sites, and a
Model Context Protocol server exposing nineteen read-only tools. The
deterministic dataset generator produces reproducible synthetic traffic at
configurable scale, which is usable independently of the platform for evaluating
analytical query performance.

These properties suggest applicability to studies of web analytics query
workloads, to comparisons of storage engines under analytics-shaped access
patterns, and to research on privacy-preserving measurement — with the important
caveat that any such use would be by researchers who are themselves the site
operators, since the system deliberately provides no cross-tenant access.

> **[GAP — no research use has occurred.]** No research question has been
> answered using this software. No dataset has been collected, analysed, or
> published with it. No researcher outside the author has used it, and there is
> no collaboration to report. The paragraph above describes *affordances*, and
> affordances are not a use case.
>
> Three honest resolutions exist: (a) conduct a study and report it; (b) frame
> the submission as a **software paper**, where the artifact itself is the
> contribution and this section is dropped rather than padded; or (c) present a
> worked analysis over the synthetic dataset, labelled explicitly as a
> demonstration and not as research. Option (b) matches what currently exists.

---

## 7. Limitations

We separate architectural limits, which follow from the design, from
implementation limits, which could be addressed without redesign.

### 7.1 Architectural

**The system cannot be horizontally scaled.** Three pieces of state are local to
a single process: the embedded DuckDB file, the synchronisation lock (a
process-local variable), and the query cache (an in-memory map). Running a second
API replica would produce two uncoordinated synchronisation loops writing to one
database file. This is not a configuration gap; nothing in the design arbitrates
across processes. The consequence is no high-availability deployment and a single
point of failure.

**Analytics are eventually consistent.** The dashboard reads a replica that
trails the write store. Synchronisation lag and cache TTL compound: a headline
KPI can be approximately 90 seconds behind reality. What the interface labels
"realtime" is a 10-second cache over data that may already be a minute old.

**Deletions do not propagate outside retention.** Both cursor strategies are
additive, so neither can observe a row that has been removed from PostgreSQL. A
manual `DELETE` leaves the row queryable in DuckDB indefinitely; only the
retention path mirrors deletions to both stores. There is no cross-store
transaction, so a crash between the two deletions leaves them inconsistent until
the next cleanup.

**Ingest is necessarily unauthenticated.** The tracking script runs on arbitrary
pages, so ingest endpoints cannot require credentials. Anyone who learns a site
identifier can inject events, and rate limiting is per-process and per-IP rather
than per-site.

### 7.2 Implementation

Retention is disabled by default, so an unattended deployment retains data
indefinitely. The analytical store defaults to a relative filesystem path, which
on an ephemeral host means it is discarded and rebuilt on every restart.
PostgreSQL connections enable TLS in production but without certificate
verification. No Content-Security-Policy is set. No external security audit has
been performed on any component.

### 7.3 Measurement

The evaluation limits in §5.3 apply. Beyond those, we have not measured the
synchronisation process itself — throughput, lag under sustained load, or
recovery time after an outage — and we have not established empirically where the
single-process ceiling binds. Correctness of the synchronisation logic is covered
by tests; its performance is not characterised.

---

## 8. Software Availability

InsightTrack is available at `https://github.com/NishikantaRay/InsightTrack`
under the MIT licence. The repository includes the platform, the benchmark
harness, the raw result files underlying §5, and the test suites referenced
throughout.

> **[GAP — archival release]** There is no tagged release, no GitHub release, and
> no Zenodo deposit or DOI. `CITATION.cff` is present but deliberately omits
> `version`, `date-released`, `doi`, and ORCID. A submission requires an
> archived, versioned artifact.

---

## 9. AI Usage Disclosure

> **[GAP — must be written by the author.]** This section is deliberately left
> unwritten. Substantial portions of this repository's documentation, tests, and
> code were produced with AI assistance, and a disclosure drafted by the same
> assistance would be self-serving.
>
> A complete disclosure should state which artifacts were AI-assisted, at what
> stage, under what human review, and — most importantly — how the empirical
> claims in §5 and the security and privacy properties in §4 were independently
> verified by the author. It should also note that of the repository's commits,
> only a subset carry AI co-authorship trailers, so the commit history alone
> understates the extent of assistance.

---

## 10. Conclusion

We have described a self-hosted analytics platform that separates its write path
from its read path across a transactional database and an embedded columnar
engine, obtaining the query characteristics of an analytical store without
requiring a second service to operate. We reported a reproducible evaluation
showing the columnar read path completing a twelve-query analytical suite roughly
eight times faster at one million events on a single machine, together with the
conditions under which that measurement does and does not generalise, and a case
where the columnar engine performs worse.

The architecture is not novel, and we do not present it as such. What we offer is
a documented, tested, and reproducibly evaluated implementation, with its limits
stated plainly — including a single-process ceiling, eventual consistency, and an
evaluation confined to one machine and one workload shape.

---

## Appendix A — Reproducing the evaluation

```bash
git clone https://github.com/NishikantaRay/InsightTrack
cd InsightTrack/apps/analytics-api && npm ci
node scripts/benchmarking/run-engine-benchmark.js
```

Requires Docker (an ephemeral PostgreSQL container is provisioned automatically).
Results are written to `benchmark-results/` as JSON and CSV, each recording the
dataset fingerprint, the seed, environment details, and per-query statistics.

## Appendix B — Outstanding work before submission

| § | Gap | Blocking? |
|---|---|---|
| 1 | No user or deployment evidence | No — scope claims to the technical argument |
| 2 | No citations; no comparison to the peer set | **Yes** |
| 4 | No adversarial privacy evaluation | No — but strengthens materially |
| 5 | `gitDirty: true`; no losing workload; single machine | **Yes** for the dirty tree |
| 6 | No research use has occurred | **Yes** — reframe as a software paper |
| 8 | No tag, release, or DOI | **Yes** |
| 9 | Disclosure unwritten | **Yes** — author only |
