# Reproducibility Audit

**Audit date:** 2026-08-28
**Repository:** `InsightTrack` (public-facing)
**Question:** can a new developer, reviewer, or researcher reproduce this project from a clean checkout using only what is documented?
**Type:** Audit only. No code, tests, benchmarks, or documentation were changed.

---

## Executive summary

**Overall reproducibility: PARTIAL.**

The **Docker path works and is correctly documented** — a newcomer following the README's "One command" section gets a running stack. Every test suite runs from a clean environment with **zero manual setup**, which is unusual and genuinely good: the harness provisions its own PostgreSQL container and an isolated DuckDB file.

Three things prevent a **PASS**:

1. **The README's manual-setup instructions point at directories that do not exist.** `cd analytics-db` and `cd analytics-dashboard` are the *other* repository copy's names. A reader who skips Docker hits a dead end within two commands. The correct paths exist and are documented in `docs/running-locally.md`, but the README never points there for this step.
2. **The published benchmark numbers cannot be reproduced.** The committed harness measures cached HTTP responses through the API; the documented table reports DuckDB engine timings at 1M/10M/100M rows. No dataset generator, no environment specification, and no PostgreSQL baseline exists for the headline comparison.
3. **17 environment variables are referenced in code but documented nowhere**, including `ENCRYPTION_KEY` (which governs at-rest encryption of stored secrets) and `DATABASE_URL`.

None of these blocks the core project from *running*. They block a reviewer from reproducing it *as documented*, and block anyone from reproducing the performance claims at all.

---

## Setup

| Area | Result | Problem |
|---|---|---|
| Dependencies | **PARTIAL** | Node version stated only in prose ("Node.js 20+"); no `engines` field on the two main packages, no `.nvmrc`, no `packageManager` pin. `appsv2` and `traffic` ship without lock files for some packages. |
| PostgreSQL | **PASS (Docker)** / **PARTIAL (manual)** | Compose provisions `postgres:15-alpine` with a healthcheck. Manual path needs `PG_*` vars that are absent from the root `.env.example`. |
| DuckDB | **PASS** | Embedded; the file is created automatically. No external setup. |
| Docker | **PASS** | `docker compose config` parses cleanly against `.env.example`. Build contexts (`./apps/analytics-api`, `./apps/dashboard-web`) are correct. |
| API | **PASS** | All documented npm scripts exist and their target files exist (`migrate`, `seed`, `init`, `sync`, `start`, `test`). |
| Dashboard | **PASS** | Builds cleanly; `.env.example` present with `VITE_API_URL`. |
| Tracking | **NOT VERIFIED end-to-end** | The script is generated per-site at `/api/sites/:siteId/script`; the flow is documented. Not exercised live in this audit — see *Not verified*. |

### Verified working

- `docker compose config` parses with the shipped `.env.example`.
- All six documented backend npm scripts resolve to files that exist.
- `docs/running-locally.md` contains **correct** paths (`cd apps/analytics-api`, `cd apps/dashboard-web`) and a complete init sequence.
- A frontend `.env.example` exists at `apps/dashboard-web/.env.example`.
- A far more complete backend `.env.example` exists at `apps/analytics-api/.env.example` (~50 variables with explanatory comments).

### Undocumented local knowledge required

1. **That `apps/analytics-api/.env.example` exists.** It is the real configuration reference, and nothing in the README mentions it. The root `.env.example` is Docker-oriented and omits every `PG_*` variable.
2. **That the README's manual paths are wrong** and `docs/running-locally.md` is authoritative.
3. **That Docker is required to run the test suites** (the harness starts a container; without Docker the DB-backed suites fail with a warning rather than a clear prerequisite error).
4. **Which of `apps/` and `appsv2/` is canonical** — both are buildable and both have Compose files.

### Not verified in this audit

A full live boot (`docker compose up`, register, create site, fire a tracking event, watch it sync, see it in analytics) was **not** executed. The audit verified configuration validity, script existence, and code paths, but did not stand the stack up end to end. Items 5–8 of the brief's "fresh checkout test" are therefore **NOT VERIFIED** rather than passed — this is a real gap in this audit, not an implied pass.

---

## Tests

Every command below was executed during this audit. Counts are observed, not quoted from earlier reports.

