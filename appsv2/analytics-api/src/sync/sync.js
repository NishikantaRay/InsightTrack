/**
 * Hot + Cold Incremental Sync: PostgreSQL → DuckDB hot tables + Parquet cold partitions
 *
 * Strategy:
 *  1. Read watermark (last_event_id + last_synced) from DuckDB _sync_meta
 *  2. Pull new rows from PostgreSQL in batches (bounded by last_event_id for events)
 *  3. Upsert recent rows into DuckDB hot tables (events_hot / sessions_hot)
 *  4. Write rows older than HOT_DAYS directly to Parquet cold partitions
 *  5. Evict stale rows from hot tables into Parquet
 *  6. Advance watermark only after all writes succeed
 *
 * Parquet layout:
 *   data-lake/
 *     events/site_id=<id>/event_date=<YYYY-MM-DD>/part-0001.parquet
 *     sessions/site_id=<id>/session_date=<YYYY-MM-DD>/part-0001.parquet
 */

import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { duckRun, duckAll, closeDuck } from '../db/duckdb.js';
import { getPgPool } from '../db/postgres.js';
import { SCHEMA_SQL, SYNCABLE_TABLES, HOT_DAYS } from '../schema/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_LAKE = path.resolve(__dirname, '..', '..', 'data-lake');
const BATCH_SIZE = Number(process.env.SYNC_BATCH_SIZE) || 5_000;
const EPOCH = '1970-01-01T00:00:00.000Z';

let _syncRunning = false;

// ─── schema ──────────────────────────────────────────────────────

async function ensureSchema() {
    const statements = SCHEMA_SQL.split(';')
        .map((s) => s.trim())
        .filter(Boolean);
    for (const stmt of statements) {
        await duckRun(stmt);
    }
    mkdirSync(DATA_LAKE, { recursive: true });
}

// ─── watermark helpers ───────────────────────────────────────────

async function getSyncMeta(table) {
    const rows = await duckAll(
        `SELECT last_synced, last_event_id FROM _sync_meta WHERE table_name = ?`,
        [table],
    );
    return rows.length > 0
        ? { lastSynced: rows[0].last_synced, lastEventId: Number(rows[0].last_event_id ?? 0) }
        : { lastSynced: EPOCH, lastEventId: 0 };
}

async function upsertSyncMeta(table, lastSynced, lastEventId, rowsSynced) {
    await duckRun(`DELETE FROM _sync_meta WHERE table_name = ?`, [table]);
    await duckRun(
        `INSERT INTO _sync_meta (table_name, last_synced, last_event_id, rows_synced, updated_at)
         VALUES (?, ?, ?, ?, current_timestamp)`,
        [table, lastSynced, lastEventId, rowsSynced],
    );
}

// ─── column discovery ────────────────────────────────────────────

