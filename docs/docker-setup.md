# Docker Setup Guide

Complete guide for running InsightTrack's database infrastructure with Docker.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Node.js v18+ (for the application layer)

---

## PostgreSQL Container

InsightTrack uses PostgreSQL as the primary transactional database (OLTP). All writes — event tracking, session management, user auth, site CRUD — go to PostgreSQL.

### Start PostgreSQL

```bash
docker run -d \
  --name analytics-pg \
  -e POSTGRES_USER=analytics \
  -e POSTGRES_PASSWORD=analytics123 \
  -e POSTGRES_DB=analytics_db \
  -p 5432:5432 \
  postgres:16-alpine
```

| Flag | Purpose |
|------|---------|
| `-d` | Run in background (detached) |
| `--name analytics-pg` | Container name for easy reference |
| `-e POSTGRES_USER` | Database superuser name |
| `-e POSTGRES_PASSWORD` | Database password |
| `-e POSTGRES_DB` | Default database to create |
| `-p 5432:5432` | Map container port to host port |
| `postgres:16-alpine` | Lightweight PostgreSQL 16 image (~80MB) |

### Verify It's Running

```bash
# Check container status
docker ps | grep analytics-pg

# Test the connection
docker exec analytics-pg pg_isready -U analytics
# Output: /var/run/postgresql:5432 - accepting connections
```

### Common Docker Commands

```bash
# Stop the container
docker stop analytics-pg

# Start a stopped container
docker start analytics-pg

# View logs
docker logs analytics-pg

# Follow logs in real-time
docker logs -f analytics-pg

# Connect to psql shell
docker exec -it analytics-pg psql -U analytics -d analytics_db

# Check row counts
docker exec analytics-pg psql -U analytics -d analytics_db \
  -c "SELECT 'events' as tbl, COUNT(*) FROM events UNION ALL 
      SELECT 'sessions', COUNT(*) FROM sessions UNION ALL 
      SELECT 'sites', COUNT(*) FROM sites;"

# Remove container (destroys data!)
docker rm -f analytics-pg
```

### Data Persistence with Volumes

By default, data is lost when the container is removed. To persist data across container restarts:

```bash
docker run -d \
  --name analytics-pg \
  -e POSTGRES_USER=analytics \
  -e POSTGRES_PASSWORD=analytics123 \
  -e POSTGRES_DB=analytics_db \
  -v analytics_pgdata:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:16-alpine
```

The `-v analytics_pgdata:/var/lib/postgresql/data` flag creates a Docker named volume that persists even if the container is removed.

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect analytics_pgdata

# Remove volume (WARNING: deletes all data)
docker volume rm analytics_pgdata
```

---

## DuckDB (Embedded — No Docker Needed)

DuckDB runs **in-process** alongside the Node.js backend. There is no separate server or container.

The database file lives at:
```
apps/analytics-api/duckdb/analytics.duckdb
```

### Why No Docker for DuckDB?

| Aspect | Docker Container | Embedded (Current) |
|--------|------------------|--------------------|
| Latency | Network round-trip | Zero (in-process) |
| Setup | Extra container | Just a file |
| Resources | Separate memory | Shares Node.js memory |
| Backup | Volume management | Copy the `.duckdb` file |
| Scaling | Container orchestration | Move file to bigger machine |

DuckDB's embedded nature is one of its key advantages — it eliminates network overhead and simplifies deployment.

### DuckDB File Management

```bash
# Initialize DuckDB (creates tables)
cd apps/analytics-api
npm run init

# The database file
ls -lh duckdb/analytics.duckdb

# Delete and recreate (fresh start)
rm -f duckdb/analytics.duckdb duckdb/analytics.duckdb.wal
npm run init

# Backup DuckDB
cp duckdb/analytics.duckdb duckdb/analytics.duckdb.backup
```

---

## Full Fresh Start (Clean Slate)

When you want to start everything from absolute zero:

```bash
# 1. Remove existing Docker container (if any)
docker rm -f analytics-pg 2>/dev/null

# 2. Start fresh PostgreSQL
docker run -d \
  --name analytics-pg \
  -e POSTGRES_USER=analytics \
  -e POSTGRES_PASSWORD=analytics123 \
  -e POSTGRES_DB=analytics_db \
  -p 5432:5432 \
  postgres:16-alpine

# 3. Wait for PostgreSQL to be ready
sleep 3
docker exec analytics-pg pg_isready -U analytics

# 4. Go to backend directory
cd apps/analytics-api

# 5. Create tables in PostgreSQL
npm run migrate

# 6. Seed sample data (~92K events, ~36K sessions)
npm run seed

# 7. Delete old DuckDB file
rm -f duckdb/analytics.duckdb duckdb/analytics.duckdb.wal

# 8. Create DuckDB tables
npm run init

# 9. Sync PostgreSQL → DuckDB
npm run sync

# 10. Start the backend server
npm start
```

---

## Docker Compose (Production Setup)

For production, use Docker Compose to orchestrate PostgreSQL with data persistence:

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: analytics-pg
    restart: unless-stopped
    environment:
      POSTGRES_USER: analytics
      POSTGRES_PASSWORD: ${PG_PASSWORD:-analytics123}
      POSTGRES_DB: analytics_db
    volumes:
      - pg_data:/var/lib/postgresql/data
    ports:
      - "${PG_PORT:-5432}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U analytics"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pg_data:
    driver: local
```

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Stop and delete data
docker compose down -v
```

---

## Troubleshooting

### Port 5432 Already in Use

```bash
# Find what's using the port
lsof -ti :5432

# Kill the process
lsof -ti :5432 | xargs kill -9

# Or use a different port
docker run -d --name analytics-pg \
  -e POSTGRES_USER=analytics \
  -e POSTGRES_PASSWORD=analytics123 \
  -e POSTGRES_DB=analytics_db \
  -p 5433:5432 \
  postgres:16-alpine

# Update .env
# PG_PORT=5433
```

### Container Won't Start

```bash
# Check logs for errors
docker logs analytics-pg

# Common issues:
# - Port conflict: change the host port (-p 5433:5432)
# - Volume permissions: remove the volume and recreate
# - Image not found: docker pull postgres:16-alpine
```

### Connection Refused from Node.js

```bash
# Verify container is running
docker ps | grep analytics-pg

# Verify PostgreSQL is accepting connections
docker exec analytics-pg pg_isready -U analytics

# Check your .env file matches the Docker config
cat apps/analytics-api/.env | grep PG_
```

### DuckDB Single-Process Lock

DuckDB only allows **one process** to access the database file at a time. If you see:

```
Error: Connection was never established or has been closed already
```

This means another process (likely the server) is holding the DuckDB file lock.

**Solution:** Stop the server before running sync or init scripts:
```bash
# Stop server → sync → restart server
lsof -ti :3001 | xargs kill -9
npm run sync
npm start
```
