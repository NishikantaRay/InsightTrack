# Visual Heatmap & Click Tracking — Feature Guide

> Click data overlaid on live page previews, with per-page element drill-down in the Pages view.

---

## Table of Contents

1. [Overview](#1-overview)
2. [How It Works End-to-End](#2-how-it-works-end-to-end)
3. [Visual Heatmap Page](#3-visual-heatmap-page)
4. [Event Explorer (Pages Drill-down)](#4-event-explorer-pages-drill-down)
5. [Testing Locally — Step by Step](#5-testing-locally--step-by-step)
6. [Troubleshooting — No Data](#6-troubleshooting--no-data)
7. [API Reference](#7-api-reference)
8. [Data Model](#8-data-model)
9. [Architecture Notes](#9-architecture-notes)

---

## 1. Overview

InsightTrack captures every click on tracked websites as a `heatmap_click` event. Two surfaces visualise this data:

| Surface | Where | What it shows |
|---|---|---|
| **Visual Heatmap** | `/heatmap` in sidebar | Coloured dots overlaid on a live iframe of the page |
| **Event Explorer** | `/pages` → click any row | Top clicked elements on that specific page, sortable table |

---

## 2. How It Works End-to-End

### Step 1 — Tracking script (browser)

When a visitor loads a tracked site, a tiny JS snippet from InsightTrack runs. On every click it:

1. Finds the closest meaningful element (`button`, `a`, `[data-track]`, etc.)
2. Builds a short CSS selector: `button#submit` or `a.nav-link.active`
3. Captures **relative X/Y** position as percentage of viewport (`relX`, `relY`) so dots scale across screen sizes
4. Sends a `POST /api/track/event` with `type: 'heatmap_click'`

```js
// Simplified — from sitesService.js getRawTrackingScript()
document.addEventListener('click', function(e) {
  var el = e.target.closest('button, a, [role="button"], [data-track]') || e.target;
  send('/api/track/event', {
    type: 'heatmap_click',
    properties: {
      selector: 'button.cta',
      text: 'Get Started',
      tag: 'button',
      relX: 52,   // % of viewport width
      relY: 38,   // % of viewport height
      x: 680,     // absolute px
      y: 490
    }
  });
});
```

### Step 2 — Backend stores the event

`POST /api/track/event` → `trackingService.js` → PostgreSQL `events` table.

`heatmap_click` is in the `ALLOWED_TYPES` list so it is stored with the correct type (not downgraded to `'custom'`).

### Step 3 — DuckDB sync

The PG → DuckDB sync pipeline copies new events into DuckDB for fast analytics reads.

### Step 4 — API queries DuckDB

- **Heatmap dots**: `GET /api/analytics/:siteId/engagement/heatmap?path=/about` → `getHeatmapData()` → groups by `relX`, `relY`, counts clicks
- **Element table**: `GET /api/analytics/:siteId/page-actions?path=/about` → `getPageActions()` → groups by `selector`, `text`, `tag`

### Step 5 — Frontend renders

- Dots are absolutely-positioned `<div>`s over a `position: relative` container
- Size scales 18px → 56px based on click weight
- Colour: indigo (rare) → green → yellow → orange → red (hot)

---

## 3. Visual Heatmap Page

**Route**: `/heatmap`  
**Sidebar**: Map icon, below Pages

### Controls

| Field | Description |
|---|---|
| **Site URL** | Pre-filled from your site's configured domain. Used for the iframe. |
| **Page path** | The path to show (e.g. `/about`). Pre-filled from Pages drill-down link. |
| **Apply** | Fetches data and reloads iframe. |
| **Show/Hide overlay** | Toggle dot visibility without reloading. |
| **Open page** | Opens the page in a new tab. |

### Iframe behaviour

- If the site allows embedding, the live page loads and dots appear on top.
- If the site sends `X-Frame-Options: DENY/SAMEORIGIN`, the iframe is blocked — a dark placeholder is shown but **dots are still rendered accurately** since they are positioned by the relative % coordinates, not tied to the iframe content.

### Colour scale

| Colour | Weight threshold | Meaning |
|---|---|---|
| Indigo | < 20% of max | Rarely clicked |
| Green | 20–40% | Some interest |
| Yellow | 40–60% | Moderate |
| Orange | 60–80% | Popular |
| Red | > 80% | Hottest element |

### Click Distribution table

Below the heatmap canvas, every unique element is listed:
- CSS selector + element text
- Tag (colour-coded badge: blue = `a`, indigo = `button`, orange = `input`)
- Click bar + count
- Unique users

---

## 4. Event Explorer (Pages Drill-down)

On the **Pages** page (`/pages`), click any row in the table to open the Event Explorer panel below:

- Shows the top clicked elements on that specific page
- Links to `/heatmap?path=<page>` to jump to the visual view
- Fetches from `GET /api/analytics/:siteId/page-actions?path=<page>`

---

## 5. Testing Locally — Step by Step

### Prerequisites

1. Docker stack running: `docker-compose up --build -d` from `traffic2/`
2. At least one site registered in the dashboard
3. A demo site (or your own) with the tracking snippet installed

### Quick test using the demo sites

```bash
# From traffic2/ root — start everything
docker-compose up --build -d

# Open the demo blog (it already has the tracking snippet)
open http://localhost:8082
```

1. Click around on the demo site (buttons, nav links, anything)
2. Wait ~5–10 seconds for the event to be written to PG and synced to DuckDB
3. Open the dashboard at `http://localhost:4173`
4. Go to **Heatmap** in the sidebar
5. The **Site URL** should be pre-filled with the site domain. Set **Page path** to `/` and click **Apply**
6. You should see coloured dots where you clicked

### Verify events are being written

```sql
-- Run in SQL Editor (dashboard → SQL Editor)
SELECT type, path, properties, timestamp
FROM events
WHERE type = 'heatmap_click'
ORDER BY timestamp DESC
LIMIT 20;
```

If rows appear here but no dots show on the heatmap, the DuckDB sync may be lagging — wait a few seconds and refresh.

### Verify web vitals are being collected

```sql
SELECT
  json_extract_string(properties, '$.name') AS metric,
  json_extract_string(properties, '$.rating') AS rating,
  CAST(json_extract_string(properties, '$.value') AS INTEGER) AS value_ms,
  timestamp
FROM events
WHERE type = 'web_vital'
ORDER BY timestamp DESC
LIMIT 20;
```

You should see rows for `TTFB`, `LCP`, `FID`, `CLS`, `INP` after visiting the demo site.

### Verify JS errors are captured

Open browser devtools on the demo site and run:
```js
throw new Error('test error from devtools');
```

Then check:
```sql
SELECT properties, timestamp FROM events
WHERE type = 'js_error'
ORDER BY timestamp DESC LIMIT 5;
```

---

## 6. Troubleshooting — No Data

### Heatmap shows 0 dots / 0 hotspots

| Check | How |
|---|---|
| Is the tracking script loading? | Open browser Network tab on tracked site, look for a request to `/api/sites/:id/script.js` returning 200 |
| Are `heatmap_click` events reaching the server? | Network tab → look for `POST /api/track/event` with `type: heatmap_click` returning 200 |
| Are events in PostgreSQL? | `SELECT count(*) FROM events WHERE type='heatmap_click'` via SQL Editor |
| Has DuckDB sync run? | Check `docker logs analytics-api` for sync messages, or wait 30s and retry |
| Is the page path correct? | The path must match exactly (e.g. `/` not `/index.html`) |
| Is the date range too narrow? | Change to "Last 30 days" |

### Common root cause (now fixed)

The old tracking script only captured clicks on `a` and `[data-track]` elements and sent them as `type: 'click'`. The heatmap queries filter on `type = 'heatmap_click'`. All old click events will show up as `'click'` in the database and won't appear on the heatmap. Only events generated **after** the tracking script was updated will show as `heatmap_click`.

### Performance page shows no data

Web vitals (LCP, CLS, FID, INP, TTFB) and JS errors were not collected by the old tracking script. Only page loads **after** the script was updated (and Docker rebuilt) will generate `web_vital` and `js_error` events.

---

## 7. API Reference

### GET `/api/analytics/:siteId/engagement/heatmap`

Returns click dot data for the visual overlay.

**Query params**: `path` (default `/`), `dateRange` (default `30d`)

**Response**:
```json
{
  "success": true,
  "data": [
    { "relX": 52, "relY": 38, "clicks": 47, "selector": "button.cta" }
  ]
}
```

### GET `/api/analytics/:siteId/page-actions`

Returns top-clicked elements on a specific page (Event Explorer table).

**Query params**: `path` (default `/`), `dateRange` (default `30d`)

**Response**:
```json
{
  "success": true,
  "data": [
    { "text": "Get Started", "selector": "button.cta", "tag": "button", "clicks": 47, "uniqueUsers": 23 }
  ]
}
```

---

## 8. Data Model

All click events are stored in the shared `events` table:

```sql
-- PostgreSQL (write)
INSERT INTO events (site_id, user_id, session_id, type, url, path, properties, timestamp)
VALUES ($1, $2, $3, 'heatmap_click', $4, $5, $6::jsonb, NOW());

-- properties JSON shape
{
  "selector": "button#hero-cta",
  "text": "Start free trial",
  "tag": "button",
  "relX": 52,       -- % of viewport width (0–100)
  "relY": 38,       -- % of viewport height (0–100)
  "x": 680,         -- absolute clientX px
  "y": 490,         -- absolute clientY px
  "href": "...",    -- only for <a> elements
  "trackId": "..."  -- only for [data-track] elements
}
```

Web vitals use the same `events` table with `type = 'web_vital'`:

```json
{
  "name": "LCP",
  "value": 1823,
  "rating": "good"   -- "good" | "needs-improvement" | "poor"
}
```

---

## 9. Architecture Notes

- **Tracking script** is generated server-side in `src/services/sitesService.js → getRawTrackingScript()` and served as plain JavaScript.
- **Writes** go to PostgreSQL via `trackingService.js`. `heatmap_click`, `rage_click`, `site_search`, `web_vital`, and `js_error` are all in the `ALLOWED_TYPES` allowlist.
- **Reads** query DuckDB via `src/queries/queries.js → getHeatmapData()` and `getPageActions()`.
- **Dot rendering** is pure CSS — absolutely-positioned divs with `border-radius: 50%`, `mix-blend-mode: multiply`, and a `box-shadow` glow. No SVG or canvas.
- **Relative coordinates** (`relX`/`relY` as 0–100%) make dots position-stable across different browser window sizes.
- **INP** is approximated via the `event` PerformanceObserver (max interaction latency). True INP uses the `largest-contentful-paint` observer which is Chrome 96+.
