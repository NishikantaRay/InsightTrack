import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupTestDB, cleanTestDB, closeTestDB, insertTestSite, TEST_SITE_ID } from '../testHelper.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
const { default: analyticsRoutes } = await import('../../src/routes/analytics.js');
const { default: sentryService } = await import('../../src/services/sentryService.js');
const { default: authService } = await import('../../src/services/authService.js');
const { getPool, query } = await import('../../src/db/postgres.js');

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/analytics', analyticsRoutes);
    return app;
}

const url = `/api/analytics/${TEST_SITE_ID}/sentry/issues/7/latest-event`;

// Minimal Response-like for the stubbed Sentry call.
const okEvent = {
    ok: true, status: 200, headers: { get: () => null },
    json: async () => ({
        eventID: 'e1', title: 'Boom',
        entries: [{ type: 'exception', data: { values: [{ type: 'Error', value: 'boom',
            stacktrace: { frames: [{ filename: 'a.js', function: 'f', lineNo: 1, inApp: true }] } }] } }],
        tags: [{ key: 'release', value: '1.0.0' }],
    }),
};

describe('Sentry latest-event route — auth, scoping, drill-down', () => {
    let app, owner, ownerToken, outsider, outsiderToken;

    const asOwner = (req) => req.set('Authorization', `Bearer ${ownerToken}`);
    const asOutsider = (req) => req.set('Authorization', `Bearer ${outsiderToken}`);

    const cleanScoped = async () => {
        const pool = getPool();
        await pool.query(`DELETE FROM sentry_issues WHERE site_id=$1`, [TEST_SITE_ID]).catch(() => {});
        await pool.query(`DELETE FROM site_integrations WHERE site_id=$1`, [TEST_SITE_ID]).catch(() => {});
        await pool.query(`DELETE FROM site_members WHERE site_id=$1`, [TEST_SITE_ID]);
        await pool.query(`DELETE FROM sites WHERE id=$1`, [TEST_SITE_ID]);
    };

    beforeAll(async () => {
        await setupTestDB();
        await cleanTestDB();
        app = createApp();
        ({ user: owner, token: ownerToken } = await authService.register(
            'LE Owner', 'le-owner@test.example.com', 'password-123'));
        ({ user: outsider, token: outsiderToken } = await authService.register(
            'LE Outsider', 'le-outsider@test.example.com', 'password-123'));
    });

    beforeEach(async () => {
        await cleanScoped();
        await insertTestSite(TEST_SITE_ID, 'Test Site', 'test.example.com', owner.id);
        await query(`INSERT INTO site_members (site_id, user_id, role) VALUES ($1,$2,'owner')
                     ON CONFLICT (site_id, user_id) DO NOTHING`, [TEST_SITE_ID, owner.id]);
        await sentryService.upsertIntegration(TEST_SITE_ID, { token: 't', org: 'o', project: 'p' });
        await sentryService._upsertIssue(sentryService._normalize(TEST_SITE_ID, 'p', { id: '7' }));
    });

    afterEach(() => vi.unstubAllGlobals());
    afterAll(async () => { await cleanScoped(); await cleanTestDB(); await closeTestDB(); });

    it('rejects unauthenticated requests', async () => {
        const res = await request(app).get(url);
        expect(res.status).toBe(401);
    });

    it('denies a non-member of the site', async () => {
        const res = await asOutsider(request(app).get(url));
        expect(res.status).toBe(403);
    });

    it('returns the normalized latest event for a member', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okEvent));
        const res = await asOwner(request(app).get(url));
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.exceptionType).toBe('Error');
        expect(res.body.data.frames[0].filename).toBe('a.js');
        expect(res.body.data.tags[0]).toEqual({ key: 'release', value: '1.0.0' });
    });

    it('404s for an issue not belonging to the site', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okEvent));
        const res = await asOwner(request(app).get(`/api/analytics/${TEST_SITE_ID}/sentry/issues/999/latest-event`));
        expect(res.status).toBe(404);
    });
});
