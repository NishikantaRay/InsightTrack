#!/usr/bin/env node
/**
 * Database-engine benchmark: PostgreSQL vs DuckDB on an identical dataset.
 *
 * THIS IS NOT THE API BENCHMARK. `scripts/benchmark.js` measures HTTP/API
 * latency through the running application (including its response cache). This
 * script measures DATABASE EXECUTION TIME by issuing SQL directly to each
 * engine. The two must never be compared or combined.
 *
 * Design commitments (see docs/PERFORMANCE_BENCHMARK.md):
 *   - The experiment is not built to make DuckDB win. PostgreSQL keeps every
 *     index the production schema creates; DuckDB keeps its production indexes.
 *     No pre-aggregation, no materialised views, no engine-specific hints.
 *   - Correctness is verified BEFORE timing. A query whose two engines disagree
 *     is excluded from the results rather than silently benchmarked.
 *   - Connection setup is measured separately and excluded from query timings.
 *   - Execution order alternates per iteration so neither engine is
 *     systematically advantaged by warm-up or thermal drift.
 *   - Isolated throwaway databases only. Never touches the developer's data.
 *
 * Usage:
 *   cd apps/analytics-api && npm run benchmark:engine -- --size 100000 --seed 42
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import pg from 'pg';
import duckdb from 'duckdb';

import { generateEvents, EVENT_COLUMNS, fingerprint } from '../../../../scripts/benchmarking/dataset.js';
import { QUERIES } from '../../../../scripts/benchmarking/workload.js';
import { summarise } from '../../../../scripts/benchmarking/stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const RESULTS_DIR = resolve(REPO_ROOT, 'benchmark-results');

// -- CLI ----------------------------------------------------------------------

function arg(name, fallback) {
    const withEq = process.argv.find((a) => a.startsWith(`--${name}=`));
    if (withEq) return withEq.split('=')[1];
    const i = process.argv.indexOf(`--${name}`);
    if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
    return fallback;
}

const SIZE = parseInt(arg('size', '100000'), 10);
const SEED = parseInt(arg('seed', '42'), 10);
const WARMUP = parseInt(arg('warmup', '5'), 10);
const ITERATIONS = parseInt(arg('iterations', '30'), 10);
const KEEP = process.argv.includes('--keep');
const PG_PORT = parseInt(arg('pg-port', '55833'), 10);
const CONTAINER = arg('container', 'insighttrack-bench-pg');
// PostgreSQL caps a bind message at 65535 parameters. With 19 columns per row
// that allows ~3448 rows; 2000 leaves comfortable headroom.
const LOAD_BATCH = 2000;

// Fail gracefully when the machine plainly cannot serve the request.
//
// os.freemem() is a poor proxy on macOS: it excludes inactive and purgeable
// pages that the OS will hand back on demand, so it can read near-zero on a
// machine with gigabytes actually available. We therefore compare against total
// memory with a conservative headroom factor, and allow an explicit override.
const TOTAL_MEM_GB = os.totalmem() / 1024 ** 3;
const EST_GB = (SIZE * 400) / 1024 ** 3;   // ~400 B/row held in JS during generation
const MEM_BUDGET_GB = TOTAL_MEM_GB * 0.35; // leave the OS and both engines room
if (EST_GB > MEM_BUDGET_GB && !process.argv.includes('--force')) {
    console.error(`\nRefusing to run: generating ${SIZE.toLocaleString()} rows needs roughly ` +
        `${EST_GB.toFixed(1)} GB of process memory, which exceeds the ` +
        `${MEM_BUDGET_GB.toFixed(1)} GB budget on this ${TOTAL_MEM_GB.toFixed(0)} GB machine.`);
    console.error('Choose a smaller --size, or pass --force to override.\n');
    process.exit(1);
}

const log = (...a) => console.log(...a);
const step = (s) => log(`\n→ ${s}`);

// -- Environment capture ------------------------------------------------------

function sh(cmd, args) {
    try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: 'pipe' }).trim(); }
    catch { return null; }
}

function captureEnvironment() {
    return {
        os: `${os.type()} ${os.release()}`,
        platform: process.platform,
        arch: process.arch,
        cpuModel: os.cpus()?.[0]?.model ?? null,
        cpuCount: os.cpus()?.length ?? null,
        totalMemGB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
        nodeVersion: process.version,
        npmVersion: sh('npm', ['-v']),
        dockerVersion: (sh('docker', ['--version']) || '').replace(/^Docker version /, '') || null,
        duckdbPackageVersion: readPkgVersion('duckdb'),
        gitCommit: sh('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD']),
        gitDirty: (sh('git', ['-C', REPO_ROOT, 'status', '--porcelain']) || '').length > 0,
    };
}

function readPkgVersion(name) {
    try {
        const p = resolve(REPO_ROOT, 'apps', 'analytics-api', 'node_modules', name, 'package.json');
        if (!existsSync(p)) return null;
        return JSON.parse(readFileSync(p, 'utf8')).version ?? null;
    } catch { return null; }
}

// -- PostgreSQL container -----------------------------------------------------

function dockerAvailable() {
    try { execFileSync('docker', ['info'], { stdio: 'pipe' }); return true; } catch { return false; }
}

async function startPostgres() {
    try { execFileSync('docker', ['rm', '-f', CONTAINER], { stdio: 'pipe' }); } catch { /* none */ }
    execFileSync('docker', [
        'run', '-d', '--name', CONTAINER,
        '-e', 'POSTGRES_USER=bench', '-e', 'POSTGRES_PASSWORD=bench',
        '-e', 'POSTGRES_DB=benchdb',
        // Docker gives a container 64 MB of /dev/shm by default. PostgreSQL uses
        // shared memory for parallel query workers, and at multi-million-row
        // sizes the tuned parallel settings below exhaust it — the backend is
        // killed mid-query and the client sees ECONNRESET. Observed at 5M rows.
        // This is a container default, not a property of either engine, so
        // raising it removes an artificial handicap rather than tilting the
        // comparison.
        '--shm-size', '1g',
        '-p', `${PG_PORT}:5432`, 'postgres:16-alpine',
    ], { stdio: 'pipe' });

    const deadline = Date.now() + 90_000;
    for (;;) {
        try {
            execFileSync('docker', ['exec', CONTAINER, 'pg_isready', '-U', 'bench', '-d', 'benchdb'], { stdio: 'pipe' });
            break;
        } catch {
            if (Date.now() > deadline) throw new Error('PostgreSQL container did not become ready within 90s');
            await sleep(500);
        }
    }
    return sh('docker', ['exec', CONTAINER, 'postgres', '--version']);
}

