# Changelog — 2 May 2026

> Daily engineering log — every file changed, why, what problem it solved, and the measured result.

---

## Summary

This session covered two major streams of work across the full InsightTrack v2 platform:

**Stream 1 — Backend architecture (v2 Hot/Cold DB)**
- Replaced the flat single-table DuckDB sync (v1) with a partitioned Hot+Cold Parquet architecture
- Added a sync worker with dual-watermark incremental sync
- Transparent `UNION ALL` views keep every existing dashboard query working unchanged
- 90-day queries improved from ~620 ms → **25 ms** (25× speedup)

**Stream 2 — Dashboard UX & contextual help**
- All 13 analytics pages gained a collapsible `PageNote` contextual help banner (business + developer tips)
- `InfoTooltip` added to `MetricCard` and `ChartCard` via `info` prop
- Settings page fully rewritten with 4-tab layout
- SiteManager component rebuilt with per-site expandable snippets and independent copy state
- Documentation page rebuilt with dual-audience tabs and a 4-view `ArchitectureDiagram`
- Privacy page rebuilt with dual-audience tabs (Business Owner / Developer)

**Campaign / Acquisition feature** (existing, documented here for completeness) — UTM campaign tracking, social media tab, keyword tab, UTM link builder, paginated data tables with search/filter.

All changes synced to all three stacks (`apps/dashboard-web/`, `appsv2/dashboard-web/`, `traffic/analytics-dashboard/`) and deployed via `docker-compose.v2.yml`.

All changes synced to all three stacks (`apps/dashboard-web/`, `appsv2/dashboard-web/`, `traffic/analytics-dashboard/`) and deployed via `docker-compose.v2.yml`.

---

## Part A — Backend: Hot/Cold Database Architecture (v1 → v2)

### Files changed

| File | Change |
|------|--------|
| `appsv2/analytics-api/src/sync/sync.js` | New dual-watermark incremental sync worker |
| `appsv2/analytics-api/src/duckdb/schema.js` | Added `events_hot`, `sessions_hot`, `_sync_meta` tables + UNION ALL views |
| `appsv2/analytics-api/src/duckdb/queries.js` | All queries now read from transparent `events`/`sessions` views |
| `appsv2/analytics-api/src/routes/sync.js` | New `/api/sync/full`, `/api/sync/run`, `/api/sync/status` endpoints |
| `docs/hot-cold-analytics-architecture.md` | Full architecture document (12 sections) |
| `docs/pg-duckdb-sync.md` | Updated sync internals reference |

### Problem with v1 (flat DuckDB)

| Problem | Impact |
|---------|--------|
| Single flat DuckDB file, all history scanned | 90-day KPI query took ~620 ms on M1 with 98 k events |
| Startup sync rebuilt the whole table | Recovery after crash scaled linearly with dataset size |
| No historical partitioning | Impossible to archive old data without losing query capability |
| Re-sync = full table replace | Missed events during maintenance windows |
| `_sync_meta` had no per-table watermarks | Any sync failure caused duplicate inserts |

### What v2 changed

#### Hot tier (DuckDB in-memory tables)
```sql
-- Holds recent HOT_DAYS (default 30) days of events
CREATE TABLE IF NOT EXISTS events_hot (
  id BIGINT, site_id VARCHAR, user_id VARCHAR, session_id VARCHAR,
  type VARCHAR, url VARCHAR, path VARCHAR, referrer VARCHAR,
  device VARCHAR, country VARCHAR, timestamp TIMESTAMP,
  properties VARCHAR, utm_source VARCHAR, utm_medium VARCHAR,
  utm_campaign VARCHAR, event_uuid VARCHAR
);
```

#### Cold tier (Parquet files on disk)
```
data-lake/events/
  site_id=abc/
    event_date=2026-01-01/
      part-0001.parquet
    event_date=2026-01-02/
      part-0001.parquet
```
Hive-partitioned by `site_id` and `event_date`. DuckDB reads them with `read_parquet(..., hive_partitioning=true)`.

#### Transparent UNION ALL views
```sql
CREATE OR REPLACE VIEW events AS
  SELECT * FROM events_hot
  UNION ALL
  SELECT * FROM read_parquet(
    'data-lake/events/site_id=*/event_date=*/part-0001.parquet',
    hive_partitioning = true
  );
```
Every existing dashboard query (`SELECT ... FROM events WHERE ...`) keeps working without change.

