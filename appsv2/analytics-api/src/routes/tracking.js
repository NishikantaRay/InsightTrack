import express from 'express';
import trackingService from '../services/trackingService.js';
import { geoipService } from '../services/geoipService.js';
import { analyticsCache } from '../services/cache.js';
import { runSync } from '../sync/sync.js';
import { sendError } from '../utils/safeError.js';

const router = express.Router();

// ── Debounced sync ─────────────────────────────────────────────────────────────
// Old behaviour: triggerSync() called on EVERY event → at 1K events/sec this
// means 1K concurrent sync attempts. The _syncRunning mutex prevented actual
// concurrent syncs but still hammered the lock check 1K times/sec.
//
// New behaviour: first event after the debounce window schedules a sync after
// SYNC_DEBOUNCE_MS. All subsequent events within that window are no-ops.
// After the sync fires, the debounce resets.

const SYNC_DEBOUNCE_MS = parseInt(process.env.SYNC_DEBOUNCE_MS) || 5_000;
let _syncTimer = null;
const _pendingSites = new Set();  // accumulate site IDs that need cache flush

function scheduleSyncDebounced(siteId) {
    if (siteId) _pendingSites.add(siteId);

    if (_syncTimer) return; // already scheduled — do nothing

    _syncTimer = setTimeout(async () => {
        _syncTimer = null;
        const sitesToFlush = new Set(_pendingSites);
        _pendingSites.clear();

        try {
            await runSync({ silent: true });
            // Only invalidate cache AFTER the sync succeeds so the new DuckDB
            // data is actually there when the next dashboard request arrives.
            for (const sid of sitesToFlush) invalidateSiteCache(sid);
        } catch (err) {
            // Sync failed: the new rows are NOT in DuckDB yet, so we must NOT
            // invalidate (that would just reload the same stale data). Re-queue
            // the sites and reschedule so the flush isn't lost — otherwise the
            // dashboard would serve stale cache until TTL with no retry.
            console.error('Debounced sync failed, will retry:', err?.message);
            for (const sid of sitesToFlush) _pendingSites.add(sid);
            // Reschedule a retry (guard against overlapping timers).
            if (!_syncTimer) {
                _syncTimer = setTimeout(() => {
                    _syncTimer = null;
                    scheduleSyncDebounced();
                }, SYNC_DEBOUNCE_MS);
            }
        }
    }, SYNC_DEBOUNCE_MS);
}

// ── Cache invalidation ─────────────────────────────────────────────────────────
// Called only after a successful sync (above), NOT on every tracking write.
// Invalidating the prefix `site_id:` covers all keys for that site.
function invalidateSiteCache(siteId) {
    if (!siteId) return;
    // The cache key format is `<metric>:<siteId>:...` — invalidate by site prefix
    // by hitting every known prefix for this site
    for (const prefix of [
        'kpi', 'traffic', 'pageviews', 'top-pages', 'sources',
        'devices', 'countries', 'sessions', 'bounce', 'avg-session',
        'realtime', 'event-stream', 'engagement', 'comparison',
        'user-flow', 'funnel', 'funnel-steps', 'heatmap', 'vitals',
        'errors', 'alerts', 'revenue', 'goals', 'cohorts',
    ]) {
        analyticsCache.invalidate(`${prefix}:${siteId}`);
    }
}

// ── Server-side privacy opt-out (defence in depth) ─────────────────────────────
// The generated tracking script exits before collecting anything when DNT/GPC is
// set (see sitesService.getRawTrackingScript). This is the server-side backstop
// for the cases the client guard cannot cover:
//   • a visitor still holding a CACHED copy of a pre-fix script (the script is
//     served with max-age=3600, so that window is real after a deploy),
//   • direct calls to /api/track/* that bypass the script entirely.
//
// Browsers attach these headers themselves — they are not custom headers, so no
// CORS allowlist entry is required:
//   DNT: 1        — Do Not Track
//   Sec-GPC: 1    — Global Privacy Control
//
// Only the explicit opt-out value counts. "0", absent, or any other value is NOT
// treated as opt-out, matching the client-side rule exactly.
//
// A request from an opted-out visitor is acknowledged normally (2xx) rather than
// rejected: the visitor's browser gets a clean response, nothing is persisted,
// and the caller learns nothing about the decision.
function isOptedOut(req) {
    return req.get('DNT') === '1' || req.get('Sec-GPC') === '1';
}

