# Debugging Skill — InsightTrack

You are an expert debugger for the InsightTrack analytics platform. Use systematic approaches to diagnose issues across the full stack.

## Debugging Decision Tree

### "Dashboard shows no data"
1. Check browser Network tab — is the API call reaching the server?
2. Check JWT token — is the user authenticated? (`localStorage.getItem('analytics-token')`)
3. Check siteId — is a valid site selected? (`useSiteStore.getState().siteId`)
4. Check date range — does the range have data? Try `?dateRange=30d`
5. Check DuckDB — run a direct query: `SELECT COUNT(*) FROM events WHERE site_id = ?`
6. Check sync — is PG→DuckDB sync running? Look at server logs for sync interval messages
7. Check PG — `SELECT COUNT(*) FROM events WHERE site_id = ?` in PostgreSQL

### "Tracking not working"
1. Check tracking script is loaded: browser console → `Network` tab, look for `analytics.js`
2. Check script config: `data-site-id` attribute present and correct
3. Check CORS: server must allow the website's origin
4. Check tracking endpoint: `POST /api/track/event` returns 200/201
5. Check rate limiting: not hitting limits on tracking endpoints
6. Verify in DB: `SELECT * FROM events ORDER BY timestamp DESC LIMIT 5`

### "Auth issues"
1. JWT expired? Decode token at jwt.io (dev only), check `exp` claim
2. Login failing? Check password hash: `bcrypt.compare(password, hash)`
3. 401 on API calls? Check `Authorization: Bearer <token>` header
4. After restart? Check JWT_SECRET is consistent (same env var)

### "Docker issues"
1. `docker-compose logs <service>` — check startup errors
2. Database connection: `DATABASE_URL` env var correct? PG container healthy?
3. Port conflicts: `lsof -i :3001` / `lsof -i :4173`
4. Volume mounts: DuckDB file accessible? Check `DUCKDB_PATH`
5. Network: services can reach each other via container names

### "Slow analytics queries"
1. Check DuckDB query plan: `EXPLAIN ANALYZE <query>`
2. Missing date filter? All analytics queries MUST filter by date range
3. Missing LIMIT? Large result sets eat memory
4. Cache miss? Check TTL configuration for the endpoint
5. Sync backlog? Check if incremental sync is keeping up
6. Table scan? DuckDB should use columnar scans with date predicates

## Useful Debug Commands

```bash
# Check all services running
docker-compose ps

# View logs for specific service
docker-compose logs -f backend

# Connect to PostgreSQL
docker exec -it traffic-postgres psql -U analytics -d analytics

# Check DuckDB directly
node -e "const duckdb = require('duckdb'); const db = new duckdb.Database('./duckdb/analytics.duckdb'); db.all('SELECT COUNT(*) FROM events', console.log)"

# Test tracking endpoint
curl -X POST http://localhost:3001/api/track/event \
  -H 'Content-Type: application/json' \
  -d '{"siteId":"test","type":"pageview","path":"/"}'

# Test auth
curl -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"password"}'

# Check frontend build
cd apps/dashboard-web && npm run build 2>&1 | tail -20

# Run specific test
cd apps/analytics-api && npx vitest run tests/trackingService.test.js
cd apps/dashboard-web && npx vitest run src/__tests__/api.test.js

# Check for port conflicts
lsof -i :3001 -i :4173 -i :5432
```

## Log Analysis Patterns

```
# Find errors in server logs
docker-compose logs backend 2>&1 | grep -i "error\|fail\|crash"

# Find slow queries (if logged)
docker-compose logs backend 2>&1 | grep -E "query took [0-9]{4,}ms"

# Find auth failures
docker-compose logs backend 2>&1 | grep -i "401\|unauthorized\|invalid token"

# Find sync issues
docker-compose logs backend 2>&1 | grep -i "sync"
```
