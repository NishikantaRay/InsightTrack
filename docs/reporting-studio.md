# Reporting Studio & Dashboard Builder — System Design

> Production-grade architecture for a modern BI and reporting platform built on top of InsightTrack's PostgreSQL + DuckDB + Parquet data layer.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Export Formats](#2-export-formats)
3. [Custom Dashboard Builder](#3-custom-dashboard-builder)
4. [Dashboard Components (Widget Catalogue)](#4-dashboard-components-widget-catalogue)
5. [Reporting System](#5-reporting-system)
6. [Export Engine Architecture](#6-export-engine-architecture)
7. [Storage Architecture](#7-storage-architecture)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Backend Architecture](#9-backend-architecture)
10. [Recommended Tech Stack](#10-recommended-tech-stack)
11. [Complete System Flow](#11-complete-system-flow)
12. [Database Schema](#12-database-schema)
13. [API Design](#13-api-design)
14. [Caching Strategy](#14-caching-strategy)
15. [Scheduling & Automation](#15-scheduling--automation)
16. [Multi-Tenant Support](#16-multi-tenant-support)
17. [Real-Time Updates](#17-real-time-updates)
18. [Scalability Roadmap](#18-scalability-roadmap)
19. [Evolution into Full BI Platform](#19-evolution-into-full-bi-platform)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        REPORTING STUDIO                             │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐   │
│  │  Dashboard   │   │   Report     │   │   Export Engine      │   │
│  │  Builder     │   │   Studio     │   │   (PDF/PPT/CSV/PNG)  │   │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘   │
│         │                  │                        │               │
│  ┌──────▼──────────────────▼──────────────────────▼───────────┐   │
│  │                  API Gateway (Express / NestJS)              │   │
│  └──────┬──────────────────┬──────────────────────┬───────────┘   │
│         │                  │                        │               │
│  ┌──────▼──────┐   ┌───────▼──────┐   ┌───────────▼──────────┐   │
│  │  Dashboard  │   │  Query       │   │  Export              │   │
│  │  Service    │   │  Service     │   │  Queue (Bull/Redis)  │   │
│  └──────┬──────┘   └───────┬──────┘   └───────────┬──────────┘   │
│         │                  │                        │               │
│  ┌──────▼──────────────────▼──────────────────────▼───────────┐   │
│  │           Data Layer                                         │   │
│  │  PostgreSQL │ DuckDB (hot) │ Parquet (cold/archive)         │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Core Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Separation of concerns** | Dashboard layout (JSON) is decoupled from data queries |
| **Query federation** | DuckDB queries both internal tables and external Parquet files |
| **Async exports** | All heavy exports (PDF, PPT) are queued, never block HTTP |
| **Immutable snapshots** | Exported reports are point-in-time snapshots stored in object storage |
| **Multi-tenancy** | Every resource is scoped to `org_id` + `site_id` |

---

## 2. Export Formats

### Supported Formats

| Format | Use Case | Library | Async |
|--------|----------|---------|-------|
| **PDF** | Board reports, client-facing documents | Puppeteer (headless Chrome) | Yes |
| **CSV** | Raw data export, analyst handoff | csv-stringify | No |
| **Excel (.xlsx)** | Finance teams, pivot tables | ExcelJS | No |
| **PowerPoint (.pptx)** | Executive presentations | PptxGenJS | Yes |
| **PNG / JPEG** | Single widget screenshots, Slack embeds | Puppeteer screenshot | Yes |
| **JSON** | API consumers, data pipelines | Native | No |
| **Shareable Link** | Read-only public dashboard URL | Signed JWT / short URL | No |

### Export Format Decision Tree

```
User requests export
       │
       ├── CSV / JSON / Excel ──→ Synchronous, return file directly (< 5s)
       │
       ├── PDF / PPT / PNG ──→ Queue job → Webhook / polling → Download URL
       │
       └── Shareable Link ──→ Generate signed token → Return URL immediately
```

---

## 3. Custom Dashboard Builder

### Layout Engine — CanvasEngine

The builder uses a **custom pixel-based canvas engine** (`CanvasEngine`) — no third-party layout library. Widgets are absolutely positioned on a freeform canvas using pixel coordinates `{x, y, w, h}`. Drag and resize are handled with native Pointer Events and `requestAnimationFrame` for 60fps smoothness.

```
┌─────────────────────────────────────────────────────────────────┐
│  Dashboard Canvas (freeform pixel layout, auto-height)          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────────┐  │
│  │ KPI Card │  │ KPI Card │  │       Area Chart             │  │
│  │ 280×180px│  │ 280×180px│  │        640×300px             │  │
│  └──────────┘  └──────────┘  └──────────────────────────────┘  │
│  ┌──────────────────────┐  ┌────────────────────┐              │
│  │    Bar Chart         │  │    Pie Chart        │              │
│  │    480×300px         │  │    340×300px        │              │
│  └──────────────────────┘  └────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Widget Lifecycle

```
Add Widget
    │
    ▼
Select widget type from popover (KPI, Chart, Table, Text Note…)
    │
    ▼
Widget auto-placed via buildPixelLayout() (row-flow, no overlap)
    │
    ▼
Click widget → WidgetConfigPanel opens (right-side drawer)
  ├── Data tab: data source, date range, X/Y field mapping, KPI metric
  ├── Display tab: legend, gridlines, dots, bar orientation, donut toggle, striped rows
  └── Style tab: choose one of 8 color palettes (Default/Ocean/Warm/Mono/Forest/Candy/Fire/Purple)
    │
    ▼
Drag header to reposition; drag 8-direction resize handles to resize
    │
    ▼
Autosave after 3 s idle → layout JSON persisted to PostgreSQL
    │
    ▼
Export via ExportModal (PDF / PNG / JSON / CSV)
```

### CanvasEngine Technical Details

| Feature | Implementation |
|---------|---------------|
| **Drag** | `onPointerDown` on header → `setPointerCapture` → RAF position updates → commit on `pointerup` |
| **Resize** | 8-direction handles (`n/s/e/w/ne/nw/se/sw`), per-type min-size constraints |
| **Snap to Grid** | Optional 20px grid snap; canvas shows dot-grid background when active |
| **Canvas height** | Auto-computed from max `y + h + 40px` across all widgets |
| **Overflow guard** | `ResizeObserver` detects canvas width changes; widgets that overflow are clamped |
| **Live resize badge** | Shows `{w}×{h}px` overlay on the widget being resized |
| **60fps performance** | All pointer-move work done inside `requestAnimationFrame`; DOM updated directly without React re-render during drag |

### Dashboard Features

| Feature | Details |
|---------|---------|
| **Freeform drag** | Pixel-perfect placement anywhere on the canvas |
| **8-direction resize** | Corner and edge handles with per-type min-size constraints |
| **Snap to Grid** | 20px snap grid toggle with visual dot-grid overlay |
| **WidgetConfigPanel** | 3-tab right-side drawer for live data/display/style configuration |
| **8 color palettes** | Default, Ocean, Warm, Mono, Forest, Candy, Fire, Purple |
| **Duplicate widget** | Copy button in widget header creates an identical widget |
| **Per-widget PNG** | Camera icon in widget header captures that widget via html2canvas |
| **Autosave** | 3 s debounce write to `reportingAPI` on any widget/layout change |
| **Share link** | Base64-encoded JSON payload embedded in URL hash |
| **Focus mode** | Collapses sidebar automatically when focus mode is active |

---

## 4. Dashboard Components (Widget Catalogue)

### Widget Object Schema

Every widget is a flat JSON object stored in the dashboard's `widgets` array in PostgreSQL.

```json
{
  "id": "w_abc123",
  "type": "area_chart",
  "title": "Sessions Over Time",
  "dataSource": "traffic",
  "dateRange": "30d",
  "px": { "x": 20, "y": 20, "w": 640, "h": 300 },
  "xField": "date",
  "yFields": ["visitors", "sessions"],
  "colorPalette": "ocean",
  "showLegend": true,
  "showGrid": true,
  "showDots": false
}
```

**All widget fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique ID (`w_` + random 7-char alphanum) |
| `type` | string | `kpi_card` \| `area_chart` \| `bar_chart` \| `pie_chart` \| `data_table` \| `text_note` |
| `title` | string | Display title shown in widget header |
| `dataSource` | string | `traffic` \| `top_pages` \| `sources` \| `devices` \| `countries` \| `sessions` |
| `dateRange` | string | `7d` \| `30d` \| `90d` \| `all` |
| `px` | object | Pixel layout: `{x, y, w, h}` in pixels |
| `xField` | string | Column name to use for X axis / name key |
| `yFields` | string[] | Column names to plot as series / metrics |
| `kpiMetric` | string | KPI metric key: `visitors` \| `sessions` \| `pageviews` \| `bounce_rate` \| `avg_duration` |
| `showLegend` | boolean | Show/hide chart legend (default `true`) |
| `showGrid` | boolean | Show/hide cartesian grid lines (default `true`) |
| `showDots` | boolean | Show dots on area chart line (default `false`) |
| `barOrientation` | string | `vertical` (default) \| `horizontal` |
| `innerRadius` | number | Donut hole size as % (0 = pie, >0 = donut) |
| `rowLimit` | number | Max rows shown in data table (default 10) |
| `sortBy` | string | Column to sort data table by |
| `sortDir` | string | `asc` \| `desc` |
| `stripedRows` | boolean | Alternating row background in data table |
| `colorPalette` | string | One of 8 named palettes (see below) |
| `content` | string | Markdown-lite text content (text_note only) |
| `fontSize` | string | Text size class for text_note |
| `textAlign` | string | `left` \| `center` \| `right` |
| `textColor` | string | Tailwind color token for text_note |
| `bgStyle` | string | Background style variant for text_note |

### Color Palettes

| Name | Colors (first 4) |
|------|------------------|
| `default` | Indigo, Emerald, Amber, Red |
| `ocean` | Sky, Cyan, Teal, Light Cyan |
| `warm` | Orange, Red, Amber, Pink |
| `mono` | Gray 700, Gray 500, Gray 400, Gray 600 |
| `forest` | Green 600, Green 400, Lime, Green 700 |
| `candy` | Pink, Purple, Amber, Cyan |
| `fire` | Red, Orange, Yellow, Dark Red |
| `purple` | Violet, Purple, Lavender, Indigo |

### Widget Catalogue

#### KPI Card
Displays a single metric value with a trend arrow comparing current vs. previous period. Supports all 5 KPI metrics: `visitors`, `sessions`, `pageviews`, `bounce_rate`, `avg_duration`.

#### Area Chart
Filled line chart for trend-over-time data. Supports multiple series, gradient fill, configurable dots and gridlines. Uses `safeDate()` for ISO date → human-readable axis labels.

#### Bar Chart
Ranked comparison bars. Supports both vertical (column) and horizontal (bar) orientations. Best for `top_pages`, `sources`, `devices`, `countries` data sources.

#### Pie / Donut Chart
Proportional breakdown. Setting `innerRadius > 0` renders a donut chart. Shows % labels for slices >6%. Up to 9 slices.

#### Data Table
Sortable, scrollable table with sticky header. Config: `sortBy`, `sortDir`, `rowLimit`, `stripedRows`. Sorts entire dataset before slicing to limit — guarantees correct top-N results.

#### Text / Note
Markdown-lite free-form text block. Supports `**bold**`, `*italic*`, `# headings`, `` `inline code` ``, `- lists`. Configurable font size, text alignment, color, and background style.

---

## 5. Reporting System

### Report vs Dashboard

| Concept | Dashboard | Report |
|---------|-----------|--------|
| Purpose | Live monitoring | Point-in-time export |
| Data | Always fresh | Snapshot at generation time |
| Format | Interactive web UI | PDF / PPT / Excel |
| Scheduling | N/A | Recurring (daily / weekly / monthly) |

### Report Creation Flow

```
1. User opens Report Studio
       │
2. Select source dashboard (or create new layout)
       │
3. Choose pages/sections to include
       │
4. Customize:
   ├── Add cover page (logo, title, date, recipient)
   ├── Add section headers / dividers
   ├── Add notes / commentary text blocks
   ├── Set header & footer (page numbers, company name)
   └── Override date range for this specific report
       │
5. Preview (rendered in iframe via headless renderer)
       │
6. Export or Schedule
   ├── Export Now → queued async job → download URL
   └── Schedule → cron config saved → auto-generated on schedule
```

### Report Configuration JSON

```json
{
  "id": "report_xyz",
  "name": "Monthly Executive Report — May 2026",
  "sourceType": "dashboard",
  "sourceDashboardId": "dash_abc",
  "pages": ["page_1", "page_3"],
  "dateRange": { "start": "2026-05-01", "end": "2026-05-31" },
  "branding": {
    "logo": "https://cdn.company.com/logo.png",
    "primaryColor": "#6366F1",
    "fontFamily": "Inter",
    "headerText": "Acme Corp Analytics",
    "footerText": "Confidential — Internal Use Only"
  },
  "coverPage": {
    "enabled": true,
    "title": "Monthly Analytics Report",
    "subtitle": "May 2026",
    "recipient": "Board of Directors"
  },
  "format": "pdf",
  "schedule": {
    "enabled": true,
    "cron": "0 8 1 * *",
    "timezone": "America/New_York",
    "recipients": ["ceo@acme.com", "cto@acme.com"]
  }
}
```

---

## 6. Export Engine Architecture

All exports are handled client-side by `ExportModal` (`src/components/reporting/ExportModal.jsx`). No server-side queue, Puppeteer, or external workers are required.

### Supported Export Formats

| Format | Mechanism | Notes |
|--------|-----------|-------|
| **PDF** | `PrintLayout` portal + `window.print()` | Browser native print-to-PDF |
| **PNG** | `html2canvas` composite | SVG swap pipeline for chart fidelity |
| **JSON** | `JSON.stringify` + blob download | Full widget array |
| **CSV** | Custom serializer + blob download | Widget data arrays per widget |

### SVG Swap Pipeline (PNG / PDF)

Recharts renders charts as `<svg>` elements. `html2canvas` cannot rasterize live SVG correctly, so the export pipeline swaps each SVG with a `<img>` before capture.

```
For each widget in dashboard:
  1. Find all <svg.recharts-surface> inside #canvas-widget-{id}
  2. Clone SVG node → XMLSerializer.serializeToString()
  3. btoa(encodeURIComponent(svgString)) → data:image/svg+xml;base64,… URL
  4. Create <img> with same position/size → overlay on top of SVG
  5. Run html2canvas on the widget element (scale=2 for retina)
  6. Restore original SVGs (remove <img> overlays)
```

### PDF Pipeline (PrintLayout Portal)

PDF uses a dedicated `PrintLayout` React component rendered into a hidden `<div id="insighttrack-print-root">` via `createPortal`. CSS media queries hide `#root` and show the print root during `@media print`.

```
User clicks Export → PDF
    │
    ▼
buildSnapshots(): async per-widget PNG captures with progress 0→80%
    │
    ▼
PrintLayout rendered into #insighttrack-print-root:
  ├── Cover page (gradient stripe, dashboard title, timestamp, branding)
  ├── KPI cards grid (up to 4 per row, widget snapshots as <img>)
  ├── Charts/tables section (breakInside:avoid, accent border, type badge)
  └── Footer (timestamp + InsightTrack branding)
    │
    ▼
window.print() → browser opens print dialog
    │
    ▼
afterprint listener → cleanup portal, status = 'done'
```

**Print CSS (injected once at module load):**
```css
@media print {
  #root { display: none !important; }
  #insighttrack-print-root { display: block !important; }
  .no-print { display: none !important; }
  * { -webkit-print-color-adjust: exact !important; }
}
```

### PNG Pipeline (Dashboard Composite)

```
User clicks Export → PNG
    │
    ▼
buildSnapshots(): SVG swap → html2canvas per widget
(progress shown in modal: 0% → 80%)
    │
    ▼
Create off-screen <div> matching dashboard layout
Place widget snapshot <img> elements at correct px positions
    │
    ▼
html2canvas(compositeDiv, { scale: pngScale, useCORS: true })
    │
    ▼
canvas.toBlob('image/png') → dlFile() downloads as {dashName}.png
(progress 80% → 100%)
```

### JSON Export (Synchronous)

Downloads the full widget array as `{dashName}.json`. Can be re-imported via dashboard import flow.

### CSV Export (Synchronous)

For each widget, iterates `widgetData[widget.id]` (pre-loaded data passed into ExportModal) and serializes to CSV. All widget CSVs are concatenated with section headers.

### ExportModal Config Options

| Option | Values | Description |
|--------|--------|-------------|
| `format` | `pdf` \| `png` \| `json` \| `csv` | Export format |
| `exportTheme` | `light` \| `dark` | Theme for PNG/PDF render |
| `pageSize` | `a4` \| `a4l` \| `letter` \| `wide` | Page size for PDF |
| `showCover` | boolean | Include cover page in PDF |
| `showTimestamp` | boolean | Include generation timestamp |
| `showBranding` | boolean | Include InsightTrack branding |
| `pngScale` | `1` \| `2` \| `3` | Pixel ratio for PNG (2 = retina) |

---

## 7. Storage Architecture

### Dashboard Layout JSON

Dashboards are stored as versioned JSON blobs in PostgreSQL.

```sql
CREATE TABLE dashboards (
  id            VARCHAR(64) PRIMARY KEY,
  org_id        VARCHAR(64) NOT NULL,
  site_id       VARCHAR(64),
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  layout        JSONB NOT NULL,         -- full widget layout
  theme         JSONB DEFAULT '{}',     -- theme overrides
  branding      JSONB DEFAULT '{}',     -- logo, colors, fonts
  is_template   BOOLEAN DEFAULT FALSE,
  is_public     BOOLEAN DEFAULT FALSE,
  public_token  VARCHAR(128),           -- shareable link token
  created_by    VARCHAR(64) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dashboard_versions (
  id            SERIAL PRIMARY KEY,
  dashboard_id  VARCHAR(64) NOT NULL REFERENCES dashboards(id),
  version       INTEGER NOT NULL,
  layout        JSONB NOT NULL,
  saved_by      VARCHAR(64) NOT NULL,
  saved_at      TIMESTAMPTZ DEFAULT NOW(),
  change_note   TEXT
);
```

### Widget Configuration Structure

```json
{
  "version": 2,
  "pages": [
    {
      "id": "page_1",
      "name": "Overview",
      "breakpoints": {
        "xl": [
          { "i": "widget_a1", "x": 0, "y": 0, "w": 4, "h": 3 },
          { "i": "widget_a2", "x": 4, "y": 0, "w": 8, "h": 3 }
        ],
        "md": [
          { "i": "widget_a1", "x": 0, "y": 0, "w": 6, "h": 3 },
          { "i": "widget_a2", "x": 0, "y": 3, "w": 12, "h": 4 }
        ]
      },
      "widgets": {
        "widget_a1": { ... },
        "widget_a2": { ... }
      }
    }
  ],
  "globalFilters": {
    "dateRange": "30d",
    "siteId": "{{siteId}}"
  }
}
```

### Versioning System

| Action | Behavior |
|--------|----------|
| Auto-save | Debounced 3s after last change, creates a draft version |
| Manual save | Creates a named version with optional change note |
| Version restore | Copies old version's layout JSON into current draft |
| Version limit | Keep last 50 versions per dashboard; older ones pruned |
| Publish | Marks a version as "published" — used by scheduled reports |

### Reusable Templates

```sql
CREATE TABLE dashboard_templates (
  id            VARCHAR(64) PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  category      VARCHAR(64),    -- 'ecommerce', 'saas', 'content', 'custom'
  thumbnail_url TEXT,
  layout        JSONB NOT NULL,
  is_system     BOOLEAN DEFAULT FALSE,  -- built-in vs user-created
  org_id        VARCHAR(64),            -- NULL = system template
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. Frontend Architecture

### Directory Structure

```
src/
├── pages/
│   ├── DashboardBuilder.jsx      ← Builder canvas + widget palette
│   ├── DashboardView.jsx         ← Read-only dashboard viewer
│   ├── ReportStudio.jsx          ← Report creation + preview
│   └── ExportManager.jsx         ← Export job queue viewer
│
├── components/
│   ├── builder/
│   │   ├── Canvas.jsx            ← react-grid-layout wrapper
│   │   ├── WidgetPalette.jsx     ← Drag source list
│   │   ├── WidgetFrame.jsx       ← Widget chrome (title, edit, delete)
│   │   ├── WidgetConfigDrawer.jsx← Right-side config panel
│   │   └── PageTabs.jsx          ← Multi-page navigation
│   │
│   ├── widgets/
│   │   ├── KpiCard.jsx
│   │   ├── LineChart.jsx
│   │   ├── BarChart.jsx
│   │   ├── PieChart.jsx
│   │   ├── DataTable.jsx
│   │   ├── Heatmap.jsx
│   │   ├── Funnel.jsx
│   │   ├── MarkdownBlock.jsx
│   │   ├── DateFilter.jsx
│   │   └── ComparisonWidget.jsx
│   │
│   └── export/
│       ├── ExportModal.jsx
│       ├── ExportProgress.jsx
│       └── ShareLinkPanel.jsx
│
├── hooks/
│   ├── useDashboard.js           ← Dashboard CRUD + auto-save
│   ├── useWidgetData.js          ← Per-widget data fetching
│   └── useExport.js              ← Export job polling
│
└── store/
    ├── useDashboardStore.js      ← Zustand: layout, selection, dirty state
    └── useExportStore.js         ← Zustand: export job queue
```

### State Management (Zustand)

```js
// useDashboardStore.js
{
  // Current dashboard
  dashboard: null,
  isDirty: false,
  activePage: 'page_1',

  // Selection
  selectedWidgetId: null,

  // Layout (mirrors react-grid-layout internal state)
  layouts: {},          // { xl: [...], md: [...], sm: [...] }

  // Actions
  setLayout: (breakpoint, layout) => ...,
  addWidget: (type, defaultConfig) => ...,
  updateWidget: (id, patch) => ...,
  removeWidget: (id) => ...,
  saveDashboard: async () => ...,
  setActivePage: (pageId) => ...,
}
```

### Grid System

**react-grid-layout** configuration:

```jsx
<ResponsiveGridLayout
  className="layout"
  breakpoints={{ xl: 1280, lg: 1024, md: 768, sm: 480 }}
  cols={{ xl: 12, lg: 10, md: 8, sm: 4 }}
  rowHeight={80}
  draggableHandle=".widget-drag-handle"
  onLayoutChange={(layout, allLayouts) => setLayouts(allLayouts)}
  compactType="vertical"
  preventCollision={false}
>
  {widgets.map(w => (
    <div key={w.id} data-grid={currentLayout[w.id]}>
      <WidgetFrame widget={w} />
    </div>
  ))}
</ResponsiveGridLayout>
```

### Drag & Drop System (dnd-kit)

```
Widget Palette (DragSource)
    │
    │  user drags widget type card
    │
    ▼
Canvas Drop Zone (DropTarget)
    │
    │  onDrop: addWidget(type, { x: dropX, y: dropY })
    │
    ▼
New widget added to layout + config drawer opens
```

---

## 9. Backend Architecture

### Service Layer

```
API Gateway
    │
    ├── DashboardService
    │     ├── CRUD for dashboards (PG)
    │     ├── Version management
    │     └── Public share token generation
    │
    ├── QueryService
    │     ├── Execute widget data queries (DuckDB / PG)
    │     ├── Query template registry
    │     ├── Parameter sanitisation (no string interpolation)
    │     └── Result caching (Redis, TTL per query type)
    │
    ├── ExportService
    │     ├── Job enqueueing (Bull + Redis)
    │     ├── Job status polling
    │     └── Download URL generation (presigned S3)
    │
    ├── RenderService
    │     ├── Puppeteer pool management
    │     ├── Render token issuance
    │     └── Headless screenshot/PDF execution
    │
    └── SchedulerService
          ├── Cron job management (node-cron / BullMQ repeatable)
          ├── Report generation trigger
          └── Email delivery (nodemailer / SendGrid)
```

### Query Template Registry

All widget queries are registered as named templates with typed parameters — never string-interpolated SQL:

```js
// queryTemplates.js
export const QUERY_TEMPLATES = {
  traffic_over_time: {
    engine: 'duckdb',
    sql: `SELECT CAST(timestamp AS DATE) AS date, COUNT(*) AS sessions
          FROM events
          WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
          GROUP BY 1 ORDER BY 1`,
    params: ['siteId', 'start', 'end'],
  },
  revenue_by_source: {
    engine: 'duckdb',
    sql: `SELECT utm_source AS source,
                 SUM(CAST(json_extract(properties,'$.value') AS DOUBLE)) AS revenue
          FROM events
          WHERE site_id = ? AND type = 'purchase'
            AND timestamp >= ? AND timestamp <= ?
          GROUP BY source ORDER BY revenue DESC`,
    params: ['siteId', 'start', 'end'],
  },
};
```

---

## 10. Recommended Tech Stack

### Frontend

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | React 18 + Vite | Fast HMR, concurrent features |
| Styling | Tailwind CSS v4 | Utility-first, dark mode trivial |
| Grid / Layout | react-grid-layout | Battle-tested, breakpoint-aware |
| Drag & Drop | dnd-kit | Accessible, headless, composable |
| Charts | Recharts + ECharts | Recharts for simple, ECharts for heatmaps/complex |
| State | Zustand | Minimal boilerplate, selector-based |
| Data fetching | TanStack Query | Caching, background refresh, pagination |
| Rich text | TipTap | Markdown blocks with WYSIWYG |

### Backend

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js 20 (ESM) | Matches existing codebase |
| Framework | Express 4 | Existing choice; NestJS for v2 |
| Primary DB | PostgreSQL 15 | Writes, metadata, user data |
| Analytics DB | DuckDB | OLAP reads, Parquet federation |
| Cache | Redis 7 | Query result cache, job queue backend |
| Queue | BullMQ | Robust, Redis-backed, repeatable jobs |
| Object storage | MinIO (self-hosted) / S3 | Export file storage |
| Headless browser | Puppeteer 21 | PDF & PNG generation |
| Email | Nodemailer + SMTP | Scheduled report delivery |

### Export Libraries

| Format | Library | Notes |
|--------|---------|-------|
| PDF | Puppeteer `page.pdf()` | Best fidelity, renders actual React UI |
| PPT | PptxGenJS | Pure JS, no COM dependencies |
| Excel | ExcelJS | Formula support, cell styles |
| CSV | csv-stringify | Streaming, memory-efficient |
| PNG | Puppeteer `page.screenshot()` | Pixel-perfect widget capture |

---

## 11. Complete System Flow

### Flow 1: User Creates and Views a Dashboard

```
1. User opens Dashboard Builder
   └── GET /api/dashboards → load existing or blank template

2. User drags "Line Chart" widget from palette onto canvas
   └── addWidget('line_chart', defaultConfig) → local state update

3. User configures widget (data source, colors, title)
   └── updateWidget(id, config) → local state update
   └── Preview: GET /api/query/traffic_over_time?siteId=...&dateRange=30d
                    → DuckDB executes parameterised query
                    → Redis cache checked first (TTL: 5 min)
                    → Result returned → chart renders

4. User saves dashboard
   └── PUT /api/dashboards/{id}
       → PG: UPDATE dashboards SET layout = $1
       → PG: INSERT INTO dashboard_versions (layout, version++)

5. User shares dashboard
   └── POST /api/dashboards/{id}/share
       → Generate signed token (JWT, 30-day expiry)
       → Return: https://app.example.com/dash/public/{token}
```

### Flow 2: Export to PDF

```
1. User clicks "Export PDF"
   └── POST /api/exports
       body: { dashboardId, format: 'pdf', dateRange: '30d' }

2. API validates request, enqueues BullMQ job
   └── Returns: { jobId: 'job_xyz', status: 'queued' }

3. Frontend polls: GET /api/exports/job_xyz
   └── Shows progress bar

4. Worker (separate process):
   a. Fetch dashboard JSON from PG
   b. Issue render token (JWT, 5 min)
   c. Launch Puppeteer → navigate to /internal/render/dash/job_xyz?token=...
   d. React loads dashboard, fetches all widget data
   e. All charts render → window.__RENDER_COMPLETE__ = true
   f. Puppeteer: page.pdf({ format: 'A4', ... })
   g. Upload PDF to MinIO → get object URL
   h. Update job: { status: 'done', downloadUrl: 'https://...' }

5. Frontend poll detects 'done'
   └── Show "Download PDF" button with presigned URL
```

### Flow 3: Scheduled Report

```
Cron triggers (e.g., 1st of month, 08:00)
    │
    ▼
SchedulerService.runReport(reportConfig)
    │
    ▼
Enqueue export job with:
  - dashboardId from reportConfig.sourceDashboardId
  - dateRange = last calendar month
  - format = reportConfig.format
    │
    ▼
Worker generates export (same PDF pipeline as Flow 2)
    │
    ▼
Email report as attachment + download link to:
  reportConfig.schedule.recipients
```

---

## 12. Database Schema

### Core Tables

```sql
-- Dashboard metadata + layout
CREATE TABLE dashboards (
  id            VARCHAR(64) PRIMARY KEY,
  org_id        VARCHAR(64) NOT NULL,
  site_id       VARCHAR(64),
  name          VARCHAR(255) NOT NULL,
  description   TEXT DEFAULT '',
  layout        JSONB NOT NULL DEFAULT '{"version":1,"pages":[]}',
  theme         JSONB NOT NULL DEFAULT '{}',
  branding      JSONB NOT NULL DEFAULT '{}',
  is_template   BOOLEAN DEFAULT FALSE,
  is_public     BOOLEAN DEFAULT FALSE,
  public_token  VARCHAR(128) UNIQUE,
  created_by    VARCHAR(64) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Immutable version history
CREATE TABLE dashboard_versions (
  id            BIGSERIAL PRIMARY KEY,
  dashboard_id  VARCHAR(64) NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  layout        JSONB NOT NULL,
  saved_by      VARCHAR(64) NOT NULL,
  saved_at      TIMESTAMPTZ DEFAULT NOW(),
  change_note   TEXT,
  UNIQUE(dashboard_id, version)
);

-- Reusable widget query templates
CREATE TABLE widget_query_templates (
  id            VARCHAR(64) PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  engine        VARCHAR(20) NOT NULL CHECK (engine IN ('duckdb', 'postgres', 'parquet')),
  sql_template  TEXT NOT NULL,
  param_schema  JSONB NOT NULL DEFAULT '[]',
  result_schema JSONB,
  org_id        VARCHAR(64),            -- NULL = system template
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Export jobs
CREATE TABLE export_jobs (
  id            VARCHAR(64) PRIMARY KEY,
  org_id        VARCHAR(64) NOT NULL,
  dashboard_id  VARCHAR(64),
  report_id     VARCHAR(64),
  format        VARCHAR(20) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'queued',
  config        JSONB NOT NULL DEFAULT '{}',
  result_url    TEXT,
  error_message TEXT,
  created_by    VARCHAR(64) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ
);

-- Scheduled reports
CREATE TABLE report_schedules (
  id              VARCHAR(64) PRIMARY KEY,
  org_id          VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  dashboard_id    VARCHAR(64) REFERENCES dashboards(id),
  format          VARCHAR(20) NOT NULL DEFAULT 'pdf',
  cron_expr       VARCHAR(100) NOT NULL,
  timezone        VARCHAR(64) NOT NULL DEFAULT 'UTC',
  date_range_mode VARCHAR(50) DEFAULT 'last_30_days',
  branding        JSONB DEFAULT '{}',
  recipients      JSONB NOT NULL DEFAULT '[]',
  enabled         BOOLEAN DEFAULT TRUE,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  created_by      VARCHAR(64) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_dashboards_org ON dashboards(org_id);
CREATE INDEX idx_dashboards_site ON dashboards(site_id);
CREATE INDEX idx_dashboard_versions_dashboard ON dashboard_versions(dashboard_id, version DESC);
CREATE INDEX idx_export_jobs_status ON export_jobs(status, created_at);
CREATE INDEX idx_report_schedules_next_run ON report_schedules(next_run_at) WHERE enabled = TRUE;
```

---

## 13. API Design

### Dashboard Endpoints

```
GET    /api/dashboards                         List dashboards for org
POST   /api/dashboards                         Create dashboard
GET    /api/dashboards/:id                     Get dashboard + layout
PUT    /api/dashboards/:id                     Update dashboard layout
DELETE /api/dashboards/:id                     Delete dashboard
GET    /api/dashboards/:id/versions            List versions
GET    /api/dashboards/:id/versions/:v         Get specific version
POST   /api/dashboards/:id/versions/:v/restore Restore version
POST   /api/dashboards/:id/share               Generate public share token
DELETE /api/dashboards/:id/share               Revoke public access
GET    /api/dashboards/public/:token           Get public dashboard (no auth)
```

### Query / Data Endpoints

```
GET    /api/query/:templateId                  Execute named query template
POST   /api/query/custom                       Execute custom SQL (admin only)
GET    /api/query/templates                    List available query templates
```

### Export Endpoints

```
POST   /api/exports                            Create export job
GET    /api/exports/:jobId                     Get job status
GET    /api/exports/:jobId/download            Redirect to presigned URL
DELETE /api/exports/:jobId                     Cancel / delete job
GET    /api/exports                            List recent export jobs
```

### Report / Schedule Endpoints

```
GET    /api/reports                            List scheduled reports
POST   /api/reports                            Create report schedule
PUT    /api/reports/:id                        Update schedule
DELETE /api/reports/:id                        Delete schedule
POST   /api/reports/:id/run                    Trigger manual run now
GET    /api/reports/:id/history                Past export results
```

### Template Endpoints

```
GET    /api/templates                          List dashboard templates
GET    /api/templates/:id                      Get template
POST   /api/dashboards?fromTemplate=:id        Create dashboard from template
POST   /api/templates                          Save dashboard as template
```

---

## 14. Caching Strategy

### Cache Layers

```
Browser (TanStack Query)
  └── In-memory, stale-while-revalidate, 60s default TTL
        │
        ▼
Redis (query result cache)
  ├── KPI queries:         TTL = 60s
  ├── Traffic/chart data:  TTL = 300s (5 min)
  ├── Top pages/sources:   TTL = 300s
  ├── Funnel data:         TTL = 600s (10 min)
  └── Historical data:     TTL = 3600s (1 hour, data won't change)
        │
        ▼
DuckDB (in-process, memory-mapped)
  └── Column data resident in memory after first scan
```

### Cache Key Strategy

```
redis_key = `query:${orgId}:${siteId}:${templateId}:${dateRange}:${JSON.stringify(extraParams)}`
```

### Cache Invalidation

| Trigger | Action |
|---------|--------|
| New tracking event received | Invalidate `kpi:*`, `traffic:*`, `realtime:*` for that siteId |
| DuckDB sync completes | Invalidate all analytical keys for synced siteIds |
| User changes date range | TanStack Query refetches (browser cache miss, Redis TTL may still be valid) |

---

## 15. Scheduling & Automation

### Scheduler Architecture

```
BullMQ Scheduler (repeatable jobs)
    │
    ├── Every minute: check report_schedules WHERE next_run_at <= NOW()
    │
    └── For each due schedule:
          │
          ├── Enqueue export job (PDF / Excel / etc.)
          │
          ├── Update last_run_at = NOW()
          │
          └── Calculate next_run_at from cron expression
```

### Cron Presets

| Preset | Cron | Description |
|--------|------|-------------|
| Daily at 8am | `0 8 * * *` | Morning briefing |
| Weekly (Monday) | `0 8 * * 1` | Weekly digest |
| Monthly (1st) | `0 8 1 * *` | Monthly report |
| Quarterly | `0 8 1 1,4,7,10 *` | Board reports |

### Email Delivery

```js
// reportMailer.js
async function sendReport({ to, reportName, downloadUrl, attachmentBuffer, format }) {
  await transporter.sendMail({
    to,
    subject: `📊 ${reportName} — ${new Date().toLocaleDateString()}`,
    html: emailTemplate({ reportName, downloadUrl }),
    attachments: attachmentBuffer ? [{
      filename: `${reportName}.${format}`,
      content: attachmentBuffer,
    }] : [],
  });
}
```

---

## 16. Multi-Tenant Support

### Tenancy Model

```
Organisation (org_id)
    │
    ├── Users (many)
    │
    ├── Sites (many per org)
    │
    └── Dashboards (many per org, optionally scoped to site)
```

### Row-Level Security Pattern

Every database query includes `org_id` as a mandatory parameter:

```sql
-- Every dashboard query is scoped
SELECT * FROM dashboards WHERE id = $1 AND org_id = $2;
```

The API middleware extracts `org_id` from the JWT and injects it into every service call — user-supplied `org_id` in the request body is ignored.

### Permission Model

| Role | Dashboards | Reports | Export | Admin |
|------|-----------|---------|--------|-------|
| Viewer | Read | Read | Own exports only | No |
| Editor | Read + Write | Read + Write | Yes | No |
| Admin | Full | Full | Full | Yes |
| Owner | Full | Full | Full | Yes |

---

## 17. Real-Time Updates

### Dashboard Live Data

```
Browser ←── SSE (Server-Sent Events) ──── Express SSE endpoint
    │                                              │
    │  subscribe: siteId                           │
    │                                              │
    └── On new event tracked                       │
            └── invalidate widget cache ───────────┘
                → SSE message: { type: 'invalidate', widgetIds: [...] }
                → Browser: refetch affected widgets only
```

### Realtime KPI Cards

KPI cards poll every 30s by default (configurable per widget). For truly live data (< 5s latency), use SSE invalidation messages to trigger an immediate TanStack Query refetch.

---

## 18. Scalability Considerations

### Horizontal Scaling

| Component | Scaling Strategy |
|-----------|-----------------|
| API servers | Stateless — add instances behind load balancer |
| Export workers | Separate worker process pool; scale by queue depth |
| Puppeteer | Worker pool with max N concurrent browsers; queue overflow |
| DuckDB | Single-process per worker; can run multiple workers on read-only DuckDB files |
| PostgreSQL | Primary + read replicas for dashboard metadata reads |
| Redis | Redis Cluster for large deployments |

### Query Performance

- **Materialised views** in DuckDB for frequently-used aggregations
- **Parquet partitioning** by `site_id / year / month` for cold data
- **DuckDB `ATTACH`** to query Parquet files alongside hot tables in a single SQL statement
- **Query timeout** hard limit: 30s; queries beyond are cancelled and a partial result warning is shown

### Export Worker Sizing

```
Target: PDF in < 30s, PPT in < 60s

Puppeteer pool: min 2, max 10 instances
BullMQ concurrency per worker: 3
Worker processes: scale with queue depth (target < 5 jobs waiting)
```

---

## 19. Evolution into Full BI Platform

### Comparison with Established Platforms

| Feature | InsightTrack Studio | Grafana | Tableau | Metabase | Superset |
|---------|--------------------|---------|---------|----|------|
| Drag-and-drop builder | ✅ | ✅ | ✅ | ✅ | ✅ |
| SQL editor | Roadmap | ✅ | Limited | ✅ | ✅ |
| Multi-datasource | Roadmap | ✅ | ✅ | ✅ | ✅ |
| Alerting | Roadmap | ✅ | Limited | ✅ | ✅ |
| Embeddable | ✅ (iframe) | ✅ | ✅ | ✅ | ✅ |
| Self-hosted | ✅ | ✅ | No | ✅ | ✅ |
| PDF export | ✅ | Plugin | ✅ | ✅ | ✅ |
| Scheduled reports | ✅ | ✅ | ✅ | ✅ | ✅ |

### Roadmap Phases

#### Phase 1 — Foundation (Current Spec)
- Dashboard builder with react-grid-layout
- Widget catalogue (12 widget types)
- PDF / CSV / Excel / PNG export
- Basic scheduled reports
- Multi-tenant with org_id scoping

#### Phase 2 — Power User Features
- **SQL Query Editor**: Let analysts write custom DuckDB SQL in a widget
- **Alerting**: Threshold-based alerts → email / Slack / webhook
- **Annotations**: Click on chart to add a note (already partially built)
- **Data blending**: Join DuckDB hot data with Parquet cold data in one query
- **Calculated metrics**: Define `revenue_per_visitor = revenue / visitors` reusable across widgets

#### Phase 3 — Multi-Datasource
- **Datasource connectors**: MySQL, BigQuery, Snowflake, Redshift, REST APIs
- **Federation**: DuckDB ATTACH to external Parquet/CSV/Delta Lake
- **Data modelling layer**: Define semantic metrics (like Looker's LookML)
- **Row-level security per datasource**

#### Phase 4 — Enterprise / Embedded
- **Embedded analytics**: `<iframe>` or JS SDK to embed dashboards in customer products
- **White-labelling**: Full CSS/brand override
- **SAML / SSO** (Okta, Azure AD)
- **Audit log**: Every dashboard view, export, and data access logged
- **Data governance**: Column-level access controls, PII masking

#### Phase 5 — AI-Augmented BI
- **Natural language queries**: "Show me revenue by country for last quarter" → auto-generates DuckDB SQL
- **Anomaly detection**: ML model flags unusual spikes/drops in KPI widgets
- **Auto-insights**: Automatically surfaces "Sessions dropped 34% on mobile, iOS 17 only" type findings
- **Smart scheduling**: AI suggests optimal report cadence based on usage patterns

### Architecture Evolution Diagram

```
Phase 1: Monolith
  InsightTrack API → PostgreSQL + DuckDB

Phase 2: Services split
  API Gateway
    ├── Dashboard Service
    ├── Query Service (DuckDB pool)
    ├── Export Service (worker pool)
    └── Notification Service

Phase 3: Platform
  API Gateway
    ├── Dashboard Service
    ├── Query Federation Service
    │     ├── DuckDB
    │     ├── Parquet (S3/MinIO)
    │     ├── PostgreSQL
    │     └── External connectors (plugin system)
    ├── Export Service
    ├── Alert Engine
    └── AI/ML Service (LLM proxy + anomaly detector)
```

---

## Summary

| Layer | Key Technology | Purpose |
|-------|---------------|---------|
| Canvas | react-grid-layout + dnd-kit | Drag/drop/resize widget layout |
| Charts | Recharts + ECharts | Render data visualisations |
| State | Zustand + TanStack Query | Layout + data caching |
| API | Express + BullMQ | Route requests, queue exports |
| Data | DuckDB + Parquet + PostgreSQL | Query federation |
| Cache | Redis | Query result TTL cache |
| Export | Puppeteer + PptxGenJS + ExcelJS | Generate PDF / PPT / XLSX / PNG |
| Storage | MinIO / S3 | Store exported files |
| Schedule | BullMQ repeatable + node-cron | Automated report delivery |
| Auth | JWT + org_id scoping | Multi-tenant row isolation |
