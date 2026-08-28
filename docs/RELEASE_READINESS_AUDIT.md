# Release Readiness Audit

**Date:** 2026-08-28
**Repository:** `InsightTrack` (public-facing)
**Type:** Audit only. No application code, configuration, or documentation was modified.

> **Headline:** the software works. A fresh `docker compose up` was executed during
> this audit and carried a real event from the tracking API through to the
> dashboard analytics in 6 seconds. What blocks release is not the product — it is
> **1.1 GB of committed test artifacts, a missing LICENSE, and 3 critical
> dependency vulnerabilities.**

---

## Executive summary

| Area | Verdict |
|---|---|
| Does the application work? | **PASS** — verified end-to-end, live |
| Docker deployment | **PASS** — verified live |
| Manual deployment | **PARTIAL** — documented and scripted, not run in this audit |
| Cloud deployment (Railway/Vercel) | **NOT VERIFIED** — no platform config files exist |
| Repository hygiene | **FAIL** — 1.1 GB of committed artifacts |
| Legal / licensing | **FAIL** — no LICENSE despite an MIT badge |
| Dependency security | **FAIL** — 3 critical, 21 high |
| Documentation accuracy | **PASS** — paths, scripts and links verified |
| Publication readiness | **PARTIAL** — benchmark is reproducible; packaging is not |

**5 P0 · 7 P1 · 8 P2 · 4 P3.**

---

## 1. Repository hygiene

### H-1 · 1.1 GB of committed Playwright artifacts — **P0**

**Evidence (measured this audit):**

```
appsv2/passmark-tests/playwright-report   524 MB   138 tracked files
appsv2/passmark-tests/test-results        578 MB   212 tracked files
                                        ────────
                                        ~1.1 GB   350 tracked files
```

Individual tracked blobs include `trace.zip` files of **54.3 MB**, **52.8 MB**,
**46.2 MB**. `.git` is **225 MB** — that is what every `git clone` downloads.
Total working tree (excluding `node_modules`/`.git`): **2.7 GB**.

`.gitignore` covers `node_modules/`, `dist/`, `.env`, `*.log`, `duckdb/*.duckdb`,
`data-lake/` — but **not** `playwright-report/` or `test-results/`.

**Risk:** a 225 MB clone for a project whose source is a few MB. It reads as an
unfinished repository, and it is the single largest barrier to anyone casually
trying the project.

**Action:** add the two paths to `.gitignore` and untrack them. Note this only
shrinks *new* clones; the history still carries the blobs unless it is rewritten.

### H-2 · 111 tracked screenshots (~13.5 MB) — **P2**

`screenshots/` (5.9 MB), `apps/screenshots/` (4.3 MB), `appsv2/screenshots/`
(3.3 MB). The README embeds some, so these are partly legitimate — but three
near-duplicate copies is not. **Action:** keep one set, drop the duplicates.

### H-3 · `benchmark-results/` is untracked and not ignored — **P1**

15 MB of JSON/CSV/PNG/PDF sits untracked. A `git add -A` would commit all of it,
including the generated slide decks. **Action:** decide deliberately — either
gitignore the generated outputs and keep the small result JSON as evidence, or
ignore the directory entirely.

### H-4 · 31 untracked entries include real source code — **P1**

`git status` shows 31 untracked entries, and they are **not** all junk:

```
apps/analytics-api/src/routes/sqlGuard.js          ← the SQL Editor security boundary
apps/analytics-api/tests/sqlEditorSecurity.test.js ← 98 security regression tests
apps/analytics-api/tests/retentionCleanup.test.js
apps/analytics-api/tests/trackingScriptOptOut.test.js
apps/analytics-api/tests/trackingOptOutServer.test.js
apps/analytics-api/tests/globalSetup.js
apps/analytics-api/scripts/benchmarking/
… plus the appsv2 mirrors
```

