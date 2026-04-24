/**
 * Analytical query functions running against DuckDB.
 *
 * These mirror the legacy backend endpoints so the UI
 * can use either backend interchangeably.
 *
 * Mapping (legacy route → DuckDB function):
 *   /traffic            → getTrafficOverTime
 *   /bounce-rate-trend  → getBounceRateOverTime
 *   /avg-session-trend  → getAvgSessionOverTime
 *   /pageviews          → getPageViewsOverTime
 *   /top-pages          → getTopPages
 *   /sources            → getTrafficSources
 *   /devices            → getDeviceBreakdown
 *   /countries          → getCountries
 *   /sessions           → getSessionDuration
 *   /kpi                → getKPISummary
 *   /funnel             → getFunnelData
 *   /realtime           → getRealTimeVisitors
 *   /utm                → getUTMCampaigns
 *   /comparison         → getComparisonTraffic
 *   /user-flow          → getUserFlow
 *   /alerts             → getAlerts
 *
 * Bonus queries (DuckDB-only, no legacy backend equivalent):
 *   getDailyActiveUsers, getHourlyTraffic, getSessionBuckets,
 *   getBounceRateByPage, getUserRetention
 */

import { duckAll, closeDuck } from '../db/duckdb.js';

// ─── Helper ──────────────────────────────────────────────────────

/** Convert a DuckDB DATE value (JS Date object) to 'YYYY-MM-DD' string */
function toDateStr(val) {
    if (!val) return '';
    if (val instanceof Date) return val.toISOString().split('T')[0];
    const s = String(val);
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // Try parsing as Date
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return s;
}

function getDateRange(range) {
    if (typeof range === 'string' && range.startsWith('custom:')) {
        const parts = range.split(':');
        if (parts.length === 3) {
            const start = new Date(parts[1]);
            const end = new Date(parts[2]);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                return { start: start.toISOString(), end: end.toISOString() };
            }
        }
    }

    const end = new Date();
    const start = new Date();

    switch (range) {
        case 'today': case '1d': start.setHours(0, 0, 0, 0); break;
        case '7d': start.setDate(start.getDate() - 7); break;
        case '90d': start.setDate(start.getDate() - 90); break;
        case '30d': default: start.setDate(start.getDate() - 30); break;
    }

    return { start: start.toISOString(), end: end.toISOString() };
}

// ═══════════════════════════════════════════════════════════════════
// Endpoint-matched queries (same response shape as the legacy backend)
// ═══════════════════════════════════════════════════════════════════

/** GET /api/analytics/:siteId/traffic */
export async function getTrafficOverTime(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       CAST(timestamp AS DATE)              AS date,
       COUNT(DISTINCT user_id)              AS visitors,
       COUNT(DISTINCT session_id)           AS sessions,
       COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS pageviews
     FROM events
     WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
     GROUP BY 1 ORDER BY 1`,
        [siteId, start, end],
    );
    return rows.map(r => ({
        date: toDateStr(r.date),
        visitors: Number(r.visitors),
        sessions: Number(r.sessions),
        pageviews: Number(r.pageviews),
    }));
}

/** GET /api/analytics/:siteId/bounce-rate-trend */
export async function getBounceRateOverTime(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       CAST(started_at AS DATE) AS date,
       COUNT(*)                 AS total_sessions,
       SUM(CASE WHEN is_bounce THEN 1 ELSE 0 END) AS bounced
     FROM sessions
     WHERE site_id = ? AND started_at >= ? AND started_at <= ?
     GROUP BY 1 ORDER BY 1`,
        [siteId, start, end],
    );
    return rows.map(r => {
        const total = Number(r.total_sessions);
        const bounced = Number(r.bounced);
        return {
            date: toDateStr(r.date),
            bounceRate: total > 0 ? Math.round((bounced / total) * 1000) / 10 : 0,
        };
    });
}

/** GET /api/analytics/:siteId/avg-session-trend */
export async function getAvgSessionOverTime(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       CAST(started_at AS DATE) AS date,
       AVG(duration)            AS avg_duration
     FROM sessions
     WHERE site_id = ? AND started_at >= ? AND started_at <= ?
     GROUP BY 1 ORDER BY 1`,
        [siteId, start, end],
    );
    return rows.map(r => ({
        date: toDateStr(r.date),
        avgDuration: Math.round(Number(r.avg_duration || 0)),
    }));
}

/** GET /api/analytics/:siteId/pageviews */
export async function getPageViewsOverTime(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       CAST(timestamp AS DATE) AS date,
       COUNT(*)                AS pageviews
     FROM events
     WHERE site_id = ? AND type = 'pageview'
       AND timestamp >= ? AND timestamp <= ?
     GROUP BY 1 ORDER BY 1`,
        [siteId, start, end],
    );
    return rows.map(r => ({
        date: toDateStr(r.date),
        pageviews: Number(r.pageviews),
    }));
}

/** GET /api/analytics/:siteId/top-pages */
export async function getTopPages(siteId, dateRange = '30d', limit = 10) {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       path,
       path AS title,
       COUNT(*)                AS views,
       COUNT(DISTINCT user_id) AS unique_visitors
     FROM events
     WHERE site_id = ? AND type = 'pageview'
       AND timestamp >= ? AND timestamp <= ?
     GROUP BY path
     ORDER BY views DESC
     LIMIT ?`,
        [siteId, start, end, limit],
    );
    return rows.map(r => ({
        path: r.path,
        title: r.title,
        views: Number(r.views),
        uniqueVisitors: Number(r.unique_visitors),
    }));
}

/** GET /api/analytics/:siteId/sources */
export async function getTrafficSources(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       CASE
         WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
         WHEN referrer ILIKE '%google%' OR referrer ILIKE '%bing%'
              OR referrer ILIKE '%yahoo%' OR referrer ILIKE '%duckduckgo%'
              OR referrer ILIKE '%baidu%' OR referrer ILIKE '%yandex%'
           THEN 'Search'
         WHEN referrer ILIKE '%facebook%' OR referrer ILIKE '%twitter%'
              OR referrer ILIKE '%linkedin%' OR referrer ILIKE '%instagram%'
              OR referrer ILIKE '%youtube%' OR referrer ILIKE '%reddit%'
              OR referrer ILIKE '%pinterest%' OR referrer ILIKE '%tiktok%'
           THEN 'Social'
         WHEN referrer ILIKE '%mail%' OR referrer ILIKE '%email%'
              OR referrer ILIKE '%outlook%'
           THEN 'Email'
         ELSE 'Referral'
       END AS source,
       COUNT(DISTINCT user_id) AS visitors
     FROM events
     WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
     GROUP BY source
     ORDER BY visitors DESC`,
        [siteId, start, end],
    );
    const total = rows.reduce((s, r) => s + Number(r.visitors), 0);
    return rows.map(r => ({
        source: r.source,
        visitors: Number(r.visitors),
        percentage: total > 0 ? Math.round((Number(r.visitors) / total) * 100) : 0,
    }));
}

