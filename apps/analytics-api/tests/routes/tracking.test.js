import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupTestDB, cleanTestDB, closeTestDB, insertTestSite, TEST_SITE_ID } from '../testHelper.js';
import trackingRoutes from '../../src/routes/tracking.js';

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/track', trackingRoutes);
    return app;
}

describe('Tracking Routes', () => {
    let app;

    beforeAll(async () => {
        await setupTestDB();
        app = createApp();
    });

    beforeEach(async () => {
        await cleanTestDB();
        await insertTestSite();
    });

    afterAll(async () => {
        await cleanTestDB();
        await closeTestDB();
    });

    describe('POST /api/track/event', () => {
        it('should track an event', async () => {
            const res = await request(app)
                .post('/api/track/event')
                .send({
                    siteId: TEST_SITE_ID,
                    userId: 'u1',
                    type: 'pageview',
                    url: 'https://test.example.com/',
                    path: '/',
                });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });

        it('should return 400 for missing siteId', async () => {
            const res = await request(app)
                .post('/api/track/event')
                .send({ type: 'pageview' });
            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/track/pageview', () => {
        it('should track a pageview', async () => {
            const res = await request(app)
                .post('/api/track/pageview')
                .send({
                    siteId: TEST_SITE_ID,
                    userId: 'u1',
                    url: 'https://test.example.com/about',
                    path: '/about',
                });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
    });

    describe('POST /api/track/session', () => {
        it('should create/update session', async () => {
            const res = await request(app)
                .post('/api/track/session')
                .send({
                    sessionId: 's_route_1',
                    siteId: TEST_SITE_ID,
                    userId: 'u1',
                    entryPage: '/',
                    device: 'Desktop',
                });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('POST /api/track/session/end', () => {
        it('should require sessionId', async () => {
            const res = await request(app)
                .post('/api/track/session/end')
                .send({ duration: 120 });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('sessionId');
        });

        it('should end an existing session', async () => {
            // Create session first
            await request(app)
                .post('/api/track/session')
                .send({
                    sessionId: 's_end_1',
                    siteId: TEST_SITE_ID,
                    userId: 'u1',
                    entryPage: '/',
                });

            const res = await request(app)
                .post('/api/track/session/end')
                .send({ sessionId: 's_end_1', duration: 90 });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/track/batch', () => {
        it('should track batch events', async () => {
            const res = await request(app)
                .post('/api/track/batch')
                .send({
                    events: [
                        { siteId: TEST_SITE_ID, userId: 'u1', type: 'pageview', path: '/' },
                        { siteId: TEST_SITE_ID, userId: 'u2', type: 'click', path: '/cta' },
                    ],
                });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(2);
        });

        it('should reject empty events array', async () => {
            const res = await request(app)
                .post('/api/track/batch')
                .send({ events: [] });
            expect(res.status).toBe(400);
        });

        it('should reject missing events', async () => {
            const res = await request(app)
                .post('/api/track/batch')
                .send({});
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/track/pixel.gif', () => {
        it('should return a 1x1 GIF', async () => {
            const res = await request(app)
                .get('/api/track/pixel.gif')
                .query({ siteId: TEST_SITE_ID, userId: 'u1' });

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('image/gif');
        });
    });

    describe('POST /api/track/', () => {
        it('should work as alias for /event', async () => {
            const res = await request(app)
                .post('/api/track/')
                .send({ siteId: TEST_SITE_ID, userId: 'u1', type: 'pageview' });
            expect(res.status).toBe(201);
        });
    });
});
