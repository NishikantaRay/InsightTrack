/**
 * SQL Editor security regression tests.
 *
 * Locks in the SQL Editor's server-side security boundary. Every
 * rejection case below corresponds to a vector that was VERIFIED exploitable
 * before the fix, so a regression here is a real security regression — in
 * particular, a DuckDB upgrade that introduces new file/network functions must
 * not silently widen the surface.
 *
 * Pure unit tests: no database, no server. They run in any environment.
 */
import { describe, it, expect } from 'vitest';
import {
    validateQuery,
    clampTimeout,
    scopeQueryToSite,
    applyRowCap,
    extractFunctions,
    extractTables,
    collectAstFunctions,
    ALLOWED_TABLES,
    MAX_RESULT_ROWS,
    MAX_TIMEOUT_MS,
} from '../src/routes/sqlGuard.js';

// ── Allowed: ordinary analytics must keep working ───────────────────────────

describe('SQL Editor — legitimate analytical queries are permitted', () => {
    const allowed = [
        ['plain SELECT', 'SELECT * FROM events LIMIT 10'],
        ['aggregation + GROUP BY + ORDER BY',
            'SELECT path, COUNT(*) AS pageviews FROM events GROUP BY path ORDER BY pageviews DESC LIMIT 20'],
        ['COUNT DISTINCT with CAST',
            'SELECT CAST(timestamp AS DATE) AS d, COUNT(DISTINCT user_id) AS visitors FROM events GROUP BY 1 ORDER BY 1'],
        ['JOIN across two allowed tables',
            'SELECT e.path, s.device FROM events e JOIN sessions s ON e.session_id = s.id LIMIT 100'],
        ['CTE via WITH',
            'WITH t AS (SELECT country, COUNT(*) AS c FROM events GROUP BY 1) SELECT * FROM t WHERE c > 10'],
        ['date filtering with an interval',
            "SELECT country, COUNT(*) c FROM events WHERE timestamp >= now() - INTERVAL 30 DAY GROUP BY 1"],
        ['date_trunc + AVG + ROUND',
            "SELECT date_trunc('month', timestamp) AS m, ROUND(AVG(duration), 2) AS avg_d FROM sessions GROUP BY 1"],
        ['strftime with conditional SUM',
            "SELECT strftime(timestamp, '%Y-%m') AS ym, SUM(CASE WHEN type = 'pageview' THEN 1 ELSE 0 END) AS pv FROM events GROUP BY 1"],
        ['window function',
            'SELECT row_number() OVER (PARTITION BY country ORDER BY timestamp) AS rn, path FROM events'],
        ['EXPLAIN', 'EXPLAIN SELECT COUNT(*) FROM events'],
        ['{{site_id}} template variable',
            'SELECT path, COUNT(*) AS pv FROM events WHERE site_id = {{site_id}} GROUP BY path'],
        ['daily_stats read', "SELECT * FROM daily_stats WHERE date >= '2026-01-01'"],
        ['string + regexp functions',
            "SELECT lower(path) p, regexp_extract(referrer, '[a-z]+') r FROM events LIMIT 5"],
    ];

    it.each(allowed)('allows %s', (_label, sql) => {
        expect(validateQuery(sql)).toBeNull();
    });
});

// ── Rejected: write / DDL / admin statements ────────────────────────────────