/** GET /api/analytics/:siteId/devices */
export async function getDeviceBreakdown(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       CASE WHEN device = '' OR device IS NULL THEN 'Desktop' ELSE device END AS device,
       COUNT(DISTINCT user_id) AS visitors
     FROM events
     WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
     GROUP BY device
     ORDER BY visitors DESC`,
        [siteId, start, end],
    );
    const total = rows.reduce((s, r) => s + Number(r.visitors), 0);
    return rows.map(r => ({
        device: r.device,
        visitors: Number(r.visitors),
        percentage: total > 0 ? Math.round((Number(r.visitors) / total) * 100) : 0,
    }));
}

/** GET /api/analytics/:siteId/countries */
export async function getCountries(siteId, dateRange = '30d', limit = 10) {
    const { start, end } = getDateRange(dateRange);
    const countryCodeMap = {
        'United States': 'US', 'United Kingdom': 'GB', 'Germany': 'DE',
        'France': 'FR', 'Canada': 'CA', 'India': 'IN', 'Australia': 'AU',
        'Japan': 'JP', 'Brazil': 'BR', 'Spain': 'ES',
    };
    const rows = await duckAll(
        `SELECT
       CASE WHEN country = '' OR country IS NULL THEN 'Unknown' ELSE country END AS country,
       COUNT(DISTINCT user_id) AS visitors
     FROM events
     WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
     GROUP BY country
     ORDER BY visitors DESC
     LIMIT ?`,
        [siteId, start, end, limit],
    );
    const total = rows.reduce((s, r) => s + Number(r.visitors), 0);
    return rows.map(r => ({
        country: r.country,
        code: countryCodeMap[r.country] || 'OTHER',
        visitors: Number(r.visitors),
        percentage: total > 0 ? Math.round((Number(r.visitors) / total) * 100) : 0,
    }));
}

/** GET /api/analytics/:siteId/sessions */
export async function getSessionDuration(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT bucket, sessions FROM (
       SELECT
         CASE
           WHEN duration < 10  THEN '0-10s'
           WHEN duration < 30  THEN '10-30s'
           WHEN duration < 60  THEN '30s-1m'
           WHEN duration < 180 THEN '1-3m'
           WHEN duration < 600 THEN '3-10m'
           ELSE '10m+'
         END AS bucket,
         COUNT(*) AS sessions
       FROM sessions
       WHERE site_id = ? AND started_at >= ? AND started_at <= ?
       GROUP BY 1
     ) sub
     ORDER BY
       CASE bucket
         WHEN '0-10s'  THEN 1
         WHEN '10-30s' THEN 2
         WHEN '30s-1m' THEN 3
         WHEN '1-3m'   THEN 4
         WHEN '3-10m'  THEN 5
         WHEN '10m+'   THEN 6
       END`,
        [siteId, start, end],
    );
    const total = rows.reduce((s, r) => s + Number(r.sessions), 0) || 1;
    return rows.map(r => ({
        bucket: r.bucket,
        sessions: Number(r.sessions),
        percentage: Math.round((Number(r.sessions) / total) * 100),
    }));
}

/** GET /api/analytics/:siteId/kpi */
export async function getKPISummary(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const currentStart = new Date(start);
    const currentEnd = new Date(end);
    const periodMs = currentEnd.getTime() - currentStart.getTime();
    const prevEnd = new Date(currentStart.getTime());
    const prevStart = new Date(currentStart.getTime() - periodMs);

    const [eventRows, sessionRows, prevEventRows, prevSessionRows] = await Promise.all([
        duckAll(
            `SELECT
         COUNT(DISTINCT user_id) AS total_visitors,
         COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS total_pageviews
       FROM events
       WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?`,
            [siteId, start, end],
        ),
        duckAll(
            `SELECT
         COUNT(*)             AS total_sessions,
         AVG(duration)        AS avg_duration,
         SUM(CASE WHEN is_bounce THEN 1 ELSE 0 END) AS bounces
       FROM sessions
       WHERE site_id = ? AND started_at >= ? AND started_at <= ?`,
            [siteId, start, end],
        ),
        duckAll(
            `SELECT
         COUNT(DISTINCT user_id) AS total_visitors,
         COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS total_pageviews
       FROM events
       WHERE site_id = ? AND timestamp >= ? AND timestamp < ?`,
            [siteId, prevStart.toISOString(), prevEnd.toISOString()],
        ),
        duckAll(
            `SELECT
         COUNT(*)             AS total_sessions,
         AVG(duration)        AS avg_duration,
         SUM(CASE WHEN is_bounce THEN 1 ELSE 0 END) AS bounces
       FROM sessions
       WHERE site_id = ? AND started_at >= ? AND started_at < ?`,
            [siteId, prevStart.toISOString(), prevEnd.toISOString()],
        ),
    ]);

    const totalVisitors = Number(eventRows[0]?.total_visitors || 0);
    const totalPageviews = Number(eventRows[0]?.total_pageviews || 0);
    const totalSessions = Number(sessionRows[0]?.total_sessions || 0);
    const avgDuration = Number(sessionRows[0]?.avg_duration || 0);
    const bounces = Number(sessionRows[0]?.bounces || 0);
    const bounceRate = totalSessions > 0 ? (bounces / totalSessions) * 100 : 0;

    const prevVisitors = Number(prevEventRows[0]?.total_visitors || 0);
    const prevPageviews = Number(prevEventRows[0]?.total_pageviews || 0);
    const prevSessions = Number(prevSessionRows[0]?.total_sessions || 0);
    const prevAvgDuration = Number(prevSessionRows[0]?.avg_duration || 0);
    const prevBounces = Number(prevSessionRows[0]?.bounces || 0);
    const prevBounceRate = prevSessions > 0 ? (prevBounces / prevSessions) * 100 : 0;

    function calcTrend(current, previous) {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 1000) / 10;
    }

    const minutes = Math.floor(avgDuration / 60);
    const seconds = Math.round(avgDuration % 60);

    return {
        totalVisitors,
        totalPageviews,
        totalSessions,
        bounceRate: Math.round(bounceRate * 10) / 10,
        avgSessionDuration: `${minutes}m ${seconds}s`,
        pagesPerSession: totalSessions > 0 ? (totalPageviews / totalSessions).toFixed(2) : '0.00',
        visitorsTrend: calcTrend(totalVisitors, prevVisitors),
        pageviewsTrend: calcTrend(totalPageviews, prevPageviews),
        bounceRateTrend: calcTrend(bounceRate, prevBounceRate),
        sessionTrend: calcTrend(avgDuration, prevAvgDuration),
    };
}

/** GET /api/analytics/:siteId/funnel */
export async function getFunnelData(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const totalRows = await duckAll(
        `SELECT COUNT(DISTINCT user_id) AS total
     FROM events
     WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?`,
        [siteId, start, end],
    );
    const totalVisitors = Number(totalRows[0]?.total || 0);

    const funnelRows = await duckAll(
        `SELECT
       COUNT(DISTINCT CASE WHEN type = 'pageview' THEN user_id END)                          AS step1,
       COUNT(DISTINCT CASE WHEN type = 'pageview' AND path = '/products' THEN user_id END)   AS step2,
       COUNT(DISTINCT CASE WHEN type = 'add_to_cart' THEN user_id END)                       AS step3,
       COUNT(DISTINCT CASE WHEN type = 'checkout' THEN user_id END)                          AS step4,
       COUNT(DISTINCT CASE WHEN type = 'purchase' THEN user_id END)                          AS step5
     FROM events
     WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?`,
        [siteId, start, end],
    );

    const d = funnelRows[0] || {};
    const steps = [
        { step: 'Visit Homepage', visitors: Number(d.step1 || 0) },
        { step: 'View Product', visitors: Number(d.step2 || 0) },
        { step: 'Add to Cart', visitors: Number(d.step3 || 0) },
        { step: 'Checkout', visitors: Number(d.step4 || 0) },
        { step: 'Purchase', visitors: Number(d.step5 || 0) },
    ];

    return steps.map(s => ({
        step: s.step,
        visitors: s.visitors,
        percentage: totalVisitors > 0 ? Math.round((s.visitors / totalVisitors) * 1000) / 10 : 0,
    }));
}

/** GET /api/analytics/:siteId/realtime */
export async function getRealTimeVisitors(siteId) {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const [activeRows, pagesRows, devicesRows, countriesRows] = await Promise.all([
        duckAll(
            `SELECT COUNT(DISTINCT user_id) AS active_visitors
       FROM events WHERE site_id = ? AND timestamp >= ?`,
            [siteId, fiveMinAgo],
        ),
        duckAll(
            `SELECT path, COUNT(DISTINCT user_id) AS visitors
       FROM events WHERE site_id = ? AND timestamp >= ? AND type = 'pageview'
       GROUP BY path ORDER BY visitors DESC LIMIT 10`,
            [siteId, fiveMinAgo],
        ),
        duckAll(
            `SELECT
         CASE WHEN device = '' OR device IS NULL THEN 'Desktop' ELSE device END AS device,
         COUNT(DISTINCT user_id) AS count
       FROM events WHERE site_id = ? AND timestamp >= ?
       GROUP BY device ORDER BY count DESC`,
            [siteId, fiveMinAgo],
        ),
        duckAll(
            `SELECT
         CASE WHEN country = '' OR country IS NULL THEN 'Unknown' ELSE country END AS country,
         COUNT(DISTINCT user_id) AS visitors
       FROM events WHERE site_id = ? AND timestamp >= ?
       GROUP BY country ORDER BY visitors DESC LIMIT 10`,
            [siteId, fiveMinAgo],
        ),
    ]);

    const devices = {};
    devicesRows.forEach(r => { devices[r.device] = Number(r.count); });

    return {
        activeVisitors: Number(activeRows[0]?.active_visitors || 0),
        topPages: pagesRows.map(r => ({ path: r.path, visitors: Number(r.visitors) })),
        devices,
        countries: countriesRows.map(r => ({ country: r.country, visitors: Number(r.visitors) })),
    };
}

