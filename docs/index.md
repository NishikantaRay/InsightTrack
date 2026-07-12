# InsightTrack Documentation Index

Start here. Docs are grouped by what you're trying to do.

## Getting started

| Doc | What it covers |
|-----|----------------|
| [getting-started.md](getting-started.md) | From-scratch setup: PG in Docker, migrate/seed/init, dev servers |
| [running-locally.md](running-locally.md) | Day-to-day local development |
| [docker-setup.md](docker-setup.md) | Full-stack docker-compose deployment |
| [contributing.md](contributing.md) | Branching, code style, PR workflow |
| [faq.md](faq.md) | FAQ & troubleshooting |

## Architecture

| Doc | What it covers |
|-----|----------------|
| [architecture.md](architecture.md) | System overview (see also `diagrams/`) |
| [backend-architecture.md](backend-architecture.md) | Express API, services, routes |
| [frontend-structure.md](frontend-structure.md) | React app layout, stores, hooks |
| [pg-duckdb-sync.md](pg-duckdb-sync.md) | PostgreSQL → DuckDB sync pipeline |
| [hot-cold-analytics-architecture.md](hot-cold-analytics-architecture.md) | DuckDB hot tables + Parquet cold data lake |
| [performance-architecture.md](performance-architecture.md) | Performance design notes |
| [duckdb-guide.md](duckdb-guide.md) | DuckDB usage and query layer |
| [caching.md](caching.md) | Coalesced analytics cache & TTLs |
| [post-caching-struggles.md](post-caching-struggles.md) | War story: cache pitfalls & fixes |
| [security.md](security.md) | Auth, CORS, rate limiting, error hygiene |

## Features

| Doc | What it covers |
|-----|----------------|
| [features.md](features.md) | Feature overview |
| [tracking-script.md](tracking-script.md) | The embeddable tracker & event payloads |
| [geoip-tracking.md](geoip-tracking.md) | GeoIP resolution |
| [sql-editor.md](sql-editor.md) | SQL Editor (API, security model, schema) |
| [custom-dashboards.md](custom-dashboards.md) | Dashboard builder (widgets, grid layout) |
| [reporting-studio.md](reporting-studio.md) | Reporting Studio & exports |
| [ai-analyst.md](ai-analyst.md) | Pulse — the AI analyst (in-panel use, BYO key, MCP clients) |
| [mcp-toolkit.md](mcp-toolkit.md) | MCP toolkit architecture & build phases |
| [mcp-improvement-plan.md](mcp-improvement-plan.md) | MCP/AI Analyst audit findings & prioritized improvement roadmap |
| [team-access.md](team-access.md) | Multi-user sites, roles, invites |
| [heatmap.md](heatmap.md) | Heatmap page |
| [engagement.md](engagement.md) | Engagement metrics |
| [dashboard-pages/](dashboard-pages/) | Per-page dashboard guides |
| [blogs/](blogs/) | Public blog content |

## Reference & operations

| Doc | What it covers |
|-----|----------------|
| [api-reference.md](api-reference.md) | REST API reference |
| [testing.md](testing.md) | Test strategy: Vitest, Testing Library, Playwright |
| [README.md](README.md) | Passmark AI test suite (`appsv2/passmark-tests/`) |
| [deployment.md](deployment.md) | Production deployment notes |
| [claude-skill.md](claude-skill.md) | The `insighttrack` Claude Code skill: usage & maintenance |
| [posthog-gap-analysis.md](posthog-gap-analysis.md) | Feature comparison vs PostHog + prioritized roadmap of gaps |

## For AI-assisted development

`CLAUDE.md` (repo root) holds the always-loaded critical rules; the full
project skill lives at `.claude/skills/insighttrack/SKILL.md` with deep-dive
references. Keep both — and this index — updated when features land, and
mirror doc changes across the three copies (`apps/`, `appsv2/`, and the
sibling `traffic/` repo).