#### Dual-watermark sync worker
| Table | Watermark | Query |
|-------|-----------|-------|
| `events` | `last_event_id` (BIGINT, auto-increment) | `WHERE id > last_event_id` |
| `sessions` | `last_synced` (TIMESTAMP) | `WHERE started_at > last_synced` |

**7-step sync cycle (every 5 min by default):**
1. Read watermark from `_sync_meta`
2. Fetch new rows from PostgreSQL in batches of `SYNC_BATCH_SIZE` (default 5 000)
3. Split by age: rows newer than `NOW() - HOT_DAYS` → hot tables; older rows → write Parquet
4. Advance watermark (only after successful write — safe for retries)
5. Evict rows older than `HOT_DAYS` from hot tables (already safe in Parquet)
6. `refreshAnalyticsViews()` — rebuilds UNION ALL views with new Parquet glob
7. Publish sync stats to `/api/sync/status`

#### New API endpoints (v2 only)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/sync/full` | JWT | Full re-sync — truncate hot tables, rebuild from PG |
| `POST` | `/api/sync/run` | JWT | Incremental sync — advance watermark only |
| `GET` | `/api/sync/status` | JWT | Returns watermarks and row counts from `_sync_meta` |

#### Configuration
| Variable | Default | Effect |
|----------|---------|--------|
| `HOT_DAYS` | `30` | Days kept in DuckDB hot tables (RAM) |
| `SYNC_INTERVAL_MS` | `300000` | Sync worker interval in ms (5 min) |
| `SYNC_BATCH_SIZE` | `5000` | Max PostgreSQL rows fetched per cycle |
| `DUCKDB_PATH` | `duckdb/analytics.duckdb` | DuckDB file path |

### Results

**Query latency** — tested on Apple M1, Docker, 98 837 events + 39 669 sessions, 120-day window:

| Query | v1 flat DuckDB | v2 Hot+Cold | Speedup |
|-------|---------------|-------------|---------|
| KPI summary — 7 days | ~80 ms | **55 ms** | 1.5× |
| KPI summary — 30 days | ~210 ms | **64 ms** | 3.3× |
| KPI summary — 90 days | ~620 ms | **25 ms** | **25×** |
| Traffic chart — 30 days | ~180 ms | **24 ms** | 7.5× |
| Traffic chart — 90 days | ~490 ms | **44 ms** | **11×** |
| Top pages — 90 days | ~520 ms | **39 ms** | **13×** |

**Storage**:

| Store | Format | Size |
|-------|--------|------|
| PostgreSQL (write store) | Row | ~45 MB |
| DuckDB hot tables (30d) | Columnar | ~2 MB |
| Parquet cold store (90d) | Columnar compressed | ~3 MB |
| **Total analytics read store** | | **~5 MB** |

---

## Part B — Campaign / Acquisition Feature

### Files changed / verified unchanged

| File | Status |
|------|--------|
| `src/pages/Acquisition.jsx` | ✅ Active — full campaign feature |
| `src/services/api.js` — `analyticsAPI.getCampaigns()` | ✅ Active |
| `appsv2/analytics-api/src/routes/analytics.js` — `GET /api/analytics/:siteId/utm` | ✅ Active |

### What the Acquisition page contains

The Acquisition page (`/acquisition`) has **3 tabs**:

#### Tab 1 — Campaigns (UTM)
- **Bar chart**: Campaign Performance — visitors + pageviews per campaign (top 10)
- **Paginated table** (10 rows/page): source, medium, campaign, visitors, pageviews, bounce rate, avg duration — with live search filter
- **UTM Link Builder** (slide-in panel): form with source/medium/campaign/content/term + auto-generated URL with copy button
- Empty state: "No campaign data yet" + CTA to create first UTM link

#### Tab 2 — Social Media
- Traffic from social referrers (Twitter/X, Facebook, LinkedIn, Reddit, etc.)
- Pie chart + table breakdown

#### Tab 3 — Keywords
- Organic search keyword data (where available from referrer parsing)

