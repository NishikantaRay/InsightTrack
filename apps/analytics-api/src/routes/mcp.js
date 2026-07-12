import express from 'express';
import crypto from 'node:crypto';
import { authMiddleware } from '../middleware/auth.js';
import { safeMsg } from '../utils/safeError.js';
import {
    mapOpenApiToTools,
    signRequest,
    verifyRequest,
    ReplayGuard,
} from '../mcp/index.js';
import { toolCatalogue, TOOLS, runTool, SITELESS_TOOLS } from '../mcp/tools/registry.js';
import { handleMcpMessage } from '../mcp/protocol.js';
import { getMemberRole } from '../services/teamService.js';
import { query } from '../db/postgres.js';
import authService from '../services/authService.js';

const router = express.Router();

// All MCP toolkit routes require authentication.
router.use(authMiddleware);

// For MCP connect tokens (scope:'mcp'), also confirm the jti hasn't been revoked.
// Regular dashboard JWTs (no scope) pass straight through.
router.use(async (req, res, next) => {
    if (req.user?.scope !== 'mcp') return next();
    try {
        const r = await query(
            `SELECT revoked_at FROM mcp_connect_tokens WHERE jti = $1 AND user_id = $2`,
            [req.user.jti, req.user.id]
        );
        const row = r.rows[0];
        if (!row || row.revoked_at) {
            return res.status(401).json({ success: false, error: 'This MCP connection has been revoked.' });
        }
        // best-effort last-used stamp; don't block the request on it
        query(`UPDATE mcp_connect_tokens SET last_used_at = NOW() WHERE jti = $1`, [req.user.jti]).catch(() => {});
        next();
    } catch (e) {
        return res.status(500).json({ success: false, error: safeMsg(e) });
    }
});

// Process-wide replay guard for the /verify endpoint. In production this would
// be backed by Redis so it works across the fleet; the interface is identical.
const replayGuard = new ReplayGuard();

// ─── MCP Toolkit ───────────────────────────────────

// GET /api/mcp/tools
// Returns InsightsTrack's own AI-analyst tool catalogue (from the registry).
// This is what the assistant panel and MCP server advertise.
router.get('/tools', (req, res) => {
    res.json({ success: true, data: { tools: toolCatalogue(), count: TOOLS.length } });
});

// POST /api/mcp/run
// Body: { name, siteId, args }. Executes one registry tool, scoped to a site the
// caller can access, and returns the result envelope. This is the primitive the
// assistant service (Phase 3) and the MCP server use to actually run a tool.
router.post('/run', async (req, res) => {
    try {
        const { name, siteId, args = {} } = req.body || {};
        if (!name) {
            return res.status(400).json({ success: false, error: '"name" is required.' });
        }
        // Siteless tools (e.g. list_sites) scope to the user, not a single site.
        if (SITELESS_TOOLS.has(name)) {
            const result = await runTool(name, args, { userId: req.user.id });
            return res.json({ success: true, data: result });
        }
        if (!siteId) {
            return res.status(400).json({ success: false, error: 'Both "name" and "siteId" are required.' });
        }
        // Enforce per-user site access — the AI can only touch the caller's sites.
        const role = await getMemberRole(siteId, req.user.id);
        if (!role) {
            return res.status(403).json({ success: false, error: 'You do not have access to this site.' });
        }
        const result = await runTool(name, args, { siteId, userId: req.user.id });
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error running MCP tool:', error.message);
        res.status(error.status || 400).json({ success: false, error: safeMsg(error) });
    }
});

