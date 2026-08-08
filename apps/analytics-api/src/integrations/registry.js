/**
 * Integration registry — the extension seam for third-party error/monitoring
 * providers (P3.1).
 *
 * Today Sentry is the only provider. This registry establishes the contract so a
 * second provider (Rollbar / Bugsnag / Datadog) is a new *adapter* rather than a
 * new subsystem: register it here and the generic pieces (public webhook routing,
 * the poll loop's provider list) pick it up.
 *
 * An adapter is a thin object describing the provider-specific surface. The
 * provider-agnostic machinery (encrypted credential storage in
 * `site_integrations`, upsert/dedup, poll orchestration, stale reconciliation,
 * adaptive cadence, HMAC webhook verification) lives in the provider service and
 * is reused per adapter.
 *
 * Adapter contract:
 *   {
 *     provider: string,                 // stable key stored in site_integrations.provider
 *     label: string,                    // human-readable name
 *     // Poll every enabled integration for this provider. Returns issues upserted.
 *     pollAll: ({ silent }) => Promise<number>,
 *     // Handle an inbound webhook: verify signature, upsert. Returns { handled, siteId }.
 *     handleWebhook: (payload, rawBody, signature) => Promise<{ handled, siteId }>,
 *   }
 *
 * Keep this file dependency-light and side-effect-free beyond registration so it
 * can be imported from routes and the server bootstrap without cycles.
 */
import sentryService from '../services/sentryService.js';

// The Sentry adapter delegates to the existing sentryService (unchanged) — the
// registry is a routing seam, not a rewrite.
const sentryAdapter = {
    provider: 'sentry',
    label: 'Sentry',
    pollAll: (opts) => sentryService.pollAllSentry(opts),
    handleWebhook: (payload, rawBody, signature) => sentryService.handleWebhook(payload, rawBody, signature),
};

const ADAPTERS = new Map([[sentryAdapter.provider, sentryAdapter]]);

/** Register (or override) an adapter. Called at module load by providers. */
export function registerAdapter(adapter) {
    if (!adapter?.provider) throw new Error('Integration adapter requires a provider key');
    ADAPTERS.set(adapter.provider, adapter);
    return adapter;
}

/** Look up an adapter by provider key, or throw a 404-status error. */
export function getAdapter(provider) {
    const adapter = ADAPTERS.get(String(provider));
    if (!adapter) {
        const e = new Error(`Unknown integration provider: ${provider}`);
        e.status = 404;
        throw e;
    }
    return adapter;
}

/** All registered adapters (e.g. for the poll loop to iterate providers). */
export function allAdapters() {
    return [...ADAPTERS.values()];
}

export default { registerAdapter, getAdapter, allAdapters };
