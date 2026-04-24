# CLAUDE.md — InsightTrack Project Instructions

> This file is read automatically by Claude when working on this project.

## Project

InsightTrack — self-hosted web analytics platform with a dual-database architecture.

- **PostgreSQL**: All writes (tracking events, auth, site management)
- **DuckDB**: All analytics reads (10-100× faster OLAP queries)
- **React 18 + Vite 5**: Dashboard SPA with Zustand, Tailwind CSS, Recharts
- **Express 4 + Node.js 20**: API backend with JWT auth

## Critical Rules

1. **NEVER use string interpolation in SQL queries.** Always use parameterized queries (`$1` for PG, `?` for DuckDB).
2. **Writes go to PostgreSQL only.** Never insert/update/delete in DuckDB directly.
3. **Analytics reads go to DuckDB only.** Don't query PG for dashboard data.
4. **All API routes need `authenticateToken` middleware** except tracking (`/api/track/*`) and auth (`/api/auth/login`, `/api/auth/register`).
5. **ES modules only.** Use `import/export`, never `require()`.
6. **All new UI must support dark mode** via Tailwind `dark:` variants.
7. **Use `useAnalytics` hook for data fetching** in React components, not raw `useEffect` + axios.

## Package Structure

```
apps/dashboard-web/            → Frontend (React, Vite, port 4173)
apps/analytics-api/            → Unified backend (Express + PostgreSQL + DuckDB)
archive/analytics-api-legacy/  → Legacy backend kept for reference
examples/demo-blog/            → Demo site with tracking script
examples/demo-website/         → Demo site with tracking script
marketing/landing-page/        → Marketing landing page
design/pencil-new.pen          → Pencil design source
docs/                          → Documentation
```

Use the grouped paths above as the only supported working locations for ongoing development and deployment.

## Quick Commands

```bash
# Dev
cd apps/dashboard-web && npm run dev
cd apps/analytics-api && npm start

# Test
cd apps/dashboard-web && npm test
cd apps/analytics-api && npm test
cd apps/dashboard-web && npx playwright test

# Docker
docker-compose up --build
docker-compose down -v

# DB
cd apps/analytics-api && npm run migrate && npm run seed && npm run init
```

## Skills

Detailed skill files are in `.claude/skills/`:
- `code-review.md` — Code review checklist and patterns
- `pr-review.md` — PR review process and templates
- `coding-guidelines.md` — Coding conventions and patterns
- `security-audit.md` — OWASP security audit checklist
- `debugging.md` — Debugging decision trees and commands
- `feature-development.md` — Feature development workflow
- `testing.md` — Testing conventions and examples
