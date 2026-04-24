# Dashboard Pages Documentation

This folder explains every page inside the authenticated InsightTrack dashboard.

For each page, the docs answer two practical questions:

1. **What does this page do?**
2. **How are the numbers or views calculated?**

## Shared behavior across analytics pages

Before reading individual pages, keep these global rules in mind:

- Most analytics pages use the shared `useAnalytics()` hook.
- The hook automatically sends the current `siteId` from `useSiteStore`.
- The selected date range comes from `useDateFilterStore`.
- If the dashboard date filter is `custom`, the frontend sends a `custom:start:end` range string.
- Standard analytics pages refresh every **60 seconds**.
- Realtime widgets refresh faster:
  - `useRealtime()` every **15 seconds**
  - `useRealtimeEventStream()` every **10 seconds**
- All analytics requests go through `apps/dashboard-web/src/services/api.js` and call the secured backend under `/api/analytics/:siteId/*`.

## Calculation conventions used throughout the product

- **Visitors** usually means `COUNT(DISTINCT user_id)`.
- **Sessions** usually means either:
  - `COUNT(*)` on the `sessions` table, or
  - `COUNT(DISTINCT session_id)` on raw events.
- **Pageviews** means `COUNT(*)` where `type = 'pageview'`.
- **Percentages** are typically rounded to the nearest integer or to one decimal place depending on the endpoint.
- **Trend percentages** compare the current range to the immediately previous range of equal length.
- Many pages are powered by DuckDB query functions in `apps/analytics-api/src/queries/queries.js`.

## Pages covered here

1. `01-dashboard.md`
2. `02-pages.md`
3. `03-funnels.md`
4. `04-conversions.md`
5. `05-audience.md`
6. `06-content.md`
7. `07-acquisition.md`
8. `08-performance.md`
9. `09-realtime.md`
10. `10-user-flow.md`
11. `11-engagement.md`
12. `12-reporting.md`
13. `13-privacy.md`
14. `14-settings.md`
15. `15-docs-reference.md`
16. `16-profile.md`

## Important implementation notes

A few pages are intentionally more product-like than mathematically complete:

- The **Funnels** page uses a fixed funnel definition in the backend query today.
- The **Profile** page is mostly local UI/localStorage state, not a full server-backed account settings page.
- The **Docs** page is static reference content rendered from constants in the frontend.
- The **Settings** page includes a traffic alert widget whose anomaly detection is calculated from daily visitors using a rolling mean and standard deviation.

If you change any page logic, update the matching file in this folder so the docs stay truthful.