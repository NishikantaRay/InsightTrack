# Changelog

All notable changes to InsightTrack.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project follows [Semantic Versioning](https://semver.org/) from
`v1.0.0` onward — see [Versioning](#versioning) below.

Entries are derived from Git history. Dates are commit dates.

## Versioning

Releases are tagged in Git and follow [Semantic Versioning](https://semver.org/)
from `v1.0.0` onward. The `version` field in the shipped `package.json` files
(`analytics-api`, `dashboard-web`) tracks the release tag.

Entries below `v1.0.0` are dated development milestones, **not released
versions** — the packages read `1.0.0` throughout that period without ever being
bumped, so those versions do not identify releases.

`mcp-server` and `mcp-toolkit-core` are versioned separately and remain
pre-1.0 (`0.1.0`).

---

## [1.1.0] - 2026-08-31

A/B test significance, custom-event property redaction, and blog/SEO
distribution.

### Added
- Statistical significance for A/B conversion tests (`abStats.js`): a
  two-proportion z-test reporting p-value, confidence and a winner call, so a
  result is no longer judged on raw conversion rates alone. Fixed-horizon and
  control-relative by design; the limits (peeking, multi-variant error
  compounding) are documented rather than hidden (`docs/ab-testing.md`).
- Deterministic client-side variant assignment via
  `window.analytics.getVariant(testId, variants)`. Variants are chosen by
  hashing visitor id with test id, so assignment is stable with no server
  round-trip and no flash of the wrong content; exposure is reported once per
  session as an `experiment_view` event.
- Per-post Open Graph images (`og-images.mjs`), rendered by the headless
  Chromium the prerender step already installs — no new dependency. Every post
  previously shared one generic card.
- RSS 2.0 feed at `/feed.xml` (`feed.mjs`), generated from the same source as
  the posts and sitemap so it cannot drift, and advertised via `<link
  rel="alternate">`.
- Related-posts links on blog articles, ranked by shared tags, plus per-post
  JSON-LD structured data and `blogSeo` regression tests.

### Security
- Custom-event `properties` are now redacted at ingest (`sanitiseProperties`).
  A call such as `trackEvent('signup', { email: user.email })` previously
  persisted a plaintext email, readable through the dashboard, SQL Editor,
  exports and Pulse — quietly falsifying the product's no-personal-data claim.
  Sensitive keys are matched against the same denylist used for query
  parameters, walking nested objects to a bounded depth and breadth so a
  pathological payload cannot burn CPU at ingest. As with URLs this is a
  denylist, not a guarantee.

### Changed
- `build:seo` now chains OG-image and feed generation into the prerender step.
- Landing-page copy states "Cookieless, GDPR-friendly tracking (no cookies, no
  IP storage)" in place of the stronger "GDPR-compliant" claim.

## [1.0.1] - 2026-08-28

### Added
- Citation metadata for Zenodo, including ORCID and the canonical DOI badge.

### Fixed
- Untracked Playwright run artifacts that had been committed.

## [1.0.0] - 2026-08-28

First tagged release. Release-preparation work: security hardening, licensing,
CI, and reproducible benchmarks.

### Security
- SQL Editor rewritten around an allowlist (`src/routes/sqlGuard.js`), closing
  arbitrary local/remote file reads, `ATTACH`-based credential exposure, and
  cross-tenant reads. Queries are re-validated after template substitution and
  scoped to the caller's site.
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
