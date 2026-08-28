# Paper Evidence Map

Maps each planned paper section to evidence that exists in this repository, and
records what is missing. **This is not the paper** — it is the inventory that
determines whether the paper can honestly be written, and what must be produced
first.

Every "source file" below was confirmed to exist at the time of writing. Every
"missing evidence" item is something a reviewer could reasonably ask for and that
the repository cannot currently supply.

## Readiness at a glance

| § | Section | Evidence | Blocking gaps |
|---|---|---|---|
| 1 | Abstract | Derivative of §2–§6 | None of its own |
| 2 | Statement of Need | Weak | No user/deployment evidence |
| 3 | Related Work | **Very weak** | No citations, one competitor, self-assessed |
| 4 | Architecture | **Strong** | None |
| 5 | Privacy Model | **Strong** | No adversarial evaluation |
| 6 | Performance Evaluation | Moderate | Single machine, single run, 1M ceiling |
| 7 | Research Use Case | **Absent** | No use case exists |
| 8 | Reproducibility | **Strong** | Dirty benchmark commit |
| 9 | Limitations | **Strong** | None |
| 10 | Software Availability | Strong | No release, tag, or DOI |
| 11 | AI Usage Disclosure | **Absent as a document** | Trailers on 4 of 26 commits |

**Three sections cannot currently be written honestly:** Related Work (§3),
Research Use Case (§7), and AI Usage Disclosure (§11).

---

## 1. Abstract

**Evidence.** Nothing specific to the abstract; it is a summary of §2–§6. The
substantive claims it would make are supported where those sections are.

**Source files**
- `README.md` — one-paragraph framing of the system
- `CITATION.cff` — an abstract already drafted for archival metadata

**Unresolved claims**
- The abstract will want a headline performance number. Any such number must
  carry the qualifiers in §6 — "7.9× on a 12-query analytical workload at 1M
  events on one machine" is defensible; "7.9× faster" is not.
- Calling the dual-database split "novel" is not supportable. Separating OLTP
  writes from an OLAP read replica is established practice; the contribution is
  the packaging, not the pattern.

**Missing evidence**
- None beyond what §2–§6 require.

---

## 2. Statement of Need

**Evidence.**
- A working, documented system with a stated audience (self-hosters wanting
  privacy-preserving analytics without a warehouse to operate).
- A category comparison establishing that InsightTrack occupies the
  Plausible/Fathom niche rather than the PostHog/Amplitude one.

**Source files**
- `README.md` — positioning and feature surface
- `docs/posthog-gap-analysis.md` — code-verified comparison against one competitor
- `docs/LIMITATIONS.md` — the honest boundary of what it does not do
- `docs/getting-started.md`, `docs/deployment.md` — that the need is met in practice

**Unresolved claims**
- "Deploy in under 15 minutes" (`README.md:14`) is untested as a measured claim.
  `docs/E2E_VERIFICATION.md` shows the stack comes up and works, but no one has
  timed a naive user.
- Any claim that existing tools are inadequate is currently assertion, not
  evidence.

**Missing evidence**
- **No users.** No deployment count, no issue-tracker activity from third
  parties, no citations, no testimonials. For JOSS this matters: the reviewer
  asks who needs this and what they do with it.
- No survey or literature basis for the claimed need.
- No measured onboarding time.

---

## 3. Related Work

**Evidence.** One document, comparing against one product, written from this
repository's own perspective.

**Source files**
- `docs/posthog-gap-analysis.md` — the only comparative artifact; explicitly
  self-produced ("Produced 2026-07-07 from the actual codebase")

**Unresolved claims**
- The Plausible/Fathom/Simple Analytics categorisation is asserted without any
  feature-level or citation-level support.
- No claim about how InsightTrack differs from Matomo, Umami, GoatCounter,
  Plausible, or Fathom is currently backed by anything.

**Missing evidence — this is the weakest section**
- **No academic citations of any kind.** There is no bibliography anywhere in the
  repository.
- **No comparison against the actual peer set.** PostHog is a different product
  class, as that document itself says — so the one comparison that exists is
  against something outside the relevant category.
- **No prior-art discussion for the specific technical claims**: embedded OLAP
  replicas for analytics reads, LLM-facing SQL sandboxes, or MCP exposure of
  analytics data. `docs/REPOSITORY_AUDIT.md:846` already flags that
  validation-by-allowlist is "well-trodden" and publishable only with an
  adversarial evaluation.
- **No positioning against DuckDB-adjacent research.** DuckDB has its own
  literature (CIDR/SIGMOD); a paper using it as the core of its argument must
  engage with that.

**Assessment.** This section cannot be written from repository contents. It
requires literature work that has not been done.

---

## 4. Architecture

**Evidence.** The strongest technical section. Complete, code-referenced, with
per-stage failure analysis.

