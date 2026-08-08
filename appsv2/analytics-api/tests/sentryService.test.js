import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import { setupTestDB, cleanTestDB, closeTestDB, insertTestSite, TEST_SITE_ID } from './testHelper.js';

// secretBox derives its key from JWT_SECRET at import time — set before imports.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const { default: sentryService } = await import('../src/services/sentryService.js');
const { query } = await import('../src/db/postgres.js');

// Build a fake Sentry issue in the shape the API returns.
const issue = (id, over = {}) => ({
    id: String(id),
    shortId: `PROJ-${id}`,
    title: `Error ${id}`,
    culprit: `app/mod${id}`,
    level: 'error',
    status: 'unresolved',
    count: '10',
    userCount: 3,
    permalink: `https://sentry.io/i/${id}/`,
    firstSeen: '2026-07-01T00:00:00Z',
    lastSeen: '2026-07-16T00:00:00Z',
    metadata: {},
    ...over,
});

// A minimal Response-like object for stubbed fetch (with a Link header).
function fakeResponse(body, { status = 200, link = null } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (k) => (k.toLowerCase() === 'link' ? link : null) },
        json: async () => body,
    };
}

async function connect(siteId = TEST_SITE_ID, over = {}) {
    return sentryService.upsertIntegration(siteId, {
        token: 'sntrys_secret_token', org: 'my-org', project: 'frontend', ...over,
    });
}

// Route a stubbed fetch by URL substring so issues/stats/events return the
// right shapes. Each entry: [match, body, opts].
function fetchRouter(routes) {
    return vi.fn(async (url) => {
        for (const [match, body, opts] of routes) {
            if (String(url).includes(match)) return fakeResponse(body, opts || {});
        }
        return fakeResponse([], {});
    });
}

