# Custom Dashboard Implementation Guide

> Step-by-step implementation reference for building the Custom Dashboards feature
> inside InsightTrack's Reporting page. Covers data model, backend API, frontend
> grid builder, and widget catalogue.

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Data Model](#2-data-model)
3. [Backend API](#3-backend-api)
4. [Widget Catalogue](#4-widget-catalogue)
5. [Frontend Grid Layout](#5-frontend-grid-layout)
6. [Adding a New Widget Type](#6-adding-a-new-widget-type)
7. [Persistence & Auto-Save](#7-persistence--auto-save)
8. [Sharing & Permissions](#8-sharing--permissions)
9. [Current Implementation State](#9-current-implementation-state)
10. [Roadmap](#10-roadmap)

---

## 1. Feature Overview

Custom Dashboards let users:

- Create named dashboard tabs alongside the built-in InsightTrack pages
- Drag-and-drop any widget (chart, metric card, table, text block) onto a free-form grid
- Resize widgets to span 1–12 columns
- Configure each widget's data query, date range, and display options
- Share a read-only link or export the entire dashboard as PDF/PNG

Current entry point: **Reporting page → Custom Dashboards tab** (`/reporting`).

---

## 2. Data Model

### PostgreSQL schema

```sql
-- One dashboard per row
CREATE TABLE custom_dashboards (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    name        TEXT NOT NULL,
    layout      JSONB NOT NULL DEFAULT '[]',   -- array of widget layout items
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_custom_dashboards_site ON custom_dashboards(site_id);
```

### `layout` JSONB structure

`layout` is an array of widget objects:

```jsonc
[
  {
    "id": "w_abc123",          // unique widget ID within this dashboard
    "type": "line_chart",       // widget type (see Widget Catalogue)
    "x": 0,                    // grid column (0-11)
    "y": 0,                    // grid row
    "w": 6,                    // width in columns (1-12)
    "h": 4,                    // height in rows
    "config": {
      "title": "Daily pageviews",
      "metric": "pageviews",
      "dateRange": "30d",
      "color": "#6366f1"
    }
  }
]
```

---

## 3. Backend API

All routes live under `/api/reporting/:siteId/dashboards` and require
`authenticateToken` middleware.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/reporting/:siteId/dashboards` | List all dashboards for a site |
| `POST` | `/api/reporting/:siteId/dashboards` | Create a new dashboard |
| `GET` | `/api/reporting/:siteId/dashboards/:id` | Get single dashboard (layout + config) |
| `PUT` | `/api/reporting/:siteId/dashboards/:id` | Update name or layout |
| `DELETE` | `/api/reporting/:siteId/dashboards/:id` | Delete a dashboard |

### Example: Create dashboard

**`POST /api/reporting/:siteId/dashboards`**

```json
{
  "name": "Weekly executive summary",
  "layout": []
}
```

**Response:**
```json
{
  "id": "3f7a2b1c-...",
  "site_id": "site_a1b2c3d4",
  "name": "Weekly executive summary",
  "layout": [],
  "created_at": "2026-05-25T10:00:00Z"
}
```

### Example: Save layout after drag-drop

**`PUT /api/reporting/:siteId/dashboards/:id`**

```json
{
  "layout": [
    { "id": "w_1", "type": "metric_card", "x": 0, "y": 0, "w": 3, "h": 2,
      "config": { "metric": "pageviews", "dateRange": "7d" } },
    { "id": "w_2", "type": "line_chart",  "x": 3, "y": 0, "w": 9, "h": 4,
      "config": { "metric": "traffic",   "dateRange": "30d" } }
  ]
}
```

---

## 4. Widget Catalogue

### Currently implemented (via `react-grid-layout` on Reporting page)

| Widget ID | Component | Data source |
|-----------|-----------|-------------|
| `metric_card` | KPI card with sparkline | `/analytics/:siteId/kpi` |
| `line_chart` | Traffic over time | `/analytics/:siteId/traffic` |
| `bar_chart` | Top pages | `/analytics/:siteId/top-pages` |
| `pie_chart` | Device / country breakdown | `/analytics/:siteId/devices` |
| `table` | Raw data table | SQL Editor API or any analytics endpoint |
| `text_block` | Markdown text / heading | Static |

### Planned widgets

| Widget ID | Description |
|-----------|-------------|
| `funnel_chart` | Conversion funnel visualization |
| `heatmap` | Click heatmap overlay |
| `geo_map` | Visitor world map |
| `cohort_grid` | Retention cohort table |
| `sql_table` | Custom SQL via SQL Editor API |

---

## 5. Frontend Grid Layout

The dashboard builder uses [`react-grid-layout`](https://github.com/react-grid-layout/react-grid-layout)
(already installed: see `package.json`).

### Key components

```
src/pages/Reporting.jsx          ← Dashboard list + tab navigation
src/components/reporting/
  CustomDashboard.jsx            ← Grid layout wrapper
  WidgetPicker.jsx               ← Drag-from panel of available widgets
  widgets/
    MetricCard.jsx
    LineChartWidget.jsx
    BarChartWidget.jsx
    TableWidget.jsx
    TextBlock.jsx
```

### Grid configuration

```jsx
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

<GridLayout
  className="layout"
  cols={12}
  rowHeight={60}
  width={containerWidth}
  layout={widgets.map(w => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h }))}
  onLayoutChange={(newLayout) => handleLayoutChange(newLayout)}
  draggableHandle=".widget-drag-handle"
  resizeHandles={['se']}
>
  {widgets.map(w => (
    <div key={w.id} className="widget-container">
      <WidgetRenderer widget={w} siteId={siteId} dateRange={dateRange} />
    </div>
  ))}
</GridLayout>
```

### Layout change handler

```js
function handleLayoutChange(newLayout) {
  // Merge new x/y/w/h into existing widget configs
  const updated = widgets.map(w => {
    const pos = newLayout.find(l => l.i === w.id);
    return pos ? { ...w, x: pos.x, y: pos.y, w: pos.w, h: pos.h } : w;
  });
  setWidgets(updated);
  // Debounced auto-save (500ms)
  debouncedSave(updated);
}
```

---

## 6. Adding a New Widget Type

1. **Define the type** — add a new entry to the widget catalogue constants:

```js
// src/components/reporting/widgetTypes.js
export const WIDGET_TYPES = {
  // ... existing
  GEO_MAP: {
    id: 'geo_map',
    label: 'Visitor Map',
    icon: Globe,
    defaultSize: { w: 6, h: 5 },
    defaultConfig: { dateRange: '30d' },
  },
};
```

2. **Create the widget component** in `src/components/reporting/widgets/GeoMapWidget.jsx`.
   Use the `useAnalytics` hook to fetch data:

```jsx
import { useAnalytics } from '../../../hooks/useAnalytics';

export default function GeoMapWidget({ siteId, dateRange }) {
  const { data, loading, error } = useAnalytics('countries', siteId, dateRange);
  // render map…
}
```

3. **Register in `WidgetRenderer`:**

```js
// src/components/reporting/WidgetRenderer.jsx
import GeoMapWidget from './widgets/GeoMapWidget';

const COMPONENTS = {
  geo_map: GeoMapWidget,
  // ...
};
```

4. **Add to `WidgetPicker`** so it appears in the drag panel.

5. **Update `widgetTypes.js`** constant list — WidgetPicker reads this array.

---

## 7. Persistence & Auto-Save

Layouts are saved to PostgreSQL via `PUT /api/reporting/:siteId/dashboards/:id`.

### Debounced auto-save pattern

```js
import { useMemo, useCallback } from 'react';
import { debounce } from '../utils/debounce';
import { reportingAPI } from '../services/api';

const debouncedSave = useMemo(
  () => debounce((layout) => {
    reportingAPI.updateDashboard(siteId, dashboardId, { layout })
      .catch(err => toast.error('Failed to save dashboard'));
  }, 500),
  [siteId, dashboardId]
);
```

### Optimistic updates

The UI updates immediately on drag/resize; the debounced save syncs to the server.
On load, the full layout is fetched from `GET /api/reporting/:siteId/dashboards/:id`.

---

## 8. Sharing & Permissions

### Current model

- Dashboards are private to their creator (enforced by `user_id` check in the API)
- Site admins can view all dashboards for a site (when `user_id` is null-checked)

### Planned: read-only share links

Generate a signed JWT with a 7-day TTL that encodes `dashboard_id` and `site_id`:

```js
const token = jwt.sign(
  { dashboard_id: id, site_id: siteId, type: 'share' },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);
const shareUrl = `${process.env.APP_URL}/shared/${token}`;
```

A public `/shared/:token` route verifies the token and renders the dashboard
read-only with no sidebar.

---

## 9. Current Implementation State

| Capability | Status |
|---|---|
| Dashboard CRUD API | ✅ Implemented (`/api/reporting/:siteId/dashboards`) |
| Dashboard list UI on Reporting page | ✅ Implemented |
| `react-grid-layout` drag & resize | ✅ Implemented on Reporting page |
| Widget picker panel | ✅ Basic implementation |
| MetricCard / LineChart / BarChart widgets | ✅ Implemented |
| TableWidget backed by SQL Editor API | ⬜ Planned |
| GeoMap widget | ⬜ Planned |
| Read-only share links | ⬜ Planned |
| PDF / PNG export | ⬜ Planned |
| Dashboard templates | ⬜ Planned |

---

## 10. Roadmap

1. **SQL Table widget** — embed a SQL Editor query as a widget so users can pin
   custom queries directly on their dashboard
2. **Dashboard templates** — pre-built starting layouts (E-commerce, SaaS, Blog)
3. **PDF export** — Puppeteer renders the dashboard to PDF; queued job for large layouts
4. **Share links** — signed JWT, read-only public URL, optional password protection
5. **Dashboard duplication** — clone an existing dashboard to a new site
6. **Version history** — store up to 10 snapshots of a dashboard layout so users
   can roll back accidental changes

---

## See Also

- [reporting-studio.md](reporting-studio.md) — full Reporting Studio architecture
- [sql-editor.md](sql-editor.md) — SQL Editor feature guide
- [api-reference.md](api-reference.md) — complete API reference
