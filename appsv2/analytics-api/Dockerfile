# Node.js Backend Dockerfile (analytics-api with DuckDB + Hot/Cold Parquet)
# Using slim (Debian) instead of Alpine because DuckDB needs glibc
FROM node:20-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
# Directories for DuckDB hot store and Parquet cold store
RUN mkdir -p /app/duckdb /app/data-lake
EXPOSE 3001
CMD ["sh", "-c", "node scripts/migrate.js && node scripts/init.js && node src/index.js"]