describe('sentryService', () => {
    beforeAll(async () => { await setupTestDB(); });
    beforeEach(async () => { await cleanTestDB(); await insertTestSite(); });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
    afterAll(async () => { await cleanTestDB(); await closeTestDB(); });

    describe('upsertIntegration', () => {
        it('stores the token encrypted (never plaintext) and returns no secret', async () => {
            const pub = await connect();
            expect(pub.connected).toBe(true);
            expect(pub.org).toBe('my-org');
            expect(pub.tokenHint).toMatch(/…/);
            // Public shape must not leak the token.
            expect(JSON.stringify(pub)).not.toContain('sntrys_secret_token');
            // At rest it is a secretBox blob, not the plaintext.
            const { rows } = await query(
                `SELECT token_cipher FROM site_integrations WHERE site_id = $1`, [TEST_SITE_ID]);
            expect(rows[0].token_cipher).not.toContain('sntrys_secret_token');
            expect(rows[0].token_cipher.split('.')).toHaveLength(3); // iv.tag.ct
        });

        it('keeps the existing token when a blank token is supplied on update (by id)', async () => {
            const pub = await connect();
            const before = (await query(`SELECT token_cipher FROM site_integrations WHERE site_id=$1`, [TEST_SITE_ID])).rows[0].token_cipher;
            await sentryService.upsertIntegration(TEST_SITE_ID, { id: pub.id, org: 'my-org', project: 'frontend', baseUrl: 'https://self.example.com' });
            const after = (await query(`SELECT token_cipher, config FROM site_integrations WHERE site_id=$1`, [TEST_SITE_ID])).rows[0];
            expect(after.token_cipher).toBe(before);                  // unchanged
            expect(after.config.baseUrl).toBe('https://self.example.com'); // config updated
        });

        it('keeps the token when re-saving the same (org, project) without an id', async () => {
            await connect();
            const before = (await query(`SELECT token_cipher FROM site_integrations WHERE site_id=$1`, [TEST_SITE_ID])).rows[0].token_cipher;
            await sentryService.upsertIntegration(TEST_SITE_ID, { org: 'my-org', project: 'frontend', baseUrl: 'https://self.example.com' });
            const rows = (await query(`SELECT token_cipher, config FROM site_integrations WHERE site_id=$1`, [TEST_SITE_ID])).rows;
            expect(rows).toHaveLength(1);                              // dedup, not a new row
            expect(rows[0].token_cipher).toBe(before);
        });

        it('rejects missing org/project', async () => {
            await expect(sentryService.upsertIntegration(TEST_SITE_ID, { token: 't', org: '', project: 'x' }))
                .rejects.toThrow(/org and project are required/i);
        });

        it('rejects a first-time connect with no token', async () => {
            await expect(sentryService.upsertIntegration(TEST_SITE_ID, { org: 'o', project: 'p' }))
                .rejects.toThrow(/token is required/i);
        });
    });

    describe('_normalize', () => {
        it('maps a Sentry issue to a row and is resilient to missing fields', () => {
            const r = sentryService._normalize(TEST_SITE_ID, 'frontend', { id: 42, metadata: { value: 'boom' } });
            expect(r.issue_id).toBe(`${TEST_SITE_ID}:42`);
            expect(r.sentry_id).toBe('42');
            expect(r.title).toBe('boom');       // falls back to metadata.value
            expect(r.level).toBe('error');       // default
            expect(r.count).toBe(0);
            expect(r.project_slug).toBe('frontend');
            expect(r.is_regression).toBe(false); // defaults
            expect(r.last_release).toBeNull();
        });

        it('flags regressions (substatus or isRegression) and captures the release', () => {
            const bySubstatus = sentryService._normalize(TEST_SITE_ID, 'p', { id: 1, substatus: 'regressed', lastRelease: { version: '2.3.0' } });
            expect(bySubstatus.is_regression).toBe(true);
            expect(bySubstatus.last_release).toBe('2.3.0');

            const byFlag = sentryService._normalize(TEST_SITE_ID, 'p', { id: 2, isRegression: true, lastRelease: 'v9' });
            expect(byFlag.is_regression).toBe(true);
            expect(byFlag.last_release).toBe('v9');   // accepts a bare string too

            const ongoing = sentryService._normalize(TEST_SITE_ID, 'p', { id: 3, substatus: 'ongoing' });
            expect(ongoing.is_regression).toBe(false);
        });
    });

    describe('_upsertIssue is idempotent by issue_id', () => {
        it('a second upsert updates rather than duplicates', async () => {
            const a = sentryService._normalize(TEST_SITE_ID, 'frontend', issue(1, { count: '5' }));
            await sentryService._upsertIssue(a);
            const b = sentryService._normalize(TEST_SITE_ID, 'frontend', issue(1, { count: '99' }));
            await sentryService._upsertIssue(b);
            const { rows } = await query(`SELECT count FROM sentry_issues WHERE site_id=$1`, [TEST_SITE_ID]);
            expect(rows).toHaveLength(1);
            expect(rows[0].count).toBe(99);
        });

        it('persists is_regression and last_release', async () => {
            const r = sentryService._normalize(TEST_SITE_ID, 'p', { id: 5, substatus: 'regressed', lastRelease: { version: '4.1.0' } });
            await sentryService._upsertIssue(r);
            const { rows } = await query(
                `SELECT is_regression, last_release FROM sentry_issues WHERE site_id=$1`, [TEST_SITE_ID]);
            expect(rows[0].is_regression).toBe(true);
            expect(rows[0].last_release).toBe('4.1.0');
        });
    });

    describe('_fetchIssues pagination', () => {
        it('follows the Link cursor across pages', async () => {
            const fetchMock = vi.fn()
                .mockResolvedValueOnce(fakeResponse([issue(1), issue(2)], { link: '<https://sentry.io/next>; rel="next"; results="true"' }))
                .mockResolvedValueOnce(fakeResponse([issue(3)], { link: '<https://sentry.io/next2>; rel="next"; results="false"' }));
            vi.stubGlobal('fetch', fetchMock);
            const row = await connect();
            const rawRow = (await query(`SELECT * FROM site_integrations WHERE site_id=$1`, [TEST_SITE_ID])).rows[0];
            const issues = await sentryService._fetchIssues(rawRow);
            expect(issues.map(i => i.id)).toEqual(['1', '2', '3']);
            expect(fetchMock).toHaveBeenCalledTimes(2);
            void row;
        });

        it('maps a 401 to a safe auth error', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse({}, { status: 401 })));
            await connect();
            const rawRow = (await query(`SELECT * FROM site_integrations WHERE site_id=$1`, [TEST_SITE_ID])).rows[0];
            await expect(sentryService._fetchIssues(rawRow)).rejects.toMatchObject({ status: 401 });
        });
    });

    describe('pollIntegration', () => {
        it('upserts issues, sets status=ok, and never throws on failure', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse([issue(1), issue(2)])));
            await connect();
            const rawRow = (await query(`SELECT * FROM site_integrations WHERE site_id=$1`, [TEST_SITE_ID])).rows[0];
            const n = await sentryService.pollIntegration(rawRow);
            expect(n).toBe(2);
            const int = await sentryService.getIntegration(TEST_SITE_ID);
            expect(int.status).toBe('ok');
            const { rows } = await query(`SELECT COUNT(*)::int AS c FROM sentry_issues WHERE site_id=$1`, [TEST_SITE_ID]);
            expect(rows[0].c).toBe(2);
        });

        it('records last_error and returns 0 when Sentry fails', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse({}, { status: 500 })));
            await connect();
            const rawRow = (await query(`SELECT * FROM site_integrations WHERE site_id=$1`, [TEST_SITE_ID])).rows[0];
            const n = await sentryService.pollIntegration(rawRow);
            expect(n).toBe(0);
            const int = await sentryService.getIntegration(TEST_SITE_ID);
            expect(int.status).toBe('error');
            expect(int.lastError).toBeTruthy();
        });
    });

    describe('stale reconciliation', () => {
        it('marks issues no longer returned by Sentry as stale', async () => {
            // Poll 1: issues 1 and 2 exist.
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse([issue(1), issue(2)])));
            await connect();
            let rawRow = (await query(`SELECT * FROM site_integrations WHERE site_id=$1`, [TEST_SITE_ID])).rows[0];
            await sentryService.pollIntegration(rawRow);

            // Poll 2: only issue 1 comes back → issue 2 should be marked stale.
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse([issue(1)])));
            await sentryService.pollIntegration(rawRow);

            const { rows } = await query(
                `SELECT sentry_id, stale FROM sentry_issues WHERE site_id=$1 ORDER BY sentry_id`, [TEST_SITE_ID]);
            const byId = Object.fromEntries(rows.map(r => [r.sentry_id, r.stale]));
            expect(byId['1']).toBe(false);
            expect(byId['2']).toBe(true);
        });
    });

    describe('_fetchStats & trend', () => {
        it('rolls Sentry stat pairs up into per-day event counts', async () => {
            const day1 = Math.floor(Date.parse('2026-07-10T00:00:00Z') / 1000);
            const day1b = Math.floor(Date.parse('2026-07-10T12:00:00Z') / 1000);
            const day2 = Math.floor(Date.parse('2026-07-11T00:00:00Z') / 1000);
            vi.stubGlobal('fetch', fetchRouter([
                ['/stats/', [[day1, 3], [day1b, 4], [day2, 10]]],
            ]));
            await connect();
            const rawRow = (await query(`SELECT * FROM site_integrations WHERE site_id=$1`, [TEST_SITE_ID])).rows[0];
            const stats = await sentryService._fetchStats(rawRow);
            const byDate = Object.fromEntries(stats.map(s => [s.date, s.events]));
            expect(byDate['2026-07-10']).toBe(7);   // 3 + 4 rolled up
            expect(byDate['2026-07-11']).toBe(10);
        });

        it('pollIntegration upserts stats rows alongside issues', async () => {
            const ts = Math.floor(Date.parse('2026-07-10T00:00:00Z') / 1000);
            vi.stubGlobal('fetch', fetchRouter([
                ['/issues/', [issue(1)]],
                ['/stats/', [[ts, 5]]],
            ]));
            await connect();
            const rawRow = (await query(`SELECT * FROM site_integrations WHERE site_id=$1`, [TEST_SITE_ID])).rows[0];
            await sentryService.pollIntegration(rawRow);
            const { rows } = await query(`SELECT date, events FROM sentry_stats WHERE site_id=$1`, [TEST_SITE_ID]);
            expect(rows).toHaveLength(1);
            expect(rows[0].events).toBe(5);
        });

        it('a stats failure does not fail the whole poll (issues still upserted)', async () => {
            vi.stubGlobal('fetch', fetchRouter([
                ['/issues/', [issue(1), issue(2)]],
                ['/stats/', {}, { status: 500 }],
            ]));
            await connect();
            const rawRow = (await query(`SELECT * FROM site_integrations WHERE site_id=$1`, [TEST_SITE_ID])).rows[0];
            const n = await sentryService.pollIntegration(rawRow);
            expect(n).toBe(2);
            const int = await sentryService.getIntegration(TEST_SITE_ID);
            expect(int.status).toBe('ok');  // issues succeeded; stats failure swallowed
        });
    });

    describe('getLatestEvent', () => {
        const sampleEvent = {
            eventID: 'abc123', title: 'TypeError: x', platform: 'javascript',
            dateCreated: '2026-07-16T00:00:00Z',
            tags: [{ key: 'browser', value: 'Chrome' }],
            entries: [
                { type: 'exception', data: { values: [{ type: 'TypeError', value: 'x is undefined', stacktrace: { frames: [
                    { filename: 'app.js', function: 'boot', lineNo: 12, inApp: true },
                ] } }] } },
                { type: 'breadcrumbs', data: { values: [{ category: 'ui.click', level: 'info', message: 'clicked', timestamp: 1 }] } },
            ],
        };

        it('normalizes a live event (frames, tags, breadcrumbs)', async () => {
            // Seed an issue so the ownership check passes.
            await connect();
            await sentryService._upsertIssue(sentryService._normalize(TEST_SITE_ID, 'frontend', issue(7)));
            vi.stubGlobal('fetch', fetchRouter([['/events/latest/', sampleEvent]]));
            const ev = await sentryService.getLatestEvent(TEST_SITE_ID, '7');
            expect(ev.exceptionType).toBe('TypeError');
            expect(ev.frames[0]).toMatchObject({ filename: 'app.js', function: 'boot', lineNo: 12, inApp: true });
            expect(ev.tags[0]).toEqual({ key: 'browser', value: 'Chrome' });
            expect(ev.breadcrumbs[0].message).toBe('clicked');
        });

        it('rejects an issue that does not belong to the site (404)', async () => {
            await connect();
            vi.stubGlobal('fetch', fetchRouter([['/events/latest/', sampleEvent]]));
            await expect(sentryService.getLatestEvent(TEST_SITE_ID, '999')).rejects.toMatchObject({ status: 404 });
        });

        it('404s when no integration is connected', async () => {
            await expect(sentryService.getLatestEvent(TEST_SITE_ID, '1')).rejects.toMatchObject({ status: 404 });
        });
    });

    describe('webhook (P2.1)', () => {
        const sign = (secret, body) => crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');

        it('mints a webhook secret on connect and exposes it (not the token)', async () => {
            const pub = await connect();
            expect(pub.webhookConfigured).toBe(true);
            expect(pub.webhookSecret).toMatch(/^[0-9a-f]{48}$/);
            expect(pub.webhookSecret).not.toBe('sntrys_secret_token');
        });

        it('preserves the webhook secret across edits (by id)', async () => {
            const first = await connect();
            const second = await sentryService.upsertIntegration(TEST_SITE_ID, { id: first.id, org: 'my-org', project: 'frontend', baseUrl: 'https://self.example.com' });
            expect(second.webhookSecret).toBe(first.webhookSecret);
        });

        it('gives each project its own webhook secret', async () => {
            const fe = await connect(TEST_SITE_ID, { project: 'frontend' });
            const be = await connect(TEST_SITE_ID, { project: 'backend' });
            expect(fe.webhookSecret).not.toBe(be.webhookSecret);
        });

        it('_verifySignature accepts a valid HMAC and rejects a bad one', () => {
            const secret = 'abc123';
            const body = JSON.stringify({ hello: 'world' });
            expect(sentryService._verifySignature(secret, body, sign(secret, body))).toBe(true);
            expect(sentryService._verifySignature(secret, body, sign('wrong', body))).toBe(false);
            expect(sentryService._verifySignature(secret, body, '')).toBe(false);
        });

        it('handleWebhook verifies the signature, matches the project, and upserts', async () => {
            const pub = await connect(TEST_SITE_ID, { project: 'frontend' });
            const payload = { action: 'created', data: { issue: { id: '555', title: 'Hook boom', level: 'error', project: { slug: 'frontend' } } } };
            const raw = JSON.stringify(payload);
            const res = await sentryService.handleWebhook(payload, raw, sign(pub.webhookSecret, raw));
            expect(res).toMatchObject({ handled: true, siteId: TEST_SITE_ID });
            const { rows } = await query(`SELECT title FROM sentry_issues WHERE issue_id = $1`, [`${TEST_SITE_ID}:555`]);
            expect(rows[0].title).toBe('Hook boom');
        });

        it('handleWebhook rejects a bad signature (401) and does not upsert', async () => {
            await connect(TEST_SITE_ID, { project: 'frontend' });
            const payload = { data: { issue: { id: '556', project: { slug: 'frontend' } } } };
            const raw = JSON.stringify(payload);
            await expect(sentryService.handleWebhook(payload, raw, sign('nope', raw)))
                .rejects.toMatchObject({ status: 401 });
            const { rows } = await query(`SELECT 1 FROM sentry_issues WHERE issue_id = $1`, [`${TEST_SITE_ID}:556`]);
            expect(rows).toHaveLength(0);
        });

        it('handleWebhook 400s on an unrecognized payload', async () => {
            await connect();
            await expect(sentryService.handleWebhook({ data: {} }, '{}', 'x'))
                .rejects.toMatchObject({ status: 400 });
        });
    });

    describe('adaptive cadence (P2.2)', () => {
        const rawRow = async () => (await query(`SELECT * FROM site_integrations WHERE site_id=$1`, [TEST_SITE_ID])).rows[0];

        it('backs off after an idle poll and resets when activity resumes', async () => {
            vi.stubGlobal('fetch', fetchRouter([['/issues/', [issue(1)]]]));
            await connect();
            // Poll 1: new issue → activity → next_poll_at set, idle_polls = 0.
            await sentryService.pollIntegration(await rawRow());
            let row = await rawRow();
            expect(row.idle_polls).toBe(0);
            expect(row.next_poll_at).toBeTruthy();
            // Poll 2: identical issue → no change → idle_polls increments.
            await sentryService.pollIntegration(await rawRow());
            row = await rawRow();
            expect(row.idle_polls).toBe(1);
        });

        it('auth failures back off hard and status=error', async () => {
            vi.stubGlobal('fetch', fetchRouter([['/issues/', {}, { status: 401 }]]));
            await connect();
            await sentryService.pollIntegration(await rawRow());
            const row = await rawRow();
            expect(row.status).toBe('error');
            // next_poll_at should be well into the future (auth-fail cadence).
            expect(new Date(row.next_poll_at).getTime()).toBeGreaterThan(Date.now() + 60 * 60 * 1000);
        });

        it('surfaces authError=true after a token rejection, and false after a transient failure (P3.3)', async () => {
            // 401 → token rejected → authError true.
            vi.stubGlobal('fetch', fetchRouter([['/issues/', {}, { status: 401 }]]));
            await connect();
            await sentryService.pollIntegration(await rawRow());
            let pub = await sentryService.getIntegration(TEST_SITE_ID);
            expect(pub.status).toBe('error');
            expect(pub.authError).toBe(true);

            // 500 → transient → error but NOT an authError.
            vi.stubGlobal('fetch', fetchRouter([['/issues/', {}, { status: 500 }]]));
            await query(`UPDATE site_integrations SET next_poll_at = NULL WHERE site_id=$1`, [TEST_SITE_ID]);
            await sentryService.pollIntegration(await rawRow());
            pub = await sentryService.getIntegration(TEST_SITE_ID);
            expect(pub.status).toBe('error');
            expect(pub.authError).toBe(false);
        });

        it('a successful test clears backoff (next_poll_at nulled)', async () => {
            vi.stubGlobal('fetch', fetchRouter([['/issues/', {}, { status: 401 }]]));
            const pub = await connect();
            await sentryService.pollIntegration(await rawRow());
            expect((await rawRow()).next_poll_at).toBeTruthy();
            // Now the token works again; testIntegration should clear the backoff.
            vi.stubGlobal('fetch', fetchRouter([['/issues/', [issue(1)]]]));
            await sentryService.testIntegration(pub.id, TEST_SITE_ID);
            const row = await rawRow();
            expect(row.next_poll_at).toBeNull();
            expect(row.idle_polls).toBe(0);
        });

        it('pollAllSentry skips integrations whose next_poll_at is in the future', async () => {
            vi.stubGlobal('fetch', fetchRouter([['/issues/', [issue(1)]]]));
            await connect();
            // Force a far-future next_poll_at.
            await query(`UPDATE site_integrations SET next_poll_at = NOW() + interval '1 hour' WHERE site_id=$1`, [TEST_SITE_ID]);
            const total = await sentryService.pollAllSentry({ silent: true });
            expect(total).toBe(0);   // skipped — not due
        });
    });

    describe('multiple projects per site (P2.3)', () => {
        it('connects N projects and lists them all; re-saving a project dedups', async () => {
            await connect(TEST_SITE_ID, { project: 'frontend' });
            await connect(TEST_SITE_ID, { project: 'backend' });
            let list = await sentryService.getIntegrations(TEST_SITE_ID);
            expect(list).toHaveLength(2);
            // Re-save frontend (no id, same org/project) → updates in place.
            await connect(TEST_SITE_ID, { project: 'frontend', baseUrl: 'https://self.example.com' });
            list = await sentryService.getIntegrations(TEST_SITE_ID);
            expect(list).toHaveLength(2);
            expect(list.find((i) => i.project === 'frontend').baseUrl).toBe('https://self.example.com');
        });

        it('poll isolates stale reconciliation per project', async () => {
            const fe = await connect(TEST_SITE_ID, { project: 'frontend' });
            const be = await connect(TEST_SITE_ID, { project: 'backend' });
            const rowById = async (id) => (await query(`SELECT * FROM site_integrations WHERE id=$1`, [id])).rows[0];

            // frontend has issues 1,2; backend has issue 9.
            vi.stubGlobal('fetch', fetchRouter([['/issues/', [issue(1), issue(2)]]]));
            await sentryService.pollIntegration(await rowById(fe.id));
            vi.stubGlobal('fetch', fetchRouter([['/issues/', [issue(9)]]]));
            await sentryService.pollIntegration(await rowById(be.id));

            // Now frontend re-polls and only returns issue 1 → issue 2 stale,
            // but backend's issue 9 must NOT be touched.
            vi.stubGlobal('fetch', fetchRouter([['/issues/', [issue(1)]]]));
            await sentryService.pollIntegration(await rowById(fe.id));

            const { rows } = await query(
                `SELECT sentry_id, project_slug, stale FROM sentry_issues WHERE site_id=$1 ORDER BY sentry_id`, [TEST_SITE_ID]);
            const by = Object.fromEntries(rows.map((r) => [r.sentry_id, r.stale]));
            expect(by['1']).toBe(false);
            expect(by['2']).toBe(true);   // frontend issue reconciled stale
            expect(by['9']).toBe(false);  // backend issue untouched
        });

        it('stores stats per project (distinct stat rows per project+date)', async () => {
            const fe = await connect(TEST_SITE_ID, { project: 'frontend' });
            const be = await connect(TEST_SITE_ID, { project: 'backend' });
            const ts = Math.floor(Date.parse('2026-07-10T00:00:00Z') / 1000);
            const rowById = async (id) => (await query(`SELECT * FROM site_integrations WHERE id=$1`, [id])).rows[0];

            vi.stubGlobal('fetch', fetchRouter([['/issues/', [issue(1)]], ['/stats/', [[ts, 3]]]]));
            await sentryService.pollIntegration(await rowById(fe.id));
            vi.stubGlobal('fetch', fetchRouter([['/issues/', [issue(9)]], ['/stats/', [[ts, 5]]]]));
            await sentryService.pollIntegration(await rowById(be.id));

            const { rows } = await query(
                `SELECT project_slug, events FROM sentry_stats WHERE site_id=$1 ORDER BY project_slug`, [TEST_SITE_ID]);
            expect(rows).toHaveLength(2);                       // one per project — not overwritten
            expect(rows.map((r) => r.events).sort()).toEqual([3, 5]);
        });
    });

    describe('deleteIntegration', () => {
        it('removes one integration by id (leaving others)', async () => {
            const a = await connect(TEST_SITE_ID, { project: 'frontend' });
            await connect(TEST_SITE_ID, { project: 'backend' });
            await sentryService.deleteIntegration(a.id, TEST_SITE_ID);
            const list = await sentryService.getIntegrations(TEST_SITE_ID);
            expect(list).toHaveLength(1);
            expect(list[0].project).toBe('backend');
        });

        it('404s when the integration does not belong to the site', async () => {
            const a = await connect();
            await expect(sentryService.deleteIntegration(a.id, 'site_test_other'))
                .rejects.toMatchObject({ status: 404 });
        });
    });
});
