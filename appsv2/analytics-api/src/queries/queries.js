/**
 * Analytical query functions running against DuckDB.
 *
 * Hot + Cold Architecture:
 *   - DuckDB managed tables (events_hot, sessions_hot) hold the last HOT_DAYS days
 *   - Parquet cold partitions hold older data at data-lake/events/... and data-lake/sessions/...
 *   - This module creates transparent SQL VIEWs `events` and `sessions` that UNION both layers
 *   - All query functions below use `FROM events` / `FROM sessions` and work unchanged
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
 */

import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { duckAll, duckRun, closeDuck } from '../db/duckdb.js';
import { addSignificance } from '../utils/abStats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_LAKE = path.resolve(__dirname, '..', '..', 'data-lake');

/**
 * Build or refresh the transparent union views `events` and `sessions`.
 * Called once on startup and after each sync cycle.
 *
 * If cold Parquet files exist, the views UNION hot tables + read_parquet().
 * If no cold files exist yet, the views are simple aliases to the hot tables.
 */
export async function refreshAnalyticsViews() {
    const eventsParquet = path.join(DATA_LAKE, 'events');
    const sessionsParquet = path.join(DATA_LAKE, 'sessions');

    const eventsGlob = path.join(eventsParquet, 'site_id=*', 'event_date=*', '*.parquet');
    const sessionsGlob = path.join(sessionsParquet, 'site_id=*', 'session_date=*', '*.parquet');

    const hasColdEvents = existsSync(eventsParquet) && _hasParquetFiles(eventsParquet);
    const hasColdSessions = existsSync(sessionsParquet) && _hasParquetFiles(sessionsParquet);

    // events view
    if (hasColdEvents) {
        await duckRun(
            `CREATE OR REPLACE VIEW events AS
             SELECT id, event_uuid, site_id, user_id, session_id, type, url, path,
                    referrer, device, browser, os, country, city, timestamp,
                    properties, utm_source, utm_medium, utm_campaign, utm_term, utm_content
             FROM events_hot
             UNION ALL
             SELECT id, event_uuid, site_id, user_id, session_id, type, url, path,
                    referrer, device, browser, os, country, city, timestamp,
                    properties, utm_source, utm_medium, utm_campaign, utm_term, utm_content
             FROM read_parquet('${eventsGlob.replace(/\\/g, '/')}', union_by_name=true)`,
        );
    } else {
        await duckRun(
            `CREATE OR REPLACE VIEW events AS
             SELECT id, event_uuid, site_id, user_id, session_id, type, url, path,
                    referrer, device, browser, os, country, city, timestamp,
                    properties, utm_source, utm_medium, utm_campaign, utm_term, utm_content
             FROM events_hot`,
        );
    }

    // sessions view
    if (hasColdSessions) {
        await duckRun(
            `CREATE OR REPLACE VIEW sessions AS
             SELECT id, site_id, user_id, started_at, ended_at, duration, pageviews,
                    entry_page, exit_page, referrer, device, browser, os, country,
                    is_bounce, is_returning, utm_source, utm_medium, utm_campaign, updated_at
             FROM sessions_hot
             UNION ALL
             SELECT id, site_id, user_id, started_at, ended_at, duration, pageviews,
                    entry_page, exit_page, referrer, device, browser, os, country,
                    is_bounce, is_returning, utm_source, utm_medium, utm_campaign, updated_at
             FROM read_parquet('${sessionsGlob.replace(/\\/g, '/')}', union_by_name=true)`,
        );
    } else {
        await duckRun(
            `CREATE OR REPLACE VIEW sessions AS
             SELECT id, site_id, user_id, started_at, ended_at, duration, pageviews,
                    entry_page, exit_page, referrer, device, browser, os, country,
                    is_bounce, is_returning, utm_source, utm_medium, utm_campaign, updated_at
             FROM sessions_hot`,
        );
    }
}

