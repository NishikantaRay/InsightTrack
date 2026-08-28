/**
 * Retention cleanup — PostgreSQL ↔ DuckDB consistency.
 *
 * Regression cover for a confirmed defect: runRetentionCleanup() deleted expired
 * rows from PostgreSQL only, while every dashboard, SQL Editor, Pulse and MCP
 * read queries DuckDB. The PG→DuckDB sync is additive (append-only keyset cursor
 * for `events`, timestamp watermark + upsert for `sessions`), so it can never
 * observe a deleted row. Data reported as deleted stayed fully queryable.
 *
 * These tests assert the full lifecycle against BOTH stores: write to PG → sync
 * to DuckDB → confirm queryable → clean up → confirm gone from both. The
 * resurrection test is the important one: it proves a later incremental sync does
 * not re-import rows that were removed.
 *
 * Requires PostgreSQL — provisioned automatically by tests/globalSetup.js.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDB, cleanTestDB, closeTestDB, insertTestSite } from './testHelper.js';
import { query } from '../src/db/postgres.js';
import { duckAll, duckRun, closeDuck } from '../src/db/duckdb.js';
import { runSync, applyRetentionDeletionToDuck } from '../src/sync/sync.js';
import reportingService from '../src/services/reportingService.js';

const SITE_A = 'site_testret_a';
const SITE_B = 'site_testret_b';

const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
};

/** Insert one event directly into PostgreSQL. */
async function pgEvent(siteId, timestamp, path = '/p') {
    await query(
        `INSERT INTO events (site_id, user_id, session_id, type, url, path, timestamp, properties)
         VALUES ($1,$2,$3,'pageview','https://t/','${path}',$4,'{}')`,
        [siteId, `u_${Math.random().toString(36).slice(2, 8)}`, `s_${Math.random().toString(36).slice(2, 8)}`, timestamp],
    );
}

async function pgSession(siteId, startedAt) {
    const id = `s_${Math.random().toString(36).slice(2, 10)}`;
    await query(
        `INSERT INTO sessions (id, site_id, user_id, started_at, ended_at, duration, pageviews)
         VALUES ($1,$2,'u_x',$3,$3,10,1)`,
        [id, siteId, startedAt],
    );
    return id;
}

const pgCount = async (table, siteId) => Number(
    (await query(`SELECT COUNT(*) AS c FROM ${table} WHERE site_id = $1`, [siteId])).rows[0].c,
);
const duckCount = async (table, siteId) => Number(
    (await duckAll(`SELECT COUNT(*) AS c FROM ${table} WHERE site_id = ?`, [siteId]))[0]?.c ?? 0,
);

/** Enable a retention policy of N days for a site. */
async function setPolicy(siteId, days) {
    await reportingService.upsertRetentionPolicy({ siteId, retentionDays: days, enabled: true });
}

