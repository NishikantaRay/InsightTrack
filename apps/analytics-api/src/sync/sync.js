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

import { duckRun, duckAll, duckBulkInsert, closeDuck } from '../db/duckdb.js';
import { getPgPool, closePg } from '../db/postgres.js';
import { SCHEMA_SQL, SYNCABLE_TABLES } from '../schema/schema.js';
import { s3Enabled, archiveAllToS3, refreshUnifiedViews } from '../storage/s3.js';

// ─── Daily rollup ─────────────────────────────────────────────────────────────
// Aggregates raw events into daily_stats (one row per site per day).
// Runs after every sync so the row count in daily_stats tracks new data.
// KPI and traffic queries use daily_stats for date ranges > 1 day,
// cutting 100M-row full scans to microsecond point reads.

async function computeDailyRollups({ silent = false } = {}) {
    // Find the most recent date already in daily_stats so we only recompute
    // days that have new event data (avoid full recompute on every sync).
    const lastRollup = await duckAll(
        `SELECT MAX(date) AS last_date FROM daily_stats`
    );
    const lastDate = lastRollup[0]?.last_date
        ? new Date(lastRollup[0].last_date)
        : new Date('1970-01-01');

    // Compute for all days from lastDate up to (but not including) today —
    // today is always queried from raw events so we get live numbers.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fromDate = new Date(lastDate);
    fromDate.setDate(fromDate.getDate() + 1); // day after last rollup

    if (fromDate >= today) {
        if (!silent) console.log('   ✓ daily_stats already up-to-date');
        return;
    }

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr   = new Date(today.getTime() - 86400000).toISOString().split('T')[0];

    if (!silent) process.stdout.write(`   Computing daily_stats ${fromStr} → ${toStr}…\r`);

    // Upsert: delete then re-insert for any day in range (handles late-arriving events)
    await duckRun(
        `DELETE FROM daily_stats WHERE date >= ? AND date <= ?`,
        [fromStr, toStr],
    );

    await duckRun(
        `INSERT INTO daily_stats (site_id, date, visitors, sessions, pageviews, bounces, avg_duration, computed_at)
         SELECT
           site_id,
           CAST(timestamp AS DATE)                                       AS date,
           COUNT(DISTINCT user_id)                                       AS visitors,
           COUNT(DISTINCT session_id)                                    AS sessions,
           COUNT(CASE WHEN type = 'pageview' THEN 1 END)                AS pageviews,
           0                                                             AS bounces,
           0.0                                                           AS avg_duration,
           current_timestamp                                             AS computed_at
         FROM events
         WHERE CAST(timestamp AS DATE) >= ?
           AND CAST(timestamp AS DATE) <= ?
         GROUP BY site_id, CAST(timestamp AS DATE)`,
        [fromStr, toStr],
    );

    const inserted = await duckAll(
        `SELECT COUNT(*) AS cnt FROM daily_stats WHERE date >= ? AND date <= ?`,
        [fromStr, toStr],
    );
    if (!silent) console.log(`   ✓ daily_stats: ${inserted[0]?.cnt ?? 0} day×site rows computed`);
}

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
    // Migration for DBs created before the keyset cursor column existed.
    try {
        await duckRun(`ALTER TABLE _sync_meta ADD COLUMN IF NOT EXISTS last_id BIGINT DEFAULT 0`);
    } catch { /* older DuckDB without IF NOT EXISTS — ignore if already present */ }
}

// Timestamp watermark for mutable tables.
async function getLastSynced(table) {
    const rows = await duckAll(
        `SELECT last_synced FROM _sync_meta WHERE table_name = ?`,
        [table],
    );
    return rows.length > 0 ? rows[0].last_synced : EPOCH;
}

// Keyset id cursor for append-only tables (stored in its own BIGINT column so
// it never collides with the TIMESTAMP last_synced).
async function getLastId(table) {
    const rows = await duckAll(
        `SELECT last_id FROM _sync_meta WHERE table_name = ?`,
        [table],
    );
    return rows.length > 0 ? Number(rows[0].last_id ?? 0) : 0;
}

