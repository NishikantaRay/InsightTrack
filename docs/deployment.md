# Deployment Guide

This guide covers deploying InsightTrack to a production environment.

## Environment Variables

### Backend (`apps/analytics-api/.env`)

```env
PORT=3001
DATABASE_URL=postgresql://analytics:STRONG_PASSWORD@localhost:5432/analytics_db
JWT_SECRET=your-strong-random-secret-here
CORS_ORIGINS=https://yourdomain.com
DUCKDB_PATH=./duckdb/analytics.duckdb
```

> **Important**: Change `JWT_SECRET` to a strong, random value in production. You can generate one with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

## Production Build

### Frontend

```bash
cd apps/dashboard-web
npm run build
```

This outputs static files to `dist/`. Serve them with any static file server (Nginx, Caddy, Vercel, etc).

### Backend

```bash
cd apps/analytics-api

# First-time setup
npm run migrate        # Create PostgreSQL tables
npm run init           # Create DuckDB tables

# Start the server
node src/index.js
```

Use a process manager like **PM2** for reliability:

```bash
npm install -g pm2
pm2 start src/index.js --name insighttrack-api
pm2 save
pm2 startup
```

### DuckDB Sync (Production)

Schedule automatic sync from PostgreSQL to DuckDB using cron:

```bash
# Sync every 5 minutes
*/5 * * * * cd /path/to/apps/analytics-api && node src/scripts/sync.js >> /var/log/insighttrack-sync.log 2>&1
```

> **Important**: DuckDB supports only one process at a time. The sync script opens and closes DuckDB quickly, so brief overlaps with the running server are handled by retry logic. For zero-downtime sync, consider stopping the server briefly or implementing a file lock.

## Deploying the `appsv2/` (hot/cold) layout

The repo ships two interchangeable app layouts. Everything above targets the
stable `apps/` layout. The `appsv2/` layout is identical to operate but adds a
**hot (RAM) + cold (S3/R2 Parquet)** tier for very large datasets — see
[hot-cold-analytics-architecture.md](hot-cold-analytics-architecture.md).

```bash
# Backend
cd appsv2/analytics-api
cp .env.example .env        # add S3_*/R2_* vars to enable cold storage
npm install
npm run migrate && npm run init && npm start   # :3001

# Frontend
cd ../dashboard-web
npm install && npm run build && npm run preview # :4173
```

For Docker, use the v2 compose file from the repo root:

```bash
docker-compose -f docker-compose.v2.yml up --build -d
```

Both layouts read the same `DEMO_SITE_DOMAIN` and `APP_BASE_URL` env vars, so the
live-demo flow and team invites work identically. Pick one layout per
deployment — they share the same PostgreSQL schema but maintain separate DuckDB
files.

## Docker Compose (Full Stack)

Create a `docker-compose.yml` in the project root:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: analytics
      POSTGRES_PASSWORD: analytics123
      POSTGRES_DB: analytics_db
    volumes:
      - pg_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    build: ./apps/analytics-api
    environment:
      DATABASE_URL: postgresql://analytics:analytics123@postgres:5432/analytics_db
      JWT_SECRET: change-this-in-production
      CORS_ORIGINS: http://localhost
      DUCKDB_PATH: /data/analytics.duckdb
      PORT: 3001
    volumes:
      - duckdb_data:/data
    ports:
      - "3001:3001"
    depends_on:
      - postgres

  dashboard:
    build: ./apps/dashboard-web
    ports:
      - "80:80"
    depends_on:
      - api

volumes:
  pg_data:
  duckdb_data:
