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
8. **Update `docs/` after completing any feature.** If a feature has a doc file in `docs/` (e.g. `docs/sql-editor.md`, `docs/custom-dashboards.md`), update it to reflect the current implementation state. If no doc exists for a significant new feature, create one.
9. **Port every change to all three copies.** The product lives in `apps/` (this repo), `appsv2/` (this repo), and the sibling `traffic/` repo — keep them byte-identical after every feature (mapping: `dashboard-web ⇄ analytics-dashboard`, `analytics-api ⇄ analytics-db`). Sync procedure: `.claude/skills/insighttrack/references/workflows.md`.

## Project Skill

The canonical project knowledge lives in the **`insighttrack` skill** at
`.claude/skills/insighttrack/SKILL.md` (auto-discovered by Claude Code): repo
layout map, architecture, coding patterns, workflows, and the three-copy sync
procedure. Read it before non-trivial work. Usage & maintenance guide:
`docs/claude-skill.md`.

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

One skill holds all project knowledge — `.claude/skills/insighttrack/` (see `.claude/README.md`):
- `SKILL.md` — layout map, invariants, canonical patterns, commands
- `references/architecture.md` — request lifecycle, sync engine, hot/cold storage, AI/MCP
- `references/patterns.md` — implementation examples per layer + testing conventions
- `references/workflows.md` — feature workflow, debugging, three-copy sync procedure
- `references/review-security.md` — code/PR review checklists, threat model, OWASP audit

When the skill and the code disagree, the code wins — fix the skill in the same change.

## Feature Docs

Implementation guides are in `docs/`:
- `docs/sql-editor.md` — SQL Editor feature guide (API, security model, schema)
- `docs/custom-dashboards.md` — Custom Dashboard builder (data model, widget catalogue, grid layout)
- `docs/reporting-studio.md` — Reporting Studio & export architecture
- `docs/hot-cold-analytics-architecture.md` — DuckDB hot+cold data layer
- `docs/pg-duckdb-sync.md` — PostgreSQL → DuckDB sync pipeline
- `docs/ai-analyst.md` — Pulse (AI analyst) user guide (in-panel use, BYO key, Claude Desktop/MCP setup)
- `docs/mcp-toolkit.md` — MCP toolkit architecture & build phases (registry, assistant service, MCP server)