// ─── Remote MCP transport — Streamable HTTP (N1) ─────────────────────────────────
// A single authenticated endpoint speaking the MCP JSON-RPC 2.0 protocol, so an
// MCP client (Claude web/mobile/Desktop, Cursor) can connect with just a URL +
// a connect token — no local Node / npx install, and it sidesteps the
// stdio-bridge packaging entirely for hosted deployments.
//
// Auth + revocation are already enforced by the router-level middleware above
// (connect tokens carry scope:'mcp'; regular dashboard JWTs also work). The
// same tool authorization / site scoping as /api/mcp/run applies inside
// handleMcpMessage. Accepts a single JSON-RPC message or a batch array.
router.post('/http', async (req, res) => {
    try {
        const body = req.body;
        if (Array.isArray(body)) {
            const out = [];
            for (const msg of body) {
                const r = await handleMcpMessage(msg, req.user);
                if (r) out.push(r); // notifications produce no response
            }
            return res.json(out);
        }
        const result = await handleMcpMessage(body, req.user);
        if (!result) return res.status(202).end(); // pure notification
        return res.json(result);
    } catch (error) {
        console.error('MCP HTTP error:', error.message);
        // Transport-level failure → JSON-RPC error envelope.
        res.status(200).json({ jsonrpc: '2.0', id: req.body?.id ?? null, error: { code: -32603, message: safeMsg(error) } });
    }
});

// GET /api/mcp/http — some clients probe with GET to open an SSE channel. We
// don't push server-initiated events, so advertise that with 405 (per spec a
// server MAY reject GET). Clients fall back to POST-only, which we fully support.
router.get('/http', (req, res) => {
    res.status(405).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'This MCP endpoint is POST-only (no server-initiated stream).' } });
});

// ─── Toolkit demo endpoints (P1.2) ────────────────────────────────────────────────
// POST /tools (map an arbitrary OpenAPI doc → MCP tools), /sign, /verify are
// SHOWCASES of the mcp-toolkit-core engine, not product features: /tools accepts
// any caller-supplied spec, and the /verify ReplayGuard is in-memory (not
// fleet-safe). They are OFF by default and gated behind MCP_TOOLKIT_DEMOS=1 so
// production never exposes them by accident. When disabled they 404 like any
// unknown route.
const toolkitDemos = (req, res, next) => {
    if (process.env.MCP_TOOLKIT_DEMOS === '1') return next();
    res.status(404).json({ error: 'Not Found' });
};

// POST /api/mcp/tools
// Body: an OpenAPI 3.0/3.1 document. Returns generated MCP tool definitions.
router.post('/tools', toolkitDemos, async (req, res) => {
    try {
        const doc = req.body;
        if (!doc || typeof doc !== 'object' || !doc.openapi) {
            return res.status(400).json({
                success: false,
                error: 'Request body must be an OpenAPI 3.x document (missing "openapi" field).',
            });
        }
        const { tools, warnings } = mapOpenApiToTools(doc);
        res.json({ success: true, data: { tools, warnings } });
    } catch (error) {
        console.error('Error generating MCP tools:', error);
        res.status(400).json({ success: false, error: safeMsg(error) });
    }
});

// POST /api/mcp/sign
// Body: { sharedSecret, token }. Returns a signed Platform Connect request.
router.post('/sign', toolkitDemos, async (req, res) => {
    try {
        const { sharedSecret, token } = req.body || {};
        if (!sharedSecret || !token) {
            return res.status(400).json({
                success: false,
                error: 'Both "sharedSecret" and "token" are required.',
            });
        }
        const signed = signRequest(sharedSecret, token);
        res.json({ success: true, data: signed });
    } catch (error) {
        console.error('Error signing MCP request:', error);
        res.status(400).json({ success: false, error: safeMsg(error) });
    }
});

// POST /api/mcp/verify
// Body: { sharedSecret, request }. Verifies signature, freshness and replay.
router.post('/verify', toolkitDemos, async (req, res) => {
    try {
        const { sharedSecret, request } = req.body || {};
        if (!sharedSecret || !request) {
            return res.status(400).json({
                success: false,
                error: 'Both "sharedSecret" and "request" are required.',
            });
        }
        const result = verifyRequest(sharedSecret, request, { replayGuard });
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error verifying MCP request:', error);
        res.status(400).json({ success: false, error: safeMsg(error) });
    }
});

// ─── External MCP connect (Phase 7) ─────────────────────────────────────────────
// Issue / list / revoke the long-lived tokens users paste into Claude Desktop.

