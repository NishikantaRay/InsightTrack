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
| **Privacy** | `/privacy` | Privacy features overview, data retention config (2 tabs) |
| **Settings** | `/settings` | Site management, tracking script installation |
| **Login / Register** | `/login`, `/register` | Authentication pages |
| **Docs** | `/docs` | Documentation pages |

---

## See Also
- [getting-started.md](./getting-started.md)
- [testing.md](./testing.md)
