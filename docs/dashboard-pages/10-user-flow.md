# User Flow

## What this page does

The User Flow page explains how visitors move from page to page.

It is used to answer:

- what are the most common navigation paths?
- where do users tend to enter?
- where do they tend to leave?

The page renders a `UserFlowChart` based on transition data.

## Backend source

- `getUserFlow()`

## How transitions are calculated

The backend looks at `pageview` events inside each session and orders them by timestamp.

It uses SQL window logic:

- `LEAD(path) OVER (PARTITION BY session_id ORDER BY timestamp)`

That creates a "next page" for every pageview in a session.

The system then counts each `from_page -> to_page` pair.

### Transition count

For each pair:

- `transitions = COUNT(*)`

Only rows with a non-null next page are included.

The result is a ranked list of the most common page-to-page transitions.

## Entry pages

The same endpoint also returns entry pages from the `sessions` table.

Calculated as:

- group by `entry_page`
- value = `COUNT(*)`

This shows where sessions most often start.

## Exit pages

Exit pages are also taken from the `sessions` table.

Calculated as:

- group by `exit_page`
- value = `COUNT(*)`

This shows where sessions most often end.

## Limits

The current query limits:

- top transitions → 20
- top entry pages → 10
- top exit pages → 10

So this page is intentionally focused on the strongest movement patterns, not the full long tail.

## Notes

- Flow is session-based because page ordering only makes sense inside a session.
- This page explains navigation structure, not conversion quality. Pair it with Funnels and Content for broader interpretation.