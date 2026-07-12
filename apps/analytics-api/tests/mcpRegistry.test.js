import { describe, it, expect, vi } from 'vitest';

// Mock the DuckDB query layer so every tool runs against fixtures — these
// tests cover the registry contract (schemas, envelopes, scoping), not SQL.
vi.mock('../src/queries/queries.js', () => ({
    getKPISummary: vi.fn(async () => ({ totalVisitors: 100, totalPageviews: 500, bounceRate: 40, avgSessionDuration: '1m 5s' })),
    getTrafficOverTime: vi.fn(async () => [{ date: '2026-07-01', visitors: 10, sessions: 12 }]),
    getTopPages: vi.fn(async (_s, _r, limit) => Array.from({ length: Math.min(limit, 3) }, (_, i) => ({ page: `/p${i}`, views: 100 - i, visitors: 50 - i }))),
    getTrafficSources: vi.fn(async () => [{ source: 'direct', visitors: 60 }]),
    getDeviceBreakdown: vi.fn(async () => [{ device: 'desktop', visitors: 70 }]),
    getCountries: vi.fn(async () => [{ country: 'DE', visitors: 30 }]),
    getFunnelData: vi.fn(async () => [{ step: 'visit', count: 100 }]),
    getRealTimeVisitors: vi.fn(async () => ({ activeVisitors: 5, activePages: [] })),
    getUTMCampaigns: vi.fn(async () => [{ source: 'google', medium: 'cpc', campaign: 'launch', visitors: 9 }]),
    getEngagementSummary: vi.fn(async () => ({ scrollDepth: [], rageClicks: 0 })),
    getComparisonTraffic: vi.fn(async () => ({ current: [], previous: [] })),
    getGoalConversions: vi.fn(async () => [{ goalId: 1, goalName: 'Signup', type: 'page_visit', conversions: 12, conversionRate: 4.2 }]),
    getUserFlow: vi.fn(async () => ({ transitions: [{ from: '/', to: '/pricing', count: 5 }], entryPages: [{ page: '/', count: 8 }], exitPages: [{ page: '/pricing', count: 3 }] })),
    getJSErrors: vi.fn(async () => [{ message: 'TypeError: x is undefined', page: '/', occurrences: 7, affectedUsers: 4 }]),
    getWebVitalsOverview: vi.fn(async () => ({ LCP: { avg: 2100, p75: 2500, samples: 50 } })),
    getPageActions: vi.fn(async (_s, _p, _r, limit) => Array.from({ length: Math.min(limit, 2) }, (_, i) => ({ text: `Btn ${i}`, selector: `#b${i}`, tag: 'button', clicks: 20 - i, uniqueUsers: 10 - i }))),
}));

// Sites service is mocked too, since list_sites reads getSitesForUser.
vi.mock('../src/services/teamService.js', () => ({
    getSitesForUser: vi.fn(async (userId) => [
        { id: 'site_a', name: 'Alpha', domain: 'alpha.com', user_role: 'owner' },
        { id: 'site_b', name: 'Beta', domain: 'beta.com', user_role: 'viewer' },
    ]),
    getMemberRole: vi.fn(async () => 'owner'),
    roleAtLeast: vi.fn(() => true),
}));

const { TOOLS, TOOL_MAP, toolCatalogue, runTool, SITELESS_TOOLS } = await import('../src/mcp/tools/registry.js');
const { specOperationIds } = await import('../src/mcp/openapi/insighttrack-spec.js');
const queries = await import('../src/queries/queries.js');
const team = await import('../src/services/teamService.js');

const CTX = { siteId: 'site_test_mcp', userId: 42 };