**This is the most consequential hygiene finding.** All the security hardening and
its test coverage is currently uncommitted. A clone of the repository as it stands
on the remote would get the *old*, vulnerable SQL Editor.

**Action:** commit before anything else.

### H-5 · Two buildable copies (`apps/`, `appsv2/`) — **P1**

Both ship Dockerfiles and both have a Compose file (`docker-compose.yml`,
`docker-compose.v2.yml`). Nothing states which is canonical. `CLAUDE.md` rule 9
still instructs porting to a **third, private** repository that is not part of
this distribution.

**Action:** declare `apps/` canonical in the README; either delete `appsv2/` or
mark it explicitly as an experimental line. Reword `CLAUDE.md` so it does not
reference a repo the public does not have.

### H-6 · `archive/analytics-api-legacy/` — 35 tracked files — **P2**

Intentional ("kept for reference"), correctly named, correctly documented.
Low priority, but it is dead code shipped to every user.

### H-7 · `scripts/generate-report-pdf.js` is broken for everyone — **P1**

Line 10 imports from a hardcoded absolute path
(`/Users/<name>/Desktop/Personal/traffic2/...`) to a directory that does not exist
even on this machine. Verified: the script throws `ERR_MODULE_NOT_FOUND` on run.
It also embeds a personal identity string into its generated PDF.

**Action:** fix or delete. Deleting is defensible — the benchmark now generates
its own decks.

---

## 2. Security

### S-1 · 3 critical + 21 high dependency vulnerabilities — **P0**

Measured this audit via `npm audit`:

| Package | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| `apps/analytics-api` | **2** | **12** | 6 | 2 | 22 |
| `apps/dashboard-web` | **1** | **9** | 5 | 1 | 16 |

**Action:** `npm audit fix`, then triage what remains. Capture the resulting
`npm audit` output as a release artifact.

### S-2 · No LICENSE file — **P0** *(also legal, see §6)*

Covered in D-1 / L-1 below; repeated here because shipping unlicensed code is a
security-adjacent distribution problem.

### S-3 · API container runs as root — **P1**

`apps/analytics-api/Dockerfile` has `FROM node:20-slim` and **no `USER`
directive**. Combined with the SQL Editor's file-access surface (mitigated, see
S-6), a container escape or validation gap runs with root privileges.

**Action:** add `USER node` after the build steps.

### S-4 · PostgreSQL and pgAdmin published to the host by default — **P1**

`docker-compose.yml` publishes `5432:5432` and `5050:5050`. Convenient in
development; unsafe as a shipped default, particularly with pgAdmin's credentials
coming from `.env`.

**Action:** bind to `127.0.0.1` or move both behind a `dev` profile.

### S-5 · CSP disabled; PG SSL does not verify certificates — **P2**

- `index.js:74` — `contentSecurityPolicy: false`
- `db/postgres.js:18` — `ssl: { rejectUnauthorized: false }` **in production**

The second means a production database connection accepts any certificate,
offering no protection against an active MITM on the DB link.

### S-6 · SQL Editor boundary — **VERIFIED GOOD**

Independently re-verified against the running stack during earlier work: 98
automated tests, all six live attack vectors blocked (`SELECT * FROM users`,
`read_text('/etc/hosts')`, `DROP`, stacked statements, quoted-identifier
evasion, `duckdb_settings()`), and cross-site isolation confirmed with a
two-tenant fixture. Two-layer validation (textual + AST), tenant-scoped views,
server-capped timeout, hard row cap.

**Remaining limitations are documented, not hidden** — see
`SQL_EDITOR_SECURITY.md` §7: the timeout does not cancel a running DuckDB query,
there is no engine-level `access_mode=READ_ONLY` backstop, and the AST layer uses
a PostgreSQL grammar so some valid DuckDB syntax is rejected.

### S-7 · Secrets scan — **CLEAN**