**Source files**
- `docs/DATA_FLOW.md` — full seven-stage lifecycle, browser → dashboard, with
  file:line references and failure points at every stage
- `docs/architecture.md`, `docs/backend-architecture.md` — component structure
- `docs/pg-duckdb-sync.md` — sync design
- `docs/hot-cold-analytics-architecture.md` — the S3/Parquet tiering
- `docs/performance-architecture.md`, `docs/caching.md` — read path and caching
- `apps/analytics-api/src/sync/sync.js` — the dual-cursor implementation
- `apps/analytics-api/src/schema/schema.js` — `SYNCABLE_TABLES` and the two
  documented exclusions
- `apps/analytics-api/tests/syncScenarios.test.js` — 24 tests covering timestamp
  boundaries, duplicates, incremental sync, interruption, restart, concurrency

**Unresolved claims**
- The hot/cold Parquet tiering is implemented but **gated behind S3 credentials
  and off by default**. A paper describing it as part of the architecture must
  say it is opt-in and, as noted in §6, unbenchmarked.
- `docs/hot-cold-analytics-architecture.md` and `CHANGELOG-2026-05-02.md` cite
  v1→v2 speedups (620 ms → 25 ms) from a **May 2026 measurement with no
  preserved raw data**. Do not reuse those figures; only the August benchmark has
  retained artifacts.

**Missing evidence**
- No architecture diagram suitable for publication (the in-app
  `ArchitectureDiagram` is a React component, not a figure).
- No measurement of the sync process itself — throughput, lag under load, or
  recovery time after an outage. The tests prove correctness, not performance.

---

## 5. Privacy Model

**Evidence.** Strong, and unusually candid — the audit documents what the system
gets wrong as well as right.

**Source files**
- `docs/PRIVACY_AUDIT.md` — 11 data elements with purpose/collected/stored/
  retention/concern, plus a table of claims that cannot be verified
- `docs/DATA_FLOW.md` — where each identifier is created and what reaches storage
- `apps/analytics-api/src/utils/urlPrivacy.js` — parameter redaction at ingest
- `apps/analytics-api/src/services/sitesService.js` — DNT/GPC gate before any
  storage access; visitor-ID rotation
- `apps/analytics-api/src/routes/tracking.js` — server-side opt-out on all six
  ingest routes
- `apps/analytics-api/tests/urlPrivacy.test.js` (27 tests),
  `tests/trackingScriptPrivacy.test.js` (23),
  `tests/trackingUrlSanitisation.test.js` (7 end-to-end against PostgreSQL)
- `docs/SECURITY_PRIVACY_CLAIMS_AUDIT.md` — earlier claims reconciliation

**Verifiable properties** (each has a test or a schema check)
- No cookies; no canvas/WebGL/audio/font fingerprinting
- No IP address column in any table
- Raw User-Agent never transmitted or stored
- DNT/GPC honoured client-side *and* server-side
- Sensitive URL parameters redacted before storage

**Unresolved claims**
- **Do not write "GDPR compliant."** The repository makes no compliance claim and
  cannot support one. `docs/LIMITATIONS.md` says so explicitly.
- "No third-party data sharing" is true of the tracking script but false of the
  system: Pulse transmits analytics data to an LLM provider when configured.
- Parameter redaction is a **denylist**. It closes the common accidental leak; it
  is not a guarantee.

**Missing evidence**
- **No adversarial evaluation.** No attempt to re-identify visitors from stored
  data, and no measurement of how much the coarse device/browser/OS buckets
  actually reduce fingerprinting entropy. A privacy claim in a paper invites
  exactly this test.
- No comparison of what InsightTrack stores versus what Plausible/Matomo store.
- No external audit.

---

## 6. Performance Evaluation

**Evidence.** A genuinely reproducible benchmark with retained raw data — but
narrow.

**Source files**
- `docs/PERFORMANCE_BENCHMARK.md` — methodology and results
- `docs/PERFORMANCE_BENCHMARK_AUDIT.md` — audit of the benchmark's own validity
- `scripts/benchmarking/dataset.js` — seeded (mulberry32) generator
- `scripts/benchmarking/workload.js` — 12 queries, with the rationale for each
  rewrite recorded in comments
- `scripts/benchmarking/stats.js` — median/p95/p99/σ
- `apps/analytics-api/scripts/benchmarking/run-engine-benchmark.js` — runner
- `benchmark-results/*.json` and `*.csv` — **raw retained data, 2 dataset sizes**

**Measured results** (medians across the 12-query suite)

| Dataset | PostgreSQL | DuckDB | Ratio |
|---|---|---|---|
| 100,000 events | 195 ms | 57 ms | 3.4× |
| 1,000,000 events | 1,199 ms | 151 ms | 7.9× |