/**
 * The launch command embedded in the copy-paste client config.
 * @insighttrack/mcp-server is NOT yet published to npm, so the npx form would
 * 404 for real users — default to running the bundled server from a local
 * checkout instead. Deploy-time overrides:
 *   MCP_SERVER_PACKAGE  npm package name → npx form (set once published)
 *   MCP_SERVER_PATH     absolute path to mcp-server/src/index.js on the
 *                       client machine → node form with a real path
 */
function mcpClientCommand() {
    if (process.env.MCP_SERVER_PACKAGE) {
        return { command: 'npx', args: ['-y', process.env.MCP_SERVER_PACKAGE] };
    }
    const serverPath = process.env.MCP_SERVER_PATH
        || '/ABSOLUTE/PATH/TO/insighttrack/mcp-server/src/index.js';
    return { command: 'node', args: [serverPath] };
}

// POST /api/mcp/connect  { label? } → { token, jti, config }
// Returns the token ONCE (never retrievable again) plus a ready-to-paste config.
router.post('/connect', async (req, res) => {
    try {
        // MCP tokens cannot mint more MCP tokens.
        if (req.user?.scope === 'mcp') {
            return res.status(403).json({ success: false, error: 'MCP tokens cannot issue new connections.' });
        }
        const label = (req.body?.label || 'MCP client').toString().slice(0, 80);
        const jti = crypto.randomUUID();
        await query(
            `INSERT INTO mcp_connect_tokens (jti, user_id, label) VALUES ($1, $2, $3)`,
            [jti, req.user.id, label]
        );
        const token = authService.generateMcpToken(req.user, jti);

        // Public base URL the MCP server should call. Configurable for deploys.
        const apiUrl = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;
        res.json({
            success: true,
            data: {
                jti,
                label,
                token, // shown once
                apiUrl,
                // ── Remote transport (N1) — the simplest path: no local install,
                // the client connects straight to the hosted Streamable-HTTP MCP
                // endpoint with the token as a bearer header.
                remoteUrl: `${apiUrl}/api/mcp/http`,
                remoteConfig: {
                    mcpServers: {
                        insighttrack: {
                            type: 'http',
                            url: `${apiUrl}/api/mcp/http`,
                            headers: { Authorization: `Bearer ${token}` },
                        },
                    },
                },
                // ── Local stdio bridge — for clients that only speak stdio.
                // Command shape depends on deploy config — see mcpClientCommand().
                config: {
                    mcpServers: {
                        insighttrack: {
                            ...mcpClientCommand(),
                            env: { INSIGHTTRACK_API_URL: apiUrl, INSIGHTTRACK_TOKEN: token },
                        },
                    },
                },
                // Shown in the UI next to the STDIO config when the path is a placeholder.
                note: process.env.MCP_SERVER_PACKAGE || process.env.MCP_SERVER_PATH
                    ? null
                    : 'Replace /ABSOLUTE/PATH/TO/insighttrack with where you cloned this repo (the MCP server ships in mcp-server/).',
            },
        });
    } catch (error) {
        console.error('Error issuing MCP connect token:', error.message);
        res.status(500).json({ success: false, error: safeMsg(error) });
    }
});

// GET /api/mcp/connect — list the user's active/revoked connections (no tokens).
router.get('/connect', async (req, res) => {
    try {
        const r = await query(
            `SELECT jti, label, created_at, last_used_at, revoked_at
             FROM mcp_connect_tokens WHERE user_id = $1 ORDER BY created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, data: r.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: safeMsg(error) });
    }
});

// DELETE /api/mcp/connect/:jti — revoke a connection.
router.delete('/connect/:jti', async (req, res) => {
    try {
        const r = await query(
            `UPDATE mcp_connect_tokens SET revoked_at = NOW()
             WHERE jti = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING jti`,
            [req.params.jti, req.user.id]
        );
        if (!r.rows[0]) return res.status(404).json({ success: false, error: 'Connection not found.' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: safeMsg(error) });
    }
});

export default router;
