export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS _sync_meta (
  table_name  VARCHAR PRIMARY KEY,
  last_synced TIMESTAMP NOT NULL,
  last_id     BIGINT    DEFAULT 0,   -- keyset cursor for append-only tables
  rows_synced BIGINT    DEFAULT 0,
  updated_at  TIMESTAMP DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS events (
  id VARCHAR, site_id VARCHAR NOT NULL, user_id VARCHAR NOT NULL,
  session_id VARCHAR NOT NULL, type VARCHAR NOT NULL, url VARCHAR,
  path VARCHAR, referrer VARCHAR, device VARCHAR, browser VARCHAR,
  os VARCHAR, country VARCHAR, city VARCHAR, timestamp TIMESTAMP NOT NULL,
  properties VARCHAR, utm_source VARCHAR, utm_medium VARCHAR,
  utm_campaign VARCHAR, utm_term VARCHAR, utm_content VARCHAR
);

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR PRIMARY KEY, site_id VARCHAR NOT NULL, user_id VARCHAR NOT NULL,
  started_at TIMESTAMP NOT NULL, ended_at TIMESTAMP NOT NULL,
  duration INTEGER DEFAULT 0, pageviews SMALLINT DEFAULT 1,
  entry_page VARCHAR, exit_page VARCHAR, referrer VARCHAR,
  device VARCHAR, browser VARCHAR, os VARCHAR, country VARCHAR,
  is_bounce BOOLEAN DEFAULT FALSE, is_returning BOOLEAN DEFAULT FALSE,
  utm_source VARCHAR, utm_medium VARCHAR, utm_campaign VARCHAR
);

