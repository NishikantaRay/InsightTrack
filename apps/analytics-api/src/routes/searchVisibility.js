/**
 * Search-visibility REST API — the dashboard's data source.
 *
 * Mirrors the four MCP tools so the dashboard and the AI agent answer from the
 * same logic: the tools in mcp/tools/registry.js and these routes both call
 * searchVisibilityService + correlationService. There is no second
 * implementation of the correlation to drift out of sync.
 *
 * Every route is behind authMiddleware + authorizeSiteAccess (invariant 4) —
 * none of this is in the tracking/auth exemption list. SerpApi keys never
 * appear in a response; only `source: 'serpapi'|'fixture'` is surfaced so the
 * UI can label demo data honestly.
 */
import express from 'express';
import * as queries from '../queries/queries.js';
import { authMiddleware } from '../middleware/auth.js';
import { analyticsCache, CACHE_TTL } from '../services/cache.js';
import sitesService from '../services/sitesService.js';
import { getMemberRole, roleAtLeast } from '../services/teamService.js';
import searchVisibility from '../services/searchVisibilityService.js';
import serpapiKeys from '../services/serpapiKeyService.js';
import rankTracker from '../services/rankTrackerService.js';
import searchAlerts from '../services/searchAlertsService.js';
import { query } from '../db/postgres.js';
import keywordDiscovery from '../services/keywordDiscoveryService.js';
import { bucketByWeek, detectChange, explain } from '../services/correlationService.js';
import { safeMsg } from '../utils/safeError.js';

const router = express.Router();
const safeError = (error) => safeMsg(error, 500);

const DEFAULT_RANGE = '90d';
const DEFAULT_LOCATION = 'United States';
const MAX_KEYWORDS_PER_REQUEST = 5;   // credit guardrail

const validateSiteId = (req, res, next) => {
    const siteId = req.params.siteId || req.query.siteId;
    if (!siteId) return res.status(400).json({ success: false, error: 'siteId is required' });
    req.siteId = siteId;
    next();
};

