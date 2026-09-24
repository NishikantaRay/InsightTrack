/**
 * Search alerts — persistence.
 *
 * Alerts are derived from consecutive rank_history rows by the pure rules in
 * searchAlertRules.js and stored in PostgreSQL (invariant 2). They are in-app
 * only: read by the /search page and the sidebar count, never sent anywhere.
 *
 * Read state is per site, not per user — one teammate marking an alert read
 * clears it for the team, the same way a shared inbox works.
 */
import { query } from '../db/postgres.js';
import { detectAlerts } from './searchAlertRules.js';

// Old alerts are history nobody reads; keep the table small.
const RETENTION_DAYS = 180;
const MAX_LIMIT = 200;

/**
 * Compare one fresh observation with the previous one and store any alerts.
 * ON CONFLICT makes it idempotent per (observation, type).
 */
export async function recordAlerts(siteId, { rankHistoryId, keyword, location, device, prev, cur }) {
    const alerts = detectAlerts(prev, cur, { keyword });
    for (const a of alerts) {
        await query(
            `INSERT INTO search_alerts
               (site_id, rank_history_id, keyword, location, device, type, severity,
                previous_position, position, message)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (rank_history_id, type) DO NOTHING`,
            [siteId, rankHistoryId ?? null, keyword, location, device, a.type, a.severity,
             a.previousPosition, a.position, a.message],
        );
    }
    if (alerts.length) {
        await query(
            `DELETE FROM search_alerts
              WHERE site_id = $1 AND created_at < NOW() - ($2 || ' days')::interval`,
            [siteId, String(RETENTION_DAYS)],
        );
    }
    return alerts;
}

/**
 * Alerts for a site, newest first, with the pages each keyword is mapped to.
 * @param {{unreadOnly?:boolean, limit?:number}} opts
 */
export async function listAlerts(siteId, { unreadOnly = false, limit = 50 } = {}) {
    const n = Math.min(Math.max(parseInt(limit) || 50, 1), MAX_LIMIT);
    const { rows } = await query(
        `SELECT a.id, a.keyword, a.location, a.device, a.type, a.severity,
                a.previous_position, a.position, a.message, a.created_at, a.read_at,
                ARRAY(SELECT DISTINCT pk.path FROM page_keywords pk
                       WHERE pk.site_id = a.site_id AND pk.keyword = a.keyword
                         AND pk.location = a.location
                       ORDER BY pk.path) AS paths
           FROM search_alerts a
          WHERE a.site_id = $1 AND ($2::boolean = false OR a.read_at IS NULL)
          ORDER BY a.created_at DESC, a.id DESC
          LIMIT $3`,
        [siteId, !!unreadOnly, n],
    );
    return rows.map((r) => ({
        id: r.id,
        keyword: r.keyword,
        location: r.location,
        device: r.device,
        type: r.type,
        severity: r.severity,
        previousPosition: r.previous_position,
        position: r.position,
        message: r.message,
        paths: r.paths || [],
        createdAt: r.created_at,
        read: !!r.read_at,
    }));
}

export async function unreadCount(siteId) {
    const { rows } = await query(
        `SELECT COUNT(*)::int AS n FROM search_alerts WHERE site_id = $1 AND read_at IS NULL`,
        [siteId],
    );
    return rows[0]?.n || 0;
}

/** Mark the given alerts read, or every unread alert when `ids` is empty. */
export async function markRead(siteId, ids = []) {
    const clean = (Array.isArray(ids) ? ids : [])
        .map((v) => parseInt(v))
        .filter((v) => Number.isInteger(v) && v > 0)
        .slice(0, MAX_LIMIT);

    const { rowCount } = clean.length
        ? await query(
            `UPDATE search_alerts SET read_at = NOW()
              WHERE site_id = $1 AND read_at IS NULL AND id = ANY($2::int[])`,
            [siteId, clean],
        )
        : await query(
            `UPDATE search_alerts SET read_at = NOW()
              WHERE site_id = $1 AND read_at IS NULL`,
            [siteId],
        );
    return rowCount;
}

export default { recordAlerts, listAlerts, unreadCount, markRead };