```

> See [docker-setup.md](./docker-setup.md) for detailed Docker management, volume persistence, and troubleshooting.

## HTTPS / TLS

**Every production deployment must terminate TLS.** Tokens, tracking payloads,
and analytics data must never travel over plain HTTP. Two recommended options:

### Option A — Caddy (simplest, automatic HTTPS)

Caddy provisions and renews Let's Encrypt certificates automatically. Point an
`A`/`AAAA` DNS record at your server, then:

```caddy
# /etc/caddy/Caddyfile
analytics.yourdomain.com {
    encode gzip

    # API + tracking script → backend
    handle /api/* {
        reverse_proxy 127.0.0.1:3001
    }

    # Dashboard SPA (static build) → serve dist with SPA fallback
    handle {
        root * /var/www/insighttrack/dist
        try_files {path} /index.html
        file_server
    }
}
```

```bash
sudo caddy reload --config /etc/caddy/Caddyfile
# Caddy obtains + renews the cert with zero extra steps.
```

### Option B — Nginx + Let's Encrypt

```nginx
server {
    listen 80;
    server_name analytics.yourdomain.com;
    return 301 https://$host$request_uri;        # force HTTPS
}

server {
    listen 443 ssl http2;
    server_name analytics.yourdomain.com;

    # certbot fills in ssl_certificate / ssl_certificate_key below
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    # Dashboard SPA
    location / {
        root /var/www/insighttrack/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # backend trusts this for HTTPS
    }

    # Tracking script (no caching)
    location /api/sites/ {
        proxy_pass http://127.0.0.1:3001;
        add_header Cache-Control "no-cache, no-store";
    }
}
```

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d analytics.yourdomain.com   # installs + auto-renews the cert
```

> **Managed platforms** (Railway, Render, Vercel, Cloudflare Pages, Fly.io)
> provision HTTPS for you — no proxy needed. Just make sure `CORS_ORIGINS` and
> `APP_BASE_URL` use the `https://` URLs they assign.

## Database Backups

Schedule daily backups:

```bash
# backup.sh
pg_dump -U analytics analytics_db | gzip > /backups/analytics_$(date +%Y%m%d).sql.gz
```

Add to crontab:
```
0 2 * * * /path/to/backup.sh
```

## Data Aggregation Cron

Pre-compute daily statistics for faster dashboard loading:

```bash
# Run daily at 1 AM
0 1 * * * cd /path/to/apps/analytics-api && node src/scripts/aggregate.js
```

## DuckDB Backup

Back up the DuckDB file alongside PostgreSQL:

```bash
# backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d)
pg_dump -U analytics analytics_db | gzip > /backups/pg_${DATE}.sql.gz
cp /path/to/apps/analytics-api/duckdb/analytics.duckdb /backups/duckdb_${DATE}.duckdb
```

## Pre-Launch Security Checklist

Start from [`.env.production.example`](../.env.production.example) and fill in
every secret. Verify each item below before exposing the instance publicly.

### 🔴 Critical (must do)

- [ ] **`JWT_SECRET`** set to a random 32+ byte value.
      Generate: `openssl rand -base64 48`.
      The API **refuses to start** in production without it — good, but you must set it.
- [ ] **`CORS_ORIGINS`** = your real dashboard origin(s) only, `https://`, no
      localhost, no trailing slash. e.g. `CORS_ORIGINS=https://analytics.yourdomain.com`.
- [ ] **HTTPS/TLS enabled** for both the dashboard and the API (see above).
- [ ] **Strong `POSTGRES_PASSWORD`** (`openssl rand -base64 48`) and strong
      `PGADMIN_DEFAULT_PASSWORD` — or don't expose pgAdmin at all.
- [ ] **Demo account hardened** — if you seed demo data, use a throwaway
      `DEMO_EMAIL` and let `scripts/seed-live-demo.js` auto-generate a strong
      `DEMO_PASS` (it refuses weak passwords on remote hosts). Never seed with
      a personal/admin email + a trivial password.
- [ ] **`APP_BASE_URL`** set to the `https://` dashboard URL (invite + demo links).

### 🟠 Important

- [ ] Restrict the PostgreSQL port (5432) with a firewall / private network —
      don't publish it on the host in production (`docker-compose` exposes it for
      local dev; remove that port mapping or bind to `127.0.0.1`).
- [ ] Persist data on volumes: `DUCKDB_PATH=/data/analytics.duckdb` on a mounted
      volume, plus the `pgdata` volume.
- [ ] Run Node.js as a non-root user.
- [ ] Set up automated backups (see below) and verify a restore.
- [ ] Log rotation + an error monitor (e.g. Sentry); confirm no stack traces
      leak (the API uses a `safeError` utility in production).

### ✅ Already configured in code

- Rate limiting (`express-rate-limit`), security headers (`helmet`), parameterised
  SQL everywhere, JWT auth on all non-public routes, and production error
  sanitisation are built in — no action needed beyond keeping them enabled.

### Quick verification

```bash
# Secrets are set and not the placeholder defaults:
grep -E 'JWT_SECRET|POSTGRES_PASSWORD|CORS_ORIGINS' .env

# API rejects a disallowed origin (should NOT echo it back in CORS headers):
curl -s -I -H "Origin: https://evil.example" https://analytics.yourdomain.com/api/health \
  | grep -i access-control-allow-origin

# HTTPS is enforced (HTTP should 301 → https):
curl -s -o /dev/null -w '%{http_code}\n' http://analytics.yourdomain.com/api/health
```
