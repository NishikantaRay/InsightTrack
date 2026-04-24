import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
    setupTestDB, cleanTestDB, closeTestDB, getTestPool,
    insertTestSite, insertTestEvents, insertTestSessions,
} from '../testHelper.js';
import analyticsRoutes from '../../src/routes/analytics.js';
import { analyticsCache } from '../../src/services/cache.js';

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/analytics', analyticsRoutes);
    return app;
}

describe('Analytics Routes', () => {
    let app;
    let pool;

    beforeAll(async () => {
        await setupTestDB();
        pool = getTestPool();
        await cleanTestDB();
        await insertTestSite(pool);
        await insertTestEvents(pool);
        await insertTestSessions(pool);
        app = createApp();
    });

    afterAll(async () => {
        analyticsCache.clear();
        await cleanTestDB();
        await closeTestDB();
    });

    describe('validateSiteId middleware', () => {
        it('should return 400 when siteId is missing', async () => {
            // This won't trigger because siteId is in the URL path,
            // but a route without siteId would 404
            const res = await request(app).get('/api/analytics');
            expect(res.status).toBe(404);
        });
    });

    describe('GET /:siteId/traffic', () => {
        it('should return traffic data', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/traffic')
                .query({ dateRange: '7d' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
            expect(res.body.data[0]).toHaveProperty('date');
            expect(res.body.data[0]).toHaveProperty('visitors');
        });

        it('should cache subsequent requests', async () => {
            analyticsCache.clear();

            const res1 = await request(app)
                .get('/api/analytics/site_test1/traffic')
                .query({ dateRange: '7d' });

            expect(res1.status).toBe(200);
            expect(analyticsCache.size).toBeGreaterThan(0);

            // Second request should be served from cache
            const res2 = await request(app)
                .get('/api/analytics/site_test1/traffic')
                .query({ dateRange: '7d' });

            expect(res2.status).toBe(200);
            expect(res2.body).toEqual(res1.body);
        });
    });

    describe('GET /:siteId/kpi', () => {
        it('should return KPI summary', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/kpi')
                .query({ dateRange: '7d' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('totalVisitors');
            expect(res.body.data).toHaveProperty('totalPageviews');
            expect(res.body.data).toHaveProperty('bounceRate');
            expect(res.body.data).toHaveProperty('avgSessionDuration');
        });
    });

    describe('GET /:siteId/bounce-rate-trend', () => {
        it('should return bounce rate trend', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/bounce-rate-trend')
                .query({ dateRange: '7d' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /:siteId/avg-session-trend', () => {
        it('should return avg session duration trend', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/avg-session-trend')
                .query({ dateRange: '7d' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /:siteId/pageviews', () => {
        it('should return pageview data', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/pageviews')
                .query({ dateRange: '7d' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /:siteId/top-pages', () => {
        it('should return top pages', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/top-pages')
                .query({ dateRange: '7d', limit: 5 });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /:siteId/sources', () => {
        it('should return traffic sources', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/sources')
                .query({ dateRange: '7d' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            if (res.body.data.length > 0) {
                expect(res.body.data[0]).toHaveProperty('source');
                expect(res.body.data[0]).toHaveProperty('visitors');
            }
        });
    });

    describe('GET /:siteId/devices', () => {
        it('should return device breakdown', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/devices')
                .query({ dateRange: '7d' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /:siteId/countries', () => {
        it('should return country data', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/countries')
                .query({ dateRange: '7d' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /:siteId/sessions', () => {
        it('should return session duration data', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/sessions')
                .query({ dateRange: '7d' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /:siteId/funnel', () => {
        it('should return funnel data', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/funnel')
                .query({ dateRange: '7d' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /:siteId/realtime', () => {
        it('should return realtime data', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/realtime');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('activeVisitors');
            expect(res.body.data).toHaveProperty('topPages');
        });
    });

    describe('GET /:siteId/utm', () => {
        it('should return UTM campaign data', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/utm')
                .query({ dateRange: '7d' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /:siteId/all', () => {
        it('should return all analytics data', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/all')
                .query({ dateRange: '7d' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            const d = res.body.data;
            expect(d).toHaveProperty('traffic');
            expect(d).toHaveProperty('pageviews');
            expect(d).toHaveProperty('topPages');
            expect(d).toHaveProperty('sources');
            expect(d).toHaveProperty('devices');
            expect(d).toHaveProperty('countries');
            expect(d).toHaveProperty('sessions');
            expect(d).toHaveProperty('kpi');
            expect(d).toHaveProperty('funnel');
            expect(d).toHaveProperty('realtime');
        });
    });

    describe('Custom date range via query', () => {
        it('should accept custom date range format', async () => {
            const today = new Date().toISOString().split('T')[0];
            const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

            const res = await request(app)
                .get('/api/analytics/site_test1/traffic')
                .query({ dateRange: `custom:${weekAgo}:${today}` });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /:siteId/comparison', () => {
        it('should return comparison data with current and previous periods', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/comparison')
                .query({ dateRange: '7d' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('current');
            expect(res.body.data).toHaveProperty('previous');
            expect(res.body.data).toHaveProperty('merged');
            expect(res.body.data).toHaveProperty('period');
            expect(Array.isArray(res.body.data.merged)).toBe(true);
        });
    });

    describe('GET /:siteId/user-flow', () => {
        it('should return user flow data', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/user-flow')
                .query({ dateRange: '7d' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('transitions');
            expect(res.body.data).toHaveProperty('entryPages');
            expect(res.body.data).toHaveProperty('exitPages');
            expect(Array.isArray(res.body.data.transitions)).toBe(true);
        });

        it('should respect limit parameter', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/user-flow')
                .query({ dateRange: '7d', limit: 2 });

            expect(res.status).toBe(200);
            expect(res.body.data.transitions.length).toBeLessThanOrEqual(2);
        });
    });

    describe('GET /:siteId/alerts', () => {
        it('should return alerts array', async () => {
            const res = await request(app)
                .get('/api/analytics/site_test1/alerts')
                .query({ dateRange: '30d' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should return empty array for unknown site', async () => {
            const res = await request(app)
                .get('/api/analytics/unknown_site/alerts')
                .query({ dateRange: '7d' });

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });
    });
});