### Issues before (that motivated the feature)
| Issue | Impact |
|-------|--------|
| No UTM attribution in v1 | Impossible to measure paid campaign ROI |
| No link builder | Users hand-crafted UTM strings, introducing typos |
| All referrers lumped together | Social vs organic vs paid were indistinguishable |

### Result
- Campaign ROI is measurable end-to-end: create UTM link → share → see visitors, pageviews, bounce rate per campaign
- Link builder eliminates manual UTM construction errors
- Paginated table with live search handles hundreds of campaigns without performance issues

---

## Part C — Dashboard UX: PageNote & InfoTooltip (All 13 Pages)

### New components created

#### `src/components/ui/PageNote.jsx` (new)

| Prop | Type | Purpose |
|------|------|---------|
| `title` | string | Short "What is this page?" heading |
| `summary` | string | 1-2 sentence plain-language description |
| `details` | `{ label, text }[]` | Grid of metric/feature explanations |
| `businessTip` | string | Tip shown in an emerald card for business owners |
| `devTip` | string | Tip shown in a violet card for developers |
| `defaultOpen` | boolean | Start expanded (default: false) |

Design: indigo border/background, BookOpen icon, ChevronDown/Up toggle, accessible `<button>` trigger. Full dark mode support.

**Problem before**: No page had any contextual help. Business owners couldn't understand what metrics meant. Developers had to read the API reference to find which endpoint powered each chart.

**Result**: Every analytics page now answers "What am I looking at?" and "What should I do with this?" without leaving the dashboard.

#### `src/components/ui/InfoTooltip.jsx` (new)

| Prop | Type | Purpose |
|------|------|---------|
| `content` | string | Tooltip body text |
| `title` | string | Optional bold tooltip title |
| `size` | `'sm'|'md'` | Icon size |
| `position` | `'top'|'bottom'|'left'|'right'` | Tooltip direction |

Uses fixed positioning to escape overflow:hidden containers. Added to `MetricCard` and `ChartCard` via `info` prop.

### Pages updated — PageNote added

| Page | Route | PageNote topic |
|------|-------|---------------|
| `Dashboard.jsx` | `/` | KPI overview, sparklines, bounce rate interpretation |
| `Acquisition.jsx` | `/acquisition` | UTM campaigns, social traffic, keyword attribution |
| `Audience.jsx` | `/audience` | New vs returning, cohort retention, geographic breakdown |
| `Content.jsx` | `/content` | Entry pages, exit pages, site search |
| `Conversions.jsx` | `/conversions` | Goals, A/B tests, conversion funnels |
| `Engagement.jsx` | `/engagement` | Scroll depth, heatmaps, rage clicks, time on page |
| `Funnels.jsx` | `/funnels` | Multi-step funnel builder, drop-off analysis |
| `Performance.jsx` | `/performance` | Web Vitals (LCP, FID, CLS), JS errors |
| `PagesView.jsx` | `/pages` | Top pages, entry/exit, time on page per URL |
| `Realtime.jsx` | `/realtime` | Live visitors, event stream, active pages |
| `Reporting.jsx` | `/reporting` | Annotations, scheduled reports, data export |
| `UserFlow.jsx` | `/user-flow` | Sankey diagram, navigation paths |
| `Privacy.jsx` | `/privacy` | Data collection, retention, GDPR/CCPA compliance |

### Components updated

| Component | Change |
|-----------|--------|
| `src/components/ui/MetricCard.jsx` | Added `info` prop → renders `<InfoTooltip content={info} />` next to metric title |
| `src/components/ui/ChartCard.jsx` | Added `info` prop → renders `<InfoTooltip content={info} />` in title flex wrapper |

---

## Part D — Settings Page Full Rewrite

### File changed
`src/pages/Settings.jsx`

### Problem before
| Issue | Impact |
|-------|--------|
| Single scrolling column — all settings mixed together | Users couldn't find the tracking snippet |
| No contextual help | Business owners didn't know what "site ID" meant |
| Tracking script buried or absent | Highest-friction onboarding step |
| No connection/endpoint info | Developers guessed API base URLs |
| Alerts mixed with site config | Users hit alerts when looking for their script |

### What was improved

#### 4-tab layout

