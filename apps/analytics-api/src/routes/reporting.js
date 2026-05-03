import express from 'express';
import { randomUUID } from 'crypto';
import { reportingService } from '../services/reportingService.js';
import { query } from '../db/postgres.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

const safeError = (error) => {
    if (process.env.NODE_ENV === 'development') return error.message;
    return 'An internal error occurred';
};

// ─── Annotations ─────────────────────────────────

router.get('/:siteId/annotations', async (req, res) => {
    try {
        const { start, end } = req.query;
        const data = await reportingService.listAnnotations(req.params.siteId, start, end);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error listing annotations:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

router.post('/:siteId/annotations', async (req, res) => {
    try {
        const { date, title, description, category } = req.body;
        const data = await reportingService.createAnnotation({
            siteId: req.params.siteId, date, title, description, category,
        });
        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error('Error creating annotation:', error);
        res.status(400).json({ success: false, error: safeError(error) });
    }
});

router.delete('/:siteId/annotations/:annotationId', async (req, res) => {
    try {
        await reportingService.deleteAnnotation(req.params.annotationId, req.params.siteId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting annotation:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// ─── Report Schedules ────────────────────────────

router.get('/:siteId/reports', async (req, res) => {
    try {
        const data = await reportingService.listReportSchedules(req.params.siteId, req.user.id);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error listing reports:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

router.post('/:siteId/reports', async (req, res) => {
    try {
        const { frequency, email, metrics } = req.body;
        const data = await reportingService.createReportSchedule({
            siteId: req.params.siteId, userId: req.user.id, frequency, email, metrics,
        });
        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error('Error creating report schedule:', error);
        res.status(400).json({ success: false, error: safeError(error) });
    }
});

router.put('/:siteId/reports/:reportId', async (req, res) => {
    try {
        const { enabled } = req.body;
        await reportingService.updateReportSchedule(req.params.reportId, req.params.siteId, { enabled });
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating report:', error);
        res.status(400).json({ success: false, error: safeError(error) });
    }
});

router.delete('/:siteId/reports/:reportId', async (req, res) => {
    try {
        await reportingService.deleteReportSchedule(req.params.reportId, req.params.siteId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// ─── Custom Dashboards ───────────────────────────

router.get('/:siteId/dashboards', async (req, res) => {
    try {
        const data = await reportingService.listDashboards(req.params.siteId, req.user.id);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error listing dashboards:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

router.post('/:siteId/dashboards', async (req, res) => {
    try {
        const { name, widgets } = req.body;
        const data = await reportingService.createDashboard({
            siteId: req.params.siteId, userId: req.user.id, name, widgets,
        });
        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error('Error creating dashboard:', error);
        res.status(400).json({ success: false, error: safeError(error) });
    }
});

router.put('/:siteId/dashboards/:dashboardId', async (req, res) => {
    try {
        const { name, widgets } = req.body;
        await reportingService.updateDashboard(req.params.dashboardId, req.params.siteId, { name, widgets });
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating dashboard:', error);
        res.status(400).json({ success: false, error: safeError(error) });
    }
});

router.delete('/:siteId/dashboards/:dashboardId', async (req, res) => {
    try {
        await reportingService.deleteDashboard(req.params.dashboardId, req.params.siteId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting dashboard:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// ─── Data Retention ──────────────────────────────

router.get('/:siteId/retention', async (req, res) => {
    try {
        const data = await reportingService.getRetentionPolicy(req.params.siteId);
        res.json({ success: true, data: data || { retentionDays: 365, enabled: false } });
    } catch (error) {
        console.error('Error getting retention policy:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

router.put('/:siteId/retention', async (req, res) => {
    try {
        const { retentionDays, enabled } = req.body;
        const data = await reportingService.upsertRetentionPolicy({
            siteId: req.params.siteId, retentionDays, enabled,
        });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error updating retention policy:', error);
        res.status(400).json({ success: false, error: safeError(error) });
    }
});

router.post('/:siteId/retention/cleanup', async (req, res) => {
    try {
        const data = await reportingService.runRetentionCleanup(req.params.siteId);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error running retention cleanup:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// ─── Saved UTM Links ─────────────────────────────

router.get('/:siteId/utm-links', async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM utm_links WHERE site_id = $1 ORDER BY created_at DESC',
            [req.params.siteId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error listing UTM links:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

router.post('/:siteId/utm-links', async (req, res) => {
    try {
        const { label, url, utm_source, utm_medium, utm_campaign, utm_term, utm_content, built_url } = req.body;
        if (!label || !url || !built_url) {
            return res.status(400).json({ success: false, error: 'label, url, and built_url are required' });
        }
        const id = randomUUID();
        const result = await query(
            `INSERT INTO utm_links (id, site_id, label, url, utm_source, utm_medium, utm_campaign, utm_term, utm_content, built_url)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [id, req.params.siteId, label, url,
                utm_source || '', utm_medium || '', utm_campaign || '',
                utm_term || '', utm_content || '', built_url]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error creating UTM link:', error);
        res.status(400).json({ success: false, error: safeError(error) });
    }
});

router.delete('/:siteId/utm-links/:linkId', async (req, res) => {
    try {
        await query(
            'DELETE FROM utm_links WHERE id = $1 AND site_id = $2',
            [req.params.linkId, req.params.siteId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting UTM link:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

export default router;