`git grep` across tracked files for AWS keys, `sk-` tokens, GitHub PATs and
private-key headers found **only** AWS's own documented example key
(`AKIAIOSFODNN7EXAMPLE`) inside `.env.example` comments. No password literals in
tracked source outside test fixtures.

The previously-committed personal credential was removed in earlier work; it
**remains in git history** (commits `bcd29d3`, `a813c78`), accepted by the author
as a dummy local password. Worth a one-line note in `SECURITY.md` so a reviewer
browsing history does not raise it as a live finding.

### S-8 · `ENCRYPTION_KEY` undocumented — **P1**

Governs AES-256-GCM encryption of stored BYO AI keys and Sentry tokens, and falls
back to `JWT_SECRET` when unset — so rotating `JWT_SECRET` silently destroys every
stored secret. It appears in **neither** `.env.example`. One of 17 variables in
code but in no template (see §3).

---

## 3. Documentation consistency

Cross-checked README ↔ `docs/` (45 files) ↔ `package.json` ↔
`docker-compose.yml` ↔ `.env.example` ↔ source tree.

### Verified correct

| Check | Result |
|---|---|
| Every `cd <path>` in README | **resolves** (`apps/analytics-api`, `apps/dashboard-web`) |
| All 6 documented backend npm scripts | **exist**, and their target files exist |
| All 12 README markdown links | **resolve** |
| `docker compose config` | **parses** against `.env.example` |
| Compose build contexts | **resolve** to real directories |

Earlier audits found stale `cd analytics-db` paths; those were corrected and are
confirmed gone.

### D-1 · README badge claims MIT and links to a nonexistent LICENSE — **P0**

`README.md:7` renders an "Open Source — MIT" badge whose href is `LICENSE`. That
file does not exist. No `package.json` carries a `license` field either.

### D-2 · 17 environment variables in code, in no template — **P1**

Including `ENCRYPTION_KEY`, `DATABASE_URL`, `SQL_EDITOR_TIMEOUT_MS`,
`SQL_EDITOR_MAX_TIMEOUT_MS`, `MCP_TOKEN_EXPIRES_IN`, and nine `SENTRY_*` tuning
variables.

Also: the root `.env.example` (18 vars) is **Docker-oriented** and omits every
`PG_*` variable, while `apps/analytics-api/.env.example` (~50 vars) is the real
application reference — and the README now points at it, but a reader could still
reasonably use the wrong one.

### D-3 · `CLAUDE.md` references a private third repository — **P2**

Rule 9 instructs porting every change to a `traffic/` repo that is not part of
this distribution. Harmless to the running product, confusing to a contributor.

### D-4 · Two Compose files, no stated default — **P2**

`docker-compose.yml` (apps) and `docker-compose.v2.yml` (appsv2). The README only
documents the first, which is correct — but the second's presence invites the
question.

---

## 4. Installation from zero — **PASS (verified live)**

Executed during this audit, not inferred.

```bash
cp .env.example .env
docker compose up --build -d
```

| Step | Result |
|---|---|
| `docker compose build backend` | ✅ image built |
| `docker compose build ui` | ✅ image built |
| `docker compose up -d` | ✅ **5/5 services running** |
| Backend health | ✅ `{"status":"ok"}` on :3001 |
| Dashboard | ✅ HTTP 200 on :4173 |
| Demo site | ✅ HTTP 200 on :8080 |
| Register account | ✅ user id 1, JWT returned |
| Create site | ✅ `site_2d61be8c` |
| Fetch tracking script | ✅ HTTP 200, 27,032 bytes |
| Send a real event | ✅ `{"success":true}` |
| Event visible in analytics | ✅ **after 6 seconds** |
| Top-pages reflects it | ✅ `/pricing · 1 view · 1 visitor` |

**A fresh developer can answer "what do I do next?" from the README, and it
works.** This is the strongest finding in the audit.

### I-1 · Demo site's hardcoded site ID 404s on a fresh install — **P1**