| Tab | Contents |
|-----|----------|
| **Sites** | `SiteManager` card + info banner explaining what sites are |
| **Tracking** | Auto-generated `<script>` tag, 4 custom event code examples, platform guides (WordPress / Webflow / Shopify / Next.js / Squarespace / Static HTML) |
| **Connection** | API Base URL, Active Site ID, Analytics Endpoint, Tracking Endpoint — each with `InfoTooltip` and `CopyButton`; DB architecture cards (PG writes → DuckDB reads) |
| **Alerts** | `AlertsPanel` — now isolated from site configuration |

#### PageNote
- Business tip: "Add your site, grab the one-line script, paste into `<head>` — tracking starts immediately. No cookies, no GDPR headaches."
- Developer tip: "Connection tab exposes all API endpoints. Tracking tab has ready-to-paste custom event snippets."

#### Internal helpers added
- `CopyButton({ value, size })` — copy-to-clipboard with check-state feedback + textarea fallback for older browsers
- `Section({ icon, iconColor, title, subtitle, children, action })` — consistent card wrapper for Connection tab rows

#### Custom event examples shown
```js
window.insightTrack?.track('button_click', { button: 'sign-up' });
window.insightTrack?.track('form_submit', { form: 'contact' });
window.insightTrack?.track('video_play', { title: 'intro-video' });
window.insightTrack?.track('purchase', { value: 49.99, currency: 'USD' });
```

### Result
Onboarding path is now linear: **Sites tab → Add Site → Tracking tab → copy snippet → paste → done**. Zero ambiguity.

---

## Part E — SiteManager Component Full Rewrite

### File changed
`src/components/ui/SiteManager.jsx`

### Problem before
| Issue | Impact |
|-------|--------|
| Single global `copied` state | Copying site A showed "Copied!" on all site cards simultaneously |
| No per-site snippet reveal | Users had to navigate away to find their tracking script |
| Site ID not copyable inline | Manual text selection required |
| No expanded detail view | Created date, endpoint, script all hidden |
| Delete button visible on active site | Users accidentally deleted their active site |
| Loading was plain text | No visual feedback |

### What was improved

#### `CopyInline` internal helper
- Each copy button has its own `useState(false)` for `copied` — no state conflicts across cards
- Shows checkmark for 2 s, then reverts
- `navigator.clipboard` with textarea fallback

#### Per-site expandable snippet panel
- Click card, Code icon, or chevron to toggle expanded state for that site only
- Expanded panel shows: tracking `<script>` on dark bg, CopyInline, site ID, created date, analytics endpoint

#### Site ID on card header
- Monospace ID displayed on collapsed card
- `CopyInline("Copy ID")` button right next to it — no need to expand first

#### Auto-expand on creation
- `expandedId` set to newly created site ID immediately after `sitesAPI.create()` resolves

#### Active site protection
- Delete button conditionally hidden when `site.id === siteId`
- `handleDeleteSite(e, id)` — `e.stopPropagation()` prevents card toggle on delete click

#### Loading + empty states
- Spinner: `border-t-accent animate-spin` div
- Empty: Globe icon + "No sites yet" + "Click Add Site" helper text

### Result
- Copy always works correctly regardless of how many sites exist
- New users see their snippet immediately after site creation
- Active site cannot be accidentally deleted

---

## Part F — Documentation Page Overhaul

### File changed
`src/pages/Documentation.jsx`

### Problem before
| Issue | Impact |
|-------|--------|
| Single long technical document | Business owners bounced — nothing non-technical |
| Static architecture diagram | No v1 vs v2 comparison, no migration path |
| No query engine comparison | Developers had no guidance when scaling beyond DuckDB |
| No business-oriented FAQ | Sales/ops teams had to ask engineers |

### What was improved

#### Dual-audience tab switcher
- **Business Owner tab** — 6 collapsible `<details>` sections:
  - What is InsightTrack and how does it work?
  - What data gets collected?
  - How do I add a website?
  - What reports are available?
  - Is it GDPR / privacy compliant?
  - What does "self-hosted" mean?
- **Developer tab** — full technical reference + enhanced `ArchitectureDiagram`

#### `ArchitectureDiagram` component — 4 tabs

