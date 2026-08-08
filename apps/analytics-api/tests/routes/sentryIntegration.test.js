import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupTestDB, cleanTestDB, closeTestDB, insertTestSite, TEST_SITE_ID } from '../testHelper.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
const { default: sitesRoutes } = await import('../../src/routes/sites.js');
const { default: authService } = await import('../../src/services/authService.js');
const { getPool, query } = await import('../../src/db/postgres.js');

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/sites', sitesRoutes);
    return app;
}

const base = `/api/sites/${TEST_SITE_ID}/integrations/sentry`;

describe('Sentry integration routes — role gating & secret hygiene', () => {
    let app, owner, ownerToken, viewer, viewerToken;

    const asOwner = (req) => req.set('Authorization', `Bearer ${ownerToken}`);
    const asViewer = (req) => req.set('Authorization', `Bearer ${viewerToken}`);

    const setMember = async (userId, role) =>
        query(`INSERT INTO site_members (site_id, user_id, role) VALUES ($1,$2,$3)
                ON CONFLICT (site_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
            [TEST_SITE_ID, userId, role]);

    const cleanScoped = async () => {
        const pool = getPool();
        await pool.query(`DELETE FROM sentry_issues WHERE site_id = $1`, [TEST_SITE_ID]).catch(() => {});
        await pool.query(`DELETE FROM site_integrations WHERE site_id = $1`, [TEST_SITE_ID]).catch(() => {});
        await pool.query(`DELETE FROM site_members WHERE site_id = $1`, [TEST_SITE_ID]);
        await pool.query(`DELETE FROM sites WHERE id = $1`, [TEST_SITE_ID]);
    };

    beforeAll(async () => {
        await setupTestDB();
        await cleanTestDB();
        app = createApp();
        ({ user: owner, token: ownerToken } = await authService.register(
            'Sentry Owner', 'sentry-owner@test.example.com', 'password-123'));
        ({ user: viewer, token: viewerToken } = await authService.register(
            'Sentry Viewer', 'sentry-viewer@test.example.com', 'password-123'));
    });

    beforeEach(async () => {
        await cleanScoped();
        await insertTestSite(TEST_SITE_ID, 'Test Site', 'test.example.com', owner.id);
        await setMember(owner.id, 'owner');
        await setMember(viewer.id, 'viewer');
    });

    afterEach(() => { vi.unstubAllGlobals(); });
    afterAll(async () => { await cleanScoped(); await cleanTestDB(); await closeTestDB(); });

    it('rejects unauthenticated requests', async () => {
        const res = await request(app).get(base);
        expect(res.status).toBe(401);
    });

    it('a viewer can list integrations but cannot connect', async () => {
        const read = await asViewer(request(app).get(base));
        expect(read.status).toBe(200);
        expect(read.body.data).toEqual([]); // nothing connected yet

        const write = await asViewer(request(app).put(base))
            .send({ token: 'sntrys_x', org: 'o', project: 'p' });
        expect(write.status).toBe(403);
    });

    it('an admin/owner can connect, and the response never contains the token', async () => {
        const res = await asOwner(request(app).put(base))
            .send({ token: 'sntrys_supersecret', org: 'my-org', project: 'frontend' });
        expect(res.status).toBe(200);
        expect(res.body.data.connected).toBe(true);
        expect(res.body.data.id).toMatch(/^int_/);
        expect(JSON.stringify(res.body)).not.toContain('sntrys_supersecret');

        // GET returns a list; the token is not readable there either.
        const get = await asOwner(request(app).get(base));
        expect(Array.isArray(get.body.data)).toBe(true);
        expect(get.body.data).toHaveLength(1);
        expect(JSON.stringify(get.body)).not.toContain('sntrys_supersecret');
        expect(get.body.data[0].org).toBe('my-org');
    });

    it('a site can connect multiple projects', async () => {
        await asOwner(request(app).put(base)).send({ token: 't1', org: 'my-org', project: 'frontend' });
        await asOwner(request(app).put(base)).send({ token: 't2', org: 'my-org', project: 'backend' });
        const get = await asOwner(request(app).get(base));
        expect(get.body.data).toHaveLength(2);
        expect(get.body.data.map((i) => i.project).sort()).toEqual(['backend', 'frontend']);
    });

    it('re-saving the same (org, project) updates rather than duplicates', async () => {
        await asOwner(request(app).put(base)).send({ token: 't1', org: 'my-org', project: 'frontend' });
        await asOwner(request(app).put(base)).send({ org: 'my-org', project: 'frontend', baseUrl: 'https://self.example.com' });
        const get = await asOwner(request(app).get(base));
        expect(get.body.data).toHaveLength(1);
        expect(get.body.data[0].baseUrl).toBe('https://self.example.com');
    });

    it('test endpoint (by id) surfaces an upstream auth failure status', async () => {
        const conn = await asOwner(request(app).put(base)).send({ token: 'sntrys_x', org: 'o', project: 'p' });
        const id = conn.body.data.id;
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false, status: 401, headers: { get: () => null }, json: async () => ({}),
        }));
        const res = await asOwner(request(app).post(`${base}/${id}/test`));
        expect(res.status).toBe(401);
    });

    it('owner can disconnect one project by id', async () => {
        const a = await asOwner(request(app).put(base)).send({ token: 't', org: 'o', project: 'frontend' });
        await asOwner(request(app).put(base)).send({ token: 't', org: 'o', project: 'backend' });
        const del = await asOwner(request(app).delete(`${base}/${a.body.data.id}`));
        expect(del.status).toBe(200);
        const get = await asOwner(request(app).get(base));
        expect(get.body.data).toHaveLength(1);
        expect(get.body.data[0].project).toBe('backend');
    });
});