`examples/demo-site/*.html` embeds `sites/site_d1799b4b/script`. On the
freshly-provisioned stack that ID does not exist:

```
GET /api/sites/site_d1799b4b/script  →  HTTP 404
```

So the demo site Compose starts on :8080 renders, but **tracks nothing**. A new
user following the "Live Demo" path sees an empty dashboard and reasonably
concludes tracking is broken.

**Action:** seed that site id at startup, or have the demo page read its id from
an env var the compose stack sets.

### I-2 · Manual (non-Docker) install — **PARTIAL**

Paths and scripts verified to exist; `docs/running-locally.md` is complete and
correct including the PostgreSQL container step. The sequence
`migrate → init → start` was executed successfully in earlier work. **Not
re-run end-to-end in this audit**, so recorded as PARTIAL rather than PASS.

### I-3 · No `engines` field, no `.nvmrc` — **P2**

"Node.js 20+" appears in README prose only. Neither main package declares
`engines`; only `apps/mcp-server` does. No `.nvmrc`, no `packageManager` pin.

---

## 5. Production deployment

| Path | Verdict | Evidence |
|---|---|---|
| **Docker Compose** | **PASS** | Built and ran the full stack; complete user journey verified live |
| **Manual / VPS** | **PARTIAL** | Documented, scripts exist and were run in earlier work; not re-verified here |
| **Railway / Render** (backend) | **NOT VERIFIED** | No `railway.json` / `render.yaml`; README gives Root Dir + start command only |
| **Vercel / Cloudflare / Netlify** (frontend) | **NOT VERIFIED** | No `vercel.json` / `netlify.toml`; README gives Root Dir + build command only |

The cloud instructions are plausible and specific (Root Dir `apps/analytics-api`,
`npm run migrate && npm run init && npm start`, volume at `/data`), and the paths
they name are correct. But nothing in the repository *configures* those platforms,
and no deployment was performed. **Do not claim these are supported until one has
actually been deployed.**

### P-1 · DuckDB file on ephemeral cloud storage — **P1**

The Railway instruction says to attach a volume at `/data`, but `DUCKDB_PATH`
defaults to `duckdb/analytics.duckdb` **relative to the app directory**. Unless
the operator also sets `DUCKDB_PATH=/data/analytics.duckdb`, the analytics
database lands on ephemeral storage and is lost on redeploy. The README does not
mention this.

---

## 6. Open-source quality

| Artifact | Present |
|---|---|
| `LICENSE` | ❌ |
| `CONTRIBUTING.md` (root) | ❌ (a `docs/contributing.md` exists) |
| `CODE_OF_CONDUCT.md` | ❌ |
| `SECURITY.md` | ❌ |
| `CHANGELOG.md` | ❌ (one dated `CHANGELOG-2026-05-02.md`, not tied to releases) |
| Issue / PR templates | ❌ |
| CI workflow | ❌ (`.github/` contains only `FUNDING.yml`) |
| Git tags / releases | ❌ (**0 tags**) |
| Architecture docs | ✅ (`ARCHITECTURE.md`, `docs/architecture.md`, + 45 docs) |
| API docs | ✅ (`docs/api-reference.md`, OpenAPI 3.1 at `/api/openapi.json`) |
| Environment docs | ⚠️ partial (17 vars undocumented) |
| Reproducible benchmark | ✅ (`docs/PERFORMANCE_BENCHMARK.md`) |
| Reproducible tests | ✅ (383 backend + 55 frontend, auto-provisioned DB) |
| Canonical source tree | ❌ (two buildable copies) |
| Lint / typecheck | ❌ (no script in any package) |

### L-1 · No LICENSE — **P0**

Under the Berne Convention, code published without a license is **all rights
reserved**. Despite the README's MIT badge and "Free forever — MIT licensed"
claim, **nobody may lawfully copy, modify, or redistribute this repository.**
This is simultaneously a legal blocker, a factual error in the README, and a hard
JOSS rejection criterion.

