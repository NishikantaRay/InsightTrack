/**
 * Vitest global setup — provisions an ephemeral PostgreSQL for the test run.
 *
 * The DB-backed suites used to require a manually-created `analytics_db` on the
 * developer's own port 5432, so a clean checkout produced 10 failing files and
 * 133 skipped tests. Worse, testHelper cleans by pattern (DELETE ... LIKE
 * 'site_test%'), so pointing tests at a real database risked deleting live rows.
 *
 * This starts a throwaway `postgres:15-alpine` container — the same image as
 * docker-compose.yml — on an unused port, and removes it afterwards. Nothing
 * touches the developer's own PostgreSQL.
 *
 * If Docker is unavailable the setup does NOT fail the run: it leaves the
 * existing PG_* environment in place so an already-provisioned database still
 * works, and prints what it did. Set TEST_PG_EXTERNAL=1 to skip the container
 * entirely and use whatever PG_* points at.
 */
import { execFileSync } from 'node:child_process';

const CONTAINER = 'insighttrack-test-pg';
const PORT = process.env.TEST_PG_PORT || '55433';
const USER = 'analytics';
const PASSWORD = 'analytics123';
const DATABASE = 'analytics_db';

let startedContainer = false;

function docker(args, opts = {}) {
    return execFileSync('docker', args, { stdio: 'pipe', encoding: 'utf8', ...opts });
}

function dockerAvailable() {
    try {
        docker(['info']);
        return true;
    } catch {
        return false;
    }
}

export async function setup() {
    // Tests need a JWT secret; authService throws at import time without one.
    process.env.JWT_SECRET ||= 'test-jwt-secret';
    process.env.NODE_ENV ||= 'test';

    // Give the run its own DuckDB file. The dev database persists between runs
    // while the PostgreSQL container above is recreated each time, so a shared
    // file carries a stale `_sync_meta` keyset cursor: PG ids restart low, fall
    // below the cursor, and never sync. An isolated file also means tests never
    // touch the developer's analytics data.
    process.env.DUCKDB_PATH ||= `duckdb/test-${process.pid}.duckdb`;

    if (process.env.TEST_PG_EXTERNAL === '1') {
        console.log('[test-db] TEST_PG_EXTERNAL=1 — using the existing PG_* configuration.');
        return;
    }

    if (!dockerAvailable()) {
        console.warn(
            '[test-db] Docker is not available — falling back to the existing PG_* configuration.\n' +
            '[test-db] DB-backed suites will fail unless PostgreSQL is already running.\n' +
            '[test-db] Start Docker, or set PG_HOST/PG_PORT/PG_USER/PG_PASSWORD/PG_DATABASE yourself.'
        );
        return;
    }

    // Remove a container left behind by an interrupted previous run.
    try { docker(['rm', '-f', CONTAINER]); } catch { /* nothing to remove */ }

    console.log(`[test-db] starting ephemeral postgres:15-alpine on port ${PORT}…`);
    docker([
        'run', '-d', '--name', CONTAINER,
        '-e', `POSTGRES_USER=${USER}`,
        '-e', `POSTGRES_PASSWORD=${PASSWORD}`,
        '-e', `POSTGRES_DB=${DATABASE}`,
        '-p', `${PORT}:5432`,
        'postgres:15-alpine',
    ]);
    startedContainer = true;

    // Wait for readiness — pg_isready, same check docker-compose.yml uses.
    const deadline = Date.now() + 60_000;
    for (;;) {
        try {
            docker(['exec', CONTAINER, 'pg_isready', '-U', USER, '-d', DATABASE]);
            break;
        } catch {
            if (Date.now() > deadline) {
                throw new Error('[test-db] PostgreSQL container did not become ready within 60s');
            }
            await new Promise((r) => setTimeout(r, 500));
        }
    }

    // Point the app's DB layer at the container. DATABASE_URL is cleared so it
    // cannot take precedence over these (createPool prefers it when set).
    delete process.env.DATABASE_URL;
    process.env.PG_HOST = 'localhost';
    process.env.PG_PORT = PORT;
    process.env.PG_USER = USER;
    process.env.PG_PASSWORD = PASSWORD;
    process.env.PG_DATABASE = DATABASE;

    console.log('[test-db] ready.');
}

export async function teardown() {
    // Remove the throwaway DuckDB file (and its WAL) created for this run.
    if (process.env.DUCKDB_PATH?.includes('/test-')) {
        const { rmSync } = await import('node:fs');
        const { resolve } = await import('node:path');
        for (const suffix of ['', '.wal']) {
            try { rmSync(resolve(process.env.DUCKDB_PATH + suffix), { force: true }); } catch { /* already gone */ }
        }
    }

    if (!startedContainer) return;
    try {
        docker(['rm', '-f', CONTAINER]);
        console.log('[test-db] ephemeral PostgreSQL removed.');
    } catch (err) {
        console.warn(`[test-db] could not remove ${CONTAINER}:`, err.message);
    }
}
