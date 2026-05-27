import express from 'express';
import analyticsService from '../services/analyticsService.js';
import { authMiddleware } from '../middleware/auth.js';
import { analyticsCache, CACHE_TTL } from '../services/cache.js';
import sitesService from '../services/sitesService.js';

const router = express.Router();

// Sanitize error for client
const safeError = (error) => {
  if (process.env.NODE_ENV === 'development') return error.message;
  return 'An internal error occurred';
};

// Cache-aware query helper
async function cachedQuery(cacheKey, ttl, queryFn) {
  const cached = analyticsCache.get(cacheKey);
  if (cached) return cached;
  const data = await queryFn();
  analyticsCache.set(cacheKey, data, ttl);
  return data;
}

// Middleware to validate siteId
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

// GET /api/analytics/:siteId/traffic - Traffic over time
router.get('/:siteId/traffic', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const cacheKey = analyticsCache.key('traffic', req.siteId, dateRange);
    const data = await cachedQuery(cacheKey, CACHE_TTL.TRAFFIC, () =>
      analyticsService.getTrafficOverTime(req.siteId, dateRange)
    );
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching traffic:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/bounce-rate-trend - Bounce rate over time
router.get('/:siteId/bounce-rate-trend', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const data = await analyticsService.getBounceRateOverTime(req.siteId, dateRange);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching bounce rate trend:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/avg-session-trend - Avg session duration over time
router.get('/:siteId/avg-session-trend', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const data = await analyticsService.getAvgSessionOverTime(req.siteId, dateRange);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching avg session trend:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/pageviews - Page views over time
router.get('/:siteId/pageviews', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const data = await analyticsService.getPageViewsOverTime(req.siteId, dateRange);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching pageviews:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/top-pages - Top pages
router.get('/:siteId/top-pages', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d', limit = 10 } = req.query;
    const data = await analyticsService.getTopPages(req.siteId, dateRange, parseInt(limit));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching top pages:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/sources - Traffic sources
router.get('/:siteId/sources', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const cacheKey = analyticsCache.key('sources', req.siteId, dateRange);
    const data = await cachedQuery(cacheKey, CACHE_TTL.GENERAL, () =>
      analyticsService.getTrafficSources(req.siteId, dateRange)
    );
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching sources:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/devices - Device breakdown
router.get('/:siteId/devices', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const data = await analyticsService.getDeviceBreakdown(req.siteId, dateRange);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/countries - Countries
router.get('/:siteId/countries', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d', limit = 10 } = req.query;
    const data = await analyticsService.getCountries(req.siteId, dateRange, parseInt(limit));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/cities - Traffic by city
router.get('/:siteId/cities', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d', limit = 10 } = req.query;
    const data = await analyticsService.getTrafficByCity(req.siteId, dateRange, parseInt(limit));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/geo-map - Geo coordinates for map visualization
router.get('/:siteId/geo-map', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const data = await analyticsService.getGeoMap(req.siteId, dateRange);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching geo map:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/sessions/geo - Sessions by city
router.get('/:siteId/sessions/geo', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d', limit = 10 } = req.query;
    const data = await analyticsService.getSessionsByCity(req.siteId, dateRange, parseInt(limit));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching sessions by city:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/sessions - Session duration
router.get('/:siteId/sessions', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const data = await analyticsService.getSessionDuration(req.siteId, dateRange);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/kpi - KPI Summary
router.get('/:siteId/kpi', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const cacheKey = analyticsCache.key('kpi', req.siteId, dateRange);
    const data = await cachedQuery(cacheKey, CACHE_TTL.KPI, () =>
      analyticsService.getKPISummary(req.siteId, dateRange)
    );
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching KPI:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/funnel - Funnel data
router.get('/:siteId/funnel', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const data = await analyticsService.getFunnelData(req.siteId, dateRange);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching funnel:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/realtime - Real-time visitors
router.get('/:siteId/realtime', validateSiteId, async (req, res) => {
  try {
    const cacheKey = analyticsCache.key('realtime', req.siteId);
    const data = await cachedQuery(cacheKey, CACHE_TTL.REALTIME, () =>
      analyticsService.getRealTimeVisitors(req.siteId)
    );
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching realtime:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/realtime/event-stream - Live event feed
router.get('/:siteId/realtime/event-stream', validateSiteId, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const cacheKey = analyticsCache.key('event-stream', req.siteId);
    const data = await cachedQuery(cacheKey, CACHE_TTL.REALTIME, () =>
      analyticsService.getRealtimeEventStream(req.siteId, limit)
    );
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching event stream:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/utm - UTM campaign analytics
router.get('/:siteId/utm', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const data = await analyticsService.getUTMCampaigns(req.siteId, dateRange);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching UTM data:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/comparison - Comparison mode traffic
router.get('/:siteId/comparison', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const cacheKey = analyticsCache.key('comparison', req.siteId, dateRange);
    const data = await cachedQuery(cacheKey, CACHE_TTL.TRAFFIC, () =>
      analyticsService.getComparisonTraffic(req.siteId, dateRange)
    );
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching comparison data:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/user-flow - User flow / path analysis
router.get('/:siteId/user-flow', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d', limit = 20 } = req.query;
    const data = await analyticsService.getUserFlow(req.siteId, dateRange, parseInt(limit));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching user flow:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/alerts - Traffic alerts
router.get('/:siteId/alerts', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const data = await analyticsService.getAlerts(req.siteId, dateRange);
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
      analyticsService.getEngagementSummary(req.siteId, dateRange)
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
    const data = await analyticsService.getScrollDepth(req.siteId, dateRange);
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
    const data = await analyticsService.getHeatmapData(req.siteId, dateRange, path);
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
    const data = await analyticsService.getHeatmapSummary(req.siteId, dateRange);
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
    const data = await analyticsService.getRageClicks(req.siteId, dateRange);
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
    const data = await analyticsService.getTimeOnPage(req.siteId, dateRange);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching time on page:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// GET /api/analytics/:siteId/all - All analytics data (for dashboard)
router.get('/:siteId/all', validateSiteId, async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;

    const [
      traffic,
      pageviews,
      topPages,
      sources,
      devices,
      countries,
      sessions,
      kpi,
      funnel,
      realtime
    ] = await Promise.all([
      analyticsService.getTrafficOverTime(req.siteId, dateRange),
      analyticsService.getPageViewsOverTime(req.siteId, dateRange),
      analyticsService.getTopPages(req.siteId, dateRange, 10),
      analyticsService.getTrafficSources(req.siteId, dateRange),
      analyticsService.getDeviceBreakdown(req.siteId, dateRange),
      analyticsService.getCountries(req.siteId, dateRange, 10),
      analyticsService.getSessionDuration(req.siteId, dateRange),
      analyticsService.getKPISummary(req.siteId, dateRange),
      analyticsService.getFunnelData(req.siteId, dateRange),
      analyticsService.getRealTimeVisitors(req.siteId)
    ]);

    res.json({
      success: true,
      data: {
        traffic,
        pageviews,
        topPages,
        sources,
        devices,
        countries,
        sessions,
        kpi,
        funnel,
        realtime
      }
    });
  } catch (error) {
    console.error('Error fetching all analytics:', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

export default router;
