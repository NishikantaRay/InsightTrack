# Engagement

## What this page does

The Engagement page focuses on how users interact with page content, not just whether they visited.

It has four tabs:

- Scroll Depth
- Click Heatmap
- Rage Clicks
- Time on Page

It also shows top-level engagement KPIs.

## Summary cards

### Backend source

- `getEngagementSummary()`

### Metrics returned

- average scroll depth
- average time on page
- total tracked clicks
- total rage click incidents

### How they are calculated

- **Avg Scroll Depth** = average of `properties.depth` across `scroll_depth` events
- **Avg Time on Page** = average of `properties.seconds` across `time_on_page` events
- **Total Clicks Tracked** = count of `heatmap_click` events
- **Rage Click Incidents** = count of `rage_click` events

## Scroll Depth tab

### Backend source

- `getScrollDepth()`

### How it is calculated

Only `scroll_depth` events are used where `properties.milestone = 'true'` (string, not boolean). The tracking script fires one event per milestone threshold crossed per page load and sets this flag so partial-scroll events from page reloads are not double-counted.

For each page, the backend counts how many events reached at least:

- 25%
- 50%
- 75%
- 100%

It also calculates:

- `avgDepth = AVG(properties.depth)`

> **Important:** The query uses `json_extract_string(properties, '$.milestone')` — not `json_extract()`. DuckDB's `json_extract` returns the raw JSON representation (`"true"` with quotes), which would never match the string `'true'`. `json_extract_string` strips the quotes and returns the plain string value.

This is milestone-based engagement, not continuous scroll sampling.

## Click Heatmap tab

### Backend source

- `getHeatmapSummary()` for the page table
- `getHeatmapData()` exists for page-specific point maps

### How it is calculated

The summary groups `heatmap_click` events by:

- page path
- CSS selector

The value shown is simply:

- `clicks = COUNT(*)`

## Rage Clicks tab

### Backend source

- `getRageClicks()`

### How it is calculated

The backend groups `rage_click` events by:

- page path
- CSS selector

For each group it returns:

- incidents = number of rage-click events
- total clicks = sum of `properties.count`
- first seen / last seen timestamps

This is useful for spotting broken or misleading UI elements.

### Rage click detection logic

The tracking script detects rage clicks client-side before sending an event:

1. Every click records a timestamp for the clicked element's CSS selector
2. If **3 or more clicks** on the **same selector** occur within **1000 ms**, a `rage_click` event fires
3. A 5-second cooldown prevents the same element from triggering multiple consecutive events
4. `properties.count` holds the number of rapid clicks in the burst

## Time on Page tab

### Backend source

- `getTimeOnPage()`

### Filtering rules

Only `time_on_page` events are counted where:

- seconds > 0
- seconds < 3600

This avoids zero noise and extreme outliers.

### Per-page metrics

For each page the backend calculates:

- average time = `AVG(seconds)`
- median time = `PERCENTILE_CONT(0.5)`
- minimum / maximum time
- sample count

## Term Glossary

| Term | Definition |
|------|------------|
| **Scroll Depth** | How far down a page a visitor scrolled, expressed as a percentage of total page height. Measured at fixed milestones (25/50/75/100%). |
| **Avg Scroll Depth** | Average `properties.depth` across all `scroll_depth` milestone events for the selected site and date range. |
| **Click Heatmap** | A record of every click event on the site, stored with the CSS selector of the clicked element and its relative position on the page. |
| **Rage Click** | 3 or more rapid clicks on the same element within 1 second. Indicates user frustration — usually a broken link, unresponsive button, or confusing UI. |
| **Rage Click Incidents** | Count of `rage_click` events (each event = one rage-click burst detected by the tracking script). |
| **Time on Page** | How long a visitor spent on a page, derived from `time_on_page` events where `properties.seconds` is between 1 and 3600. |
| **Milestone** | A fixed scroll depth threshold (25%, 50%, 75%, 100%) at which the tracking script fires a `scroll_depth` event. Each milestone fires once per page load. |
| **Selector** | A CSS selector string identifying the clicked element (e.g. `button.cta`, `a#signup`). Used to group rage clicks and heatmap data. |
| **p75 / Median** | Statistical aggregates used in time-on-page to show typical visit duration without being skewed by outliers. |
- min time
- max time
- sample count

## Notes

- Scroll and heatmap metrics depend on the tracking script emitting the right engagement events.
- Time on Page here is based on tracked dwell events, which is different from session duration on the Dashboard or Content pages.