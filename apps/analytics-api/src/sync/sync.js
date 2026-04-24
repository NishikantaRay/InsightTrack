/**
 * Incremental data sync: PostgreSQL → DuckDB
 *
 * For each configured table the syncer:
 *  1. Reads the last-synced timestamp from _sync_meta
 *  2. Pulls new/updated rows from PostgreSQL (WHERE ts > last_synced)
 *  3. Upserts them into DuckDB (DELETE existing + INSERT) to handle updates
 *  4. Updates _sync_meta with the new high-water mark
 *
 * Modes:
 *  - Incremental (default): Only sync rows newer than last high-water mark.
 *  - Full (--full flag or fullSync option): Truncate DuckDB tables and re-sync everything.
 *
 * First run does a full sync (last_synced defaults to epoch).
 */

import { duckRun, duckAll, closeDuck } from '../db/duckdb.js';
import { getPgPool, closePg } from '../db/postgres.js';
import { SCHEMA_SQL, SYNCABLE_TABLES } from '../schema/schema.js';

const BATCH_SIZE = Number(process.env.SYNC_BATCH_SIZE) || 5_000;
const EPOCH = '1970-01-01T00:00:00.000Z';

// Prevent concurrent syncs
let _syncRunning = false;

// ─── helpers ─────────────────────────────────────────────────────

async function ensureSchema() {
    const statements = SCHEMA_SQL.split(';')
        .map((s) => s.trim())
        .filter(Boolean);
    for (const stmt of statements) {
        await duckRun(stmt);
    }
}

async function getLastSynced(table) {
    const rows = await duckAll(
        `SELECT last_synced FROM _sync_meta WHERE table_name = ?`,
        [table],
    );
    return rows.length > 0 ? rows[0].last_synced : EPOCH;
}

async function upsertSyncMeta(table, lastSynced, rowsSynced) {
    await duckRun(`DELETE FROM _sync_meta WHERE table_name = ?`, [table]);
    await duckRun(
        `INSERT INTO _sync_meta (table_name, last_synced, rows_synced, updated_at)
     VALUES (?, ?, ?, current_timestamp)`,
        [table, lastSynced, rowsSynced],
    );
}

// ─── column discovery ────────────────────────────────────────────

async function getColumns(table) {
    const pg = getPgPool();
    const { rows } = await pg.query(
        `SELECT column_name FROM information_schema.columns
     WHERE table_name = $1 AND table_schema = 'public'
     ORDER BY ordinal_position`,
        [table],
    );
    return rows.map((r) => r.column_name);
}

// ─── value serialisation ─────────────────────────────────────────

export function serialise(val) {
    if (val === null || val === undefined) return null;
    if (val instanceof Date) return val.toISOString();
    if (Array.isArray(val) || typeof val === 'object') return JSON.stringify(val);
    return val;
}

// ─── per-table sync ──────────────────────────────────────────────

async function syncTable(cfg, { forceFullSync = false } = {}) {
    const { table, tsColumn, idColumn } = cfg;
    const columns = await getColumns(table);
    if (columns.length === 0) {
        console.log(`  ⚠  Table "${table}" not found in PostgreSQL — skipping`);
        return 0;
    }

    // Full resync: truncate DuckDB table and reset high-water mark
    if (forceFullSync) {
        await duckRun(`DELETE FROM ${table}`);
        await duckRun(`DELETE FROM _sync_meta WHERE table_name = ?`, [table]);
    }

    const lastSynced = forceFullSync ? EPOCH : await getLastSynced(table);
    const colList = columns.join(', ');
    const pg = getPgPool();

    const countRes = await pg.query(
        `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${tsColumn} > $1`,
        [lastSynced],
    );
    const totalNew = Number(countRes.rows[0].cnt);
    if (totalNew === 0) {
        console.log(`  ✓  ${table}: already up-to-date`);
        return 0;
    }

    let synced = 0;
    let highWater = lastSynced;
    let offset = 0;

    while (offset < totalNew) {
        const { rows } = await pg.query(
            `SELECT ${colList} FROM ${table}
       WHERE ${tsColumn} > $1
       ORDER BY ${tsColumn} ASC
       LIMIT $2 OFFSET $3`,
            [lastSynced, BATCH_SIZE, offset],
        );

        if (rows.length === 0) break;

        const placeholders = columns.map(() => '?').join(', ');
        const insertSQL = `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`;

        for (const row of rows) {
            // Upsert: delete existing row by ID before inserting updated version
            if (idColumn && row[idColumn] != null) {
                await duckRun(
                    `DELETE FROM ${table} WHERE ${idColumn} = ?`,
                    [serialise(row[idColumn])],
                );
            }

            const vals = columns.map((c) => serialise(row[c]));
            await duckRun(insertSQL, vals);
        }

        const lastRow = rows[rows.length - 1];
        highWater = lastRow[tsColumn]?.toISOString?.()
            ?? String(lastRow[tsColumn]);

        synced += rows.length;
        offset += rows.length;
        process.stdout.write(
            `  ↳  ${table}: ${synced}/${totalNew} rows synced\r`,
        );
    }

    await upsertSyncMeta(table, highWater, synced);
    console.log(`  ✓  ${table}: ${synced} rows synced (high-water: ${highWater})`);
    return synced;
}

// ─── full sync orchestrator ──────────────────────────────────────

/**
 * Run the sync.
 * @param {{ fullSync?: boolean, silent?: boolean }} options
 */
export async function runSync({ fullSync = false, silent = false } = {}) {
    if (_syncRunning) {
        if (!silent) console.log('⏳ Sync already in progress — skipping');
        return 0;
    }
    _syncRunning = true;

    try {
        if (!silent) {
            console.log('');
            console.log('╔══════════════════════════════════════════════╗');
            console.log('║   InsightTrack · PostgreSQL → DuckDB Sync   ║');
            console.log('╚══════════════════════════════════════════════╝');
            console.log('');
            if (fullSync) console.log('🔄 Full re-sync requested — all tables will be rebuilt\n');
        }

        if (!silent) console.log('① Ensuring DuckDB schema…');
        await ensureSchema();

        if (!silent) console.log('② Syncing tables…');
        let totalRows = 0;
        for (const cfg of SYNCABLE_TABLES) {
            const n = await syncTable(cfg, { forceFullSync: fullSync });
            totalRows += n;
        }

        if (!silent) {
            console.log('');
            console.log(`✅ Sync complete — ${totalRows} total rows synced.`);
        }
        return totalRows;
    } finally {
        _syncRunning = false;
    }
}

/**
 * Full re-sync — truncates DuckDB tables and re-imports everything from PG.
 */
export async function runFullSync({ silent = false } = {}) {
    return runSync({ fullSync: true, silent });
}

// ─── CLI entry point ─────────────────────────────────────────────

const isCLI = process.argv[1]?.includes('sync');
if (isCLI) {
    const fullSync = process.argv.includes('--full');
    runSync({ fullSync })
        .catch((err) => {
            console.error('❌ Sync failed:', err);
            process.exit(1);
        })
        .finally(async () => {
            await closeDuck();
            await closePg();
        });
}
