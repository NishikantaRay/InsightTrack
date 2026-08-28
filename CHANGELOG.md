# Changelog

All notable changes to InsightTrack.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project does not yet follow [Semantic Versioning](https://semver.org/) —
see [Versioning](#versioning) below.

Entries are derived from Git history. Dates are commit dates.

## Versioning

**There are no releases yet.** The repository has no Git tags, no GitHub
releases, and the `version` field in every `package.json` has read `1.0.0` since
the initial commit without ever being bumped — so package versions do not
correspond to releases and cannot be used to date changes.

Because of that, the sections below are dated development milestones, **not
released versions**. Versioning starts at the first tagged release.

---

## [Unreleased]

Release-preparation work: security hardening, licensing, CI, and reproducible
benchmarks.

> **Note:** these commits exist in the repository but are not currently on any
> branch — the branch pointer was reset after they were made. They are reachable
> via the reflog (`d597356` and its three ancestors) and the working tree still
> matches them.

### Security
- SQL Editor rewritten around an allowlist (`sqlGuard.js`), closing arbitrary
  local/remote file reads, `ATTACH`-based credential exposure, and cross-tenant
  reads. Queries are re-validated after template substitution and scoped to the
  caller's site.
- API container drops root and runs as the unprivileged `node` user.
- PostgreSQL and pgAdmin bound to `127.0.0.1` instead of all interfaces.
- Removed a hardcoded database password from `scripts/benchmark.js`.
- Dropped the `users` table from the DuckDB sync surface so password hashes are
  never replicated into the analytics store.

### Privacy
- Do Not Track and Global Privacy Control are honoured, both in the tracking
  script (before any storage or network access) and on all ingest routes.

### Fixed
- Retention deletion now applies to DuckDB as well as PostgreSQL; purged data
  could previously survive in the analytics store.
- Sample-data seeding no longer gates container startup. It is not restart-safe,
  so a partially-completed seed previously left the backend unable to boot.
- The bundled demo site referenced a site ID that did not exist, so its tracking
  script returned 404 on every fresh install.

### Added
- `LICENSE` (MIT) — the repository previously had none despite the README's MIT
  badge, leaving it all-rights-reserved.
- `SECURITY.md`, `CITATION.cff`, and a CI workflow covering both test suites and
  a Docker Compose smoke test.
- A reproducible PostgreSQL vs DuckDB benchmark harness with seeded data and
  result-equality checks before timing (`docs/PERFORMANCE_BENCHMARK.md`).

### Removed
- `scripts/generate-report-pdf.js`, which imported Playwright via an absolute
  path outside the repository and failed on every machine.

---

## 2026-08-09 — Error tracking

### Added
- Sentry integration: issue polling, webhooks, and dashboard UI
  (`docs/sentry-errors.md`). (`a70ca0a`)

## 2026-07-12 — AI analyst and MCP

### Added
- MCP server and toolkit, exposing analytics to MCP clients such as Claude
  Desktop, alongside the Pulse AI analyst. (`c240936`)

## 2026-06-28 → 2026-06-29 — Public web presence

### Added
- Public blog with full SEO support. (`91310fc`)
- PWA and SEO work: prerendering, favicons, legal pages, and a 404 page.
  (`5eb39d5`)
- Product Hunt badges on public pages. (`20a8110`)

### Changed
- Improved mobile drawer and navbar responsiveness. (`717c257`)

## 2026-06-06 → 2026-06-24 — Engagement and stability

### Added
- Site-search tracking; country codes normalised. (`cc53180`)
- Heatmap, alerts, sidebar and documentation improvements. (`768e6d1`)

### Fixed
- Stabilised heatmap hooks and cancelled in-flight requests. (`0dc866a`)

## 2026-05-28 — SQL Editor

### Added
- SQL Editor (`docs/sql-editor.md`), GeoIP lookup, and engagement features.
  (`a1ac198`)

## 2026-05-23 — Reporting

### Added
- Export and focus UI, plus more resilient sync. (`6221ce2`)

### Changed
- Reporting Studio gained drag-to-reorder; widget UI refactored. (`cb21d98`)

## 2026-05-01 → 2026-05-10 — Hot/cold analytics (v2)

### Added
- Hot+Cold analytics architecture and UTM campaign tracking — the largest change
  after the initial commit, at 201 files. Replaced the flat DuckDB sync with a
  partitioned hot-tier/Parquet-cold-tier design behind transparent `UNION ALL`
  views, so existing queries kept working unchanged. (`e47e4c9`)
- Architecture diagrams and documentation. (`bc58196`)
- Playwright regression tests and reports. (`a813c78`)
- `CHANGELOG-2026-05-02.md` — a detailed single-day engineering log covering
  this work, retained as a historical record. (`a425c48`)

## 2026-04-25 — Initial commit

### Added
- Initial public commit (`fe4f1e2`), already containing the dual-database
  architecture (PostgreSQL writes, DuckDB analytics reads, and the sync worker),
  the React dashboard, the Express API, and the documentation set.

  This was an import of existing work rather than a from-scratch start, so the
  history before this point is not part of the repository.