describe('Retention cleanup — PostgreSQL → DuckDB consistency', () => {
    beforeAll(async () => {
        await setupTestDB();
    });

    beforeEach(async () => {
        await cleanTestDB();
        for (const s of [SITE_A, SITE_B]) {
            await query(`DELETE FROM data_retention_policies WHERE site_id = $1`, [s]);
            await duckRun(`DELETE FROM events WHERE site_id = ?`, [s]).catch(() => {});
            await duckRun(`DELETE FROM sessions WHERE site_id = ?`, [s]).catch(() => {});
            await duckRun(`DELETE FROM daily_stats WHERE site_id = ?`, [s]).catch(() => {});
        }
        await insertTestSite(SITE_A, 'Ret A', 'a.test.example.com');
        await insertTestSite(SITE_B, 'Ret B', 'b.test.example.com');
    });

    afterAll(async () => {
        await cleanTestDB();
        await closeTestDB();
        await closeDuck();
    });

    it('deletes an expired event from BOTH PostgreSQL and DuckDB', async () => {
        await pgEvent(SITE_A, daysAgo(100));
        await runSync({ silent: true });

        // 3. queryable from DuckDB before cleanup
        expect(await duckCount('events', SITE_A)).toBe(1);
        expect(await pgCount('events', SITE_A)).toBe(1);

        await setPolicy(SITE_A, 30);
        const result = await reportingService.runRetentionCleanup(SITE_A);

        expect(result.deletedEvents).toBe(1);
        expect(await pgCount('events', SITE_A)).toBe(0);   // gone from PG
        expect(await duckCount('events', SITE_A)).toBe(0); // gone from DuckDB — the actual fix
    });

    it('deletes expired sessions from both stores', async () => {
        await pgSession(SITE_A, daysAgo(100));
        await runSync({ silent: true });
        expect(await duckCount('sessions', SITE_A)).toBe(1);

        await setPolicy(SITE_A, 30);
        await reportingService.runRetentionCleanup(SITE_A);

        expect(await pgCount('sessions', SITE_A)).toBe(0);
        expect(await duckCount('sessions', SITE_A)).toBe(0);
    });

    it('deletes MULTIPLE expired records', async () => {
        for (let i = 0; i < 5; i++) await pgEvent(SITE_A, daysAgo(100 + i));
        await runSync({ silent: true });
        expect(await duckCount('events', SITE_A)).toBe(5);

        await setPolicy(SITE_A, 30);
        const r = await reportingService.runRetentionCleanup(SITE_A);

        expect(r.deletedEvents).toBe(5);
        expect(await duckCount('events', SITE_A)).toBe(0);
    });

    it('leaves NON-expired records untouched in both stores', async () => {
        await pgEvent(SITE_A, daysAgo(100));  // expired
        await pgEvent(SITE_A, daysAgo(5));    // fresh
        await runSync({ silent: true });
        expect(await duckCount('events', SITE_A)).toBe(2);

        await setPolicy(SITE_A, 30);
        await reportingService.runRetentionCleanup(SITE_A);

        expect(await pgCount('events', SITE_A)).toBe(1);
        expect(await duckCount('events', SITE_A)).toBe(1);
    });

    it('does not touch another site — cleanup for A cannot delete B', async () => {
        await pgEvent(SITE_A, daysAgo(100));
        await pgEvent(SITE_B, daysAgo(100));   // equally old, different tenant
        await runSync({ silent: true });
        expect(await duckCount('events', SITE_B)).toBe(1);

        await setPolicy(SITE_A, 30);
        await reportingService.runRetentionCleanup(SITE_A);

        expect(await duckCount('events', SITE_A)).toBe(0);
        expect(await pgCount('events', SITE_B)).toBe(1);    // B untouched in PG
        expect(await duckCount('events', SITE_B)).toBe(1);  // B untouched in DuckDB
    });

    it('is idempotent — repeated cleanup is safe', async () => {
        await pgEvent(SITE_A, daysAgo(100));
        await runSync({ silent: true });
        await setPolicy(SITE_A, 30);

        const first = await reportingService.runRetentionCleanup(SITE_A);
        const second = await reportingService.runRetentionCleanup(SITE_A);
        const third = await reportingService.runRetentionCleanup(SITE_A);

        expect(first.deletedEvents).toBe(1);
        expect(second.deletedEvents).toBe(0);
        expect(third.deletedEvents).toBe(0);
        expect(await duckCount('events', SITE_A)).toBe(0);
    });

    it('a later incremental sync does NOT resurrect deleted records', async () => {
        // The subtle one. `events` syncs on a keyset cursor; if cleanup reset or
        // corrupted that cursor, the next sync would re-import the deleted rows.
        await pgEvent(SITE_A, daysAgo(100));
        await pgEvent(SITE_A, daysAgo(5));
        await runSync({ silent: true });

        await setPolicy(SITE_A, 30);
        await reportingService.runRetentionCleanup(SITE_A);
        expect(await duckCount('events', SITE_A)).toBe(1);

        // Normal incremental sync, then a new write, then another sync.
        await runSync({ silent: true });
        expect(await duckCount('events', SITE_A)).toBe(1);   // still gone

        await pgEvent(SITE_A, daysAgo(1));
        await runSync({ silent: true });

        // New row arrives; the deleted one stays deleted.
        expect(await duckCount('events', SITE_A)).toBe(2);
        expect(await pgCount('events', SITE_A)).toBe(2);
    });

    it('removes daily_stats rows derived from deleted events', async () => {
        // daily_stats is a DuckDB-owned rollup that recomputes only forward from
        // MAX(date), so stale aggregates would otherwise survive and keep being
        // served to the dashboard.
        await duckRun(
            `INSERT INTO daily_stats (site_id, date, visitors, sessions, pageviews, bounces, avg_duration, computed_at)
             VALUES (?, ?, 99, 99, 99, 0, 0.0, current_timestamp)`,
            [SITE_A, daysAgo(100).split('T')[0]],
        );
        expect(await duckCount('daily_stats', SITE_A)).toBe(1);

        await setPolicy(SITE_A, 30);
        await reportingService.runRetentionCleanup(SITE_A);

        expect(await duckCount('daily_stats', SITE_A)).toBe(0);
    });

    it('does nothing when the policy is disabled', async () => {
        await pgEvent(SITE_A, daysAgo(100));
        await runSync({ silent: true });
        await reportingService.upsertRetentionPolicy({ siteId: SITE_A, retentionDays: 30, enabled: false });

        const r = await reportingService.runRetentionCleanup(SITE_A);

        expect(r.deleted).toBe(0);
        expect(await pgCount('events', SITE_A)).toBe(1);
        expect(await duckCount('events', SITE_A)).toBe(1);
    });

    it('reports what was removed from DuckDB alongside the PG counts', async () => {
        await pgEvent(SITE_A, daysAgo(100));
        await pgSession(SITE_A, daysAgo(100));
        await runSync({ silent: true });

        await setPolicy(SITE_A, 30);
        const r = await reportingService.runRetentionCleanup(SITE_A);

        expect(r.duckdb).toBeDefined();
        expect(r.duckdb.events).toBe(1);
        expect(r.duckdb.sessions).toBe(1);
    });
});

