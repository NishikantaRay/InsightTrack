/**
 * MCP / AI-Analyst Tool Registry — the single source of truth for the tools the
 * AI can call. Used by BOTH the in-dashboard assistant service and the external
 * MCP server, so a tool is written once and works in both surfaces.
 *
 * Each tool:
 *   {
 *     name,               // stable snake_case id the model calls
 *     description,        // the model's instruction manual — write it well
 *     inputSchema,        // JSON Schema for the arguments
 *     run(args, ctx)      // executes it and returns a RESULT ENVELOPE
 *   }
 *
 * ctx = { siteId, userId }  — the authorized site the call is scoped to, plus
 * the calling user's id. The caller (assistant service / MCP server) sets
 * ctx.siteId to a site the current user actually has access to; tools never
 * widen that scope. Tools flagged `siteless: true` (e.g. list_sites) operate on
 * ctx.userId instead of a single site and are exempt from the siteId check.
 *
 * RESULT ENVELOPE — structured output the chat panel knows how to render:
 *   {
 *     summary,                    // one-line natural-language summary (also fed back to the LLM)
 *     data,                       // raw rows/object (the model can reason over this)
 *     render: { type, chart?, columns? },   // "chart" | "table" | "kpi" | "none"
 *     download: { csv, filename } | null,   // offer a CSV/JSON download in the panel
 *     deepLink: { label, to } | null,       // one-click jump to the matching dashboard page
 *   }
 *
 * Tools are READ-ONLY and analytics-scoped. No writes, no cross-site access.
 */

import * as queries from '../../queries/queries.js';
import { getSitesForUser } from '../../services/teamService.js';
import { analyticsCache, CACHE_TTL } from '../../services/cache.js';

// ── shared bits ───────────────────────────────────────────────────────────────

// Coalesced cache wrapper. Keys/TTLs deliberately MATCH the REST routes in
// routes/analytics.js, so the AI Analyst and the dashboard share cache
// entries — a question the dashboard already answered is a cache hit, and a
// repeated question inside a chat never re-runs the same DuckDB query.
const cached = (key, ttl, fn) => analyticsCache.getOrFetch(key, ttl, fn);

const DATE_RANGE_ENUM = ['today', '7d', '30d', '90d'];
const dateRangeProp = {
    type: 'string',
    description:
        "Time window. One of 'today', '7d', '30d', '90d', or a custom range as 'custom:YYYY-MM-DD:YYYY-MM-DD'. Defaults to '30d'.",
};

/** Build a JSON Schema object with an optional dateRange + extra props. */
function schema(props = {}, required = []) {
    return {
        type: 'object',
        properties: { dateRange: dateRangeProp, ...props },
        required,
        additionalProperties: false,
    };
}

const dr = (a) => a?.dateRange || '30d';
const fmt = (n) => Number(n ?? 0).toLocaleString();
/** Map a dateRange to a dashboard querystring so deep-links carry the filter. */
const linkTo = (path, a) => ({ label: `Open ${path.replace('/', '') || 'Dashboard'}`, to: `${path}?dateRange=${dr(a)}` });

// ── Tool-result size guardrails (N7) ──────────────────────────────────────────────
// What's shown/downloaded in the dashboard is the FULL envelope. But the copy fed
// back to the LLM (assistant loop) and to MCP clients must be bounded, or a wide
// date range can blow the context window and cost. capToolData caps array length
// and total serialized size, appending a note so the model knows it's a sample.
const MAX_ROWS = parseInt(process.env.ASSISTANT_TOOL_MAX_ROWS) || 100;
const MAX_DATA_CHARS = parseInt(process.env.ASSISTANT_TOOL_MAX_CHARS) || 20_000;