| Suite | Command | Result | Reproducible? |
|---|---|---|---|
| Backend (all) | `cd apps/analytics-api && npm test` | **24 files, 354 passed**, 8.77s | **Yes** — auto-provisions PostgreSQL; needs Docker |
| — SQL Editor security | `npx vitest run tests/sqlEditorSecurity.test.js` | **98 passed** | Yes — no DB needed |
| — Tracking opt-out (client) | `npx vitest run tests/trackingScriptOptOut.test.js` | **14 passed** | Yes — no DB needed |
| — Tracking opt-out (server) | `npx vitest run tests/trackingOptOutServer.test.js` | **13 passed** | Yes — needs DB (auto) |
| — Retention consistency | `npx vitest run tests/retentionCleanup.test.js` | **12 passed** | Yes — needs DB (auto) |
| Frontend unit | `cd apps/dashboard-web && npm test` | **9 files, 55 passed** | **Yes** — no prerequisites |
| Frontend build | `cd apps/dashboard-web && npm run build` | **✓ built in 2.66s** | **Yes** |
| Lint / typecheck | — | **Not available** | No script exists in any package |
| E2E (Playwright) | `npm run test:e2e` | **Not executed** | Prerequisites present (Playwright 1.58.2, chromium cached) but requires a **running backend + frontend**; not stood up here |

**Security-relevant total: 137 tests** across the four suites above.

**Notable strength.** `tests/globalSetup.js` starts a throwaway `postgres:15-alpine` container on port 55433 and points the suite at an isolated DuckDB file, removing both afterwards. `npm test` therefore works from a clean checkout with no manual database setup, and never touches a developer's own data. `TEST_PG_EXTERNAL=1` opts out. This is documented in `docs/testing.md`.

**Caveat:** Docker is now an undeclared *test* prerequisite. Without it the DB-backed suites fail; the harness prints a warning but the failure mode is not obvious to a newcomer, and no `engines`/prerequisite note states it.

---

## Benchmarks

| Benchmark | Documented result | Reproduced result | Status |
|---|---:|---:|---|
| KPI query @ 1M rows | 9 ms | — | **NOT REPRODUCIBLE** |
| KPI query @ 10M rows | 88 ms | — | **NOT REPRODUCIBLE** |
| KPI query @ 100M rows | 3.9 s → <5 ms with `daily_stats` | — | **NOT REPRODUCIBLE** |
| Traffic / Top-pages @ 10M–100M | 42 ms / 522 ms / 869 ms | — | **NOT REPRODUCIBLE** |
| Hot/cold before-after table (`hot-cold-analytics-architecture.md`) | 1.5×–25× | — | **NOT REPRODUCIBLE** |
| "10–100× faster than a row store" (README) | 10–100× | — | **NO BASELINE EXISTS** |

### Why they cannot be reproduced

Traced against `scripts/benchmark.js` and `docs/performance-architecture.md`:

1. **No dataset generator for the published sizes.** The documented table reports 1M / 10M / 100M rows. `scripts/load-test-data.js` can generate events, but nothing ties it to those figures, and no seed or deterministic generation is specified. A reproducer cannot construct the same dataset.
2. **The harness measures the wrong layer.** `scripts/benchmark.js` issues HTTP requests to `/api/analytics/*` and reports `cold` (first run) and `warm` (mean of runs 2–3). Those requests pass through the application's TTL cache (10–120 s). The script's own output labels sub-3 ms results with a rocket icon, and two of its cases are explicitly named "cache hit" and "cache-warm". **Warm numbers are cache-hit latency, not DuckDB query time.** The documented table reports engine-level timings the harness never measures.
3. **n = 3, no distribution.** `bench(..., runs = 3)` — one cold value plus a two-run mean. No median, p95, p99, standard deviation, or outlier handling.
4. **No environment specification.** "Apple M4" is the entire hardware description. No RAM, OS version, Node version, DuckDB version, thermal state, or whether Docker was involved (the doc says "same engine used in Docker", which is ambiguous).
5. **No PostgreSQL baseline anywhere.** The README's headline "10–100× faster than a row store" has no comparison measurement in the repository. The claim is asserted, never made.
6. **No PostgreSQL or DuckDB configuration recorded** — no `shared_buffers`, `work_mem`, `memory_limit`, or `threads` settings.
7. **No raw data committed.** Only summary tables in prose; no CSV, JSON, or logs.

### What *is* reproducible

`scripts/benchmark.js` now **fails closed** with a clear message when `BENCHMARK_EMAIL` / `BENCHMARK_PASSWORD` / `BENCHMARK_SITE_ID` are unset (verified by running it). `docs/benchmarking.md` documents these and carries an explicit note that the harness is not publication-grade. So the *harness* is runnable by a third party against their own instance — but it cannot produce the *published numbers*.

---

## Environment

### Undocumented (referenced in code, absent from both `.env.example` files) — 17

