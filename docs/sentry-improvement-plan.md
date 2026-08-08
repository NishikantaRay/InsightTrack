# Sentry Integration — Improvement Plan

> Status of record as of **2026-07-17**, produced from a code-level review of the
> Sentry integration shipped in the first pass (see [sentry-errors.md](sentry-errors.md)).
> Check items off as they land; **every change ports to all three copies**
> (`traffic/`, `traffic2/apps`, `traffic2/appsv2`) and updates
> [sentry-errors.md](sentry-errors.md).
>
> **Wave 1 landed 2026-07-17** — all of **P0** is done and mirrored across the
> three copies: P0.1 (17 new tests — `sentryService.test.js` + route tests;
> full backend suite **174/174** in all three copies — also added the missing
> `geoip-lite` dependency to appsv2, which had a pre-existing unrelated test
> failure), P0.2 (re-entrancy guard +
> bounded-concurrency poll pool), P0.3 (Link-cursor pagination up to
> `SENTRY_MAX_ISSUES`), P0.4 (soft-delete `stale` reconciliation; reads exclude
> stale). See per-item checkboxes below.
>
> **Wave 2 landed 2026-07-17** — P1.1 (error-trend chart: `sentry_stats` table
> polled from Sentry's project stats API, synced PG→DuckDB, `getSentryTrend` +
> `/sentry/trend` route, area chart on the Errors page) and P1.2 (per-issue
> drill-down: `/sentry/issues/:id/latest-event` live-fetches the newest event —
> stack trace, breadcrumbs, tags — behind an ownership re-check; expandable rows
> on the Errors page). 10 more tests (**184/184** backend in all three copies);
> frontends build clean.
>
> **Wave 3 landed 2026-07-17** — P1.3 (regressions & release context:
> `is_regression` + `last_release` on `sentry_issues`, regressed issues sort
> first with a red badge + release shown, `regressions` count in the summary and
> as a card) and P1.4 (a Sentry-connected-only unresolved-errors/regressions tile
> on the main Dashboard, plus `type='error_spike'` alerts from `sentry_stats`
> flowing through the existing Alerts panel). 2 net-new tests + an end-to-end
> DuckDB smoke check (**186/186** backend in all three copies); frontends build
> clean. **All of P1 is now complete.**
>
> **Wave 4 (partial) landed 2026-07-18** — P2.1 (Sentry **webhook**: per-integration
> HMAC secret minted on connect, public signature-verified endpoint
> `POST /api/integrations/sentry/webhook` mounted before the global JSON parser to
> capture the raw body, `handleWebhook` matches by project + verifies + upserts;
> webhook URL/secret shown in Settings) and P2.2 (**adaptive cadence**:
> `next_poll_at`/`idle_polls` on `site_integrations`, due-only polling, idle
> back-off, hard back-off on auth/target failures, reset on Test/edit). 14 more
> tests (**200/200** backend in all three copies); frontends build clean. **P2.3
> (multiple projects per site) is deliberately deferred to its own sub-wave** — it
> changes the one-row-per-site integration contract and is cleaner isolated.
>
> **Wave 4b landed 2026-07-18** — P2.3 (**multiple projects per site**): dropped the
> `(site_id, provider)` unique constraint; `site_integrations` is now one row per
> connected project (keyed by `id`, deduped on `(org, project)`). Service CRUD is
> id-based (`getIntegrations` array, upsert by id/project, test/delete by id);
> poll stale-reconciliation and `sentry_stats` are **per-project** (`project_slug`
> column; trend/alert reads SUM across projects); drill-down picks the issue's
> project token. Settings shows a per-project list (add/edit/test/remove + webhook
> each); the Errors page & Dashboard tile treat "connected" as any project. 8
> net-new tests + an end-to-end DuckDB check (**208/208** backend in all three
> copies); frontends build clean. **All of P2 is now complete.**
>
> **Wave 5 landed 2026-07-18** — all of **P3**. P3.2 (**MCP tools**
> `get_error_summary` + `get_error_issues`, read-only + site-scoped, wired to the
> DuckDB reads, added to the OpenAPI spec so Pulse and external MCP clients can ask
> "what's breaking on site X?"). P3.3 (**token health**: an `authError` flag on the
> public integration shape drives an amber "reconnect" prompt on the Dashboard tile
> and Errors banner when a token is rejected). P3.1 (**integration registry** seam:
> `src/integrations/registry.js` with a provider→adapter contract; Sentry is the
> first adapter; the webhook route + poll loop are now provider-generic, so
> Rollbar/Bugsnag/Datadog are new adapters, not new subsystems). 9 more tests
> (**217/217** backend in all three copies); frontends build clean.
> **The Sentry integration plan (P0–P3) is complete.**

## Current state (verified against code)

Built and working: per-site `site_integrations` (AES-256-GCM-encrypted token),
`sentry_issues` PG table synced PG→DuckDB, a 5-minute poll loop
(`sentryService.pollAllSentry` from `index.js`), management routes under
`/api/sites/:siteId/integrations/sentry` (GET/PUT/POST test/DELETE, admin-gated),
read routes `/api/analytics/:siteId/sentry/{issues,summary}`, an **Errors** page,
and a **Settings → Integrations** connect form. No drift between the three copies.

Known limitations this plan addresses: **no tests**; polling is **serial and
un-paginated** (one project at a time, first 100 issues only); **no error-trend
chart** or per-issue drill-down; issues are **pull-only** (5-min latency, no
webhook); and the model is **single-provider** (Sentry only, one project per site).