CREATE TABLE IF NOT EXISTS sites (
  id VARCHAR PRIMARY KEY, user_id VARCHAR, name VARCHAR NOT NULL, domain VARCHAR NOT NULL, created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS funnels (
  id VARCHAR PRIMARY KEY, site_id VARCHAR NOT NULL, name VARCHAR NOT NULL,
  steps VARCHAR, created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_stats (
  id INTEGER, site_id VARCHAR NOT NULL, date DATE NOT NULL,
  visitors INTEGER DEFAULT 0, sessions INTEGER DEFAULT 0,
  pageviews INTEGER DEFAULT 0, bounces INTEGER DEFAULT 0,
  avg_duration DOUBLE DEFAULT 0, top_pages VARCHAR, sources VARCHAR,
  devices VARCHAR, countries VARCHAR, computed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR, name VARCHAR NOT NULL, email VARCHAR NOT NULL,
  password VARCHAR NOT NULL, role VARCHAR DEFAULT 'viewer', created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS goals (
  id VARCHAR PRIMARY KEY, site_id VARCHAR NOT NULL, name VARCHAR NOT NULL,
  type VARCHAR NOT NULL, config VARCHAR, created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ab_tests (
  id VARCHAR PRIMARY KEY, site_id VARCHAR NOT NULL, name VARCHAR NOT NULL,
  variants VARCHAR, goal_id VARCHAR, status VARCHAR DEFAULT 'active',
  created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS annotations (
  id VARCHAR PRIMARY KEY, site_id VARCHAR NOT NULL, date DATE NOT NULL,
  title VARCHAR NOT NULL, description VARCHAR DEFAULT '',
  category VARCHAR DEFAULT 'general', created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report_schedules (
  id VARCHAR PRIMARY KEY, site_id VARCHAR NOT NULL, user_id VARCHAR NOT NULL,
  frequency VARCHAR NOT NULL, email VARCHAR NOT NULL,
  metrics VARCHAR, last_sent_at TIMESTAMP, next_send_at TIMESTAMP,
  enabled BOOLEAN DEFAULT TRUE, created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_dashboards (
  id VARCHAR PRIMARY KEY, site_id VARCHAR NOT NULL, user_id VARCHAR NOT NULL,
  name VARCHAR NOT NULL, widgets VARCHAR, created_at TIMESTAMP, updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS data_retention_policies (
  id VARCHAR PRIMARY KEY, site_id VARCHAR NOT NULL,
  retention_days INTEGER DEFAULT 365, enabled BOOLEAN DEFAULT FALSE,
  last_cleanup_at TIMESTAMP, created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sentry_issues (
  issue_id VARCHAR PRIMARY KEY, site_id VARCHAR NOT NULL, sentry_id VARCHAR NOT NULL,
  short_id VARCHAR, title VARCHAR, culprit VARCHAR, level VARCHAR, status VARCHAR,
  is_unhandled BOOLEAN DEFAULT FALSE, count INTEGER DEFAULT 0, user_count INTEGER DEFAULT 0,
  permalink VARCHAR, project_slug VARCHAR, stale BOOLEAN DEFAULT FALSE,
  is_regression BOOLEAN DEFAULT FALSE, last_release VARCHAR,
  first_seen TIMESTAMP, last_seen TIMESTAMP, updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sentry_stats (
  stat_id VARCHAR PRIMARY KEY, site_id VARCHAR NOT NULL, project_slug VARCHAR,
  date DATE NOT NULL, events INTEGER DEFAULT 0, updated_at TIMESTAMP
);

-- ── DuckDB ART indexes ────────────────────────────────────────────────────────
-- These dramatically speed up the WHERE site_id=? AND timestamp>=? pattern
-- that every analytics query uses. DuckDB's columnar format already helps,
-- but ART indexes on the hot filter columns give 5-20× additional speedup
-- on selective (single-site) queries.

CREATE INDEX IF NOT EXISTS idx_events_site_ts
  ON events(site_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_events_type_site
  ON events(type, site_id);

CREATE INDEX IF NOT EXISTS idx_events_path_site
  ON events(path, site_id);

CREATE INDEX IF NOT EXISTS idx_sessions_site_ts
  ON sessions(site_id, started_at);

CREATE INDEX IF NOT EXISTS idx_daily_stats_site_date
  ON daily_stats(site_id, date);

CREATE INDEX IF NOT EXISTS idx_sentry_issues_site_seen
  ON sentry_issues(site_id, last_seen);

CREATE INDEX IF NOT EXISTS idx_sentry_stats_site_date
  ON sentry_stats(site_id, date);
`;

export const SYNCABLE_TABLES = [
  { table: 'events', tsColumn: 'timestamp', idColumn: 'id', appendOnly: true },
  { table: 'sessions', tsColumn: 'started_at', idColumn: 'id' },
  { table: 'sites', tsColumn: 'created_at', idColumn: 'id' },
  { table: 'funnels', tsColumn: 'created_at', idColumn: 'id' },
  // NOTE: daily_stats is intentionally NOT synced from PostgreSQL. It is a
  // DuckDB-derived rollup owned solely by computeDailyRollups() in sync.js.
  // Syncing it from PG too would create two competing writers (PG-upsert by id
  // vs rollup delete-by-date + insert with NULL id) that double-count metrics.
  { table: 'users', tsColumn: 'created_at', idColumn: 'id' },
  { table: 'goals', tsColumn: 'created_at', idColumn: 'id' },
  { table: 'ab_tests', tsColumn: 'created_at', idColumn: 'id' },
  { table: 'annotations', tsColumn: 'created_at', idColumn: 'id' },
  { table: 'report_schedules', tsColumn: 'created_at', idColumn: 'id' },
  { table: 'custom_dashboards', tsColumn: 'created_at', idColumn: 'id' },
  { table: 'data_retention_policies', tsColumn: 'created_at', idColumn: 'id' },
  // Sentry issues are upserted by the poll loop (last_seen/count change on
  // re-poll), so this is a mutable table synced on its updated_at watermark.
  { table: 'sentry_issues', tsColumn: 'updated_at', idColumn: 'issue_id' },
  // Sentry daily event counts, upserted each poll — mutable, updated_at watermark.
  { table: 'sentry_stats', tsColumn: 'updated_at', idColumn: 'stat_id' },
];