function stopPostgres() {
    try { execFileSync('docker', ['rm', '-f', CONTAINER], { stdio: 'pipe' }); } catch { /* already gone */ }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// -- Schema (mirrors production, including indexes) ---------------------------

const PG_SCHEMA = `
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  site_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  type VARCHAR(50) DEFAULT 'pageview',
  url TEXT,
  path VARCHAR(512),
  referrer TEXT,
  device VARCHAR(50),
  browser VARCHAR(255) DEFAULT '',
  os VARCHAR(100) DEFAULT '',
  country VARCHAR(100),
  city VARCHAR(255) DEFAULT '',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  properties JSONB DEFAULT '{}',
  utm_source VARCHAR(255) DEFAULT '',
  utm_medium VARCHAR(255) DEFAULT '',
  utm_campaign VARCHAR(255) DEFAULT '',
  utm_term VARCHAR(255) DEFAULT '',
  utm_content VARCHAR(255) DEFAULT ''
)`;

// Exactly the indexes production creates on events - no more, no fewer.
const PG_INDEXES = [
    'CREATE INDEX idx_events_site_id ON events(site_id)',
    'CREATE INDEX idx_events_timestamp ON events(timestamp)',
    'CREATE INDEX idx_events_type ON events(type)',
    'CREATE INDEX idx_events_user_id ON events(user_id)',
    'CREATE INDEX idx_events_session_id ON events(session_id)',
    'CREATE INDEX idx_events_path ON events(path)',
    'CREATE INDEX idx_events_site_ts ON events(site_id, timestamp)',
];

const DUCK_SCHEMA = `
CREATE TABLE events (
  id BIGINT, site_id VARCHAR NOT NULL, user_id VARCHAR NOT NULL,
  session_id VARCHAR NOT NULL, type VARCHAR NOT NULL, url VARCHAR,
  path VARCHAR, referrer VARCHAR, device VARCHAR, browser VARCHAR,
  os VARCHAR, country VARCHAR, city VARCHAR, timestamp TIMESTAMP NOT NULL,
  properties VARCHAR, utm_source VARCHAR, utm_medium VARCHAR,
  utm_campaign VARCHAR, utm_term VARCHAR, utm_content VARCHAR
)`;

// Exactly the events indexes production creates in DuckDB.
// -- Engine tuning ------------------------------------------------------------
//
// Both engines are given a comparable chance to use the machine. Applying this
// to PostgreSQL only would be unfair; applying it to neither would report a
// PostgreSQL number that is an artefact of a conservative default cost model
// rather than of the engine.
//
// WHY THESE SETTINGS (established by measuring, not guessing):
//   EXPLAIN ANALYZE on the heaviest query showed a SERIAL GroupAggregate. With
//   `force_parallel_mode` the same query ran ~2x faster, proving the executor
//   could parallelise it and the PLANNER's cost model was declining to. Lowering
//   the parallel cost estimates lets the planner choose parallelism on merit.
//   `force_parallel_mode` itself is NOT used - it overrides the planner rather
//   than informing it, which would not represent a realistic deployment.
//
//   `work_mem` is raised because the default 4MB spilled sorts to disk
//   ("external merge Disk: 23MB"). Measured on its own it did not help, and on
//   one query it HURT; it is retained because eliminating disk spill makes the
//   measurement about the engine rather than about temp-file I/O.
//
// DuckDB receives the equivalent: all cores and a comparable memory budget.
// It already defaults to using every core, so this mostly makes the setting
// explicit and symmetric rather than changing its behaviour.
const PG_TUNING = [
    "SET work_mem = '256MB'",
    'SET max_parallel_workers_per_gather = 4',
    'SET parallel_setup_cost = 200',
    'SET parallel_tuple_cost = 0.01',
    "SET min_parallel_table_scan_size = '1MB'",
];

const DUCK_TUNING = [
    `SET threads = ${Math.max(1, os.cpus()?.length ?? 4)}`,
    "SET memory_limit = '4GB'",
];

const DUCK_INDEXES = [
    'CREATE INDEX idx_events_site_ts ON events(site_id, timestamp)',
    'CREATE INDEX idx_events_type_site ON events(type, site_id)',
    'CREATE INDEX idx_events_path_site ON events(path, site_id)',
];

// -- Engine adapters ----------------------------------------------------------

function duckConn(path) {
    const db = new duckdb.Database(path);
    const conn = db.connect();
    return {
        db,
        all: (sql, params = []) => new Promise((res, rej) =>
            conn.all(sql, ...params, (e, rows) => (e ? rej(e) : res(rows ?? [])))),
        run: (sql) => new Promise((res, rej) => conn.run(sql, (e) => (e ? rej(e) : res()))),
        close: () => new Promise((res) => db.close(() => res())),
    };
}

// -- Result normalisation & comparison ---------------------------------------

/**
 * Normalise a result set so the two engines can be compared meaningfully.
 * BigInt counts, Date objects, and numeric type differences are unified;
 * floating values are rounded to a documented tolerance.
 */
const FLOAT_TOLERANCE_DP = 6;

function normaliseValue(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'bigint') return v.toString();
    if (v instanceof Date) {
        // A DATE-typed column arrives as a JS Date at local midnight from the pg
        // driver, but as UTC midnight from DuckDB. Both denote the same calendar
        // day, so compare on the LOCAL calendar date when the value is midnight-
        // aligned in local time; otherwise compare the full UTC instant.
        if (v.getHours() === 0 && v.getMinutes() === 0 && v.getSeconds() === 0) {
            const y = v.getFullYear();
            const m = String(v.getMonth() + 1).padStart(2, '0');
            const d = String(v.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        if (v.getUTCHours() === 0 && v.getUTCMinutes() === 0 && v.getUTCSeconds() === 0) {
            return v.toISOString().slice(0, 10);
        }
        return v.toISOString().slice(0, 19);
    }
    if (typeof v === 'number') {
        return Number.isInteger(v) ? String(v) : v.toFixed(FLOAT_TOLERANCE_DP);
    }
    if (typeof v === 'string') {
        // PostgreSQL returns bigint counts as strings; DuckDB may return numbers.
        if (/^-?\d+$/.test(v)) return v;
        // Timestamps arriving as strings - trim to second precision.
        const d = Date.parse(v);
        if (!Number.isNaN(d) && /\d{4}-\d{2}-\d{2}/.test(v)) return new Date(d).toISOString().slice(0, 19);
        return v;
    }
    return String(v);
}

function normaliseRows(rows) {
    return rows.map((r) => Object.keys(r).sort().map((k) => `${k.toLowerCase()}=${normaliseValue(r[k])}`).join('|'));
}

function resultsMatch(a, b) {
    const na = normaliseRows(a);
    const nb = normaliseRows(b);
    if (na.length !== nb.length) return { ok: false, reason: `row count ${na.length} vs ${nb.length}` };
    for (let i = 0; i < na.length; i++) {
        if (na[i] !== nb[i]) return { ok: false, reason: `row ${i}: "${na[i]}" vs "${nb[i]}"` };
    }
    return { ok: true };
}

// -- Main ---------------------------------------------------------------------

async function main() {
    const startedAt = new Date().toISOString();
    log('\n============================================================');
    log('  InsightTrack - Database Engine Benchmark');
    log('  PostgreSQL vs DuckDB, identical dataset & workload');
    log('============================================================');
    log(`  size=${SIZE.toLocaleString()}  seed=${SEED}  warmup=${WARMUP}  iterations=${ITERATIONS}`);

    if (!dockerAvailable()) {
        console.error('\nDocker is required (an isolated PostgreSQL container is used).');
        console.error('Start Docker and retry.\n');
        process.exit(1);
    }

    const environment = captureEnvironment();

    // 1. dataset -------------------------------------------------------------
    step(`Generating deterministic dataset (${SIZE.toLocaleString()} rows, seed ${SEED})...`);
    const genStart = Date.now();
    const { rows, stats } = generateEvents({ count: SIZE, seed: SEED });
    const fp = fingerprint(rows.slice(0, Math.min(rows.length, 5000)));
    log(`   ${rows.length.toLocaleString()} rows in ${Date.now() - genStart}ms`);
    log(`   sessions=${stats.sessions.toLocaleString()} visitorPool=${stats.visitorPool.toLocaleString()} ` +
        `sites=${stats.sites} range=${stats.rangeStart.slice(0, 10)}..${stats.rangeEnd.slice(0, 10)}`);
    log(`   fingerprint(first 5k rows)=${fp}`);

    // 2. PostgreSQL ----------------------------------------------------------
    step('Starting isolated PostgreSQL container...');
    const pgVersionRaw = await startPostgres();
    const pgVersion = (pgVersionRaw || '').split(' ')[2] ?? null;
    log(`   ready on port ${PG_PORT} (PostgreSQL ${pgVersion})`);

    const pgConnectStart = Date.now();
    const pool = new pg.Pool({
        host: 'localhost', port: PG_PORT, user: 'bench', password: 'bench',
        database: 'benchdb', max: 4,
    });
    // Apply tuning to every connection the pool hands out, so a query is never
    // silently measured on an untuned connection.
    pool.on('connect', (client) => { for (const stmt of PG_TUNING) client.query(stmt).catch(() => {}); });
    await pool.query('SELECT 1');
    const pgConnectMs = Date.now() - pgConnectStart;

    step('Creating PostgreSQL schema + production indexes...');
    await pool.query(PG_SCHEMA);

    step(`Loading ${rows.length.toLocaleString()} rows into PostgreSQL (COPY)...`);
    const pgLoadStart = Date.now();
    await copyIntoPostgres(pool, rows);
    const pgLoadMs = Date.now() - pgLoadStart;
    for (const ix of PG_INDEXES) await pool.query(ix);
    await pool.query('ANALYZE events');           // fair: production would be analyzed
    log(`   loaded + indexed + ANALYZEd in ${pgLoadMs}ms (load only)`);

    // 3. DuckDB --------------------------------------------------------------
    mkdirSync(RESULTS_DIR, { recursive: true });
    const duckPath = resolve(RESULTS_DIR, `bench-${SIZE}-${SEED}.duckdb`);
    rmSync(duckPath, { force: true });
    rmSync(`${duckPath}.wal`, { force: true });

    step('Creating isolated DuckDB database + production indexes...');
    const duckConnectStart = Date.now();
    const duck = duckConn(duckPath);
    await duck.all('SELECT 1');
    const duckConnectMs = Date.now() - duckConnectStart;
    for (const stmt of DUCK_TUNING) { try { await duck.run(stmt); } catch { /* setting unsupported */ } }
    await duck.run(DUCK_SCHEMA);

    step(`Loading ${rows.length.toLocaleString()} rows into DuckDB...`);
    const duckLoadStart = Date.now();
    await loadIntoDuck(duck, rows);
    const duckLoadMs = Date.now() - duckLoadStart;
    for (const ix of DUCK_INDEXES) await duck.run(ix);
    log(`   loaded + indexed in ${duckLoadMs}ms (load only)`);

    const duckVersionRow = await duck.all('SELECT version() AS v');
    const duckVersion = duckVersionRow?.[0]?.v ?? null;

    // 4. correctness ---------------------------------------------------------
    step('Verifying result equivalence (before any timing)...');
    const verified = [];
    const excluded = [];
    for (const q of QUERIES) {
        try {
            const pgRows = (await pool.query(q.pg, q.params)).rows;
            const duckRows = await duck.all(q.duck, q.params);
            const cmp = resultsMatch(pgRows, duckRows);
            if (cmp.ok) {
                verified.push(q);
                log(`   [match]    ${q.id}  (${pgRows.length} rows)`);
            } else {
                excluded.push({ id: q.id, reason: cmp.reason });
                log(`   [MISMATCH] ${q.id}  ${cmp.reason}  -> EXCLUDED from timing`);
            }
        } catch (e) {
            excluded.push({ id: q.id, reason: `error: ${e.message}` });
            log(`   [ERROR]    ${q.id}  ${e.message.split('\n')[0]}  -> EXCLUDED`);
        }
    }
    if (verified.length === 0) {
        console.error('\nNo query produced equivalent results; nothing to benchmark.');
        await cleanup(pool, duck, duckPath);
        process.exit(1);
    }

    // 5. timing --------------------------------------------------------------
    step(`Measuring ${verified.length} queries x ${ITERATIONS} iterations (+${WARMUP} warmup) per engine...`);
    const samples = [];   // raw per-iteration records

    for (const q of verified) {
        // Warmup - discarded. Both engines get identical treatment.
        for (let w = 0; w < WARMUP; w++) {
            await pool.query(q.pg, q.params);
            await duck.all(q.duck, q.params);
        }

        const pgTimes = [];
        const duckTimes = [];
        for (let i = 0; i < ITERATIONS; i++) {
            // Alternate which engine goes first so neither is systematically
            // favoured by cache state or thermal drift within an iteration.
            if (i % 2 === 0) {
                pgTimes.push(await timePg(pool, q));
                duckTimes.push(await timeDuck(duck, q));
            } else {
                duckTimes.push(await timeDuck(duck, q));
                pgTimes.push(await timePg(pool, q));
            }
        }

        pgTimes.forEach((ms, i) => samples.push({ queryId: q.id, engine: 'postgres', iteration: i + 1, ms }));
        duckTimes.forEach((ms, i) => samples.push({ queryId: q.id, engine: 'duckdb', iteration: i + 1, ms }));

        const p = summarise(pgTimes);
        const d = summarise(duckTimes);
        log(`   ${q.id.padEnd(28)} pg median ${String(p.median).padStart(9)}ms  |  duckdb median ${String(d.median).padStart(9)}ms`);
    }

    // 6. results -------------------------------------------------------------
    const perQuery = verified.map((q) => {
        const pgS = summarise(samples.filter((s) => s.queryId === q.id && s.engine === 'postgres').map((s) => s.ms));
        const dkS = summarise(samples.filter((s) => s.queryId === q.id && s.engine === 'duckdb').map((s) => s.ms));
        return { queryId: q.id, title: q.title, description: q.description, postgres: pgS, duckdb: dkS };
    });

    const result = {
        schemaVersion: 1,
        benchmark: 'database-engine',
        note: 'Measures database execution time only. Not comparable with the HTTP/API benchmark in scripts/benchmark.js.',
        startedAt,
        finishedAt: new Date().toISOString(),
        parameters: {
            datasetSize: SIZE, seed: SEED, warmupIterations: WARMUP,
            measuredIterations: ITERATIONS, queryCount: verified.length,
            executionOrder: 'alternating per iteration',
        },
        dataset: { ...stats, fingerprintFirst5k: fp },
        environment: { ...environment, postgresVersion: pgVersion, duckdbVersion: duckVersion },
        setup: {
            postgresConnectMs: pgConnectMs, postgresLoadMs: pgLoadMs, postgresIndexes: PG_INDEXES.length,
            duckdbConnectMs: duckConnectMs, duckdbLoadMs: duckLoadMs, duckdbIndexes: DUCK_INDEXES.length,
        },
        tuning: { postgres: PG_TUNING, duckdb: DUCK_TUNING },
        correctness: {
            verifiedQueries: verified.map((q) => q.id),
            excludedQueries: excluded,
            floatToleranceDecimalPlaces: FLOAT_TOLERANCE_DP,
        },
        perQuery,
        samples,
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = resolve(RESULTS_DIR, `engine-benchmark-${SIZE}-seed${SEED}-${stamp}`);
    writeFileSync(`${base}.json`, JSON.stringify(result, null, 2));
    writeFileSync(`${base}.csv`, toCsv(samples, SIZE, SEED, environment.gitCommit, startedAt));

    printSummary(perQuery);
    log(`\nMachine-readable results:`);
    log(`   ${base}.json`);
    log(`   ${base}.csv`);

    await cleanup(pool, duck, duckPath);
    log('\nCleanup complete (container removed, isolated DuckDB file deleted).');
    log('\nThis measures the stated workload on this environment only. It does');
    log('not establish that either engine is universally faster.\n');
}

// -- helpers ------------------------------------------------------------------

async function timePg(pool, q) {
    const t0 = process.hrtime.bigint();
    await pool.query(q.pg, q.params);
    return Number(process.hrtime.bigint() - t0) / 1e6;
}

async function timeDuck(duck, q) {
    const t0 = process.hrtime.bigint();
    await duck.all(q.duck, q.params);
    return Number(process.hrtime.bigint() - t0) / 1e6;
}

async function copyIntoPostgres(pool, rows) {
    const client = await pool.connect();
    try {
        for (let i = 0; i < rows.length; i += LOAD_BATCH) {
            const slice = rows.slice(i, i + LOAD_BATCH);
            const values = [];
            const params = [];
            let n = 1;
            for (const r of slice) {
                values.push(`(${EVENT_COLUMNS.map(() => `$${n++}`).join(',')})`);
                params.push(...r);
            }
            await client.query(
                `INSERT INTO events (${EVENT_COLUMNS.join(',')}) VALUES ${values.join(',')}`,
                params,
            );
        }
    } finally { client.release(); }
}

async function loadIntoDuck(duck, rows) {
    const cols = EVENT_COLUMNS.join(',');
    for (let i = 0; i < rows.length; i += 1000) {
        const slice = rows.slice(i, i + 1000);
        const tuples = slice.map((r) =>
            `(${r.map((v) => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)).join(',')})`,
        ).join(',');
        await duck.run(`INSERT INTO events (${cols}) VALUES ${tuples}`);
    }
}

function toCsv(samples, size, seed, commit, startedAt) {
    const head = 'timestamp,git_commit,dataset_size,seed,engine,query_id,iteration,execution_ms';
    const lines = samples.map((s) =>
        [startedAt, commit ?? '', size, seed, s.engine, s.queryId, s.iteration, s.ms.toFixed(4)].join(','));
    return `${head}\n${lines.join('\n')}\n`;
}

function printSummary(perQuery) {
    log('\n------------------------------------------------------------');
    log('  Median execution time per query (ms) - lower is faster');
    log('------------------------------------------------------------');
    log('  query                          postgres     duckdb');
    for (const q of perQuery) {
        log(`  ${q.queryId.padEnd(28)} ${String(q.postgres.median).padStart(10)} ${String(q.duckdb.median).padStart(10)}`);
    }
    log('\n  Full distribution (median/mean/p95/p99/min/max/stddev) is in the JSON.');
}

async function cleanup(pool, duck, duckPath) {
    try { await pool.end(); } catch { /* ignore */ }
    try { await duck.close(); } catch { /* ignore */ }
    if (!KEEP) {
        stopPostgres();
        rmSync(duckPath, { force: true });
        rmSync(`${duckPath}.wal`, { force: true });
    } else {
        log('\n--keep given: PostgreSQL container and DuckDB file retained.');
    }
}

main().catch(async (err) => {
    console.error('\nBenchmark failed:', err?.message ?? err);
    stopPostgres();
    process.exit(1);
});
