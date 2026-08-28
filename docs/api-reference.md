# API Reference

InsightTrack exposes a REST API on port `3001` by default. All responses are JSON.

## Authentication

### Register

```
POST /api/auth/register
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword"
}
```

**Response** `201`:
```json
{
  "user": { "id": "uuid", "name": "Jane Doe", "email": "jane@example.com", "role": "owner" },
  "token": "eyJhbG..."
}
```

### Login

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "jane@example.com",
  "password": "securepassword"
}
```

**Response** `200`:
```json
{
  "user": { "id": "uuid", "name": "Jane Doe", "email": "jane@example.com", "role": "owner" },
  "token": "eyJhbG..."
}
```

### Get Profile

```
GET /api/auth/me
Authorization: Bearer <token>
```

### Update Profile

```
PUT /api/auth/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jane Updated"
}
```

---

## Sites

### List Sites

```
GET /api/sites
```

### Create a Site

```
POST /api/sites
Content-Type: application/json

{
  "name": "My Website",
  "domain": "example.com"
}
```

**Response** `201`:
```json
{
  "id": "site_abc123",
  "name": "My Website",
  "domain": "example.com",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

### Get Site Details

```
GET /api/sites/:siteId
```

### Get Tracking Script (raw JS)

```
GET /api/sites/:siteId/script
```

Returns raw JavaScript with `Content-Type: application/javascript`. Use directly in a `<script src="...">` tag.

### Get HTML Snippet

```
GET /api/sites/:siteId/snippet
```

Returns an HTML `<script>` tag you can paste into your page.

### Delete a Site

```
DELETE /api/sites/:siteId
```

---

## Analytics

All analytics endpoints follow the pattern:

```
GET /api/analytics/:siteId/<endpoint>?dateRange=<range>
```

> **Note**: All analytics endpoints are powered by **DuckDB** — an embedded columnar OLAP engine suited to aggregation queries compared to traditional row-store databases. Data is synced from PostgreSQL to DuckDB via incremental sync. See [duckdb-guide.md](./duckdb-guide.md) for details.

**Date range options**: `today`, `7d`, `30d`, `90d`, `custom:YYYY-MM-DD:YYYY-MM-DD`

| Endpoint | Description |
|----------|-------------|
| `/traffic` | Traffic over time (visitors + sessions per day) |
| `/pageviews` | Pageviews over time |
| `/top-pages` | Most visited pages |
| `/sources` | Traffic sources (direct, referral, search, social) |
| `/devices` | Device breakdown (desktop, mobile, tablet) |
| `/countries` | Visitors by country |
| `/sessions` | Session duration distribution |
| `/kpi` | Key metrics summary (visitors, pageviews, bounce rate, avg duration) |
| `/funnel` | Conversion funnel data |
| `/realtime` | Real-time active visitors (last 5 minutes) |
| `/comparison` | Current period vs previous period |
| `/user-flow` | Page transition flow data |
| `/alerts` | Traffic anomaly alerts |
| `/utm-campaigns` | UTM campaign breakdown |
| `/all` | All analytics data in a single response |

### Engagement Endpoints

| Endpoint | Description |
|----------|-------------|
| `/engagement/summary` | Engagement KPIs (avg scroll depth, avg time on page, rage clicks, total clicks) |
| `/engagement/scroll-depth` | Scroll depth per page with milestone breakdown (25/50/75/100%) |
| `/engagement/heatmap?path=/` | Click heatmap data for a specific page (x/y coordinates) |
| `/engagement/heatmap-summary` | Top clicked elements across all pages |
| `/engagement/rage-clicks` | Rage click incidents by page and element |
| `/engagement/time-on-page` | Per-page average, median, min, max read time |

### Content Analytics Endpoints

| Endpoint | Description |
|----------|-------------|
| `/content/entry-pages` | Top landing pages by visitor count with entry rate |
| `/content/exit-pages` | Top exit pages by exit count with exit rate |
| `/content/site-search` | Site search queries with frequency counts |

### Acquisition Endpoints

| Endpoint | Description |
|----------|-------------|
| `/acquisition/campaigns` | UTM campaign dashboard with visitors, pageviews, bounce rate, duration |
| `/acquisition/social` | Social media traffic breakdown by platform |
| `/acquisition/keywords` | Search keywords driving traffic (from UTM terms) |

### Performance Endpoints

| Endpoint | Description |
|----------|-------------|
| `/performance/web-vitals` | Per-page Web Vitals (LCP, FID, CLS, INP, TTFB) |
| `/performance/web-vitals-overview` | Site-wide Web Vitals averages |
| `/performance/errors` | JavaScript errors with message, source, count |
| `/performance/errors-over-time` | JS error trend data over time |

### Other Analytics Endpoints

| Endpoint | Description |
|----------|-------------|
| `/annotations` | Annotations for the analytics timeline |
| `/goals/conversions` | Goal conversion counts and rates |
| `/goals/conversions-over-time` | Goal conversion trends |
| `/goals/ab-test-results` | A/B test variant comparison |
| `/audience/new-vs-returning` | New vs returning visitor breakdown |
| `/audience/cohorts` | Cohort retention analysis |
| `/audience/segments` | Visitor segments by dimension |

### Example: Get KPI Data

```
GET /api/analytics/site_abc123/kpi?dateRange=30d
```

**Response**:
```json
{
  "visitors": 12450,
  "pageviews": 34200,
  "bounceRate": 42.5,
  "avgDuration": 185,
  "visitorsChange": 12.3,
  "pageviewsChange": 8.7,
  "bounceRateChange": -2.1,
  "durationChange": 5.4,
  "sparklines": { "visitors": [...], "pageviews": [...] }
}
```

---

## Tracking

### Track a Single Event

```
POST /api/track/event
Content-Type: application/json

{
  "siteId": "site_abc123",
  "userId": "u_anonymous123",
  "sessionId": "s_session456",
  "type": "pageview",
  "url": "https://example.com/about",
  "path": "/about",
  "referrer": "https://google.com",
  "props": {}
}
```

### Track a Pageview

```
POST /api/track/pageview
Content-Type: application/json

{
  "siteId": "site_abc123",
  "url": "https://example.com/pricing",
  "path": "/pricing",
  "referrer": "https://example.com/"
}
```

### Batch Track Events

```
POST /api/track/batch
Content-Type: application/json

{
  "events": [
    { "siteId": "site_abc123", "type": "pageview", "path": "/page1" },
    { "siteId": "site_abc123", "type": "click", "path": "/page1", "props": { "element": "cta" } }
  ]
}
```

### Pixel Tracking

```
GET /api/track/pixel.gif?siteId=site_abc123&url=https://example.com
```

Use in email campaigns or environments where JavaScript is unavailable.

---

## Goals

All goal endpoints require authentication.

### List Goals

```
GET /api/goals/:siteId
```

### Create a Goal

```
POST /api/goals/:siteId
Content-Type: application/json

{
  "name": "Signup Completion",
  "type": "event",
  "config": { "eventName": "signup" }
}
```

Goal types: `pageview`, `event`, `duration`, `scroll_depth`

### Update / Delete a Goal

```
PUT /api/goals/:siteId/:goalId
DELETE /api/goals/:siteId/:goalId
```

### A/B Tests

```
GET /api/goals/:siteId/ab-tests
POST /api/goals/:siteId/ab-tests
PUT /api/goals/:siteId/ab-tests/:testId
DELETE /api/goals/:siteId/ab-tests/:testId
```

---

## Reporting

All reporting endpoints require authentication.

### Annotations

```
GET /api/reporting/:siteId/annotations
POST /api/reporting/:siteId/annotations
DELETE /api/reporting/:siteId/annotations/:id
```

**Create annotation body:**
```json
{
  "title": "v2.0 Release",
  "description": "Major update deployed",
  "date": "2025-01-15",
  "category": "deployment"
}
```

Categories: `deployment`, `marketing`, `incident`, `other`

### Scheduled Reports

```
GET /api/reporting/:siteId/reports
POST /api/reporting/:siteId/reports
DELETE /api/reporting/:siteId/reports/:id
```

### Custom Dashboards

```
GET /api/reporting/:siteId/dashboards
POST /api/reporting/:siteId/dashboards
DELETE /api/reporting/:siteId/dashboards/:id
```

### Data Retention

```
GET /api/reporting/:siteId/retention
PUT /api/reporting/:siteId/retention
POST /api/reporting/:siteId/retention/cleanup
```

**Set retention policy:**
```json
{
  "retentionDays": 90
}
```

---

## New Tracking Event Types

In addition to standard events, the tracking script automatically sends these specialized event types:

### Web Vital Event

```json
{
  "type": "web_vital",
  "props": {
    "metric": "LCP",
    "value": 2.4
  }
}
```

Metrics: `LCP`, `FID`, `CLS`, `INP`, `TTFB`

### JavaScript Error Event

```json
{
  "type": "js_error",
  "props": {
    "message": "Cannot read property 'x' of undefined",
    "source": "app.js",
    "line": 42,
    "column": 15,
    "stack": "TypeError: Cannot read..."
  }
}
```

### Site Search Event

```json
{
  "type": "site_search",
  "props": {
    "query": "pricing plans"
  }
}
```

---

## Rate Limits

| Endpoint Group | Limit |
|---------------|-------|
| `/api/track/*` | 120 requests/minute |
| `/api/*` (other) | 300 requests/minute |

Rate limit headers (`RateLimit-*`) are included in all responses.
