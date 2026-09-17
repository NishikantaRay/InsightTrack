/**
 * Keyword auto-discovery — suggests what a page is trying to rank for.
 *
 * Closes the blank-state gap: Search Visibility can only explain keywords a user
 * has mapped, so a new site shows nothing until someone types a keyword in. Most
 * people don't know what to type, and give up there.
 *
 * Three signal sources, cheapest first, so the common case costs ZERO SerpApi
 * credits:
 *
 *   1. utm_term on inbound visits to that page — a real search term someone
 *      actually arrived on. Strongest signal, but only present if the site tags
 *      its campaigns, so it is a bonus rather than the basis.
 *   2. The URL path itself. "/guides/email-templates" → "email templates". Crude,
 *      but it is what the page is about often enough to be a useful first guess,
 *      and it needs no data at all — so a brand-new site still gets suggestions.
 *   3. SerpApi's related searches for the path-derived phrase (OPT-IN, costs a
 *      credit) — turns a crude guess into real phrasing people search for.
 *
 * Suggestions are never auto-saved. They are proposals the user confirms, because
 * a wrong keyword silently produces a confident wrong explanation later.
 */
import { query } from '../db/postgres.js';
import * as queries from '../queries/queries.js';
import searchVisibility from './searchVisibilityService.js';

/** Words that carry no topical meaning in a URL path. */
const STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'at', 'by', 'with',
    'blog', 'post', 'posts', 'article', 'articles', 'page', 'pages', 'guide', 'guides',
    'docs', 'doc', 'tutorial', 'tutorials', 'how', 'what', 'why', 'index', 'html', 'php',
    'en', 'us', 'www', 'v1', 'v2', 'amp',
]);

/**
 * Derive a human search phrase from a URL path.
 *   /guides/email-templates        → "email templates"
 *   /blog/2026/03/best-crm-tools   → "best crm tools"
 *   /                              → null  (a homepage has no topic)
 */
export function phraseFromPath(path) {
    if (!path || path === '/') return null;

    const segments = String(path)
        .split('?')[0]
        .split('#')[0]
        .split('/')
        .filter(Boolean)
        // Drop date-like and purely numeric segments (/2026/03/, /p/1234).
        .filter((s) => !/^\d+$/.test(s));

    if (segments.length === 0) return null;

    // The last meaningful segment is usually the topic; earlier ones are taxonomy.
    const words = segments[segments.length - 1]
        .replace(/\.(html?|php|aspx?)$/i, '')
        .split(/[-_+.]+/)
        .map((w) => w.toLowerCase().trim())
        .filter((w) => w && !STOPWORDS.has(w) && !/^\d+$/.test(w));

    if (words.length === 0) return null;
    return words.join(' ');
}

/** Search terms visitors actually arrived on for this page (utm_term). */
async function termsFromTraffic(siteId, path, dateRange = '90d') {
    try {
        const rows = await queries.getPageSearchTerms(siteId, path, dateRange, 5);
        return rows
            .filter((r) => r.keyword && r.keyword !== '(not set)')
            .map((r) => ({
                keyword: r.keyword,
                source: 'traffic',
                confidence: 'high',
                reason: `${r.visitors} visitor${r.visitors === 1 ? '' : 's'} arrived on this search term`,
            }));
    } catch {
        return [];   // utm_term is optional; absence is not an error
    }
}

/** Keywords already mapped, so suggestions never duplicate them. */
async function mappedKeywords(siteId, path) {
    const { rows } = await query(
        `SELECT keyword FROM page_keywords WHERE site_id = $1 AND path = $2`,
        [siteId, path],
    );
    return new Set(rows.map((r) => String(r.keyword).toLowerCase()));
}

/**
 * Suggest keywords for one page.
 *
 * @param {string} siteId
 * @param {string} path
 * @param {object} [opts]
 * @param {boolean} [opts.expand]  also fetch SerpApi related searches (1 credit)
 * @returns {Promise<{path, suggestions: Array, expanded: boolean}>}
 */
export async function suggestForPage(siteId, path, { expand = false, dateRange = '90d' } = {}) {
    const already = await mappedKeywords(siteId, path);
    const out = [];
    const seen = new Set();

    const push = (s) => {
        const k = s.keyword.toLowerCase().trim();
        if (!k || k.length < 3 || k.length > 200) return;
        if (already.has(k) || seen.has(k)) return;
        seen.add(k);
        out.push({ ...s, keyword: s.keyword.trim() });
    };

    // 1 — real search terms from first-party traffic (free, strongest)
    for (const t of await termsFromTraffic(siteId, path, dateRange)) push(t);

    // 2 — the path itself (free, always available)
    const phrase = phraseFromPath(path);
    if (phrase) {
        push({
            keyword: phrase,
            source: 'path',
            confidence: 'medium',
            reason: 'Derived from the page URL',
        });
    }

    // 3 — SerpApi related searches (opt-in: costs a credit)
    let expanded = false;
    if (expand && phrase) {
        try {
            const serp = await searchVisibility.getSerp({
                keyword: phrase, maxAgeHours: 72, siteId,
            });
            expanded = true;
            for (const r of (serp.related?.relatedSearches || []).slice(0, 5)) {
                push({
                    keyword: r.query,
                    source: 'serp',
                    confidence: 'medium',
                    reason: 'A related search Google shows for this topic',
                });
            }
            for (const q of (serp.related?.peopleAlsoAsk || []).slice(0, 3)) {
                push({
                    keyword: q.question,
                    source: 'serp',
                    confidence: 'low',
                    reason: 'A question people also ask about this topic',
                });
            }
        } catch {
            // SerpApi unavailable — the free suggestions above still stand.
        }
    }

    return { path, suggestions: out.slice(0, 8), expanded };
}

/**
 * Suggest keywords for a site's busiest UNMAPPED pages — what the empty state
 * offers on first load, so the feature is useful before any manual setup.
 */
export async function suggestForSite(siteId, { dateRange = '90d', limit = 5 } = {}) {
    const top = await queries.getTopPages(siteId, dateRange, 25);

    const { rows } = await query(
        `SELECT DISTINCT path FROM page_keywords WHERE site_id = $1`,
        [siteId],
    );
    const mapped = new Set(rows.map((r) => r.path));

    const pages = [];
    for (const p of top) {
        const path = p.path || p.page;
        if (!path || path === '/' || mapped.has(path)) continue;   // homepage has no single topic
        const { suggestions } = await suggestForPage(siteId, path, { dateRange });
        if (suggestions.length) {
            pages.push({ path, views: p.views ?? p.pageviews ?? 0, suggestions });
        }
        if (pages.length >= limit) break;
    }
    return { pages };
}

export default { phraseFromPath, suggestForPage, suggestForSite };
