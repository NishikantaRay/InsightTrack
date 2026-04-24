import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDB, cleanTestDB, closeTestDB, getTestPool, insertTestSite } from './testHelper.js';
import { trackingService } from '../src/services/trackingService.js';

describe('TrackingService', () => {
    let pool;

    beforeAll(async () => {
        await setupTestDB();
        pool = getTestPool();
        await cleanTestDB();
        await insertTestSite(pool);
    });

    afterAll(async () => {
        await cleanTestDB();
        await closeTestDB();
    });

    describe('trackEvent', () => {
        it('should track a pageview event', async () => {
            const result = await trackingService.trackEvent({
                siteId: 'site_test1',
                userId: 'u_track_1',
                sessionId: 's_track_1',
                type: 'pageview',
                url: 'https://test.example.com/',
                path: '/',
                device: 'Desktop',
                country: 'United States',
            });

            expect(result).toEqual({ success: true, sessionId: 's_track_1' });

            const dbResult = await pool.query(
                `SELECT * FROM events WHERE session_id = 's_track_1' AND type = 'pageview'`
            );
            expect(dbResult.rows.length).toBe(1);
            expect(dbResult.rows[0].site_id).toBe('site_test1');
            expect(dbResult.rows[0].path).toBe('/');
        });

        it('should track an event with UTM parameters', async () => {
            const result = await trackingService.trackEvent({
                siteId: 'site_test1',
                userId: 'u_track_utm',
                sessionId: 's_track_utm',
                type: 'pageview',
                url: 'https://test.example.com/?utm_source=google',
                path: '/',
                utm_source: 'google',
                utm_medium: 'cpc',
                utm_campaign: 'spring_sale',
                utm_term: 'analytics',
                utm_content: 'banner_ad',
            });

            expect(result.success).toBe(true);

            const dbResult = await pool.query(
                `SELECT * FROM events WHERE session_id = 's_track_utm'`
            );
            expect(dbResult.rows.length).toBe(1);
            expect(dbResult.rows[0].utm_source).toBe('google');
            expect(dbResult.rows[0].utm_medium).toBe('cpc');
            expect(dbResult.rows[0].utm_campaign).toBe('spring_sale');
            expect(dbResult.rows[0].utm_term).toBe('analytics');
            expect(dbResult.rows[0].utm_content).toBe('banner_ad');
        });

        it('should reject invalid event type and default to custom', async () => {
            const result = await trackingService.trackEvent({
                siteId: 'site_test1',
                userId: 'u_track_2',
                type: 'malicious_type',
            });

            expect(result.success).toBe(true);

            const dbResult = await pool.query(
                `SELECT type FROM events WHERE user_id = 'u_track_2'`
            );
            expect(dbResult.rows[0].type).toBe('custom');
        });

        it('should fail without siteId and userId', async () => {
            await expect(
                trackingService.trackEvent({ type: 'pageview' })
            ).rejects.toThrow('siteId and userId are required');
        });

        it('should truncate long strings', async () => {
            const longString = 'a'.repeat(5000);
            const result = await trackingService.trackEvent({
                siteId: 'site_test1',
                userId: 'u_track_long',
                url: longString,
                path: longString,
            });

            expect(result.success).toBe(true);

            const dbResult = await pool.query(
                `SELECT url, path FROM events WHERE user_id = 'u_track_long'`
            );
            expect(dbResult.rows[0].url.length).toBeLessThanOrEqual(2048);
            expect(dbResult.rows[0].path.length).toBeLessThanOrEqual(512);
        });
    });

    describe('upsertSession', () => {
        it('should create a new session', async () => {
            const result = await trackingService.upsertSession({
                sessionId: 's_upsert_1',
                siteId: 'site_test1',
                userId: 'u_upsert_1',
                entryPage: '/',
                exitPage: '/',
                device: 'Mobile',
                country: 'India',
                duration: 0,
                pageviews: 1,
            });

            expect(result).toEqual({ success: true, sessionId: 's_upsert_1' });

            const dbResult = await pool.query(
                `SELECT * FROM sessions WHERE id = 's_upsert_1'`
            );
            expect(dbResult.rows.length).toBe(1);
            expect(dbResult.rows[0].device).toBe('Mobile');
            expect(dbResult.rows[0].is_bounce).toBe(true);
        });

        it('should create a session with UTM parameters', async () => {
            const result = await trackingService.upsertSession({
                sessionId: 's_upsert_utm',
                siteId: 'site_test1',
                userId: 'u_upsert_utm',
                entryPage: '/',
                exitPage: '/',
                device: 'Desktop',
                utm_source: 'facebook',
                utm_medium: 'social',
                utm_campaign: 'brand_awareness',
            });

            expect(result.success).toBe(true);

            const dbResult = await pool.query(
                `SELECT * FROM sessions WHERE id = 's_upsert_utm'`
            );
            expect(dbResult.rows[0].utm_source).toBe('facebook');
            expect(dbResult.rows[0].utm_medium).toBe('social');
            expect(dbResult.rows[0].utm_campaign).toBe('brand_awareness');
        });

        it('should update an existing session with incremented pageviews', async () => {
            // Update the session created above
            await trackingService.upsertSession({
                sessionId: 's_upsert_1',
                siteId: 'site_test1',
                userId: 'u_upsert_1',
                exitPage: '/products',
                duration: 60,
                pageviews: 2,
            });

            const dbResult = await pool.query(
                `SELECT * FROM sessions WHERE id = 's_upsert_1'`
            );
            expect(dbResult.rows[0].pageviews).toBe(2); // incremented from 1
            expect(dbResult.rows[0].exit_page).toBe('/products');
            expect(dbResult.rows[0].is_bounce).toBe(false);
        });
    });

    describe('endSession', () => {
        it('should end an existing session', async () => {
            const result = await trackingService.endSession('s_upsert_1', 120);

            expect(result.success).toBe(true);

            const dbResult = await pool.query(
                `SELECT duration FROM sessions WHERE id = 's_upsert_1'`
            );
            expect(dbResult.rows[0].duration).toBe(120);
        });

        it('should return failure for non-existent session', async () => {
            const result = await trackingService.endSession('nonexistent_session', 10);
            expect(result.success).toBe(false);
        });
    });

    describe('trackBatch', () => {
        it('should insert multiple events in a batch', async () => {
            const events = [
                { siteId: 'site_test1', userId: 'u_batch_1', type: 'pageview', path: '/' },
                { siteId: 'site_test1', userId: 'u_batch_1', type: 'click', path: '/' },
                { siteId: 'site_test1', userId: 'u_batch_2', type: 'pageview', path: '/about' },
            ];

            const result = await trackingService.trackBatch(events);

            expect(result).toEqual({ success: true, count: 3 });

            const dbResult = await pool.query(
                `SELECT COUNT(*) as count FROM events WHERE user_id IN ('u_batch_1', 'u_batch_2')`
            );
            expect(Number(dbResult.rows[0].count)).toBe(3);
        });
    });
});
