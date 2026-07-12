import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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

describe('Sites Routes', () => {
    let app, user, token;

    const auth = (req) => req.set('Authorization', `Bearer ${token}`);
    // Ownership = a site_members 'owner' row (the multi-user model used by
    // list/update/delete), plus sites.user_id for the legacy column.
    const insertOwnedSite = async () => {
        await insertTestSite(TEST_SITE_ID, 'Test Site', 'test.example.com', user.id);
        await query(
            `INSERT INTO site_members (site_id, user_id, role) VALUES ($1, $2, 'owner')
             ON CONFLICT (site_id, user_id) DO NOTHING`,
            [TEST_SITE_ID, user.id]
        );
    };
    // Per-test cleanup of SITES only — cleanTestDB would delete our user too.
    const cleanSites = async () => {
        const pool = getPool();
        await pool.query(`DELETE FROM sites WHERE id LIKE 'site_test%' OR domain LIKE '%.test.example.com'`);
    };

    beforeAll(async () => {
        await setupTestDB();
        await cleanTestDB();
        app = createApp();
        ({ user, token } = await authService.register(
            'Sites Tester', 'sites-routes@test.example.com', 'password-123'
        ));
    });

    beforeEach(cleanSites);

    afterAll(async () => {
        await cleanTestDB();
        await closeTestDB();
    });

    it('rejects unauthenticated requests', async () => {
        const res = await request(app).get('/api/sites');
        expect(res.status).toBe(401);
    });

    describe('POST /api/sites', () => {
        it('should create a new site owned by the caller', async () => {
            const res = await auth(request(app).post('/api/sites'))
                .send({ name: 'My Blog', domain: 'myblog.test.example.com' });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('My Blog');
            expect(res.body.data.domain).toBe('myblog.test.example.com');
            expect(res.body.data.id).toMatch(/^site_/);
        });

        it('should require name and domain', async () => {
            const res = await auth(request(app).post('/api/sites'))
                .send({ name: 'Only Name' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('required');
        });
    });

    describe('GET /api/sites', () => {
        it("should list the caller's sites", async () => {
            await insertOwnedSite();
            const res = await auth(request(app).get('/api/sites'));

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.some((s) => s.id === TEST_SITE_ID)).toBe(true);
        });
    });

    describe('GET /api/sites/:siteId', () => {
        it('should return an owned site by id', async () => {
            await insertOwnedSite();
            const res = await auth(request(app).get(`/api/sites/${TEST_SITE_ID}`));

            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(TEST_SITE_ID);
        });

        it("should 404 on sites the caller doesn't own", async () => {
            await insertTestSite(TEST_SITE_ID, 'Not Mine', 'test.example.com', null);
            const res = await auth(request(app).get(`/api/sites/${TEST_SITE_ID}`));
            expect(res.status).toBe(404);
        });

        it('should return 404 for nonexistent site', async () => {
            const res = await auth(request(app).get('/api/sites/site_nope'));
            expect(res.status).toBe(404);
        });
    });

    describe('PUT /api/sites/:siteId', () => {
        it('should update an owned site', async () => {
            await insertOwnedSite();
            const res = await auth(request(app).put(`/api/sites/${TEST_SITE_ID}`))
                .send({ name: 'Updated', domain: 'updated.test.example.com' });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Updated');
        });

        it('should return 404 for nonexistent site', async () => {
            const res = await auth(request(app).put('/api/sites/site_nope'))
                .send({ name: 'x' });
            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/sites/:siteId', () => {
        it('should delete an owned site', async () => {
            await insertOwnedSite();
            const res = await auth(request(app).delete(`/api/sites/${TEST_SITE_ID}`));
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const check = await auth(request(app).get(`/api/sites/${TEST_SITE_ID}`));
            expect(check.status).toBe(404);
        });
    });

    describe('GET /api/sites/:siteId/script', () => {
        it('should return JavaScript tracking script', async () => {
            await insertOwnedSite();
            const res = await auth(request(app).get(`/api/sites/${TEST_SITE_ID}/script`));

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('javascript');
            expect(res.text).toContain(TEST_SITE_ID);
            expect(res.text).toContain('trackPageview');
        });

        it('should return 404 for nonexistent site', async () => {
            const res = await auth(request(app).get('/api/sites/site_nope/script'));
            expect(res.status).toBe(404);
        });
    });

    describe('GET /api/sites/:siteId/snippet', () => {
        it('should return HTML snippet', async () => {
            await insertOwnedSite();
            const res = await auth(request(app).get(`/api/sites/${TEST_SITE_ID}/snippet`));

            expect(res.status).toBe(200);
            expect(res.body.data.snippet).toContain('<script');
            expect(res.body.data.siteId).toBe(TEST_SITE_ID);
        });
    });
});
