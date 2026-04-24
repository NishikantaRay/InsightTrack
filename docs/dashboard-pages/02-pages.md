# Pages

## What this page does

The Pages page ranks individual pages by traffic volume.

It is the simplest page in the dashboard: a table of page-level performance designed to answer:

- which pages get the most traffic?
- how much of total traffic does each page represent?
- how many unique visitors reached each page?

## Data this page loads

The page loads one endpoint:

- `getTopPages(siteId, dateRange, limit=50)`

Backend source:

- `getTopPages()` in `apps/analytics-api/src/queries/queries.js`

## How the backend calculates page performance

The backend groups pageview events by `path`.

Query logic:

- table: `events`
- filter: `type = 'pageview'`
- group by: `path`

For each page it returns:

### Views

Calculated as:

- `COUNT(*)` for pageview events on that path

### Unique Visitors

Calculated as:

- `COUNT(DISTINCT user_id)` for that path

The backend returns this as `uniqueVisitors`.

## How the frontend prepares the table

The table maps backend data into these columns:

- `page`
- `views`
- `visitors`
- `% of Total`

### % of Total

If the backend did not explicitly provide a percentage, the frontend computes it as:

$$
\text{% of Total} = \frac{\text{Page Views}}{\text{Total Views Across Returned Rows}} \times 100
$$

This is done after summing all rows in the returned page list.

### Fallback behavior

The UI is defensive and can fall back across multiple field names:

- `views` ← `views` or `pageviews` or `count`
- `visitors` ← `uniqueVisitors` or `visitors` or `unique_visitors`

If none of those exist, it falls back to an estimate:

- `Math.round(views * 0.7)`

In practice, the live backend already returns `uniqueVisitors`, so the estimate is just resilience code.

## Export behavior

The page supports CSV export using `exportToCSV()`.

The exported data matches the table view rather than recomputing any backend logic.

## Notes

- This page uses the top 50 pages by default.
- The percentage bar shown in the UI is purely visual and is based on the same computed percentage value.
- This page measures traffic concentration, not quality. Use Content, Engagement, and Performance pages for deeper page-level diagnosis.