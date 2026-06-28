/**
 * S3 / R2 / MinIO storage for InsightsTrack Parquet cold tier.
 *
 * When S3_BUCKET is set, the sync pipeline archives DuckDB events older than
 * ARCHIVE_DAYS into Hive-partitioned Parquet files on S3-compatible storage.
 * DuckDB's native httpfs extension queries them transparently via UNION ALL views.
 *
 * Compatible with:
 *   - AWS S3          (S3_ENDPOINT left blank)
 *   - Cloudflare R2   (S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com)
 *   - MinIO           (S3_ENDPOINT=http://minio:9000)
 *   - Backblaze B2    (S3_ENDPOINT=https://s3.<region>.backblazeb2.com)
 *   - Any S3-compatible service
 *
 * Required env vars (when S3 is enabled):
 *   S3_BUCKET          — bucket name
 *   S3_ACCESS_KEY      — access key / key ID
 *   S3_SECRET_KEY      — secret key
 *
 * Optional env vars:
 *   S3_ENDPOINT        — custom endpoint URL (leave blank for AWS S3)
 *   S3_REGION          — region (default: us-east-1)
 *   S3_PREFIX          — path prefix inside the bucket (default: insightstrack)
 *   S3_USE_SSL         — true/false (default: true)
 *   ARCHIVE_DAYS       — events older than this are archived (default: 30)
 *   ARCHIVE_TABLES     — comma-separated tables to archive (default: events,sessions)
 */

import { duckRun, duckAll } from '../db/duckdb.js';

// ─── Config ────────────────────────────────────────────────────────────────────

export const S3_CONFIG = {
    bucket:    process.env.S3_BUCKET       || '',
    accessKey: process.env.S3_ACCESS_KEY   || '',
    secretKey: process.env.S3_SECRET_KEY   || '',
    endpoint:  process.env.S3_ENDPOINT     || '',
    region:    process.env.S3_REGION       || 'us-east-1',
    prefix:    (process.env.S3_PREFIX      || 'insightstrack').replace(/\/$/, ''),
    useSSL:    process.env.S3_USE_SSL !== 'false',
    archiveDays: Number(process.env.ARCHIVE_DAYS) || 30,
    archiveTables: (process.env.ARCHIVE_TABLES || 'events,sessions').split(',').map(t => t.trim()),
};

export const s3Enabled = () => Boolean(S3_CONFIG.bucket && S3_CONFIG.accessKey && S3_CONFIG.secretKey);

// ─── httpfs init ───────────────────────────────────────────────────────────────

let _httpfsReady = false;

/**
 * Installs and configures the DuckDB httpfs extension for S3 access.
 * Called once at startup when S3 is enabled.
 */
export async function initS3(silent = false) {
    if (!s3Enabled()) {
        if (!silent) console.log('[s3] S3_BUCKET not set — cold storage disabled, using local disk only');
        return false;
    }
    if (_httpfsReady) return true;

    try {
        await duckRun(`INSTALL httpfs`);
        await duckRun(`LOAD httpfs`);

        // Configure S3 credentials in DuckDB
        const cfg = S3_CONFIG;

        if (cfg.endpoint) {
            // R2 / MinIO / custom S3-compatible endpoint
            await duckRun(`SET s3_endpoint='${cfg.endpoint.replace(/^https?:\/\//, '')}'`);
            await duckRun(`SET s3_use_ssl=${cfg.useSSL ? 'true' : 'false'}`);
            await duckRun(`SET s3_url_style='path'`);
        }

        await duckRun(`SET s3_region='${cfg.region}'`);
        await duckRun(`SET s3_access_key_id='${cfg.accessKey}'`);
        await duckRun(`SET s3_secret_access_key='${cfg.secretKey}'`);

        _httpfsReady = true;
        if (!silent) console.log(`[s3] httpfs ready — bucket: ${cfg.bucket} prefix: ${cfg.prefix}`);
        return true;
    } catch (err) {
        console.error('[s3] Failed to initialise httpfs:', err.message);
        return false;
    }
}

// ─── Path helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the S3 URI for a Hive-partitioned Parquet file.
 * Pattern: s3://bucket/prefix/table/site_id=X/event_date=YYYY-MM-DD/part-0001.parquet
 */
export function s3Path(table, siteId, date) {
    const d = date instanceof Date ? date.toISOString().split('T')[0] : date;
    return `s3://${S3_CONFIG.bucket}/${S3_CONFIG.prefix}/${table}/site_id=${siteId}/event_date=${d}/part-0001.parquet`;
}

/**
 * Returns the glob pattern for querying all Parquet files for a table.
 */
export function s3GlobPath(table) {
    return `s3://${S3_CONFIG.bucket}/${S3_CONFIG.prefix}/${table}/**/*.parquet`;
}

// ─── Archive ───────────────────────────────────────────────────────────────────

/**
 * Archives events/sessions older than ARCHIVE_DAYS from DuckDB to S3 Parquet.
 * Groups by (site_id, date) to create Hive-partitioned files.
 * Rows are deleted from DuckDB after successful write to keep the hot table lean.
 */
