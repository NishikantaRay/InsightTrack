#!/usr/bin/env node
/**
 * InsightTrack MCP server.
 *
 * A thin, dependency-light bridge that exposes InsightTrack's analytics tools to
 * any MCP client (Claude Desktop, Cursor, …). It does NOT touch the database
 * directly — it proxies every tool call to the running InsightTrack API over
 * HTTP, authenticating with the user's connect token. This keeps per-user site
 * scoping and the single-writer DuckDB lock intact (only the API process opens
 * the DB).
 *
 * Config (env, injected by the client from Settings → AI → Connect):
 *   INSIGHTTRACK_API_URL   e.g. https://analytics.example.com
 *   INSIGHTTRACK_TOKEN     a connect token from POST /api/mcp/connect
 *
 * Transport: stdio (the default for local MCP clients).
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_URL = (process.env.INSIGHTTRACK_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const TOKEN = process.env.INSIGHTTRACK_TOKEN || '';

if (!TOKEN) {
    console.error('[insighttrack-mcp] Missing INSIGHTTRACK_TOKEN. Generate one in InsightTrack → Settings → AI Analyst → Connect a client.');
    process.exit(1);
}

async function api(path, options = {}) {
    const resp = await fetch(`${API_URL}/api${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TOKEN}`,
            ...(options.headers || {}),
        },
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.success === false) {
        throw new Error(json.error || `API ${path} failed (${resp.status})`);
    }
    return json.data ?? json;
}

// Fetch the user's sites so we can default/scope tool calls and describe options.
async function fetchSites() {
    try {
        const data = await api('/sites');
        const list = Array.isArray(data) ? data : data.sites || [];
        return list.map((s) => ({ id: s.id, name: s.name, domain: s.domain }));
    } catch {
        return [];
    }
}

// Fetch the tool catalogue (single source of truth lives in the API registry).
async function fetchCatalogue() {
    const data = await api('/mcp/tools');
    return data.tools || [];
}

// Bound what we hand the client so a wide range can't blow the context budget
// (N7 — mirrors the API-side cap in registry.js; env-overridable there).
const MAX_ROWS = parseInt(process.env.MCP_TOOL_MAX_ROWS) || 100;
function capData(data) {
    if (Array.isArray(data) && data.length > MAX_ROWS) {
        return { data: data.slice(0, MAX_ROWS), note: `Showing the first ${MAX_ROWS} of ${data.length} rows.` };
    }
    return { data, note: null };
}

// MCP clients read text; `structuredContent` gives richer clients the raw data
// to render natively (N2). Both views are size-capped (N7).
function renderEnvelope(envelope) {
    const summary = envelope.summary || 'Done.';
    const { data, note } = capData(envelope.data ?? null);
    const heading = note ? `${summary} (${note})` : summary;
    const dataStr = JSON.stringify(data, null, 2);
    return {
        content: [{ type: 'text', text: `${heading}\n\n\`\`\`json\n${dataStr}\n\`\`\`` }],
        structuredContent: { summary, data, note: note || undefined },
    };
}

async function main() {
    const [catalogue, initialSites] = await Promise.all([fetchCatalogue(), fetchSites()]);

    // Sites can change while the client is connected. Cache them, but re-fetch
    // lazily when a call references an unknown siteId (P2.4 — MCP freshness), so
    // a newly-created site works without restarting the MCP client.
    let sites = initialSites;
    let siteIds = new Set(sites.map((s) => s.id));
    async function refreshSites() {
        sites = await fetchSites();
        siteIds = new Set(sites.map((s) => s.id));
        return sites;
    }
    const defaultSite = () => sites[0]?.id;
    const siteHint = sites.length
        ? `Site to query. One of: ${sites.map((s) => `${s.id} (${s.domain})`).join(', ')}.${sites[0] ? ` Defaults to ${sites[0].id}.` : ''}`
        : 'Site id to query.';

    // Wrap each registry tool: inject a required `siteId` into its input schema —
    // EXCEPT siteless tools (e.g. list_sites), which operate on the whole account.
    const siteless = new Set(catalogue.filter((t) => t.siteless).map((t) => t.name));
    const tools = catalogue.map((t) => {
        if (t.siteless) {
            return { name: t.name, description: t.description, inputSchema: t.inputSchema };
        }
        const props = { ...(t.inputSchema?.properties || {}) };
        props.siteId = { type: 'string', description: siteHint, ...(sites.length ? { enum: sites.map((s) => s.id) } : {}) };
        return {
            name: t.name,
            description: t.description,
            inputSchema: {
                type: 'object',
                properties: props,
                // siteId only required if we couldn't determine a default.
                required: defaultSite() ? (t.inputSchema?.required || []) : ['siteId', ...(t.inputSchema?.required || [])],
            },
        };
    });
    const toolNames = new Set(tools.map((t) => t.name));

    const server = new Server(
        { name: 'insighttrack', version: '0.1.0' },
        { capabilities: { tools: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const { name, arguments: args = {} } = req.params;
        if (!toolNames.has(name)) {
            return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
        }
        try {
            // Siteless tools (list_sites) — proxy straight through, no siteId.
            if (siteless.has(name)) {
                const envelope = await api('/mcp/run', {
                    method: 'POST', body: JSON.stringify({ name, args }),
                });
                return renderEnvelope(envelope);
            }

            let { siteId = defaultSite(), ...toolArgs } = args;
            // Lazily refresh sites if the client named one we haven't seen — this
            // is how a site created after connect becomes usable without restart.
            if (siteId && !siteIds.has(siteId)) await refreshSites();
            if (!siteId) siteId = defaultSite();
            if (!siteId) {
                return {
                    content: [{ type: 'text', text: 'No site available. Call list_sites first, then pass a "siteId".' }],
                    isError: true,
                };
            }
            const envelope = await api('/mcp/run', {
                method: 'POST',
                body: JSON.stringify({ name, siteId, args: toolArgs }),
            });
            return renderEnvelope(envelope);
        } catch (e) {
            return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
        }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`[insighttrack-mcp] connected — ${tools.length} tools, ${sites.length} sites (API: ${API_URL})`);
}

main().catch((e) => {
    console.error('[insighttrack-mcp] fatal:', e.message);
    process.exit(1);
});
