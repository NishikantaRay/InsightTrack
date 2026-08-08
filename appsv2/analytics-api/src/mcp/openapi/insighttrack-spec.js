/**
 * OpenAPI 3.1 description of the InsightsTrack **readable** analytics API.
 *
 * Served at GET /api/openapi.json. Two uses:
 *  1. Public API documentation / client generation.
 *  2. Fed through the OpenAPI→MCP mapper so external tooling can auto-generate
 *     MCP tools for our API. (The in-app assistant uses the richer hand-written
 *     registry in ../tools/registry.js, which adds render/CSV/deep-link metadata.)
 *
 * Only read-only analytics endpoints are described here — the AI surface never
 * exposes writes.
 */

const dateRangeParam = {
    name: 'dateRange',
    in: 'query',
    required: false,
    description: "Time window: 'today' | '7d' | '30d' | '90d' | 'custom:YYYY-MM-DD:YYYY-MM-DD'. Default '30d'.",
    schema: { type: 'string', default: '30d' },
};
const siteIdParam = {
    name: 'siteId',
    in: 'path',
    required: true,
    description: 'The site id to query (must be a site the caller can access).',
    schema: { type: 'string' },
};
const limitParam = {
    name: 'limit',
    in: 'query',
    required: false,
    description: 'Max rows to return.',
    schema: { type: 'integer', default: 10 },
};
const pathParam = {
    name: 'path',
    in: 'query',
    required: false,
    description: 'A specific page path to inspect, e.g. "/pricing". Defaults to "/".',
    schema: { type: 'string', default: '/' },
};

const ok = {
    description: 'Success',
    content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: {} } } } },
};

// Site-scoped operation: siteId is a required path param.
function op(operationId, summary, { params = [] } = {}) {
    return {
        get: {
            operationId,
            summary,
            tags: ['analytics'],
            parameters: [siteIdParam, ...params],
            responses: { 200: ok },
        },
    };
}

// Account-scoped ("siteless") operation: no siteId — scoped to the caller.
function accountOp(operationId, summary, { params = [] } = {}) {
    return {
        get: { operationId, summary, tags: ['analytics'], parameters: params, responses: { 200: ok } },
    };
}

export const OPENAPI_SPEC = {
    openapi: '3.1.0',
    info: {
        title: 'InsightsTrack Analytics API (read-only)',
        version: '2.0.0',
        description: 'Privacy-first web analytics — read endpoints for dashboards and AI tools.',
    },
    servers: [{ url: '/api', description: 'Same-origin API root' }],
    // NOTE: keep in lock-step with src/mcp/tools/registry.js — every registry
    // tool has exactly one operation here, and its operationId is the tool name.
    // The sync test in tests/mcpRegistry.test.js fails if they drift (P1.4).
    paths: {
        // Account-scoped (siteless) — mirrors the `list_sites` registry tool.
        '/sites': accountOp('list_sites', 'List the websites the caller can access'),

        // Site-scoped analytics.
        '/analytics/{siteId}/kpi': op('get_kpi', 'Headline KPIs (visitors, pageviews, bounce, avg session) + trends', { params: [dateRangeParam] }),
        '/analytics/{siteId}/traffic': op('get_traffic', 'Visitors and sessions over time (time-series)', { params: [dateRangeParam] }),
        '/analytics/{siteId}/top-pages': op('get_top_pages', 'Most-visited pages', { params: [dateRangeParam, limitParam] }),
        '/analytics/{siteId}/sources': op('get_sources', 'Traffic source breakdown', { params: [dateRangeParam] }),
        '/analytics/{siteId}/devices': op('get_devices', 'Device-type breakdown', { params: [dateRangeParam] }),
        '/analytics/{siteId}/countries': op('get_countries', 'Top countries by visitors', { params: [dateRangeParam, limitParam] }),
        '/analytics/{siteId}/funnel': op('get_funnel', 'Conversion funnel with per-step drop-off', { params: [dateRangeParam] }),
        '/analytics/{siteId}/realtime': op('get_realtime', 'Live/real-time visitors right now'),
        '/analytics/{siteId}/utm': op('get_acquisition_utm', 'UTM campaign performance', { params: [dateRangeParam] }),
        '/analytics/{siteId}/engagement/summary': op('get_engagement', 'Engagement summary (scroll depth, rage clicks, time on page)', { params: [dateRangeParam] }),
        '/analytics/{siteId}/comparison': op('compare_ranges', 'Current vs. previous period comparison', { params: [dateRangeParam] }),
        '/analytics/{siteId}/goals': op('get_goals', 'Conversion goals and their performance', { params: [dateRangeParam] }),
        '/analytics/{siteId}/user-flow': op('get_user_flow', 'Visitor navigation: transitions, entry & exit pages', { params: [dateRangeParam] }),
        '/analytics/{siteId}/performance/errors': op('get_js_errors', 'JavaScript errors (message, source, occurrences, affected users)', { params: [dateRangeParam, limitParam] }),
        '/analytics/{siteId}/performance/web-vitals': op('get_performance', 'Core Web Vitals (LCP, CLS, INP, FCP, TTFB) — avg + p75', { params: [dateRangeParam] }),
        '/analytics/{siteId}/pages/detail': op('get_page_detail', 'Click detail for one page path (elements clicked most)', { params: [dateRangeParam, pathParam, limitParam] }),
        '/analytics/{siteId}/sentry/summary': op('get_error_summary', 'Sentry error summary (unresolved, regressions, events, users affected)', { params: [dateRangeParam] }),
        '/analytics/{siteId}/sentry/issues': op('get_error_issues', 'Sentry error issues (title, level, count, users, regression, release)', { params: [dateRangeParam, limitParam] }),
    },
};

/**
 * The set of operationIds in this spec, which by contract equals the set of
 * registry tool names. Exposed for the drift-check test.
 */
export function specOperationIds() {
    const ids = [];
    for (const methods of Object.values(OPENAPI_SPEC.paths)) {
        for (const opDef of Object.values(methods)) {
            if (opDef.operationId) ids.push(opDef.operationId);
        }
    }
    return ids;
}
