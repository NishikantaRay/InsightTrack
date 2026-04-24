import express from 'express';
import trackingService from '../services/trackingService.js';
import { analyticsCache } from '../services/cache.js';

const router = express.Router();

// Invalidate all cached analytics for a site so the dashboard reflects new events immediately
function invalidateSiteCache(siteId) {
  if (siteId) {
    analyticsCache.invalidate(`kpi:${siteId}`);
    analyticsCache.invalidate(`traffic:${siteId}`);
    analyticsCache.invalidate(`pageviews:${siteId}`);
    analyticsCache.invalidate(`top-pages:${siteId}`);
    analyticsCache.invalidate(`sources:${siteId}`);
    analyticsCache.invalidate(`devices:${siteId}`);
    analyticsCache.invalidate(`countries:${siteId}`);
    analyticsCache.invalidate(`sessions:${siteId}`);
    analyticsCache.invalidate(`bounce:${siteId}`);
    analyticsCache.invalidate(`avg-session:${siteId}`);
    analyticsCache.invalidate(`realtime:${siteId}`);
    analyticsCache.invalidate(`event-stream:${siteId}`);
    analyticsCache.invalidate(`engagement:${siteId}`);
  }
}

// POST /api/track/event - Track a single event
router.post('/event', async (req, res) => {
  try {
    const result = await trackingService.trackEvent(req.body);
    invalidateSiteCache(req.body.siteId);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/track/pageview - Track a pageview (convenience endpoint)
router.post('/pageview', async (req, res) => {
  try {
    const result = await trackingService.trackEvent({
      ...req.body,
      type: 'pageview'
    });
    invalidateSiteCache(req.body.siteId);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error tracking pageview:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/track/session - Start or update a session
router.post('/session', async (req, res) => {
  try {
    const result = await trackingService.upsertSession(req.body);
    invalidateSiteCache(req.body.siteId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/track/session/end - End a session
router.post('/session/end', async (req, res) => {
  try {
    const { sessionId, duration, siteId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    const result = await trackingService.endSession(sessionId, duration || 0);
    invalidateSiteCache(siteId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/track/batch - Track multiple events at once
router.post('/batch', async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required' });
    }
    const result = await trackingService.trackBatch(events);
    // Invalidate cache for all unique siteIds in batch
    const siteIds = [...new Set(events.map(e => e.siteId).filter(Boolean))];
    siteIds.forEach(invalidateSiteCache);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error tracking batch:', error);
    res.status(400).json({ error: error.message });
  }
});

// Pixel tracking (for email opens, etc.)
router.get('/pixel.gif', async (req, res) => {
  try {
    const { siteId, userId, event = 'impression' } = req.query;

    if (siteId && userId) {
      // Track async but don't wait for it
      trackingService.trackEvent({
        siteId,
        userId,
        type: event,
        referrer: req.get('Referer'),
        props: { method: 'pixel' }
      }).catch(err => console.error('Pixel tracking error:', err));
    }

    // Return 1x1 transparent GIF
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.send(pixel);
  } catch (error) {
    console.error('Pixel tracking error:', error);
    res.status(200).send(); // Still return 200 for pixel tracking
  }
});

// Simple track endpoint (used by tracking script)
router.post('/', async (req, res) => {
  try {
    const result = await trackingService.trackEvent(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error tracking:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
