# Docs Reference

## What this page does

The Docs page is an in-app technical reference for InsightTrack.

It is essentially a product handbook rendered inside the dashboard. It documents:

- architecture overview
- quick start steps
- deployment guidance
- API endpoints
- tracking events
- dashboard pages
- database schema
- PG → DuckDB sync behavior
- cache TTLs
- privacy notes
- tech stack

## How it is built

This page is mostly static frontend content.

It is assembled from constant arrays and UI components inside:

- `apps/dashboard-web/src/pages/Documentation.jsx`

Examples of the embedded static data structures include:

- `apiEndpoints`
- `dbTables`
- `trackingEvents`
- `dashboardPages`

## Calculation behavior

There are no live analytics calculations on this page.

Any counts shown on the page, such as:

- number of endpoints
- number of dashboard views
- number of database tables

are derived from static array lengths in the frontend code, not from backend queries.

For example:

- total endpoint count is the sum of all `routes.length` values across endpoint groups
- dashboard view count comes from the number of entries in the `dashboardPages` array

## Why this page matters

This page is useful for:

- onboarding developers
- sharing architecture internally
- understanding product capabilities without leaving the app

But it should not be treated as the single source of truth for calculations unless it is actively kept in sync with backend query logic.

## Notes

Because it is static, it can drift from implementation if developers update the product but forget to update the docs page.