// Reporting & Settings Service — PostgreSQL writes
import { query } from '../db/postgres.js';
import { v4 as uuidv4 } from 'uuid';

export const reportingService = {
    // ─── Annotations ─────────────────────────────────

    async createAnnotation({ siteId, date, title, description, category }) {
        if (!siteId || !date || !title) throw new Error('siteId, date, and title are required');
        const id = `ann_${uuidv4().split('-')[0]}`;
        await query(
            `INSERT INTO annotations (id, site_id, date, title, description, category, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [id, siteId, date, title.slice(0, 255), (description || '').slice(0, 2000), category || 'general']
        );
        return { id, siteId, date, title, description, category };
    },

    async listAnnotations(siteId, startDate, endDate) {
        const result = await query(
            `SELECT * FROM annotations WHERE site_id = $1 AND date >= $2 AND date <= $3 ORDER BY date DESC`,
            [siteId, startDate || '2020-01-01', endDate || '2099-12-31']
        );
        return result.rows;
    },

    async deleteAnnotation(annotationId, siteId) {
        await query(`DELETE FROM annotations WHERE id = $1 AND site_id = $2`, [annotationId, siteId]);
        return { success: true };
    },

    // ─── Report Schedules ────────────────────────────

    async createReportSchedule({ siteId, userId, frequency, email, metrics }) {
        if (!siteId || !userId || !frequency || !email) {
            throw new Error('siteId, userId, frequency, and email are required');
        }
        const ALLOWED_FREQUENCIES = ['daily', 'weekly', 'monthly'];
        if (!ALLOWED_FREQUENCIES.includes(frequency)) {
            throw new Error(`Invalid frequency. Must be one of: ${ALLOWED_FREQUENCIES.join(', ')}`);
        }

        const id = `rpt_${uuidv4().split('-')[0]}`;
        const nextSend = new Date();
        if (frequency === 'daily') nextSend.setDate(nextSend.getDate() + 1);
        else if (frequency === 'weekly') nextSend.setDate(nextSend.getDate() + 7);
        else nextSend.setMonth(nextSend.getMonth() + 1);

        await query(
            `INSERT INTO report_schedules (id, site_id, user_id, frequency, email, metrics, next_send_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [id, siteId, userId, frequency, email.slice(0, 255), JSON.stringify(metrics || []), nextSend.toISOString()]
        );
        return { id, siteId, frequency, email, metrics, nextSendAt: nextSend.toISOString() };
    },

    async listReportSchedules(siteId, userId) {
        const result = await query(
            `SELECT * FROM report_schedules WHERE site_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
            [siteId, userId]
        );
        return result.rows;
    },

    async updateReportSchedule(scheduleId, siteId, { enabled }) {
        await query(
            `UPDATE report_schedules SET enabled = $1 WHERE id = $2 AND site_id = $3`,
            [enabled, scheduleId, siteId]
        );
        return { success: true };
    },

    async deleteReportSchedule(scheduleId, siteId) {
        await query(`DELETE FROM report_schedules WHERE id = $1 AND site_id = $2`, [scheduleId, siteId]);
        return { success: true };
    },

    // ─── Custom Dashboards ───────────────────────────

    async createDashboard({ siteId, userId, name, widgets }) {
        if (!siteId || !userId || !name) throw new Error('siteId, userId, and name are required');
        const id = `dash_${uuidv4().split('-')[0]}`;
        await query(
            `INSERT INTO custom_dashboards (id, site_id, user_id, name, widgets, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [id, siteId, userId, name.slice(0, 255), JSON.stringify(widgets || [])]
        );
        return { id, siteId, name, widgets };
    },

    async listDashboards(siteId, userId) {
        const result = await query(
            `SELECT * FROM custom_dashboards WHERE site_id = $1 AND user_id = $2 ORDER BY updated_at DESC`,
            [siteId, userId]
        );
        return result.rows;
    },

    async updateDashboard(dashboardId, siteId, { name, widgets }) {
        await query(
            `UPDATE custom_dashboards SET name = COALESCE($1, name), widgets = COALESCE($2, widgets), updated_at = NOW()
       WHERE id = $3 AND site_id = $4`,
            [name, widgets ? JSON.stringify(widgets) : null, dashboardId, siteId]
        );
        return { success: true };
    },

    async deleteDashboard(dashboardId, siteId) {
        await query(`DELETE FROM custom_dashboards WHERE id = $1 AND site_id = $2`, [dashboardId, siteId]);
        return { success: true };
    },

    // ─── Data Retention Policies ─────────────────────

    async getRetentionPolicy(siteId) {
        const result = await query(
            `SELECT * FROM data_retention_policies WHERE site_id = $1 LIMIT 1`,
            [siteId]
        );
        return result.rows[0] || null;
    },

    async upsertRetentionPolicy({ siteId, retentionDays, enabled }) {
        if (!siteId) throw new Error('siteId is required');
        const days = Math.max(30, Math.min(3650, retentionDays || 365));
        const id = `ret_${uuidv4().split('-')[0]}`;
        await query(
            `INSERT INTO data_retention_policies (id, site_id, retention_days, enabled, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (site_id) DO UPDATE SET retention_days = $3, enabled = $4`,
            [id, siteId, days, enabled !== false]
        );
        return { siteId, retentionDays: days, enabled: enabled !== false };
    },

    async runRetentionCleanup(siteId) {
        const policy = await this.getRetentionPolicy(siteId);
        if (!policy || !policy.enabled) return { deleted: 0 };

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - policy.retention_days);
        const cutoffISO = cutoff.toISOString();

        const eventsResult = await query(
            `DELETE FROM events WHERE site_id = $1 AND timestamp < $2`,
            [siteId, cutoffISO]
        );
        const sessionsResult = await query(
            `DELETE FROM sessions WHERE site_id = $1 AND started_at < $2`,
            [siteId, cutoffISO]
        );

        await query(
            `UPDATE data_retention_policies SET last_cleanup_at = NOW() WHERE site_id = $1`,
            [siteId]
        );

        return {
            deletedEvents: eventsResult.rowCount || 0,
            deletedSessions: sessionsResult.rowCount || 0,
        };
    },
};

export default reportingService;
