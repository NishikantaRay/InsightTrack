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

## Nginx Reverse Proxy

If serving both frontend and API under the same domain:

```nginx
server {
    listen 80;
    server_name analytics.yourdomain.com;

    # Frontend
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
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Tracking script (no caching)
    location /api/sites/ {
        proxy_pass http://127.0.0.1:3001;
        add_header Cache-Control "no-cache, no-store";
    }
}
```

## SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d analytics.yourdomain.com
```

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

## Security Checklist

- [ ] Change `JWT_SECRET` to a random 64+ character string
- [ ] Set `CORS_ORIGINS` to your actual domain only
- [ ] Enable HTTPS (SSL/TLS)
- [ ] Use a firewall to restrict database port (5432) access
- [ ] Set strong PostgreSQL password
- [ ] Run Node.js as a non-root user
- [ ] Enable rate limiting (already configured)
- [ ] Set up log rotation for server logs