// Applied to every ingest route below. Returns the endpoint's normal-looking
// success shape so a stale client script behaves exactly as it would on success.
function honourOptOut(req, res, next) {
    if (!isOptedOut(req)) return next();
    res.status(200).json({ success: true, optedOut: true });
}

// ── Route helpers ──────────────────────────────────────────────────────────────

function enrichGeo(eventData, req) {
    if (!eventData.country || !eventData.city) {
        const geo = geoipService.getLocationFromRequest(req);
        if (geo.country) {
            eventData.country = eventData.country || geo.country;
            eventData.city    = eventData.city    || geo.city;
        }
    }
    return eventData;
}

// ── Routes ─────────────────────────────────────────────────────────────────────

// POST /api/track/event
router.post('/event', honourOptOut, async (req, res) => {
    try {
        const eventData = enrichGeo(req.body, req);
        const result = await trackingService.trackEvent(eventData);
        scheduleSyncDebounced(req.body.siteId);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error tracking event:', error);
        sendError(res, error, 400);
    }
});

// POST /api/track/pageview
router.post('/pageview', honourOptOut, async (req, res) => {
    try {
        const eventData = enrichGeo({ ...req.body, type: 'pageview' }, req);
        const result = await trackingService.trackEvent(eventData);
        scheduleSyncDebounced(req.body.siteId);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error tracking pageview:', error);
        sendError(res, error, 400);
    }
});

// POST /api/track/session
router.post('/session', honourOptOut, async (req, res) => {
    try {
        const sessionData = enrichGeo(req.body, req);
        const result = await trackingService.upsertSession(sessionData);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error updating session:', error);
        sendError(res, error, 400);
    }
});

// POST /api/track/session/end
router.post('/session/end', honourOptOut, async (req, res) => {
    try {
        const { sessionId, duration } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
        const result = await trackingService.endSession(sessionId, duration || 0);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error ending session:', error);
        sendError(res, error, 400);
    }
});

// POST /api/track/batch
router.post('/batch', honourOptOut, async (req, res) => {
    try {
        const { events } = req.body;
        if (!Array.isArray(events) || events.length === 0) {
            return res.status(400).json({ error: 'events array is required' });
        }
        const geo = geoipService.getLocationFromRequest(req);
        const enriched = events.map(e => ({
            ...e,
            country: e.country || geo.country,
            city:    e.city    || geo.city,
        }));
        const result = await trackingService.trackBatch(enriched);
        const siteIds = [...new Set(events.map(e => e.siteId).filter(Boolean))];
        siteIds.forEach(scheduleSyncDebounced);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error tracking batch:', error);
        sendError(res, error, 400);
    }
});

// GET /api/track/pixel.gif
router.get('/pixel.gif', async (req, res) => {
    try {
        const { siteId, userId, event = 'impression' } = req.query;
        // Honour DNT/GPC here too, but still return the GIF so the <img> renders
        // normally — the opt-out must not be visible as a broken image.
        if (siteId && userId && !isOptedOut(req)) {
            trackingService.trackEvent({
                siteId, userId, type: event,
                referrer: req.get('Referer'),
                props: { method: 'pixel' },
            }).catch(err => console.error('Pixel tracking error:', err));
        }
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.set('Content-Type', 'image/gif');
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.send(pixel);
    } catch (error) {
        console.error('Pixel tracking error:', error);
        res.status(200).send();
    }
});

// POST /api/track/  (catch-all alias)
router.post('/', honourOptOut, async (req, res) => {
    try {
        const eventData = enrichGeo(req.body, req);
        const result = await trackingService.trackEvent(eventData);
        scheduleSyncDebounced(req.body.siteId);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error tracking:', error);
        sendError(res, error, 400);
    }
});

export default router;
