import { query, getPool } from '../db/postgres.js';
import { v4 as uuidv4 } from 'uuid';
import { sanitiseUrl, sanitiseReferrer, sanitiseProperties } from '../utils/urlPrivacy.js';

export const trackingService = {
    async trackEvent(eventData) {
        const {
            siteId, userId, sessionId,
            type = 'pageview', url, path, referrer,
            device = 'Desktop', browser = '', os = '',
            country = '', city = '',
            props = {}, properties = {},
            utm_source = '', utm_medium = '', utm_campaign = '',
            utm_term = '', utm_content = '',
        } = eventData;

        const mergedProps = { ...props, ...properties };

        if (!siteId || !userId) {
            throw new Error('siteId and userId are required');
        }

        const ALLOWED_TYPES = ['pageview', 'click', 'impression', 'add_to_cart', 'checkout', 'purchase', 'signup', 'custom', 'form_submit', 'lead', 'scroll_depth', 'time_on_page', 'button_click', 'signup_start', 'video_play', 'web_vital', 'js_error', 'heatmap_click', 'rage_click', 'site_search', 'experiment_view'];
        const safeType = ALLOWED_TYPES.includes(type) ? type : 'custom';
        const safeStr = (s, max = 255) => (typeof s === 'string' ? s.slice(0, max) : '');

        const sid = sessionId || uuidv4();

        await query(
            `INSERT INTO events (site_id, user_id, session_id, type, url, path, referrer, device, browser, os, country, city, timestamp, properties, utm_source, utm_medium, utm_campaign, utm_term, utm_content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
            [
                safeStr(siteId, 64), safeStr(userId, 64), safeStr(sid, 64), safeType,
                // Sensitive query params are stripped before storage — see
                // utils/urlPrivacy.js. Done server-side so sites still serving an
                // older cached tracking script are covered too.
                safeStr(sanitiseUrl(url || ''), 2048), safeStr(sanitiseUrl(path || '/'), 512),
                sanitiseReferrer(referrer),
                safeStr(device, 50), safeStr(browser, 255), safeStr(os, 100),
                safeStr(country, 100), safeStr(city, 255),
                new Date().toISOString(),
                // Sensitive keys (email, token, password…) are redacted before
                // storage — see utils/urlPrivacy.js.
                JSON.stringify(sanitiseProperties(mergedProps)),
                safeStr(utm_source, 255), safeStr(utm_medium, 255), safeStr(utm_campaign, 255),
                safeStr(utm_term, 255), safeStr(utm_content, 255),
            ]
        );

        return { success: true, sessionId: sid };
    },

    async upsertSession(sessionData) {
        const {
            sessionId, siteId, userId,
            entryPage, exitPage, referrer,
            device = 'Desktop', browser = '', os = '', country = '',
            duration = 0, pageviews = 1,
            utm_source = '', utm_medium = '', utm_campaign = '',
        } = sessionData;

        const existingResult = await query(
            `SELECT id, pageviews, started_at FROM sessions WHERE id = $1 LIMIT 1`,
            [sessionId]
        );

        const existingSession = existingResult.rows[0];

        if (existingSession) {
            const newPageviews = Number(existingSession.pageviews) + 1;
            await query(
                `UPDATE sessions SET ended_at = $1, duration = $2, pageviews = $3, exit_page = $4, is_bounce = $5 WHERE id = $6`,
                [new Date().toISOString(), duration, newPageviews, exitPage || entryPage, newPageviews === 1, sessionId]
            );
        } else {
            await query(
                `INSERT INTO sessions (id, site_id, user_id, started_at, ended_at, duration, pageviews, entry_page, exit_page, referrer, device, browser, os, country, is_bounce, utm_source, utm_medium, utm_campaign)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
                [
                    sessionId, siteId, userId,
                    new Date().toISOString(), new Date().toISOString(),
                    duration, pageviews, sanitiseUrl(entryPage || ''), sanitiseUrl(exitPage || entryPage || ''),
                    sanitiseReferrer(referrer), device, browser, os, country, true,
                    utm_source, utm_medium, utm_campaign,
                ]
            );
        }

        return { success: true, sessionId };
    },

    async endSession(sessionId, duration) {
        const existingResult = await query(
            `SELECT * FROM sessions WHERE id = $1 LIMIT 1`,
            [sessionId]
        );

        const session = existingResult.rows[0];

        if (session) {
            await query(
                `UPDATE sessions SET ended_at = $1, duration = $2, is_bounce = $3 WHERE id = $4`,
                [new Date().toISOString(), duration || session.duration, session.pageviews === 1, sessionId]
            );
            return { success: true, sessionId };
        }

        return { success: false, error: 'Session not found' };
    },

    async trackBatch(events) {
        const p = getPool();
        const client = await p.connect();

        try {
            await client.query('BEGIN');

            const insertQuery = `
        INSERT INTO events (site_id, user_id, session_id, type, url, path, referrer, device, browser, os, country, city, timestamp, properties)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `;

            for (const event of events) {
                await client.query(insertQuery, [
                    event.siteId, event.userId, event.sessionId || uuidv4(),
                    event.type || 'pageview', sanitiseUrl(event.url || ''), sanitiseUrl(event.path || '/'),
                    sanitiseReferrer(event.referrer), event.device || 'Desktop',
                    event.browser || '', event.os || '',
                    event.country || '', event.city || '',
                    event.timestamp || new Date().toISOString(),
                    JSON.stringify(sanitiseProperties(event.props || {})),
                ]);
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        return { success: true, count: events.length };
    },
};

export default trackingService;
