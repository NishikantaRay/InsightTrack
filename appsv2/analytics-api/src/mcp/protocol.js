/**
 * MCP JSON-RPC 2.0 protocol handler — the shared brain behind BOTH transports:
 *   • the stdio `mcp-server` bridge (Claude Desktop / Cursor, local Node), and
 *   • the remote Streamable-HTTP endpoint `POST /api/mcp/http` (N1) that lets
 *     Claude web/mobile/Desktop connect with just a URL + connect token.
 *
 * It implements the three methods a read-only analytics MCP server needs:
 *   initialize · tools/list · tools/call
 * plus the notifications (`notifications/initialized`) clients send, which get
 * an empty 202-style ack (null result, or no response for pure notifications).
 *
 * Tool exposure mirrors the stdio bridge exactly: site-scoped tools get a
 * `siteId` argument injected (required unless a default site exists); siteless
 * tools (e.g. list_sites) are passed through untouched. Every tools/call is
 * executed through the SAME `runTool` + site-authorization the assistant and
 * `/api/mcp/run` use, so tenant isolation is identical across every surface.
 */
import { toolCatalogue, runTool, capToolData } from './tools/registry.js';
import { getSitesForUser, getMemberRole } from '../services/teamService.js';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'insighttrack', version: '0.1.0' };

/** JSON-RPC error codes we use. */
const RPC = { PARSE: -32700, INVALID_REQUEST: -32600, METHOD_NOT_FOUND: -32601, INVALID_PARAMS: -32602, INTERNAL: -32603 };

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

/** Build the advertised tool list for a user, injecting siteId where needed. */
export async function buildToolList(userId) {
    const catalogue = toolCatalogue();
    const sites = await getSitesForUser(userId);
    const defaultSite = sites[0]?.id;
    const siteEnum = sites.length ? sites.map((s) => s.id) : undefined;
    const siteHint = sites.length
        ? `Site to query. One of: ${sites.map((s) => `${s.id} (${s.domain})`).join(', ')}.${defaultSite ? ` Defaults to ${defaultSite}.` : ''}`
        : 'Site id to query.';

    return catalogue.map((t) => {
        if (t.siteless) {
            return { name: t.name, description: t.description, inputSchema: t.inputSchema };
        }
        const props = { ...(t.inputSchema?.properties || {}) };
        props.siteId = { type: 'string', description: siteHint, ...(siteEnum ? { enum: siteEnum } : {}) };
        return {
            name: t.name,
            description: t.description,
            inputSchema: {
                type: 'object',
                properties: props,
                required: defaultSite ? (t.inputSchema?.required || []) : ['siteId', ...(t.inputSchema?.required || [])],
            },
        };
    });
}

const isSiteless = (name) => toolCatalogue().find((t) => t.name === name)?.siteless === true;

/**
 * Render a result envelope as an MCP tool-call result.
 *  - `content`: a human/text-model-readable block (summary + fenced JSON) — the
 *    universal fallback every MCP client understands.
 *  - `structuredContent` (N2): the raw, machine-readable data so rich clients can
 *    render tables/charts natively without re-parsing the code block.
 * Both views are size-capped (N7) so a wide range never blows the context budget.
 */
function renderEnvelope(envelope) {
    const summary = envelope.summary || 'Done.';
    const { data, note } = capToolData(envelope.data);
    const heading = note ? `${summary} (${note})` : summary;
    const dataStr = JSON.stringify(data ?? null, null, 2);
    return {
        content: [{ type: 'text', text: `${heading}\n\n\`\`\`json\n${dataStr}\n\`\`\`` }],
        structuredContent: { summary, data, note: note || undefined },
    };
}

/**
 * Handle one JSON-RPC message for a given authenticated user.
 * Returns the response object, or `null` for notifications (no reply expected).
 * @param {object} msg  parsed JSON-RPC request
 * @param {{ id:number|string, email?:string }} user  the authenticated caller
 */
export async function handleMcpMessage(msg, user) {
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
        return rpcError(msg?.id ?? null, RPC.INVALID_REQUEST, 'Invalid JSON-RPC request.');
    }
    const { id, method, params = {} } = msg;
    const isNotification = id === undefined || id === null;

    try {
        switch (method) {
            case 'initialize':
                return rpcResult(id, {
                    protocolVersion: PROTOCOL_VERSION,
                    capabilities: { tools: {} },
                    serverInfo: SERVER_INFO,
                });

            case 'notifications/initialized':
            case 'notifications/cancelled':
                return null; // notifications get no response

            case 'ping':
                return rpcResult(id, {});

            case 'tools/list':
                return rpcResult(id, { tools: await buildToolList(user.id) });

            case 'tools/call': {
                const name = params.name;
                const args = params.arguments || {};
                if (!name) return rpcError(id, RPC.INVALID_PARAMS, 'Missing tool name.');

                try {
                    if (isSiteless(name)) {
                        const envelope = await runTool(name, args, { userId: user.id });
                        return rpcResult(id, renderEnvelope(envelope));
                    }
                    // Resolve/verify siteId, then run with the SAME auth as /run.
                    const sites = await getSitesForUser(user.id);
                    const siteId = args.siteId || sites[0]?.id;
                    if (!siteId) {
                        return rpcResult(id, { content: [{ type: 'text', text: 'No site available. Call list_sites first, then pass a "siteId".' }], isError: true });
                    }
                    const role = await getMemberRole(siteId, user.id);
                    if (!role) {
                        return rpcResult(id, { content: [{ type: 'text', text: `You do not have access to site ${siteId}.` }], isError: true });
                    }
                    const { siteId: _drop, ...toolArgs } = args;
                    const envelope = await runTool(name, toolArgs, { siteId, userId: user.id });
                    return rpcResult(id, renderEnvelope(envelope));
                } catch (e) {
                    // Tool-level failures are returned as isError content, not as a
                    // transport error, so the model can read and adapt.
                    return rpcResult(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
                }
            }

            default:
                return isNotification ? null : rpcError(id, RPC.METHOD_NOT_FOUND, `Unknown method: ${method}`);
        }
    } catch (e) {
        if (isNotification) return null;
        return rpcError(id, RPC.INTERNAL, e.message || 'Internal error');
    }
}
