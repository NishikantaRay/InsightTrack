# Privacy

## What this page does

The Privacy page explains product privacy behavior and lets the user manage data retention.

It has two tabs:

- Privacy Features
- Data Retention

This page is mostly policy/configuration oriented rather than metric oriented.

## Privacy Features tab

### What it shows

This tab is static explanatory content describing the product’s privacy posture.

It highlights:

- Do Not Track support
- Global Privacy Control support
- no third-party cookies
- self-hosted data ownership
- lightweight tracking behavior
- GDPR-oriented notes

### Calculation behavior

There are no computed analytics metrics on this tab.

It is descriptive product documentation rendered in-app.

## Data Retention tab

### What it does

This tab lets the user:

- fetch the current retention policy
- change retention days
- enable/disable cleanup
- trigger cleanup manually

### Data source

- `reportingAPI.getRetention(siteId)`
- `reportingAPI.upsertRetention(siteId, { retention_days, enabled })`
- `reportingAPI.runCleanup(siteId)`

### How retention configuration works

The UI stores two meaningful values:

- `retention_days`
- `enabled`

The page offers fixed retention presets:

- 30 days
- 90 days
- 180 days
- 365 days
- 730 days

### How cleanup works

The page itself does not calculate which rows are expired.

Instead, it calls the backend cleanup API, which is responsible for deleting old data. The UI then reports the backend result, such as how many events or sessions were removed.

## Important privacy notes reflected in the app

The in-app copy states several implementation assumptions:

- no cookies are used for tracking
- IDs are anonymous and local
- country is inferred without storing IP addresses
- data stays on self-hosted infrastructure

These are product promises that should stay aligned with the tracking script and backend implementation.

## Notes

This page is best thought of as a control panel plus compliance explainer, not an analytics page.