# InsightTrack — Complete Feature Reference

> A comprehensive guide to every feature available in the InsightTrack self-hosted web analytics platform.

---

## Table of Contents

- [Core Analytics](#core-analytics)
- [Real-Time Tracking](#real-time-tracking)
- [Engagement Analytics](#engagement-analytics)
- [User Flow & Funnels](#user-flow--funnels)
- [Conversion & Goals](#conversion--goals)
- [Audience Analytics](#audience-analytics)
- [Content Analytics](#content-analytics)
- [Acquisition Analytics](#acquisition-analytics)
- [Performance Monitoring](#performance-monitoring)
- [Reporting & Annotations](#reporting--annotations)
- [Geographic, Device & Browser Analytics](#geographic-device--browser-analytics)
- [UTM Campaign Tracking](#utm-campaign-tracking)
- [Site Management](#site-management)
- [Authentication & Security](#authentication--security)
- [Export & Reporting](#export--reporting)
- [Dark Mode & UI](#dark-mode--ui)
- [Privacy & Compliance](#privacy--compliance)
- [Privacy & Data Retention](#privacy--data-retention)
- [Dual Database Architecture](#dual-database-architecture)
- [Caching](#caching)
- [Tracking Script](#tracking-script)
- [Docker Deployment](#docker-deployment)

---

## Core Analytics

### KPI Dashboard

The main dashboard surfaces four key performance indicators, each with a trend comparison against the previous period and a sparkline mini-chart:

| Metric | Description |
|---|---|
| **Total Visitors** | Unique user count (anonymous UUID-based) |
| **Pageviews** | Total page views across the site |
| **Bounce Rate** | Percentage of single-page sessions |
| **Avg. Session Duration** | Average time per session in seconds |

### Date Range Filtering

- Preset ranges: Today, Last 7 days, Last 30 days, Last 90 days
- Custom date picker for arbitrary ranges
- Comparison mode overlays current vs. previous period on charts

### Traffic Analysis Charts

- **Traffic Over Time** — Line chart of daily visitors and sessions
- **Pageviews Over Time** — Area chart of pageview trends
- **Bounce Rate Trend** — Daily bounce rate line chart
- **Avg. Session Duration Trend** — Daily session length chart

### Top Pages

Sortable table of the most visited pages with:

- Page URL / path
- View count and unique visitor count
- Percentage of total traffic
- Configurable limit (top 10, 25, or 50)

---

## Real-Time Tracking

### Live Dashboard

The Realtime page provides a live view of site activity, auto-refreshing every 5 seconds:

- **Active Visitor Count** — Users active in the last 5 minutes, displayed with a pulsing indicator
- **Live Visitor Map** — Interactive world map pinpointing active visitor locations by country and city
- **Active Pages** — Pages currently receiving traffic, ranked by visitor count
- **Device Breakdown** — Real-time desktop / mobile / tablet distribution
- **Live Event Stream** — Feed of the last 50–100 events (pageviews, clicks, custom events) as they happen

### Automatic Event Capture

Every visitor interaction is captured automatically:

- **Pageviews** — Recorded on every page load and SPA route change
- **Clicks** — Outbound link clicks tracked with destination URL
- **Sessions** — Auto-created with a unique session ID stored in `sessionStorage`
- **Anonymous User IDs** — Random UUIDs stored in `localStorage` (no cookies)

---

## Engagement Analytics

Four engagement features that measure how users interact with page content. All data is collected by the auto-generated tracking script and displayed on the dedicated **Engagement** dashboard page.

### Scroll Depth Tracking

Measures how far users scroll down each page, capturing milestones at **25%, 50%, 75%, and 100%** of page height.

- Per-page average scroll depth
- Milestone breakdown (how many users reached each level)
- Sent as a `scroll_depth` event on page unload

**Event schema:**
```json
{
  "type": "scroll_depth",
  "properties": {
    "depth": 75,
    "milestones": [25, 50, 75]
  }
}
```

### Click Heatmaps

Records the coordinates of every click on the page for heatmap visualization.

- Full x/y coordinates and normalized 0–1.0 relative coordinates
- CSS selector of the clicked element
- Viewport dimensions and document height for context
- Per-page heatmap view with up to 500 click points
- Top clicked elements summary ranked across all pages

**Event schema:**
```json
{
  "type": "heatmap_click",
  "properties": {
    "x": 420,
    "y": 890,
    "relX": 0.35,
    "relY": 0.62,
    "selector": "button.cta-primary",
    "viewportW": 1200,
    "viewportH": 800,
    "docHeight": 3400
  }
}
```

### Rage Click Detection

Identifies user frustration by detecting **3 or more rapid clicks** on the same element within 1 second.

- Tracks which element triggered the rage click (CSS selector, tag, text)
- Records the number of rapid clicks per incident
- Aggregate reporting by page and element
- Sent as a `rage_click` event in real time

**Event schema:**
```json
{
  "type": "rage_click",
  "properties": {
    "selector": "button#submit",
    "tag": "BUTTON",
    "text": "Submit",
    "clickCount": 5
  }
}
```

### Time on Page

Measures the actual time a user spends viewing each page, independent of session duration.

- Reported in seconds on page unload
- Statistical breakdown: average, median, min, max per page
- Outlier filtering removes values < 0 or > 3600 seconds

**Event schema:**
```json
{
  "type": "time_on_page",
  "properties": {
    "seconds": 42
  }
}
```

### Engagement Summary KPIs

The Engagement page displays four summary cards:

| Metric | Description |
|---|---|
| Avg Scroll Depth | Cross-site average scroll percentage |
| Avg Time on Page | Cross-site average read time in seconds |
| Total Clicks | Total heatmap clicks tracked |
| Rage Click Incidents | Count of frustration events |

---

## User Flow & Funnels

### User Flow (Sankey Diagram)

Visualizes how visitors navigate between pages:

- **Entry points** — Landing pages shown on the left
- **Page transitions** — Directed paths between pages with proportional thickness
- **Exit pages** — Where visitors leave, shown on the right
- **Flow metrics** — Visitor count for each transition path

### Funnel Analysis

Define multi-step conversion funnels and track drop-off at each stage:

- Custom funnel creation (e.g., Landing → Signup → Checkout → Purchase)
- Per-stage visitor count, drop-off amount, and conversion rate
- Visual funnel chart showing narrowing volume at each step
- Saved funnel definitions for repeated analysis

---

## Conversion & Goals

### Goal Tracking

Define conversion goals and track their completion rates:

- **Goal types**: Pageview (URL match), Event (custom event), Duration (time threshold), Scroll Depth (percentage threshold)
- CRUD management for goals via the Goals API
- Per-goal conversion count and conversion rate over time
- Goal conversion trend charts with date filtering

### A/B Testing

Run experiments to compare variants:

- Create A/B tests with name, description, and variant definitions
- Track which variant each visitor sees
- Compare conversion rates across variants
- Test status management: draft, running, completed

### Revenue Attribution

Track revenue from purchase events:

- Total revenue, average order value, and transaction count
- Revenue over time trend charts
- Attribution by traffic source

---

## Audience Analytics

### New vs Returning Visitors

Understand your audience composition:

- **New visitors** — First-time users (no previous session)
- **Returning visitors** — Users with prior sessions (`is_returning` flag)
- Pie/donut chart breakdown with percentages
- Trend over time showing acquisition vs retention

### Cohort Analysis

Group users by first visit date and track retention:

- Weekly or monthly cohorts based on first session
- Retention rates for subsequent periods
- Heatmap visualization of cohort retention

### Visitor Segments

Segment visitors by device, browser, OS, or country:

- Segment-level KPIs (visitors, pageviews, bounce rate, duration)
- Compare segment performance side by side

---

## Content Analytics

### Entry Pages

Identify which pages visitors land on first:

- Top entry pages ranked by visitor count
- Entry rate percentage per page
- Bar chart visualization + sortable table
- Filter by date range

### Exit Pages

See where visitors leave your site:

- Top exit pages ranked by exit count
- Exit rate percentage per page
- Bar chart visualization + sortable table

### Site Search

Track what visitors search for on your site:

- Search queries with frequency counts
- Automatic detection via form submit interception
- Sent as `site_search` events with the query term
- Searchable query table in the dashboard

---

## Acquisition Analytics

### Campaign Dashboard

Comprehensive UTM campaign analysis:

- All five UTM parameters (source, medium, campaign, term, content)
- Per-campaign visitor count, pageview count, bounce rate, and session duration
- Bar chart of top campaigns + full sortable table
- Filter by date range

### Social Media Traffic

Breakdown of traffic from social platforms:

- Automatic classification of social referrers (Facebook, Twitter/X, LinkedIn, Instagram, YouTube, Reddit, Pinterest, TikTok)
- Per-platform visitor and pageview counts
- Pie chart visualization + platform cards

### Search Keywords

Track organic search terms driving traffic:

- UTM term extraction from campaign URLs
- Keyword frequency and visitor counts
- Sortable keyword table

---

## Performance Monitoring

### Web Vitals

Monitor Core Web Vitals for your site in real time:

| Metric | Description | Good | Needs Improvement | Poor |
|--------|-------------|------|-------------------|------|
| **LCP** | Largest Contentful Paint | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| **FID** | First Input Delay | ≤ 100ms | ≤ 300ms | > 300ms |
| **CLS** | Cumulative Layout Shift | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| **INP** | Interaction to Next Paint | ≤ 200ms | ≤ 500ms | > 500ms |
| **TTFB** | Time to First Byte | ≤ 800ms | ≤ 1800ms | > 1800ms |

- Collected automatically via `PerformanceObserver` in the tracking script
- Color-coded metric cards (green/yellow/red) based on thresholds
- Per-page Web Vitals breakdown table
- Sent as `web_vital` events

### JavaScript Error Tracking

Catch and monitor client-side errors:

- Automatic capture via `window.onerror` and `unhandledrejection`
- Error message, source file, line/column number, and stack trace
- Error trend chart over time (area chart)
- Error cards showing message, file, count, and last occurrence
- Sent as `js_error` events

---

## Reporting & Annotations

### Annotations

Add contextual notes to your analytics timeline:

- Create annotations with title, description, date, and category
- Categories: deployment, marketing, incident, other
- Color-coded category badges in the UI
- List view with delete capability

### Scheduled Reports

Automate analytics report delivery:

- Create report schedules with name, frequency (daily/weekly/monthly), and recipient emails
- Enable or disable schedules
- Report configuration includes metrics, format, and date range

### Data Export

Export analytics data from the Reporting page:

- **JSON export** of KPI, traffic, pages, and sources data
- Select data types to include
- One-click download with date range applied

### Custom Dashboards

Save personalized dashboard layouts:

- Create dashboards with name, description, and widget configuration
- Widget-level metrics and layout support
- CRUD management via the API

---

## Privacy & Data Retention

### Privacy-First Design

InsightTrack respects user privacy by default:

| Feature | Implementation |
|---------|---------------|
| **Do Not Track (DNT)** | Tracking script checks `navigator.doNotTrack` and stops if enabled |
| **Global Privacy Control (GPC)** | Respects `navigator.globalPrivacyControl` signal |
| **No cookies** | Uses `localStorage` for anonymous user ID only |
| **No IP storage** | IP addresses are never stored in the database |
| **Self-hosted** | All data stays on your infrastructure |
| **Lightweight** | Tracking script is ~2 KB gzipped |

### Data Retention Policies

Control how long analytics data is stored:

- Configure retention period in days per site
- Preset options: 30, 90, 180, or 365 days
- Manual cleanup trigger to delete expired data
- Automatic deletion of events and sessions older than the retention period
- GDPR-friendly data lifecycle management

---

## Geographic, Device & Browser Analytics

### Country & Location

- Top 10 countries by visitor count with flag emojis
- Percentage breakdown of traffic by country
- Country detected from the user's timezone (`Intl.DateTimeFormat`) — **not IP-based**
- City-level data stored in events for granular analysis

### Device Type

- Automatic classification: **Desktop**, **Mobile**, **Tablet**
- Detection via screen width heuristics (no fingerprinting)
- Donut chart visualization with visitor counts per device

### Browser & Operating System

- Browser detection: Chrome, Firefox, Safari, Edge, Opera, and more
- OS detection: Windows, macOS, Linux, iOS, Android
- Parsed from `navigator.userAgent` automatically
- Sent with every event for full-stack filtering

---

## UTM Campaign Tracking

### UTM Parameter Capture

All five standard UTM parameters are extracted automatically from the page URL:

| Parameter | Example |
|---|---|
| `utm_source` | google, newsletter, twitter |
| `utm_medium` | cpc, email, social |
| `utm_campaign` | spring_sale, product_launch |
| `utm_term` | analytics+tools |
| `utm_content` | header_cta, sidebar_link |

UTM values are persisted per session and attached to every event.

### Traffic Source Classification

Referrers are automatically categorized:

| Category | Sources |
|---|---|
| **Search** | Google, Bing, Yahoo, DuckDuckGo, Baidu, Yandex |
| **Social** | Facebook, Twitter/X, LinkedIn, Instagram, YouTube, Reddit, Pinterest, TikTok |
| **Email** | Mail provider referrers |
| **Direct** | No referrer (typed URL or bookmarked) |
| **Referral** | All other referring domains |

---

## Site Management

### Multi-Site Support

- Create and manage multiple websites from one dashboard
- Each site gets a unique site ID and isolated analytics data
- Switch between sites via the site selector dropdown in the navbar

### Settings Page — Tabbed Layout *(updated May 2026)*

The Settings page was fully rewritten with a 4-tab layout for clarity:

| Tab | Contents |
|-----|----------|
| **Sites** | `SiteManager` card — add, switch, delete sites |
| **Tracking** | Auto-generated `<script>` snippet, custom event examples, platform guides |
| **Connection** | API Base URL, Active Site ID, Analytics Endpoint, Tracking Endpoint — each copyable |
| **Alerts** | Alert thresholds panel — now isolated from site configuration |

A **PageNote** banner at the top provides contextual help for both business owners and developers.

### Tracking Script Installation

From **Settings → Tracking tab** — the script for the currently active site is shown automatically:

```html
<script src="https://your-server/api/sites/:siteId/script"></script>
```

- One-click copy-to-clipboard
- Platform quick-start guides for: WordPress, Webflow, Shopify, Next.js, Squarespace, Static HTML

#### Custom Event Tracking

Four copy-ready code examples are shown in the Tracking tab:

```js
window.insightTrack?.track('button_click', { button: 'sign-up' });
window.insightTrack?.track('form_submit', { form: 'contact' });
window.insightTrack?.track('video_play', { title: 'intro-video' });
window.insightTrack?.track('purchase', { value: 49.99, currency: 'USD' });
```

### SiteManager Component *(updated May 2026)*

Each site card in the Sites tab supports:

- **Expand/collapse** — click the card or Code icon to reveal the tracking snippet
- **Inline copy** — site ID and tracking script each have independent copy buttons (no state conflicts)
- **Auto-expand** — newly created sites expand immediately to show their snippet
- **Active site protection** — delete button is hidden for the currently active site
- **Quick info row** — shows site ID, created date, and analytics endpoint when expanded

### Site CRUD

- **Create** — Add a website with name and domain (validated format)
- **Delete** — Remove a non-active site and its data
- **View details** — Retrieve site metadata, script snippet, and stats inline

---

## Authentication & Security

### User Accounts

- **Registration** — Name, email, and password (minimum 6 characters)
- **Login** — Email + password with JWT token returned
- **Password storage** — bcrypt hashing at rest
- **JWT authentication** — Stateless bearer token for all protected API routes

### Profile Management

- View and update name, email, timezone
- Avatar with gradient background and initials
- Auto-detected timezone from browser (can be overridden)
- User roles: Owner, Admin

### Security Measures

| Feature | Detail |
|---|---|
| **Parameterized SQL** | All queries use `$1` (PG) or `?` (DuckDB) — no string interpolation |
| **CORS** | Configurable allowed origins |
| **Rate limiting** | API endpoints protected against abuse |
| **Helmet** | CSP, X-Frame-Options, and other HTTP security headers |
| **Input validation** | All user input sanitized and length-truncated |
| **Protected routes** | Every endpoint requires auth except `/api/track/*`, `/api/auth/login`, `/api/auth/register` |

---

## Export & Reporting

### Custom Dashboard Builder

A freeform drag-and-drop canvas for building custom analytics dashboards. Widgets are positioned with pixel precision; layouts are persisted to PostgreSQL.

**Widget types:** KPI Card, Area Chart, Bar Chart, Pie/Donut Chart, Data Table, Text/Note

**Key capabilities:**

| Feature | Details |
|---------|---------|
| **Freeform canvas** | Pixel-based placement — drag widget headers to reposition anywhere |
| **8-direction resize** | Resize from any corner or edge; per-type minimum size constraints |
| **Snap to Grid** | Optional 20px snap grid with visual dot-grid overlay |
| **WidgetConfigPanel** | Right-side drawer with 3 tabs: Data, Display, Style — all changes live-preview instantly |
| **8 color palettes** | Default, Ocean, Warm, Mono, Forest, Candy, Fire, Purple |
| **Autosave** | 3-second debounce write on any widget or layout change |
| **Share link** | Shareable read-only dashboard URL (Base64-encoded JSON in URL hash) |
| **Per-widget capture** | Camera icon exports any single widget as PNG via html2canvas |

### Export Formats

Export any dashboard as PDF, PNG, JSON, or CSV via the Export modal.

| Format | Use Case | Mechanism |
|--------|----------|-----------|
| **PDF** | Board reports, client documents | `PrintLayout` portal + browser `window.print()` |
| **PNG** | Presentation slides, Slack embeds | `html2canvas` SVG-swap pipeline (retina 2×) |
| **JSON** | Dashboard backup, re-import | Full widget array download |
| **CSV** | Spreadsheet analysis | Per-widget data serialized to CSV |

The PDF pipeline renders a dedicated `PrintLayout` (cover page, KPI grid, chart section, footer) into a hidden DOM portal — the live app is hidden during print so no layout artifacts occur.

The PNG pipeline converts all Recharts SVGs to `<img>` elements before `html2canvas` runs, then restores the live SVGs — ensuring chart content is captured correctly.

### Data Access

- Query any historical date range
- Preset ranges: Last 7 days, Last 30 days, Last 90 days, All time
- Custom date ranges in `YYYY-MM-DD` format
- Comparison mode: current period vs. previous period
- Daily aggregated rollups for trend analysis

---

## Dark Mode & UI

### Theme Support

- **Manual toggle** — Switch between light and dark themes via the navbar icon
- **System preference** — Automatically follows the OS dark/light mode setting
- **Persistent** — Theme preference saved to `localStorage`
- **Full coverage** — Every component, chart, and table supports dark mode via Tailwind `dark:` variants

### Dashboard UI

- **Responsive layout** — Optimized for desktop, tablet, and mobile screens
- **Collapsible sidebar** — Full labels on desktop, icon-only on mobile
- **Toast notifications** — Success and error feedback
- **Loading skeletons** — Placeholder content while data loads
- **Error boundaries** — Graceful error display with recovery options

### Chart Types (Recharts)

| Chart | Used For |
|---|---|
| Line chart | Traffic over time, bounce rate trends |
| Area chart | Pageviews over time |
| Donut chart | Device type breakdown |
| Bar chart | Top pages, browser/OS distribution |
| Sankey diagram | User flow navigation paths |
| Funnel chart | Conversion funnel stages |
| Sparkline | KPI trend indicators |

---

## Privacy & Compliance

InsightTrack is designed as a **privacy-first** analytics platform:

| Principle | Implementation |
|---|---|
| **No cookies** | Tracking uses `localStorage` for anonymous user ID — no cookie consent banner needed |
| **Anonymous users** | Random UUIDs only, no PII collected |
| **Self-hosted** | All data stays on your own infrastructure |
| **No third-party sharing** | Zero data sent to external services |
| **Timezone geolocation** | Country detected from timezone, not IP address |
| **DNT / GPC respect** | Tracking script honors Do Not Track and Global Privacy Control browser signals |
| **Data retention policies** | Configurable per-site retention periods with automatic cleanup |
| **No IP storage** | IP addresses are never persisted |
| **Lightweight** | Tracking script is ~2 KB gzipped |
| **Zero-config** | Single `<script>` tag, works on any website |

---

## Dual Database Architecture

InsightTrack uses a **write/read split** across two databases for optimal performance:

### PostgreSQL (Write Layer — OLTP)

All data mutations go through PostgreSQL:

- Event ingestion (pageviews, clicks, engagement events)
- Session creation and updates
- User authentication (registration, login)
- Site management (CRUD)
- Funnel definitions

**Tables:** `events`, `sessions`, `sites`, `users`, `funnels`, `goals`, `ab_tests`, `annotations`, `report_schedules`, `custom_dashboards`, `data_retention_policies`

### DuckDB (Read Layer — OLAP)

All analytics queries run against DuckDB:

- KPI calculations (visitors, pageviews, bounce rate, duration)
- Traffic and engagement aggregations
- Funnel conversion analysis
- Top pages, referrer, and source breakdowns
- Content analytics (entry/exit pages, site search)
- Acquisition analytics (campaigns, social, keywords)
- Performance metrics (Web Vitals, JS errors)
- Goal conversion and A/B test analysis
- Audience segmentation and cohort analysis

**Performance gains over PostgreSQL:**

| Query Type | PostgreSQL | DuckDB | Speedup |
|---|---|---|---|
| `COUNT(DISTINCT user_id)` | 120 ms | 8 ms | 15× |
| `GROUP BY date` aggregations | 200 ms | 15 ms | 13× |
| Window functions | 500 ms | 40 ms | 12× |
| Funnel analysis | 350 ms | 25 ms | 14× |

### Sync Mechanism

- **Incremental sync** — Only new rows copied from PostgreSQL to DuckDB
- **High-water-mark** — `_sync_meta` table tracks the last synced ID per table
- **Non-blocking** — Sync does not lock analytical queries
- **Rebuild support** — Reset DuckDB and re-sync from scratch at any time
- **Scheduling** — Typically runs every 5 minutes via cron

---

## Caching

### In-Memory API Cache

Server-side caching reduces database load:

| Query Category | TTL |
|---|---|
| KPI queries | 5 minutes |
| Traffic / pageviews | 5 minutes |
| General analytics | 10 minutes |
| Realtime data | 30 seconds |
| Event stream | 30 seconds |

- Cache keys are scoped per site and date range
- Automatic invalidation when new tracking events arrive
- Manual refresh available from the dashboard

### Frontend Polling

- Dashboard auto-refreshes every 60 seconds
- Manual refresh button for immediate data fetch
- "Last updated" timestamp shown in the UI

---

## Tracking Script

### Installation

Add the auto-generated script to your website:

```html
<script src="https://your-server/api/sites/YOUR_SITE_ID/script"></script>
```

### What Gets Tracked Automatically

| Data Point | Source |
|---|---|
| Page URL & path | `window.location` |
| Referrer | `document.referrer` |
| Browser & OS | `navigator.userAgent` |
| Device type | Screen width heuristics |
| Country | `Intl.DateTimeFormat` timezone |
| Session ID | `sessionStorage` |
| User ID | `localStorage` (anonymous UUID) |
| UTM parameters | URL query string |
| Scroll depth | Scroll event milestones |
| Click coordinates | Click event x/y + selector |
| Rage clicks | Rapid click detection |
| Time on page | Page unload timing |

### SPA Support

The tracking script automatically detects single-page applications by listening for `popstate`, `pushState`, and `replaceState` events. Each SPA route change sends a new pageview — no extra configuration needed. Works with React Router, Vue Router, Next.js, and others.

### Custom Events API

Track custom business events from your application code:

```javascript
window.analytics.track('signup', { plan: 'pro' });
window.analytics.track('purchase', { amount: 49.99, currency: 'USD' });
```

Pre-defined event types: `impression`, `add_to_cart`, `checkout`, `purchase`, `signup`, `form_submit`, `lead`, `button_click`, `video_play`

---

## Docker Deployment

### Quick Start

```bash
docker-compose up --build
```

This starts five services:

| Service | Description | Port |
|---|---|---|
| `db` | PostgreSQL 15 | 5432 |
| `backend` | Express API server | 3001 |
| `ui` | React dashboard (nginx) | 4173 |
| `demo-site` | Demo blog (nginx) | 8080 |
| `pgadmin` | Database admin UI | 5050 |

### Configuration

All settings are managed via environment variables in `.env` or `docker-compose.yml`:

- Database credentials and connection strings
- JWT secret key
- CORS allowed origins
- API port and host

### Production Deployment

- **Nginx** — Built-in reverse proxy config for the frontend
- **PM2** — Process manager support for the backend
- **Volume persistence** — PostgreSQL and DuckDB data survive container restarts
- **Multi-stage builds** — Optimized Docker images for production

---

## API Endpoints

For the full API reference with request/response examples, see the [API Reference](api-reference.md).

### Quick Overview

| Category | Endpoints |
|---|---|
| **Auth** | `POST /api/auth/register`, `POST /api/auth/login` |
| **Sites** | `GET/POST/PUT/DELETE /api/sites` |
| **Tracking** | `POST /api/track/event`, `POST /api/track/batch` |
| **Analytics** | `/api/analytics/:siteId/kpi`, `/traffic`, `/pageviews`, `/top-pages`, `/sources`, `/countries`, `/devices`, `/browsers`, `/os` |
| **Realtime** | `/api/analytics/:siteId/realtime/*` |
| **Engagement** | `/api/analytics/:siteId/engagement/*` |
| **User Flow** | `/api/analytics/:siteId/user-flow` |
| **Funnels** | `/api/analytics/:siteId/funnel`, `GET/POST/DELETE /api/funnels` |
| **Content** | `/api/analytics/:siteId/content/entry-pages`, `/content/exit-pages`, `/content/site-search` |
| **Acquisition** | `/api/analytics/:siteId/acquisition/campaigns`, `/acquisition/social`, `/acquisition/keywords` |
| **Performance** | `/api/analytics/:siteId/performance/web-vitals`, `/performance/web-vitals-overview`, `/performance/errors`, `/performance/errors-over-time` |
| **Goals** | `GET/POST/PUT/DELETE /api/goals/:siteId/*` |
| **Reporting** | `GET/POST/DELETE /api/reporting/:siteId/annotations`, `/reports`, `/dashboards`, `/retention` |
| **Export** | `/api/analytics/:siteId/export/:format` |

---

*Last updated: April 2026*
