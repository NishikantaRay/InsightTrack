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

Only `scroll_depth` events are used where:

- `properties.milestone = true`

For each page, the backend counts how many events reached at least:

- 25%
- 50%
- 75%
- 100%

It also calculates:

- `avgDepth = AVG(properties.depth)`

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
- min time
- max time
- sample count

## Notes

- Scroll and heatmap metrics depend on the tracking script emitting the right engagement events.
- Time on Page here is based on tracked dwell events, which is different from session duration on the Dashboard or Content pages.