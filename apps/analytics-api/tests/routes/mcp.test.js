import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupTestDB, cleanTestDB, closeTestDB, insertTestSite, TEST_SITE_ID } from '../testHelper.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
const { default: mcpRoutes } = await import('../../src/routes/mcp.js');
const { default: authService } = await import('../../src/services/authService.js');
const { query } = await import('../../src/db/postgres.js');

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/mcp', mcpRoutes);
    return app;
}

describe('MCP routes — tenant isolation & connect-token lifecycle', () => {
    let app, user, userToken;

    beforeAll(async () => {
        await setupTestDB();
        await cleanTestDB();
        app = createApp();
        ({ user, token: userToken } = await authService.register(
            'MCP Tester', 'mcp-routes@test.example.com', 'password-123'
        ));
        await insertTestSite(); // site the user does NOT belong to
    });

    afterAll(async () => {
        await cleanTestDB(); // users cascade-delete their mcp_connect_tokens
        await closeTestDB();
    });

    describe('authentication', () => {
        it('rejects unauthenticated requests', async () => {
            const res = await request(app).get('/api/mcp/tools');
            expect(res.status).toBe(401);
        });

        it('serves the tool catalogue to authenticated users', async () => {
            const res = await request(app)
                .get('/api/mcp/tools')
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.count).toBe(19); // 11 original + 6 P2.1 + 2 Sentry (P3.2) tools
            expect(res.body.data.tools[0]).toHaveProperty('inputSchema');
            // list_sites advertises the siteless flag so the MCP server can skip
            // injecting a required siteId into its schema.
            const listSites = res.body.data.tools.find((t) => t.name === 'list_sites');
            expect(listSites?.siteless).toBe(true);
        });
    });

    // P1.2 — the toolkit demo endpoints are off by default (MCP_TOOLKIT_DEMOS unset
    // in the test env), so they 404 like any unknown route.
    describe('toolkit demo endpoints are gated off by default', () => {
        for (const path of ['/api/mcp/tools', '/api/mcp/sign', '/api/mcp/verify']) {
            it(`POST ${path} → 404 when MCP_TOOLKIT_DEMOS is unset`, async () => {
                const res = await request(app)
                    .post(path)
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({ openapi: '3.0.0', sharedSecret: 's', token: 't', request: {} });
                expect(res.status).toBe(404);
            });
        }
    });

    describe('POST /api/mcp/run — site scoping (the tenant boundary)', () => {
        it('400s when name or siteId is missing', async () => {
            const res = await request(app)
                .post('/api/mcp/run')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ name: 'get_kpi' });
            expect(res.status).toBe(400);
        });

        it("403s on a site the caller has NO membership in — foreign tenants are unreachable", async () => {
            const res = await request(app)
                .post('/api/mcp/run')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ name: 'get_kpi', siteId: TEST_SITE_ID });
            expect(res.status).toBe(403);
            expect(res.body.error).toContain('access');
        });

        it('authorizes members, then rejects unknown tools at the registry', async () => {
            // Grant membership → authorization passes → registry guard fires.
            await query(
                `INSERT INTO site_members (site_id, user_id, role) VALUES ($1, $2, 'owner')
                 ON CONFLICT (site_id, user_id) DO NOTHING`,
                [TEST_SITE_ID, user.id]
            );
            const res = await request(app)
                .post('/api/mcp/run')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ name: 'not_a_real_tool', siteId: TEST_SITE_ID });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Unknown tool');
        });
    });

    describe('connect-token lifecycle', () => {
        let jti, mcpToken;

        it('mints a scoped, revocable token with a paste-ready config', async () => {
            const res = await request(app)
                .post('/api/mcp/connect')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ label: 'Claude Desktop (test)' });
            expect(res.status).toBe(200);
            ({ jti, token: mcpToken } = res.body.data);
            expect(jti).toBeTruthy();

            // P0.1: the config must be locally runnable — never the unpublished
            // npx package unless MCP_SERVER_PACKAGE is explicitly configured.
            const server = res.body.data.config.mcpServers.insighttrack;
            expect(server.command).toBe('node');
            expect(server.env.INSIGHTTRACK_TOKEN).toBe(mcpToken);

            const decoded = authService.verifyToken(mcpToken);
            expect(decoded.scope).toBe('mcp');
            expect(decoded.jti).toBe(jti);
        });

        it('accepts the connect token on tool routes while active', async () => {
            const res = await request(app)
                .get('/api/mcp/tools')
                .set('Authorization', `Bearer ${mcpToken}`);
            expect(res.status).toBe(200);
        });

        it('refuses to let an MCP token mint further tokens', async () => {
            const res = await request(app)
                .post('/api/mcp/connect')
                .set('Authorization', `Bearer ${mcpToken}`)
                .send({ label: 'escalation attempt' });
            expect(res.status).toBe(403);
        });

        it('lists connections without ever returning the token again', async () => {
            const res = await request(app)
                .get('/api/mcp/connect')
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.status).toBe(200);
            const row = res.body.data.find((r) => r.jti === jti);
            expect(row).toBeTruthy();
            expect(row.token).toBeUndefined();
        });

        it('revokes, and the token dies immediately', async () => {
            const del = await request(app)
                .delete(`/api/mcp/connect/${jti}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(del.status).toBe(200);

            const after = await request(app)
                .get('/api/mcp/tools')
                .set('Authorization', `Bearer ${mcpToken}`);
            expect(after.status).toBe(401);
            expect(after.body.error).toContain('revoked');
        });

        it("404s when revoking someone else's (or a nonexistent) connection", async () => {
            const res = await request(app)
                .delete('/api/mcp/connect/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.status).toBe(404);
        });
    });

    // Runs last so it doesn't perturb the foreign-site isolation checks above.
    describe('POST /api/mcp/run — siteless tools (list_sites)', () => {
        it('runs list_sites without a siteId, scoped to the caller', async () => {
            // The user became owner of TEST_SITE_ID during the scoping tests.
            const res = await request(app)
                .post('/api/mcp/run')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ name: 'list_sites' }); // no siteId
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data.data)).toBe(true);
            const ids = res.body.data.data.map((s) => s.id);
            expect(ids).toContain(TEST_SITE_ID);
        });
    });

    // ── Remote Streamable-HTTP MCP transport (N1) ──
    // By now the user owns TEST_SITE_ID (granted in the scoping block above).
    describe('POST /api/mcp/http — JSON-RPC transport', () => {
        const rpc = (token, body) =>
            request(app).post('/api/mcp/http').set('Authorization', `Bearer ${token}`).send(body);

        it('rejects unauthenticated requests', async () => {
            const res = await request(app).post('/api/mcp/http')
                .send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
            expect(res.status).toBe(401);
        });

        it('initialize returns protocol version + serverInfo', async () => {
            const res = await rpc(userToken, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
            expect(res.status).toBe(200);
            expect(res.body.result.serverInfo.name).toBe('insighttrack');
            expect(res.body.result.capabilities).toHaveProperty('tools');
        });

        it('notifications/initialized gets a 202 with no body', async () => {
            const res = await rpc(userToken, { jsonrpc: '2.0', method: 'notifications/initialized' });
            expect(res.status).toBe(202);
        });

        it('tools/list advertises the tools with siteId injected on site-scoped ones', async () => {
            const res = await rpc(userToken, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
            expect(res.status).toBe(200);
            const tools = res.body.result.tools;
            expect(tools.length).toBe(19);
            const kpi = tools.find((t) => t.name === 'get_kpi');
            expect(kpi.inputSchema.properties).toHaveProperty('siteId'); // injected
            const listSites = tools.find((t) => t.name === 'list_sites');
            expect(listSites.inputSchema.properties).not.toHaveProperty('siteId'); // siteless
        });

        it('tools/call runs a siteless tool (list_sites) without a siteId', async () => {
            const res = await rpc(userToken, {
                jsonrpc: '2.0', id: 3, method: 'tools/call',
                params: { name: 'list_sites', arguments: {} },
            });
            expect(res.status).toBe(200);
            expect(res.body.result.content[0].type).toBe('text');
            expect(res.body.result.content[0].text).toContain(TEST_SITE_ID);
            // N2 — structured content lets rich clients render natively.
            expect(res.body.result.structuredContent).toBeTruthy();
            expect(Array.isArray(res.body.result.structuredContent.data)).toBe(true);
            expect(res.body.result.structuredContent.data.some((s) => s.id === TEST_SITE_ID)).toBe(true);
        });

        it('tools/call on a foreign site returns an isError result (isolation holds)', async () => {
            const res = await rpc(userToken, {
                jsonrpc: '2.0', id: 4, method: 'tools/call',
                params: { name: 'get_kpi', arguments: { siteId: 'site_not_mine' } },
            });
            expect(res.status).toBe(200);
            expect(res.body.result.isError).toBe(true);
            expect(res.body.result.content[0].text).toContain('do not have access');
        });

        it('unknown method → JSON-RPC method-not-found error', async () => {
            const res = await rpc(userToken, { jsonrpc: '2.0', id: 5, method: 'does/not/exist', params: {} });
            expect(res.body.error.code).toBe(-32601);
        });

        it('a connect (mcp-scope) token can drive the transport, and dies on revoke', async () => {
            // Mint a fresh connect token, use it, revoke it, use again.
            const mint = await request(app).post('/api/mcp/connect')
                .set('Authorization', `Bearer ${userToken}`).send({ label: 'http transport' });
            const { jti, token: mcpToken } = mint.body.data;
            // Remote config offers the URL form.
            expect(mint.body.data.remoteConfig.mcpServers.insighttrack.type).toBe('http');
            expect(mint.body.data.remoteConfig.mcpServers.insighttrack.url).toContain('/api/mcp/http');

            const ok = await rpc(mcpToken, { jsonrpc: '2.0', id: 6, method: 'tools/list', params: {} });
            expect(ok.status).toBe(200);
            expect(ok.body.result.tools.length).toBe(19);

            await request(app).delete(`/api/mcp/connect/${jti}`).set('Authorization', `Bearer ${userToken}`);
            const dead = await rpc(mcpToken, { jsonrpc: '2.0', id: 7, method: 'tools/list', params: {} });
            expect(dead.status).toBe(401);
        });

        it('GET /api/mcp/http is 405 (POST-only, no server stream)', async () => {
            const res = await request(app).get('/api/mcp/http').set('Authorization', `Bearer ${userToken}`);
            expect(res.status).toBe(405);
        });
    });
});
