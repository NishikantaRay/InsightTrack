# Frontend Structure & Conventions

This guide explains the structure, patterns, and best practices for the InsightTrack React dashboard (`apps/dashboard-web/`).

---

## Project Structure
- **src/** — Main source code
  - **components/** — UI, charts, layout, and reusable components
  - **hooks/** — Custom React hooks (e.g., useAnalytics)
  - **pages/** — Route-level pages (Dashboard, Login, etc.)
  - **services/** — API and utility functions
  - **store/** — Zustand state management
  - **utils/** — Helper functions
  - **__tests__/** — Unit and integration tests

## Key Patterns
- **State Management:** Zustand for global state (theme, auth, site, filters)
- **Data Fetching:** useAnalytics hook (with polling)
- **Styling:** Tailwind CSS (with dark mode support)
- **Charts:** Recharts for analytics visualizations
- **Routing:** React Router (via Vite)

## Conventions
- Use ES modules (import/export)
- All new UI must support dark mode (Tailwind `dark:`)
- Use the `useAnalytics` hook for dashboard data
- Keep components small and focused
- Place tests in `__tests__` or alongside components

## New Components & Libraries (2026)

- **VisitorMap** — Interactive world map using [react-leaflet](https://react-leaflet.js.org/) and OpenStreetMap tiles. Supports zoom, pan, markers, and dark mode.
- **EventStream** — Real-time event feed for pageviews, clicks, and custom events.
- **Choropleth map style** — Blue markers, clean basemap, and responsive design.

See `src/components/charts/VisitorMap.jsx` and `src/components/realtime/EventStream.jsx` for details.

### UI Helper Components (added May 2026)

| Component | File | Purpose |
|-----------|------|---------|
| **PageNote** | `src/components/ui/PageNote.jsx` | Collapsible contextual help banner added to every analytics page. Props: `title`, `summary`, `details[]`, `businessTip`, `devTip`, `defaultOpen`. Indigo color scheme, chevron toggle, emerald card for business tips, violet for dev tips. |
| **InfoTooltip** | `src/components/ui/InfoTooltip.jsx` | `(i)` icon with fixed-position hover tooltip. Props: `content`, `title`, `size`, `position`, `className`. Used in `MetricCard` and `ChartCard` via `info` prop. |
| **SiteManager** | `src/components/ui/SiteManager.jsx` | Site CRUD card with per-site expandable snippet panel, inline copy buttons (`CopyInline`), active-site protection, loading spinner, and empty state. |

### Page-Level Conventions (May 2026)

- Every analytics page has a `<PageNote>` at the top with `businessTip` and `devTip`.
- `MetricCard` and `ChartCard` accept an `info` prop that renders an `InfoTooltip`.
- Settings page uses a 4-tab layout: Sites / Tracking / Connection / Alerts.

## Pages

| Page | Route | Description |
|------|-------|-------------|
| **Dashboard** | `/` | KPI cards, traffic charts, top pages, sources |
| **Realtime** | `/realtime` | Live visitors, active pages, event stream |
| **Engagement** | `/engagement` | Scroll depth, heatmaps, rage clicks, time on page |
| **User Flow** | `/user-flow` | Sankey diagram of page transitions |
| **Content** | `/content` | Entry pages, exit pages, site search (3 tabs) |
| **Acquisition** | `/acquisition` | Campaigns, social media, keywords (3 tabs) |
| **Performance** | `/performance` | Web Vitals with thresholds, JS errors with trends (2 tabs) |
| **Reporting** | `/reporting` | Annotations, scheduled reports, data export (3 tabs) |
| **Privacy** | `/privacy` | Privacy features overview, data retention config — dual-audience tabs (Business Owner / Developer) |
| **Settings** | `/settings` | 4-tab layout: Sites (SiteManager), Tracking (snippet + custom events + platform guides), Connection (API endpoints), Alerts |
| **Login / Register** | `/login`, `/register` | Authentication pages |
| **Docs** | `/docs` | Documentation pages |

---

## See Also
- [getting-started.md](./getting-started.md)
- [testing.md](./testing.md)
