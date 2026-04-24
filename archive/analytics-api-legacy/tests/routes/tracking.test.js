import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupTestDB, cleanTestDB, closeTestDB, getTestPool, insertTestSite } from '../testHelper.js';
import trackingRoutes from '../../src/routes/tracking.js';

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/track', trackingRoutes);
    return app;
}

describe('Tracking Routes', () => {
    let app;
    let pool;

    beforeAll(async () => {
        await setupTestDB();
        pool = getTestPool();
        app = createApp();
    });

    beforeEach(async () => {
        await cleanTestDB();
        await insertTestSite(pool);
    });

    afterAll(async () => {
        await cleanTestDB();
        await closeTestDB();
    });

    describe('POST /api/track/event', () => {
        it('should track a valid event', async () => {
            const res = await request(app)
                .post('/api/track/event')
                .send({
                    siteId: 'site_test1',
                    type: 'pageview',
                    userId: 'u1',
                    url: 'https://example.com',
                    path: '/',
                    referrer: 'https://google.com',
                    device: 'desktop',
                    browser: 'Chrome',
                    os: 'macOS',
                    country: 'US',
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('success', true);
        });

        it('should return 400 for missing required fields', async () => {
            const res = await request(app)
                .post('/api/track/event')
                .send({ type: 'pageview' }); // missing siteId, userId

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
        });
    });

    describe('POST /api/track/pageview', () => {
        it('should track a pageview', async () => {
            const res = await request(app)
                .post('/api/track/pageview')
                .send({
                    siteId: 'site_test1',
                    userId: 'u1',
                    url: 'https://example.com/about',
                    path: '/about',
                    device: 'mobile',
                    browser: 'Safari',
                    os: 'iOS',
                    country: 'GB',
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
    });

    describe('POST /api/track/session', () => {
        it('should create/update a session', async () => {
            const res = await request(app)
                .post('/api/track/session')
                .send({
                    siteId: 'site_test1',
                    sessionId: 'sess_route_1',
                    userId: 'u1',
                    entryPage: '/',
                    device: 'desktop',
                    browser: 'Chrome',
                    os: 'macOS',
                    country: 'US',
                    referrer: '',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('POST /api/track/session/end', () => {
        it('should end a session', async () => {
            // First create a session
            await request(app)
                .post('/api/track/session')
                .send({
                    siteId: 'site_test1',
                    sessionId: 'sess_end_1',
                    userId: 'u1',
                    entryPage: '/',
                    device: 'desktop',
                    browser: 'Chrome',
                    os: 'macOS',
                    country: 'US',
                });

            const res = await request(app)
                .post('/api/track/session/end')
                .send({ sessionId: 'sess_end_1', duration: 120 });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 400 without sessionId', async () => {
            const res = await request(app)
                .post('/api/track/session/end')
                .send({ duration: 100 });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('sessionId is required');
        });
    });

    describe('POST /api/track/batch', () => {
        it('should track multiple events', async () => {
            const res = await request(app)
                .post('/api/track/batch')
                .send({
                    events: [
                        { siteId: 'site_test1', type: 'pageview', userId: 'u1', url: 'https://example.com', path: '/', device: 'desktop', browser: 'Chrome', os: 'macOS', country: 'US' },
                        { siteId: 'site_test1', type: 'pageview', userId: 'u2', url: 'https://example.com/about', path: '/about', device: 'mobile', browser: 'Safari', os: 'iOS', country: 'GB' },
                    ],
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(2);
        });

        it('should return 400 for empty events array', async () => {
            const res = await request(app)
                .post('/api/track/batch')
                .send({ events: [] });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('events array is required');
        });
    });

    describe('GET /api/track/pixel.gif', () => {
        it('should return a 1x1 GIF', async () => {
            const res = await request(app)
                .get('/api/track/pixel.gif')
                .query({ siteId: 'site_test1', userId: 'u1' });

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toBe('image/gif');
        });
    });

    describe('POST /api/track', () => {
        it('should track event via root endpoint', async () => {
            const res = await request(app)
                .post('/api/track')
                .send({
                    siteId: 'site_test1',
                    type: 'pageview',
                    userId: 'u1',
                    url: 'https://example.com',
                    path: '/',
                    device: 'desktop',
                    browser: 'Chrome',
                    os: 'macOS',
                    country: 'US',
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
    });
});
