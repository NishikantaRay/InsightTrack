# Node.js Backend Dockerfile (analytics-api with DuckDB)
# Using slim (Debian) instead of Alpine because DuckDB needs glibc
FROM node:20-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /app/duckdb
# Drop root. The node image ships an unprivileged `node` user; DuckDB writes to
# /app/duckdb and needs to own it, hence the chown before the USER switch.
RUN chown -R node:node /app
USER node
EXPOSE 3001
# Seed runs before start so the bundled demo site (examples/demo-site, which
# embeds site_demo) has a real site to track against on a fresh install.
#
# Seeding is deliberately NOT part of the `&&` chain. It generates random
# session IDs and its "already seeded?" guard only inspects `events`, so a run
# interrupted midway leaves rows in `sessions` that make the next run collide on
# sessions_pkey. Sample data is a convenience, not a prerequisite for booting —
# so a failed seed logs and the API starts anyway. Migrations and init DO gate
# startup, because the schema genuinely is a prerequisite.
CMD ["sh", "-c", "node scripts/migrate.js && { node scripts/seed.js || echo '⚠️  Seeding skipped (see error above); the API will start without sample data.'; } && node scripts/init.js && node src/index.js"]
