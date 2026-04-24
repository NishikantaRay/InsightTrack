# Docker Setup — InsightTrack Analytics

Run the full analytics stack (UI, Backend, PostgreSQL, pgAdmin) with a single command using Docker Compose.

---

## Services

| Service     | URL                     | Description                        |
|-------------|-------------------------|------------------------------------|
| **UI**      | http://localhost:4173   | React analytics dashboard (nginx)  |
| **Backend** | http://localhost:3001   | Node.js API server (Express)       |
| **Database**| localhost:5432          | PostgreSQL 15                      |
| **pgAdmin** | http://localhost:5050   | Web-based PostgreSQL GUI           |

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed

### Run everything

```bash
docker-compose up --build
```

This will:
1. Start PostgreSQL and wait until it's healthy
2. Start the backend (connects to PostgreSQL)
3. Start the UI (nginx serves frontend + proxies `/api` to backend)
4. Start pgAdmin (web GUI for database)

### Run in background (detached)

```bash
docker-compose up --build -d
```

### Stop all services

```bash
docker-compose down
```

### Stop and remove all data (volumes)

```bash
docker-compose down -v
```

---

## Service Details

### UI (`apps/dashboard-web`)

- Built with React + Vite
- Served via nginx with:
  - Static file serving for the SPA
  - Reverse proxy: `/api/*` → backend on port 3001
- Port: **4173**

### Backend (`apps/analytics-api`)

- Node.js / Express unified backend
- Connects to PostgreSQL using these env vars:
  - `PG_HOST=db`
  - `PG_PORT=5432`
  - `PG_USER=trafficuser`
  - `PG_PASSWORD=trafficpass`
  - `PG_DATABASE=analytics`
- Port: **3001**
- Health check: http://localhost:3001/health

> Canonical build paths live under grouped folders: `apps/analytics-api`, `apps/dashboard-web`, and `examples/demo-site`.

### Database (PostgreSQL)

- Image: `postgres:15-alpine`
- Database name: `analytics`
- Credentials: `trafficuser` / `trafficpass`
- Data is persisted in a Docker volume (`pgdata`)
- Port: **5432**

---

## Using pgAdmin (Database GUI)

pgAdmin is a web-based tool for browsing and managing your PostgreSQL database — similar to MongoDB Compass.

### Step 1: Open pgAdmin

Go to http://localhost:5050 in your browser.

### Step 2: Log in

| Field    | Value              |
|----------|--------------------|
| Email    | `admin@admin.com`  |
| Password | `admin`            |

### Step 3: Add the database server

1. In the left sidebar, right-click **Servers** → **Register** → **Server...**
2. In the **General** tab:
   - **Name**: `traffic` (or any name you prefer)
3. In the **Connection** tab:

   | Field              | Value          |
   |--------------------|----------------|
   | Host name/address  | `db`           |
   | Port               | `5432`         |
   | Maintenance DB     | `analytics`    |
   | Username           | `trafficuser`  |
   | Password           | `trafficpass`  |

4. Check **Save password** and click **Save**

### Step 4: Browse your data

1. Expand: **Servers** → **traffic** → **Databases** → **analytics** → **Schemas** → **public** → **Tables**
2. Right-click any table → **View/Edit Data** → **All Rows**
3. You can also run custom SQL: **Tools** → **Query Tool**

### Common tables

| Table      | Description                          |
|------------|--------------------------------------|
| `sites`    | Registered websites being tracked    |
| `events`   | Page views, clicks, and other events |
| `users`    | User accounts for the dashboard      |

---

## Useful Commands

```bash
# View logs for a specific service
docker-compose logs -f backend
docker-compose logs -f ui
docker-compose logs -f db

# Rebuild a single service
docker-compose build backend
docker-compose up -d backend
docker-compose up --build -d
# Check running containers
docker-compose ps

# Access PostgreSQL CLI directly
docker-compose exec db psql -U trafficuser -d analytics

# Run a quick SQL query
docker-compose exec db psql -U trafficuser -d analytics -c "SELECT * FROM sites;"
```

---

## Troubleshooting

| Problem                          | Solution                                                      |
|----------------------------------|---------------------------------------------------------------|
| Backend crashes with ECONNREFUSED| DB not ready yet — healthcheck ensures this doesn't happen    |
| UI shows blank page              | Check `docker-compose logs ui` for build errors               |
| pgAdmin can't connect to DB      | Use `db` as the hostname (not `localhost`)                    |
| Port already in use              | Stop local PostgreSQL/services or change ports in compose     |
| Want a fresh start               | `docker-compose down -v` removes all data and volumes         |