| Variable | Concern |
|---|---|
| `ENCRYPTION_KEY` | **Security-relevant.** Governs AES-256-GCM encryption of stored BYO AI keys and Sentry tokens. Falls back to `JWT_SECRET` when unset, so rotating `JWT_SECRET` silently invalidates every stored secret. An operator cannot make an informed choice about a variable they never see. |
| `DATABASE_URL` | Alternative to the `PG_*` set; takes precedence in `createPool()`. A user setting both may get behaviour they did not expect. |
| `SQL_EDITOR_TIMEOUT_MS`, `SQL_EDITOR_MAX_TIMEOUT_MS` | Control SQL Editor resource limits. |
| `MCP_TOKEN_EXPIRES_IN` | Long-lived MCP connect token lifetime (default 365 d). |
| `ANTHROPIC_BASE_URL`, `OPENAI_BASE_URL` | LLM endpoint overrides (Gemini's *is* documented; these two are not). |
| `PUBLIC_API_URL` | |
| `SENTRY_*` (9 vars) | `SENTRY_POLL_INTERVAL_MS`, `SENTRY_TIMEOUT_MS`, `SENTRY_MAX_ISSUES`, `SENTRY_ISSUES_PER_POLL`, `SENTRY_STATS_PERIOD`, `SENTRY_POLL_CONCURRENCY`, `SENTRY_CADENCE_BASE_S`, `SENTRY_CADENCE_MAX_S`, `SENTRY_CADENCE_AUTH_FAIL_S` — integration-specific tuning. |

### Inconsistency between the two templates

- Root `.env.example` (18 vars) is **Docker-oriented**: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `PGADMIN_*`. These five are consumed by `docker-compose.yml`, **not by application code** — correct, but a reader cannot tell.
- `apps/analytics-api/.env.example` (~50 vars) is the **application** reference, including all `PG_*`. It is not referenced from the README.
- Net effect: a reader following the README for a manual setup has **no documented source** for `PG_HOST`/`PG_USER`/`PG_PASSWORD`/`PG_DATABASE`.

### Test-only variables

`TEST_PG_PORT` and `TEST_PG_EXTERNAL` are documented in `docs/testing.md` but appear in no `.env.example`. Acceptable, noted for completeness.

---

## Repository hygiene

| Check | Result |
|---|---|
| Committed build artifacts | **350 tracked files** under `appsv2/passmark-tests/playwright-report/`, `test-results/` (screenshots, zips, traces, `.last-run.json`) |
| Absolute machine-specific path | **1** — `scripts/generate-report-pdf.js:10` imports from `/Users/<user>/Desktop/Personal/traffic2/appsv2/passmark-tests/node_modules/playwright/index.js` |
| Lock-file consistency | `apps/*` have lock files. Some `appsv2`/`traffic` packages gained them only when dependencies were installed during earlier tasks. |
| Undocumented ports | Test harness uses **55433** (documented in `docs/testing.md`). Compose publishes 5432 and 5050 to the host by default. |
| Required external services | Docker (runtime + tests). Optional: S3/R2, Sentry, an LLM provider. |

**`scripts/generate-report-pdf.js` is broken for everyone.** Verified: the `traffic2` directory does not exist on this machine either, and running the script fails with `ERR_MODULE_NOT_FOUND`. It cannot work on any checkout.

---

## Three-copy consistency

**VERIFIED — no undocumented behavioural differences in security-critical code.**

All seven security-relevant files are byte-identical across `apps/analytics-api`, `appsv2/analytics-api`, and `traffic/analytics-db`:

```
sitesService.js (tracking script + DNT/GPC)   ✅
sqlGuard.js     (SQL Editor boundary)          ✅
sqlEditor.js    (endpoints)                    ✅
tracking.js     (server-side opt-out)          ✅
reportingService.js (retention)                ✅
sync.js         (PG→DuckDB + retention delete) ✅
schema.js       (sync table config)            ✅
```

`diff -rq` over the whole `src/` tree and the whole `tests/` tree:
- `apps` vs `traffic/analytics-db`: **no differences**
- `apps` vs `appsv2`: **one extra file** — `appsv2/analytics-api/src/routes/sync.js`

**The one real risk is canonicity, not drift.** Two buildable copies ship in the public repo (`apps/` + `docker-compose.yml`, `appsv2/` + `docker-compose.v2.yml`) with no statement of which to use. A reviewer cannot tell which one the documentation, screenshots, or benchmarks describe.

---

## Documentation vs reality

| Finding | Location | Detail |
|---|---|---|
| **Directories do not exist** | `README.md:107, 237, 339-341` | `cd analytics-db`, `cd analytics-dashboard` — five occurrences. Real paths are `apps/analytics-api`, `apps/dashboard-web`. |
| Legacy path in structure diagram | `README.md:57, 278` | `analytics-server/` — actual path is `archive/analytics-api-legacy/` |
| Benchmark numbers unsupported | `docs/performance-architecture.md:9-15`, `docs/hot-cold-analytics-architecture.md` | See *Benchmarks* |
| No `engines` / `.nvmrc` | root, `apps/*/package.json` | "Node.js 20+" is prose only; only `mcp-server` declares `engines` |
| Docker not stated as a test prerequisite | `docs/testing.md` | Documented as auto-provisioning, but not listed as a hard requirement |
| `apps/analytics-api/.env.example` unreferenced | `README.md` | The real config reference is invisible to a newcomer |

**Checked and clean:** no documentation references the deleted `docs/SQL_SECURITY_AUDIT.md`; all documented backend npm scripts exist and their files exist; `docs/running-locally.md` paths are correct.

---

## Blockers

### P0 — cannot run/reproduce core project as documented

**P0-1 — README manual-setup paths do not exist.**
`cd analytics-db` / `cd analytics-dashboard` (5 occurrences). A reader who does not use Docker fails at the second command. The Docker path works, so this is a documentation defect rather than a broken product — but for a reviewer following the README it is a hard stop.

**P0-2 — Published benchmark numbers cannot be reproduced.**
No dataset generator for the stated sizes, harness measures cached HTTP rather than engine time, n=3, no environment spec, no PostgreSQL baseline for the headline "10–100×". For a research artifact this is the most serious finding: the central performance claim has no reproducible evidence.

### P1 — significant reproduction problems

**P1-1 — 17 undocumented environment variables**, including `ENCRYPTION_KEY` (at-rest encryption) and `DATABASE_URL` (overrides `PG_*`).

**P1-2 — `PG_*` variables absent from the root `.env.example`**, and the complete backend template is never referenced from the README.

**P1-3 — Two canonical-looking copies** (`apps/`, `appsv2/`) with no statement of which is authoritative.

**P1-4 — `scripts/generate-report-pdf.js` is broken on every machine** (absolute path to a non-existent `traffic2` directory).

**P1-5 — 350 committed build artifacts** (Playwright reports, traces, screenshots, `.last-run.json`) inflating the checkout and adding noise to review.

### P2 — minor documentation/environment issues

**P2-1** — No `engines` field or `.nvmrc`; Node version is prose only.
**P2-2** — No lint or typecheck script in any package.
**P2-3** — Docker not declared as a test prerequisite.
**P2-4** — Legacy `analytics-server/` path in the README structure diagram.
**P2-5** — Root `.env.example` mixes Compose-only variables with application variables without distinguishing them.
**P2-6** — E2E suite requires a manually running stack; no single command orchestrates it.

---

## Recommendations

### 1. Documentation-only fixes

- Correct the five `cd analytics-db` / `cd analytics-dashboard` occurrences in `README.md`; or replace the manual block with a pointer to `docs/running-locally.md`, which is already correct.
- Reference `apps/analytics-api/.env.example` from the README as the configuration reference.
- Fix the `analytics-server/` path in the structure diagram.
- State Docker as a test prerequisite in `docs/testing.md` and the README.
- State which of `apps/` and `appsv2/` is canonical.

### 2. Configuration fixes

- Document the 17 missing variables, prioritising `ENCRYPTION_KEY` and `DATABASE_URL`.
- Split or annotate the root `.env.example` so Compose-only variables are distinguishable from application variables.
- Add `engines: { node: ">=20" }` to the two main packages, plus an `.nvmrc`.
- Add `.gitignore` entries for `playwright-report/`, `test-results/`, and untrack the 350 artifacts.

### 3. Code changes

- Fix or remove `scripts/generate-report-pdf.js` (hardcoded absolute path).
- Add a lint/typecheck script if static checking is wanted in CI.

### 4. Benchmark methodology improvements

Required before any performance claim is publishable:

- A deterministic, seeded dataset generator producing the 1M / 10M / 100M datasets.
- Measure at the **engine** level with the application cache bypassed; measure the cache separately if it is to be characterised.
- n ≥ 30 with median, p95, p99, and standard deviation.
- A full environment specification (hardware, RAM, OS, Node, DuckDB, Docker).
- **The PostgreSQL baseline** — without it, "10–100× faster than a row store" is unsupported.
- Commit raw results as CSV alongside the summary tables.

---

## Scope and honesty notes

- **The live end-to-end flow was not executed.** Items 5–8 of the fresh-checkout test (create site → fire event → see analytics → observe sync) are marked NOT VERIFIED. Standing the stack up would be the natural next step.
- **The E2E Playwright suite was not run** — prerequisites are installed, but it needs a running backend and frontend.
- Test counts and command results above were **observed during this audit**, not carried over from earlier reports.

---

*Audit only. No code, tests, benchmarks, configuration, or documentation were modified.*