const authorizeSiteAccess = async (req, res, next) => {
    try {
        const site = await sitesService.getSiteById(req.siteId);
        if (!site) return res.status(404).json({ success: false, error: 'Site not found' });
        const role = await getMemberRole(req.siteId, req.user.id);
        if (!role) return res.status(403).json({ success: false, error: 'You do not have access to this site' });
        req.site = site;
        req.userRole = role;
        next();
    } catch (error) {
        console.error('Error authorizing search-visibility access:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
};

router.use(authMiddleware);
router.use('/:siteId', validateSiteId, authorizeSiteAccess);

/** The site's own bare domain — what we look for in the SERP. */
const siteDomain = (req) =>
    (req.site?.domain || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];

// ── keyword mapping ──────────────────────────────────────────────────────────

// GET /api/search/:siteId/keywords
router.get('/:siteId/keywords', async (req, res) => {
    try {
        res.json({ success: true, data: await searchVisibility.getSiteKeywords(req.siteId) });
    } catch (error) {
        console.error('Error fetching keywords:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// POST /api/search/:siteId/keywords   { path, keyword, location?, isPrimary? }
router.post('/:siteId/keywords', async (req, res) => {
    try {
        if (!roleAtLeast(req.userRole, 'admin')) {
            return res.status(403).json({ success: false, error: 'Admin role required to map keywords' });
        }
        const { path, keyword, location = DEFAULT_LOCATION, isPrimary = false } = req.body || {};
        if (!path || !keyword) {
            return res.status(400).json({ success: false, error: 'path and keyword are required' });
        }
        if (String(keyword).length > 200) {
            return res.status(400).json({ success: false, error: 'keyword must be 200 characters or fewer' });
        }
        const row = await searchVisibility.addPageKeyword(req.siteId, { path, keyword, location, isPrimary });
        res.status(201).json({ success: true, data: row });
    } catch (error) {
        console.error('Error adding keyword:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// DELETE /api/search/:siteId/keywords   ?path=&keyword=&location=
router.delete('/:siteId/keywords', async (req, res) => {
    try {
        if (!roleAtLeast(req.userRole, 'admin')) {
            return res.status(403).json({ success: false, error: 'Admin role required to remove keywords' });
        }
        const { path, keyword, location = DEFAULT_LOCATION } = req.query;
        if (!path || !keyword) {
            return res.status(400).json({ success: false, error: 'path and keyword are required' });
        }
        const removed = await searchVisibility.removePageKeyword(req.siteId, { path, keyword, location });
        res.json({ success: true, data: { removed } });
    } catch (error) {
        console.error('Error removing keyword:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// ── keyword auto-discovery ───────────────────────────────────────────────────
//
// Suggests what a page is trying to rank for, so the feature is useful before
// any manual mapping. Suggestions are proposals — never auto-saved, because a
// wrong keyword produces a confident wrong explanation later.

// GET /api/search/:siteId/suggest?path=&expand=1
router.get('/:siteId/suggest', async (req, res) => {
    try {
        const { path, dateRange = DEFAULT_RANGE } = req.query;
        // `expand` opts into a SerpApi call (one credit) for real related searches.
        const expand = req.query.expand === '1' || req.query.expand === 'true';

        if (path) {
            const data = await keywordDiscovery.suggestForPage(req.siteId, path, { expand, dateRange });
            return res.json({ success: true, data });
        }
        // No path → suggest for the site's busiest unmapped pages (empty state).
        const data = await keywordDiscovery.suggestForSite(req.siteId, { dateRange });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error suggesting keywords:', error);
        res.status(error.status || 500).json({ success: false, error: safeMsg(error, error.status || 500) });
    }
});

// ── SerpApi key (per site, encrypted at rest) ────────────────────────────────
//
// The key is AES-256-GCM encrypted into site_integrations.token_cipher, exactly
// as Sentry tokens are. It is NEVER returned — reads give a masked hint only.

// GET /api/search/:siteId/serpapi-key — connection status (no secret)
router.get('/:siteId/serpapi-key', async (req, res) => {
    try {
        res.json({ success: true, data: await serpapiKeys.getStatus(req.siteId) });
    } catch (error) {
        console.error('Error fetching SerpApi key status:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// PUT /api/search/:siteId/serpapi-key — save/replace the key (admin+)
router.put('/:siteId/serpapi-key', async (req, res) => {
    try {
        if (!roleAtLeast(req.userRole, 'admin')) {
            return res.status(403).json({ success: false, error: 'Admin role required to set the SerpApi key' });
        }
        const data = await serpapiKeys.saveKey(req.siteId, req.body?.key);
        res.json({ success: true, data });
    } catch (error) {
        const status = error.status || 500;
        if (status >= 500) console.error('Error saving SerpApi key:', error);
        res.status(status).json({ success: false, error: safeMsg(error, status) });
    }
});

// DELETE /api/search/:siteId/serpapi-key — forget the key (admin+)
router.delete('/:siteId/serpapi-key', async (req, res) => {
    try {
        if (!roleAtLeast(req.userRole, 'admin')) {
            return res.status(403).json({ success: false, error: 'Admin role required to remove the SerpApi key' });
        }
        res.json({ success: true, data: { removed: await serpapiKeys.removeKey(req.siteId) } });
    } catch (error) {
        console.error('Error removing SerpApi key:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// ── Rank-check budget ────────────────────────────────────────────────────────
//
// The cadence is the spend: a SerpApi plan is a monthly credit allowance, and
// keywords × checks-per-month is what consumes it. These were env-only, which
// meant the one number that governs cost was the one you could not reach from
// the dashboard.

// GET /api/search/:siteId/rank-budget — effective settings + what they cost
router.get('/:siteId/rank-budget', async (req, res) => {
    try {
        const budget = await serpapiKeys.getBudget(req.siteId);
        const { rows } = await query(
            `SELECT COUNT(DISTINCT (keyword, location))::int AS n
               FROM page_keywords WHERE site_id = $1`,
            [req.siteId],
        );
        const keywords = rows[0]?.n || 0;
        // Checks per keyword per month, at this cadence.
        const perMonth = Math.round(keywords * (24 / budget.minHours) * 30);
        res.json({
            success: true,
            data: { ...budget, keywords, estimatedCreditsPerMonth: perMonth,
                    pending: await rankTracker.pendingCount() },
        });
    } catch (error) {
        console.error('Error fetching rank budget:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// PUT /api/search/:siteId/rank-budget — change the cadence (admin+)
router.put('/:siteId/rank-budget', async (req, res) => {
    try {
        if (!roleAtLeast(req.userRole, 'admin')) {
            return res.status(403).json({ success: false, error: 'Admin role required to change the rank-check budget' });
        }
        const data = await serpapiKeys.saveBudget(req.siteId, {
            minHours: req.body?.minHours,
            maxPerRun: req.body?.maxPerRun,
        });
        res.json({ success: true, data });
    } catch (error) {
        const status = error.status || 500;
        if (status >= 500) console.error('Error saving rank budget:', error);
        res.status(status).json({ success: false, error: safeMsg(error, status) });
    }
});

// ── In-app alerts ────────────────────────────────────────────────────────────
//
// Rank / AI-answer changes raised by each fresh rank check. Shown on /search and
// counted in the sidebar; nothing is emailed or sent anywhere.

// GET /api/search/:siteId/alerts?status=unread|all&limit=
router.get('/:siteId/alerts', async (req, res) => {
    try {
        const unreadOnly = req.query.status === 'unread';
        const [alerts, unread] = await Promise.all([
            searchAlerts.listAlerts(req.siteId, { unreadOnly, limit: req.query.limit }),
            searchAlerts.unreadCount(req.siteId),
        ]);
        res.json({ success: true, data: { alerts, unreadCount: unread } });
    } catch (error) {
        console.error('Error fetching search alerts:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// POST /api/search/:siteId/alerts/read — { ids?: number[] }; no ids → mark all
router.post('/:siteId/alerts/read', async (req, res) => {
    try {
        const updated = await searchAlerts.markRead(req.siteId, req.body?.ids);
        res.json({ success: true, data: { updated, unreadCount: await searchAlerts.unreadCount(req.siteId) } });
    } catch (error) {
        console.error('Error marking search alerts read:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// ── SERP lookups ─────────────────────────────────────────────────────────────

// GET /api/search/:siteId/rankings?keyword=&location=&device=
router.get('/:siteId/rankings', async (req, res) => {
    try {
        const { keyword, location = DEFAULT_LOCATION, device = 'desktop' } = req.query;
        if (!keyword) return res.status(400).json({ success: false, error: 'keyword is required' });
        const data = await searchVisibility.checkKeyword(req.siteId, siteDomain(req), { keyword, location, device });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching rankings:', error);
        res.status(error.status || 500).json({ success: false, error: safeMsg(error, error.status || 500) });
    }
});

// GET /api/search/:siteId/ai-overview?keyword=&location=
router.get('/:siteId/ai-overview', async (req, res) => {
    try {
        const { keyword, location = DEFAULT_LOCATION } = req.query;
        if (!keyword) return res.status(400).json({ success: false, error: 'keyword is required' });
        const f = await searchVisibility.checkKeyword(req.siteId, siteDomain(req), { keyword, location });
        res.json({
            success: true,
            data: {
                keyword: f.keyword, hasAiOverview: f.hasAiOverview, domainIsCited: f.domainIsCited,
                previouslyCited: f.previouslyCited, citationChange: f.citationChange,
                citations: f.citations, source: f.source, cached: f.cached, fetchedAt: f.fetchedAt,
            },
        });
    } catch (error) {
        console.error('Error fetching AI overview:', error);
        res.status(error.status || 500).json({ success: false, error: safeMsg(error, error.status || 500) });
    }
});

// GET /api/search/:siteId/related?keyword=&location=&limit=
router.get('/:siteId/related', async (req, res) => {
    try {
        const { keyword, location = DEFAULT_LOCATION, limit = 10 } = req.query;
        if (!keyword) return res.status(400).json({ success: false, error: 'keyword is required' });
        const serp = await searchVisibility.getSerp({ keyword, location, maxAgeHours: 72, siteId: req.siteId });
        const n = Math.min(parseInt(limit) || 10, 50);
        res.json({
            success: true,
            data: {
                keyword,
                peopleAlsoAsk: (serp.related?.peopleAlsoAsk || []).slice(0, n),
                relatedSearches: (serp.related?.relatedSearches || []).slice(0, n),
                source: serp.source, cached: !!serp.cached, fetchedAt: serp.fetchedAt,
            },
        });
    } catch (error) {
        console.error('Error fetching related queries:', error);
        res.status(error.status || 500).json({ success: false, error: safeMsg(error, error.status || 500) });
    }
});

// GET /api/search/:siteId/rank-history?keyword=&location=&device=
router.get('/:siteId/rank-history', async (req, res) => {
    try {
        const { keyword, location = DEFAULT_LOCATION, device = 'desktop' } = req.query;
        if (!keyword) return res.status(400).json({ success: false, error: 'keyword is required' });
        res.json({ success: true, data: await searchVisibility.getRankHistory(req.siteId, keyword, location, device) });
    } catch (error) {
        console.error('Error fetching rank history:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// ── the correlation ──────────────────────────────────────────────────────────

/** Shared by /explain and /overview so both surfaces use one code path. */
async function explainPage(req, path, { dateRange, location }) {
    const daily = await analyticsCache.getOrFetch(
        analyticsCache.key('page-trend', req.siteId, path, dateRange),
        CACHE_TTL.PAGES,
        () => queries.getPageTrafficTrend(req.siteId, path, dateRange),
    );
    const traffic = detectChange(bucketByWeek(daily));

    const mapped = await searchVisibility.getKeywordsForPage(req.siteId, path);
    const keywords = mapped.slice(0, MAX_KEYWORDS_PER_REQUEST);

    const caveats = [];
    const findings = [];
    for (const k of keywords) {
        try {
            findings.push(await searchVisibility.checkKeyword(req.siteId, siteDomain(req), {
                keyword: k.keyword, location: k.location || location,
            }));
        } catch (err) {
            // Degrade to a traffic-only answer rather than inventing a cause.
            caveats.push(`SERP data unavailable for '${k.keyword}' — explanation is traffic-only.`);
            findings.push({ keyword: k.keyword, error: err.message });
        }
    }
    if (keywords.length === 0) {
        caveats.push(`No target keywords are mapped to ${path}. Map one to get a search-side explanation.`);
    }

    return { ...explain({ path, traffic, keywordFindings: findings, windowUsed: dateRange, caveats }), daily };
}

// GET /api/search/:siteId/explain?path=&dateRange=&location=
router.get('/:siteId/explain', async (req, res) => {
    try {
        const { path, dateRange = DEFAULT_RANGE, location = DEFAULT_LOCATION } = req.query;
        if (!path) return res.status(400).json({ success: false, error: 'path is required' });
        res.json({ success: true, data: await explainPage(req, path, { dateRange, location }) });
    } catch (error) {
        console.error('Error explaining traffic change:', error);
        res.status(error.status || 500).json({ success: false, error: safeMsg(error, error.status || 500) });
    }
});

/**
 * GET /api/search/:siteId/overview?dateRange=&limit=
 *
 * The dashboard's main view: every page with a mapped keyword, explained,
 * biggest mover first. Pages are capped so one request cannot fan out into
 * dozens of SerpApi calls.
 */
router.get('/:siteId/overview', async (req, res) => {
    try {
        const { dateRange = DEFAULT_RANGE, location = DEFAULT_LOCATION } = req.query;
        const limit = Math.min(parseInt(req.query.limit) || 10, 25);

        const mapped = await searchVisibility.getSiteKeywords(req.siteId);
        const paths = [...new Set(mapped.map((m) => m.path))].slice(0, limit);

        const pages = [];
        for (const path of paths) {
            try {
                pages.push(await explainPage(req, path, { dateRange, location }));
            } catch (err) {
                pages.push({ path, error: safeMsg(err, 500) });
            }
        }

        // Biggest absolute swing first — the pages worth looking at.
        pages.sort((a, b) => Math.abs(b.traffic?.changePct ?? 0) - Math.abs(a.traffic?.changePct ?? 0));

        res.json({
            success: true,
            data: {
                pages,
                significantCount: pages.filter((p) => p.traffic?.significant).length,
                dateRange,
                // Tells the UI to label the view as demo data — never silently
                // pass fixtures off as live SERP results. Per-site, so one site
                // with its own key isn't mislabelled because another lacks one.
                fixtureMode: await searchVisibility.isFixtureModeForSite(req.siteId),
            },
        });
    } catch (error) {
        console.error('Error building search-visibility overview:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

export default router;
