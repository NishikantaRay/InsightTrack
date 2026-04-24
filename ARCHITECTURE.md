# InsightTrack — Architecture & Implementation Docs

> **Self-Hosted Web Analytics Platform** | Last Updated: March 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Data Flow](#3-data-flow)
4. [Database Schema](#4-database-schema)
5. [Tracking Script Logic](#5-tracking-script-logic)
6. [Backend API Logic & Examples](#6-backend-api-logic--examples)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Component Hierarchy](#8-component-hierarchy)
9. [State Management](#9-state-management)
10. [Deployment Topology](#10-deployment-topology)
11. [DuckDB Analytics Engine](#11-duckdb-analytics-engine)
12. [Data Sync Mechanism](#12-data-sync-mechanism)

---

## 1. System Overview

The platform is a **self-hosted web analytics solution** with a **dual-database** architecture:

| Layer | Tech Stack | Purpose |
|-------|-----------|--------|
| **Tracking** | Vanilla JS (`analytics.js`) | Embedded in websites to capture user events |
| **Backend** | Node.js + Express + PostgreSQL + DuckDB | Unified API — writes to PG, reads from DuckDB |
| **Dashboard** | React 18 + Vite 5 + Tailwind CSS 3 + Recharts | Visual analytics dashboard |
| **DuckDB** | Embedded columnar OLAP | 10-100x faster analytical queries (in-process) |
| **Sync** | Incremental high-water-mark | Copies new PG rows → DuckDB periodically |

---

## 2. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        SYSTEM ARCHITECTURE                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────┐       ┌──────────────────────────────────────┐  │
│  │   Demo Website       │       │   Analytics Dashboard (React)       │  │
│  │   (Static HTML)      │       │   Port: 5173                        │  │
│  │                      │       │                                      │  │
│  │  ┌────────────────┐  │       │  ┌──────────┐  ┌──────────────────┐ │  │
│  │  │  analytics.js   │  │       │  │  Zustand  │  │  Recharts Charts │ │  │
│  │  │  (tracking)     │  │       │  │  Stores   │  │  (8 components)  │ │  │
│  │  └───────┬────────┘  │       │  └─────┬────┘  └────────┬─────────┘ │  │
│  │          │            │       │        │                │           │  │
│  │  Pages:  │            │       │  ┌─────▼────────────────▼─────────┐│  │
│  │  index   │  POST      │       │  │  useAnalytics Hook             ││  │
│  │  about   │  /api/     │       │  │  (fetch + cache + auto-refetch)││  │
│  │  products│  track/    │       │  └─────┬──────────────────────────┘│  │
│  │  pricing │  event     │       │        │ GET /api/analytics/*      │  │
│  │  contact │            │       │        │ (via Vite proxy)          │  │
│  └──────────┼────────────┘       └────────┼──────────────────────────┘  │
│             │                             │                              │
│             ▼                             ▼                              │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │         Express Backend (apps/analytics-api) — Port: 3001          │  │
│  │                                                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐            │  │
│  │  │ Tracking     │  │ Analytics    │  │ Sites + Auth  │            │  │
│  │  │ Routes → PG  │  │ Routes →Duck │  │ Routes → PG   │            │  │
│  │  │              │  │              │  │               │            │  │
│  │  │ POST /event  │  │ GET /traffic │  │ GET  /sites   │            │  │
│  │  │ POST /session│  │ GET /kpi     │  │ POST /sites   │            │  │
│  │  │ POST /batch  │  │ GET /realtime│  │ POST /auth/*  │            │  │
│  │  │ GET  /pixel  │  │ GET /funnel  │  │               │            │  │
│  │  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘            │  │
│  │         │                 │                   │                    │  │
│  │  ┌──────▼─────────┐  ┌───▼──────────┐ ┌──────▼───────────────┐    │  │
│  │  │ Service Layer  │  │ Query Layer  │ │ Service Layer        │    │  │
│  │  │ trackingSvc    │  │ queries.js   │ │ authSvc, sitesSvc    │    │  │
│  │  │ (PG writes)    │  │ (DuckDB)     │ │ cache.js (PG writes) │    │  │
│  │  └──────┬─────────┘  └───┬──────────┘ └──────┬───────────────┘    │  │
│  │         │                │                    │                    │  │
│  └─────────┼────────────────┼────────────────────┼────────────────────┘  │
│            │                │                    │                       │
│            ▼                ▼                    ▼                       │
│  ┌─────────────────┐  ┌─────────────────┐                               │
│  │  PostgreSQL     │  │  DuckDB         │                               │
│  │  (Docker)       │──│  (Embedded)     │                               │
│  │  Port 5432      │  │  analytics.duckdb│                              │
│  │                 │  │                  │                               │
│  │  WRITES:        │  │  READS:          │                               │
│  │  events,sessions│  │  21 analytical   │                               │
│  │  sites,users    │  │  query functions │                               │
│  │  funnels        │  │                  │                               │
│  └────────┬────────┘  └──────────────────┘                               │
│           │                 ▲                                            │
│           │   sync.js       │                                            │
│           └─────────────────┘                                            │
│           (incremental high-water-mark sync)                             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow

### 3.1 Event Tracking Flow (Write Path)

```
User visits page
       │
       ▼
analytics.js loads
       │
       ├──▶ Generate/restore userId (localStorage)
       ├──▶ Generate/restore sessionId (sessionStorage)
       ├──▶ Detect device, browser, OS, country
       │
       ▼
trackPageview()
       │
       ├──▶ POST /api/track/event ─────────▶ trackingService.trackEvent()
       │         {                                      │
       │           siteId: "site_123",                  ├── Validate siteId + userId
       │           userId: "u_abc123",                  ├── Sanitize & truncate fields
       │           sessionId: "s_xyz789",               ├── Check event type whitelist
       │           type: "pageview",                    └── INSERT INTO events
       │           path: "/products",
       │           device: "Desktop",
       │           browser: "Chrome",
       │           os: "macOS",
       │           country: "India"
       │         }
       │
       └──▶ POST /api/track/session ───────▶ trackingService.upsertSession()
                  {                                      │
                    sessionId: "s_xyz789",                ├── SELECT existing session
                    siteId: "site_123",                  ├── IF exists: UPDATE
                    userId: "u_abc123",                  │     (duration, pageviews,
                    entryPage: "/",                      │      exit_page, is_bounce)
                    exitPage: "/products",               └── ELSE: INSERT new session
                    duration: 0,
                    pageviews: 2
                  }

User leaves page (visibilitychange / beforeunload)
       │
       ├──▶ POST /api/track/event (scroll_depth, time_on_page)
       └──▶ POST /api/track/session (update with final duration)
```

### 3.2 Dashboard Data Flow (Read Path)

```
Dashboard loads
       │
       ▼
useAnalytics('getKPIs') hook triggers
       │
       ├── Constructs URL: /api/analytics/site_123/kpi?dateRange=30d
       ├── Axios GET via Vite proxy (:5173 → :3001)
       │
       ▼
Express Router → analyticsService.getKPISummary()
       │
       ├── Query 1: Current period events (visitors, pageviews)
       ├── Query 2: Current period sessions (count, avg duration, bounces)
       ├── Query 3: Previous period events (for trend comparison)
       ├── Query 4: Previous period sessions (for trend comparison)
       │   (All 4 run in parallel via Promise.all)
       │
       ▼
Compute & return:
{
  totalVisitors: 15,
  totalPageviews: 42,
  bounceRate: 33.3,
  avgSessionDuration: "1m 24s",
  visitorsTrend: +12.5,     ← % change vs prev period
  pageviewsTrend: +8.2,
  bounceRateTrend: -3.1,
  sessionTrend: +5.0
}
       │
       ▼
useAnalytics hook → setData(result.data) → React re-render
       │
       ▼
MetricCard components render with sparklines + trend arrows
```

---

## 4. Database Schema

### 4.1 Entity Relationship Diagram

```
┌──────────────────────────────────┐
│             sites                │
├──────────────────────────────────┤
│ id          VARCHAR(64)  PK      │
│ name        VARCHAR(255)         │
│ domain      VARCHAR(255)         │
│ created_at  TIMESTAMPTZ          │
└──────────────┬───────────────────┘
               │ 1
               │
               │ ∞
┌──────────────▼───────────────────┐        ┌────────────────────────────────┐
│             events               │        │           sessions              │
├──────────────────────────────────┤        ├────────────────────────────────┤
│ id          SERIAL       PK      │        │ id          VARCHAR(64)  PK    │
│ site_id     VARCHAR(64)  FK      │        │ site_id     VARCHAR(64)  FK    │
│ user_id     VARCHAR(64)          │        │ user_id     VARCHAR(64)        │
│ session_id  VARCHAR(64)          │◄──────▶│ started_at  TIMESTAMPTZ        │
│ type        VARCHAR(50)          │        │ ended_at    TIMESTAMPTZ        │
│ url         VARCHAR(2048)        │        │ duration    INTEGER  (seconds)  │
│ path        VARCHAR(512)         │        │ pageviews   INTEGER             │
│ referrer    VARCHAR(2048)        │        │ entry_page  VARCHAR(512)        │
│ device      VARCHAR(50)          │        │ exit_page   VARCHAR(512)        │
│ browser     VARCHAR(255)         │        │ referrer    VARCHAR(2048)       │
│ os          VARCHAR(100)         │        │ device      VARCHAR(50)         │
│ country     VARCHAR(100)         │        │ browser     VARCHAR(255)        │
│ city        VARCHAR(255)         │        │ os          VARCHAR(100)        │
│ timestamp   TIMESTAMPTZ          │        │ country     VARCHAR(100)        │
│ properties  JSONB                │        │ is_bounce   BOOLEAN             │
└──────────────────────────────────┘        └────────────────────────────────┘

┌──────────────────────────────────┐        ┌────────────────────────────────┐
│          daily_stats             │        │           funnels               │
├──────────────────────────────────┤        ├────────────────────────────────┤
│ id          SERIAL       PK      │        │ id          SERIAL       PK    │
│ site_id     VARCHAR(64)  FK      │        │ site_id     VARCHAR(64)  FK    │
│ date        DATE                 │        │ name        VARCHAR(255)       │
│ visitors    INTEGER              │        │ steps       JSONB              │
│ pageviews   INTEGER              │        │ created_at  TIMESTAMPTZ        │
│ sessions    INTEGER              │        └────────────────────────────────┘
│ avg_duration FLOAT               │
│ bounce_rate FLOAT                │
│ created_at  TIMESTAMPTZ          │
└──────────────────────────────────┘
  UNIQUE: idx_daily_stats_site_date (site_id, date)

Indexes:
  events:      idx_events_site_timestamp (site_id, timestamp)
               idx_events_session (session_id)
               idx_events_type (type)
  sessions:    idx_sessions_site (site_id, started_at)
  daily_stats: idx_daily_stats_site_date (site_id, date) UNIQUE
```

### 4.2 Event Types Whitelist

```
pageview | click | impression | add_to_cart | checkout | purchase |
signup | custom | form_submit | lead | scroll_depth | time_on_page |
button_click | signup_start | video_play
```

---

## 5. Tracking Script Logic

### 5.1 Identity Management

```
┌─────────────────────────────────────────────────────────────┐
│                    IDENTITY RESOLUTION                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User ID (persistent across sessions):                       │
│  ┌───────────────────────────────────────┐                   │
│  │ localStorage.getItem('analytics_user_id')                 │
│  │   └── If null → generate: u_ + random + timestamp        │
│  │   └── Store in localStorage (survives browser close)      │
│  └───────────────────────────────────────┘                   │
│                                                              │
│  Session ID (per browser tab session):                       │
│  ┌───────────────────────────────────────┐                   │
│  │ sessionStorage.getItem('analytics_session_id')            │
│  │   └── If null → generate: s_ + random + timestamp        │
│  │   └── Store in sessionStorage (dies on tab close)         │
│  │   └── Also stores: session_start time, pageview count     │
│  └───────────────────────────────────────┘                   │
│                                                              │
│  Double-init guard:                                          │
│  ┌───────────────────────────────────────┐                   │
│  │ if (window.__analyticsInitialized) return;                │
│  │ window.__analyticsInitialized = true;                     │
│  │   └── Prevents duplicate events when script loads twice   │
│  └───────────────────────────────────────┘                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Country Detection (Timezone-based)

```javascript
// Example: User in India
Intl.DateTimeFormat().resolvedOptions().timeZone
// → "Asia/Kolkata"

// Lookup table maps timezone → country:
{
  'Asia/Kolkata': 'India',
  'America/New_York': 'United States',
  'Europe/London': 'United Kingdom',
  'Asia/Tokyo': 'Japan',
  // ... 30+ mappings
}
// → Returns "India"
```

### 5.3 Event Lifecycle Per Page

```
PAGE LOAD                           PAGE UNLOAD
   │                                    │
   ▼                                    ▼
1. trackPageview()                  6. handleUnload()
   ├── Increment PV counter            ├── Track scroll_depth event
   ├── Save entry page (if first)      ├── Track time_on_page event
   ├── POST /track/event (pageview)    └── updateSession() with
   └── startSession() (if new)             final duration
                                        │
2. Register event listeners:            ▼
   ├── click → handleClick()        7. visibilitychange handler
   ├── scroll → handleScroll()         └── Fires handleUnload()
   ├── visibilitychange                    when tab goes hidden
   ├── beforeunload
   └── form submit

3. Scroll tracking (passive):
   └── Continuously tracks max
       scroll percentage reached

4. Click tracking:
   ├── <a> links → track href + text
   └── [data-track] elements → track custom event

5. Form tracking:
   └── form submit → track form_submit with id/name
```

---

## 6. Backend API Logic & Examples

### 6.1 KPI Summary with Trend Comparison

**Endpoint:** `GET /api/analytics/:siteId/kpi?dateRange=30d`

**Logic:**
```
Input: dateRange = "30d"

Step 1: Calculate date ranges
  current:  Feb 3 → Mar 4  (30 days)
  previous: Jan 4 → Feb 3  (preceding 30 days)

Step 2: Run 4 parallel queries (Promise.all)
  ┌────────────────────────┬────────────────────────┐
  │  Current Period         │  Previous Period        │
  ├────────────────────────┼────────────────────────┤
  │  Q1: COUNT(DISTINCT     │  Q3: Same query but    │
  │      user_id) → visitors│      WHERE timestamp   │
  │      COUNT(*) FILTER    │      >= prevStart AND   │
  │      (WHERE type =      │      < prevEnd          │
  │      'pageview')        │                         │
  │      → pageviews        │                         │
  ├────────────────────────┼────────────────────────┤
  │  Q2: COUNT(*)           │  Q4: Same query but    │
  │      → totalSessions    │      WHERE started_at  │
  │      AVG(duration)      │      >= prevStart AND   │
  │      → avgDuration      │      < prevEnd          │
  │      COUNT(*) FILTER    │                         │
  │      (is_bounce = TRUE) │                         │
  │      → bounces          │                         │
  └────────────────────────┴────────────────────────┘

Step 3: Calculate trends
  visitorsTrend = ((current - previous) / previous) × 100
  
  Example: 150 visitors now vs 120 before → +25.0%
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "totalVisitors": 15,
    "totalPageviews": 42,
    "totalSessions": 8,
    "bounceRate": 33.3,
    "avgSessionDuration": "1m 24s",
    "pagesPerSession": "5.25",
    "visitorsTrend": 12.5,
    "pageviewsTrend": 8.2,
    "bounceRateTrend": -3.1,
    "sessionTrend": 5.0
  }
}
```

---

### 6.2 Traffic Over Time

**Endpoint:** `GET /api/analytics/:siteId/traffic?dateRange=30d`

**SQL Logic:**
```sql
SELECT
  DATE(timestamp) as date,
  COUNT(DISTINCT user_id) as visitors,
  COUNT(DISTINCT session_id) as sessions,
  COUNT(*) FILTER (WHERE type = 'pageview') as pageviews
FROM events
WHERE site_id = $1
  AND timestamp >= $2 AND timestamp <= $3
GROUP BY DATE(timestamp)
ORDER BY date ASC
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    { "date": "2026-03-03", "visitors": 5, "sessions": 6, "pageviews": 18 },
    { "date": "2026-03-04", "visitors": 3, "sessions": 4, "pageviews": 12 }
  ]
}
```

**Used by:** TrafficChart (Area chart) + Dashboard sparklines

---

### 6.3 Real-Time Visitors

**Endpoint:** `GET /api/analytics/:siteId/realtime`

**Logic:**
```
Time window = NOW() - 5 minutes

4 parallel queries:
  Q1: COUNT(DISTINCT user_id) → activeVisitors
  Q2: GROUP BY path → topPages (top 10)
  Q3: GROUP BY device → devices breakdown
  Q4: GROUP BY country → countries (top 10)
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "activeVisitors": 3,
    "topPages": [
      { "path": "/", "visitors": 2 },
      { "path": "/products", "visitors": 1 }
    ],
    "devices": { "Desktop": 2, "Mobile": 1 },
    "countries": [
      { "country": "India", "visitors": 2 },
      { "country": "United States", "visitors": 1 }
    ]
  }
}
```

---

### 6.4 Conversion Funnel

**Endpoint:** `GET /api/analytics/:siteId/funnel?dateRange=30d`

**SQL Logic:**
```sql
-- Counts distinct users per funnel stage
SELECT
  COUNT(DISTINCT user_id) FILTER (WHERE type = 'pageview')    as visitors,
  COUNT(DISTINCT user_id) FILTER (WHERE type = 'add_to_cart') as add_to_cart,
  COUNT(DISTINCT user_id) FILTER (WHERE type = 'checkout')    as checkout,
  COUNT(DISTINCT user_id) FILTER (WHERE type = 'purchase')    as purchase
FROM events
WHERE site_id = $1 AND timestamp >= $2
```

**Flow Visualization:**
```
  Visitors     ████████████████████████  100% (500)
  Add to Cart  ██████████████           55%  (275)
  Checkout     █████████                36%  (180)
  Purchase     ██████                   24%  (120)
```

---

### 6.5 Session Duration Distribution

**Endpoint:** `GET /api/analytics/:siteId/sessions?dateRange=30d`

**SQL Logic:**
```sql
SELECT
  CASE
    WHEN duration < 10   THEN '0-10s'
    WHEN duration < 30   THEN '10-30s'
    WHEN duration < 60   THEN '30-60s'
    WHEN duration < 180  THEN '1-3m'
    WHEN duration < 600  THEN '3-10m'
    WHEN duration < 1800 THEN '10-30m'
    ELSE '30m+'
  END as bucket,
  COUNT(*) as sessions
FROM sessions
WHERE site_id = $1 AND started_at >= $2
GROUP BY bucket
ORDER BY MIN(duration)
```

---

### 6.6 All Endpoints Summary

| # | Endpoint | Method | Query Key | Chart Component |
|---|----------|--------|-----------|-----------------|
| 1 | `/traffic` | GET | `getTraffic` | TrafficChart (Area) |
| 2 | `/pageviews` | GET | `getPageviews` | PageviewsChart (Bar) |
| 3 | `/top-pages` | GET | `getTopPages` | TopPagesChart (Horizontal Bar) |
| 4 | `/sources` | GET | `getSources` | SourcesChart (Donut) |
| 5 | `/devices` | GET | `getDevices` | DevicesChart (Donut + Legend) |
| 6 | `/countries` | GET | `getCountries` | CountriesTable (Table + Flags) |
| 7 | `/sessions` | GET | `getSessions` | SessionsChart (Bar) |
| 8 | `/funnel` | GET | `getFunnel` | FunnelChart (Custom) |
| 9 | `/kpi` | GET | `getKPIs` | 4× MetricCard (Numbers) |
| 10 | `/realtime` | GET | `getRealtime` | Realtime page (Polls 10s) |
| 11 | `/comparison` | GET | `getComparison` | TrafficChart (comparison overlay) |
| 12 | `/user-flow` | GET | `getUserFlow` | UserFlowChart (transitions) |
| 13 | `/alerts` | GET | `getAlerts` | AlertsPanel (anomaly cards) |
| 14 | `/utm-campaigns` | GET | `getUTMCampaigns` | SourcesChart (UTM tab) |

---

### 6.7 Comparison Mode

**Endpoint:** `GET /api/analytics/:siteId/comparison?dateRange=30d`

**Logic:**
```
Input: dateRange = "30d"

Step 1: Calculate two equal periods
  current:  Feb 3 → Mar 4  (30 days)
  previous: Jan 4 → Feb 3  (preceding 30 days)

Step 2: Run 2 parallel queries (same traffic-over-time query)
  ┌────────────────────────┬────────────────────────┐
  │  Current Period         │  Previous Period        │
  │  GROUP BY date          │  GROUP BY date          │
  │  → visitors, sessions,  │  → visitors, sessions,  │
  │    pageviews per day     │    pageviews per day     │
  └────────────────────────┴────────────────────────┘

Step 3: Merge into aligned array
  Each entry: { date, visitors, sessions, pageviews,
                prev_visitors, prev_sessions, prev_pageviews }
```

**Used by:** TrafficChart renders dashed overlay lines for previous period data when Compare toggle is active.

---

### 6.8 User Flow / Path Analysis

**Endpoint:** `GET /api/analytics/:siteId/user-flow?dateRange=30d&limit=10`

**Logic:**
```
3 parallel queries:
  Q1: Page transitions (self-join on events by session_id)
      → Groups consecutive pageviews into from_page → to_page pairs
      → COUNT(*) as transition count, ordered by count DESC

  Q2: Entry pages (first pageview per session)
      → Uses MIN(timestamp) per session_id to find entry

  Q3: Exit pages (last pageview per session)
      → Uses MAX(timestamp) per session_id to find exit
```

**Example Response:**
```json
{
  "transitions": [
    { "from_page": "/", "to_page": "/products", "count": 45 },
    { "from_page": "/products", "to_page": "/pricing", "count": 28 }
  ],
  "entryPages": [
    { "page": "/", "count": 120 },
    { "page": "/products", "count": 35 }
  ],
  "exitPages": [
    { "page": "/pricing", "count": 50 },
    { "page": "/contact", "count": 30 }
  ]
}
```

---

### 6.9 Alerts / Anomaly Detection

**Endpoint:** `GET /api/analytics/:siteId/alerts?dateRange=30d`

**Logic:**
```
Step 1: Get daily visitor counts for the period
Step 2: Calculate mean and standard deviation
Step 3: Flag days where visitors deviate > 1.5× std dev
Step 4: Classify as "spike" (above) or "drop" (below)
Step 5: Calculate severity (high >2×, medium >1.5×)
```

**Example Response:**
```json
{
  "data": [
    {
      "type": "spike",
      "date": "2026-03-01",
      "metric": "visitors",
      "value": 250,
      "expected": 100,
      "change": 150,
      "severity": "high"
    }
  ]
}
```

---

### 6.10 Data Aggregation

**Script:** `npm run aggregate` (runs `src/scripts/aggregate.js`)

**Logic:**
```
Step 1: Query raw events + sessions grouped by (site_id, date)
Step 2: Calculate daily rollups:
  - visitors (COUNT DISTINCT user_id)
  - pageviews (COUNT WHERE type='pageview')
  - sessions (COUNT from sessions table)
  - avg_duration (AVG(duration))
  - bounce_rate (COUNT(is_bounce=true) / total)
Step 3: UPSERT into daily_stats table (ON CONFLICT update)
```

Intended to run as a cron job for pre-computing metrics instead of querying raw events.

---

## 7. Frontend Architecture

### 7.1 File Structure

```
apps/dashboard-web/
├── index.html                  ← Entry point (loads Inter font, #root div)
├── vite.config.js              ← Proxy /api → localhost:3001
├── tailwind.config.js          ← Custom design tokens
├── src/
│   ├── main.jsx                ← React 18 createRoot + StrictMode
│   ├── App.jsx                 ← Router + lazy-loaded pages + theme
│   ├── index.css               ← Tailwind directives + custom components
│   │
│   ├── services/
│   │   └── api.js              ← Axios instance + analyticsAPI + sitesAPI
│   │
│   ├── hooks/
│   │   └── useAnalytics.js     ← Data fetching hook + useRealtime
│   │
│   ├── store/
│   │   ├── useThemeStore.js    ← Dark/light mode (localStorage)
│   │   ├── useSiteStore.js     ← Active site ID + multi-site list
│   │   └── useDateFilterStore.js ← Date range + compare mode state
│   │
│   ├── utils/
│   │   ├── formatters.js       ← formatNumber, formatDuration, etc.
│   │   └── exportUtils.js      ← CSV/PNG export helpers
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx       ← Main page: 4 KPI cards + 8 charts
│   │   ├── PagesView.jsx       ← Detailed page analytics
│   │   ├── Funnels.jsx         ← Conversion funnel analysis
│   │   ├── Realtime.jsx        ← Live visitors + visitor map
│   │   ├── UserFlow.jsx        ← Page transition analysis
│   │   └── Settings.jsx        ← Site config + alerts + multi-site
│   │
│   └── components/
│       ├── layout/
│       │   ├── DashboardLayout.jsx  ← Sidebar + Navbar + content
│       │   ├── Sidebar.jsx          ← Navigation (collapsible)
│       │   └── Navbar.jsx           ← Date filter + theme toggle
│       │
│       ├── ui/
│       │   ├── MetricCard.jsx       ← KPI card with sparkline + trend
│       │   ├── ChartCard.jsx        ← Wrapper with loading/error/export
│       │   ├── DateFilter.jsx       ← 24h/7d/30d/90d + compare toggle
│       │   ├── ThemeToggle.jsx      ← Dark/light switch
│       │   ├── DataTable.jsx        ← Sortable table
│       │   ├── LoadingSkeleton.jsx  ← Shimmer placeholders
│       │   ├── EmptyState.jsx       ← No data illustration
│       │   ├── ErrorBoundary.jsx    ← React error boundary wrapper
│       │   └── SiteManager.jsx      ← Multi-site CRUD management
│       │
│       └── charts/
│           ├── TrafficChart.jsx     ← Recharts AreaChart + comparison
│           ├── PageviewsChart.jsx   ← Recharts BarChart
│           ├── TopPagesChart.jsx    ← Custom horizontal bars
│           ├── SourcesChart.jsx     ← Recharts PieChart (donut)
│           ├── DevicesChart.jsx     ← Recharts PieChart + legend
│           ├── CountriesTable.jsx   ← Table with flag emojis
│           ├── FunnelChart.jsx      ← Custom funnel visualization
│           ├── SessionsChart.jsx    ← Recharts BarChart
│           ├── UserFlowChart.jsx    ← Page transitions + entry/exit
│           ├── VisitorMap.jsx       ← SVG world map with live dots
│           └── AlertsPanel.jsx      ← Traffic anomaly alerts
```

### 7.2 Routing

```
BrowserRouter
  └── DashboardLayout (always rendered)
        ├── /           → Dashboard     (lazy loaded)
        ├── /pages      → PagesView     (lazy loaded)
        ├── /funnels    → Funnels       (lazy loaded)
        ├── /realtime   → Realtime      (lazy loaded)
        ├── /user-flow  → UserFlow      (lazy loaded)
        ├── /settings   → Settings      (lazy loaded)
        └── *           → Redirect to /
```

---

## 8. Component Hierarchy

### 8.1 Dashboard Page Component Tree

```
<Dashboard>
  ├── <MetricCard title="Total Visitors">
  │     ├── Icon (Users)
  │     ├── Value: "3.0K"
  │     ├── Trend arrow: "↗ 12.5%"
  │     └── <Sparkline data={trafficData.visitors} />
  │
  ├── <MetricCard title="Pageviews">
  │     └── (same structure, uses pageviews sparkline)
  │
  ├── <MetricCard title="Bounce Rate">
  │     └── (no sparkline, just value + trend)
  │
  ├── <MetricCard title="Avg. Session">
  │     └── (no sparkline, just value + trend)
  │
  ├── <TrafficChart>
  │     └── <ChartCard>
  │           └── <Recharts.AreaChart>
  │                 ├── Area dataKey="visitors"
  │                 └── Area dataKey="sessions"
  │
  ├── <PageviewsChart>
  │     └── <ChartCard>
  │           └── <Recharts.BarChart>
  │
  ├── <TopPagesChart>
  │     └── <ChartCard>
  │           └── Custom horizontal bar divs
  │
  ├── <SourcesChart>
  │     └── <ChartCard>
  │           └── <Recharts.PieChart> (donut)
  │
  ├── <DevicesChart>
  │     └── <ChartCard>
  │           └── <Recharts.PieChart> + legend
  │
  ├── <SessionsChart>
  │     └── <ChartCard>
  │           └── <Recharts.BarChart>
  │
  ├── <CountriesTable>
  │     └── <ChartCard>
  │           └── Table with flag + country + visitors + bar
  │
  └── <FunnelChart>
        └── <ChartCard>
              └── Custom funnel bars with conversion %
```

---

## 9. State Management

### 9.1 Zustand Stores

```
┌────────────────────────────────────────────────────────────┐
│                    STATE ARCHITECTURE                       │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  useThemeStore (persisted in localStorage)                   │
│  ┌────────────────────────────────────────┐                 │
│  │  theme: 'dark' | 'light'               │                 │
│  │  toggleTheme()                          │                 │
│  │                                         │                 │
│  │  Effect: Adds/removes 'dark' class      │                 │
│  │          on document.documentElement     │                 │
│  └────────────────────────────────────────┘                 │
│                                                             │
│  useSiteStore (persisted in localStorage)                    │
│  ┌────────────────────────────────────────┐                 │
│  │  siteId: 'site_123'                    │                 │
│  │  sites: []                              │                 │
│  │  setSiteId(id)                          │                 │
│  │  setSites(sites)                        │                 │
│  └────────────────────────────────────────┘                 │
│                                                             │
│  useDateFilterStore                                         │
│  ┌────────────────────────────────────────┐                 │
│  │  dateRange: '30d'                       │                 │
│  │  setDateRange(range)                    │                 │
│  │  compareMode: false                     │                 │
│  │  toggleCompareMode()                    │                 │
│  │                                         │                 │
│  │  Options: '24h' | '7d' | '30d' | '90d' │                 │
│  │  Custom: 'custom:YYYY-MM-DD:YYYY-MM-DD'│                 │
│  └────────────────────────────────────────┘                 │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 9.2 useAnalytics Hook Flow

```
useAnalytics(endpoint, options)
       │
       ├── Read siteId from useSiteStore
       ├── Read dateRange from useDateFilterStore
       │
       ├── useEffect triggers on [endpoint, siteId, dateRange]
       │     │
       │     ├── Create AbortController (cancel on unmount)
       │     ├── Set loading = true
       │     ├── Call analyticsAPI[endpoint](siteId, { dateRange })
       │     │     │
       │     │     └── Axios GET → Vite proxy → Express → PostgreSQL
       │     │
       │     ├── On success: setData(result.data ?? result)
       │     └── On error: setError(err.message)
       │
       └── Returns { data, loading, error, refetch }

useRealtime()
       │
       └── Same as useAnalytics('getRealtime') but with
           setInterval(refetch, 10000)  ← polls every 10 seconds
```

---

## 10. Deployment Topology

### 10.1 Current (Development)

```
macOS localhost
  ├── Docker Desktop
  │     └── Container: analytics-pg
  │           └── PostgreSQL 15
  │               └── DB: analytics_db
  │
  ├── Node.js process (port 3001)
  │     └── Express backend
  │           └── Connects to PostgreSQL
  │
  ├── Node.js process (port 5173)
  │     └── Vite dev server
  │           ├── Serves React app (HMR)
  │           └── Proxy: /api → localhost:3001
  │
  └── Browser (or demo-website via any HTTP server)
        └── analytics.js → POST to localhost:3001
```

### 10.2 Production (Target)

```
┌─────────────────────────────────────────────────┐
│  CDN (Cloudflare / Vercel Edge)                  │
│  └── Static React build (npm run build)          │
│       └── dist/ folder (~500KB gzipped)          │
├─────────────────────────────────────────────────┤
│  App Server (VPS / Container)                    │
│  └── Express API (port 3001)                     │
│       ├── PostgreSQL writes (tracking, auth)     │
│       ├── DuckDB reads (analytics queries)       │
│       ├── Rate limiting (100 req/min)            │
│       ├── CORS whitelist                         │
│       └── Cron: sync PG → DuckDB every 5 min    │
├─────────────────────────────────────────────────┤
│  Database Server                                 │
│  └── PostgreSQL 16                               │
│       ├── events table (7 indexes)               │
│       ├── sessions table (3 indexes)             │
│       └── Daily vacuum + WAL archiving           │
├─────────────────────────────────────────────────┤
│  DuckDB (co-located with app server)             │
│  └── analytics.duckdb (columnar OLAP)            │
│       ├── Synced replica of PG data              │
│       └── 21 analytical query functions          │
├─────────────────────────────────────────────────┤
│  Target Website                                  │
│  └── <script src="https://your-domain/a.js">    │
│       └── Sends events to your API server        │
└─────────────────────────────────────────────────┘
```

---

## 11. DuckDB Analytics Engine

### 11.1 Why Dual-Database?

| Concern | PostgreSQL | DuckDB |
|---------|-----------|--------|
| Event writes | Optimized (row-store, ACID) | Not used for writes |
| Analytical reads | Slow at scale (row-store) | 10-100x faster (column-store) |
| Deployment | Docker container | Embedded in Node.js process |
| Network overhead | TCP connection | Zero (in-process) |

### 11.2 Column-Store Advantage

```
Query: SELECT COUNT(DISTINCT user_id) FROM events WHERE site_id = ?

PostgreSQL (row-oriented):
  Must read ALL 14 columns per row × 100K rows = ~1.4M values

DuckDB (column-oriented):
  Only reads 2 columns × 100K rows = ~200K values (7x less I/O)
```

### 11.3 Query Functions (21 Total)

16 endpoint-matched functions + 5 bonus DuckDB-only functions.

See [docs/duckdb-guide.md](docs/duckdb-guide.md) for the full query catalog.

---

## 12. Data Sync Mechanism

### 12.1 Incremental High-Water-Mark Sync

```
For each table:
  1. Read last_synced from _sync_meta in DuckDB
  2. SELECT * FROM pg_table WHERE timestamp > last_synced ORDER BY timestamp
  3. Batch INSERT into DuckDB (5000 rows per batch)
  4. Update _sync_meta with new high-water mark
```

### 12.2 Sync Schedule

| Environment | Schedule | Command |
|-------------|----------|---------|
| Development | Manual | `npm run sync` |
| Production | Cron | `*/5 * * * * cd /path/to/apps/analytics-api && npm run sync` |

See [docs/duckdb-guide.md](docs/duckdb-guide.md) for detailed sync documentation.

---

## Appendix: Quick Reference Commands

```bash
# Start PostgreSQL (Docker)
docker start analytics-pg

# Setup backend from scratch
cd apps/analytics-api
npm run migrate          # Create PG tables
npm run seed             # Generate sample data
npm run init             # Create DuckDB tables
npm run sync             # Sync PG → DuckDB

# Start backend (port 3001)
cd apps/analytics-api && npm start

# Start frontend (port 5173)
cd apps/dashboard-web && npm run dev

# Check health
curl http://localhost:3001/api/health

# Test KPI endpoint
curl 'http://localhost:3001/api/analytics/site_demo/kpi?dateRange=30d'

# List sites
curl 'http://localhost:3001/api/sites'

# Check DB row counts
docker exec analytics-pg psql -U analytics -d analytics_db \
  -c "SELECT 'events' as tbl, COUNT(*) FROM events UNION ALL
      SELECT 'sessions', COUNT(*) FROM sessions;"

# Re-sync DuckDB (stop server first)
lsof -ti :3001 | xargs kill -9
cd apps/analytics-api && npm run sync && npm start

# Reset everything
docker rm -f analytics-pg
docker run -d --name analytics-pg -e POSTGRES_USER=analytics \
  -e POSTGRES_PASSWORD=analytics123 -e POSTGRES_DB=analytics_db \
  -p 5432:5432 postgres:16-alpine
cd apps/analytics-api && rm -f duckdb/analytics.duckdb
npm run migrate && npm run seed && npm run init && npm run sync && npm start
```
