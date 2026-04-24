# InsightTrack — Self-Hosted Web Analytics

A privacy-friendly, self-hosted web analytics platform. Track visitors, pageviews, sessions, conversions, and user flows — all on your own infrastructure. No cookies, no third-party data sharing.

**Dual-database architecture**: PostgreSQL handles writes (tracking, auth, sites) while DuckDB — an embedded columnar OLAP engine — powers analytics reads at 10-100× the speed of traditional row-store queries.

---

## Screenshots

### Landing Page

| | |
|---|---|
| ![Landing Page Hero](screenshots/02-landing-hero.png) | ![Landing Features](screenshots/03-landing-features.png) |
| **Hero** — Headline, tagline, and primary CTAs ("Start Tracking Free", "See How It Works") with a live dashboard preview mockup. | **Features Grid** — Six feature highlights: Real-Time Analytics, Privacy-First, Lightweight Script, Country Detection, Conversion Funnels, and Multi-Site Support. |
| ![How It Works](screenshots/04-landing-how-it-works.png) | ![Tech Stack](screenshots/05-landing-tech-stack.png) |
| **How It Works** — 3-step onboarding guide (Create Account → Add Script → View Dashboard) with a live code snippet example. | **Tech Stack** — Cards for React 18, Express, PG+DuckDB, JWT Auth, Open Source, Auto Sync, plus an inline architecture diagram. |
| ![Comparison Table](screenshots/06-landing-comparison.png) | ![Footer & CTA](screenshots/07-landing-footer.png) |
| **Comparison Table** — Side-by-side feature comparison between InsightTrack and Google Analytics across 9 dimensions. | **Footer & CTA** — Final call-to-action banner ("Create Free Account") and the site footer with navigation links. |

<details>
<summary>View full landing page</summary>

![Full Landing Page](screenshots/01-landing-full.png)

</details>

---

### Authentication

| ![Login](screenshots/08-login.png) | ![Register](screenshots/09-register.png) |
|---|---|
| **Login** — Split-panel layout with branding on the left and the sign-in form (email, password, toggle visibility) on the right. | **Register** — Split-panel registration form with name, email, password, confirm password, and real-time password strength validation. |

---

### Onboarding

![Onboarding](screenshots/10-onboarding.png)

**Onboarding Wizard** — Two-step flow: Step 1 lets users enter a website name and domain; Step 2 provides the ready-to-paste tracking `<script>` snippet with a one-click copy button.

---

### Dashboard

![Dashboard Full](screenshots/11-dashboard-full.png)

**Main Dashboard** — The primary analytics view. Displays KPI metric cards at the top, followed by stacked chart rows covering traffic trends, top pages, traffic sources, devices, sessions, countries, and funnels.

| | |
|---|---|
| ![KPI Cards](screenshots/12-dashboard-kpi-cards.png) | ![Charts](screenshots/13-dashboard-charts.png) |
| **KPI Cards** — Four headline metrics (Total Visitors, Pageviews, Bounce Rate, Avg. Session) each with a trend indicator, percentage change vs. the previous period, and a sparkline mini-chart. | **Traffic & Pageviews Charts** — Line charts showing visitor and pageview trends over the selected date range with hover tooltips and comparison mode support. |
| ![Bottom Section](screenshots/14-dashboard-bottom.png) | ![Dark Mode](screenshots/25-dashboard-dark-mode.png) |
| **Countries & Funnels** — Country leaderboard with flag emojis and percentage bars alongside the conversion funnel drop-off chart. | **Dark Mode** — Full dashboard in dark theme. Toggle via the moon/sun icon in the navbar or auto-detected from system preferences. |

---

### Pages View

![Pages View](screenshots/15-pages-view.png)

**Top Pages** — Sortable table listing every tracked URL with Views, Unique Visitors, and % of Total traffic columns. Supports date range filtering and CSV/JSON export.

---

### Funnels

![Funnels](screenshots/16-funnels.png)

**Conversion Funnels** — Define multi-step user journeys (e.g., Landing → Signup → Checkout) and visualise the exact percentage drop-off between each stage.

---

### Realtime

![Realtime](screenshots/17-realtime.png)

**Real-Time Analytics** — Live visitor count with a pulsing activity indicator, an interactive world map pinpointing active visitor locations, a list of currently active pages, and a device-type breakdown — all auto-refreshing every 5 seconds.

---

### User Flow

![User Flow](screenshots/18-user-flow.png)

**User Flow** — Sankey-style flow diagram showing how visitors navigate between pages: entry points on the left, subsequent page transitions in the middle, and exit pages on the right.

---

### Settings

![Settings](screenshots/19-settings.png)

**Settings** — Multi-site management panel to add, rename, and delete tracked sites. Includes the ready-to-copy tracking script snippet and the Traffic Alerts panel for configuring anomaly detection thresholds.