Methodology strengths worth stating in the paper: result-equality verified
between engines **before** any timing was recorded; 5 warmup + 30 measured
iterations; engine order alternated per iteration; PostgreSQL given 7 indexes
and tuning; queries rewritten to help PostgreSQL (2,972 ms → 1,199 ms) with the
same SQL run on both engines, so DuckDB bears the cost of the rewrite.

**Unresolved claims**
- DuckDB won all 12 queries at both sizes. That is the outcome; it is **not**
  evidence that DuckDB always wins. The workload is analytical aggregation.
- The comparison is **in-process DuckDB versus PostgreSQL over a socket**. Part
  of the gap is architectural, and the benchmark does not separate engine
  capability from transport.
- DuckDB's load time is ~2× worse (47.5 s vs 23.2 s at 1M). Report it.

**Missing evidence**
- **Single machine, single run.** Apple M4, 10 cores, 16 GB. No second machine,
  no cloud instance, no constrained container. Variance is reported *within* a
  run, not *across* runs — so there are no confidence intervals in the sense a
  reviewer means.
- **1M events is the ceiling tested.** No support for any claim beyond that.
- **No point-lookup or write-heavy workload**, where PostgreSQL would be expected
  to do better. A fair paper should include a workload the system loses.
- **No end-to-end latency.** Database execution time only — HTTP, serialisation,
  auth, and cache are excluded, so this is not user-perceived performance.
- **No concurrency testing.** All measurements are single-client.
- **No hot/cold or S3 measurement**, despite that being an architectural claim.
- `environment.gitDirty: true` in both result files — the exact tree state is not
  recoverable from the recorded commit hash.

---

## 7. Research Use Case

**Evidence.** **None.**

**Source files**
- None exist.

**Unresolved claims**
- Every claim this section would make is currently unsupported.

**Missing evidence — this section cannot be written**
- No research question has been answered using this software.
- No dataset has been collected, analysed, or published with it.
- No researcher has used it, and there is no collaboration to describe.
- The SQL Editor and MCP interface are plausible *enablers* of research use, but
  "could be used for research" is not a use case. `docs/REPOSITORY_AUDIT.md:846`
  reaches the same conclusion about the SQL sandbox: publishable only as a
  hardening case study, and only with an adversarial evaluation.