export function capToolData(data) {
    if (data == null) return { data, note: null };

    let capped = data;
    let note = null;

    if (Array.isArray(data) && data.length > MAX_ROWS) {
        capped = data.slice(0, MAX_ROWS);
        note = `Showing the first ${MAX_ROWS} of ${data.length} rows.`;
    }

    // Hard size backstop (handles big non-array objects and wide rows too).
    let json = JSON.stringify(capped);
    if (json.length > MAX_DATA_CHARS) {
        if (Array.isArray(capped)) {
            // Halve the row count until it fits (or we're down to a few rows).
            let n = capped.length;
            while (n > 1 && JSON.stringify(capped.slice(0, n)).length > MAX_DATA_CHARS) {
                n = Math.floor(n / 2);
            }
            capped = capped.slice(0, n);
            const total = Array.isArray(data) ? data.length : n;
            note = `Showing the first ${n} of ${total} rows (truncated to fit the context budget).`;
        } else {
            capped = { _truncated: true };
            note = 'Result too large to include in full; ask a narrower question or download the CSV.';
        }
    }

    return { data: capped, note };
}

/**
 * Produce the LLM/MCP-facing view of an envelope: the same summary + a
 * size-capped copy of `data` (N7). The UI never uses this — it renders the full
 * envelope from the SSE 'tool' event / the download.
 */
export function envelopeForModel(envelope) {
    const { data, note } = capToolData(envelope.data);
    return {
        summary: note ? `${envelope.summary} (${note})` : envelope.summary,
        data,
    };
}

// ── the tools ─────────────────────────────────────────────────────────────────