describe('SQL Editor — mutating and administrative statements are rejected', () => {
    const rejected = [
        ['INSERT', "INSERT INTO events (site_id) VALUES ('x')"],
        ['UPDATE', "UPDATE events SET path = '/hacked'"],
        ['DELETE', 'DELETE FROM events'],
        ['DROP', 'DROP TABLE events'],
        ['ALTER', 'ALTER TABLE events ADD COLUMN evil INT'],
        ['CREATE', 'CREATE TABLE evil (a INT)'],
        ['TRUNCATE', 'TRUNCATE events'],
        ['COPY', "COPY events TO '/tmp/exfil.csv'"],
        ['ATTACH', "ATTACH '/tmp/evil.db' AS evil"],
        ['DETACH', 'DETACH evil'],
        ['INSTALL', 'INSTALL httpfs'],
        ['LOAD', 'LOAD httpfs'],
        ['PRAGMA', 'PRAGMA database_list'],
        ['CHECKPOINT', 'CHECKPOINT'],
        ['VACUUM', 'VACUUM'],
        ['GRANT', 'GRANT ALL ON events TO PUBLIC'],
    ];

    it.each(rejected)('rejects %s', (_label, sql) => {
        expect(validateQuery(sql)).not.toBeNull();
    });

    it('rejects multiple statements (stacked-query injection)', () => {
        expect(validateQuery('SELECT 1; DROP TABLE events')).toMatch(/single SQL statement/i);
    });

    it('rejects a write hidden after a comment', () => {
        expect(validateQuery('SELECT 1 -- \nDROP TABLE events')).not.toBeNull();
    });
});

// ── Rejected: file-system access (audit F-01) ───────────────────────────────

describe('SQL Editor — file-reading functions are rejected (audit F-01)', () => {
    const fileVectors = [
        ['read_csv', "SELECT * FROM read_csv('/etc/passwd')"],
        ['read_csv_auto', "SELECT * FROM read_csv_auto('/etc/passwd')"],
        ['read_parquet', "SELECT * FROM read_parquet('/var/data/x.parquet')"],
        ['read_json', "SELECT * FROM read_json('/etc/hosts')"],
        ['read_json_auto', "SELECT * FROM read_json_auto('/etc/hosts')"],
        ['read_text', "SELECT * FROM read_text('/app/.env')"],
        ['read_blob', "SELECT * FROM read_blob('/app/.env')"],
        ['glob directory listing', "SELECT * FROM glob('/etc/*')"],
        ['parquet_scan', "SELECT * FROM parquet_scan('/x.parquet')"],
        ['file read in a subquery', "SELECT * FROM (SELECT * FROM read_text('/app/.env')) t"],
        ['file read inside a CTE', "WITH x AS (SELECT * FROM read_csv('/etc/passwd')) SELECT * FROM x"],
    ];

    it.each(fileVectors)('rejects %s', (_label, sql) => {
        const err = validateQuery(sql);
        expect(err).not.toBeNull();
        expect(err).toMatch(/not permitted|not available/i);
    });

    it('rejects a remote URL read (network egress — audit F-06)', () => {
        expect(validateQuery("SELECT * FROM read_csv_auto('https://evil.example/x.csv')")).not.toBeNull();
    });
});

// ── Rejected: engine configuration / secret disclosure (audit F-03) ─────────

describe('SQL Editor — engine metadata functions are rejected (audit F-03)', () => {
    it('rejects duckdb_settings() (would disclose configured S3 credentials)', () => {
        expect(validateQuery("SELECT * FROM duckdb_settings() WHERE name LIKE 's3%'")).not.toBeNull();
    });

    it('rejects duckdb_databases()', () => {
        expect(validateQuery('SELECT * FROM duckdb_databases()')).not.toBeNull();
    });

    it('rejects duckdb_extensions()', () => {
        expect(validateQuery('SELECT * FROM duckdb_extensions()')).not.toBeNull();
    });
});

// ── Rejected: sensitive tables (audit F-02) ────────────────────────────────

describe('SQL Editor — non-analytics tables are rejected (audit F-02)', () => {
    it('rejects the users table (bcrypt password hashes)', () => {
        const err = validateQuery('SELECT * FROM users');
        expect(err).not.toBeNull();
        expect(err).toMatch(/not available/i);
    });

    it('rejects information_schema reconnaissance', () => {
        expect(validateQuery('SELECT * FROM information_schema.tables')).not.toBeNull();
    });

    it('rejects a schema-qualified bypass (main.events)', () => {
        expect(validateQuery('SELECT * FROM main.events')).not.toBeNull();
    });

    it('rejects assistant and MCP tables', () => {
        expect(validateQuery('SELECT * FROM assistant_settings')).not.toBeNull();
        expect(validateQuery('SELECT * FROM mcp_connect_tokens')).not.toBeNull();
    });

    it('does not expose users in the allowed-table set', () => {
        expect(ALLOWED_TABLES.has('users')).toBe(false);
    });
});