describe('MCP tool registry', () => {
    describe('catalogue contract', () => {
        it('exposes the expected read-only tools', () => {
            const names = TOOLS.map((t) => t.name);
            expect(names).toEqual([
                'get_kpi', 'get_traffic', 'get_top_pages', 'get_sources',
                'get_devices', 'get_countries', 'get_funnel', 'get_realtime',
                'get_acquisition_utm', 'get_engagement', 'compare_ranges',
                // P2.1 additions
                'list_sites', 'get_goals', 'get_user_flow', 'get_js_errors',
                'get_performance', 'get_page_detail',
            ]);
        });

        it('every tool has name, description, valid JSON schema, and run()', () => {
            for (const t of TOOLS) {
                expect(t.name).toMatch(/^[a-z_]+$/);
                expect(t.description.length).toBeGreaterThan(20);
                expect(t.inputSchema.type).toBe('object');
                expect(t.inputSchema.additionalProperties).toBe(false);
                expect(typeof t.run).toBe('function');
            }
        });

        // P1.4 — the OpenAPI spec (served at /api/openapi.json) and the tool
        // registry describe the same read-only surface. Keep them in lock-step:
        // exactly one operation per tool, operationId === tool name.
        it('the OpenAPI spec is in sync with the registry (no drift)', () => {
            const toolNames = TOOLS.map((t) => t.name).sort();
            const opIds = specOperationIds().sort();
            expect(opIds, 'insighttrack-spec.js operationIds must match the registry tool names one-for-one').toEqual(toolNames);
        });

        it('toolCatalogue() strips run() — safe to send to LLM providers', () => {
            for (const entry of toolCatalogue()) {
                // siteless tools carry an extra boolean flag; everything else is 3 keys.
                const keys = Object.keys(entry).sort();
                expect(keys).toEqual(
                    entry.siteless ? ['description', 'inputSchema', 'name', 'siteless']
                                   : ['description', 'inputSchema', 'name']
                );
                expect(entry.run).toBeUndefined();
            }
        });

        it('TOOL_MAP indexes every tool by name', () => {
            expect(Object.keys(TOOL_MAP).length).toBe(TOOLS.length);
        });
    });

    describe('runTool guardrails', () => {
        it('rejects unknown tool names with a 400-status error', async () => {
            await expect(runTool('drop_all_tables', {}, CTX)).rejects.toMatchObject({ status: 400 });
        });

        it('rejects calls without a siteId scope', async () => {
            await expect(runTool('get_kpi', {}, {})).rejects.toMatchObject({ status: 400 });
        });

        it('passes ctx.siteId through to the query — tools never widen scope', async () => {
            await runTool('get_kpi', {}, CTX);
            expect(queries.getKPISummary).toHaveBeenCalledWith(CTX.siteId, '30d');
        });
    });

    describe('siteless tools (list_sites)', () => {
        it('list_sites is flagged siteless and exported in SITELESS_TOOLS', () => {
            expect(TOOL_MAP.list_sites.siteless).toBe(true);
            expect(SITELESS_TOOLS.has('list_sites')).toBe(true);
        });

        it('runs on ctx.userId (no siteId needed) and scopes to that user', async () => {
            const env = await runTool('list_sites', {}, { userId: 42 });
            expect(team.getSitesForUser).toHaveBeenCalledWith(42);
            expect(env.data).toEqual([
                { id: 'site_a', name: 'Alpha', domain: 'alpha.com', role: 'owner' },
                { id: 'site_b', name: 'Beta', domain: 'beta.com', role: 'viewer' },
            ]);
            expect(env.summary).toContain('Alpha');
        });

        it('rejects a siteless tool called without ctx.userId', async () => {
            await expect(runTool('list_sites', {}, { siteId: 'site_a' }))
                .rejects.toMatchObject({ status: 400 });
        });

        it('site-scoped tools still require siteId even with a userId present', async () => {
            await expect(runTool('get_kpi', {}, { userId: 42 }))
                .rejects.toMatchObject({ status: 400 });
        });
    });

    describe('P2.1 new site-scoped tools', () => {
        it('get_page_detail passes the path argument through', async () => {
            await runTool('get_page_detail', { path: '/pricing', limit: 5 }, { siteId: 'site_pd' });
            expect(queries.getPageActions).toHaveBeenCalledWith('site_pd', '/pricing', '30d', 5);
        });

        it('get_page_detail defaults path to "/"', async () => {
            await runTool('get_page_detail', {}, { siteId: 'site_pd2' });
            expect(queries.getPageActions).toHaveBeenCalledWith('site_pd2', '/', '30d', 30);
        });

        it('get_goals surfaces the top goal in the summary', async () => {
            const env = await runTool('get_goals', {}, { siteId: 'site_g' });
            expect(env.summary).toContain('Signup');
            expect(env.summary).toContain('4.2%');
        });

        it('get_js_errors celebrates when there are none', async () => {
            queries.getJSErrors.mockResolvedValueOnce([]);
            const env = await runTool('get_js_errors', {}, { siteId: 'site_clean' });
            expect(env.summary).toContain('No JavaScript errors');
        });
    });

    describe('result envelopes', () => {
        it('every tool returns the full envelope shape', async () => {
            for (const t of TOOLS) {
                const ctx = { siteId: `site_env_${t.name}`, userId: 42 };
                const env = await t.run({ dateRange: '7d' }, ctx);
                expect(env, t.name).toHaveProperty('summary');
                expect(typeof env.summary).toBe('string');
                expect(env, t.name).toHaveProperty('data');
                expect(['chart', 'table', 'kpi', 'none']).toContain(env.render.type);
                expect(env, t.name).toHaveProperty('download');
                expect(env, t.name).toHaveProperty('deepLink');
            }
        });

        it('defaults dateRange to 30d', async () => {
            const env = await runTool('get_traffic', {}, { siteId: 'site_default_range' });
            expect(env.deepLink.to).toContain('dateRange=30d');
        });
    });

    describe('caching (P1.3)', () => {
        it('repeat calls with identical args hit the cache, not DuckDB', async () => {
            const ctx = { siteId: 'site_cache_check' };
            const before = queries.getTopPages.mock.calls.length;
            await runTool('get_top_pages', { dateRange: '90d', limit: 5 }, ctx);
            await runTool('get_top_pages', { dateRange: '90d', limit: 5 }, ctx);
            expect(queries.getTopPages.mock.calls.length).toBe(before + 1); // one real query
        });

        it('different args are different cache entries', async () => {
            const ctx = { siteId: 'site_cache_check2' };
            const before = queries.getCountries.mock.calls.length;
            await runTool('get_countries', { dateRange: '7d' }, ctx);
            await runTool('get_countries', { dateRange: '30d' }, ctx);
            expect(queries.getCountries.mock.calls.length).toBe(before + 2);
        });
    });
});
