import express from 'express';
import trackingService from '../services/trackingService.js';
import { geoipService } from '../services/geoipService.js';
import { analyticsCache } from '../services/cache.js';
import { runSync } from '../sync/sync.js';

const router = express.Router();

// Trigger a background DuckDB sync so dashboard reads reflect new writes
function triggerSync() {
    runSync({ silent: true }).catch(() => { });
}

// Invalidate cached analytics so the dashboard reflects new events immediately
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

// POST /api/track/event
router.post('/event', async (req, res) => {
    try {
        const eventData = req.body;

        // Get location from client IP if not provided
        if (!eventData.country || !eventData.city) {
            const geo = geoipService.getLocationFromRequest(req);
            if (geo.country) {
                eventData.country = eventData.country || geo.country;
                eventData.city = eventData.city || geo.city;
            }
        }

        const result = await trackingService.trackEvent(eventData);
        invalidateSiteCache(req.body.siteId);
        triggerSync();
        res.status(201).json(result);
    } catch (error) {
        console.error('Error tracking event:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/track/pageview
router.post('/pageview', async (req, res) => {
    try {
        const eventData = { ...req.body, type: 'pageview' };

        // Get location from client IP if not provided
        if (!eventData.country || !eventData.city) {
            const geo = geoipService.getLocationFromRequest(req);
            if (geo.country) {
                eventData.country = eventData.country || geo.country;
                eventData.city = eventData.city || geo.city;
            }
        }

        const result = await trackingService.trackEvent(eventData);
        invalidateSiteCache(req.body.siteId);
        triggerSync();
        res.status(201).json(result);
    } catch (error) {
        console.error('Error tracking pageview:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/track/session
router.post('/session', async (req, res) => {
    try {
        const sessionData = req.body;

        // Get location from client IP if not provided
        if (!sessionData.country) {
            const geo = geoipService.getLocationFromRequest(req);
            if (geo.country) {
                sessionData.country = sessionData.country || geo.country;
                sessionData.city = sessionData.city || geo.city;
            }
        }

        const result = await trackingService.upsertSession(sessionData);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error updating session:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/track/session/end
router.post('/session/end', async (req, res) => {
    try {
        const { sessionId, duration } = req.body;
        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
        }
        const result = await trackingService.endSession(sessionId, duration || 0);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error ending session:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/track/batch
router.post('/batch', async (req, res) => {
    try {
        const { events } = req.body;
        if (!Array.isArray(events) || events.length === 0) {
            return res.status(400).json({ error: 'events array is required' });
        }

        // Enrich events with GeoIP data if not provided
        const geo = geoipService.getLocationFromRequest(req);
        const enrichedEvents = events.map(event => ({
            ...event,
            country: event.country || geo.country,
            city: event.city || geo.city,
        }));

        const result = await trackingService.trackBatch(enrichedEvents);
        // Invalidate cache for all unique site IDs in the batch
        const siteIds = [...new Set(events.map(e => e.siteId).filter(Boolean))];
        siteIds.forEach(invalidateSiteCache);
        triggerSync();
        res.status(201).json(result);
    } catch (error) {
        console.error('Error tracking batch:', error);
        res.status(400).json({ error: error.message });
    }
});

// GET /api/track/pixel.gif
router.get('/pixel.gif', async (req, res) => {
    try {
        const { siteId, userId, event = 'impression' } = req.query;

        if (siteId && userId) {
            trackingService.trackEvent({
                siteId, userId, type: event,
                referrer: req.get('Referer'),
                props: { method: 'pixel' },
            }).catch(err => console.error('Pixel tracking error:', err));
        }

        const pixel = Buffer.from(
            'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
            'base64'
        );
        res.set('Content-Type', 'image/gif');
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.send(pixel);
    } catch (error) {
        console.error('Pixel tracking error:', error);
        res.status(200).send();
    }
});

// POST /api/track/
router.post('/', async (req, res) => {
    try {
        const eventData = req.body;

        // Get location from client IP if not provided
        if (!eventData.country || !eventData.city) {
            const geo = geoipService.getLocationFromRequest(req);
            if (geo.country) {
                eventData.country = eventData.country || geo.country;
                eventData.city = eventData.city || geo.city;
            }
        }

        const result = await trackingService.trackEvent(eventData);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error tracking:', error);
        res.status(400).json({ error: error.message });
    }
});

export default router;
