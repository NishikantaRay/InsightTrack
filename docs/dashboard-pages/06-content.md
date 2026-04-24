# Content

## What this page does

The Content page explains how users enter, leave, and search through the site.

It has three tabs:

- Entry Pages
- Exit Pages
- Site Search

## Entry Pages

### What it shows

This tab identifies the pages where sessions begin.

### Backend source

- `getEntryPages()`

### How it is calculated

The backend groups the `sessions` table by `entry_page`.

For each entry page it returns:

- `entries` = total sessions that started on that page
- `uniqueUsers` = `COUNT(DISTINCT user_id)`
- `bounces` = sessions where `is_bounce = true`
- `avgSessionDuration` = `AVG(duration)`

### Entry page percentage

$$
\text{Entry %} = \frac{\text{Entries for Page}}{\text{All Returned Entries}} \times 100
$$

Rounded to one decimal place.

### Entry page bounce rate

$$
\text{Bounce Rate} = \frac{\text{Bounces}}{\text{Entries}} \times 100
$$

Rounded to one decimal place.

## Exit Pages

### What it shows

This tab identifies the pages where sessions most often end.

### Backend source

- `getExitPages()`

### How it is calculated

The backend groups the `sessions` table by `exit_page`.

For each exit page it returns:

- exits
- unique users
- average session duration
- share of total exits

### Exit page percentage

$$
\text{Exit %} = \frac{\text{Exits for Page}}{\text{All Returned Exits}} \times 100
$$

Rounded to one decimal place.

## Site Search

### What it shows

This tab lists onsite search terms captured by tracking.

### Backend source

- `getSiteSearchQueries()`

### How it is calculated

The backend queries `events` where:

- `type = 'site_search'`

It groups by:

- extracted search query from `properties.query`
- page path

For each row it returns:

- `searches` = count of matching search events
- `uniqueUsers` = distinct searching users
- `page` = where the search happened

## Notes

- Entry/Exit tabs are session-based, not event-based.
- Site Search requires the tracking script to capture search form submissions or search events.
- The average duration shown in Entry/Exit is session duration, not page dwell time. For read time, use the Engagement page.