---

### Profile

![Profile](screenshots/20-profile.png)

**User Profile** — Three-tab settings area: **General** (update name, email, role, timezone), **Security** (change password, view and revoke active sessions), and **Notifications** (toggle traffic alerts, weekly reports, goal completions, and uptime monitoring).

---

### Documentation

| ![Docs Full](screenshots/21-docs-full.png) | ![API Reference](screenshots/22-docs-api-reference.png) |
|---|---|
| **Documentation Home** — In-app docs page with collapsible sections covering Architecture overview, Quick Start guide, Tracking Script reference, Database Schema, Data Sync mechanism, Cache TTL table, Dashboard pages, and Tech Stack. | **API Reference** — Expanded API Reference section listing all 34 endpoints across four groups (Analytics, Tracking, Sites, Auth) with HTTP method badges, paths, parameters, and example responses. |

---

### Navigation Components

| ![Sidebar](screenshots/23-sidebar.png) | ![Navbar](screenshots/24-navbar.png) |
|---|---|
| **Sidebar** — Collapsible left navigation with icons and labels for Dashboard, Pages, Funnels, Realtime, User Flow, Settings, and Docs. Active route is highlighted. | **Navbar** — Top bar with the site selector dropdown (switch between tracked sites), a date range filter, a refresh button, notification bell, dark-mode toggle, and user avatar menu. |

---

## Features

- **Dashboard** — KPI cards with sparklines, traffic charts, comparison mode
- **Top Pages** — Most visited pages with pageview trends
- **Traffic Sources** — Direct, search, social, referral breakdown + UTM campaigns
- **Devices & Countries** — Device type donut chart, country leaderboard with flags
- **Conversion Funnels** — Define multi-step funnels and track drop-off
- **User Flow** — Visualize how visitors navigate between pages
- **Real-time** — Live visitor count, active pages, interactive world map
- **Traffic Alerts** — Automatic anomaly detection for spikes and drops
- **Multi-site** — Manage multiple websites from one dashboard
- **Dark Mode** — System preference detection + manual toggle
- **Export** — CSV, JSON, PNG export for all charts + print support
- **Authentication** — JWT-based login/registration with bcrypt passwords
- **Privacy-first** — No cookies, anonymous user IDs, timezone-based country detection

## Quick Start

### Prerequisites

- **Node.js** v18+
- **Docker** (for PostgreSQL)

### 1. Start PostgreSQL

```bash
docker run -d \
  --name analytics-pg \
  -e POSTGRES_USER=analytics \
  -e POSTGRES_PASSWORD=analytics123 \
  -e POSTGRES_DB=analytics_db \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Start the API Server

```bash
cd apps/analytics-api
npm install

# First-time setup: create tables, seed data, initialize DuckDB
npm run migrate        # Create PostgreSQL tables
npm run seed           # Generate sample data
npm run init           # Create DuckDB tables
npm run sync           # Sync PostgreSQL → DuckDB

# Start the server
npm start
```

Server starts at `http://localhost:3001`. Health check: `curl http://localhost:3001/api/health`.

### 3. Start the Dashboard

```bash
cd apps/dashboard-web
npm install
npm run dev
```

Open `http://localhost:5173` — register an account and start tracking.

### 4. Add Tracking to Your Website

After creating a site in **Settings**, add this to your website's `<head>`:

```html
<script src="http://localhost:3001/api/sites/YOUR_SITE_ID/script"></script>
```

Pageviews, sessions, clicks, and device data start flowing immediately.

> For the full step-by-step walkthrough, see [docs/running-locally.md](docs/running-locally.md).

## Architecture

```
┌──────────────┐    POST /api/track/*    ┌──────────────────────────────┐
│  Your Website│───────────────────────▶│  Unified Backend (port 3001) │
│  (tracking)  │                        │  Express + Node.js           │
└──────────────┘                        │                              │
                                        │  ┌─────────┐  ┌──────────┐ │
┌──────────────┐   GET /api/analytics/* │  │  PG     │  │ DuckDB   │ │
│  Dashboard   │◀──────────────────────│  │ (writes)│  │ (reads)  │ │
│  React SPA   │                        │  └────┬────┘  └─────▲────┘ │
│  port: 5173  │                        │       │     sync    │      │
└──────────────┘                        │       └─────────────┘      │
                                        └──────────────────────────────┘
```

## Project Structure