async function getColumns(pgTable) {
    const pg = getPgPool();
    const { rows } = await pg.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = $1 AND table_schema = 'public'
         ORDER BY ordinal_position`,
        [pgTable],
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

// ─── Parquet cold write ──────────────────────────────────────────

async function writeColdParquet(subDir, dateColAlias, site_id, dateStr, stagingTable) {
    const partDir = path.join(DATA_LAKE, subDir, `site_id=${site_id}`, `${dateColAlias}=${dateStr}`);
    mkdirSync(partDir, { recursive: true });
    const partFile = path.join(partDir, 'part-0001.parquet');
    await duckRun(`COPY (SELECT * FROM ${stagingTable}) TO ? (FORMAT PARQUET)`, [partFile]);
}

// ─── cold eviction from hot tables ───────────────────────────────

async function exportColdPartitions(hotTable, dateCol) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - HOT_DAYS);
    const cutoffStr = cutoff.toISOString();

    const partitions = await duckAll(
        `SELECT DISTINCT site_id, CAST(${dateCol} AS DATE) AS part_date
         FROM ${hotTable}
         WHERE ${dateCol} < ?
         ORDER BY part_date`,
        [cutoffStr],
    );

    if (partitions.length === 0) return 0;

    const subDir = hotTable === 'events_hot' ? 'events' : 'sessions';
    const dateColAlias = hotTable === 'events_hot' ? 'event_date' : 'session_date';
    let exported = 0;

    for (const { site_id, part_date } of partitions) {
        const dateStr = part_date instanceof Date
            ? part_date.toISOString().split('T')[0]
            : String(part_date).split('T')[0];

        const partDir = path.join(DATA_LAKE, subDir, `site_id=${site_id}`, `${dateColAlias}=${dateStr}`);
        mkdirSync(partDir, { recursive: true });
        const partFile = path.join(partDir, 'part-0001.parquet');

        await duckRun(
            `COPY (
               SELECT * FROM ${hotTable}
               WHERE site_id = ? AND CAST(${dateCol} AS DATE) = ?
             ) TO ? (FORMAT PARQUET)`,
            [site_id, dateStr, partFile],
        );

        await duckRun(
            `DELETE FROM ${hotTable}
             WHERE site_id = ? AND CAST(${dateCol} AS DATE) = ?`,
            [site_id, dateStr],
        );

        exported++;
    }

    return exported;
}

// ─── hot-cold table sync ─────────────────────────────────────────

async function syncHotColdTable(cfg, { forceFullSync = false } = {}) {
    const { table, duckTable, tsColumn } = cfg;
    const isEvents = table === 'events';
    const columns = await getColumns(table);
    if (columns.length === 0) {
        console.log(`  ⚠  Table "${table}" not found in PostgreSQL — skipping`);
        return 0;
    }

    if (forceFullSync) {
        await duckRun(`DELETE FROM ${duckTable}`);
        await duckRun(`DELETE FROM _sync_meta WHERE table_name = ?`, [table]);
    }

    const { lastSynced, lastEventId } = await getSyncMeta(table);
    const pg = getPgPool();

    let countRes;
    if (isEvents) {
        countRes = await pg.query(`SELECT COUNT(*) AS cnt FROM ${table} WHERE id > $1`, [lastEventId]);
    } else {
        countRes = await pg.query(`SELECT COUNT(*) AS cnt FROM ${table} WHERE ${tsColumn} > $1`, [lastSynced]);
    }

    const totalNew = Number(countRes.rows[0].cnt);
    if (totalNew === 0) {
        console.log(`  ✓  ${table}: already up-to-date`);
        return 0;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - HOT_DAYS);

    let synced = 0;
    let highWaterTs = lastSynced;
    let highWaterEventId = lastEventId;
    let offset = 0;

    const subDir = table === 'events' ? 'events' : 'sessions';
    const dateColAlias = table === 'events' ? 'event_date' : 'session_date';
    const colList = columns.join(', ');
    const placeholders = columns.map(() => '?').join(', ');

    while (offset < totalNew) {
        let pgRows;
        if (isEvents) {
            const { rows } = await pg.query(
                `SELECT * FROM ${table} WHERE id > $1 ORDER BY id ASC LIMIT $2 OFFSET $3`,
                [lastEventId, BATCH_SIZE, offset],
            );
            pgRows = rows;
        } else {
            const { rows } = await pg.query(
                `SELECT * FROM ${table} WHERE ${tsColumn} > $1 ORDER BY ${tsColumn} ASC, id ASC LIMIT $2 OFFSET $3`,
                [lastSynced, BATCH_SIZE, offset],
            );
            pgRows = rows;
        }
        if (pgRows.length === 0) break;

        const hotRows = pgRows.filter((r) => r[tsColumn] && new Date(r[tsColumn]) >= cutoff);
        const coldRows = pgRows.filter((r) => !r[tsColumn] || new Date(r[tsColumn]) < cutoff);

        // Upsert hot rows into DuckDB
        for (const row of hotRows) {
            if (row.id != null) await duckRun(`DELETE FROM ${duckTable} WHERE id = ?`, [serialise(row.id)]);
            await duckRun(`INSERT INTO ${duckTable} (${colList}) VALUES (${placeholders})`, columns.map((c) => serialise(row[c])));
        }

        // Write cold rows directly to Parquet grouped by (site_id, date)
        if (coldRows.length > 0) {
            const groups = new Map();
            for (const row of coldRows) {
                const ts = row[tsColumn];
                const dateStr = ts
                    ? (ts instanceof Date ? ts.toISOString() : String(ts)).split('T')[0]
                    : '1970-01-01';
                const key = `${row.site_id}::${dateStr}`;
                if (!groups.has(key)) groups.set(key, { site_id: row.site_id, dateStr, rows: [] });
                groups.get(key).rows.push(row);
            }

            for (const { site_id, dateStr, rows: groupRows } of groups.values()) {
                const stagingTable = `_stage_${table}_${Date.now()}`;
                await duckRun(`CREATE TEMP TABLE ${stagingTable} AS SELECT * FROM ${duckTable} WHERE 1=0`);
                for (const row of groupRows) {
                    await duckRun(
                        `INSERT INTO ${stagingTable} (${colList}) VALUES (${placeholders})`,
                        columns.map((c) => serialise(row[c])),
                    );
                }
                await writeColdParquet(subDir, dateColAlias, site_id, dateStr, stagingTable);
                await duckRun(`DROP TABLE IF EXISTS ${stagingTable}`);
            }
        }

        const lastRow = pgRows[pgRows.length - 1];
        highWaterTs = lastRow[tsColumn]?.toISOString?.() ?? String(lastRow[tsColumn]);
        if (isEvents && lastRow.id != null) highWaterEventId = Math.max(highWaterEventId, Number(lastRow.id));

        synced += pgRows.length;
        offset += pgRows.length;
        process.stdout.write(`  ↳  ${table}: ${synced}/${totalNew} rows synced\r`);
    }

    await upsertSyncMeta(table, highWaterTs, highWaterEventId, synced);
    console.log(`  ✓  ${table}: ${synced} rows synced (event_id=${highWaterEventId}, ts=${highWaterTs})`);
    return synced;
}

// ─── regular table sync (no hot/cold split) ──────────────────────

async function syncTable(cfg, { forceFullSync = false } = {}) {
    const { table, duckTable, tsColumn, idColumn } = cfg;
    const columns = await getColumns(table);
    if (columns.length === 0) {
        console.log(`  ⚠  Table "${table}" not found in PostgreSQL — skipping`);
        return 0;
    }

    if (forceFullSync) {
        await duckRun(`DELETE FROM ${duckTable}`);
        await duckRun(`DELETE FROM _sync_meta WHERE table_name = ?`, [table]);
    }

    const { lastSynced } = await getSyncMeta(table);
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
    let highWaterTs = lastSynced;
    let offset = 0;

    while (offset < totalNew) {
        const { rows } = await pg.query(
            `SELECT ${colList} FROM ${table}
             WHERE ${tsColumn} > $1 ORDER BY ${tsColumn} ASC LIMIT $2 OFFSET $3`,
            [lastSynced, BATCH_SIZE, offset],
        );
        if (rows.length === 0) break;

        const placeholders = columns.map(() => '?').join(', ');
        for (const row of rows) {
            if (idColumn && row[idColumn] != null) {
                await duckRun(`DELETE FROM ${duckTable} WHERE ${idColumn} = ?`, [serialise(row[idColumn])]);
            }
            await duckRun(
                `INSERT INTO ${duckTable} (${colList}) VALUES (${placeholders})`,
                columns.map((c) => serialise(row[c])),
            );
        }

        const lastRow = rows[rows.length - 1];
        highWaterTs = lastRow[tsColumn]?.toISOString?.() ?? String(lastRow[tsColumn]);
        synced += rows.length;
        offset += rows.length;
        process.stdout.write(`  ↳  ${table}: ${synced}/${totalNew} rows synced\r`);
    }

    await upsertSyncMeta(table, highWaterTs, 0, synced);
    console.log(`  ✓  ${table}: ${synced} rows synced`);
    return synced;
}

// ─── full sync orchestrator ──────────────────────────────────────

export async function runSync({ fullSync = false, silent = false } = {}) {
    if (_syncRunning) {
        if (!silent) console.log('⏳ Sync already in progress — skipping');
        return 0;
    }
    _syncRunning = true;

    try {
        if (!silent) {
            console.log('');
            console.log('╔════════════════════════════════════════════════════════╗');
            console.log('║  InsightTrack · Hot+Cold PostgreSQL → DuckDB Sync     ║');
            console.log('╚════════════════════════════════════════════════════════╝');
            console.log(`  Hot window : last ${HOT_DAYS} days → DuckDB hot tables`);
            console.log(`  Cold store : older data → ${DATA_LAKE}/\n`);
            if (fullSync) console.log('🔄 Full re-sync — all tables will be rebuilt\n');
        }

        if (!silent) console.log('① Ensuring DuckDB schema…');
        await ensureSchema();

        if (!silent) console.log('② Syncing tables…');
        let totalRows = 0;
        for (const cfg of SYNCABLE_TABLES) {
            const n = cfg.hotCold
                ? await syncHotColdTable(cfg, { forceFullSync: fullSync })
                : await syncTable(cfg, { forceFullSync: fullSync });
            totalRows += n;
        }

        if (!silent) console.log('③ Evicting cold data from hot tables…');
        await exportColdPartitions('events_hot', 'timestamp');
        await exportColdPartitions('sessions_hot', 'started_at');

        if (!silent) {
            console.log('');
            console.log(`✅ Sync complete — ${totalRows} total rows synced.`);
        }
        return totalRows;
    } finally {
        _syncRunning = false;
    }
}

export async function runFullSync({ silent = false } = {}) {
    return runSync({ fullSync: true, silent });
}

// ─── CLI entry point ─────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const full = process.argv.includes('--full');
    (async () => {
        try {
            await runSync({ fullSync: full, silent: false });
        } catch (err) {
            console.error('Sync failed:', err);
            process.exit(1);
        } finally {
            await closeDuck();
            process.exit(0);
        }
    })();
}