function _hasParquetFiles(dir) {
    try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const subEntries = readdirSync(path.join(dir, entry.name), { withFileTypes: true });
                for (const sub of subEntries) {
                    if (sub.isDirectory()) {
                        const files = readdirSync(path.join(dir, entry.name, sub.name));
                        if (files.some((f) => f.endsWith('.parquet'))) return true;
                    }
                }
            }
        }
    } catch { /* ignore */ }
    return false;
}

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

    // For ranges > today use daily_stats (pre-aggregated, microsecond reads).
    // Fall back to raw events for today/yesterday where daily_stats may be stale.
    const todayStr = new Date().toISOString().split('T')[0];
    const startStr = start.split('T')[0];
    const endStr   = end.split('T')[0];
    const isToday  = startStr === todayStr || endStr === todayStr;

    if (!isToday) {
        const rollupRows = await duckAll(
            `SELECT date, visitors, sessions, pageviews
             FROM daily_stats
             WHERE site_id = ? AND date >= ? AND date <= ?
             ORDER BY date ASC`,
            [siteId, startStr, endStr],
        );
        if (rollupRows.length > 0) {
            return rollupRows.map(r => ({
                date: toDateStr(r.date),
                visitors:  Number(r.visitors  || 0),
                sessions:  Number(r.sessions  || 0),
                pageviews: Number(r.pageviews || 0),
            }));
        }
    }

    // Raw events fallback (today or no rollup data yet)
    const rows = await duckAll(
        `SELECT
           CAST(timestamp AS DATE)                          AS date,
           COUNT(DISTINCT user_id)                          AS visitors,
           COUNT(DISTINCT session_id)                       AS sessions,
           COUNT(CASE WHEN type = 'pageview' THEN 1 END)   AS pageviews
         FROM events
         WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
         GROUP BY 1 ORDER BY 1`,
        [siteId, start, end],
    );
    return rows.map(r => ({
        date:      toDateStr(r.date),
        visitors:  Number(r.visitors),
        sessions:  Number(r.sessions),
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
    const todayStr = new Date().toISOString().split('T')[0];
    const startStr = start.split('T')[0];
    const endStr   = end.split('T')[0];
    const isToday  = startStr === todayStr || endStr === todayStr;

    if (!isToday) {
        const rollupRows = await duckAll(
            `SELECT date, pageviews FROM daily_stats
             WHERE site_id = ? AND date >= ? AND date <= ?
             ORDER BY date ASC`,
            [siteId, startStr, endStr],
        );
        if (rollupRows.length > 0) {
            return rollupRows.map(r => ({
                date: toDateStr(r.date),
                pageviews: Number(r.pageviews || 0),
            }));
        }
    }

    const rows = await duckAll(
        `SELECT CAST(timestamp AS DATE) AS date, COUNT(*) AS pageviews
         FROM events
         WHERE site_id = ? AND type = 'pageview'
           AND timestamp >= ? AND timestamp <= ?
         GROUP BY 1 ORDER BY 1`,
        [siteId, start, end],
    );
    return rows.map(r => ({ date: toDateStr(r.date), pageviews: Number(r.pageviews) }));
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

    // ISO 3166-1 alpha-2 → full country name (handles mixed old/new stored data)
    const ISO_TO_COUNTRY = {
        AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AD: 'Andorra', AO: 'Angola',
        AG: 'Antigua and Barbuda', AR: 'Argentina', AM: 'Armenia', AU: 'Australia',
        AT: 'Austria', AZ: 'Azerbaijan', BS: 'Bahamas', BH: 'Bahrain', BD: 'Bangladesh',
        BB: 'Barbados', BY: 'Belarus', BE: 'Belgium', BZ: 'Belize', BJ: 'Benin',
        BT: 'Bhutan', BO: 'Bolivia', BA: 'Bosnia and Herzegovina', BW: 'Botswana',
        BR: 'Brazil', BN: 'Brunei', BG: 'Bulgaria', BF: 'Burkina Faso', BI: 'Burundi',
        CV: 'Cabo Verde', KH: 'Cambodia', CM: 'Cameroon', CA: 'Canada',
        CF: 'Central African Republic', TD: 'Chad', CL: 'Chile', CN: 'China',
        CO: 'Colombia', KM: 'Comoros', CG: 'Congo', CR: 'Costa Rica', HR: 'Croatia',
        CU: 'Cuba', CY: 'Cyprus', CZ: 'Czech Republic', DK: 'Denmark', DJ: 'Djibouti',
        DM: 'Dominica', DO: 'Dominican Republic', EC: 'Ecuador', EG: 'Egypt',
        SV: 'El Salvador', GQ: 'Equatorial Guinea', ER: 'Eritrea', EE: 'Estonia',
        SZ: 'Eswatini', ET: 'Ethiopia', FJ: 'Fiji', FI: 'Finland', FR: 'France',
        GA: 'Gabon', GM: 'Gambia', GE: 'Georgia', DE: 'Germany', GH: 'Ghana',
        GR: 'Greece', GD: 'Grenada', GT: 'Guatemala', GN: 'Guinea',
        GW: 'Guinea-Bissau', GY: 'Guyana', HT: 'Haiti', HN: 'Honduras', HU: 'Hungary',
        IS: 'Iceland', IN: 'India', ID: 'Indonesia', IR: 'Iran', IQ: 'Iraq',
        IE: 'Ireland', IL: 'Israel', IT: 'Italy', JM: 'Jamaica', JP: 'Japan',
        JO: 'Jordan', KZ: 'Kazakhstan', KE: 'Kenya', KI: 'Kiribati', KW: 'Kuwait',
        KG: 'Kyrgyzstan', LA: 'Laos', LV: 'Latvia', LB: 'Lebanon', LS: 'Lesotho',
        LR: 'Liberia', LY: 'Libya', LI: 'Liechtenstein', LT: 'Lithuania',
        LU: 'Luxembourg', MG: 'Madagascar', MW: 'Malawi', MY: 'Malaysia',
        MV: 'Maldives', ML: 'Mali', MT: 'Malta', MH: 'Marshall Islands',
        MR: 'Mauritania', MU: 'Mauritius', MX: 'Mexico', FM: 'Micronesia',
        MD: 'Moldova', MC: 'Monaco', MN: 'Mongolia', ME: 'Montenegro', MA: 'Morocco',
        MZ: 'Mozambique', MM: 'Myanmar', NA: 'Namibia', NR: 'Nauru', NP: 'Nepal',
        NL: 'Netherlands', NZ: 'New Zealand', NI: 'Nicaragua', NE: 'Niger',
        NG: 'Nigeria', NO: 'Norway', OM: 'Oman', PK: 'Pakistan', PW: 'Palau',
        PA: 'Panama', PG: 'Papua New Guinea', PY: 'Paraguay', PE: 'Peru',
        PH: 'Philippines', PL: 'Poland', PT: 'Portugal', QA: 'Qatar', RO: 'Romania',
        RU: 'Russia', RW: 'Rwanda', KN: 'Saint Kitts and Nevis', LC: 'Saint Lucia',
        VC: 'Saint Vincent and the Grenadines', WS: 'Samoa', SM: 'San Marino',
        ST: 'Sao Tome and Principe', SA: 'Saudi Arabia', SN: 'Senegal', RS: 'Serbia',
        SC: 'Seychelles', SL: 'Sierra Leone', SG: 'Singapore', SK: 'Slovakia',
        SI: 'Slovenia', SB: 'Solomon Islands', SO: 'Somalia', ZA: 'South Africa',
        SS: 'South Sudan', ES: 'Spain', LK: 'Sri Lanka', SD: 'Sudan', SR: 'Suriname',
        SE: 'Sweden', CH: 'Switzerland', SY: 'Syria', TW: 'Taiwan', TJ: 'Tajikistan',
        TZ: 'Tanzania', TH: 'Thailand', TL: 'Timor-Leste', TG: 'Togo', TO: 'Tonga',
        TT: 'Trinidad and Tobago', TN: 'Tunisia', TR: 'Turkey', TM: 'Turkmenistan',
        TV: 'Tuvalu', UG: 'Uganda', UA: 'Ukraine', AE: 'United Arab Emirates',
        GB: 'United Kingdom', US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan',
        VU: 'Vanuatu', VE: 'Venezuela', VN: 'Vietnam', YE: 'Yemen', ZM: 'Zambia',
        ZW: 'Zimbabwe',
    };

    // Full name → ISO code (for the code field in the response)
    const COUNTRY_TO_ISO = Object.fromEntries(
        Object.entries(ISO_TO_COUNTRY).map(([code, name]) => [name, code]),
    );

    const rows = await duckAll(
        `SELECT
       CASE WHEN country = '' OR country IS NULL THEN 'Unknown' ELSE country END AS country,
       COUNT(DISTINCT user_id) AS visitors
     FROM events
     WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
     GROUP BY country
     ORDER BY visitors DESC`,
        [siteId, start, end],
    );

    // Normalize each row: if stored value is an ISO code, convert to full name
    const normalized = {};
    for (const r of rows) {
        const raw = r.country;
        const name = (raw !== 'Unknown' && ISO_TO_COUNTRY[raw]) ? ISO_TO_COUNTRY[raw] : raw;
        if (!normalized[name]) normalized[name] = 0;
        normalized[name] += Number(r.visitors);
    }

    const total = Object.values(normalized).reduce((s, v) => s + v, 0);

    return Object.entries(normalized)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, visitors]) => ({
            country: name,
            code: COUNTRY_TO_ISO[name] || 'OTHER',
            visitors,
            percentage: total > 0 ? Math.round((visitors / total) * 100) : 0,
        }));
}

