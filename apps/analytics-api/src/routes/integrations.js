/**
 * Public integration webhooks (no auth — verified by per-integration HMAC).
 *
 * A provider (today: Sentry) can POST events here for near-real-time updates
 * instead of waiting for the periodic poll. Each request is authenticated by
 * verifying the provider's HMAC signature header against the matching
 * integration's stored secret (the adapter's handleWebhook). The poll remains
 * the reconciling backstop.
 *
 * Routing is provider-generic via the integration registry (P3.1): POST
 * /api/integrations/:provider/webhook dispatches to that provider's adapter, so
 * adding Rollbar/Bugsnag/Datadog is a new adapter, not a new route.
 *
 * This router uses its OWN json parser with a `verify` hook so it can capture
 * the raw body for signature verification — it must be mounted BEFORE the global
 * express.json() in index.js, which would otherwise consume the stream.
 */
import express from 'express';
import { getAdapter } from '../integrations/registry.js';
import { safeMsg } from '../utils/safeError.js';

const router = express.Router();

// Per-provider signature header. New providers add their header here.
const SIGNATURE_HEADER = {
    sentry: 'sentry-hook-signature',
};

// Capture the raw body (needed for HMAC) while still parsing JSON.
const rawJson = express.json({
    limit: '1mb',
    verify: (req, _res, buf) => { req.rawBody = buf?.toString('utf8') || ''; },
});

// POST /api/integrations/:provider/webhook  (e.g. /api/integrations/sentry/webhook)
router.post('/:provider/webhook', rawJson, async (req, res) => {
    const { provider } = req.params;
    try {
        const adapter = getAdapter(provider);           // 404 for unknown providers
        const signature = req.get(SIGNATURE_HEADER[provider] || 'x-hook-signature');
        const result = await adapter.handleWebhook(req.body, req.rawBody || '', signature);
        res.json({ success: true, data: result });
    } catch (error) {
        const status = error.status || 500;
        // Log only unexpected (5xx) errors; bad signature/payload/provider are 4xx.
        if (status >= 500) console.error(`Error handling ${provider} webhook:`, error);
        res.status(status).json({ success: false, error: safeMsg(error, status) });
    }
});

export default router;
