import express from 'express';
import { randomUUID } from 'crypto';
import { duckAll, duckRun } from '../db/duckdb.js';
import { query as pgQuery } from '../db/postgres.js';
import { authMiddleware } from '../middleware/auth.js';
import sitesService from '../services/sitesService.js';
import { safeMsg } from '../utils/safeError.js';
import {
    validateQuery,
    clampTimeout,
    scopeQueryToSite,
    applyRowCap,
    MAX_RESULT_ROWS as GUARD_MAX_ROWS,
} from './sqlGuard.js';

const router = express.Router();

const MAX_RESULT_ROWS = GUARD_MAX_ROWS;
const DEFAULT_TIMEOUT_MS = Number(process.env.SQL_EDITOR_TIMEOUT_MS || 15_000);

router.use(authMiddleware);

function extractTemplateVariables(sql) {
    if (!sql) return [];
    const matches = [...sql.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)];
    return [...new Set(matches.map((m) => m[1]))];
}

function toSqlLiteral(value) {
    if (value == null || value === '') return 'NULL';
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';

    const asNum = Number(value);
    if (!Number.isNaN(asNum) && String(value).trim() !== '') {
        return String(asNum);
    }

    return `'${String(value).replace(/'/g, "''")}'`;
}

function applyTemplateVariables(sql, templateValues = {}) {
    return sql.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, varName) => {
        if (!(varName in templateValues)) return 'NULL';
        return toSqlLiteral(templateValues[varName]);
    });
}

function parseSqlErrorDetails(errorMessage = '') {
    const lineMatch = errorMessage.match(/line\s+(\d+)/i) || errorMessage.match(/LINE\s+(\d+)/i);
    const colMatch = errorMessage.match(/column\s+(\d+)/i) || errorMessage.match(/\:(\d+)\s*$/);
    return {
        line: lineMatch ? Number(lineMatch[1]) : null,
        column: colMatch ? Number(colMatch[1]) : null,
    };
}

function withTimeout(promise, timeoutMs) {
    let timer = null;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`Query timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timer) clearTimeout(timer);
    });
}

async function logAudit({
    requestId,
    userId,
    siteId,
    sqlText,
    durationMs,
    rowCount,
    status,
    errorMessage,
}) {
    try {
        await pgQuery(
            `INSERT INTO sql_query_audits
              (id, request_id, user_id, site_id, query_text, duration_ms, row_count, status, error_message, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
            [
                randomUUID(),
                requestId,
                String(userId),
                String(siteId),
                sqlText,
                durationMs ?? null,
                rowCount ?? null,
                status,
                errorMessage ?? null,
            ],
        );
    } catch (err) {
        console.warn('[sql-editor] failed to write audit log:', err.message);
    }
}

/**
 * Verify that the authenticated user owns the requested site.
 * Returns the site object, or throws with a status code attached.
 */
async function requireSiteAccess(req, res, siteId) {
    const site = await sitesService.getSiteById(siteId);
    if (!site) {
        res.status(404).json({ error: 'Site not found.' });
        return null;
    }
    if (String(site.user_id) !== String(req.user.id)) {
        res.status(403).json({ error: 'You do not have access to this site.' });
        return null;
    }
    return site;
}

/**
 * GET /api/sql-editor/:siteId/schema
 * Returns table + column metadata for the DuckDB analytics views.
 */
router.get('/:siteId/schema', async (req, res) => {
    const { siteId } = req.params;

    try {
        const site = await requireSiteAccess(req, res, siteId);
        if (!site) return;

        const rows = await duckAll(`
            SELECT table_name, column_name, data_type, ordinal_position
            FROM information_schema.columns
            WHERE table_schema = 'main'
              AND table_name IN ('events', 'sessions', 'events_hot', 'sessions_hot')
            ORDER BY table_name, ordinal_position
        `);

        // Group columns by table
        const schema = {};
        for (const row of rows) {
            if (!schema[row.table_name]) {
                schema[row.table_name] = [];
            }
            schema[row.table_name].push({
                name: row.column_name,
                type: row.data_type,
            });
        }

        res.json({ schema });
    } catch (error) {
        console.error('[sql-editor] schema error:', error);
        res.status(500).json({ error: 'Failed to fetch schema.' });
    }
});