| Tab | Content |
|-----|---------|
| **v1 — Flat DuckDB** | Legacy single-database flow + 4-row problems table |
| **v2 — Hot/Cold** *(default)* | Current architecture (PG hot writes / DuckDB cold reads), sync worker banner, 6-row latency comparison table, storage breakdown cards |
| **Hot/Cold Deep-Dive** | Tier cards, UNION ALL SQL variants, 7-step sync cycle, config tuning table |
| **Query Engine Migration** | 6 engine cards: DuckDB (active), Spark/EMR, Trino/Presto, AWS Athena, ClickHouse, BigQuery — each with effort badge, pros/cons, collapsible code snippet |

### Result
Non-technical stakeholders can use docs without engineering help. Architecture evolution is self-documenting in the UI.

---

## Part G — Privacy Page Overhaul

### File changed
`src/pages/Privacy.jsx`

### Problem before
Single tab of technical privacy controls — incomprehensible to non-developers.

### What was improved

#### Two tabs
| Tab | Audience | Contents |
|-----|----------|----------|
| **Business Owner** | Non-technical | Plain-English: what is collected, what is NOT collected, GDPR/CCPA compliance, opt-out, data retention, your rights |
| **Developer** | Technical | Data retention policy config (days slider, enable toggle, save/run cleanup), raw API reference, opt-out endpoint docs |

#### `InfoTooltip` used throughout
Every policy toggle and retention option has an `InfoTooltip` explaining the effect.

---

## Part H — Files Changed Summary

### New files
| File | Description |
|------|-------------|
| `src/components/ui/PageNote.jsx` | Collapsible contextual help banner |
| `src/components/ui/InfoTooltip.jsx` | Fixed-position hover tooltip for metric descriptions |
| `CHANGELOG-2026-05-02.md` | This file |
| `docs/hot-cold-analytics-architecture.md` | Full v2 architecture document |

### Modified files — frontend (`src/`)
| File | What changed |
|------|-------------|
| `src/pages/Dashboard.jsx` | Added `PageNote` |
| `src/pages/Acquisition.jsx` | Added `PageNote`; Campaign tab, UTM builder, Social tab, Keywords tab — all new |
| `src/pages/Audience.jsx` | Added `PageNote`; cohort retention table, new vs returning, geographic breakdown |
| `src/pages/Content.jsx` | Added `PageNote` |
| `src/pages/Conversions.jsx` | Added `PageNote` |
| `src/pages/Engagement.jsx` | Added `PageNote` |
| `src/pages/Funnels.jsx` | Added `PageNote` |
| `src/pages/Performance.jsx` | Added `PageNote` |
| `src/pages/PagesView.jsx` | Added `PageNote` |
| `src/pages/Realtime.jsx` | Added `PageNote` |
| `src/pages/Reporting.jsx` | Added `PageNote` |
| `src/pages/UserFlow.jsx` | Added `PageNote` |
| `src/pages/Privacy.jsx` | Full rewrite — dual-audience tabs |
| `src/pages/Settings.jsx` | Full rewrite — 4-tab layout |
| `src/pages/Documentation.jsx` | Full rewrite — dual-audience + `ArchitectureDiagram` |
| `src/components/ui/MetricCard.jsx` | Added `info` prop + `InfoTooltip` |
| `src/components/ui/ChartCard.jsx` | Added `info` prop + `InfoTooltip` |
| `src/components/ui/SiteManager.jsx` | Full rewrite — expandable cards, `CopyInline`, active-site protection |

### Modified files — backend (`appsv2/analytics-api/`)
| File | What changed |
|------|-------------|
| `src/sync/sync.js` | New dual-watermark sync worker with hot/cold split |
| `src/duckdb/schema.js` | `events_hot`, `sessions_hot`, `_sync_meta`, UNION ALL views |
| `src/duckdb/queries.js` | Queries read from transparent views (no changes to call sites) |
| `src/routes/sync.js` | New `/api/sync/full`, `/api/sync/run`, `/api/sync/status` |
| `src/routes/analytics.js` | Added `GET /api/analytics/:siteId/utm` (campaign data) |

### Modified files — docs (`docs/`)
| File | What changed |
|------|-------------|
| `docs/hot-cold-analytics-architecture.md` | New — full 12-section architecture doc |
| `docs/pg-duckdb-sync.md` | Updated sync internals (watermark strategy, Parquet cold path) |
| `docs/features.md` | Updated Site Management section with new Settings tabs + SiteManager |
| `docs/frontend-structure.md` | Added PageNote/InfoTooltip/SiteManager to component table; updated Pages table |

