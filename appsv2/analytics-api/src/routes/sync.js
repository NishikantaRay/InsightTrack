/**
 * Sync management routes — admin/debug only.
 * POST /api/sync/full   → triggers a full re-sync from PostgreSQL → DuckDB
 * POST /api/sync/run    → triggers incremental sync
 * GET  /api/sync/status → returns last watermarks from _sync_meta
 */
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { runSync, runFullSync } from '../sync/sync.js';
import { getDuckDB } from '../db/duckdb.js';

const router = Router();

// All sync routes require authentication
router.use(authMiddleware);

router.post('/full', async (req, res) => {
    try {
        await runFullSync();
        res.json({ success: true, message: 'Full sync completed' });
    } catch (err) {
        console.error('Full sync error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/run', async (req, res) => {
    try {
        await runSync({ silent: false });
        res.json({ success: true, message: 'Incremental sync completed' });
    } catch (err) {
        console.error('Incremental sync error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/status', async (req, res) => {
    try {
        const db = getDuckDB();
        const rows = await new Promise((resolve, reject) => {
            db.all(
                `SELECT table_name, last_synced, last_event_id, rows_synced, updated_at
                 FROM _sync_meta ORDER BY table_name`,
                (err, data) => err ? reject(err) : resolve(data)
            );
        });
        res.json({
            success: true, data: rows.map(r => ({
                ...r,
                last_event_id: r.last_event_id != null ? Number(r.last_event_id) : null,
                rows_synced: r.rows_synced != null ? Number(r.rows_synced) : null,
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