async function upsertSyncMeta(table, lastSynced, rowsSynced, lastId = 0) {
    await duckRun(`DELETE FROM _sync_meta WHERE table_name = ?`, [table]);
    await duckRun(
        `INSERT INTO _sync_meta (table_name, last_synced, last_id, rows_synced, updated_at)
     VALUES (?, ?, ?, ?, current_timestamp)`,
        [table, lastSynced, lastId, rowsSynced],
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
    const { table, tsColumn, idColumn, appendOnly = false } = cfg;
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

    const colList = columns.join(', ');
    const pg = getPgPool();

    // Append-only tables use keyset pagination on the monotonic id cursor and
    // persist the watermark after EACH batch. This makes the bulk-insert path
    // both crash-safe (a re-run resumes from the last committed batch instead of
    // re-inserting already-synced rows) and immune to OFFSET drift / equal-
    // timestamp gaps when new rows arrive mid-sync. Requires a numeric idColumn.
    const useKeyset = appendOnly && !!idColumn;

    // Cursors: keyset tables track the highest synced id (its own column);
    // mutable tables track the last synced timestamp. forceFullSync already
    // truncated the table + cleared _sync_meta, so both start from zero/EPOCH.
    let cursorId = useKeyset && !forceFullSync ? await getLastId(table) : 0;
    const lastSynced = useKeyset || forceFullSync ? EPOCH : await getLastSynced(table);

    const countRes = await pg.query(
        useKeyset
            ? `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${idColumn} > $1`
            : `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${tsColumn} > $1`,
        [useKeyset ? cursorId : lastSynced],
    );
    const totalNew = Number(countRes.rows[0].cnt);
    if (totalNew === 0) {
        console.log(`  ✓  ${table}: already up-to-date`);
        return 0;
    }

    let synced = 0;
    let highWater = lastSynced;   // timestamp watermark (mutable tables)
    let offset = 0;

    while (true) {
        let rows;
        if (useKeyset) {
            ({ rows } = await pg.query(
                `SELECT ${colList} FROM ${table}
       WHERE ${idColumn} > $1
       ORDER BY ${idColumn} ASC
       LIMIT $2`,
                [cursorId, BATCH_SIZE],
            ));
        } else {
            ({ rows } = await pg.query(
                `SELECT ${colList} FROM ${table}
       WHERE ${tsColumn} > $1
       ORDER BY ${tsColumn} ASC
       LIMIT $2 OFFSET $3`,
                [lastSynced, BATCH_SIZE, offset],
            ));
        }

        if (rows.length === 0) break;

        if (appendOnly) {
            // Append-only tables (e.g. events) are immutable: collapse the whole
            // batch into a single bulk INSERT (~50-100× faster than row-by-row).
            const values = rows.map((row) => columns.map((c) => serialise(row[c])));
            await duckBulkInsert(table, columns, values);
        } else {
            // Mutable tables: upsert (DELETE existing by id, then INSERT) so
            // edited rows (sites, goals, dashboards, …) stay in sync.
            const placeholders = columns.map(() => '?').join(', ');
            const insertSQL = `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`;

            for (const row of rows) {
                if (idColumn && row[idColumn] != null) {
                    await duckRun(
                        `DELETE FROM ${table} WHERE ${idColumn} = ?`,
                        [serialise(row[idColumn])],
                    );
                }
                const vals = columns.map((c) => serialise(row[c]));
                await duckRun(insertSQL, vals);
            }
        }

        const lastRow = rows[rows.length - 1];
        if (useKeyset) {
            // Advance + persist the id cursor after every committed batch so a
            // crash mid-table never re-inserts what we already wrote.
            // last_synced stays EPOCH (unused for keyset); the cursor lives in last_id.
            cursorId = Number(lastRow[idColumn]);
            synced += rows.length;
            await upsertSyncMeta(table, EPOCH, synced, cursorId);
            process.stdout.write(`  ↳  ${table}: ${synced} rows synced\r`);
            if (rows.length < BATCH_SIZE) break; // last page
            continue;
        }

        highWater = lastRow[tsColumn]?.toISOString?.()
            ?? String(lastRow[tsColumn]);
        synced += rows.length;
        offset += rows.length;
        process.stdout.write(`  ↳  ${table}: ${synced} rows synced\r`);
        if (offset >= totalNew) break;
    }

    // Keyset tables already persisted their cursor after each batch (above);
    // only mutable tables need the final timestamp-watermark write here.
    if (!useKeyset) {
        await upsertSyncMeta(table, highWater, synced);
    }
    const mark = useKeyset ? `id ${cursorId}` : highWater;
    console.log(`  ✓  ${table}: ${synced} rows synced (high-water: ${mark})`);
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
            console.log('║   InsightsTrack · PostgreSQL → DuckDB Sync   ║');
            console.log('╚══════════════════════════════════════════════╝');
            console.log('');
            if (fullSync) console.log('🔄 Full re-sync requested — all tables will be rebuilt\n');
        }

        if (!silent) console.log('① Ensuring DuckDB schema…');
        await ensureSchema();

        if (!silent) console.log('② Syncing tables…');
        let totalRows = 0;
        for (const cfg of SYNCABLE_TABLES) {
            try {
                const n = await syncTable(cfg, { forceFullSync: fullSync });
                totalRows += n;
            } catch (tableErr) {
                console.error(`  ✗  Failed to sync table "${cfg.table}":`, tableErr.message);
                // Continue syncing remaining tables
            }
        }

        // ③ Compute daily rollups into daily_stats for any day with new data.
        //    KPI/traffic queries use daily_stats for historical ranges (> today)
        //    which reduces 100M-row scans to < 1ms table reads.
        if (!silent) console.log('③ Computing daily rollups…');
        try {
            await computeDailyRollups({ silent });
        } catch (rollupErr) {
            console.error('   ✗ Daily rollup failed (non-fatal):', rollupErr.message);
        }

        // ④ Archive old rows to S3/R2 cold storage (only when S3 is configured)
        if (s3Enabled()) {
            if (!silent) console.log('③ Archiving cold data to S3…');
            try {
                const archived = await archiveAllToS3({ silent });
                await refreshUnifiedViews({ silent });
                if (!silent && archived > 0) {
                    console.log(`   ✓ ${archived} partition(s) archived to cold storage`);
                }
            } catch (archiveErr) {
                // Archive failures are non-fatal — hot DuckDB still works
                console.error('   ✗ S3 archive failed (non-fatal):', archiveErr.message);
            }
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