export const TOOLS = [
    {
        name: 'get_kpi',
        description:
            'Get headline KPIs for a site over a time range: total visitors, pageviews, bounce rate, average session duration, plus trends vs. the previous period. Use for "how is my site doing" / overview questions.',
        inputSchema: schema(),
        async run(args, ctx) {
            const d = await cached(analyticsCache.key('kpi', ctx.siteId, dr(args)), CACHE_TTL.KPI,
                () => queries.getKPISummary(ctx.siteId, dr(args)));
            return {
                summary: `${fmt(d.totalVisitors)} visitors, ${fmt(d.totalPageviews)} pageviews, ${d.bounceRate ?? 0}% bounce, ${d.avgSessionDuration ?? '0s'} avg session (${dr(args)}).`,
                data: d,
                render: { type: 'kpi' },
                download: null,
                deepLink: { label: 'Open Dashboard', to: `/?dateRange=${dr(args)}` },
            };
        },
    },
    {
        name: 'get_traffic',
        description:
            'Get visitors and sessions over time (a time-series) for charting traffic trends. Use for "show my traffic", "is traffic up or down", trend questions.',
        inputSchema: schema(),
        async run(args, ctx) {
            const d = await cached(analyticsCache.key('traffic', ctx.siteId, dr(args)), CACHE_TTL.TRAFFIC,
                () => queries.getTrafficOverTime(ctx.siteId, dr(args)));
            const rows = Array.isArray(d) ? d : d?.data ?? [];
            return {
                summary: `Traffic time-series with ${rows.length} data points (${dr(args)}).`,
                data: rows,
                render: { type: 'chart', chart: 'area' },
                download: { csv: true, filename: `traffic-${dr(args)}.csv` },
                deepLink: { label: 'Open Dashboard', to: `/?dateRange=${dr(args)}` },
            };
        },
    },
    {
        name: 'get_top_pages',
        description:
            'Get the most-visited pages (URL, views, unique visitors, % of total) for a time range. Use for "top pages", "most popular content", "which pages get traffic".',
        inputSchema: schema({ limit: { type: 'integer', minimum: 1, maximum: 50, description: 'How many pages (default 10).' } }),
        async run(args, ctx) {
            const rows = await cached(analyticsCache.key('top-pages', ctx.siteId, dr(args), args?.limit ?? 10), CACHE_TTL.PAGES,
                () => queries.getTopPages(ctx.siteId, dr(args), args?.limit ?? 10));
            const top = rows?.[0];
            return {
                summary: top ? `Top page was ${top.page ?? top.path} with ${fmt(top.views ?? top.pageviews)} views (${dr(args)}).` : 'No page data.',
                data: rows,
                render: { type: 'table', columns: ['page', 'views', 'visitors'] },
                download: { csv: true, filename: `top-pages-${dr(args)}.csv` },
                deepLink: linkTo('/pages', args),
            };
        },
    },
    {
        name: 'get_sources',
        description:
            'Get the traffic source breakdown (direct, search, social, referral, email…) for a time range. Use for "where does my traffic come from", "traffic channels".',
        inputSchema: schema(),
        async run(args, ctx) {
            const d = await cached(analyticsCache.key('sources', ctx.siteId, dr(args)), CACHE_TTL.GENERAL,
                () => queries.getTrafficSources(ctx.siteId, dr(args)));
            return {
                summary: `Traffic source breakdown (${dr(args)}).`,
                data: d,
                render: { type: 'chart', chart: 'donut' },
                download: { csv: true, filename: `sources-${dr(args)}.csv` },
                deepLink: linkTo('/acquisition', args),
            };
        },
    },
    {
        name: 'get_devices',
        description:
            'Get the device-type breakdown (desktop / mobile / tablet) for a time range. Use for "what devices do visitors use".',
        inputSchema: schema(),
        async run(args, ctx) {
            const d = await cached(analyticsCache.key('devices', ctx.siteId, dr(args)), CACHE_TTL.GENERAL,
                () => queries.getDeviceBreakdown(ctx.siteId, dr(args)));
            return {
                summary: `Device breakdown (${dr(args)}).`,
                data: d,
                render: { type: 'chart', chart: 'donut' },
                download: { csv: true, filename: `devices-${dr(args)}.csv` },
                deepLink: linkTo('/audience', args),
            };
        },
    },
    {
        name: 'get_countries',
        description:
            'Get the top countries by visitors for a time range. Use for "where are my visitors from", geography questions.',
        inputSchema: schema({ limit: { type: 'integer', minimum: 1, maximum: 50, description: 'How many countries (default 10).' } }),
        async run(args, ctx) {
            const rows = await cached(analyticsCache.key('countries', ctx.siteId, dr(args), args?.limit ?? 10), CACHE_TTL.GENERAL,
                () => queries.getCountries(ctx.siteId, dr(args), args?.limit ?? 10));
            const top = rows?.[0];
            return {
                summary: top ? `Top country was ${top.country} (${dr(args)}).` : 'No country data.',
                data: rows,
                render: { type: 'table', columns: ['country', 'visitors'] },
                download: { csv: true, filename: `countries-${dr(args)}.csv` },
                deepLink: linkTo('/audience', args),
            };
        },
    },
    {
        name: 'get_funnel',
        description:
            'Get the conversion funnel with per-step drop-off for a time range. Use for "conversion rate", "where are users dropping off", funnel questions.',
        inputSchema: schema(),
        async run(args, ctx) {
            const d = await cached(analyticsCache.key('funnel', ctx.siteId, dr(args), 'default'), CACHE_TTL.TRAFFIC,
                () => queries.getFunnelData(ctx.siteId, dr(args)));
            return {
                summary: `Conversion funnel (${dr(args)}).`,
                data: d,
                render: { type: 'chart', chart: 'funnel' },
                download: { csv: true, filename: `funnel-${dr(args)}.csv` },
                deepLink: linkTo('/funnels', args),
            };
        },
    },
    {
        name: 'get_realtime',
        description:
            'Get live/real-time visitors right now: active visitor count and active pages. Use for "who is on my site now", "live visitors".',
        inputSchema: schema(),
        async run(_args, ctx) {
            const d = await cached(analyticsCache.key('realtime', ctx.siteId), CACHE_TTL.REALTIME,
                () => queries.getRealTimeVisitors(ctx.siteId));
            return {
                summary: `${fmt(d.activeVisitors ?? 0)} active visitors right now.`,
                data: d,
                render: { type: 'kpi' },
                download: null,
                deepLink: { label: 'Open Realtime', to: '/realtime' },
            };
        },
    },
    {
        name: 'get_acquisition_utm',
        description:
            'Get UTM campaign performance (source/medium/campaign with visitors and pageviews) for a time range. Use for "how are my campaigns doing", UTM / ad questions.',
        inputSchema: schema(),
        async run(args, ctx) {
            const rows = await cached(analyticsCache.key('utm', ctx.siteId, dr(args)), CACHE_TTL.GENERAL,
                () => queries.getUTMCampaigns(ctx.siteId, dr(args)));
            return {
                summary: `UTM campaign performance (${dr(args)}).`,
                data: rows,
                render: { type: 'table', columns: ['source', 'medium', 'campaign', 'visitors'] },
                download: { csv: true, filename: `utm-${dr(args)}.csv` },
                deepLink: linkTo('/acquisition', args),
            };
        },
    },
    {
        name: 'get_engagement',
        description:
            'Get engagement metrics for a time range: scroll depth milestones, rage clicks, and time-on-page. Use for "how engaged are visitors", "are people reading my content".',
        inputSchema: schema(),
        async run(args, ctx) {
            const d = await cached(analyticsCache.key('engagement', ctx.siteId, dr(args)), CACHE_TTL.GENERAL,
                () => queries.getEngagementSummary(ctx.siteId, dr(args)));
            return {
                summary: `Engagement summary (${dr(args)}).`,
                data: d,
                render: { type: 'table' },
                download: { csv: true, filename: `engagement-${dr(args)}.csv` },
                deepLink: linkTo('/engagement', args),
            };
        },
    },
    {
        name: 'compare_ranges',
        description:
            'Compare traffic in the current period vs. the previous period of the same length. Use for "how does this week compare to last week", period-over-period questions.',
        inputSchema: schema(),
        async run(args, ctx) {
            const d = await cached(analyticsCache.key('comparison', ctx.siteId, dr(args)), CACHE_TTL.TRAFFIC,
                () => queries.getComparisonTraffic(ctx.siteId, dr(args)));
            return {
                summary: `Period-over-period comparison (${dr(args)}).`,
                data: d,
                render: { type: 'chart', chart: 'line' },
                download: { csv: true, filename: `comparison-${dr(args)}.csv` },
                deepLink: { label: 'Open Dashboard', to: `/?dateRange=${dr(args)}&compare=1` },
            };
        },
    },
    {
        name: 'list_sites',
        description:
            "List the websites this user has access to (id, name, domain, their role). Site-independent — call it FIRST when the user asks about a specific site by name, to resolve which siteId to query, or for \"which sites do I have\", \"all my sites\" questions.",
        siteless: true,             // operates on ctx.userId, not a single siteId
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        async run(_args, ctx) {
            const rows = await getSitesForUser(ctx.userId);
            const sites = rows.map((s) => ({ id: s.id, name: s.name, domain: s.domain, role: s.user_role }));
            return {
                summary: sites.length
                    ? `${sites.length} site${sites.length === 1 ? '' : 's'}: ${sites.map((s) => `${s.name} (${s.domain})`).join(', ')}.`
                    : 'No sites yet.',
                data: sites,
                render: { type: 'table', columns: ['name', 'domain', 'role'] },
                download: null,
                deepLink: { label: 'Open Settings', to: '/settings' },
            };
        },
    },
    {
        name: 'get_goals',
        description:
            'Get conversion goals and their performance (conversions, conversion rate vs. total visitors) for a time range. Use for "goals", "conversions", "conversion rate", "how are my goals doing".',
        inputSchema: schema(),
        async run(args, ctx) {
            const rows = await cached(analyticsCache.key('goals', ctx.siteId, dr(args)), CACHE_TTL.GENERAL,
                () => queries.getGoalConversions(ctx.siteId, dr(args)));
            const top = rows?.[0];
            return {
                summary: top
                    ? `${rows.length} goal${rows.length === 1 ? '' : 's'}; top: "${top.goalName}" at ${top.conversionRate}% (${fmt(top.conversions)} conversions, ${dr(args)}).`
                    : `No goals configured (${dr(args)}).`,
                data: rows,
                render: { type: 'table', columns: ['goalName', 'conversions', 'conversionRate'] },
                download: { csv: true, filename: `goals-${dr(args)}.csv` },
                deepLink: linkTo('/conversions', args),
            };
        },
    },
    {
        name: 'get_user_flow',
        description:
            'Get how visitors navigate the site: page-to-page transitions, top entry pages, and top exit pages for a time range. Use for "user flow", "navigation paths", "where do visitors go / drop off", "entry and exit pages".',
        inputSchema: schema(),
        async run(args, ctx) {
            const d = await cached(analyticsCache.key('user-flow', ctx.siteId, dr(args)), CACHE_TTL.GENERAL,
                () => queries.getUserFlow(ctx.siteId, dr(args)));
            return {
                summary: `User flow: ${d.transitions?.length ?? 0} transitions, ${d.entryPages?.length ?? 0} entry pages, ${d.exitPages?.length ?? 0} exit pages (${dr(args)}).`,
                data: d,
                render: { type: 'chart', chart: 'sankey' },
                download: { csv: true, filename: `user-flow-${dr(args)}.csv` },
                deepLink: linkTo('/user-flow', args),
            };
        },
    },
    {
        name: 'get_js_errors',
        description:
            'Get JavaScript errors captured on the site (message, source file, page, occurrences, affected users) for a time range. Use for "errors", "js errors", "what is breaking", "are there any errors".',
        inputSchema: schema({ limit: { type: 'integer', minimum: 1, maximum: 100, description: 'How many errors (default 30).' } }),
        async run(args, ctx) {
            const rows = await cached(analyticsCache.key('js-errors', ctx.siteId, dr(args), args?.limit ?? 30), CACHE_TTL.GENERAL,
                () => queries.getJSErrors(ctx.siteId, dr(args), args?.limit ?? 30));
            const top = rows?.[0];
            return {
                summary: top
                    ? `${rows.length} error type${rows.length === 1 ? '' : 's'}; most frequent: "${String(top.message).slice(0, 80)}" (${fmt(top.occurrences)} occurrences, ${dr(args)}).`
                    : `No JavaScript errors captured (${dr(args)}). 🎉`,
                data: rows,
                render: { type: 'table', columns: ['message', 'page', 'occurrences', 'affectedUsers'] },
                download: { csv: true, filename: `js-errors-${dr(args)}.csv` },
                deepLink: linkTo('/performance', args),
            };
        },
    },
    {
        name: 'get_performance',
        description:
            'Get Core Web Vitals (LCP, CLS, INP, FCP, TTFB) with average and p75 values for a time range. Use for "performance", "web vitals", "how fast is my site", "LCP / CLS / page speed".',
        inputSchema: schema(),
        async run(args, ctx) {
            const d = await cached(analyticsCache.key('web-vitals', ctx.siteId, dr(args)), CACHE_TTL.GENERAL,
                () => queries.getWebVitalsOverview(ctx.siteId, dr(args)));
            // getWebVitalsOverview returns a { LCP:{avg,p75,samples}, ... } map.
            // Flatten it to rows so the table/CSV/chart render one metric per row
            // instead of one [object Object] cell per metric.
            const rows = Object.entries(d || {}).map(([metric, v]) => ({
                metric,
                avg: v?.avg ?? null,
                p75: v?.p75 ?? null,
                samples: v?.samples ?? null,
            }));
            const lcp = d?.LCP?.p75;
            return {
                summary: rows.length
                    ? `Web Vitals for ${rows.length} metric${rows.length === 1 ? '' : 's'}${lcp != null ? ` — LCP p75 ${Math.round(lcp)}ms` : ''} (${dr(args)}).`
                    : `No Web Vitals data yet (${dr(args)}).`,
                data: rows,
                render: { type: 'table', columns: ['metric', 'avg', 'p75', 'samples'] },
                download: { csv: true, filename: `web-vitals-${dr(args)}.csv` },
                deepLink: linkTo('/performance', args),
            };
        },
    },
    {
        name: 'get_page_detail',
        description:
            'Get click detail for ONE specific page path: which elements visitors click most (text, selector, clicks, unique users). Use for "what do visitors click on /pricing", "clicks on a page", page-level drilldowns. Requires a `path` (e.g. "/pricing").',
        inputSchema: schema({
            path: { type: 'string', description: 'The page path to inspect, e.g. "/pricing". Defaults to "/".' },
            limit: { type: 'integer', minimum: 1, maximum: 100, description: 'How many click targets (default 30).' },
        }),
        async run(args, ctx) {
            const path = args?.path || '/';
            const limit = args?.limit ?? 30;
            const rows = await cached(analyticsCache.key('page-actions', ctx.siteId, dr(args), path, limit), CACHE_TTL.GENERAL,
                () => queries.getPageActions(ctx.siteId, path, dr(args), limit));
            const top = rows?.[0];
            return {
                summary: top
                    ? `Top click on ${path}: "${top.text}" (${fmt(top.clicks)} clicks, ${dr(args)}).`
                    : `No click data for ${path} (${dr(args)}).`,
                data: rows,
                render: { type: 'table', columns: ['text', 'clicks', 'uniqueUsers'] },
                download: { csv: true, filename: `page-detail-${path.replace(/\W+/g, '-')}-${dr(args)}.csv` },
                deepLink: linkTo('/pages', args),
            };
        },
    },
    {
        name: 'get_error_summary',
        description:
            "Get a summary of the site's Sentry errors for a time range: unresolved issue count, regressions, total error events, users affected, and a severity breakdown. Use for \"how many errors\", \"is the site healthy\", \"any regressions\", \"what's breaking\" overview questions. Empty if the site hasn't connected Sentry.",
        inputSchema: schema(),
        async run(args, ctx) {
            const d = await cached(analyticsCache.key('sentry-summary', ctx.siteId, dr(args)), CACHE_TTL.GENERAL,
                () => queries.getSentrySummary(ctx.siteId, dr(args)));
            return {
                summary: `${fmt(d.unresolved)} unresolved issue${d.unresolved === 1 ? '' : 's'}` +
                    `${d.regressions ? `, ${fmt(d.regressions)} regressed` : ''}` +
                    `, ${fmt(d.totalEvents)} events, ${fmt(d.usersAffected)} users affected (${dr(args)}).`,
                data: d,
                render: { type: 'kpi' },
                download: null,
                deepLink: linkTo('/errors', args),
            };
        },
    },
    {
        name: 'get_error_issues',
        description:
            'Get the site\'s Sentry error issues for a time range: title, level, status, event count, users affected, whether it regressed, the release it was last seen in, and first/last seen. Use for "what errors do I have", "top errors", "recent crashes", "what broke after the last deploy". Empty if the site hasn\'t connected Sentry.',
        inputSchema: schema({ limit: { type: 'integer', minimum: 1, maximum: 100, description: 'How many issues (default 25).' } }),
        async run(args, ctx) {
            const limit = args?.limit ?? 25;
            const rows = await cached(analyticsCache.key('sentry-issues', ctx.siteId, dr(args), limit), CACHE_TTL.GENERAL,
                () => queries.getSentryIssues(ctx.siteId, dr(args), limit));
            const top = rows?.[0];
            return {
                summary: top
                    ? `${fmt(rows.length)} issue${rows.length === 1 ? '' : 's'}; top: "${top.title}" (${fmt(top.count)} events${top.isRegression ? ', regressed' : ''}, ${dr(args)}).`
                    : `No Sentry issues in this period (${dr(args)}).`,
                data: rows,
                render: { type: 'table', columns: ['title', 'level', 'count', 'userCount'] },
                download: { csv: true, filename: `sentry-issues-${dr(args)}.csv` },
                deepLink: linkTo('/errors', args),
            };
        },
    },
];

