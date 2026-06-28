import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import duckdb from 'duckdb';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const DUCKDB_PATH = path.resolve(
    __dirname, '..', '..',
    process.env.DUCKDB_PATH || 'duckdb/analytics.duckdb',
);

mkdirSync(path.dirname(DUCKDB_PATH), { recursive: true });

// ── Connection pool ────────────────────────────────────────────────────────────
// DuckDB supports multiple connections on the same Database file.
// We keep a small pool so concurrent analytics queries don't serialize behind
// each other on a single connection.
const POOL_SIZE = Math.max(1, parseInt(process.env.DUCKDB_POOL_SIZE) || 4);

let _db = null;
const _pool = [];       // available connections
const _queue = [];      // pending acquire callbacks

function getDB() {
    if (!_db) {
        _db = new duckdb.Database(DUCKDB_PATH, (err) => {
            if (err) {
                console.error('[duckdb] Failed to open database at', DUCKDB_PATH, err);
                _db = null;
            }
        });
        // Pre-create pool connections
        for (let i = 0; i < POOL_SIZE; i++) {
            _pool.push(_db.connect());
        }
        console.log(`[duckdb] Pool of ${POOL_SIZE} connections opened at ${DUCKDB_PATH}`);
    }
    return _db;
}

// Acquire a connection from the pool; waits if all are busy
function acquireConn() {
    return new Promise((resolve) => {
        if (_pool.length > 0) {
            resolve(_pool.pop());
        } else {
            _queue.push(resolve);
        }
    });
}

// Return a connection back to the pool
function releaseConn(conn) {
    if (_queue.length > 0) {
        const next = _queue.shift();
        next(conn);
    } else {
        _pool.push(conn);
    }
}

// ── Public API ─────────────────────────────────────────────────────────────────

// Ensure DB + pool are initialised (idempotent)
export function ensureDB() {
    getDB();
}

export function duckRun(sql, params = []) {
    return new Promise(async (resolve, reject) => {
        getDB();
        const conn = await acquireConn();
        conn.run(sql, ...params, (err) => {
            releaseConn(conn);
            if (err) reject(err); else resolve();
        });
    });
}

export function duckAll(sql, params = []) {
    return new Promise(async (resolve, reject) => {
        getDB();
        const conn = await acquireConn();
        conn.all(sql, ...params, (err, rows) => {
            releaseConn(conn);
            if (err) reject(err); else resolve(rows ?? []);
        });
    });
}

/**
 * Bulk-insert many rows in a single multi-row INSERT statement.
 * duckdb@1.x has no Appender binding, so the fastest portable path is to
 * collapse N row-by-row INSERTs into one statement with N value tuples.
 * Turns a 5000-statement sync batch into a single round-trip — ~50-100×
 * faster than the per-row INSERT/DELETE loop for append-only loads.
 *
 * @param {string}   table    Target table (must already exist).
 * @param {string[]} columns  Column order; each row array matches this order.
 * @param {Array<Array>} rows Value arrays in `columns` order.
 * @returns {Promise<number>} number of rows inserted
 */
export async function duckBulkInsert(table, columns, rows) {
    if (!rows || rows.length === 0) return 0;
    getDB();
    const colList = columns.join(', ');
    const tuple = `(${columns.map(() => '?').join(', ')})`;
    // Cap each statement to ~1000 rows so we never build a pathologically large
    // SQL string / parameter list, regardless of the caller's batch size.
    const CHUNK = 1000;
    let total = 0;

    for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const placeholders = slice.map(() => tuple).join(', ');
        const sql = `INSERT INTO ${table} (${colList}) VALUES ${placeholders}`;
        const flat = [];
        for (const r of slice) for (const v of r) flat.push(v);

        const conn = await acquireConn();
        await new Promise((resolve, reject) => {
            conn.run(sql, ...flat, (err) => {
                releaseConn(conn);
                if (err) reject(err); else resolve();
            });
        });
        total += slice.length;
    }
    return total;
}

export function closeDuck() {
    return new Promise((resolve, reject) => {
        if (_db) {
            // Drain the pool then close
            _pool.length = 0;
            _db.close((err) => {
                _db = null;
                if (err) reject(err); else resolve();
            });
        } else {
            resolve();
        }
    });
}

// Pool stats — useful for /api/health
export function poolStats() {
    return { poolSize: POOL_SIZE, available: _pool.length, waiting: _queue.length };
}

/**
 * One-time startup: initialise DB pool then wire up S3/R2 httpfs if configured.
 */
export async function initDuckDB() {
    ensureDB();
    const { s3Enabled, initS3, refreshUnifiedViews } = await import('../storage/s3.js');
    if (s3Enabled()) {
        const ok = await initS3();
        if (ok) await refreshUnifiedViews({ silent: false });
    }
}

// Legacy compat — callers that imported getDuckDB / getDuckConn still work
export const getDuckDB = getDB;
export const getDuckConn = () => { getDB(); return _pool[0] ?? null; };
