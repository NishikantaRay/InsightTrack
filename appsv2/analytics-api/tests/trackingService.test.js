import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDB, cleanTestDB, closeTestDB, insertTestSite, TEST_SITE_ID } from './testHelper.js';
import { trackingService } from '../src/services/trackingService.js';
import { getPool } from '../src/db/postgres.js';

describe('trackingService', () => {
    beforeAll(async () => {
        await setupTestDB();
    });

    beforeEach(async () => {
        await cleanTestDB();
        await insertTestSite();
    });

    afterAll(async () => {
        await cleanTestDB();
        await closeTestDB();
    });

    describe('trackEvent', () => {
        it('should insert a pageview event', async () => {
            const result = await trackingService.trackEvent({
                siteId: TEST_SITE_ID,
                userId: 'u_test_1',
                sessionId: 's_test_1',
                type: 'pageview',
                url: 'https://test.example.com/',
                path: '/',
                device: 'Desktop',
                country: 'India',
            });
            expect(result.success).toBe(true);
            expect(result.sessionId).toBe('s_test_1');

            const pool = getPool();
            const { rows } = await pool.query(
                'SELECT * FROM events WHERE session_id = $1 AND site_id = $2',
                ['s_test_1', TEST_SITE_ID]
            );
            expect(rows.length).toBe(1);
            expect(rows[0].type).toBe('pageview');
            expect(rows[0].country).toBe('India');
        });

        it('should require siteId and userId', async () => {
            await expect(trackingService.trackEvent({ type: 'pageview' }))
                .rejects.toThrow('siteId and userId are required');
        });

        it('should default invalid type to custom', async () => {
            const result = await trackingService.trackEvent({
                siteId: TEST_SITE_ID,
                userId: 'u_test_1',
                type: 'invalid_type',
            });
            expect(result.success).toBe(true);

            const pool = getPool();
            const { rows } = await pool.query(
                "SELECT type FROM events WHERE user_id = 'u_test_1' AND site_id = $1",
                [TEST_SITE_ID]
            );
            expect(rows[0].type).toBe('custom');
        });

        it('should truncate long URLs', async () => {
            const longUrl = 'https://test.example.com/' + 'x'.repeat(3000);
            const result = await trackingService.trackEvent({
                siteId: TEST_SITE_ID,
                userId: 'u_test_1',
                url: longUrl,
            });
            expect(result.success).toBe(true);

            const pool = getPool();
            const { rows } = await pool.query(
                "SELECT url FROM events WHERE user_id = 'u_test_1' AND site_id = $1",
                [TEST_SITE_ID]
            );
            expect(rows[0].url.length).toBeLessThanOrEqual(2048);
        });

        it('should handle UTM parameters', async () => {
            await trackingService.trackEvent({
                siteId: TEST_SITE_ID,
                userId: 'u_test_1',
                utm_source: 'google',
                utm_medium: 'cpc',
                utm_campaign: 'summer',
            });

            const pool = getPool();
            const { rows } = await pool.query(
                "SELECT utm_source, utm_medium, utm_campaign FROM events WHERE user_id = 'u_test_1' AND site_id = $1",
                [TEST_SITE_ID]
            );
            expect(rows[0].utm_source).toBe('google');
            expect(rows[0].utm_medium).toBe('cpc');
            expect(rows[0].utm_campaign).toBe('summer');
        });

        it('should generate a session id when not provided', async () => {
            const result = await trackingService.trackEvent({
                siteId: TEST_SITE_ID,
                userId: 'u_test_1',
            });
            expect(result.sessionId).toBeDefined();
            expect(result.sessionId.length).toBeGreaterThan(0);
        });
    });

    describe('upsertSession', () => {
        it('should create a new session', async () => {
            const result = await trackingService.upsertSession({
                sessionId: 's_test_new',
                siteId: TEST_SITE_ID,
                userId: 'u_test_1',
                entryPage: '/',
                device: 'Desktop',
                country: 'India',
            });
            expect(result.success).toBe(true);

            const pool = getPool();
            const { rows } = await pool.query(
                'SELECT * FROM sessions WHERE id = $1',
                ['s_test_new']
            );
            expect(rows.length).toBe(1);
            expect(rows[0].is_bounce).toBe(true);
            expect(rows[0].pageviews).toBe(1);
        });

        it('should update existing session and increment pageviews', async () => {
            await trackingService.upsertSession({
                sessionId: 's_test_update',
                siteId: TEST_SITE_ID,
                userId: 'u_test_1',
                entryPage: '/',
                device: 'Desktop',
            });

            await trackingService.upsertSession({
                sessionId: 's_test_update',
                siteId: TEST_SITE_ID,
                userId: 'u_test_1',
                exitPage: '/products',
                device: 'Desktop',
            });

            const pool = getPool();
            const { rows } = await pool.query(
                'SELECT * FROM sessions WHERE id = $1',
                ['s_test_update']
            );
            expect(rows.length).toBe(1);
            expect(rows[0].pageviews).toBe(2);
            expect(rows[0].is_bounce).toBe(false);
        });
    });

    describe('endSession', () => {
        it('should finalize session with duration', async () => {
            await trackingService.upsertSession({
                sessionId: 's_test_end',
                siteId: TEST_SITE_ID,
                userId: 'u_test_1',
                entryPage: '/',
            });

            const result = await trackingService.endSession('s_test_end', 120);
            expect(result.success).toBe(true);

            const pool = getPool();
            const { rows } = await pool.query(
                'SELECT duration FROM sessions WHERE id = $1',
                ['s_test_end']
            );
            expect(rows[0].duration).toBe(120);
        });

        it('should return error for nonexistent session', async () => {
            const result = await trackingService.endSession('s_nonexistent', 100);
            expect(result.success).toBe(false);
        });
    });

    describe('trackBatch', () => {
        it('should insert multiple events transactionally', async () => {
            const events = [
                { siteId: TEST_SITE_ID, userId: 'u_batch_1', type: 'pageview', path: '/' },
                { siteId: TEST_SITE_ID, userId: 'u_batch_2', type: 'click', path: '/products' },
            ];

            const result = await trackingService.trackBatch(events);
            expect(result.success).toBe(true);
            expect(result.count).toBe(2);

            const pool = getPool();
            const { rows } = await pool.query(
                "SELECT * FROM events WHERE user_id LIKE 'u_batch_%' AND site_id = $1",
                [TEST_SITE_ID]
            );
            expect(rows.length).toBe(2);
        });
    });
});