**Options.** Either (a) run a real study using the software and report it, (b)
recast the paper as a *software* paper (JOSS's actual model) where the artifact
itself is the contribution and this section is dropped, or (c) demonstrate a
concrete analysis pipeline on the synthetic dataset and present it explicitly as
a worked example, not as research.

Option (b) is the honest fit for what exists today.

---

## 8. Reproducibility

**Evidence.** Strong — this is among the better-supported sections.

**Source files**
- `docs/REPRODUCIBILITY_AUDIT.md` — audit of whether a clean checkout works
- `docs/E2E_VERIFICATION.md` — live end-to-end verification, dated 2026-08-28
- `CONTRIBUTING.md` — setup, every command executed before documenting
- `docs/running-locally.md` — authoritative manual setup
- `docker-compose.yml` + `.env.example` — one-command stack, 75 documented vars
- `.github/workflows/ci.yml` — API tests, dashboard tests + build, and a compose
  smoke test that boots the stack and verifies an event survives the sync
- `scripts/benchmarking/` — seeded generator; `seed: 42` recorded in every result
- Test suite: **29 API test files, 9 dashboard, 5 Playwright E2E**

**Verified facts**
- The benchmark dataset is deterministic (seeded PRNG, fingerprint recorded in
  each result file).
- The API test suite provisions its own throwaway PostgreSQL container, so it
  runs on a clean checkout with no manual database setup.

**Unresolved claims**
- `gitDirty: true` in both benchmark result files means the benchmarked tree
  cannot be reconstructed exactly. **Re-run the benchmark from a clean tree
  before submission.**
- CI has never actually executed — the workflow is committed but the branch is
  unpushed, so there is no green run to point at.

**Missing evidence**
- No archived environment (no Docker image digest, no lockfile hash recorded
  alongside results).
- No second-machine reproduction of the benchmark by anyone.
- No Zenodo deposit, so no immutable artifact to cite.

---

## 9. Limitations

**Evidence.** Strong and unusually thorough; largely ready to condense.

**Source files**
- `docs/LIMITATIONS.md` — eleven categories, each verified against code or raw
  benchmark data
- `docs/PRIVACY_AUDIT.md` — residual privacy limitations
- `docs/PERFORMANCE_BENCHMARK_AUDIT.md` — benchmark validity limits
- `SECURITY.md` — stated security limitations, including no external audit

**Key limitations a reviewer will focus on**
- **Single-process ceiling.** DuckDB is an embedded file, the sync lock is a
  module-level variable, and the cache is in-memory — so the API cannot be
  horizontally scaled. This is architectural, not configuration.
- **Eventual consistency**, with worst-case ~90 s staleness for a KPI.
- **Manual PostgreSQL deletes never propagate** to DuckDB; only retention does.
- **Retention is off by default**, so the realistic default is unbounded growth.
- **Pulse sends analytics data to a third party**, contradicting strict
  self-hosting.

**Unresolved claims**
- None. This document was written to avoid them.

**Missing evidence**
- No measurement of *where* the single-process ceiling actually binds — no load
  test establishing the events/second or concurrent-user limit.

---

## 10. Software Availability

**Evidence.**

**Source files**
- `LICENSE` — MIT, verified byte-for-byte against the canonical text
- `CITATION.cff` — machine-readable citation metadata, structurally valid
- `README.md` — install and usage
- `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`
- `.github/workflows/ci.yml`
- Repository: `https://github.com/NishikantaRay/InsightTrack`

**Unresolved claims**
- Package versions are meaningless as release markers: every `package.json` has
  read `1.0.0` since the initial commit and has never been bumped
  (`CHANGELOG.md` states this).

**Missing evidence**
- **No tagged release.** Zero git tags locally and on the remote.
- **No GitHub release**, which follows from having no tags.
- **No Zenodo deposit and no DOI.** JOSS requires an archived, versioned release.
- `CITATION.cff` deliberately omits `version`, `date-released`, `doi`, and
  `orcid` — all four are required before submission, and the ORCID must be a real
  one.
- **The current work is unpushed.** Four commits sit detached at `d597356` while
  `HEAD` is at `a70ca0a`; the security hardening, licensing, CI, privacy fixes,
  and all documentation cited throughout this map are **not on any branch and not
  on the remote**. Nothing in §4–§9 is externally verifiable until that is
  resolved.

---

## 11. AI Usage Disclosure

**Evidence.** Fragmentary, and the most likely to be judged inadequate.

**Source files**
- Four commits carry `Co-Authored-By: Claude Opus 5` in their trailers:
  `2ee4121`, `7f6798b`, `0f40242`, `d597356` — all currently **detached**
- `CLAUDE.md` — project instructions written for an AI assistant, committed to
  the repository
- `.claude/skills/insighttrack/` — a skill package documenting AI-assisted
  workflows, including a three-copy sync procedure

**Verified facts**
- Of 26 commits total (22 on `main` + 4 detached), **only the 4 detached ones
  carry an AI co-authorship trailer**. The 22 commits on `main` carry none,
  despite `CLAUDE.md` and `.claude/` establishing that AI assistance was in use
  across the project's history.
- Substantial portions of the documentation cited throughout this map were
  AI-generated, including `DATA_FLOW.md`, `PRIVACY_AUDIT.md`, `LIMITATIONS.md`,
  `CONTRIBUTING.md`, `CHANGELOG.md`, `SECURITY.md`, and this file.

**Unresolved claims**
- The **extent** of AI involvement in the 22 `main` commits is not recorded
  anywhere and cannot now be reconstructed from the repository.

**Missing evidence**
- **No disclosure document exists.** There is no statement of what was
  AI-assisted, at what stage, or under what human review.
- No record of which code was AI-generated versus human-written.
- No statement of the author's verification process — which matters most for the
  benchmark and the security work, where an unverified AI claim would be a
  serious problem.

**This section must be written from scratch, by the author.** It cannot be
derived from repository contents, and it is the one section where an AI-drafted
answer would itself be a conflict of interest. A venue-appropriate disclosure
should state: which artifacts were AI-assisted, that the author reviewed and is
accountable for all claims, and how the empirical results were independently
checked.

---

## Recommended order of work

1. **Push the detached commits.** Everything in §4–§9 is unverifiable until the
   work is on a branch and on the remote.
2. **Write the AI disclosure (§11)** — author-written, not generated.
3. **Decide the paper's framing (§7).** A software paper drops the research use
   case honestly; a research paper requires a study that does not yet exist.
4. **Do the literature work (§3).** This is the largest genuine gap and cannot be
   filled from the codebase.
5. **Re-run the benchmark from a clean tree** to clear `gitDirty`, and add at
   least one workload PostgreSQL wins (§6).
6. **Tag a release and deposit to Zenodo**, then complete `CITATION.cff` (§10).
7. Optional but strengthening: an adversarial privacy evaluation (§5) and a load
   test establishing the single-process ceiling (§9).

## Related documentation

- [`../LIMITATIONS.md`](../LIMITATIONS.md)
- [`../PRIVACY_AUDIT.md`](../PRIVACY_AUDIT.md)
- [`../PERFORMANCE_BENCHMARK.md`](../PERFORMANCE_BENCHMARK.md)
- [`../DATA_FLOW.md`](../DATA_FLOW.md)
- [`../REPRODUCIBILITY_AUDIT.md`](../REPRODUCIBILITY_AUDIT.md)
