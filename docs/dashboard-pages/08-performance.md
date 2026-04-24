# Performance

## What this page does

The Performance page monitors technical quality.

It has two tabs:

- Web Vitals
- JavaScript Errors

This page answers:

- how fast are my pages for real users?
- what client-side errors are hurting the experience?

## Web Vitals

### Backend sources

- `getWebVitalsOverview()`
- `getWebVitals()`

### What data is used

Only `web_vital` events are used.

Each event stores:

- `properties.metric`
- `properties.value`
- page path

### Overview cards

For each metric, the backend calculates:

- average value
- 75th percentile value (`p75`)
- sample count

The overview query groups by metric only.

### Per-page breakdown

The page-level query groups by:

- `path`
- metric name

For each metric on each page it calculates:

- average = `AVG(value)`
- p75 = `PERCENTILE_CONT(0.75)`
- samples = `COUNT(*)`

### Why p75 matters

The UI emphasizes `p75` because Core Web Vitals are commonly judged at the 75th percentile. That means the page is measuring what a "typical slower user" experiences, not just the mean.

### Thresholds used by the UI

The page color-codes vitals with hardcoded thresholds:

- **LCP** good ≤ 2500 ms, poor > 4000 ms
- **FID** good ≤ 100 ms, poor > 300 ms
- **CLS** good ≤ 0.1, poor > 0.25
- **INP** good ≤ 200 ms, poor > 500 ms
- **TTFB** good ≤ 800 ms, poor > 1800 ms

Anything between good and poor becomes "Needs Work".

## JavaScript Errors

### Backend sources

- `getJSErrors()`
- `getJSErrorsOverTime()`

### Top errors list

The backend groups `js_error` events by:

- error message
- source file
- page path

It returns:

- occurrences = total error event count
- affected users = `COUNT(DISTINCT user_id)`
- first seen = earliest timestamp
- last seen = latest timestamp

### Error trend

The trend chart groups `js_error` events by day and returns:

- total errors per day
- distinct affected users per day

## Notes

- Performance is based on real tracked client events, not synthetic lab testing.
- If no web vitals or errors are visible, it usually means the tracking script has not yet collected those event types for the selected site/date range.