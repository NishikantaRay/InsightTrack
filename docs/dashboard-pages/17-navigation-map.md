# Dashboard Navigation Map

## Sidebar pages

The current sidebar in `apps/dashboard-web/src/components/layout/Sidebar.jsx` exposes these primary pages:

1. Dashboard
2. Pages
3. Funnels
4. Conversions
5. Audience
6. Content
7. Acquisition
8. Performance
9. Realtime
10. User Flow
11. Engagement
12. Reporting
13. Privacy
14. Settings
15. Docs

## Additional protected route

There is also a protected route for:

- Profile

This route exists in `App.jsx` even though it is not currently listed in the sidebar menu.

## Why this file exists

This file helps future maintainers distinguish between:

- pages visible in the left navigation
- protected pages that still exist in routing

That matters when updating docs, screenshots, onboarding guides, or QA test coverage.