export async function archiveToS3(table = 'events', { silent = false } = {}) {
    if (!s3Enabled() || !_httpfsReady) return 0;

    const tsCol = table === 'sessions' ? 'started_at' : 'timestamp';
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - S3_CONFIG.archiveDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    // Find distinct (site_id, date) combinations older than cutoff
    const partitions = await duckAll(
        `SELECT DISTINCT site_id, CAST(${tsCol} AS DATE) AS event_date
         FROM ${table}
         WHERE CAST(${tsCol} AS DATE) < ?
         ORDER BY event_date ASC`,
        [cutoffStr],
    );

    if (partitions.length === 0) {
        if (!silent) console.log(`[s3] ${table}: nothing to archive`);
        return 0;
    }

    let archived = 0;
    for (const { site_id, event_date } of partitions) {
        const dateStr = event_date instanceof Date
            ? event_date.toISOString().split('T')[0]
            : String(event_date).split('T')[0];
        const dest = s3Path(table, site_id, dateStr);

        try {
            // Write partition to S3 as Parquet
            await duckRun(
                `COPY (
                    SELECT * FROM ${table}
                    WHERE site_id = ?
                    AND CAST(${tsCol} AS DATE) = ?
                 ) TO '${dest}' (FORMAT PARQUET, COMPRESSION ZSTD)`,
                [site_id, dateStr],
            );

            // Delete from hot DuckDB after successful archive
            await duckRun(
                `DELETE FROM ${table}
                 WHERE site_id = ?
                 AND CAST(${tsCol} AS DATE) = ?`,
                [site_id, dateStr],
            );

            archived++;
            if (!silent) {
                process.stdout.write(`[s3] archived ${table} site=${site_id} date=${dateStr}\r`);
            }
        } catch (err) {
            console.error(`[s3] Failed to archive ${table} ${site_id}/${dateStr}:`, err.message);
            // Continue with next partition — don't abort entire archive run
        }
    }

    if (!silent) console.log(`[s3] ${table}: ${archived} partition(s) archived to s3://${S3_CONFIG.bucket}`);
    return archived;
}

/**
 * Archives all configured tables.
 */
export async function archiveAllToS3({ silent = false } = {}) {
    if (!s3Enabled() || !_httpfsReady) return;
    let total = 0;
    for (const table of S3_CONFIG.archiveTables) {
        total += await archiveToS3(table, { silent });
    }
    return total;
}

// ─── Query views ───────────────────────────────────────────────────────────────

/**
 * Returns SQL that covers both the hot DuckDB table and S3 cold Parquet.
 * Use this when you need full historical data (date range > ARCHIVE_DAYS).
 *
 * Example:
 *   const sql = unifiedQuery('events');
 *   const rows = await duckAll(`SELECT COUNT(*) FROM (${sql}) WHERE site_id = ?`, [id]);
 */
export function unifiedQuery(table) {
    if (!s3Enabled() || !_httpfsReady) return table;
    return `(
        SELECT * FROM ${table}
        UNION ALL
        SELECT * FROM read_parquet('${s3GlobPath(table)}', hive_partitioning=true)
    )`;
}

/**
 * Creates or replaces DuckDB VIEWs that transparently UNION the hot table
 * with S3 cold Parquet. The analytics queries then just reference the view name.
 */
export async function refreshUnifiedViews({ silent = false } = {}) {
    if (!s3Enabled() || !_httpfsReady) return;

    for (const table of S3_CONFIG.archiveTables) {
        try {
            // Check if any Parquet files exist in S3 before creating the view
            // (DuckDB will error if the glob matches nothing)
            const testRows = await duckAll(
                `SELECT COUNT(*) AS cnt FROM read_parquet('${s3GlobPath(table)}', hive_partitioning=true) LIMIT 1`
            ).catch(() => null);

            if (testRows) {
                await duckRun(
                    `CREATE OR REPLACE VIEW ${table}_all AS
                     SELECT * FROM ${table}
                     UNION ALL
                     SELECT * FROM read_parquet('${s3GlobPath(table)}', hive_partitioning=true)`
                );
                if (!silent) console.log(`[s3] view ${table}_all → hot + cold`);
            } else {
                // No cold files yet — view is just the hot table
                await duckRun(`CREATE OR REPLACE VIEW ${table}_all AS SELECT * FROM ${table}`);
                if (!silent) console.log(`[s3] view ${table}_all → hot only (no cold files yet)`);
            }
        } catch (err) {
            console.error(`[s3] Failed to refresh view for ${table}:`, err.message);
        }
    }
}

// ─── Status ────────────────────────────────────────────────────────────────────

export function s3Status() {
    if (!s3Enabled()) {
        return { enabled: false, reason: 'S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY not set' };
    }
    return {
        enabled: true,
        ready: _httpfsReady,
        bucket: S3_CONFIG.bucket,
        prefix: S3_CONFIG.prefix,
        endpoint: S3_CONFIG.endpoint || 'AWS S3 (default)',
        region: S3_CONFIG.region,
        archiveDays: S3_CONFIG.archiveDays,
        archiveTables: S3_CONFIG.archiveTables,
    };
}