/** GET /api/analytics/:siteId/realtime/event-stream */
export async function getRealtimeEventStream(siteId, limit = 50) {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const rows = await duckAll(
        `SELECT
       id, type, path, url, referrer, device, browser, os,
       country, city, user_id, session_id, timestamp,
       utm_source, utm_medium, utm_campaign
     FROM events
     WHERE site_id = ? AND timestamp >= ?
     ORDER BY timestamp DESC
     LIMIT ?`,
        [siteId, fiveMinAgo, limit],
    );

    return rows.map(r => ({
        id: r.id,
        type: r.type,
        path: r.path,
        url: r.url,
        referrer: r.referrer || null,
        device: r.device || 'Desktop',
        browser: r.browser || 'Unknown',
        os: r.os || 'Unknown',
        country: r.country || 'Unknown',
        city: r.city || null,
        userId: r.user_id,
        sessionId: r.session_id,
        timestamp: r.timestamp,
        utmSource: r.utm_source || null,
        utmMedium: r.utm_medium || null,
        utmCampaign: r.utm_campaign || null,
    }));
}

/** GET /api/analytics/:siteId/utm */
export async function getUTMCampaigns(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       CASE WHEN utm_source  = '' OR utm_source  IS NULL THEN '(none)' ELSE utm_source  END AS source,
       CASE WHEN utm_medium  = '' OR utm_medium  IS NULL THEN '(none)' ELSE utm_medium  END AS medium,
       CASE WHEN utm_campaign = '' OR utm_campaign IS NULL THEN '(none)' ELSE utm_campaign END AS campaign,
       COUNT(DISTINCT user_id) AS visitors,
       COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS pageviews
     FROM events
     WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
       AND (utm_source != '' OR utm_medium != '' OR utm_campaign != '')
     GROUP BY source, medium, campaign
     ORDER BY visitors DESC
     LIMIT 20`,
        [siteId, start, end],
    );
    const total = rows.reduce((s, r) => s + Number(r.visitors), 0) || 1;
    return rows.map(r => ({
        source: r.source,
        medium: r.medium,
        campaign: r.campaign,
        visitors: Number(r.visitors),
        pageviews: Number(r.pageviews),
        percentage: Math.round((Number(r.visitors) / total) * 100),
    }));
}

/** GET /api/analytics/:siteId/comparison */
export async function getComparisonTraffic(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const currentStart = new Date(start);
    const currentEnd = new Date(end);
    const periodMs = currentEnd.getTime() - currentStart.getTime();
    const prevEnd = new Date(currentStart.getTime());
    const prevStart = new Date(currentStart.getTime() - periodMs);

    const [currentRows, previousRows] = await Promise.all([
        duckAll(
            `SELECT
         CAST(timestamp AS DATE)              AS date,
         COUNT(DISTINCT user_id)              AS visitors,
         COUNT(DISTINCT session_id)           AS sessions,
         COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS pageviews
       FROM events
       WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
       GROUP BY 1 ORDER BY 1`,
            [siteId, start, end],
        ),
        duckAll(
            `SELECT
         CAST(timestamp AS DATE)              AS date,
         COUNT(DISTINCT user_id)              AS visitors,
         COUNT(DISTINCT session_id)           AS sessions,
         COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS pageviews
       FROM events
       WHERE site_id = ? AND timestamp >= ? AND timestamp < ?
       GROUP BY 1 ORDER BY 1`,
            [siteId, prevStart.toISOString(), prevEnd.toISOString()],
        ),
    ]);

    const fmt = (r) => ({
        date: toDateStr(r.date),
        visitors: Number(r.visitors),
        sessions: Number(r.sessions),
        pageviews: Number(r.pageviews),
    });

    const current = currentRows.map(fmt);
    const previous = previousRows.map(fmt);

    const merged = current.map((c, i) => ({
        date: c.date,
        visitors: c.visitors,
        sessions: c.sessions,
        pageviews: c.pageviews,
        prevVisitors: previous[i]?.visitors ?? 0,
        prevSessions: previous[i]?.sessions ?? 0,
        prevPageviews: previous[i]?.pageviews ?? 0,
        prevDate: previous[i]?.date ?? null,
    }));

    return {
        current,
        previous,
        merged,
        period: {
            current: { start: start.split('T')?.[0] || start, end: end.split('T')?.[0] || end },
            previous: { start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] },
        },
    };
}

/** GET /api/analytics/:siteId/user-flow */
export async function getUserFlow(siteId, dateRange = '30d', limit = 20) {
    const { start, end } = getDateRange(dateRange);

    const transitionRows = await duckAll(
        `WITH ordered_pages AS (
       SELECT
         session_id,
         path,
         timestamp,
         LEAD(path) OVER (PARTITION BY session_id ORDER BY timestamp) AS next_path
       FROM events
       WHERE site_id = ? AND type = 'pageview'
         AND timestamp >= ? AND timestamp <= ?
     )
     SELECT
       path      AS from_page,
       next_path AS to_page,
       COUNT(*)  AS transitions
     FROM ordered_pages
     WHERE next_path IS NOT NULL
     GROUP BY path, next_path
     ORDER BY transitions DESC
     LIMIT ?`,
        [siteId, start, end, limit],
    );

    const [entryRows, exitRows] = await Promise.all([
        duckAll(
            `SELECT entry_page AS page, COUNT(*) AS count
       FROM sessions
       WHERE site_id = ? AND started_at >= ? AND started_at <= ?
         AND entry_page IS NOT NULL
       GROUP BY entry_page ORDER BY count DESC LIMIT 10`,
            [siteId, start, end],
        ),
        duckAll(
            `SELECT exit_page AS page, COUNT(*) AS count
       FROM sessions
       WHERE site_id = ? AND started_at >= ? AND started_at <= ?
         AND exit_page IS NOT NULL
       GROUP BY exit_page ORDER BY count DESC LIMIT 10`,
            [siteId, start, end],
        ),
    ]);

    return {
        transitions: transitionRows.map(r => ({ from: r.from_page, to: r.to_page, count: Number(r.transitions) })),
        entryPages: entryRows.map(r => ({ page: r.page, count: Number(r.count) })),
        exitPages: exitRows.map(r => ({ page: r.page, count: Number(r.count) })),
    };
}

/** GET /api/analytics/:siteId/alerts */
export async function getAlerts(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const rows = await duckAll(
        `SELECT
       CAST(timestamp AS DATE)              AS date,
       COUNT(DISTINCT user_id)              AS visitors,
       COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS pageviews
     FROM events
     WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
     GROUP BY 1 ORDER BY 1`,
        [siteId, start, end],
    );

    const daily = rows.map(r => ({
        date: toDateStr(r.date),
        visitors: Number(r.visitors),
        pageviews: Number(r.pageviews),
    }));

    if (daily.length < 3) return [];

    const alerts = [];
    for (let i = 3; i < daily.length; i++) {
        const win = daily.slice(Math.max(0, i - 7), i);
        const avgVisitors = win.reduce((s, d) => s + d.visitors, 0) / win.length;
        const stdDev = Math.sqrt(
            win.reduce((s, d) => s + Math.pow(d.visitors - avgVisitors, 2), 0) / win.length,
        );

        const current = daily[i];
        const threshold = 2;

        if (stdDev > 0 && current.visitors > avgVisitors + threshold * stdDev) {
            alerts.push({
                type: 'spike', severity: 'warning', date: current.date,
                message: `Traffic spike: ${current.visitors} visitors (avg: ${Math.round(avgVisitors)})`,
                value: current.visitors, average: Math.round(avgVisitors),
                change: Math.round(((current.visitors - avgVisitors) / avgVisitors) * 100),
            });
        } else if (stdDev > 0 && current.visitors < avgVisitors - threshold * stdDev) {
            alerts.push({
                type: 'drop', severity: 'error', date: current.date,
                message: `Traffic drop: ${current.visitors} visitors (avg: ${Math.round(avgVisitors)})`,
                value: current.visitors, average: Math.round(avgVisitors),
                change: Math.round(((current.visitors - avgVisitors) / avgVisitors) * 100),
            });
        }
    }

    return alerts.reverse();
}

// ═══════════════════════════════════════════════════════════════════
// Bonus DuckDB-only analytical queries
// ═══════════════════════════════════════════════════════════════════

/** Daily Active Users — distinct users per day. */
export async function getDailyActiveUsers(siteId, days = 30) {
    return duckAll(
        `SELECT
       CAST(timestamp AS DATE)  AS date,
       COUNT(DISTINCT user_id)  AS unique_users
     FROM events
     WHERE site_id = ?
       AND timestamp >= current_date - INTERVAL '${days} days'
     GROUP BY 1 ORDER BY 1`,
        [siteId],
    );
}

/** Hourly traffic pattern. */
export async function getHourlyTraffic(siteId, days = 7) {
    return duckAll(
        `SELECT
       EXTRACT(HOUR FROM timestamp) AS hour,
       COUNT(DISTINCT user_id)      AS visitors,
       COUNT(*)                     AS pageviews
     FROM events
     WHERE site_id = ? AND type = 'pageview'
       AND timestamp >= current_date - INTERVAL '${days} days'
     GROUP BY 1 ORDER BY 1`,
        [siteId],
    );
}

/** Session duration distribution buckets. */
export async function getSessionBuckets(siteId, days = 30) {
    return duckAll(
        `SELECT
       CASE
         WHEN duration < 10  THEN '0-10s'
         WHEN duration < 30  THEN '10-30s'
         WHEN duration < 60  THEN '30-60s'
         WHEN duration < 180 THEN '1-3m'
         WHEN duration < 600 THEN '3-10m'
         ELSE '10m+'
       END AS bucket,
       COUNT(*) AS count
     FROM sessions
     WHERE site_id = ?
       AND started_at >= current_date - INTERVAL '${days} days'
     GROUP BY 1
     ORDER BY MIN(duration)`,
        [siteId],
    );
}

/** Bounce rate by entry page. */
export async function getBounceRateByPage(siteId, days = 30, limit = 10) {
    return duckAll(
        `SELECT
       entry_page                    AS page,
       COUNT(*)                      AS total_sessions,
       SUM(CASE WHEN is_bounce THEN 1 ELSE 0 END) AS bounced_sessions,
       ROUND(
         SUM(CASE WHEN is_bounce THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1
       ) AS bounce_rate
     FROM sessions
     WHERE site_id = ?
       AND started_at >= current_date - INTERVAL '${days} days'
       AND entry_page IS NOT NULL
     GROUP BY entry_page
     ORDER BY total_sessions DESC
     LIMIT ?`,
        [siteId, limit],
    );
}

/** Cohort-based user retention. */
export async function getUserRetention(siteId, days = 30) {
    return duckAll(
        `WITH first_visit AS (
       SELECT user_id, CAST(MIN(timestamp) AS DATE) AS cohort_date
       FROM events
       WHERE site_id = ?
         AND timestamp >= current_date - INTERVAL '${days} days'
       GROUP BY user_id
     ),
     activity AS (
       SELECT e.user_id, fv.cohort_date,
              CAST(e.timestamp AS DATE) - fv.cohort_date AS day_offset
       FROM events e
       JOIN first_visit fv ON e.user_id = fv.user_id
       WHERE e.site_id = ?
     )
     SELECT
       cohort_date, day_offset,
       COUNT(DISTINCT user_id) AS returning_users,
       (SELECT COUNT(DISTINCT user_id) FROM first_visit WHERE cohort_date = a.cohort_date) AS cohort_size,
       ROUND(
         COUNT(DISTINCT user_id) * 100.0
         / NULLIF((SELECT COUNT(DISTINCT user_id) FROM first_visit WHERE cohort_date = a.cohort_date), 0),
         1
       ) AS retention_pct
     FROM activity a
     WHERE day_offset BETWEEN 0 AND 7
     GROUP BY cohort_date, day_offset
     ORDER BY cohort_date, day_offset`,
        [siteId, siteId],
    );
}

// ═══════════════════════════════════════════════════════════════════
// Engagement queries (scroll depth, heatmaps, rage clicks, time on page)
// ═══════════════════════════════════════════════════════════════════

/** GET /api/analytics/:siteId/engagement/scroll-depth — Scroll depth distribution by page */
export async function getScrollDepth(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       path,
       COUNT(CASE WHEN CAST(json_extract(properties, '$.depth') AS INT) >= 25 THEN 1 END) AS reached_25,
       COUNT(CASE WHEN CAST(json_extract(properties, '$.depth') AS INT) >= 50 THEN 1 END) AS reached_50,
       COUNT(CASE WHEN CAST(json_extract(properties, '$.depth') AS INT) >= 75 THEN 1 END) AS reached_75,
       COUNT(CASE WHEN CAST(json_extract(properties, '$.depth') AS INT) >= 100 THEN 1 END) AS reached_100,
       COUNT(*) AS total_events,
       ROUND(AVG(CAST(json_extract(properties, '$.depth') AS DOUBLE)), 1) AS avg_depth
     FROM events
     WHERE site_id = ? AND type = 'scroll_depth'
       AND timestamp >= ? AND timestamp <= ?
       AND json_extract(properties, '$.milestone') = 'true'
     GROUP BY path
     ORDER BY total_events DESC
     LIMIT 20`,
        [siteId, start, end],
    );
    return rows.map(r => ({
        path: r.path,
        reached25: Number(r.reached_25),
        reached50: Number(r.reached_50),
        reached75: Number(r.reached_75),
        reached100: Number(r.reached_100),
        totalEvents: Number(r.total_events),
        avgDepth: Number(r.avg_depth || 0),
    }));
}