---

## P0 — Correctness & safety (do first)

- [x] **P0.1 — Test coverage.** No tests exist for any Sentry path. Add, using
  the real-PG `testHelper.js` harness (`site_test%` cleanup):
  - `sentryService` unit tests with `fetch` stubbed: `upsertIntegration`
    (encrypts, keeps old token when blank, rejects missing org/project),
    `_normalize` (maps Sentry shapes incl. missing metadata), `_upsertIssue`
    (idempotent by `issue_id`), `pollIntegration` (sets `status=ok`/`error`,
    records `last_error`, never throws), `_fetchIssues` error mapping
    (401/403/404/timeout → safe status codes).
  - Route tests: role gating (viewer can GET but not PUT/DELETE), token never
    echoed in any response, `test` endpoint surfaces upstream failure status.
  - A `secretBox` round-trip assertion that `token_cipher` is unreadable at rest.
- [x] **P0.2 — Poll isolation & concurrency guard.** `pollAllSentry` loops
  serially and has no re-entrancy guard; a slow/hung project blocks the rest and
  overlapping intervals can double-poll. Add a `_pollRunning` flag (mirror
  `sync.js`'s `_syncRunning`) and poll integrations with a bounded concurrency
  (e.g. 4 at a time) so one site's outage can't stall the fleet.
- [x] **P0.3 — Pagination.** `_fetchIssues` fetches only the first
  `SENTRY_ISSUES_PER_POLL` (100) issues. Follow Sentry's `Link: … rel="next"`
  cursor header up to a safe cap (e.g. 1000/project) so busy projects aren't
  silently truncated.
- [x] **P0.4 — Stale-issue reconciliation.** Issues resolved/deleted in Sentry
  stay in `sentry_issues` forever. Either (a) mark rows not seen in the last N
  polls as `stale`, or (b) prune issues whose `last_seen` is older than the
  retention window. Keep it a soft delete so the Errors page can filter.

## P1 — Product depth (the "wow" for the dashboard)

- [x] **P1.1 — Error-trend chart.** Add `getSentryTrend(siteId, dateRange)` (daily
  event counts, from Sentry's project stats API `/api/0/projects/{org}/{proj}/stats/`
  polled into a small `sentry_stats` table) and render an area chart on the
  Errors page next to the summary cards — the direct analog of the JS-error trend
  on the Performance page. **This is the headline visual for the Errors page.**
- [x] **P1.2 — Per-issue drill-down.** New route
  `/api/analytics/:siteId/sentry/issues/:sentryId/latest-event` → fetch the newest
  event (stack trace, breadcrumbs, tags, request context) live from Sentry (not
  stored). Expandable panel per row on the Errors page.
- [x] **P1.3 — Regressions & release context.** Capture each issue's
  `firstRelease`/`lastRelease` and surface a "regressed after deploy" badge when
  an issue's `firstSeen` follows its resolution. Powers the deploy-correlation
  story.
- [x] **P1.4 — Errors on the main Dashboard + Alerts.** A compact
  "unresolved errors" tile on the Dashboard and a threshold alert (reuse the
  existing alerts pipeline) when unresolved count or event volume spikes.

## P2 — Freshness & scale

- [x] **P2.1 — Sentry webhook (push).** Public, signature-verified endpoint
  (`POST /api/integrations/sentry/webhook`, `publicCors` + HMAC check against the
  integration's stored client secret) so new/regressed issues appear in seconds
  instead of waiting for the 5-min poll. Poll stays as the reconciling backstop.
- [x] **P2.2 — Adaptive poll cadence.** Back off quiet projects and poll noisy
  ones more often; skip projects whose `last_error` is auth-related until the user
  re-tests (avoid hammering Sentry with a known-bad token).
- [x] **P2.3 — Multiple projects per site.** Relax the `(site_id, provider)`
  unique constraint to allow N Sentry projects per site (many customers split
  frontend/backend/mobile), aggregating counts on the Errors page.

## P3 — Platform / integration framework

- [x] **P3.1 — Generalize `site_integrations`.** The table and the
  `requireSiteRole` guard are already provider-agnostic. Extract a small
  `integrationRegistry` (provider → { poll, test, normalize }) so adding
  **Rollbar / Bugsnag / Datadog** is a new adapter, not a new subsystem.
- [x] **P3.2 — MCP tool + Pulse.** Expose `get_error_issues` / `get_error_summary`
  as read-only MCP tools (registry.js) so the AI Analyst can answer
  "what's breaking on site X since the last deploy?" — reuses the DuckDB reads.
- [x] **P3.3 — Token health surfacing.** Proactively flag integrations whose
  token was rejected (401/403) with a dashboard banner + optional email, instead
  of only showing the error on the Errors/Settings pages.

---

## Suggested wave order

1. **Wave 1 (P0)** — tests + poll hardening (isolation, pagination, reconciliation).
   Ships confidence before adding surface area.
2. **Wave 2 (P1.1 + P1.2)** — trend chart + drill-down: the biggest visible
   product jump.
3. **Wave 3 (P1.3, P1.4)** — regressions, Dashboard tile, alerts.
4. **Wave 4 (P2)** — webhook + adaptive cadence + multi-project.
5. **Wave 5 (P3)** — integration framework, MCP/Pulse, token health.

Each wave: build in `traffic/`, port to `traffic2/{apps,appsv2}`, `diff -rq` to
confirm no drift, update this doc's checkboxes and [sentry-errors.md](sentry-errors.md).
