import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import duckdb from 'duckdb';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Only load .env for local development — never load .env.example in code
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const DUCKDB_PATH = path.resolve(
    __dirname, '..', '..',
    process.env.DUCKDB_PATH || 'duckdb/analytics.duckdb',
);

// Ensure the directory exists before DuckDB tries to create the file
mkdirSync(path.dirname(DUCKDB_PATH), { recursive: true });

let _db = null;
let _conn = null;

export function getDuckDB() {
    if (!_db) {
        _db = new duckdb.Database(DUCKDB_PATH, (err) => {
            if (err) {
                console.error('[duckdb] Failed to open database at', DUCKDB_PATH, err);
                _db = null;
                _conn = null;
            }
        });
    }
    return _db;
}

export function getDuckConn() {
    if (!_conn) _conn = getDuckDB().connect();
    return _conn;
}

export function duckRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDuckConn().run(sql, ...params, (err) => {
            if (err) reject(err); else resolve();
        });
    });
}

export function duckAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDuckConn().all(sql, ...params, (err, rows) => {
            if (err) reject(err); else resolve(rows ?? []);
        });
    });
}

export function closeDuck() {
    return new Promise((resolve, reject) => {
        if (_conn) _conn = null;
        if (_db) {
            _db.close((err) => { _db = null; if (err) reject(err); else resolve(); });
        } else { resolve(); }
    });
}