/** GET /api/analytics/:siteId/engagement/heatmap — Click heatmap data for a page */
export async function getHeatmapData(siteId, dateRange = '30d', path = '/') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       CAST(json_extract(properties, '$.relX') AS DOUBLE) AS rel_x,
       CAST(json_extract(properties, '$.relY') AS DOUBLE) AS rel_y,
       CAST(json_extract(properties, '$.x') AS INT) AS abs_x,
       CAST(json_extract(properties, '$.y') AS INT) AS abs_y,
       json_extract_string(properties, '$.selector') AS selector,
       COUNT(*) AS clicks
     FROM events
     WHERE site_id = ? AND type = 'heatmap_click'
       AND timestamp >= ? AND timestamp <= ?
       AND path = ?
     GROUP BY rel_x, rel_y, abs_x, abs_y, selector
     ORDER BY clicks DESC
     LIMIT 500`,
        [siteId, start, end, path],
    );
    return rows.map(r => ({
        relX: Number(r.rel_x || 0),
        relY: Number(r.rel_y || 0),
        absX: Number(r.abs_x || 0),
        absY: Number(r.abs_y || 0),
        selector: r.selector || '',
        clicks: Number(r.clicks),
    }));
}

/** GET /api/analytics/:siteId/engagement/heatmap-summary — Top clicked elements per page */
export async function getHeatmapSummary(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       path,
       json_extract_string(properties, '$.selector') AS selector,
       COUNT(*) AS clicks
     FROM events
     WHERE site_id = ? AND type = 'heatmap_click'
       AND timestamp >= ? AND timestamp <= ?
     GROUP BY path, selector
     ORDER BY clicks DESC
     LIMIT 50`,
        [siteId, start, end],
    );
    return rows.map(r => ({
        path: r.path,
        selector: r.selector || '',
        clicks: Number(r.clicks),
    }));
}