/** Map of name → tool for O(1) lookup. */
export const TOOL_MAP = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

/**
 * The tool catalogue in a provider-neutral shape (name/description/inputSchema).
 * Both Anthropic and OpenAI tool formats derive trivially from this.
 */
export function toolCatalogue() {
    return TOOLS.map(({ name, description, inputSchema, siteless }) =>
        siteless ? { name, description, inputSchema, siteless: true }
                 : { name, description, inputSchema });
}

/** Tools that operate on the user, not a single site (skip the siteId check). */
export const SITELESS_TOOLS = new Set(TOOLS.filter((t) => t.siteless).map((t) => t.name));

/**
 * Execute a tool by name. Throws if unknown. Site-scoped tools require
 * `ctx.siteId` (a site the current user is authorized for — the caller
 * enforces that); siteless tools (e.g. list_sites) require `ctx.userId`.
 */
export async function runTool(name, args = {}, ctx = {}) {
    const tool = TOOL_MAP[name];
    if (!tool) throw Object.assign(new Error(`Unknown tool: ${name}`), { status: 400 });
    if (tool.siteless) {
        if (!ctx.userId) throw Object.assign(new Error('ctx.userId is required'), { status: 400 });
    } else if (!ctx.siteId) {
        throw Object.assign(new Error('ctx.siteId is required'), { status: 400 });
    }
    return tool.run(args, ctx);
}