describe('applyRetentionDeletionToDuck — contract', () => {
    beforeAll(async () => { await setupTestDB(); });
    afterAll(async () => { await closeTestDB(); await closeDuck(); });

    it('requires both a siteId and a cutoff', async () => {
        await expect(applyRetentionDeletionToDuck(null, new Date().toISOString())).rejects.toThrow();
        await expect(applyRetentionDeletionToDuck('site_x', null)).rejects.toThrow();
    });

    it('does not modify _sync_meta (the keyset cursor must keep advancing)', async () => {
        const snap = () => duckAll(`SELECT table_name, last_id, last_synced FROM _sync_meta ORDER BY table_name`)
            .then((rows) => rows.map((r) => `${r.table_name}:${String(r.last_id)}:${String(r.last_synced)}`).join('|'));
        const before = await snap();
        await applyRetentionDeletionToDuck('site_nonexistent_zzz', new Date().toISOString());
        expect(await snap()).toBe(before);
    });
});

describe('runAllRetentionCleanups — the scheduler sweep', () => {
    it('cleans every site with an enabled policy, and skips those without', async () => {
        // SITE_A gets a policy; SITE_B deliberately does not.
        await insertTestSite(SITE_A, 'Ret A', 'a.example.com');
        await insertTestSite(SITE_B, 'Ret B', 'b.example.com');

        const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
        for (const site of [SITE_A, SITE_B]) {
            await query(
                `INSERT INTO events (site_id, user_id, session_id, type, path, timestamp)
                 VALUES ($1, 'u1', 's1', 'pageview', '/old', $2)`,
                [site, old]
            );
        }

        await reportingService.upsertRetentionPolicy({
            siteId: SITE_A, retentionDays: 30, enabled: true,
        });

        const summary = await reportingService.runAllRetentionCleanups();
        expect(summary.sites).toBe(1);
        expect(summary.results[0]).toMatchObject({ siteId: SITE_A, ok: true });

        const a = await query(`SELECT COUNT(*)::int AS c FROM events WHERE site_id = $1`, [SITE_A]);
        const b = await query(`SELECT COUNT(*)::int AS c FROM events WHERE site_id = $1`, [SITE_B]);
        expect(a.rows[0].c).toBe(0);   // swept
        expect(b.rows[0].c).toBe(1);   // no policy — untouched
    });

    it('does nothing when no policy is enabled', async () => {
        await insertTestSite(SITE_A, 'Ret A', 'a.example.com');
        await reportingService.upsertRetentionPolicy({
            siteId: SITE_A, retentionDays: 30, enabled: false,
        });
        expect((await reportingService.runAllRetentionCleanups()).sites).toBe(0);
    });

    it('one site failing does not stop the others', async () => {
        await insertTestSite(SITE_A, 'Ret A', 'a.example.com');
        await reportingService.upsertRetentionPolicy({
            siteId: SITE_A, retentionDays: 30, enabled: true,
        });
        // A policy row for a site that no longer exists must not throw the sweep.
        await query(
            `INSERT INTO data_retention_policies (id, site_id, retention_days, enabled)
             VALUES ('pol_ghost', 'site_ghost_gone', 30, TRUE)`
        );
        const summary = await reportingService.runAllRetentionCleanups();
        expect(summary.sites).toBe(2);
        expect(summary.results.filter(r => r.ok).length).toBeGreaterThanOrEqual(1);
    });
});