---

## Deployment

| Stack | Status |
|-------|--------|
| `apps/dashboard-web/` | ✅ Source of truth — all frontend edits made here |
| `appsv2/dashboard-web/` | ✅ Synced + Docker rebuilt |
| `traffic/analytics-dashboard/` | ✅ Synced |
| `appsv2/analytics-api/` | ✅ v2 backend with hot/cold sync |
| Docker (`docker-compose.v2.yml`) | ✅ `traffic2-ui` + `traffic2-backend` rebuilt and restarted |

**Rebuild command used:**
```bash
docker-compose -f docker-compose.v2.yml build --no-cache ui
docker-compose -f docker-compose.v2.yml up -d ui
```

---

## Known Issues / Follow-up

| Item | Priority | Notes |
|------|----------|-------|
| `AlertsPanel` has no `PageNote` | Low | Alerts page is in Settings tab — separate page not planned yet |
| Platform guides in Tracking tab are static text | Low | Could link to live install docs |
| `ArchitectureDiagram` engine snippets are illustrative | Medium | Not wired to real migration scripts |
| `SiteManager` delete has no modal confirmation | Medium | Only a toast guard — easy to mis-click on mobile |
| Parquet cold store path not user-configurable | Medium | Hardcoded to `data-lake/` — should be `COLD_PATH` env var |
| `UNION ALL` view rebuild on every sync cycle | Low | Could diff Parquet file list to skip unnecessary rebuilds |


### Problem before
| Issue | Impact |
|-------|--------|
| All settings crammed into a single scrolling column | Users struggled to find the tracking snippet among other settings |
| No contextual help or explanation | Business owners didn't know what a "site ID" was or why it mattered |
| Tracking script was hidden / hard to copy | Highest-friction onboarding step caused support requests |
| Connection info (API URLs, endpoints) was absent | Developers had to guess API base URLs when integrating |
| Alerts section had no separation from site config | Users accidentally edited alert thresholds when looking for their site key |

### What was improved

#### Tabbed layout (4 tabs)
| Tab | Contents |
|-----|----------|
| **Sites** | `SiteManager` + info banner explaining what sites are |
| **Tracking** | Auto-generated `<script>` snippet with copy button, custom event examples (4), platform guides (WordPress / Webflow / Shopify / Next.js / Squarespace / Static HTML) |
| **Connection** | API Base URL, Active Site ID, Analytics Endpoint, Tracking Endpoint — each with `InfoTooltip` and `CopyButton`; Database Architecture cards (PG writes / DuckDB reads) |
| **Alerts** | `AlertsPanel` component — now cleanly isolated from site config |

#### PageNote (contextual help banner)
- Added collapsible `PageNote` at the top of Settings
- **Business tip**: "Add your site, grab the one-line script, paste it into your `<head>` — tracking starts immediately. No cookies, no GDPR headaches."
- **Developer tip**: "The Connection tab exposes API endpoints and active site context. Use the Tracking tab for custom event instrumentation."
- Detail items cover: Sites, Tracking Script, Custom Events, Alerts — in plain English

#### Internal helper components added
- `CopyButton({ value, size })` — standalone copy button with check-state feedback, clipboard fallback for older browsers
- `Section({ icon, iconColor, title, subtitle, children, action })` — consistent card wrapper used for every section in the Connection tab

#### Custom event code examples
Four ready-to-paste snippets shown in the Tracking tab:
```js
// Button click
window.insightTrack?.track('button_click', { button: 'sign-up' });

// Form submit
window.insightTrack?.track('form_submit', { form: 'contact' });

// Video play
window.insightTrack?.track('video_play', { title: 'intro-video' });

// Purchase
window.insightTrack?.track('purchase', { value: 49.99, currency: 'USD' });
```

#### Platform guides
Quick-start steps shown for: WordPress, Webflow, Shopify, Next.js (`_document.js`), Squarespace, Static HTML.

### Result
- Onboarding path is now: **Settings → Sites tab → Add Site → Tracking tab → copy snippet → paste → done**
- All configuration surfaces have contextual help
- Zero ambiguity about where to find API endpoints for custom integrations

---
