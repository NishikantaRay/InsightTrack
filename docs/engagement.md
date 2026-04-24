# Engagement Tracking

InsightTrack captures four engagement metrics automatically through the tracking script. No extra setup is needed — the default tracking script handles everything.

## Features

### 1. Scroll Depth Tracking

Measures how far users scroll on each page, with milestone events at **25%, 50%, 75%, and 100%**.

**How it works:**
- The script listens for `scroll` events (passive, no performance impact)
- Milestones fire once per page load — e.g., reaching 75% scroll sends exactly one `scroll_depth` event
- On page unload, a final `scroll_depth` event records the maximum scroll percentage

**Event type:** `scroll_depth`

**Properties:**
| Field | Type | Description |
|-------|------|-------------|
| `depth` | number | Scroll percentage (0–100) |
| `milestone` | boolean | `true` if this is a 25/50/75/100% milestone event |

**API endpoint:**
```
GET /api/analytics/:siteId/engagement/scroll-depth?dateRange=30d
```

**Response:**
```json
[
  {
    "path": "/blog/getting-started",
    "reached25": 142,
    "reached50": 118,
    "reached75": 87,
    "reached100": 43,
    "totalEvents": 142,
    "avgDepth": 68.3
  }
]
```

---

### 2. Click Heatmaps

Records the x/y coordinates and CSS selector of every click on the page.

**How it works:**
- Every `click` event captures page coordinates (`pageX`/`pageY`), viewport dimensions, and document height
- Relative coordinates (`relX`, `relY`) are normalized 0–1.0 for responsive analysis
- A CSS selector is generated for the clicked element (id, tag, class, nth-child)

**Event type:** `heatmap_click`

**Properties:**
| Field | Type | Description |
|-------|------|-------------|
| `x` | number | Absolute X coordinate (pixels from left) |
| `y` | number | Absolute Y coordinate (pixels from top of document) |
| `relX` | number | Relative X (0–1.0, fraction of viewport width) |
| `relY` | number | Relative Y (0–1.0, fraction of document height) |
| `vpW` | number | Viewport width (px) |
| `vpH` | number | Viewport height (px) |
| `docH` | number | Full document height (px) |
| `selector` | string | CSS selector of clicked element |

**API endpoints:**
```
# Per-page heatmap data (up to 500 click points)
GET /api/analytics/:siteId/engagement/heatmap?dateRange=30d&path=/pricing

# Summary of top clicked elements across all pages
GET /api/analytics/:siteId/engagement/heatmap-summary?dateRange=30d
```

---

### 3. Rage Click Detection

Detects repeated rapid clicks on the same element, indicating user frustration (e.g., broken buttons, non-responsive UI).

**How it works:**
- Tracks click timestamps per target element
- If **3 or more clicks** hit the same element within **1 second**, a `rage_click` event fires
- After reporting, the click buffer resets to avoid duplicate alerts
- Changing the click target resets the counter

**Event type:** `rage_click`

**Properties:**
| Field | Type | Description |
|-------|------|-------------|
| `selector` | string | CSS selector of the rage-clicked element |
| `count` | number | Number of rapid clicks detected |
| `x` | number | X coordinate of the last click |
| `y` | number | Y coordinate of the last click |

**API endpoint:**
```
GET /api/analytics/:siteId/engagement/rage-clicks?dateRange=30d
```

**Response:**
```json
[
  {
    "path": "/checkout",
    "selector": "button.submit-btn",
    "incidents": 12,
    "totalClicks": 47,
    "firstSeen": "2026-03-15T10:23:00Z",
    "lastSeen": "2026-03-31T14:05:00Z"
  }
]
```

---

### 4. Time on Page

Measures the actual read time (in seconds) for each page, not just session duration.

**How it works:**
- Records `pageEntryTime` when the page loads
- On `beforeunload` or `visibilitychange` (hidden), sends a `time_on_page` event with `seconds = (now - pageEntryTime) / 1000`
- Values < 0 or ≥ 3600s are filtered out of analytics to remove outliers

**Event type:** `time_on_page`

**Properties:**
| Field | Type | Description |
|-------|------|-------------|
| `seconds` | number | Time spent on the page in seconds |

**API endpoint:**
```
GET /api/analytics/:siteId/engagement/time-on-page?dateRange=30d
```

**Response:**
```json
[
  {
    "path": "/blog/getting-started",
    "avgTime": 145.3,
    "medianTime": 120.0,
    "minTime": 5,
    "maxTime": 890,
    "samples": 234
  }
]
```

---

## Engagement Summary

Get all four KPIs in a single call:

```
GET /api/analytics/:siteId/engagement/summary?dateRange=30d
```

**Response:**
```json
{
  "avgScrollDepth": 62.4,
  "avgTimeOnPage": 87.2,
  "totalRageClicks": 15,
  "totalClicks": 12450
}
```

---

## Dashboard

The **Engagement** page in the dashboard (sidebar → Engagement) shows:

1. **KPI cards** — Avg scroll depth, avg time on page, total clicks tracked, rage click incidents
2. **Tabbed detail views:**
   - **Scroll Depth** — Table of pages with milestone columns (25/50/75/100%) and avg depth bar
   - **Click Heatmap** — Top clicked elements by page and selector
   - **Rage Clicks** — Frustration incidents with element, count, and date range
   - **Time on Page** — Per-page avg, median, min, max read times

## Data Flow

```
Browser (analytics.js)
  ↓ POST /api/track/event
PostgreSQL (events table, properties JSONB)
  ↓ PG→DuckDB sync
DuckDB (OLAP queries)
  ↓ GET /api/analytics/:siteId/engagement/*
Dashboard (React)
```

The **apps/analytics-api** service serves the engagement endpoints, writing raw events to PostgreSQL and reading engagement analytics from DuckDB via the unified backend.
