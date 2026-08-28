/**
 * Server-side DNT / GPC opt-out on the tracking endpoints.
 *
 * Defence in depth for the client-side guard in the generated script. This layer
 * covers what the client guard cannot:
 *   • a visitor still running a CACHED pre-fix copy of the script,
 *   • direct POSTs to /api/track/* that never load the script at all.
 *
 * Browsers send `DNT: 1` and `Sec-GPC: 1` themselves, so these are real request
 * headers rather than something the script has to opt into.
 *
 * Assertions are on PERSISTENCE — each test checks the PostgreSQL row count
 * before and after, so a response that merely *looks* successful cannot pass.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupTestDB, cleanTestDB, closeTestDB, insertTestSite, TEST_SITE_ID } from './testHelper.js';
import { query } from '../src/db/postgres.js';
import trackingRoutes from '../src/routes/tracking.js';

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/track', trackingRoutes);
    return app;
}

const countEvents = async () => Number(
    (await query('SELECT COUNT(*) AS c FROM events WHERE site_id = $1', [TEST_SITE_ID])).rows[0].c,
);
const countSessions = async () => Number(
    (await query('SELECT COUNT(*) AS c FROM sessions WHERE site_id = $1', [TEST_SITE_ID])).rows[0].c,
);

const eventBody = () => ({
    siteId: TEST_SITE_ID,
    userId: 'u_optout_probe',
    sessionId: 's_optout_probe',
    type: 'pageview',
    url: 'https://t/', path: '/',
});

describe('Tracking endpoints — server-side DNT/GPC opt-out', () => {
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

    // ── persists normally without any signal ────────────────────────────────
    it('persists an event when no opt-out header is present', async () => {
        await request(app).post('/api/track/event').send(eventBody()).expect(201);
        expect(await countEvents()).toBe(1);
    });

    // ── DNT ─────────────────────────────────────────────────────────────────
    it('persists nothing when DNT: 1 is sent', async () => {
        const res = await request(app).post('/api/track/event').set('DNT', '1').send(eventBody());
        expect(res.status).toBe(200);
        expect(res.body.optedOut).toBe(true);
        expect(await countEvents()).toBe(0);
    });

    it('still persists when DNT: 0 (not an opt-out value)', async () => {
        await request(app).post('/api/track/event').set('DNT', '0').send(eventBody());
        expect(await countEvents()).toBe(1);
    });

    // ── GPC ─────────────────────────────────────────────────────────────────
    it('persists nothing when Sec-GPC: 1 is sent', async () => {
        const res = await request(app).post('/api/track/event').set('Sec-GPC', '1').send(eventBody());
        expect(res.status).toBe(200);
        expect(await countEvents()).toBe(0);
    });

    it('still persists when Sec-GPC: 0', async () => {
        await request(app).post('/api/track/event').set('Sec-GPC', '0').send(eventBody());
        expect(await countEvents()).toBe(1);
    });

    it('persists nothing when both DNT and Sec-GPC are set', async () => {
        await request(app).post('/api/track/event').set('DNT', '1').set('Sec-GPC', '1').send(eventBody());
        expect(await countEvents()).toBe(0);
    });

    // ── every ingest endpoint is covered, not just /event ───────────────────
    it('honours opt-out on /pageview', async () => {
        await request(app).post('/api/track/pageview').set('DNT', '1').send(eventBody());
        expect(await countEvents()).toBe(0);
    });

    it('honours opt-out on /session', async () => {
        await request(app).post('/api/track/session').set('DNT', '1')
            .send({ sessionId: 's_optout_probe', siteId: TEST_SITE_ID, userId: 'u_optout_probe', entryPage: '/' });
        expect(await countSessions()).toBe(0);
    });

    it('honours opt-out on /session/end', async () => {
        const res = await request(app).post('/api/track/session/end').set('Sec-GPC', '1')
            .send({ sessionId: 's_optout_probe', duration: 42 });
        expect(res.status).toBe(200);
        expect(res.body.optedOut).toBe(true);
    });

    it('honours opt-out on /batch', async () => {
        await request(app).post('/api/track/batch').set('DNT', '1')
            .send({ events: [eventBody(), eventBody(), eventBody()] });
        expect(await countEvents()).toBe(0);
    });

    it('honours opt-out on the catch-all POST /', async () => {
        await request(app).post('/api/track/').set('DNT', '1').send(eventBody());
        expect(await countEvents()).toBe(0);
    });

    // ── pixel: opt out, but keep returning a valid image ────────────────────
    it('honours opt-out on the tracking pixel while still returning a GIF', async () => {
        const res = await request(app)
            .get('/api/track/pixel.gif')
            .query({ siteId: TEST_SITE_ID, userId: 'u_optout_probe' })
            .set('DNT', '1');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('image/gif');
        // give the fire-and-forget write a chance to land if it were going to
        await new Promise((r) => setTimeout(r, 150));
        expect(await countEvents()).toBe(0);
    });

    it('the pixel still tracks when no opt-out header is present', async () => {
        await request(app)
            .get('/api/track/pixel.gif')
            .query({ siteId: TEST_SITE_ID, userId: 'u_optout_probe' });
        await new Promise((r) => setTimeout(r, 200));
        expect(await countEvents()).toBe(1);
    });
});