/** GET /api/analytics/:siteId/engagement/rage-clicks — Rage click incidents */
export async function getRageClicks(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       path,
       json_extract_string(properties, '$.selector') AS selector,
       COUNT(*) AS incidents,
       SUM(CAST(json_extract(properties, '$.count') AS INT)) AS total_clicks,
       MIN(timestamp) AS first_seen,
       MAX(timestamp) AS last_seen
     FROM events
     WHERE site_id = ? AND type = 'rage_click'
       AND timestamp >= ? AND timestamp <= ?
     GROUP BY path, selector
     ORDER BY incidents DESC
     LIMIT 30`,
        [siteId, start, end],
    );
    return rows.map(r => ({
        path: r.path,
        selector: r.selector || '',
        incidents: Number(r.incidents),
        totalClicks: Number(r.total_clicks || 0),
        firstSeen: r.first_seen,
        lastSeen: r.last_seen,
    }));
}

/** GET /api/analytics/:siteId/engagement/time-on-page — Per-page average read time */
export async function getTimeOnPage(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       path,
       ROUND(AVG(CAST(json_extract(properties, '$.seconds') AS DOUBLE)), 1) AS avg_time,
       ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(json_extract(properties, '$.seconds') AS DOUBLE)), 1) AS median_time,
       MIN(CAST(json_extract(properties, '$.seconds') AS INT)) AS min_time,
       MAX(CAST(json_extract(properties, '$.seconds') AS INT)) AS max_time,
       COUNT(*) AS samples
     FROM events
     WHERE site_id = ? AND type = 'time_on_page'
       AND timestamp >= ? AND timestamp <= ?
       AND CAST(json_extract(properties, '$.seconds') AS INT) > 0
       AND CAST(json_extract(properties, '$.seconds') AS INT) < 3600
     GROUP BY path
     ORDER BY samples DESC
     LIMIT 20`,
        [siteId, start, end],
    );
    return rows.map(r => ({
        path: r.path,
        avgTime: Number(r.avg_time || 0),
        medianTime: Number(r.median_time || 0),
        minTime: Number(r.min_time || 0),
        maxTime: Number(r.max_time || 0),
        samples: Number(r.samples),
    }));
}

/** GET /api/analytics/:siteId/engagement/summary — Engagement KPIs */
export async function getEngagementSummary(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const [scrollRows, timeRows, rageRows, heatmapRows] = await Promise.all([
        duckAll(
            `SELECT ROUND(AVG(CAST(json_extract(properties, '$.depth') AS DOUBLE)), 1) AS avg_scroll
       FROM events WHERE site_id = ? AND type = 'scroll_depth' AND timestamp >= ? AND timestamp <= ?`,
            [siteId, start, end],
        ),
        duckAll(
            `SELECT ROUND(AVG(CAST(json_extract(properties, '$.seconds') AS DOUBLE)), 1) AS avg_time
       FROM events WHERE site_id = ? AND type = 'time_on_page' AND timestamp >= ? AND timestamp <= ?
       AND CAST(json_extract(properties, '$.seconds') AS INT) > 0
       AND CAST(json_extract(properties, '$.seconds') AS INT) < 3600`,
            [siteId, start, end],
        ),
        duckAll(
            `SELECT COUNT(*) AS total_rage_clicks FROM events
       WHERE site_id = ? AND type = 'rage_click' AND timestamp >= ? AND timestamp <= ?`,
            [siteId, start, end],
        ),
        duckAll(
            `SELECT COUNT(*) AS total_clicks FROM events
       WHERE site_id = ? AND type = 'heatmap_click' AND timestamp >= ? AND timestamp <= ?`,
            [siteId, start, end],
        ),
    ]);

    return {
        avgScrollDepth: Number(scrollRows[0]?.avg_scroll || 0),
        avgTimeOnPage: Number(timeRows[0]?.avg_time || 0),
        totalRageClicks: Number(rageRows[0]?.total_rage_clicks || 0),
        totalClicks: Number(heatmapRows[0]?.total_clicks || 0),
    };
}

// ═══════════════════════════════════════════════════════════════════
// Conversion, Audience & Revenue queries
// ═══════════════════════════════════════════════════════════════════

/** GET /api/analytics/:siteId/goals/conversions — Goal conversion data */
export async function getGoalConversions(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    // Get goal definitions
    const goals = await duckAll(
        `SELECT id, name, type, config FROM goals WHERE site_id = ?`,
        [siteId],
    );

    if (!goals.length) return [];

    const totalVisitorsRows = await duckAll(
        `SELECT COUNT(DISTINCT user_id) AS total
     FROM events WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?`,
        [siteId, start, end],
    );
    const totalVisitors = Number(totalVisitorsRows[0]?.total || 0);

    const results = [];
    for (const goal of goals) {
        let config;
        try { config = typeof goal.config === 'string' ? JSON.parse(goal.config) : goal.config; }
        catch { config = {}; }

        let conversionRows;
        if (goal.type === 'page_visit') {
            conversionRows = await duckAll(
                `SELECT
           COUNT(DISTINCT user_id) AS conversions,
           COUNT(*) AS total_events
         FROM events
         WHERE site_id = ? AND type = 'pageview' AND path = ?
           AND timestamp >= ? AND timestamp <= ?`,
                [siteId, config.path || '/', start, end],
            );
        } else if (goal.type === 'event') {
            conversionRows = await duckAll(
                `SELECT
           COUNT(DISTINCT user_id) AS conversions,
           COUNT(*) AS total_events
         FROM events
         WHERE site_id = ? AND type = ?
           AND timestamp >= ? AND timestamp <= ?`,
                [siteId, config.eventType || 'custom', start, end],
            );
        } else if (goal.type === 'click') {
            conversionRows = await duckAll(
                `SELECT
           COUNT(DISTINCT user_id) AS conversions,
           COUNT(*) AS total_events
         FROM events
         WHERE site_id = ? AND type IN ('click', 'button_click', 'heatmap_click')
           AND json_extract_string(properties, '$.selector') = ?
           AND timestamp >= ? AND timestamp <= ?`,
                [siteId, config.selector || '', start, end],
            );
        } else {
            conversionRows = [{ conversions: 0, total_events: 0 }];
        }

        const conversions = Number(conversionRows[0]?.conversions || 0);
        results.push({
            goalId: goal.id,
            goalName: goal.name,
            type: goal.type,
            conversions,
            totalEvents: Number(conversionRows[0]?.total_events || 0),
            conversionRate: totalVisitors > 0 ? Math.round((conversions / totalVisitors) * 1000) / 10 : 0,
        });
    }

    return results;
}

/** GET /api/analytics/:siteId/goals/conversions-over-time — Goal conversions trend */
export async function getGoalConversionsOverTime(siteId, goalId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const goals = await duckAll(
        `SELECT type, config FROM goals WHERE id = ? AND site_id = ?`,
        [goalId, siteId],
    );
    if (!goals.length) return [];

    const goal = goals[0];
    let config;
    try { config = typeof goal.config === 'string' ? JSON.parse(goal.config) : goal.config; }
    catch { config = {}; }

    let rows;
    if (goal.type === 'page_visit') {
        rows = await duckAll(
            `SELECT CAST(timestamp AS DATE) AS date, COUNT(DISTINCT user_id) AS conversions
       FROM events WHERE site_id = ? AND type = 'pageview' AND path = ?
         AND timestamp >= ? AND timestamp <= ? GROUP BY 1 ORDER BY 1`,
            [siteId, config.path || '/', start, end],
        );
    } else if (goal.type === 'event') {
        rows = await duckAll(
            `SELECT CAST(timestamp AS DATE) AS date, COUNT(DISTINCT user_id) AS conversions
       FROM events WHERE site_id = ? AND type = ?
         AND timestamp >= ? AND timestamp <= ? GROUP BY 1 ORDER BY 1`,
            [siteId, config.eventType || 'custom', start, end],
        );
    } else {
        rows = await duckAll(
            `SELECT CAST(timestamp AS DATE) AS date, COUNT(DISTINCT user_id) AS conversions
       FROM events WHERE site_id = ? AND type IN ('click', 'button_click', 'heatmap_click')
         AND json_extract_string(properties, '$.selector') = ?
         AND timestamp >= ? AND timestamp <= ? GROUP BY 1 ORDER BY 1`,
            [siteId, config.selector || '', start, end],
        );
    }

    return rows.map(r => ({ date: toDateStr(r.date), conversions: Number(r.conversions) }));
}