### L-2 · No CI — **P1**

383 backend tests, 55 frontend tests, and a 98-test security suite exist and pass
— but nothing runs them on push. The security regression suite specifically
exists to catch a DuckDB upgrade widening the SQL surface; without CI it only
catches that if someone remembers to run it.

### L-3 · No `SECURITY.md` — **P1**

No documented vulnerability-reporting channel. Also the natural place to note
that the credential in git history was a dummy local password.

---

## 7. Publication readiness (Zenodo / JOSS)

| Question | Answer |
|---|---|
| Can another researcher reproduce the benchmark? | **Yes.** Seeded deterministic generator (verified identical across separate processes), 30 iterations, median/p95/p99/σ, raw samples as JSON+CSV, one documented command, isolated throwaway databases. |
| Can another developer reproduce the application? | **Yes** for Docker — verified live this audit. |
| Are quantitative claims evidence-backed? | **Yes, now.** The unsupported "10–100× faster" claims were removed; historical tables are labelled as non-reproducible; the current numbers trace to committed result files. |
| Are security/privacy claims appropriately scoped? | **Yes.** DNT/GPC is implemented (client + server) and honestly described; "GDPR-compliant" was replaced with "GDPR-friendly by design"; "anonymous" → "pseudonymous"; third-party claims scoped to the tracking pipeline. |
| Is the architecture documented? | **Yes** — extensively. |
| Are dependencies / version assumptions documented? | **Partially.** Versions are captured automatically in benchmark output, but there is no `engines` field and 17 env vars are undocumented. |
| Is there a clear statement of limitations? | **Yes** — `SQL_EDITOR_SECURITY.md` §7, `PERFORMANCE_BENCHMARK.md` §17, and the audit documents. |
| Is the repository internally consistent? | **Mostly.** Two buildable copies and a `CLAUDE.md` referencing a private repo are the exceptions. |
| Are there artifacts that make it look unfinished? | **Yes — badly.** 1.1 GB of committed Playwright traces, three duplicate screenshot sets, a broken PDF script, no LICENSE, no tags. |

### Publication-specific blockers

**PB-1 · No LICENSE** — hard JOSS rejection (P0).
**PB-2 · No tagged release / DOI** — Zenodo mints a DOI from a GitHub *release*; there are **0 tags**, so there is nothing to deposit (P1).
**PB-3 · No `CITATION.cff` / `codemeta.json`** — no machine-readable citation metadata, no ORCID, no affiliation (P1).
**PB-4 · No `paper.md` / statement of need** — required by JOSS; the README is marketing copy, not a scholarly statement (P1).
**PB-5 · JOSS scope risk** — a "self-hosted GA alternative" is likely judged out of scope as a product rather than research software. Reframing around the measurable contributions (timezone-derived geolocation vs IP; the sync staleness envelope) would be needed, or a different venue chosen (P2 — a decision, not a defect).

---

## 8. Findings by severity

### P0 — Must fix before public release

| ID | Finding |
|---|---|
| **H-4** | Security hardening + 98 security tests are **uncommitted** — a clone gets the old, vulnerable SQL Editor |
| **H-1** | 1.1 GB / 350 files of committed Playwright artifacts; 225 MB `.git` |
| **L-1 / D-1** | No LICENSE, while the README badge claims MIT and links to it |
| **S-1** | 3 critical + 21 high dependency vulnerabilities |
| **I-1** | Demo site's hardcoded site ID 404s on a fresh install — the shipped demo tracks nothing |

### P1 — Should fix before publication