router.get('/:siteId/saved', async (req, res) => {
    const { siteId } = req.params;
    try {
        const site = await requireSiteAccess(req, res, siteId);
        if (!site) return;

        const result = await pgQuery(
            `SELECT id, name, query, tags, created_at, updated_at
             FROM sql_saved_queries
             WHERE site_id = $1 AND user_id = $2
             ORDER BY updated_at DESC, created_at DESC`,
            [siteId, String(req.user.id)],
        );

        res.json({ queries: result.rows });
    } catch (error) {
        console.error('[sql-editor] saved list error:', error);
        res.status(500).json({ error: 'Failed to load saved queries.' });
    }
});

router.post('/:siteId/saved', async (req, res) => {
    const { siteId } = req.params;
    const { name, query, tags } = req.body ?? {};

    if (!name || typeof name !== 'string' || !query || typeof query !== 'string') {
        return res.status(400).json({ error: 'name and query are required.' });
    }

    const validationError = validateQuery(query);
    if (validationError) return res.status(400).json({ error: validationError });

    try {
        const site = await requireSiteAccess(req, res, siteId);
        if (!site) return;

        const result = await pgQuery(
            `INSERT INTO sql_saved_queries (id, site_id, user_id, name, query, tags, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
             RETURNING id, name, query, tags, created_at, updated_at`,
            [
                randomUUID(),
                siteId,
                String(req.user.id),
                name.trim().slice(0, 120),
                query,
                Array.isArray(tags) ? tags.slice(0, 10) : [],
            ],
        );

        res.status(201).json({ query: result.rows[0] });
    } catch (error) {
        console.error('[sql-editor] saved create error:', error);
        res.status(500).json({ error: 'Failed to save query.' });
    }
});

router.put('/:siteId/saved/:savedId', async (req, res) => {
    const { siteId, savedId } = req.params;
    const { name, query, tags } = req.body ?? {};

    if (!name || typeof name !== 'string' || !query || typeof query !== 'string') {
        return res.status(400).json({ error: 'name and query are required.' });
    }

    const validationError = validateQuery(query);
    if (validationError) return res.status(400).json({ error: validationError });

    try {
        const site = await requireSiteAccess(req, res, siteId);
        if (!site) return;

        const result = await pgQuery(
            `UPDATE sql_saved_queries
             SET name = $1, query = $2, tags = $3, updated_at = NOW()
             WHERE id = $4 AND site_id = $5 AND user_id = $6
             RETURNING id, name, query, tags, created_at, updated_at`,
            [
                name.trim().slice(0, 120),
                query,
                Array.isArray(tags) ? tags.slice(0, 10) : [],
                savedId,
                siteId,
                String(req.user.id),
            ],
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Saved query not found.' });
        }

        res.json({ query: result.rows[0] });
    } catch (error) {
        console.error('[sql-editor] saved update error:', error);
        res.status(500).json({ error: 'Failed to update saved query.' });
    }
});

router.delete('/:siteId/saved/:savedId', async (req, res) => {
    const { siteId, savedId } = req.params;
    try {
        const site = await requireSiteAccess(req, res, siteId);
        if (!site) return;

        await pgQuery(
            `DELETE FROM sql_saved_queries
             WHERE id = $1 AND site_id = $2 AND user_id = $3`,
            [savedId, siteId, String(req.user.id)],
        );

        res.json({ success: true });
    } catch (error) {
        console.error('[sql-editor] saved delete error:', error);
        res.status(500).json({ error: 'Failed to delete saved query.' });
    }
});

/**
 * POST /api/sql-editor/:siteId/run
 * Executes a read-only SELECT query against DuckDB.
 *
 * Body: { query: string }
 *
 * Supports the {{site_id}} template variable — it is replaced with the
 * verified site ID before execution so users can easily scope queries to
 * their own data, e.g.:
 *   SELECT country, COUNT(*) FROM events
 *   WHERE site_id = {{site_id}}
 *   GROUP BY 1 ORDER BY 2 DESC
 */
