# Sentry Errors Integration

Bring each site's **Sentry** issues (runtime errors, crashes, event counts,
users affected) into InsightTrack, so you can watch traffic and bugs side by
side. Every site connects its own Sentry project; if a customer integrates 10
sites, all 10 projects are polled independently.

This is distinct from the built-in `js_error` tracking (captured by the tracker's
`window.onerror` handler — see [js-errors.md](js-errors.md)). Sentry issues carry
richer context (fingerprinted grouping, level, permalink, resolved status).

## How it works

```
Sentry project (SaaS sentry.io or self-hosted)
        │  GET /api/0/projects/{org}/{project}/issues/   (Bearer token)
        ▼
Sentry poll loop (index.js, every 5 min)  ─ sentryService.pollAllSentry()
        │  upsert normalized issues by (site_id, sentry_id)
        ▼
PostgreSQL  sentry_issues  ──(existing PG→DuckDB sync, 60 s)──▶ DuckDB sentry_issues
   (writes)                                                        (reads)
        ▲                                                             │
        │ site_integrations (encrypted token + org/project config)   │ queries.js
        │                                                             ▼
   Settings → Integrations                          GET /api/analytics/:siteId/sentry/*
   (connect / test / disconnect)                    → Errors page (sidebar)
```

Follows the golden rules: **writes go to PostgreSQL only** (the poll upserts into
`sentry_issues`); **dashboard reads come from DuckDB only** (via `queries.js`).
The service never touches DuckDB directly.

## Data model (PostgreSQL)

`site_integrations` — one row **per connected Sentry project**. A site may connect
several projects (frontend/backend/mobile); each is keyed by its own `id` and
deduped on `(org, project)`. The reads aggregate across a site's projects.

| Column | Notes |
|--------|-------|
| `id` | Per-integration key (`int_…`). Used to edit/test/delete a specific project. |
| `token_cipher` | Sentry auth token, **AES-256-GCM encrypted** via `utils/secretBox.js`. Never returned to the client. |
| `config` (JSONB) | `{ org, project, baseUrl, tokenHint, webhookSecret }` — non-secret settings + masked token hint + per-project webhook secret. |
| `status` | `pending` \| `ok` \| `error` — poll health. |
| `last_error`, `last_synced_at` | Surfaced in the UI when a poll fails. |
| `next_poll_at`, `idle_polls` | Adaptive-cadence scheduling (see below). |