| ID | Finding |
|---|---|
| **H-3** | `benchmark-results/` untracked and un-ignored — 15 MB commits by accident |
| **H-5** | Two buildable copies, no declared canonical tree |
| **H-7** | `scripts/generate-report-pdf.js` broken on every machine (absolute path) |
| **S-3** | API container runs as root |
| **S-4** | PostgreSQL (5432) and pgAdmin (5050) published to the host by default |
| **S-8 / D-2** | 17 undocumented env vars, incl. `ENCRYPTION_KEY` |
| **L-2** | No CI — the security regression suite never runs automatically |
| **L-3** | No `SECURITY.md` |
| **P-1** | `DUCKDB_PATH` not set in the documented Railway instructions → data loss on redeploy |
| **PB-2/3/4** | No tag/DOI, no `CITATION.cff`, no `paper.md` |

### P2 — Cleanup / polish

| ID | Finding |
|---|---|
| **H-2** | Three duplicate screenshot sets (~13.5 MB) |
| **H-6** | `archive/analytics-api-legacy/` shipped to every user |
| **S-5** | CSP disabled; PG SSL `rejectUnauthorized: false` in production |
| **D-3** | `CLAUDE.md` references a private third repository |
| **D-4** | Two Compose files, no stated default |
| **I-3** | No `engines` field, no `.nvmrc` |
| — | No lint / typecheck script in any package |
| **PB-5** | JOSS scope framing decision |

### P3 — Nice-to-have

- Issue / PR templates
- `CODE_OF_CONDUCT.md`
- A Keep-a-Changelog `CHANGELOG.md` tied to tags
- Root `CONTRIBUTING.md` (one exists under `docs/`)

---

## Release blockers

1. **Commit the uncommitted security work** (H-4) — nothing else matters if the published tree has the old SQL Editor.
2. **Add a LICENSE** (L-1) — the repository is legally closed today.
3. **Untrack the 1.1 GB of Playwright artifacts** (H-1) and gitignore them.
4. **Remediate the 3 critical dependency vulnerabilities** (S-1).
5. **Fix the demo site's site ID** (I-1) — the shipped demo currently proves nothing works.

## Publication blockers

6. Tag a release so Zenodo can mint a DOI (PB-2).
7. Add `CITATION.cff` (PB-3).
8. Add `paper.md` + statement of need, **or** choose a non-JOSS venue (PB-4/PB-5).
9. Add CI so the security suite runs on every push (L-2).

## Recommended before release

- `USER node` in the API Dockerfile (S-3)
- Stop publishing 5432/5050 by default (S-4)
- Document the 17 missing env vars, `ENCRYPTION_KEY` first (S-8)
- Declare `apps/` canonical; resolve `appsv2/` (H-5)
- Fix or delete `generate-report-pdf.js` (H-7)
- Add `SECURITY.md` (L-3)
- Document `DUCKDB_PATH` for cloud deploys (P-1)
- Decide `benchmark-results/` tracking policy (H-3)

## Optional polish

Deduplicate screenshots · drop `archive/` · enable CSP · fix PG SSL verification ·
`.nvmrc` + `engines` · lint script · reword `CLAUDE.md` · issue templates ·
`CODE_OF_CONDUCT.md` · changelog tied to tags.

---

## What was actually executed for this audit

```bash
git ls-files | grep -cE 'playwright-report/|test-results/'   # 350
du -sh appsv2/passmark-tests/{playwright-report,test-results} .git
git grep -nIE '(AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|ghp_…|BEGIN.*PRIVATE KEY)'
grep -n 'USER\|FROM' apps/*/Dockerfile
npm audit --json                       # both packages

docker compose --env-file .env.example build backend ui
docker compose --env-file .env.example up -d           # 5/5 running
curl /api/health · /  (:4173) · /  (:8080)
POST /api/auth/register → POST /api/sites → GET /api/sites/:id/script
POST /api/track/event   → GET /api/analytics/:id/kpi   # visible in 6s
docker compose down -v

npm test   # api 383/383 · web 55/55
```

Test data lived only in throwaway containers; the stack was torn down with `-v`.

---

*Audit only. No code, configuration, or documentation was modified. Every verdict
above is either traced to a file or was executed during this audit; anything that
could not be established is marked NOT VERIFIED rather than assumed.*