router.post('/:siteId/run', async (req, res) => {
    const { siteId } = req.params;
    const {
        query,
        variables = {},
        explain = false,
        timeoutMs = DEFAULT_TIMEOUT_MS,
    } = req.body ?? {};
    const requestId = randomUUID();

    // 1. Validate query structure
    const validationError = validateQuery(query);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    // 2. Verify site ownership
    try {
        const site = await requireSiteAccess(req, res, siteId);
        if (!site) return;
    } catch (error) {
        console.error('[sql-editor] site access error:', error);
        return res.status(500).json({ error: 'Failed to verify site access.' });
    }

    // 3. Substitute {{site_id}} template variable with the verified site ID.
    //    siteId is sourced from the authenticated + ownership-verified DB record,
    //    not raw user input, so it is safe to embed directly.
    const allVariables = {
        ...variables,
        site_id: siteId,
    };
    const withVars = applyTemplateVariables(query, allVariables);

    const usedVariables = extractTemplateVariables(query);

    // 3b. Re-validate AFTER substitution. Template values come from the request
    //     body and are interpolated as SQL literals, so a value could otherwise
    //     smuggle a disallowed construct into an already-approved query
    //     (audit F-09). Validating the post-substitution text closes that gap.
    const postSubstitutionError = validateQuery(withVars);
    if (postSubstitutionError) {
        return res.status(400).json({
            error: `Template variable produced a disallowed query: ${postSubstitutionError}`,
        });
    }

    // 4. Bind the query to this site and enforce a hard row cap.
    //    Tenant scoping (audit F-05): each referenced analytics table is swapped
    //    for a TEMP VIEW filtered to this site, so an unfiltered
    //    `SELECT * FROM events` cannot read another tenant's rows.
    //    Row cap (audit F-07): wrapping in an outer LIMIT binds even when the
    //    user supplied a larger LIMIT of their own.
    const { views, rewritten } = scopeQueryToSite(withVars, siteId);
    const finalQuery = applyRowCap(rewritten, { explain, max: MAX_RESULT_ROWS });

    // 5. Execute
    try {
        const start = Date.now();

        // Create the per-request scoped views before running the query.
        // createSql is built by sqlGuard (DuckDB cannot bind parameters in DDL).
        for (const { createSql } of views) {
            await duckRun(createSql);
        }

        const rows = await withTimeout(duckAll(finalQuery), clampTimeout(timeoutMs, DEFAULT_TIMEOUT_MS));
        const duration = Date.now() - start;

        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

        // DuckDB returns BigInt for aggregate columns (COUNT, SUM, etc.).
        // Convert to Number (safe for analytics) or String for very large values.
        const serialize = (v) => {
            if (typeof v === 'bigint') {
                return v > Number.MAX_SAFE_INTEGER || v < Number.MIN_SAFE_INTEGER
                    ? String(v)
                    : Number(v);
            }
            return v;
        };

        res.json({
            requestId,
            columns,
            rows: rows.map((r) => columns.map((c) => serialize(r[c]))),
            rowCount: rows.length,
            duration,
            truncated: rows.length === MAX_RESULT_ROWS,
            explain,
            variablesUsed: usedVariables,
        });

        await logAudit({
            requestId,
            userId: req.user.id,
            siteId,
            sqlText: finalQuery,
            durationMs: duration,
            rowCount: rows.length,
            status: 'ok',
        });
    } catch (error) {
        const duration = null;
        const rawMessage = error.message ?? 'Query execution failed.';
        const diagnostics = parseSqlErrorDetails(rawMessage);
        // Surface SQL-level feedback (the editor is useless without it) but never
        // absolute filesystem paths, which aid reconnaissance (audit F-10). The
        // unredacted message is still written to sql_query_audits below.
        const clientMessage = rawMessage.replace(/(?:\/[\w.\-]+){2,}/g, '<path>');

        await logAudit({
            requestId,
            userId: req.user.id,
            siteId,
            sqlText: finalQuery,
            durationMs: duration,
            rowCount: null,
            status: /timed out/i.test(rawMessage) ? 'timeout' : 'error',
            errorMessage: rawMessage,
        });

        if (/timed out/i.test(rawMessage)) {
            return res.status(408).json({
                error: clientMessage,
                requestId,
                diagnostics,
            });
        }

        res.status(400).json({
            error: clientMessage,
            requestId,
            diagnostics,
        });
    }
});

export default router;
