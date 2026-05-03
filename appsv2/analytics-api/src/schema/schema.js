/**
 * Hot + Cold Analytics Architecture — DuckDB Schema
 *
 * Hot store  : DuckDB managed tables — last HOT_DAYS days (fast, frequently queried)
 * Cold store : Parquet partitions on disk — data older than HOT_DAYS days
 *
 * Queries transparently UNION hot tables + Parquet cold files.
 */

/** Number of days kept in DuckDB hot store */
export const HOT_DAYS = Number(process.env.HOT_DAYS) || 30;

export const SCHEMA_SQL = `
-- Sync metadata with event-id watermark for append-only tables
CREATE TABLE IF NOT EXISTS _sync_meta (
  table_name       VARCHAR PRIMARY KEY,
  last_synced      TIMESTAMP NOT NULL,
  last_event_id    BIGINT    DEFAULT 0,
  rows_synced      BIGINT    DEFAULT 0,
  updated_at       TIMESTAMP DEFAULT current_timestamp
);

-- Hot events: recent ${HOT_DAYS} days kept in DuckDB for fast queries
CREATE TABLE IF NOT EXISTS events_hot (
  id          VARCHAR,
  event_uuid  VARCHAR,
  site_id     VARCHAR NOT NULL,
  user_id     VARCHAR NOT NULL,
  session_id  VARCHAR NOT NULL,
  type        VARCHAR NOT NULL,
  url         VARCHAR,
  path        VARCHAR,
  referrer    VARCHAR,
  device      VARCHAR,
  browser     VARCHAR,
  os          VARCHAR,
  country     VARCHAR,
  city        VARCHAR,
  timestamp   TIMESTAMP NOT NULL,
  properties  VARCHAR,
  utm_source  VARCHAR,
  utm_medium  VARCHAR,
  utm_campaign VARCHAR,
  utm_term    VARCHAR,
  utm_content VARCHAR
);

-- Hot sessions: recent ${HOT_DAYS} days kept in DuckDB
CREATE TABLE IF NOT EXISTS sessions_hot (
  id           VARCHAR,
  site_id      VARCHAR NOT NULL,
  user_id      VARCHAR NOT NULL,
  started_at   TIMESTAMP NOT NULL,
  ended_at     TIMESTAMP NOT NULL,
  duration     INTEGER DEFAULT 0,
  pageviews    SMALLINT DEFAULT 1,
  entry_page   VARCHAR,
  exit_page    VARCHAR,
  referrer     VARCHAR,
  device       VARCHAR,
  browser      VARCHAR,
  os           VARCHAR,
  country      VARCHAR,
  is_bounce    BOOLEAN DEFAULT FALSE,
  is_returning BOOLEAN DEFAULT FALSE,
  utm_source   VARCHAR,
  utm_medium   VARCHAR,
  utm_campaign VARCHAR,
  updated_at   TIMESTAMP
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
`;

/**
 * Tables synced from PostgreSQL to DuckDB.
 * events and sessions use the hot table names; older data goes to Parquet.
 */
export const SYNCABLE_TABLES = [
  { table: 'events', duckTable: 'events_hot', tsColumn: 'timestamp', idColumn: 'id', hotCold: true },
  { table: 'sessions', duckTable: 'sessions_hot', tsColumn: 'started_at', idColumn: 'id', hotCold: true },
  { table: 'sites', duckTable: 'sites', tsColumn: 'created_at', idColumn: 'id' },
  { table: 'funnels', duckTable: 'funnels', tsColumn: 'created_at', idColumn: 'id' },
  { table: 'daily_stats', duckTable: 'daily_stats', tsColumn: 'computed_at', idColumn: 'id' },
  { table: 'users', duckTable: 'users', tsColumn: 'created_at', idColumn: 'id' },
  { table: 'goals', duckTable: 'goals', tsColumn: 'created_at', idColumn: 'id' },
  { table: 'ab_tests', duckTable: 'ab_tests', tsColumn: 'created_at', idColumn: 'id' },
  { table: 'annotations', duckTable: 'annotations', tsColumn: 'created_at', idColumn: 'id' },
  { table: 'report_schedules', duckTable: 'report_schedules', tsColumn: 'created_at', idColumn: 'id' },
  { table: 'custom_dashboards', duckTable: 'custom_dashboards', tsColumn: 'created_at', idColumn: 'id' },
  { table: 'data_retention_policies', duckTable: 'data_retention_policies', tsColumn: 'created_at', idColumn: 'id' },
];
