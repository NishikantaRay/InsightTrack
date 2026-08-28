/**
 * Deterministic benchmark dataset generator.
 *
 * Same seed + same size => byte-identical rows, every time, on any machine.
 * That property is what makes a benchmark reproducible: without it, two runs
 * differ in query selectivity and the timings are not comparable.
 *
 * Randomness is a self-contained mulberry32 PRNG rather than Math.random(),
 * because Math.random() cannot be seeded and its implementation is free to vary
 * between Node versions.
 *
 * DISTRIBUTION RATIONALE - why not uniform random?
 * Uniform data would make every GROUP BY produce equal-sized buckets and every
 * filter equally selective, which is not what analytics data looks like and
 * would flatter any engine that likes predictable cardinality. The generator
 * instead mirrors the shapes the production schema implies:
 *
 *   - Event types: weighted, pageview-dominant (matches ALLOWED_TYPES usage)
 *   - Pages:       Zipf-like, a few hot paths carry most traffic
 *   - Referrers:   heavy "direct" share, then a long tail
 *   - Visitors:    a bounded visitor pool that is revisited, so
 *                  COUNT(DISTINCT user_id) is genuinely sub-linear in rows
 *   - Sessions:    multiple events per session, variable length
 *   - Timestamps:  spread across the range with a diurnal curve and a
 *                  weekday/weekend difference
 *   - Sites:       deliberately skewed (one dominant tenant), so single-site
 *                  filters are selective the way they are in production
 *
 * No engine-specific tuning is applied. The same rows are loaded into both
 * PostgreSQL and DuckDB.
 */

// -- PRNG ---------------------------------------------------------------------