// ── Tenant isolation (audit F-05) ──────────────────────────────────────────

describe('SQL Editor — queries are bound to a single site (audit F-05)', () => {
    it('rewrites an unfiltered events read to a site-scoped view', () => {
        const { views, rewritten } = scopeQueryToSite('SELECT * FROM events', 'site_abc123');
        expect(views).toHaveLength(1);
        expect(views[0].table).toBe('events');
        expect(rewritten).not.toMatch(/FROM events\b/);
        expect(rewritten).toContain(views[0].viewName);
    });

    it('scopes every table in a multi-table join', () => {
        const { views, rewritten } = scopeQueryToSite(
            'SELECT e.path FROM events e JOIN sessions s ON e.session_id = s.id',
            'site_abc123',
        );
        expect(views.map((v) => v.table).sort()).toEqual(['events', 'sessions']);
        expect(rewritten).not.toMatch(/FROM events\b/);
        expect(rewritten).not.toMatch(/JOIN sessions\b/);
    });

    it('derives distinct view names per site so tenants cannot collide', () => {
        const a = scopeQueryToSite('SELECT * FROM events', 'site_aaa');
        const b = scopeQueryToSite('SELECT * FROM events', 'site_bbb');
        expect(a.views[0].viewName).not.toBe(b.views[0].viewName);
    });

    it('builds view DDL with an escaped literal (DuckDB cannot bind params in DDL)', () => {
        const { views } = scopeQueryToSite('SELECT * FROM events', "site_a'; DROP TABLE events; --");
        expect(views[0].createSql).toBeTypeOf('string');
        expect(views[0].createSql).not.toContain('?');
        // the injected quote must be doubled, not left to terminate the literal
        expect(views[0].createSql).toContain("''");
        expect(views[0].createSql).toMatch(/^CREATE OR REPLACE TEMP VIEW /);
    });

    it('sanitises the site id used in the view name', () => {
        const { views } = scopeQueryToSite('SELECT * FROM events', 'site"; DROP TABLE events; --');
        expect(views[0].viewName).toMatch(/^_sqled_[A-Za-z0-9_]+_events$/);
    });
});

// ── Resource limits (audit F-04, F-07) ─────────────────────────────────────