`sentry_issues` — normalized issue rows, PK `issue_id` = `"{site_id}:{sentry_id}"`,
upserted on every poll (so `count` / `last_seen` / `status` stay current). Synced
to DuckDB as a **mutable** table on its `updated_at` watermark (see
`SYNCABLE_TABLES` in `schema/schema.js`). A `stale` flag soft-deletes issues that
Sentry no longer returns (resolved / deleted / aged out) — the poll reconciles it
each cycle **scoped to the polled project** (so one project's poll never marks
another project's issues stale) and the read queries exclude `stale = TRUE`, so
history is preserved without cluttering the Errors page. Each issue's
`project_slug` records which connected project it came from.

### Polling behavior

- **Pagination**: the poll follows Sentry's `Link: … rel="next"` cursor header,
  fetching up to `SENTRY_MAX_ISSUES` per project so busy projects aren't
  truncated at the first page.
- **Concurrency & safety**: `pollAllSentry` polls integrations through a bounded
  worker pool (`SENTRY_POLL_CONCURRENCY`, default 4) so one slow/hung project
  can't stall the fleet, and a `_pollRunning` re-entrancy guard prevents
  overlapping runs (mirrors the DuckDB sync loop's `_syncRunning`).
- **Resilience**: `pollIntegration` never throws — a failing project records
  `status='error'` + `last_error` and the others continue. A poll that returns
  zero issues does not wipe existing rows (guards against transient blips).
- **Adaptive cadence**: each integration carries `next_poll_at` + `idle_polls`.
  `pollAllSentry` only polls integrations that are **due** (`next_poll_at` null or
  past). Active projects poll at `SENTRY_CADENCE_BASE_S`; quiet ones back off one
  step per consecutive idle poll up to `SENTRY_CADENCE_MAX_S`; auth/target failures
  (401/404) back off to `SENTRY_CADENCE_AUTH_FAIL_S` so a known-bad token isn't
  hammered. A successful **Test connection** or an edit clears the backoff.

### Webhook (near-real-time push)

Polling is the reliable backstop, but a connected site can also register a
**webhook** so new/regressed issues appear within seconds:

- On connect, each integration mints a random `webhookSecret` (stored in `config`,
  shown to site admins in **Settings → Integrations → Sentry**). This is a shared
  HMAC secret, distinct from the auth token.
- Point a Sentry **Internal Integration** webhook (subscribed to *issue* events) at
  `POST {SERVER_URL}/api/integrations/sentry/webhook` and set its secret to that
  value.
- The public route (`routes/integrations.js`, mounted before the global JSON parser
  so it can capture the raw body) verifies the `sentry-hook-signature` HMAC against
  the matching integration's secret (constant-time compare), then upserts the issue.
  Unsigned/mis-signed requests get 401; unrecognized payloads 400.
- The poll still runs and remains the source of truth for counts, stale
  reconciliation, and trend stats — the webhook only accelerates issue freshness.

## Connecting a site

**Settings → Integrations → Sentry** (or the "Connect Sentry" button on the
Errors page). Enter:

- **Organization slug** and **Project slug** (from the Sentry project URL).
- **Auth token** — create in Sentry under *Settings → Auth Tokens* with the
  `project:read` and `event:read` scopes.
- **Instance URL** — only for self-hosted Sentry (defaults to `https://sentry.io`).

**Test connection** makes one live call to verify the credentials. The token is
stored encrypted and never shown again; editing later does not require re-pasting
it. Requires **admin** role on the site. **Add another project** to connect more
than one Sentry project to the same site (each row has its own token, status, and
webhook secret); the Errors page aggregates issues, events, and the trend across
all of them, and each issue shows which project it came from.

## API

Management (write path, `routes/sites.js`, admin unless noted):

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/sites/:siteId/integrations/sentry` | **List** all connected projects (no secrets). Viewer+. |
| `PUT` | `/api/sites/:siteId/integrations/sentry` | Connect a new project, or update one (pass `body.id`, else deduped on org/project). |
| `POST` | `/api/sites/:siteId/integrations/sentry/:integrationId/test` | Live credential check for one project. |
| `DELETE` | `/api/sites/:siteId/integrations/sentry/:integrationId` | Disconnect one project. |

Public webhook (no auth — HMAC-verified, `routes/integrations.js`):

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/integrations/:provider/webhook` | Provider issue events (e.g. `.../sentry/webhook`); dispatched via the integration registry, verified by the provider's HMAC signature header against the integration's `webhookSecret`. Unknown provider → 404. |

Analytics (read path, `routes/analytics.js`, DuckDB unless noted):

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `/api/analytics/:siteId/sentry/issues?dateRange=` | Issue list (title, level, count, users, permalink…). Cached. |
| `GET` | `/api/analytics/:siteId/sentry/summary?dateRange=` | Aggregates: unresolved, regressions, total events, users affected, level breakdown. Cached. |
| `GET` | `/api/analytics/:siteId/sentry/trend?dateRange=` | Daily event counts for the error-trend chart (reads `sentry_stats`). Cached. |
| `GET` | `/api/analytics/:siteId/sentry/issues/:sentryId/latest-event` | **Live** drill-down: the issue's newest event (exception frames, breadcrumbs, tags) fetched from Sentry on demand — never stored, not cached. |

Frontend calls the cached three via `analyticsAPI.getSentry{Issues,Summary,Trend}`
(through `useAnalytics`), the drill-down via `analyticsAPI.getSentryLatestEvent`
(on row expand), and `sitesAPI.*SentryIntegration` for management — all in
`services/api.js`.

### Regressions & release context

Each issue also captures whether it **regressed** (Sentry re-opened a previously
resolved issue — from the API's `substatus === 'regressed'`) and the **release**
it was last seen in (`lastRelease`). Regressed issues sort to the top of the
Errors list and show a red **Regressed** badge; the release version shows in the
issue meta line. The summary exposes a `regressions` count (also surfaced as a
card on the Errors page and the Dashboard tile).

### Dashboard tile & alerts

- **Dashboard tile** (`components/ui/DashboardErrorsTile.jsx`): a compact
  unresolved-errors / regressions summary on the main Dashboard that links to the
  Errors page. It renders **only when the active site has Sentry connected**, so
  sites without error monitoring see nothing.
- **Error-spike alerts**: `getAlerts` (which powers the existing Alerts panel and
  Dashboard/Realtime alert surfaces) now also emits `type='error_spike'` alerts
  when a day's Sentry event count exceeds its 7-day rolling mean by >2σ — the same
  z-score method used for traffic spikes/drops. No-op when `sentry_stats` is empty.

### Error-trend chart & drill-down

- **Trend** (`sentry_stats`): each poll also calls Sentry's project **stats API**
  (`/api/0/projects/{org}/{proj}/stats/`, daily resolution over
  `SENTRY_STATS_PERIOD`), rolls the buckets up per day, and upserts one row per
  `(site_id, project, date)`. Synced PG → DuckDB like `sentry_issues`; the trend
  read **SUMs across a site's projects per day** and the Errors page renders it as
  an area chart above the issues list. A stats-API failure is non-fatal — issues
  still upsert; the chart just doesn't refresh that cycle.
- **Drill-down**: clicking an issue fetches its latest event live from Sentry
  (`/api/0/issues/{id}/events/latest/`) and shows the stack trace, tags, and
  breadcrumbs. The route re-checks that the issue belongs to the site before
  calling Sentry (defence in depth on top of the site-scoped authorization).

### AI Analyst (Pulse / MCP) tools

Two read-only MCP tools expose the Sentry data to the AI Analyst and external MCP
clients (registry `src/mcp/tools/registry.js`, one operation each in the OpenAPI
spec — the registry↔spec sync test enforces the 1:1 mapping):

- **`get_error_summary`** — unresolved issues, regressions, total events, users
  affected, severity breakdown. For "is the site healthy / any regressions".
- **`get_error_issues`** — the issue list (title, level, count, users, regression,
  release). For "what's breaking / what broke after the last deploy".

Both are site-scoped (never widen `ctx.siteId`), share the same DuckDB reads and
cache keys as the REST/dashboard path, and return empty when Sentry isn't
connected.

### Token health

`toPublic` derives an **`authError`** flag when an integration's `status='error'`
and the stored `last_error` indicates a rejected token / wrong org-project (vs. a
transient blip). The Dashboard errors tile turns into an amber **"Sentry needs
attention — reconnect"** prompt, and the Errors-page banner links to Settings,
whenever any connected project has `authError`. The adaptive cadence already backs
these off hard until the user re-tests (which clears the flag).

### Integration registry (extension seam)

`src/integrations/registry.js` is a thin provider→adapter registry (P3.1). Sentry
is registered as the first adapter (`{ provider, label, pollAll, handleWebhook }`,
delegating to `sentryService`). The public webhook route and the background poll
loop are **provider-generic** — they dispatch through the registry — so adding
Rollbar / Bugsnag / Datadog is a new adapter (+ its signature header in
`routes/integrations.js`), not a new subsystem. The provider-agnostic machinery
(encrypted creds, upsert/dedup, stale reconciliation, cadence, HMAC verify) is
reused per adapter.

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `SENTRY_POLL_INTERVAL_MS` | `300000` (5 min) | How often connected projects are polled. |
| `SENTRY_ISSUES_PER_POLL` | `100` | Page size for the Sentry issues request. |
| `SENTRY_MAX_ISSUES` | `1000` | Per-project cap across all pages in one poll. |
| `SENTRY_POLL_CONCURRENCY` | `4` | Max integrations polled in parallel. |
| `SENTRY_STATS_PERIOD` | `30d` | Trend window fetched from Sentry's stats API. |
| `SENTRY_CADENCE_BASE_S` | `300` | Poll interval for active projects (seconds). |
| `SENTRY_CADENCE_MAX_S` | `3600` | Max backoff for quiet projects (seconds). |
| `SENTRY_CADENCE_AUTH_FAIL_S` | `21600` | Backoff after an auth/target failure (seconds). |
| `SENTRY_TIMEOUT_MS` | `15000` | Per-request timeout to the Sentry API. |
| `ENCRYPTION_KEY` / `JWT_SECRET` | — | Key material for token encryption (`secretBox`). Rotating either invalidates stored tokens (treated as "not connected"). |

The poll loop is skipped entirely when no integrations exist, so there is zero
overhead until a site connects Sentry.

## Files

- Backend: `services/sentryService.js`, `integrations/registry.js` (provider
  adapter seam), `routes/sites.js` (mgmt), `routes/analytics.js` (reads + live
  drill-down), `routes/integrations.js` (provider-generic public webhook),
  `mcp/tools/registry.js` + `mcp/openapi/insighttrack-spec.js`
  (`get_error_summary`/`get_error_issues` MCP tools), `queries/queries.js`
  (`getSentryIssues`/`getSentrySummary`/`getSentryTrend`), `db/postgres.js`
  (`sentry_issues` + `sentry_stats` tables, cadence columns), `schema/schema.js`
  (DuckDB DDL + `SYNCABLE_TABLES`), `index.js` (registry poll loop + webhook mount).
- Frontend: `pages/Errors.jsx`, `components/settings/SentryIntegration.jsx`,
  `components/ui/DashboardErrorsTile.jsx` (Dashboard tile),
  `components/charts/AlertsPanel.jsx` (error-spike styling), `pages/Dashboard.jsx`,
  `services/api.js`, `components/layout/Sidebar.jsx`, `store/useFeatureStore.js`,
  `pages/Settings.jsx`, `App.jsx`.
- Alerts: error-spike detection lives in `queries.js` `getAlerts` (DuckDB),
  reusing the existing `/analytics/:siteId/alerts` route and Alerts panel.