/** GET /api/analytics/:siteId/ab-tests/results — A/B test results */
export async function getABTestResults(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const tests = await duckAll(
        `SELECT id, name, variants, goal_id, status FROM ab_tests WHERE site_id = ? AND status != 'deleted'`,
        [siteId],
    );

    const results = [];
    for (const test of tests) {
        let variants;
        try { variants = typeof test.variants === 'string' ? JSON.parse(test.variants) : test.variants; }
        catch { variants = []; }

        const variantResults = [];
        for (const variant of variants) {
            const variantPath = variant.path || variant.url || variant.name;
            const rows = await duckAll(
                `SELECT
           COUNT(DISTINCT user_id) AS visitors,
           COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS pageviews
         FROM events
         WHERE site_id = ? AND path = ?
           AND timestamp >= ? AND timestamp <= ?`,
                [siteId, variantPath, start, end],
            );

            let goalConversions = 0;
            if (test.goal_id) {
                const goalRows = await duckAll(
                    `SELECT type, config FROM goals WHERE id = ?`,
                    [test.goal_id],
                );
                if (goalRows.length) {
                    let config;
                    try { config = typeof goalRows[0].config === 'string' ? JSON.parse(goalRows[0].config) : goalRows[0].config; }
                    catch { config = {}; }

                    if (goalRows[0].type === 'event') {
                        const convRows = await duckAll(
                            `SELECT COUNT(DISTINCT e.user_id) AS conversions
                 FROM events e
                 WHERE e.site_id = ? AND e.type = ?
                   AND e.timestamp >= ? AND e.timestamp <= ?
                   AND e.user_id IN (
                     SELECT DISTINCT user_id FROM events
                     WHERE site_id = ? AND path = ?
                       AND timestamp >= ? AND timestamp <= ?
                   )`,
                            [siteId, config.eventType || 'custom', start, end, siteId, variantPath, start, end],
                        );
                        goalConversions = Number(convRows[0]?.conversions || 0);
                    }
                }
            }

            const visitors = Number(rows[0]?.visitors || 0);
            variantResults.push({
                name: variant.name || variantPath,
                path: variantPath,
                visitors,
                pageviews: Number(rows[0]?.pageviews || 0),
                conversions: goalConversions,
                conversionRate: visitors > 0 ? Math.round((goalConversions / visitors) * 1000) / 10 : 0,
            });
        }

        results.push({
            testId: test.id,
            testName: test.name,
            status: test.status,
            goalId: test.goal_id,
            variants: variantResults,
        });
    }

    return results;
}

/** GET /api/analytics/:siteId/audience/new-vs-returning — New vs returning visitors */
export async function getNewVsReturning(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const rows = await duckAll(
        `SELECT
       CAST(started_at AS DATE) AS date,
       COUNT(CASE WHEN is_returning = false OR is_returning IS NULL THEN 1 END) AS new_visitors,
       COUNT(CASE WHEN is_returning = true THEN 1 END) AS returning_visitors,
       COUNT(*) AS total_sessions
     FROM sessions
     WHERE site_id = ? AND started_at >= ? AND started_at <= ?
     GROUP BY 1 ORDER BY 1`,
        [siteId, start, end],
    );

    const totals = rows.reduce((acc, r) => ({
        newVisitors: acc.newVisitors + Number(r.new_visitors),
        returningVisitors: acc.returningVisitors + Number(r.returning_visitors),
        totalSessions: acc.totalSessions + Number(r.total_sessions),
    }), { newVisitors: 0, returningVisitors: 0, totalSessions: 0 });

    return {
        daily: rows.map(r => ({
            date: toDateStr(r.date),
            newVisitors: Number(r.new_visitors),
            returningVisitors: Number(r.returning_visitors),
            totalSessions: Number(r.total_sessions),
        })),
        summary: {
            newVisitors: totals.newVisitors,
            returningVisitors: totals.returningVisitors,
            totalSessions: totals.totalSessions,
            newPercentage: totals.totalSessions > 0 ? Math.round((totals.newVisitors / totals.totalSessions) * 100) : 0,
            returningPercentage: totals.totalSessions > 0 ? Math.round((totals.returningVisitors / totals.totalSessions) * 100) : 0,
        },
    };
}

/** GET /api/analytics/:siteId/audience/cohorts — User retention cohorts */
export async function getCohortAnalysis(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const rows = await duckAll(
        `WITH first_visit AS (
       SELECT user_id, CAST(MIN(timestamp) AS DATE) AS cohort_date
       FROM events
       WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
       GROUP BY user_id
     ),
     activity AS (
       SELECT
         fv.cohort_date,
         CAST(e.timestamp AS DATE) - fv.cohort_date AS day_offset,
         e.user_id
       FROM events e
       JOIN first_visit fv ON e.user_id = fv.user_id
       WHERE e.site_id = ? AND e.timestamp >= ? AND e.timestamp <= ?
     )
     SELECT
       cohort_date,
       day_offset,
       COUNT(DISTINCT user_id) AS users,
       (SELECT COUNT(DISTINCT user_id) FROM first_visit WHERE cohort_date = a.cohort_date) AS cohort_size
     FROM activity a
     WHERE day_offset IN (0, 1, 3, 7, 14, 30)
     GROUP BY cohort_date, day_offset
     ORDER BY cohort_date, day_offset`,
        [siteId, start, end, siteId, start, end],
    );

    // Group by cohort
    const cohortMap = {};
    for (const r of rows) {
        const date = toDateStr(r.cohort_date);
        if (!cohortMap[date]) {
            cohortMap[date] = { date, cohortSize: Number(r.cohort_size), retention: {} };
        }
        const size = cohortMap[date].cohortSize;
        const users = Number(r.users);
        cohortMap[date].retention[`day${r.day_offset}`] = {
            users,
            rate: size > 0 ? Math.round((users / size) * 1000) / 10 : 0,
        };
    }

    return Object.values(cohortMap).sort((a, b) => a.date.localeCompare(b.date));
}

/** GET /api/analytics/:siteId/audience/segments — Visitor segment breakdown */
export async function getVisitorSegments(siteId, dateRange = '30d', filters = {}) {
    const { start, end } = getDateRange(dateRange);

    let whereClauses = ['site_id = ?', 'timestamp >= ?', 'timestamp <= ?'];
    let params = [siteId, start, end];

    if (filters.device) {
        whereClauses.push('device = ?');
        params.push(filters.device);
    }
    if (filters.country) {
        whereClauses.push('country = ?');
        params.push(filters.country);
    }
    if (filters.browser) {
        whereClauses.push('browser = ?');
        params.push(filters.browser);
    }
    if (filters.source) {
        whereClauses.push('utm_source = ?');
        params.push(filters.source);
    }

    const where = whereClauses.join(' AND ');

    const [visitorRows, deviceRows, countryRows, browserRows, sourceRows] = await Promise.all([
        duckAll(
            `SELECT COUNT(DISTINCT user_id) AS visitors, COUNT(*) AS events,
             COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS pageviews
       FROM events WHERE ${where}`, params),
        duckAll(
            `SELECT device, COUNT(DISTINCT user_id) AS visitors
       FROM events WHERE ${where} GROUP BY device ORDER BY visitors DESC`, params),
        duckAll(
            `SELECT country, COUNT(DISTINCT user_id) AS visitors
       FROM events WHERE ${where} GROUP BY country ORDER BY visitors DESC LIMIT 10`, params),
        duckAll(
            `SELECT browser, COUNT(DISTINCT user_id) AS visitors
       FROM events WHERE ${where} GROUP BY browser ORDER BY visitors DESC`, params),
        duckAll(
            `SELECT CASE WHEN utm_source = '' OR utm_source IS NULL THEN 'Direct' ELSE utm_source END AS source,
             COUNT(DISTINCT user_id) AS visitors
       FROM events WHERE ${where} GROUP BY source ORDER BY visitors DESC LIMIT 10`, params),
    ]);

    return {
        summary: {
            visitors: Number(visitorRows[0]?.visitors || 0),
            events: Number(visitorRows[0]?.events || 0),
            pageviews: Number(visitorRows[0]?.pageviews || 0),
        },
        devices: deviceRows.map(r => ({ device: r.device || 'Desktop', visitors: Number(r.visitors) })),
        countries: countryRows.map(r => ({ country: r.country || 'Unknown', visitors: Number(r.visitors) })),
        browsers: browserRows.map(r => ({ browser: r.browser || 'Unknown', visitors: Number(r.visitors) })),
        sources: sourceRows.map(r => ({ source: r.source, visitors: Number(r.visitors) })),
    };
}

