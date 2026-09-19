# Realtime

## What this page does

The Realtime page shows who is active on the site **right now**.

It is designed for operational monitoring, launch checks, and campaign watch sessions.

It shows:

- active visitor count
- active pages
- device mix
- country list / live map input
- a live event stream

## Refresh behavior

This page uses dedicated hooks (`useRealtime()`, `useRealtimeEventStream()`)
because it reads different endpoints, but both refresh on the same **60-second**
cadence as the generic analytics hook.

They previously polled at 15s and 10s. The realtime backend caches its results
with a 10s TTL, so the faster polling mostly re-fetched figures the server had
not recomputed — it cost several times the requests without making the page
any fresher. Note the rolling window below: this page summarises the last 5
minutes, so a 60s refresh still shows genuinely live activity.

## Backend sources

- `getRealTimeVisitors()`
- `getRealtimeEventStream()`

## Time window used

The realtime backend uses a rolling **last 5 minutes** window.

The code computes:

- `fiveMinAgo = now - 5 minutes`

Every realtime metric is filtered to events newer than that timestamp.

## Active visitors

Calculated as:

- `COUNT(DISTINCT user_id)` from `events` in the last 5 minutes

This is why the page subtitle says "visitors in the last 5 minutes".

## Active pages

Calculated from `pageview` events in the last 5 minutes:

- grouped by `path`
- value = `COUNT(DISTINCT user_id)` per path

So the number shown is active unique visitors per page, not raw pageview hits.

## Device breakdown

Calculated by grouping last-5-minute events by `device` and counting distinct users.

Empty or null device values are normalized to `Desktop`.

## Country list / visitor map input

Calculated by grouping last-5-minute events by `country` and counting distinct users.

Empty or null countries are normalized to `Unknown`.

## Live event stream

The live event stream returns the latest events in the last 5 minutes.

- ordered by `timestamp DESC`
- limited to 50 events

Each event includes contextual fields such as:

- type
- path
- URL
- referrer
- device
- browser
- OS
- country
- session ID
- UTM fields

## Notes

- Realtime visibility depends on recent traffic; with no activity in the last 5 minutes, the page will appear empty.
- This page is unique-user oriented in most places, which is useful for live audience visibility but may differ from raw event volume.