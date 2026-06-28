<div align="center">

# 📊 InsightsTrack

### Self-hosted, privacy-first web analytics — the open-source alternative to Google Analytics

[![Open Source](https://img.shields.io/badge/Open%20Source-MIT-6366f1)](LICENSE)
[![Self-Hosted](https://img.shields.io/badge/Self--Hosted-✓-10b981)]()
[![No Cookies](https://img.shields.io/badge/Cookies-0-ef4444)]()
[![Stack](https://img.shields.io/badge/React%2018%20·%20Express%204%20·%20PostgreSQL%20·%20DuckDB-1a1d27)]()
[![Sponsor](https://img.shields.io/badge/♥%20Sponsor-NishikantaRay-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/NishikantaRay)

**Track visitors, pageviews, conversions, heatmaps, and Core Web Vitals — all on your own server.**
No cookies, no consent banners, no data selling. Deploy in under 15 minutes.

[Live Demo](#-live-demo) · [Quick Start](#-quick-start) · [Features](#-feature-walkthrough) · [Deploy](#-deploy-your-own) · [Docs](docs/)

![InsightsTrack Dashboard](screenshots/11-dashboard-full.png)

</div>

---

## What is InsightsTrack?

InsightsTrack is a complete, production-grade web analytics platform you run yourself. It gives you the depth of Google Analytics 4 — real-time visitors, traffic sources, funnels, heatmaps, Web Vitals — without sending a single byte of your visitors' data to a third party.

**Why teams choose it:**

- 🔒 **Privacy by design** — no cookies, no fingerprinting, anonymous visitor IDs, GDPR-compliant, DNT/GPC honored.
- ⚡ **Fast at any scale** — a dual-database design (PostgreSQL for writes, DuckDB for reads) answers 90-day queries in under 100 ms even over millions of events.
- 🧩 **Everything in one place** — 17 analytics pages: dashboard, pages, realtime, funnels, heatmaps, engagement, performance, audience, acquisition, conversions, user flow, reporting studio, SQL editor, and more.
- 🪶 **Lightweight** — a single ~2 KB `<script>` tag, works with any site (WordPress, Next.js, Shopify, plain HTML…).
- 👥 **Team-ready** — invite teammates, assign roles, build custom permission roles, and control which pages each member sees.
- 💸 **Free forever** — MIT licensed, self-hosted, no seat limits.

### How it works

```
┌──────────────┐   POST /api/track/*    ┌──────────────────────────────┐
│  Your website│──────────────────────▶ │  Backend API (Express, :3001)│
│  (2 KB tag)  │                        │                              │
└──────────────┘                        │  ┌──────────┐   ┌──────────┐ │
                                        │  │ Postgres │──▶│  DuckDB  │ │
┌──────────────┐  GET /api/analytics/*  │  │ (writes) │sync│ (reads)  │ │
│  Dashboard   │◀────────────────────── │  └──────────┘   └──────────┘ │
│  React SPA   │                        └──────────────────────────────┘
└──────────────┘
```

All **writes** (tracking events, auth, sites) go to **PostgreSQL**. A background sync streams them into **DuckDB**, an embedded columnar engine that powers every **analytics read** 10–100× faster than a row store. The dashboard never queries PostgreSQL directly.

---

## 🎬 Live Demo

The landing page ships a **live demo instance** so anyone can explore the full product with realistic sample data before installing anything.

| | |
|---|---|
| ![Landing hero](screenshots/02-landing-hero.png) | ![Landing dark](screenshots/07-landing-dark.png) |
| **Landing page** — open-source banner, live demo notice, and clear CTAs. | **Light & dark mode** — the whole site (and app) supports both. |

**Two paths from the landing page:**

1. **Open live dashboard** → log in or sign up → you're dropped straight into a dashboard pre-loaded with demo data (the `hello.com` sample site). Great for evaluating features.
2. **Set up your own instance** → sign up for a fresh account → onboarding walks you through adding your first site and tracking script.

> Want demo data on your own instance? Run `node scripts/seed-live-demo.js` (see [Seeding demo data](#seeding-demo-data)).

---

## 🚀 Quick Start

The fastest way to run the whole stack (PostgreSQL + API + dashboard + a demo site) is Docker.

### Prerequisites
- **Docker** & **Docker Compose** (recommended), or **Node.js 20+** + **PostgreSQL 16** for manual setup.

### One command (Docker)

```bash
git clone https://github.com/NishikantaRay/InsightTrack.git
cd InsightTrack

cp .env.example .env          # fill in passwords / secrets
docker-compose up --build -d
```

| Service | URL |
|---------|-----|
| 📊 Dashboard | http://localhost:4173 |
| 🔌 Backend API | http://localhost:3001 |
| 🌐 Demo site (sample tracked page) | http://localhost:8080 |
| 🗄️ pgAdmin (DB browser) | http://localhost:5050 |

Open the dashboard, register an account, and you're live.

### Add tracking to your website

After creating a site in **Settings**, paste this once into your site's `<head>`:

```html
<script src="http://localhost:3001/api/sites/YOUR_SITE_ID/script"></script>
```

Pageviews, sessions, clicks, scroll depth, Web Vitals, JS errors, and heatmap data start flowing immediately — no extra configuration.

> Full local walkthrough: [docs/running-locally.md](docs/running-locally.md)

---

## ✨ Feature Walkthrough

### Dashboard
![Dashboard](screenshots/11-dashboard-full.png)

The home view: KPI cards (visitors, pageviews, bounce rate, avg. session) with trends and sparklines, traffic & pageviews charts, top pages, traffic sources donut, devices, countries leaderboard, the conversion funnel, and a live world map — all for the selected date range, auto-refreshing.

### Real-time
![Realtime](screenshots/17-realtime.png)

Live visitor count, active pages, an interactive world map of current visitors, and a device breakdown — refreshing every few seconds.

### Visual Heatmap
![Heatmap](screenshots/30-heatmap-full.png)

Click-density dots overlaid on a live preview of any tracked page — indigo (rare) → red (hottest). A Click Distribution table ranks every element by clicks and unique users. Filter by device, cluster nearby clicks, and export to CSV.

### Engagement & Performance

| ![Engagement](screenshots/27-engagement-full.png) | ![Performance](screenshots/32-performance-full.png) |
|---|---|
| **Engagement** — scroll-depth milestones (25/50/75/100%), rage-click detection, and time-on-page behaviour. | **Performance** — Core Web Vitals (LCP, FID, CLS, INP, TTFB) scored against Google thresholds, plus a JS error log with trend chart. |

### Funnels & Conversions

| ![Funnels](screenshots/16-funnels.png) | ![Conversions](screenshots/40-conversions.png) |
|---|---|
| **Funnels** — define multi-step journeys and see exact drop-off between stages. | **Conversions** — track goals and conversion rates over time. |

### Audience, Acquisition & Pages

| ![Audience](screenshots/36-audience.png) | ![Acquisition](screenshots/37-acquisition.png) |
|---|---|
| **Audience** — devices, browsers, OS, countries, returning vs. new. | **Acquisition** — traffic sources, referrers, and UTM campaign breakdown. |

![Pages](screenshots/15-pages-view.png)
**Pages** — every tracked URL with views, unique visitors, and % of total. Sortable, filterable, CSV/JSON export.

### Reporting Studio & SQL Editor

| ![Reporting](screenshots/38-reporting.png) | ![SQL Editor](screenshots/39-sql-editor.png) |
|---|---|
| **Reporting Studio** — drag-and-drop custom dashboards, scheduled email reports, shareable links. | **SQL Editor** — run read-only DuckDB queries directly against your analytics data, with schema browser and saved queries. |

### User Flow & Dark Mode

| ![User Flow](screenshots/18-user-flow.png) | ![Dark mode](screenshots/25-dashboard-dark-mode.png) |
|---|---|
| **User Flow** — how visitors move between pages, entry → transitions → exits. | **Dark mode** — full app theming, system-preference aware. |

### Team, Settings & Profile

| ![Settings](screenshots/19-settings.png) | ![Profile](screenshots/20-profile.png) |
|---|---|
| **Settings** — manage multiple sites, copy the tracking script, configure traffic-spike alerts. | **Profile** — General, Security, **Team** (invite members, custom roles), and per-member Feature Manager. |

> Team access, custom roles, and the live-demo join flow are documented in [docs/team-access.md](docs/team-access.md).

---

## 🛳️ Deploy Your Own

InsightsTrack ships two interchangeable app layouts:

- **`apps/`** — the stable layout. PostgreSQL + DuckDB in one backend. Best default.
- **`appsv2/`** — the hot/cold layout. DuckDB **hot tier** (RAM, last 30 days) + **cold Parquet** on S3/R2 for very large datasets. See [docs/hot-cold-analytics-architecture.md](docs/hot-cold-analytics-architecture.md).

![Deploy section](screenshots/35-landing-deploy.png)

### Docker (fastest)

```bash
git clone https://github.com/NishikantaRay/InsightTrack.git
cd InsightTrack
cp .env.example .env
docker-compose up --build -d            # apps/ stack
# or, for the hot/cold build:
docker-compose -f docker-compose.v2.yml up --build -d
```

### Manual — `apps/`

```bash
# Backend
cd apps/analytics-api
cp .env.example .env        # set DATABASE_URL, JWT_SECRET, APP_BASE_URL
npm install && npm run migrate && npm run init && npm start   # :3001

# Frontend
cd ../dashboard-web
npm install && npm run build && npm run preview               # :4173
```

### Manual — `appsv2/` (hot/cold + S3/R2)

```bash
cd appsv2/analytics-api
cp .env.example .env        # add S3_*/R2_* vars to enable cold storage
npm install && npm run migrate && npm run init && npm start   # :3001

cd ../dashboard-web
npm install && npm run build && npm run preview               # :4173
```

### Cloud (Railway / Render + Vercel / Cloudflare Pages)

- **Backend** → Railway or Render. Add a PostgreSQL plugin (sets `DATABASE_URL`), set Root Dir to `apps/analytics-api`, Start command `npm run migrate && npm run init && npm start`, and attach a volume at `/data` for the DuckDB file.
- **Frontend** → Vercel, Cloudflare Pages, or Netlify. Root Dir `apps/dashboard-web`, build `npm run build`, output `dist`, and set `VITE_API_URL` to your backend URL.

Full production guide (Nginx, SSL, backups, env vars): [docs/deployment.md](docs/deployment.md)

### Seeding demo data

Populate any instance with realistic sample data so the "Open live dashboard" CTA works:

```bash
# Local
node scripts/seed-live-demo.js

# Against a remote backend (e.g. Railway)
EVENTS=10000 API=https://your-backend.up.railway.app node scripts/seed-live-demo.js
```

Then set on the backend: `DEMO_SITE_DOMAIN=hello.com` and `APP_BASE_URL=https://your-dashboard-url`.

---

## 🔑 Key Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `DATABASE_URL` | `postgresql://…@localhost:5432/analytics` | PostgreSQL connection string |
| `JWT_SECRET` | _(set in production)_ | Secret for signing JWTs (≥ 32 random bytes) |
| `APP_BASE_URL` | `http://localhost:4173` | Frontend URL for team invite links |
| `DEMO_SITE_DOMAIN` | `hello.com` | Domain of the public demo site for the "Open live dashboard" CTA |
| `DUCKDB_PATH` | `duckdb/analytics.duckdb` | Path to the DuckDB file (use a volume in production) |
| `DUCKDB_POOL_SIZE` | `4` | DuckDB connection pool size |
| `SYNC_DEBOUNCE_MS` | `5000` | Debounce window before PG→DuckDB sync after a tracking event |
| `CORS_ORIGINS` | `localhost:4173,…` | Comma-separated allowed origins |
| `HOT_DAYS` _(appsv2)_ | `30` | Days kept in the DuckDB hot tier before archiving to Parquet |

The `appsv2/` layout adds `S3_*`/`R2_*` variables to enable cold storage — see its `.env.example`.

---

## 🗂️ Project Structure

```
InsightsTrack/
├── apps/                          # Stable layout (default)
│   ├── analytics-api/             # Express + PostgreSQL + DuckDB
│   │   └── src/{db,routes,services,queries,sync,schema}/
│   └── dashboard-web/             # React 18 + Vite + Tailwind dashboard
├── appsv2/                        # Hot/cold layout (DuckDB hot + S3/R2 Parquet)
│   ├── analytics-api/
│   └── dashboard-web/
├── examples/                      # Demo sites with the tracking script
├── scripts/                       # seed-live-demo.js, benchmarks, helpers
├── screenshots/                   # Product screenshots used in this README
├── docs/                          # Full documentation
├── docker-compose.yml             # apps/ full stack
└── docker-compose.v2.yml          # appsv2/ full stack
```

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS 3, Recharts, Zustand, React Router 6 |
| Backend | Node.js 20, Express 4 |
| Write DB | PostgreSQL 16 — tracking events, auth, sites, teams |
| Read DB | DuckDB (embedded columnar) — analytics queries |
| Cold storage _(appsv2)_ | Parquet on AWS S3 / Cloudflare R2 / MinIO |
| Auth | JWT (7-day expiry), bcrypt |
| Caching | In-memory TTL cache + request coalescing |
| Testing | Vitest, Supertest, Playwright |

---

## 🔌 API Overview

| Group | Key Endpoints | DB |
|-------|---------------|-----|
| **Auth** | `POST /api/auth/register` · `/login` · `GET /api/auth/me` | PostgreSQL |
| **Sites** | `GET/POST /api/sites` · `GET /api/sites/:id/script` | PostgreSQL |
| **Tracking** | `POST /api/track/event` · `/pageview` · `/batch` · `GET /api/track/pixel.gif` | PostgreSQL |
| **Analytics** | `/api/analytics/:siteId/{kpi,traffic,top-pages,sources,devices,countries,realtime,user-flow,funnel,…}` | DuckDB |
| **Engagement** | `/engagement/{scroll-depth,rage-clicks,heatmap,time-on-page}` | DuckDB |
| **Performance** | `/performance/{web-vitals,errors,errors-over-time}` | DuckDB |
| **Team** | `/api/team/:siteId/{members,invite,roles}` · `/api/demo/join` | PostgreSQL |

All analytics endpoints accept `?dateRange=today|7d|30d|90d|custom:YYYY-MM-DD:YYYY-MM-DD`.
Full reference: [docs/api-reference.md](docs/api-reference.md)

---

## 📚 Documentation

| Document | What's inside |
|----------|---------------|
| [Getting Started](docs/getting-started.md) | Setup from scratch |
| [Running Locally](docs/running-locally.md) | Detailed local dev walkthrough |
| [Deployment](docs/deployment.md) | Production: Docker, Nginx, SSL, Railway, appsv2 |
| [Tracking Script](docs/tracking-script.md) | How tracking works, SPA support, custom events |
| [API Reference](docs/api-reference.md) | Full REST API with examples |
| [Architecture](docs/architecture.md) | System design & data flow |
| [Hot+Cold Architecture](docs/hot-cold-analytics-architecture.md) | DuckDB hot (30d) + Parquet cold layer |
| [PG→DuckDB Sync](docs/pg-duckdb-sync.md) | The sync pipeline (keyset cursor, idempotency) |
| [Team Access](docs/team-access.md) | Multi-user, custom roles, live-demo flow |
| [Visual Heatmap](docs/heatmap.md) | Heatmap feature deep-dive |
| [SQL Editor](docs/sql-editor.md) · [Custom Dashboards](docs/custom-dashboards.md) · [Reporting Studio](docs/reporting-studio.md) | Feature guides |

---

## Running Tests

```bash
cd apps/analytics-api && npm test          # backend (Vitest + Supertest)
cd apps/dashboard-web && npm test          # frontend unit tests
cd apps/dashboard-web && npx playwright test  # end-to-end
```

---

## ❤️ Support

InsightsTrack is free and open source. If it's useful to you, please consider
**[sponsoring on GitHub](https://github.com/sponsors/NishikantaRay)** — it directly
funds new features, maintenance, and keeping the project free for everyone.

<a href="https://github.com/sponsors/NishikantaRay">
  <img src="https://img.shields.io/badge/Sponsor%20on%20GitHub-♥-ea4aaa?style=for-the-badge&logo=githubsponsors" alt="Sponsor NishikantaRay" />
</a>

<!-- On GitHub this renders the live Sponsor button: -->
<iframe src="https://github.com/sponsors/NishikantaRay/button" title="Sponsor NishikantaRay" height="32" width="114" style="border: 0; border-radius: 6px;"></iframe>

A ⭐ on the repo also helps a lot!

---

## License

[MIT](LICENSE) — free to self-host, modify, and run forever.
