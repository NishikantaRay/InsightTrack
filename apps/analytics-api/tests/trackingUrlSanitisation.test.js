/**
 * URL sanitisation at the ingest boundary — end to end against PostgreSQL.
 *
 * tests/urlPrivacy.test.js covers the sanitiser in isolation. That is not
 * sufficient on its own: unwiring the sanitiser from trackingService leaves
 * those unit tests fully green while every URL is again stored verbatim. These
 * tests assert on what actually lands in the `events` and `sessions` rows, so
 * the wiring itself is covered.
 *
 * Requires PostgreSQL — provisioned automatically by tests/globalSetup.js.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDB, cleanTestDB, closeTestDB, insertTestSite } from './testHelper.js';
import { query } from '../src/db/postgres.js';
import { trackingService } from '../src/services/trackingService.js';

const SITE = 'site_testurl';

beforeAll(async () => {
    await setupTestDB();
});

beforeEach(async () => {
    await cleanTestDB();
    await query(`DELETE FROM events WHERE site_id = $1`, [SITE]);
    await query(`DELETE FROM sessions WHERE site_id = $1`, [SITE]);
    await insertTestSite(SITE, 'URL Test', 'urltest.example.com');
});

afterAll(async () => {
    await query(`DELETE FROM events WHERE site_id = $1`, [SITE]);
    await query(`DELETE FROM sessions WHERE site_id = $1`, [SITE]);
    await closeTestDB();
});

async function lastEvent() {
    const { rows } = await query(
        `SELECT url, path, referrer FROM events WHERE site_id = $1 ORDER BY id DESC LIMIT 1`,
        [SITE]
    );
    return rows[0];
}

describe('trackEvent stores sanitised URLs', () => {
    it('does not persist a reset token from the URL', async () => {
        await trackingService.trackEvent({
            siteId: SITE, userId: 'u1', sessionId: 's1', type: 'pageview',
            url: 'https://shop.example.com/reset?token=SUPERSECRET123&utm_source=email',
            path: '/reset',
        });
        const row = await lastEvent();
        expect(row.url).not.toContain('SUPERSECRET123');
        expect(row.url).toContain('token=REDACTED');
        // Attribution must survive.
        expect(row.url).toContain('utm_source=email');
    });

    it('does not persist a token from the referrer', async () => {
        await trackingService.trackEvent({
            siteId: SITE, userId: 'u1', sessionId: 's1', type: 'pageview',
            url: 'https://shop.example.com/', path: '/',
            referrer: 'https://mail.example.com/msg?access_token=LEAKY_TOKEN',
        });
        const row = await lastEvent();
        expect(row.referrer).not.toContain('LEAKY_TOKEN');
    });

    it('drops a fragment carrying an SPA auth token', async () => {
        await trackingService.trackEvent({
            siteId: SITE, userId: 'u1', sessionId: 's1', type: 'pageview',
            url: 'https://shop.example.com/cb#access_token=FRAGMENT_SECRET',
            path: '/cb',
        });
        const row = await lastEvent();
        expect(row.url).not.toContain('FRAGMENT_SECRET');
    });

    it('leaves ordinary analytics URLs intact', async () => {
        await trackingService.trackEvent({
            siteId: SITE, userId: 'u1', sessionId: 's1', type: 'pageview',
            url: 'https://shop.example.com/search?q=running+shoes&page=2',
            path: '/search',
            referrer: 'https://news.ycombinator.com/item?id=42',
        });
        const row = await lastEvent();
        expect(row.url).toContain('q=running');
        expect(row.url).toContain('page=2');
        expect(row.referrer).toContain('id=42');
        expect(row.path).toBe('/search');
    });

    it('stores NULL for an absent referrer', async () => {
        await trackingService.trackEvent({
            siteId: SITE, userId: 'u1', sessionId: 's1', type: 'pageview',
            url: 'https://shop.example.com/', path: '/',
        });
        expect((await lastEvent()).referrer).toBeNull();
    });
});

describe('batch ingest is sanitised too', () => {
    it('redacts tokens in every batched event', async () => {
        await trackingService.trackBatch([
            {
                siteId: SITE, userId: 'u1', sessionId: 's1', type: 'pageview',
                url: 'https://shop.example.com/a?api_key=BATCH_SECRET_1', path: '/a',
            },
            {
                siteId: SITE, userId: 'u1', sessionId: 's1', type: 'pageview',
                url: 'https://shop.example.com/b?ok=yes', path: '/b',
                referrer: 'https://x.com/r?session=BATCH_SECRET_2',
            },
        ]);

        const { rows } = await query(
            `SELECT url, referrer FROM events WHERE site_id = $1`, [SITE]
        );
        const blob = JSON.stringify(rows);
        expect(blob).not.toContain('BATCH_SECRET_1');
        expect(blob).not.toContain('BATCH_SECRET_2');
        expect(blob).toContain('ok=yes');
    });
});

describe('session entry/exit pages are sanitised', () => {
    it('does not persist a token in entry_page or referrer', async () => {
        await trackingService.upsertSession({
            sessionId: 'sess_url_1', siteId: SITE, userId: 'u1',
            entryPage: '/welcome?invite=SESSION_SECRET',
            exitPage: '/done',
            referrer: 'https://x.com/r?token=SESSION_REF_SECRET',
            device: 'Desktop', country: 'US',
        });

        const { rows } = await query(
            `SELECT entry_page, exit_page, referrer FROM sessions WHERE id = $1`,
            ['sess_url_1']
        );
        const blob = JSON.stringify(rows[0]);
        expect(blob).not.toContain('SESSION_SECRET');
        expect(blob).not.toContain('SESSION_REF_SECRET');
        expect(rows[0].exit_page).toBe('/done');
    });
});