/** GET /api/analytics/:siteId/revenue — Revenue attribution */
export async function getRevenueAttribution(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const [revenueRows, dailyRows, sourceRows] = await Promise.all([
        duckAll(
            `SELECT
         COUNT(*) AS total_purchases,
         COUNT(DISTINCT user_id) AS unique_buyers,
         SUM(CAST(json_extract(properties, '$.value') AS DOUBLE)) AS total_revenue,
         AVG(CAST(json_extract(properties, '$.value') AS DOUBLE)) AS avg_order_value
       FROM events
       WHERE site_id = ? AND type = 'purchase'
         AND timestamp >= ? AND timestamp <= ?`,
            [siteId, start, end],
        ),
        duckAll(
            `SELECT
         CAST(timestamp AS DATE) AS date,
         COUNT(*) AS purchases,
         SUM(CAST(json_extract(properties, '$.value') AS DOUBLE)) AS revenue
       FROM events
       WHERE site_id = ? AND type = 'purchase'
         AND timestamp >= ? AND timestamp <= ?
       GROUP BY 1 ORDER BY 1`,
            [siteId, start, end],
        ),
        duckAll(
            `SELECT
         CASE WHEN utm_source = '' OR utm_source IS NULL THEN 'Direct' ELSE utm_source END AS source,
         COUNT(*) AS purchases,
         SUM(CAST(json_extract(properties, '$.value') AS DOUBLE)) AS revenue,
         AVG(CAST(json_extract(properties, '$.value') AS DOUBLE)) AS avg_value
       FROM events
       WHERE site_id = ? AND type = 'purchase'
         AND timestamp >= ? AND timestamp <= ?
       GROUP BY source ORDER BY revenue DESC`,
            [siteId, start, end],
        ),
    ]);

    return {
        summary: {
            totalPurchases: Number(revenueRows[0]?.total_purchases || 0),
            uniqueBuyers: Number(revenueRows[0]?.unique_buyers || 0),
            totalRevenue: Math.round(Number(revenueRows[0]?.total_revenue || 0) * 100) / 100,
            avgOrderValue: Math.round(Number(revenueRows[0]?.avg_order_value || 0) * 100) / 100,
        },
        daily: dailyRows.map(r => ({
            date: toDateStr(r.date),
            purchases: Number(r.purchases),
            revenue: Math.round(Number(r.revenue || 0) * 100) / 100,
        })),
        bySource: sourceRows.map(r => ({
            source: r.source,
            purchases: Number(r.purchases),
            revenue: Math.round(Number(r.revenue || 0) * 100) / 100,
            avgValue: Math.round(Number(r.avg_value || 0) * 100) / 100,
        })),
    };
}

// ═══════════════════════════════════════════════════════════════════
// Content, Acquisition, Performance & Privacy queries
// ═══════════════════════════════════════════════════════════════════

/** GET /api/analytics/:siteId/content/exit-pages — Pages users leave from most */
export async function getExitPages(siteId, dateRange = '30d', limit = 20) {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       exit_page AS page,
       COUNT(*) AS exits,
       COUNT(DISTINCT user_id) AS unique_users,
       ROUND(AVG(duration), 0) AS avg_session_duration
     FROM sessions
     WHERE site_id = ? AND started_at >= ? AND started_at <= ?
       AND exit_page IS NOT NULL AND exit_page != ''
     GROUP BY exit_page
     ORDER BY exits DESC
     LIMIT ?`,
        [siteId, start, end, limit],
    );
    const totalExits = rows.reduce((s, r) => s + Number(r.exits), 0) || 1;
    return rows.map(r => ({
        page: r.page,
        exits: Number(r.exits),
        uniqueUsers: Number(r.unique_users),
        percentage: Math.round((Number(r.exits) / totalExits) * 1000) / 10,
        avgSessionDuration: Number(r.avg_session_duration || 0),
    }));
}

/** GET /api/analytics/:siteId/content/entry-pages — Pages users land on first */
export async function getEntryPages(siteId, dateRange = '30d', limit = 20) {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       entry_page AS page,
       COUNT(*) AS entries,
       COUNT(DISTINCT user_id) AS unique_users,
       SUM(CASE WHEN is_bounce THEN 1 ELSE 0 END) AS bounces,
       ROUND(AVG(duration), 0) AS avg_session_duration
     FROM sessions
     WHERE site_id = ? AND started_at >= ? AND started_at <= ?
       AND entry_page IS NOT NULL AND entry_page != ''
     GROUP BY entry_page
     ORDER BY entries DESC
     LIMIT ?`,
        [siteId, start, end, limit],
    );
    const totalEntries = rows.reduce((s, r) => s + Number(r.entries), 0) || 1;
    return rows.map(r => {
        const entries = Number(r.entries);
        return {
            page: r.page,
            entries,
            uniqueUsers: Number(r.unique_users),
            percentage: Math.round((entries / totalEntries) * 1000) / 10,
            bounceRate: entries > 0 ? Math.round((Number(r.bounces) / entries) * 1000) / 10 : 0,
            avgSessionDuration: Number(r.avg_session_duration || 0),
        };
    });
}

/** GET /api/analytics/:siteId/content/site-search — Site search queries */
export async function getSiteSearchQueries(siteId, dateRange = '30d', limit = 30) {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       json_extract_string(properties, '$.query') AS search_query,
       COUNT(*) AS searches,
       COUNT(DISTINCT user_id) AS unique_users,
       path
     FROM events
     WHERE site_id = ? AND type = 'site_search'
       AND timestamp >= ? AND timestamp <= ?
     GROUP BY search_query, path
     ORDER BY searches DESC
     LIMIT ?`,
        [siteId, start, end, limit],
    );
    return rows.map(r => ({
        query: r.search_query || '',
        searches: Number(r.searches),
        uniqueUsers: Number(r.unique_users),
        page: r.path,
    }));
}

/** GET /api/analytics/:siteId/acquisition/campaigns — Full campaign breakdown */
export async function getCampaignDashboard(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       CASE WHEN utm_source = '' OR utm_source IS NULL THEN '(none)' ELSE utm_source END AS source,
       CASE WHEN utm_medium = '' OR utm_medium IS NULL THEN '(none)' ELSE utm_medium END AS medium,
       CASE WHEN utm_campaign = '' OR utm_campaign IS NULL THEN '(none)' ELSE utm_campaign END AS campaign,
       COUNT(DISTINCT user_id) AS visitors,
       COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS pageviews,
       COUNT(CASE WHEN type = 'purchase' THEN 1 END) AS purchases,
       SUM(CASE WHEN type = 'purchase' THEN CAST(json_extract(properties, '$.value') AS DOUBLE) ELSE 0 END) AS revenue
     FROM events
     WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
       AND (utm_source != '' OR utm_medium != '' OR utm_campaign != '')
     GROUP BY source, medium, campaign
     ORDER BY visitors DESC
     LIMIT 30`,
        [siteId, start, end],
    );
    const totalVisitors = rows.reduce((s, r) => s + Number(r.visitors), 0) || 1;
    return rows.map(r => ({
        source: r.source,
        medium: r.medium,
        campaign: r.campaign,
        visitors: Number(r.visitors),
        pageviews: Number(r.pageviews),
        purchases: Number(r.purchases),
        revenue: Math.round(Number(r.revenue || 0) * 100) / 100,
        percentage: Math.round((Number(r.visitors) / totalVisitors) * 100),
    }));
}

