# Getting Started with InsightTrack

InsightTrack is a self-hosted web analytics platform with a dual-database architecture: PostgreSQL for writes and DuckDB for fast analytics reads. This guide walks you through setting up everything from scratch.

## Prerequisites

- **Node.js** v18 or later
- **Docker** (for PostgreSQL)
- **npm** (comes with Node.js)

## 1. Start the Database

Run PostgreSQL 16 in a Docker container:

```bash
docker run -d \
  --name analytics-pg \
  -e POSTGRES_USER=analytics \
  -e POSTGRES_PASSWORD=analytics123 \
  -e POSTGRES_DB=analytics_db \
  -p 5432:5432 \
  postgres:16-alpine
```

Verify it's running:

```bash
docker ps | grep analytics-pg
```

> For advanced Docker options (volumes, docker-compose, troubleshooting), see [docker-setup.md](./docker-setup.md).

## 2. Start the Backend Server

```bash
cd apps/analytics-api
npm install
```

**First-time setup** — create tables, generate sample data, and initialize DuckDB:

```bash
npm run migrate        # Create PostgreSQL tables
npm run seed           # Generate sample data (~90K events, ~36K sessions)
npm run init           # Create DuckDB tables (7 tables)
npm run sync           # Sync PostgreSQL data → DuckDB
```

**Start the server:**

```bash
npm start
```

The server will:
- Connect to PostgreSQL on `localhost:5432`
- Open DuckDB at `./duckdb/analytics.duckdb`
- Start listening on `http://localhost:3001`

To verify, run:

```bash
curl http://localhost:3001/api/health
```

You should see `{"status":"ok"}`.

## 3. Start the Frontend Dashboard

```bash
cd apps/dashboard-web
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## 4. Create Your Account

1. Open the dashboard — you'll be redirected to the **Register** page
2. Enter your name, email, and password (min 6 characters)
3. Click **Create Account**
4. You'll be logged in and redirected to the main dashboard

## 5. Add Your First Website

1. Navigate to **Settings** from the sidebar
2. Under **Site Manager**, enter your website name and domain
3. Click **Add Site**
4. You'll see a tracking snippet — copy it and paste it into the `<head>` tag of your website

```html
<script src="http://localhost:3001/api/sites/YOUR_SITE_ID/script"></script>
```

Or use the inline HTML snippet provided in Settings.

## 6. Start Tracking

Once the script is on your website, data will flow automatically:
- **Pageviews** are tracked on every page load
- **Sessions** are managed automatically
- **Clicks**, **device info**, **country**, and **referrer** are all captured
- The dashboard updates as events come in

> **Note**: New tracking data goes into PostgreSQL. Run `npm run sync` (or schedule a cron job) to update DuckDB with the latest data for analytics queries.

## What's Next?

- [Running Locally](./running-locally.md) — detailed step-by-step with expected outputs
- [Tracking Script Guide](./tracking-script.md) — customize the tracking behavior
- [API Reference](./api-reference.md) — integrate with the REST API
- [Backend Architecture](./backend-architecture.md) — understand the dual-database design
- [DuckDB Guide](./duckdb-guide.md) — DuckDB analytics engine deep-dive
- [Docker Setup](./docker-setup.md) — Docker container management
- [Deployment Guide](./deployment.md) — deploy to production

---

## 🚀 New in 2026: Real-Time Map & Event Stream

- Live visitor map with interactive world view (react-leaflet, OpenStreetMap tiles)
- Real-time event stream: see pageviews, clicks, and custom events as they happen
- Modern choropleth map style, dark mode, and mobile support

![Realtime Map](../screenshots/17-realtime.png)

---