/** GET /api/analytics/:siteId/cities - Traffic by city */
export async function getTrafficByCity(siteId, dateRange = '30d', limit = 10) {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       CASE WHEN city = '' OR city IS NULL THEN 'Unknown' ELSE city END AS city,
       CASE WHEN country = '' OR country IS NULL THEN 'Unknown' ELSE country END AS country,
       COUNT(DISTINCT user_id) AS visitors,
       COUNT(DISTINCT session_id) AS sessions,
       COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS pageviews,
       AVG(CASE WHEN type = 'pageview' THEN 1 ELSE 0 END) * 100 AS engagement_rate
     FROM events
     WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
     GROUP BY city, country
     ORDER BY visitors DESC
     LIMIT ?`,
        [siteId, start, end, limit],
    );
    const total = rows.reduce((s, r) => s + Number(r.visitors), 0);
    return rows.map(r => ({
        city: r.city,
        country: r.country,
        visitors: Number(r.visitors),
        sessions: Number(r.sessions),
        pageviews: Number(r.pageviews),
        engagementRate: Math.round(Number(r.engagement_rate || 0) * 10) / 10,
        percentage: total > 0 ? Math.round((Number(r.visitors) / total) * 100) : 0,
    }));
}

/** GET /api/analytics/:siteId/geo-map - Geo coordinates for map visualization */
export async function getGeoMap(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       city,
       country,
       COUNT(DISTINCT user_id) AS visitors,
       COUNT(DISTINCT session_id) AS sessions
     FROM events
     WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
       AND city IS NOT NULL AND city != ''
     GROUP BY city, country
     ORDER BY visitors DESC`,
        [siteId, start, end],
    );
    return rows.map(r => ({
        city: r.city,
        country: r.country,
        visitors: Number(r.visitors),
        sessions: Number(r.sessions),
    }));
}

