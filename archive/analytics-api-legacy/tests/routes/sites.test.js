import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupTestDB, cleanTestDB, closeTestDB, getTestPool } from '../testHelper.js';
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
                .send({ name: 'My Site', domain: 'mysite.com' });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('id');
            expect(res.body.data.name).toBe('My Site');
            expect(res.body.data.domain).toBe('mysite.com');
        });

        it('should return 400 when name is missing', async () => {
            const res = await request(app)
                .post('/api/sites')
                .send({ domain: 'mysite.com' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('name and domain are required');
        });

        it('should return 400 when domain is missing', async () => {
            const res = await request(app)
                .post('/api/sites')
                .send({ name: 'My Site' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('name and domain are required');
        });
    });

    describe('GET /api/sites', () => {
        it('should return all sites', async () => {
            // Create a site first
            await request(app)
                .post('/api/sites')
                .send({ name: 'Site A', domain: 'a.com' });

            const res = await request(app).get('/api/sites');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('GET /api/sites/:siteId', () => {
        it('should return a site by ID', async () => {
            const createRes = await request(app)
                .post('/api/sites')
                .send({ name: 'Findable Site', domain: 'findable.com' });

            const siteId = createRes.body.data.id;
            const res = await request(app).get(`/api/sites/${siteId}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Findable Site');
        });

        it('should return 404 for nonexistent site', async () => {
            const res = await request(app).get('/api/sites/nonexistent_id');

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Site not found');
        });
    });

    describe('PUT /api/sites/:siteId', () => {
        it('should update a site', async () => {
            const createRes = await request(app)
                .post('/api/sites')
                .send({ name: 'Old Name', domain: 'old.com' });

            const siteId = createRes.body.data.id;
            const res = await request(app)
                .put(`/api/sites/${siteId}`)
                .send({ name: 'New Name', domain: 'new.com' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('New Name');
            expect(res.body.data.domain).toBe('new.com');
        });

        it('should return 404 for nonexistent site', async () => {
            const res = await request(app)
                .put('/api/sites/nonexistent_id')
                .send({ name: 'X', domain: 'x.com' });

            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/sites/:siteId', () => {
        it('should delete a site', async () => {
            const createRes = await request(app)
                .post('/api/sites')
                .send({ name: 'Deletable', domain: 'deletable.com' });

            const siteId = createRes.body.data.id;
            const res = await request(app).delete(`/api/sites/${siteId}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify deleted
            const getRes = await request(app).get(`/api/sites/${siteId}`);
            expect(getRes.status).toBe(404);
        });
    });

    describe('GET /api/sites/:siteId/script', () => {
        it('should return raw JavaScript tracking script for a site', async () => {
            const createRes = await request(app)
                .post('/api/sites')
                .send({ name: 'Script Site', domain: 'scriptsite.com' });

            const siteId = createRes.body.data.id;
            const res = await request(app).get(`/api/sites/${siteId}/script`);

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('application/javascript');
            expect(res.text).toContain(siteId);
            expect(res.text).toContain('trackPageview');
        });

        it('should return 404 for nonexistent site', async () => {
            const res = await request(app).get('/api/sites/nonexistent/script');
            expect(res.status).toBe(404);
        });
    });
});
