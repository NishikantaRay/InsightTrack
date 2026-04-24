# Audience

## What this page does

The Audience page explains **who** visits the site and **how often they come back**.

It has three tabs:

- New vs Returning
- Cohort Analysis
- Visitor Segments

## New vs Returning

### What it shows

This tab compares first-time and repeat visitors over the selected period.

### Backend source

- `getNewVsReturning()`

### How it is calculated

This tab works from the `sessions` table, not raw events.

Per day, it counts:

- `new_visitors` = sessions where `is_returning = false` or `NULL`
- `returning_visitors` = sessions where `is_returning = true`
- `total_sessions` = all sessions

### Summary percentages

The summary cards use:

$$
\text{New %} = \frac{\text{New Sessions}}{\text{Total Sessions}} \times 100
$$

$$
\text{Returning %} = \frac{\text{Returning Sessions}}{\text{Total Sessions}} \times 100
$$

Important: these percentages are based on **sessions**, not distinct people.

## Cohort Analysis

### What it shows

This tab answers: after a user first appears, how many return on later days?

### Backend source

- `getCohortAnalysis()`

### How cohorts are formed

For each `user_id`, the backend finds the earliest event date in the selected period:

- `MIN(timestamp)` → `cohort_date`

That date becomes the user’s cohort.

### How retention is calculated

For each cohort, the system measures how many distinct users were active on these offsets:

- day 0
- day 1
- day 3
- day 7
- day 14
- day 30

Retention rate is:

$$
\text{Retention Rate} = \frac{\text{Users Active on Day N}}{\text{Cohort Size}} \times 100
$$

Rounded to one decimal place.

### Important caveat

Because cohorts are built from first activity **inside the selected range**, this is a range-scoped cohort view, not a lifetime cohort model.

## Visitor Segments

### What it shows

This tab lets users filter traffic by:

- device
- browser
- country
- UTM source

It then shows summary totals and category breakdowns.

### Backend source

- `getVisitorSegments()`

### Summary calculations

After applying the selected filters, the backend returns:

- visitors = `COUNT(DISTINCT user_id)`
- events = `COUNT(*)`
- pageviews = `COUNT(*)` where `type = 'pageview'`

### Breakdown calculations

Each breakdown groups the filtered event set by one dimension:

- devices → grouped by `device`
- countries → grouped by `country`
- browsers → grouped by `browser`
- sources → grouped by `utm_source` with `Direct` fallback

### UI note

The bars in the segment lists are scaled relative to the largest category in that list. They are visual normalization bars, not absolute percentages.

## Notes

Audience is best used with a broader date range. Very short ranges can make cohort and returning-visitor metrics look artificially small.