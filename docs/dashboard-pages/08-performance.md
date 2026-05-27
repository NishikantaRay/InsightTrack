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

- `properties.name` — the metric identifier (one of: `TTFB`, `LCP`, `FID`, `CLS`, `INP`)
- `properties.value` — the measured value (milliseconds for timing metrics, unitless for CLS)
- `properties.rating` — pre-classified by the tracking script as `good`, `needs-improvement`, or `poor`
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
- `properties.name` (the metric identifier)

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

## Term Glossary

| Term | Definition |
|------|------------|
| **LCP** (Largest Contentful Paint) | Time until the largest image or text block in the viewport is rendered. Measures perceived load speed. |
| **FID** (First Input Delay) | Delay between a user's first interaction (click, keypress) and the browser's response. Measures interactivity. |
| **CLS** (Cumulative Layout Shift) | Total unexpected layout shift during the page lifecycle. Measures visual stability. Score is unitless (0 = perfect). |
| **INP** (Interaction to Next Paint) | Worst interaction latency recorded during the visit. Replaces FID as the primary responsiveness metric. |
| **TTFB** (Time to First Byte) | Time from the navigation request until the first byte of the response arrives. Measures server/network speed. |
| **p75** | 75th percentile value. Core Web Vitals are graded at p75 — it reflects what a typical slower user experiences, not just the average. |
| **Good / Needs Work / Poor** | Color-coded status labels based on Google's CWV thresholds. Green = good, yellow = needs improvement, red = poor. |
| **Affected Users** | Count of distinct `user_id` values that triggered a given JS error. Helps triage impact. |
| **Occurrences** | Total count of a given JS error event, including repeated triggers by the same user. |

## Notes

- Performance is based on real tracked client events, not synthetic lab testing.
- The tracking script fires web vitals on page load (TTFB, LCP) and on page hide (CLS, INP via `visibilitychange`). FID fires on first user interaction.
- `properties.name` (not `properties.metric`) is the field used to identify the vital type — this matches the tracking script output.
- If no web vitals or errors are visible, it usually means the tracking script has not yet collected those event types for the selected site/date range.