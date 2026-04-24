# Dashboard

## What this page does

The main Dashboard is the high-level executive summary for a selected site.

It combines:

- KPI cards
- traffic and pageview trend charts
- top pages
- traffic sources
- device breakdown
- session duration buckets
- countries table
- a compact funnel chart

The page is meant to answer: **How is the site doing overall right now, and how does that compare to the previous period?**

## Data this page loads

The page loads four key datasets directly:

- `getKPIs`
- `getTraffic`
- `getBounceRateTrend`
- `getAvgSessionTrend`

The chart components then load their own supporting analytics endpoints such as top pages, sources, devices, countries, sessions, and funnel data.

## How the KPI cards are calculated

The KPI cards are backed by `getKPISummary()` in `apps/analytics-api/src/queries/queries.js`.

### Total Visitors

Calculated as:

- `COUNT(DISTINCT user_id)` from the `events` table
- within the selected date range

This measures unique visitors, not raw event volume.

### Pageviews

Calculated as:

- `COUNT(*)` from `events`
- filtered to `type = 'pageview'`

Every pageview event contributes one count.

### Total Sessions

Calculated as:

- `COUNT(*)` from the `sessions` table
- within the selected range

### Bounce Rate

Calculated as:

$$
\text{Bounce Rate} = \frac{\text{Bounced Sessions}}{\text{Total Sessions}} \times 100
$$

Where bounced sessions come from:

- `SUM(CASE WHEN is_bounce THEN 1 ELSE 0 END)` on `sessions`

The backend rounds this to one decimal place.

### Average Session Duration

Calculated as:

- `AVG(duration)` from the `sessions` table
- then formatted into a human-readable string like `0m 43s`

### Pages per Session

Calculated as:

$$
\text{Pages per Session} = \frac{\text{Total Pageviews}}{\text{Total Sessions}}
$$

The backend returns it as a string with two decimals.

## How trend percentages are calculated

The KPI trends compare the current selected range with the immediately previous range of equal length.

For example, if the user selects 30 days:

- current period = last 30 days
- previous period = the 30 days before that

Trend formula:

$$
\text{Trend \%} = \frac{\text{Current} - \text{Previous}}{\text{Previous}} \times 100
$$

Special-case rule used in code:

- if previous value is `0` and current is greater than `0`, trend returns `100`
- if both are `0`, trend returns `0`

The value is rounded to one decimal place.

## How the sparkline mini-charts are built

The KPI cards show sparklines made from other endpoints:

- visitors sparkline → `getTraffic()` daily visitors
- pageviews sparkline → `getTraffic()` daily pageviews
- bounce rate sparkline → `getBounceRateTrend()`
- avg session sparkline → `getAvgSessionTrend()`

These sparklines are visual helpers only; the headline KPI values come from `getKPISummary()`.

## Notes

- The page has a manual Refresh button that refetches the core KPI/traffic datasets.
- The header also describes the dashboard as auto-refreshing, but the shared analytics hook actually refreshes most datasets every **60 seconds**.
- This page is the best place to validate whether ingestion, sessions, and top-level traffic are working end-to-end.