describe('SQL Editor — resource limits', () => {
    it('caps a client-supplied timeout at the server maximum (audit F-04)', () => {
        expect(clampTimeout(3_600_000, 15_000)).toBe(MAX_TIMEOUT_MS);
    });

    it('keeps a 1s floor for very small timeouts', () => {
        expect(clampTimeout(5, 15_000)).toBe(1000);
    });

    it('falls back to the default when the value is not a number', () => {
        expect(clampTimeout('abc', 15_000)).toBe(15_000);
    });

    it('wraps the query so the row cap binds even with a larger user LIMIT (audit F-07)', () => {
        const capped = applyRowCap('SELECT * FROM events LIMIT 999999');
        expect(capped).toMatch(new RegExp(`LIMIT ${MAX_RESULT_ROWS}$`));
        expect(capped).toMatch(/^SELECT \* FROM \(/);
    });

    it('prefixes EXPLAIN rather than wrapping it', () => {
        expect(applyRowCap('SELECT 1', { explain: true })).toBe('EXPLAIN SELECT 1');
    });

    it('enforces the query length limit', () => {
        expect(validateQuery(`SELECT '${'x'.repeat(20_001)}'`)).toMatch(/character limit/i);
    });
});

// ── Evasion techniques found by adversarial probing ────────────────────────

describe('SQL Editor — identifier-quoting and syntax evasion', () => {
    it('rejects a double-quoted sensitive table ("users")', () => {
        expect(validateQuery('SELECT * FROM "users"')).not.toBeNull();
    });

    it('rejects a double-quoted file-reading function', () => {
        expect(validateQuery(`SELECT * FROM "read_csv"('/etc/passwd')`)).not.toBeNull();
    });

    it('rejects a quoted schema-qualified bypass ("main"."users")', () => {
        expect(validateQuery('SELECT * FROM "main"."users"')).not.toBeNull();
    });

    it('rejects a sensitive table reached through a comma-separated FROM list', () => {
        expect(validateQuery('SELECT * FROM events, users')).not.toBeNull();
    });

    it('rejects EXPLAIN ANALYZE (it executes the statement)', () => {
        const err = validateQuery('EXPLAIN ANALYZE SELECT COUNT(*) FROM events');
        expect(err).toMatch(/EXPLAIN ANALYZE/i);
    });

    it('still allows plain EXPLAIN', () => {
        expect(validateQuery('EXPLAIN SELECT COUNT(*) FROM events')).toBeNull();
    });

    it('rejects a file read reached via a scalar subquery', () => {
        expect(validateQuery("SELECT (SELECT content FROM read_text('/etc/hosts'))")).not.toBeNull();
    });

    it('rejects a sensitive table reached via UNION', () => {
        expect(validateQuery('SELECT path FROM events UNION SELECT email FROM users')).not.toBeNull();
    });

    it('rejects whitespace/comment separation between function name and paren', () => {
        expect(validateQuery("SELECT * FROM read_text    ('/etc/hosts')")).not.toBeNull();
        expect(validateQuery("SELECT * FROM read_text/**/('/etc/hosts')")).not.toBeNull();
    });

    it('does not treat a semicolon inside a string literal as a second statement', () => {
        expect(validateQuery("SELECT * FROM events WHERE path = 'a;b'")).toBeNull();
    });
});

describe('SQL Editor — every scoped table in a comma list is rewritten', () => {
    it('scopes BOTH tables in `FROM events, sessions` (cross-tenant leak)', () => {
        const { views, rewritten } = scopeQueryToSite('SELECT * FROM events, sessions', 'site_a');
        expect(views.map((v) => v.table).sort()).toEqual(['events', 'sessions']);
        expect(rewritten).not.toMatch(/\bsessions\b(?!_)/);
        expect(rewritten).toContain('_sqled_site_a_events');
        expect(rewritten).toContain('_sqled_site_a_sessions');
    });

    it('rewrites a quoted table name without leaving a stray quote', () => {
        const { rewritten } = scopeQueryToSite('SELECT * FROM "events"', 'site_a');
        expect(rewritten).toBe('SELECT * FROM _sqled_site_a_events');
        expect(rewritten).not.toContain('"');
    });

    it('does not corrupt commas in select lists or function arguments', () => {
        const a = scopeQueryToSite('SELECT path, country FROM events GROUP BY path, country', 'site_a');
        expect(a.rewritten).toBe('SELECT path, country FROM _sqled_site_a_events GROUP BY path, country');
        const b = scopeQueryToSite('SELECT round(avg(duration), 2) FROM sessions', 'site_a');
        expect(b.rewritten).toBe('SELECT round(avg(duration), 2) FROM _sqled_site_a_sessions');
    });
});

// ── Structural (AST) layer ─────────────────────────────────────────────────
//
// The textual checks are approximate. These cases hide a disallowed function or
// table somewhere a FROM/JOIN-anchored regex does not look, so they exercise the
// parser layer specifically.

describe('SQL Editor — AST layer catches constructs the regex cannot see', () => {
    const hidden = [
        ['function in ORDER BY',
            "SELECT path FROM events ORDER BY (SELECT content FROM read_text('/etc/hosts'))"],
        ['function in HAVING',
            "SELECT path FROM events GROUP BY path HAVING COUNT(*) > (SELECT 1 FROM glob('/etc/*'))"],
        ['function inside CASE',
            "SELECT CASE WHEN 1=1 THEN (SELECT content FROM read_text('/x')) END FROM events"],
        ['function in a deeply nested subquery',
            "SELECT * FROM events WHERE path IN (SELECT a FROM (SELECT b AS a FROM read_csv('/etc/passwd')) z)"],
        ['file function aliased to an allowed table name',
            "SELECT * FROM read_csv('/etc/passwd') AS events"],
        ['function in a window PARTITION BY',
            "SELECT row_number() OVER (PARTITION BY (SELECT content FROM read_text('/x'))) FROM events"],
        ['function in a JOIN condition',
            "SELECT * FROM events e JOIN sessions s ON e.id = (SELECT 1 FROM glob('/x'))"],
        ['function in LIMIT',
            "SELECT * FROM events LIMIT (SELECT 1 FROM glob('/x'))"],
    ];

    it.each(hidden)('rejects %s', (_label, sql) => {
        expect(validateQuery(sql)).not.toBeNull();
    });

    it('rejects a sensitive table aliased to an allowed name', () => {
        expect(validateQuery('SELECT * FROM users AS events')).not.toBeNull();
    });

    it('rejects a CTE named after an allowed table that selects from users', () => {
        expect(validateQuery('WITH events AS (SELECT * FROM users) SELECT * FROM events')).not.toBeNull();
    });

    it('rejects a quoted sensitive table split across lines', () => {
        expect(validateQuery('SELECT *\nFROM\n  "users"')).not.toBeNull();
    });

    it('rejects a query the parser cannot understand (fails closed)', () => {
        expect(validateQuery('SELECT * FROM events WHERE ((((')).not.toBeNull();
    });

    it('finds functions nested anywhere in the tree', () => {
        const ast = { type: 'select', a: { type: 'function', name: 'read_csv' } };
        expect([...collectAstFunctions(ast)]).toContain('read_csv');
    });
});

describe('SQL Editor — AST layer does not reject legitimate analytics', () => {
    const legit = [
        ['comma join of two allowed tables', 'SELECT * FROM events, sessions'],
        ['UNION of two allowed tables', 'SELECT path FROM events UNION SELECT entry_page FROM sessions'],
        ['HAVING with an aggregate',
            'SELECT device, COUNT(DISTINCT session_id) FROM sessions GROUP BY device HAVING COUNT(*) > 5'],
        ['BETWEEN date filter',
            "SELECT a.path FROM events a WHERE a.timestamp BETWEEN '2026-01-01' AND '2026-02-01'"],
        ['COALESCE + GROUP BY ordinal',
            "SELECT COALESCE(utm_source, 'direct') src, COUNT(*) FROM events GROUP BY 1"],
        ['template variable placeholder',
            'SELECT path, COUNT(*) pv FROM events WHERE site_id = {{site_id}} GROUP BY path'],
    ];

    it.each(legit)('allows %s', (_label, sql) => {
        expect(validateQuery(sql)).toBeNull();
    });
});

// ── Parser helpers ─────────────────────────────────────────────────────────

describe('SQL Editor — identifier extraction', () => {
    it('does not treat SQL keywords before a paren as function calls', () => {
        const fns = extractFunctions('SELECT * FROM events WHERE (site_id = 1) GROUP BY (path)');
        expect(fns).not.toContain('where');
        expect(fns).not.toContain('by');
    });

    it('ignores identifiers that appear only inside string literals', () => {
        const err = validateQuery("SELECT * FROM events WHERE path = 'read_csv(/etc/passwd)'");
        expect(err).toBeNull();
    });

    it('does not mistake table aliases for tables', () => {
        expect(extractTables('SELECT e.path FROM events e')).toEqual(['events']);
    });

    it('treats CTE names as valid table references', () => {
        expect(validateQuery('WITH t AS (SELECT 1 AS a) SELECT * FROM t')).toBeNull();
    });
});