```
insighttrack/
├── apps/
│   ├── dashboard-web/            # Frontend (React + Vite + Tailwind)
│   │   └── src/
│   │       ├── components/       # Recharts visualization components
│   │       ├── hooks/            # useAnalytics data-fetching hook
│   │       ├── pages/            # Dashboard views, auth, settings, docs
│   │       ├── services/         # Axios API client with auth interceptors
│   │       ├── store/            # Zustand stores
│   │       └── utils/            # Formatters, export helpers
│   └── analytics-api/            # Unified backend (Express + PostgreSQL + DuckDB)
│       ├── src/
│       │   ├── db/               # PostgreSQL pool + DuckDB connection
│       │   ├── middleware/       # JWT auth middleware
│       │   ├── routes/           # auth, analytics, tracking, sites
│       │   ├── services/         # Business logic, cache, auth
│       │   ├── queries/          # DuckDB analytical query functions
│       │   └── scripts/          # Migration, seed, DuckDB init, sync
│       ├── duckdb/               # DuckDB database file (auto-created)
│       └── tests/                # Vitest + Supertest test suite
├── archive/
│   └── analytics-api-legacy/     # Previous backend retained for reference
├── examples/
│   ├── demo-blog/                # Demo content site with tracking script
│   ├── demo-site/                # Docker-served demo site used by compose
│   └── demo-website/             # Sample static website with tracking
├── marketing/
│   └── landing-page/             # Marketing / launch page assets
├── design/
│   └── pencil-new.pen            # Pencil design working file
├── docs/                         # Project documentation
│   ├── getting-started.md        # Step-by-step setup guide
│   ├── running-locally.md        # Detailed local development guide
│   ├── tracking-script.md        # Tracking script usage & customization
│   ├── api-reference.md          # Full REST API documentation
│   ├── architecture.md           # System design & data flow
│   ├── backend-architecture.md   # Unified backend deep-dive
│   ├── docker-setup.md           # Docker & PostgreSQL setup
│   ├── duckdb-guide.md           # DuckDB analytics engine guide
│   └── deployment.md             # Production deployment guide
├── scripts/                      # Utility scripts (Docker checks, helpers)
├── screenshots/                  # Product screenshots used in docs/README
└── README.md
```

The grouped structure above is the canonical project layout. Use those paths for all new work, automation, and deployment configuration.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS 3, Recharts, Zustand, React Router 6 |
| Backend | Node.js, Express 4 |
| Write DB | PostgreSQL 16 (Docker) — tracking events, auth, sites |
| Read DB | DuckDB (embedded) — analytics queries, 10-100× faster aggregations |
| Auth | JWT (7-day expiry), bcrypt (12 rounds) |
| Caching | In-memory TTL cache (10s realtime → 120s general) |
| Testing | Vitest, Supertest |
| Icons | Lucide React |
| HTTP | Axios |

## API Overview

| Group | Key Endpoints | Database |
|-------|---------------|----------|
| **Auth** | `POST /api/auth/register`, `/login`, `GET /api/auth/me` | PostgreSQL |
| **Sites** | `GET /api/sites`, `POST /api/sites`, `GET /api/sites/:id/script` | PostgreSQL |
| **Analytics** | `/api/analytics/:siteId/kpi`, `/traffic`, `/top-pages`, `/sources`, `/devices`, `/countries`, `/realtime`, `/user-flow`, `/funnel`, `/alerts`, `/comparison`, `/all` | DuckDB |
| **Tracking** | `POST /api/track/event`, `/pageview`, `/session`, `/batch`, `GET /api/track/pixel.gif` | PostgreSQL |

All analytics endpoints accept `?dateRange=today|7d|30d|90d|custom:YYYY-MM-DD:YYYY-MM-DD`.

See [docs/api-reference.md](docs/api-reference.md) for full details.

## Running Tests

```bash
cd apps/analytics-api
npm test
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `DATABASE_URL` | `postgresql://analytics:analytics123@localhost:5432/analytics_db` | PostgreSQL connection string |
| `JWT_SECRET` | (built-in default) | Secret for signing JWT tokens — **change in production** |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:8080` | Comma-separated allowed origins |
| `DUCKDB_PATH` | `./duckdb/analytics.duckdb` | Path to DuckDB database file |

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Step-by-step setup from scratch |
| [Running Locally](docs/running-locally.md) | Detailed local development walkthrough |
| [Tracking Script](docs/tracking-script.md) | How tracking works, SPA support, custom events |
| [API Reference](docs/api-reference.md) | Full REST API documentation with examples |
| [Architecture](docs/architecture.md) | System design, data flow, database schema |
| [Backend Architecture](docs/backend-architecture.md) | Unified backend deep-dive (routes, caching, security) |
| [Docker Setup](docs/docker-setup.md) | Docker & PostgreSQL container management |
| [DuckDB Guide](docs/duckdb-guide.md) | DuckDB analytics engine, sync, queries |
| [Deployment](docs/deployment.md) | Production deployment with Docker, Nginx, SSL |

## License

MIT
