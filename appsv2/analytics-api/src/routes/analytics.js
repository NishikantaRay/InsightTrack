import express from 'express';
import * as queries from '../queries/queries.js';
import { authMiddleware } from '../middleware/auth.js';
import { analyticsCache, CACHE_TTL } from '../services/cache.js';
import sitesService from '../services/sitesService.js';

const router = express.Router();

const safeError = (error) => {
    if (process.env.NODE_ENV === 'development') return error.message;
    return 'An internal error occurred';
};

async function cachedQuery(cacheKey, ttl, queryFn) {
    const cached = analyticsCache.get(cacheKey);
    if (cached) return cached;
    const data = await queryFn();
    analyticsCache.set(cacheKey, data, ttl);
    return data;
}

const validateSiteId = (req, res, next) => {
    const siteId = req.params.siteId || req.query.siteId;
    if (!siteId) {
        return res.status(400).json({ success: false, error: 'siteId is required' });
    }
    req.siteId = siteId;
    next();
};

const authorizeSiteAccess = async (req, res, next) => {
    try {
        const site = await sitesService.getSiteById(req.siteId);
        if (!site) {
            return res.status(404).json({ success: false, error: 'Site not found' });
        }
        if (String(site.user_id) !== String(req.user.id)) {
            return res.status(403).json({ success: false, error: 'You do not have access to this site' });
        }
        req.site = site;
        next();
    } catch (error) {
        console.error('Error authorizing analytics access:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
};

router.use(authMiddleware);
router.use('/:siteId', validateSiteId, authorizeSiteAccess);

// GET /api/analytics/:siteId/traffic
router.get('/:siteId/traffic', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('traffic', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.TRAFFIC, () =>
            queries.getTrafficOverTime(req.siteId, dateRange)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching traffic:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/bounce-rate-trend
router.get('/:siteId/bounce-rate-trend', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getBounceRateOverTime(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching bounce rate trend:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/avg-session-trend
router.get('/:siteId/avg-session-trend', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getAvgSessionOverTime(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching avg session trend:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/pageviews
router.get('/:siteId/pageviews', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getPageViewsOverTime(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching pageviews:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/top-pages
router.get('/:siteId/top-pages', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d', limit = 10 } = req.query;
        const data = await queries.getTopPages(req.siteId, dateRange, parseInt(limit));
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching top pages:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/sources
router.get('/:siteId/sources', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('sources', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.GENERAL, () =>
            queries.getTrafficSources(req.siteId, dateRange)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching sources:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/devices
router.get('/:siteId/devices', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getDeviceBreakdown(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/countries
router.get('/:siteId/countries', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d', limit = 10 } = req.query;
        const data = await queries.getCountries(req.siteId, dateRange, parseInt(limit));
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching countries:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/sessions
router.get('/:siteId/sessions', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getSessionDuration(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/kpi
router.get('/:siteId/kpi', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('kpi', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.KPI, () =>
            queries.getKPISummary(req.siteId, dateRange)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching KPI:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/funnel/steps
// Returns distinct event types + top page paths from real data for the funnel builder
router.get('/:siteId/funnel/steps', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('funnel-steps', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.TRAFFIC, () =>
            queries.getAvailableFunnelSteps(req.siteId, dateRange)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching funnel steps:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/funnel
// Optional query param: steps (JSON array of {label, type, path?})
router.get('/:siteId/funnel', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d', steps } = req.query;

        let parsedSteps = null;
        if (steps) {
            try {
                parsedSteps = JSON.parse(steps);
                if (!Array.isArray(parsedSteps)) throw new Error('steps must be an array');
            } catch {
                return res.status(400).json({ success: false, error: 'Invalid steps parameter – must be a JSON array' });
            }
        }

        const cacheKey = analyticsCache.key('funnel', req.siteId, dateRange, steps || 'default');
        const data = await cachedQuery(cacheKey, CACHE_TTL.TRAFFIC, () =>
            queries.getFunnelData(req.siteId, dateRange, parsedSteps)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching funnel:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/realtime
router.get('/:siteId/realtime', validateSiteId, async (req, res) => {
    try {
        const cacheKey = analyticsCache.key('realtime', req.siteId);
        const data = await cachedQuery(cacheKey, CACHE_TTL.REALTIME, () =>
            queries.getRealTimeVisitors(req.siteId)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching realtime:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/realtime/event-stream
router.get('/:siteId/realtime/event-stream', validateSiteId, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const cacheKey = analyticsCache.key('event-stream', req.siteId);
        const data = await cachedQuery(cacheKey, CACHE_TTL.REALTIME, () =>
            queries.getRealtimeEventStream(req.siteId, limit)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching event stream:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/utm
router.get('/:siteId/utm', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getUTMCampaigns(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching UTM data:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/comparison
router.get('/:siteId/comparison', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('comparison', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.TRAFFIC, () =>
            queries.getComparisonTraffic(req.siteId, dateRange)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching comparison data:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/user-flow
router.get('/:siteId/user-flow', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d', limit = 20 } = req.query;
        const data = await queries.getUserFlow(req.siteId, dateRange, parseInt(limit));
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching user flow:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/alerts
router.get('/:siteId/alerts', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getAlerts(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// ─── Engagement Endpoints ────────────────────────────────────────

// GET /api/analytics/:siteId/engagement/summary
router.get('/:siteId/engagement/summary', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('engagement', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.GENERAL, () =>
            queries.getEngagementSummary(req.siteId, dateRange)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching engagement summary:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/engagement/scroll-depth
router.get('/:siteId/engagement/scroll-depth', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getScrollDepth(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching scroll depth:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/engagement/heatmap
router.get('/:siteId/engagement/heatmap', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d', path = '/' } = req.query;
        const data = await queries.getHeatmapData(req.siteId, dateRange, path);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching heatmap:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/engagement/heatmap-summary
router.get('/:siteId/engagement/heatmap-summary', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getHeatmapSummary(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching heatmap summary:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/engagement/rage-clicks
router.get('/:siteId/engagement/rage-clicks', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getRageClicks(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching rage clicks:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/engagement/time-on-page
router.get('/:siteId/engagement/time-on-page', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getTimeOnPage(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching time on page:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/all
router.get('/:siteId/all', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;

        const [traffic, pageviews, topPages, sources, devices, countries, sessions, kpi, funnel, realtime] = await Promise.all([
            queries.getTrafficOverTime(req.siteId, dateRange),
            queries.getPageViewsOverTime(req.siteId, dateRange),
            queries.getTopPages(req.siteId, dateRange, 10),
            queries.getTrafficSources(req.siteId, dateRange),
            queries.getDeviceBreakdown(req.siteId, dateRange),
            queries.getCountries(req.siteId, dateRange, 10),
            queries.getSessionDuration(req.siteId, dateRange),
            queries.getKPISummary(req.siteId, dateRange),
            queries.getFunnelData(req.siteId, dateRange),
            queries.getRealTimeVisitors(req.siteId),
        ]);

        res.json({
            success: true,
            data: { traffic, pageviews, topPages, sources, devices, countries, sessions, kpi, funnel, realtime },
        });
    } catch (error) {
        console.error('Error fetching all analytics:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// ─── Conversion & Goals Endpoints ────────────────────────────────

// GET /api/analytics/:siteId/goals/conversions
router.get('/:siteId/goals/conversions', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getGoalConversions(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching goal conversions:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/goals/conversions-over-time
router.get('/:siteId/goals/conversions-over-time', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d', goalId } = req.query;
        if (!goalId) return res.status(400).json({ success: false, error: 'goalId is required' });
        const data = await queries.getGoalConversionsOverTime(req.siteId, goalId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching goal conversions over time:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/ab-tests/results
router.get('/:siteId/ab-tests/results', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getABTestResults(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching A/B test results:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// ─── Audience Endpoints ──────────────────────────────────────────

// GET /api/analytics/:siteId/audience/new-vs-returning
router.get('/:siteId/audience/new-vs-returning', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getNewVsReturning(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching new vs returning:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/audience/cohorts
router.get('/:siteId/audience/cohorts', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getCohortAnalysis(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching cohort analysis:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/audience/segments
router.get('/:siteId/audience/segments', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d', device, country, browser, source } = req.query;
        const filters = {};
        if (device) filters.device = device;
        if (country) filters.country = country;
        if (browser) filters.browser = browser;
        if (source) filters.source = source;
        const data = await queries.getVisitorSegments(req.siteId, dateRange, filters);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching visitor segments:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// ─── Revenue Endpoint ────────────────────────────────────────────

// GET /api/analytics/:siteId/revenue
router.get('/:siteId/revenue', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getRevenueAttribution(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching revenue data:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// ─── Content Endpoints ───────────────────────────────────────────

router.get('/:siteId/content/entry-pages', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('entry-pages', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.TRAFFIC, () =>
            queries.getEntryPages(req.siteId, dateRange)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching entry pages:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

router.get('/:siteId/content/exit-pages', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('exit-pages', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.TRAFFIC, () =>
            queries.getExitPages(req.siteId, dateRange)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching exit pages:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

router.get('/:siteId/content/site-search', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('site-search', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.GENERAL, () =>
            queries.getSiteSearchQueries(req.siteId, dateRange)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching site search:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// ─── Acquisition Endpoints ───────────────────────────────────────

router.get('/:siteId/acquisition/campaigns', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('campaigns', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.TRAFFIC, () =>
            queries.getCampaignDashboard(req.siteId, dateRange)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

router.get('/:siteId/acquisition/social', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('social', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.TRAFFIC, () =>
            queries.getSocialMediaTraffic(req.siteId, dateRange)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching social media traffic:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

router.get('/:siteId/acquisition/keywords', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('keywords', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.GENERAL, () =>
            queries.getSearchKeywords(req.siteId, dateRange)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching keywords:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// ─── Performance Endpoints ───────────────────────────────────────

router.get('/:siteId/performance/web-vitals', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('web-vitals', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.GENERAL, () =>
            queries.getWebVitals(req.siteId, dateRange)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching web vitals:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

router.get('/:siteId/performance/web-vitals-overview', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('web-vitals-overview', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.GENERAL, () =>
            queries.getWebVitalsOverview(req.siteId, dateRange)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching web vitals overview:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

router.get('/:siteId/performance/errors', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const cacheKey = analyticsCache.key('js-errors', req.siteId, dateRange);
        const data = await cachedQuery(cacheKey, CACHE_TTL.KPI, () =>
            queries.getJSErrors(req.siteId, dateRange)
        );
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching JS errors:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

router.get('/:siteId/performance/errors-over-time', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getJSErrorsOverTime(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching JS errors over time:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// ─── Annotations Endpoint (read from DuckDB) ────────────────────

router.get('/:siteId/annotations', validateSiteId, async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const data = await queries.getAnnotations(req.siteId, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching annotations:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

// GET /api/analytics/:siteId/utm-link-stats?source=&medium=&campaign=&dateRange=all
router.get('/:siteId/utm-link-stats', validateSiteId, async (req, res) => {
    try {
        const { source = '', medium = '', campaign = '', dateRange = 'all' } = req.query;
        const data = await queries.getUTMLinkStats(req.siteId, source, medium, campaign, dateRange);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching UTM link stats:', error);
        res.status(500).json({ success: false, error: safeError(error) });
    }
});

export default router;
