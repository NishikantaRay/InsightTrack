import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupTestDB, cleanTestDB, closeTestDB, insertTestSite, TEST_SITE_ID } from '../testHelper.js';
import sitesRoutes from '../../src/routes/sites.js';

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/sites', sitesRoutes);
    return app;
}

describe('Sites Routes', () => {
    let app;

    beforeAll(async () => {
        await setupTestDB();
        app = createApp();
    });

    beforeEach(async () => {
        await cleanTestDB();
    });

    afterAll(async () => {
        await cleanTestDB();
        await closeTestDB();
    });

    describe('POST /api/sites', () => {
        it('should create a new site', async () => {
            const res = await request(app)
                .post('/api/sites')
                .send({ name: 'My Blog', domain: 'myblog.com' });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('My Blog');
            expect(res.body.data.domain).toBe('myblog.com');
            expect(res.body.data.id).toMatch(/^site_/);
        });

        it('should require name and domain', async () => {
            const res = await request(app)
                .post('/api/sites')
                .send({ name: 'Only Name' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('required');
        });
    });

    describe('GET /api/sites', () => {
        it('should list all sites', async () => {
            await insertTestSite();
            const res = await request(app).get('/api/sites');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('GET /api/sites/:siteId', () => {
        it('should return site by id', async () => {
            await insertTestSite();
            const res = await request(app).get(`/api/sites/${TEST_SITE_ID}`);

            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(TEST_SITE_ID);
        });

        it('should return 404 for nonexistent site', async () => {
            const res = await request(app).get('/api/sites/site_nope');
            expect(res.status).toBe(404);
        });
    });

    describe('PUT /api/sites/:siteId', () => {
        it('should update site', async () => {
            await insertTestSite();
            const res = await request(app)
                .put(`/api/sites/${TEST_SITE_ID}`)
                .send({ name: 'Updated', domain: 'updated.com' });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Updated');
        });

        it('should return 404 for nonexistent site', async () => {
            const res = await request(app)
                .put('/api/sites/site_nope')
                .send({ name: 'x' });
            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/sites/:siteId', () => {
        it('should delete site', async () => {
            await insertTestSite();
            const res = await request(app).delete(`/api/sites/${TEST_SITE_ID}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify it's gone
            const check = await request(app).get(`/api/sites/${TEST_SITE_ID}`);
            expect(check.status).toBe(404);
        });
    });

    describe('GET /api/sites/:siteId/script', () => {
        it('should return JavaScript tracking script', async () => {
            await insertTestSite();
            const res = await request(app).get(`/api/sites/${TEST_SITE_ID}/script`);

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('javascript');
            expect(res.text).toContain(TEST_SITE_ID);
            expect(res.text).toContain('trackPageview');
        });

        it('should return 404 for nonexistent site', async () => {
            const res = await request(app).get('/api/sites/site_nope/script');
            expect(res.status).toBe(404);
        });
    });

    describe('GET /api/sites/:siteId/snippet', () => {
        it('should return HTML snippet', async () => {
            await insertTestSite();
            const res = await request(app).get(`/api/sites/${TEST_SITE_ID}/snippet`);

            expect(res.status).toBe(200);
            expect(res.body.data.snippet).toContain('<script');
            expect(res.body.data.siteId).toBe(TEST_SITE_ID);
        });
    });
});