/** Session-level geo breakdown */
export async function getSessionsByCity(siteId, dateRange = '30d', limit = 10) {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       CASE WHEN city = '' OR city IS NULL THEN 'Unknown' ELSE city END AS city,
       CASE WHEN country = '' OR country IS NULL THEN 'Unknown' ELSE country END AS country,
       COUNT(*) AS sessions,
       AVG(duration) AS avg_duration,
       SUM(CASE WHEN is_bounce THEN 1 ELSE 0 END) AS bounced,
       SUM(pageviews) AS total_pageviews
     FROM sessions
     WHERE site_id = ? AND started_at >= ? AND started_at <= ?
     GROUP BY city, country
     ORDER BY sessions DESC
     LIMIT ?`,
        [siteId, start, end, limit],
    );
    return rows.map(r => {
        const sessions = Number(r.sessions);
        const bounced = Number(r.bounced);
        return {
            city: r.city,
            country: r.country,
            sessions,
            avgDuration: Math.round(Number(r.avg_duration || 0)),
            bounceRate: sessions > 0 ? Math.round((bounced / sessions) * 1000) / 10 : 0,
            avgPageviews: sessions > 0 ? Math.round((Number(r.total_pageviews) / sessions) * 10) / 10 : 0,
        };
    });
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
    const currentEnd   = new Date(end);
    const periodMs     = currentEnd.getTime() - currentStart.getTime();
    const prevEnd      = new Date(currentStart.getTime());
    const prevStart    = new Date(currentStart.getTime() - periodMs);

    const todayStr  = new Date().toISOString().split('T')[0];
    const startStr  = start.split('T')[0];
    const endStr    = end.split('T')[0];
    const prevStartStr = prevStart.toISOString().split('T')[0];
    const prevEndStr   = prevEnd.toISOString().split('T')[0];
    const isToday = startStr === todayStr || endStr === todayStr;

    // Use daily_stats aggregates when the range doesn't include today
    // (rollup for today runs after midnight so it would be stale for live data).
    if (!isToday) {
        const [curr, prev] = await Promise.all([
            duckAll(
                `SELECT SUM(visitors) AS total_visitors, SUM(pageviews) AS total_pageviews,
                        SUM(sessions) AS total_sessions
                 FROM daily_stats WHERE site_id = ? AND date >= ? AND date <= ?`,
                [siteId, startStr, endStr],
            ),
            duckAll(
                `SELECT SUM(visitors) AS total_visitors, SUM(pageviews) AS total_pageviews,
                        SUM(sessions) AS total_sessions
                 FROM daily_stats WHERE site_id = ? AND date >= ? AND date < ?`,
                [siteId, prevStartStr, prevEndStr],
            ),
        ]);

        if (Number(curr[0]?.total_visitors || 0) > 0) {
            const totalVisitors  = Number(curr[0]?.total_visitors  || 0);
            const totalPageviews = Number(curr[0]?.total_pageviews || 0);
            const totalSessions  = Number(curr[0]?.total_sessions  || 0);
            const prevVisitors   = Number(prev[0]?.total_visitors  || 0);
            const prevPageviews  = Number(prev[0]?.total_pageviews || 0);

            function calcTrend(c, p) {
                if (p === 0) return c > 0 ? 100 : 0;
                return Math.round(((c - p) / p) * 1000) / 10;
            }

            return {
                totalVisitors, totalPageviews, totalSessions,
                bounceRate: 0, avgSessionDuration: '0m 0s',
                pagesPerSession: totalSessions > 0 ? (totalPageviews / totalSessions).toFixed(2) : '0.00',
                visitorsTrend:   calcTrend(totalVisitors,  prevVisitors),
                pageviewsTrend:  calcTrend(totalPageviews, prevPageviews),
                bounceRateTrend: 0, sessionTrend: 0,
            };
        }
    }

    // Raw events fallback — today/yesterday or no rollup yet
    const [eventRows, sessionRows, prevEventRows, prevSessionRows] = await Promise.all([
        duckAll(
            `SELECT COUNT(DISTINCT user_id) AS total_visitors,
                    COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS total_pageviews
             FROM events WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?`,
            [siteId, start, end],
        ),
        duckAll(
            `SELECT COUNT(*) AS total_sessions, AVG(duration) AS avg_duration,
                    SUM(CASE WHEN is_bounce THEN 1 ELSE 0 END) AS bounces
             FROM sessions WHERE site_id = ? AND started_at >= ? AND started_at <= ?`,
            [siteId, start, end],
        ),
        duckAll(
            `SELECT COUNT(DISTINCT user_id) AS total_visitors,
                    COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS total_pageviews
             FROM events WHERE site_id = ? AND timestamp >= ? AND timestamp < ?`,
            [siteId, prevStart.toISOString(), prevEnd.toISOString()],
        ),
        duckAll(
            `SELECT COUNT(*) AS total_sessions, AVG(duration) AS avg_duration,
                    SUM(CASE WHEN is_bounce THEN 1 ELSE 0 END) AS bounces
             FROM sessions WHERE site_id = ? AND started_at >= ? AND started_at < ?`,
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
/**
 * Return distinct event types + top page paths found in the data.
 * Used by the frontend funnel builder to populate step selectors.
 */
export async function getAvailableFunnelSteps(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const [eventTypeRows, topPathRows] = await Promise.all([
        duckAll(
            `SELECT type, COUNT(*) AS cnt
             FROM events
             WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
               AND type IS NOT NULL AND type <> ''
             GROUP BY type
             ORDER BY cnt DESC`,
            [siteId, start, end],
        ),
        duckAll(
            `SELECT path, COUNT(*) AS cnt
             FROM events
             WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
               AND type = 'pageview' AND path IS NOT NULL AND path <> ''
             GROUP BY path
             ORDER BY cnt DESC
             LIMIT 30`,
            [siteId, start, end],
        ),
    ]);

    return {
        eventTypes: eventTypeRows.map((r) => ({ type: r.type, count: Number(r.cnt) })),
        topPaths: topPathRows.map((r) => ({ path: r.path, count: Number(r.cnt) })),
    };
}

/**
 * Compute funnel conversion data.
 *
 * @param {string} siteId
 * @param {string} dateRange
 * @param {Array<{label:string, type:string, path?:string}>|null} customSteps
 *   When null/empty the query falls back to the default e-commerce funnel.
 *   Steps are supplied by the caller (never built from raw user input in SQL).
 */
export async function getFunnelData(siteId, dateRange = '30d', customSteps = null) {
    const { start, end } = getDateRange(dateRange);

    const DEFAULT_STEPS = [
        { label: 'Visit Homepage', type: 'pageview', path: '/' },
        { label: 'View Product', type: 'pageview', path: '/products' },
        { label: 'Add to Cart', type: 'add_to_cart' },
        { label: 'Checkout', type: 'checkout' },
        { label: 'Purchase', type: 'purchase' },
    ];

    const funnelSteps = Array.isArray(customSteps) && customSteps.length > 0
        ? customSteps
        : DEFAULT_STEPS;

    const totalRows = await duckAll(
        `SELECT COUNT(DISTINCT user_id) AS total
         FROM events
         WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?`,
        [siteId, start, end],
    );
    const totalVisitors = Number(totalRows[0]?.total || 0);

    // Build parameterised SELECT — each CASE binds (type [, path]) before the WHERE params
    const selectParts = [];
    const params = [];

    funnelSteps.forEach((step, i) => {
        if (step.path) {
            selectParts.push(
                `COUNT(DISTINCT CASE WHEN type = ? AND path = ? THEN user_id END) AS step${i}`,
            );
            params.push(step.type, step.path);
        } else {
            selectParts.push(
                `COUNT(DISTINCT CASE WHEN type = ? THEN user_id END) AS step${i}`,
            );
            params.push(step.type);
        }
    });

    // WHERE params come after SELECT params
    params.push(siteId, start, end);

    const sql = `SELECT ${selectParts.join(', ')}
                 FROM events
                 WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?`;

    const funnelRows = await duckAll(sql, params);
    const d = funnelRows[0] || {};

    return funnelSteps.map((step, i) => {
        const visitors = Number(d[`step${i}`] || 0);
        return {
            step: step.label,
            visitors,
            percentage: totalVisitors > 0
                ? Math.round((visitors / totalVisitors) * 1000) / 10
                : 0,
        };
    });
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

    // Error-event spikes (from Sentry stats, when a project is connected). Same
    // rolling-window z-score approach as traffic, so they render in the same
    // AlertsPanel with type='error_spike'. No-op when sentry_stats is empty.
    try {
        const statRows = await duckAll(
            `SELECT date, SUM(events) AS events FROM sentry_stats
             WHERE site_id = ? AND date >= ? AND date <= ?
             GROUP BY date ORDER BY date`,
            [siteId, start.split('T')[0], end.split('T')[0]],
        );
        const es = statRows.map(r => ({ date: toDateStr(r.date), events: Number(r.events) || 0 }));
        for (let i = 3; i < es.length; i++) {
            const win = es.slice(Math.max(0, i - 7), i);
            const avg = win.reduce((s, d) => s + d.events, 0) / win.length;
            const sd = Math.sqrt(win.reduce((s, d) => s + Math.pow(d.events - avg, 2), 0) / win.length);
            const cur = es[i];
            if (sd > 0 && avg > 0 && cur.events > avg + 2 * sd) {
                alerts.push({
                    type: 'error_spike', severity: 'error', date: cur.date,
                    message: `Error spike: ${cur.events} events (avg: ${Math.round(avg)})`,
                    value: cur.events, average: Math.round(avg),
                    change: Math.round(((cur.events - avg) / avg) * 100),
                });
            }
        }
    } catch { /* sentry_stats absent or unqueryable — skip error alerts */ }

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
       AND json_extract_string(properties, '$.milestone') = 'true'
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

/** GET /api/analytics/:siteId/page-actions — Top clicked elements on a specific page */
export async function getPageActions(siteId, path = '/', dateRange = '30d', limit = 30) {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
       json_extract_string(properties, '$.text') AS text,
       json_extract_string(properties, '$.selector') AS selector,
       json_extract_string(properties, '$.tag') AS tag,
       COUNT(*) AS clicks,
       COUNT(DISTINCT user_id) AS unique_users
     FROM events
     WHERE site_id = ? AND type = 'heatmap_click'
       AND path = ?
       AND timestamp >= ? AND timestamp <= ?
     GROUP BY text, selector, tag
     ORDER BY clicks DESC
     LIMIT ?`,
        [siteId, path, start, end, limit],
    );
    return rows.map(r => ({
        text: r.text || '(no text)',
        selector: r.selector || '',
        tag: r.tag || '',
        clicks: Number(r.clicks),
        uniqueUsers: Number(r.unique_users),
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
            // Raw conversion rates invite calling a winner on noise; each
            // non-control variant carries a two-proportion z-test against the
            // first variant. See utils/abStats.js for the caveats.
            variants: addSignificance(variantResults),
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
       json_extract_string(properties, '$.name') AS metric,
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
       json_extract_string(properties, '$.name') AS metric,
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

/**
 * GET /api/analytics/:siteId/sentry/issues — Sentry issues for a site.
 * Reads the sentry_issues table (populated by the Sentry poll loop and synced
 * PG → DuckDB). Filtered by last_seen within the selected date range.
 */
export async function getSentryIssues(siteId, dateRange = '30d', limit = 100) {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT sentry_id, short_id, title, culprit, level, status, is_unhandled,
                count, user_count, permalink, project_slug, is_regression, last_release,
                first_seen, last_seen
         FROM sentry_issues
         WHERE site_id = ? AND COALESCE(stale, FALSE) = FALSE
           AND last_seen >= ? AND last_seen <= ?
         ORDER BY is_regression DESC, last_seen DESC, count DESC
         LIMIT ?`,
        [siteId, start, end, limit],
    );
    return rows.map(r => ({
        sentryId: r.sentry_id,
        shortId: r.short_id || '',
        title: r.title || 'Unknown error',
        culprit: r.culprit || '',
        level: r.level || 'error',
        status: r.status || 'unresolved',
        isUnhandled: !!r.is_unhandled,
        count: Number(r.count) || 0,
        userCount: Number(r.user_count) || 0,
        permalink: r.permalink || null,
        project: r.project_slug || null,
        isRegression: !!r.is_regression,
        lastRelease: r.last_release || null,
        firstSeen: r.first_seen,
        lastSeen: r.last_seen,
    }));
}

/**
 * GET /api/analytics/:siteId/sentry/summary — Aggregate Sentry health for a site:
 * total issues, unresolved count, total events, users affected, level breakdown.
 */
export async function getSentrySummary(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const rows = await duckAll(
        `SELECT
           COUNT(*) AS total_issues,
           COUNT(CASE WHEN status = 'unresolved' THEN 1 END) AS unresolved,
           COUNT(CASE WHEN is_regression THEN 1 END) AS regressions,
           COALESCE(SUM(count), 0) AS total_events,
           COALESCE(SUM(user_count), 0) AS users_affected,
           COUNT(CASE WHEN level = 'fatal' THEN 1 END) AS fatal,
           COUNT(CASE WHEN level = 'error' THEN 1 END) AS error,
           COUNT(CASE WHEN level = 'warning' THEN 1 END) AS warning
         FROM sentry_issues
         WHERE site_id = ? AND COALESCE(stale, FALSE) = FALSE
           AND last_seen >= ? AND last_seen <= ?`,
        [siteId, start, end],
    );
    const r = rows[0] || {};
    return {
        totalIssues: Number(r.total_issues) || 0,
        unresolved: Number(r.unresolved) || 0,
        regressions: Number(r.regressions) || 0,
        totalEvents: Number(r.total_events) || 0,
        usersAffected: Number(r.users_affected) || 0,
        byLevel: {
            fatal: Number(r.fatal) || 0,
            error: Number(r.error) || 0,
            warning: Number(r.warning) || 0,
        },
    };
}

/**
 * GET /api/analytics/:siteId/sentry/trend — daily Sentry event counts for the
 * error-trend chart. Reads sentry_stats (populated from Sentry's project stats
 * API by the poll loop and synced PG → DuckDB).
 */
export async function getSentryTrend(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);
    const startDate = start.split('T')[0];
    const endDate = end.split('T')[0];
    const rows = await duckAll(
        `SELECT date, SUM(events) AS events
         FROM sentry_stats
         WHERE site_id = ? AND date >= ? AND date <= ?
         GROUP BY date
         ORDER BY date`,
        [siteId, startDate, endDate],
    );
    return rows.map(r => ({
        date: toDateStr(r.date),
        events: Number(r.events) || 0,
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

/** Returns visit stats for a specific UTM link (matched by source+medium+campaign) */
export async function getUTMLinkStats(siteId, utmSource, utmMedium, utmCampaign, dateRange = 'all') {
    let dateFilter = '';
    const params = [siteId];
    if (dateRange !== 'all') {
        const { start, end } = getDateRange(dateRange);
        dateFilter = ' AND timestamp >= ? AND timestamp <= ?';
        params.push(start, end);
    }
    const conditions = [];
    if (utmSource) { conditions.push(`utm_source = ?`); params.push(utmSource); }
    if (utmMedium) { conditions.push(`utm_medium = ?`); params.push(utmMedium); }
    if (utmCampaign) { conditions.push(`utm_campaign = ?`); params.push(utmCampaign); }
    const filterSql = conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';
    const rows = await duckAll(
        `SELECT
           COUNT(DISTINCT user_id) AS visitors,
           COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS pageviews,
           MIN(timestamp) AS first_seen,
           MAX(timestamp) AS last_seen
         FROM events
         WHERE site_id = ?${dateFilter}${filterSql}`,
        params,
    );
    const r = rows[0] || {};
    return {
        visitors: Number(r.visitors) || 0,
        pageviews: Number(r.pageviews) || 0,
        first_seen: r.first_seen || null,
        last_seen: r.last_seen || null,
    };
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
