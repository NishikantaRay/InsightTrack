import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'node:crypto';
import { setupTestDB, cleanTestDB, closeTestDB, insertTestSite, TEST_SITE_ID } from '../testHelper.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
const { default: integrationsRoutes } = await import('../../src/routes/integrations.js');
const { default: sentryService } = await import('../../src/services/sentryService.js');
const { getPool, query } = await import('../../src/db/postgres.js');

function createApp() {
    const app = express();
    // Note: NO global express.json() here — the integrations router parses + captures
    // the raw body itself (as it does in index.js, mounted before the global parser).
    app.use('/api/integrations', integrationsRoutes);
    return app;
}

const url = '/api/integrations/sentry/webhook';
const sign = (secret, body) => crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');

describe('Sentry webhook route (public, HMAC-verified)', () => {
    let app, secret;

    const cleanScoped = async () => {
        const pool = getPool();
        await pool.query(`DELETE FROM sentry_issues WHERE site_id=$1`, [TEST_SITE_ID]).catch(() => {});
        await pool.query(`DELETE FROM site_integrations WHERE site_id=$1`, [TEST_SITE_ID]).catch(() => {});
        await pool.query(`DELETE FROM sites WHERE id=$1`, [TEST_SITE_ID]);
    };

    beforeAll(async () => { await setupTestDB(); await cleanTestDB(); app = createApp(); });
    beforeEach(async () => {
        await cleanScoped();
        await insertTestSite();
        const pub = await sentryService.upsertIntegration(TEST_SITE_ID, { token: 't', org: 'o', project: 'frontend' });
        secret = pub.webhookSecret;
    });
    afterAll(async () => { await cleanScoped(); await cleanTestDB(); await closeTestDB(); });

    const post = (body, signature) =>
        request(app).post(url).set('Content-Type', 'application/json')
            .set('sentry-hook-signature', signature).send(body);

    it('accepts a correctly-signed issue event and upserts it', async () => {
        const payload = { action: 'created', data: { issue: { id: '77', title: 'Route hook', level: 'error', project: { slug: 'frontend' } } } };
        const raw = JSON.stringify(payload);
        const res = await post(raw, sign(secret, raw));
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        const { rows } = await query(`SELECT title FROM sentry_issues WHERE issue_id=$1`, [`${TEST_SITE_ID}:77`]);
        expect(rows[0].title).toBe('Route hook');
    });

    it('rejects a wrong signature with 401', async () => {
        const payload = { data: { issue: { id: '78', project: { slug: 'frontend' } } } };
        const raw = JSON.stringify(payload);
        const res = await post(raw, sign('wrong-secret', raw));
        expect(res.status).toBe(401);
    });

    it('rejects a missing signature with 401', async () => {
        const payload = { data: { issue: { id: '79', project: { slug: 'frontend' } } } };
        const res = await request(app).post(url).set('Content-Type', 'application/json').send(JSON.stringify(payload));
        expect(res.status).toBe(401);
    });

    it('400s on an unrecognized payload (even if signed)', async () => {
        const raw = JSON.stringify({ data: {} });
        const res = await post(raw, sign(secret, raw));
        expect(res.status).toBe(400);
    });

    it('404s for an unknown provider (registry dispatch, P3.1)', async () => {
        const res = await request(app).post('/api/integrations/rollbar/webhook')
            .set('Content-Type', 'application/json').send(JSON.stringify({ data: {} }));
        expect(res.status).toBe(404);
    });
});