/** mulberry32 - small, fast, well-distributed, fully deterministic. */
export function makeRng(seed) {
    let a = seed >>> 0;
    return function rng() {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Pick from `items` using integer `weights` (same length). */
function weighted(rng, items, weights) {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = rng() * total;
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
    }
    return items[items.length - 1];
}

// -- Fixed vocabularies (part of the reproducible spec) ------------------------

export const SITES = ['bench_site_a', 'bench_site_b', 'bench_site_c'];
const SITE_WEIGHTS = [70, 20, 10];          // one dominant tenant, as in production

const PAGES = [
    '/', '/pricing', '/docs', '/blog', '/features', '/about',
    '/signup', '/login', '/contact', '/changelog',
    '/blog/getting-started', '/blog/analytics-101', '/docs/api', '/docs/install',
    '/integrations', '/security', '/careers', '/terms', '/privacy', '/status',
];
const PAGE_WEIGHTS = [280, 140, 90, 80, 70, 45, 40, 35, 25, 20, 18, 16, 14, 12, 10, 9, 7, 5, 4, 3];

const REFERRERS = [
    '', 'https://google.com', 'https://news.ycombinator.com', 'https://reddit.com',
    'https://twitter.com', 'https://linkedin.com', 'https://github.com',
    'https://bing.com', 'https://duckduckgo.com', 'https://producthunt.com',
];
const REFERRER_WEIGHTS = [420, 220, 90, 70, 55, 40, 35, 25, 20, 15];

const EVENT_TYPES = ['pageview', 'click', 'scroll_depth', 'web_vital', 'heatmap_click', 'js_error', 'form_submit', 'purchase'];
const EVENT_TYPE_WEIGHTS = [520, 170, 110, 80, 60, 30, 20, 10];

const DEVICES = ['Desktop', 'Mobile', 'Tablet'];
const DEVICE_WEIGHTS = [55, 38, 7];

const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Edge', 'Opera'];
const BROWSER_WEIGHTS = [62, 20, 9, 7, 2];

const OSES = ['macOS', 'Windows', 'iOS', 'Android', 'Linux'];
const OS_WEIGHTS = [30, 34, 16, 14, 6];

const COUNTRIES = ['United States', 'India', 'Germany', 'United Kingdom', 'Canada', 'France', 'Brazil', 'Japan', 'Australia', 'Netherlands'];
const COUNTRY_WEIGHTS = [300, 150, 90, 85, 60, 45, 40, 35, 30, 25];

const UTM_SOURCES = ['', 'google', 'newsletter', 'twitter', 'producthunt', 'partner'];
const UTM_SOURCE_WEIGHTS = [560, 160, 90, 70, 60, 40];

const UTM_MEDIUMS = ['', 'cpc', 'email', 'social', 'referral'];
const UTM_MEDIUM_WEIGHTS = [560, 150, 110, 100, 60];

const UTM_CAMPAIGNS = ['', 'launch', 'spring_sale', 'retargeting', 'brand'];
const UTM_CAMPAIGN_WEIGHTS = [600, 130, 110, 90, 70];

/** Column order used for both PostgreSQL and DuckDB loads. */
export const EVENT_COLUMNS = [
    'site_id', 'user_id', 'session_id', 'type', 'url', 'path', 'referrer',
    'device', 'browser', 'os', 'country', 'city', 'timestamp', 'properties',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
];

/** Default span of the generated dataset, in days, ending at DATASET_END_ISO. */
export const DEFAULT_DAYS = 90;

/** Fixed end instant so timestamps do not drift with wall-clock time. */
export const DATASET_END_ISO = '2026-01-01T00:00:00.000Z';

/**
 * Generate `count` deterministic event rows.
 *
 * @param {object}  opts
 * @param {number}  opts.count  number of event rows
 * @param {number}  opts.seed   PRNG seed
 * @param {number} [opts.days]  span in days (default 90)
 * @param {number} [opts.visitorPoolDivisor] rows-per-visitor ratio (default 12)
 * @returns {{rows: Array<Array>, stats: object}}
 */
export function generateEvents({ count, seed, days = DEFAULT_DAYS, visitorPoolDivisor = 12 }) {
    const rng = makeRng(seed);
    const end = Date.parse(DATASET_END_ISO);
    const spanMs = days * 86400000;
    const start = end - spanMs;

    // A bounded visitor pool that gets revisited, so COUNT(DISTINCT user_id) is
    // meaningfully smaller than the row count (as it is in real analytics data).
    const visitorPool = Math.max(1, Math.floor(count / visitorPoolDivisor));

    const rows = new Array(count);
    const sessionIds = new Set();

    // Sessions carry several events each; we hold one open and roll it over,
    // which produces realistic session cardinality without storing them all.
    let openSession = null;
    let openSessionRemaining = 0;
    let openVisitor = null;
    let openSessionStart = 0;

    for (let i = 0; i < count; i++) {
        if (openSessionRemaining === 0) {
            const v = Math.floor(rng() * visitorPool);
            openVisitor = 'u_' + v.toString(36).padStart(7, '0');
            // 1-9 events per session, front-weighted (most sessions are short)
            openSessionRemaining = 1 + Math.floor(rng() * rng() * 9);
            openSession = 's_' + i.toString(36) + '_' + Math.floor(rng() * 1e6).toString(36);

            // Diurnal + weekday shape rather than a flat spread.
            const dayOffset = Math.floor(rng() * days);
            const dayStart = start + dayOffset * 86400000;
            const dow = new Date(dayStart).getUTCDay();
            const weekend = dow === 0 || dow === 6;
            // hour-of-day curve peaking mid-afternoon UTC; flatter at weekends
            const hourBias = rng() * rng();
            const hour = weekend
                ? Math.floor(rng() * 24)
                : Math.floor(6 + hourBias * 16);
            openSessionStart = dayStart + hour * 3600000 + Math.floor(rng() * 3600000);
        }

        const site = weighted(rng, SITES, SITE_WEIGHTS);
        const page = weighted(rng, PAGES, PAGE_WEIGHTS);
        const type = weighted(rng, EVENT_TYPES, EVENT_TYPE_WEIGHTS);
        const referrer = weighted(rng, REFERRERS, REFERRER_WEIGHTS);
        // events within a session advance by up to ~4 minutes
        const ts = new Date(openSessionStart + (9 - openSessionRemaining) * Math.floor(rng() * 240000));

        rows[i] = [
            site,
            openVisitor,
            openSession,
            type,
            'https://' + site.replace(/_/g, '-') + '.example.com' + page,
            page,
            referrer,
            weighted(rng, DEVICES, DEVICE_WEIGHTS),
            weighted(rng, BROWSERS, BROWSER_WEIGHTS),
            weighted(rng, OSES, OS_WEIGHTS),
            weighted(rng, COUNTRIES, COUNTRY_WEIGHTS),
            '',
            ts.toISOString(),
            '{}',
            weighted(rng, UTM_SOURCES, UTM_SOURCE_WEIGHTS),
            weighted(rng, UTM_MEDIUMS, UTM_MEDIUM_WEIGHTS),
            weighted(rng, UTM_CAMPAIGNS, UTM_CAMPAIGN_WEIGHTS),
            '',
            '',
        ];
        sessionIds.add(openSession);
        openSessionRemaining--;
    }

    return {
        rows,
        stats: {
            events: count,
            sessions: sessionIds.size,
            visitorPool,
            sites: SITES.length,
            days,
            rangeStart: new Date(start).toISOString(),
            rangeEnd: new Date(end).toISOString(),
            seed,
        },
    };
}

/** Stable fingerprint of a dataset - used by tests to assert determinism. */
export function fingerprint(rows) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (const row of rows) {
        const s = row.join('');
        for (let i = 0; i < s.length; i++) {
            const ch = s.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