/** GET /api/analytics/:siteId/acquisition/social — Social media traffic breakdown */
export async function getSocialMediaTraffic(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       CASE
         WHEN referrer ILIKE '%facebook%' OR referrer ILIKE '%fb.com%' THEN 'Facebook'
         WHEN referrer ILIKE '%twitter%' OR referrer ILIKE '%t.co%' OR referrer ILIKE '%x.com%' THEN 'Twitter/X'
         WHEN referrer ILIKE '%linkedin%' THEN 'LinkedIn'
         WHEN referrer ILIKE '%instagram%' THEN 'Instagram'
         WHEN referrer ILIKE '%youtube%' THEN 'YouTube'
         WHEN referrer ILIKE '%reddit%' THEN 'Reddit'
         WHEN referrer ILIKE '%pinterest%' THEN 'Pinterest'
         WHEN referrer ILIKE '%tiktok%' THEN 'TikTok'
         WHEN referrer ILIKE '%github%' THEN 'GitHub'
         WHEN referrer ILIKE '%discord%' THEN 'Discord'
         WHEN referrer ILIKE '%slack%' THEN 'Slack'
         ELSE 'Other Social'
       END AS platform,
       COUNT(DISTINCT user_id) AS visitors,
       COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS pageviews,
       COUNT(DISTINCT session_id) AS sessions
     FROM events
     WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
       AND (
         referrer ILIKE '%facebook%' OR referrer ILIKE '%fb.com%'
         OR referrer ILIKE '%twitter%' OR referrer ILIKE '%t.co%' OR referrer ILIKE '%x.com%'
         OR referrer ILIKE '%linkedin%' OR referrer ILIKE '%instagram%'
         OR referrer ILIKE '%youtube%' OR referrer ILIKE '%reddit%'
         OR referrer ILIKE '%pinterest%' OR referrer ILIKE '%tiktok%'
         OR referrer ILIKE '%github%' OR referrer ILIKE '%discord%' OR referrer ILIKE '%slack%'
       )
     GROUP BY platform
     ORDER BY visitors DESC`,
        [siteId, start, end],
    );
    const total = rows.reduce((s, r) => s + Number(r.visitors), 0) || 1;
    return rows.map(r => ({
        platform: r.platform,
        visitors: Number(r.visitors),
        pageviews: Number(r.pageviews),
        sessions: Number(r.sessions),
        percentage: Math.round((Number(r.visitors) / total) * 100),
    }));
}

/** GET /api/analytics/:siteId/acquisition/keywords — Search keyword tracking */
export async function getSearchKeywords(siteId, dateRange = '30d', limit = 20) {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       CASE WHEN utm_term = '' OR utm_term IS NULL THEN '(not set)' ELSE utm_term END AS keyword,
       CASE WHEN utm_source = '' OR utm_source IS NULL THEN '(direct)' ELSE utm_source END AS source,
       COUNT(DISTINCT user_id) AS visitors,
       COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS pageviews
     FROM events
     WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
       AND utm_term IS NOT NULL AND utm_term != ''
     GROUP BY keyword, source
     ORDER BY visitors DESC
     LIMIT ?`,
        [siteId, start, end, limit],
    );
    return rows.map(r => ({
        keyword: r.keyword,
        source: r.source,
        visitors: Number(r.visitors),
        pageviews: Number(r.pageviews),
    }));
}

/** GET /api/analytics/:siteId/performance/web-vitals — Core Web Vitals per page */
export async function getWebVitals(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       path,
       json_extract_string(properties, '$.metric') AS metric,
       ROUND(AVG(CAST(json_extract(properties, '$.value') AS DOUBLE)), 2) AS avg_value,
       ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY CAST(json_extract(properties, '$.value') AS DOUBLE)), 2) AS p75_value,
       COUNT(*) AS samples
     FROM events
     WHERE site_id = ? AND type = 'web_vital'
       AND timestamp >= ? AND timestamp <= ?
     GROUP BY path, metric
     ORDER BY samples DESC`,
        [siteId, start, end],
    );

    // Group by page
    const pageMap = {};
    for (const r of rows) {
        const page = r.path;
        if (!pageMap[page]) pageMap[page] = { page, metrics: {}, totalSamples: 0 };
        pageMap[page].metrics[r.metric] = {
            avg: Number(r.avg_value || 0),
            p75: Number(r.p75_value || 0),
            samples: Number(r.samples),
        };
        pageMap[page].totalSamples += Number(r.samples);
    }

    return Object.values(pageMap)
        .sort((a, b) => b.totalSamples - a.totalSamples)
        .slice(0, 20);
}

/** GET /api/analytics/:siteId/performance/web-vitals-overview — Overall vitals summary */
export async function getWebVitalsOverview(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       json_extract_string(properties, '$.metric') AS metric,
       ROUND(AVG(CAST(json_extract(properties, '$.value') AS DOUBLE)), 2) AS avg_value,
       ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY CAST(json_extract(properties, '$.value') AS DOUBLE)), 2) AS p75_value,
       COUNT(*) AS samples
     FROM events
     WHERE site_id = ? AND type = 'web_vital'
       AND timestamp >= ? AND timestamp <= ?
     GROUP BY metric`,
        [siteId, start, end],
    );

    const result = {};
    for (const r of rows) {
        result[r.metric] = {
            avg: Number(r.avg_value || 0),
            p75: Number(r.p75_value || 0),
            samples: Number(r.samples),
        };
    }
    return result;
}

/** GET /api/analytics/:siteId/performance/errors — JavaScript error tracking */
export async function getJSErrors(siteId, dateRange = '30d', limit = 30) {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       json_extract_string(properties, '$.message') AS error_message,
       json_extract_string(properties, '$.source') AS source_file,
       path,
       COUNT(*) AS occurrences,
       COUNT(DISTINCT user_id) AS affected_users,
       MIN(timestamp) AS first_seen,
       MAX(timestamp) AS last_seen
     FROM events
     WHERE site_id = ? AND type = 'js_error'
       AND timestamp >= ? AND timestamp <= ?
     GROUP BY error_message, source_file, path
     ORDER BY occurrences DESC
     LIMIT ?`,
        [siteId, start, end, limit],
    );
    return rows.map(r => ({
        message: r.error_message || 'Unknown error',
        sourceFile: r.source_file || '',
        page: r.path,
        occurrences: Number(r.occurrences),
        affectedUsers: Number(r.affected_users),
        firstSeen: r.first_seen,
        lastSeen: r.last_seen,
    }));
}

/** GET /api/analytics/:siteId/performance/errors-over-time — Error trend */
export async function getJSErrorsOverTime(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       CAST(timestamp AS DATE) AS date,
       COUNT(*) AS errors,
       COUNT(DISTINCT user_id) AS affected_users
     FROM events
     WHERE site_id = ? AND type = 'js_error'
       AND timestamp >= ? AND timestamp <= ?
     GROUP BY 1 ORDER BY 1`,
        [siteId, start, end],
    );
    return rows.map(r => ({
        date: toDateStr(r.date),
        errors: Number(r.errors),
        affectedUsers: Number(r.affected_users),
    }));
}

/** GET /api/analytics/:siteId/annotations — List annotations for a date range */
export async function getAnnotations(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const startDate = start.split('T')[0];
    const endDate = end.split('T')[0];
    const rows = await duckAll(
        `SELECT id, date, title, description, category, created_at
     FROM annotations
     WHERE site_id = ? AND date >= ? AND date <= ?
     ORDER BY date DESC`,
        [siteId, startDate, endDate],
    );
    return rows.map(r => ({
        id: r.id,
        date: toDateStr(r.date),
        title: r.title,
        description: r.description || '',
        category: r.category || 'general',
    }));
}

// ─── CLI entry point ─────────────────────────────────────────────

const isCLI = process.argv[1]?.includes('queries');
if (isCLI) {
    const siteId = process.argv[2] || 'site_123';
    console.log(`\n📊 Running analytics queries against DuckDB (site: ${siteId})\n`);

    const demos = [
        ['Traffic Over Time (30d)', () => getTrafficOverTime(siteId)],
        ['Bounce Rate Trend (30d)', () => getBounceRateOverTime(siteId)],
        ['Avg Session Trend (30d)', () => getAvgSessionOverTime(siteId)],
        ['Pageviews Over Time', () => getPageViewsOverTime(siteId)],
        ['Top Pages', () => getTopPages(siteId)],
        ['Traffic Sources', () => getTrafficSources(siteId)],
        ['Device Breakdown', () => getDeviceBreakdown(siteId)],
        ['Countries', () => getCountries(siteId)],
        ['Session Duration', () => getSessionDuration(siteId)],
        ['KPI Summary', () => getKPISummary(siteId)],
        ['Funnel Data', () => getFunnelData(siteId)],
        ['Realtime Visitors', () => getRealTimeVisitors(siteId)],
        ['Realtime Event Stream', () => getRealtimeEventStream(siteId, 10)],
        ['UTM Campaigns', () => getUTMCampaigns(siteId)],
        ['Comparison Traffic', () => getComparisonTraffic(siteId)],
        ['User Flow', () => getUserFlow(siteId)],
        ['Alerts', () => getAlerts(siteId)],
        ['Daily Active Users', () => getDailyActiveUsers(siteId)],
        ['Hourly Traffic', () => getHourlyTraffic(siteId)],
    ];

    for (const [label, fn] of demos) {
        console.log(`─── ${label} ───`);
        try { console.table(await fn()); } catch (e) { console.error(e.message); }
        console.log('');
    }

    await closeDuck();
    process.exit(0);
}
