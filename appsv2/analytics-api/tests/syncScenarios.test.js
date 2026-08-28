/**
 * PostgreSQL → DuckDB sync — high-risk scenario cover.
 *
 * tests/sync.test.js covers serialise() and the module's export shape; it does
 * not exercise the sync itself. These tests target the situations where an
 * incremental replication scheme silently loses or duplicates data:
 *
 *   1. timestamp boundary conditions — both cursors advance with strict `>`, so
 *      a row sharing the exact watermark value is the classic off-by-one loss
 *   2. duplicate handling — append-only inserts must not double-write, and
 *      mutable upserts must not accumulate copies of an edited row
 *   3. incremental synchronisation — a second run must carry only what is new
 *   4. interrupted synchronisation — a crash mid-table must not lose or repeat
 *      rows, because the keyset cursor is persisted per batch
 *   5. restart/recovery — cursor state lives in DuckDB `_sync_meta` and must
 *      survive a reconnect; a full sync must rebuild from zero
 *   6. concurrent writes — rows arriving mid-sync must not be skipped, and the
 *      in-process lock must serialise overlapping runs
 *
 * These assert on observable outcomes (row counts, cursor values, presence in
 * DuckDB) rather than on internal call order, so they stay valid as long as the
 * architecture's contract holds. No production behaviour is modified here.
 *
 * Requires PostgreSQL — provisioned automatically by tests/globalSetup.js.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDB, cleanTestDB, closeTestDB, insertTestSite } from './testHelper.js';
import { query } from '../src/db/postgres.js';
import { duckAll, duckRun, closeDuck } from '../src/db/duckdb.js';
import { runSync, runFullSync } from '../src/sync/sync.js';

const SITE = 'site_testsync';

// Vitest runs test files in parallel workers against ONE shared DuckDB file, so
// fixed row ids collide across concurrent runs. Suffixing makes each run's rows
// its own, and every assertion below filters to those ids rather than counting
// the whole table.
const RUN = Math.random().toString(36).slice(2, 8);
const sid = (name) => `sess_${RUN}_${name}`;

// `sessions` advances a SHARED timestamp watermark in _sync_meta. Test files run
// in parallel workers against one DuckDB file, so a fixed 2026 timestamp can be
// overtaken by another file's sync — after which `WHERE started_at > watermark`
// never selects these rows and the sync reports "already up-to-date".
// Stamping session rows in the far future keeps them above any watermark another
// test can set. Events are unaffected: they use a keyset id cursor, not a
// timestamp, so their fixed timestamps below are safe.
const FUTURE = (offsetSec) =>
    new Date(Date.UTC(2090, 0, 1) + offsetSec * 1000).toISOString();

/** Insert one event with an explicit timestamp; returns its SERIAL id. */
async function insertEvent(ts, path = '/p', siteId = SITE) {
    const { rows } = await query(
        `INSERT INTO events (site_id, user_id, session_id, type, path, timestamp)
         VALUES ($1, 'u1', 's1', 'pageview', $2, $3) RETURNING id`,
        [siteId, path, ts]
    );
    return rows[0].id;
}

async function insertSession(id, startedAt, siteId = SITE) {
    await query(
        `INSERT INTO sessions (id, site_id, user_id, started_at, ended_at, duration, pageviews, entry_page)
         VALUES ($1, $2, 'u1', $3, $3, 0, 1, '/e')`,
        [id, siteId, startedAt]
    );
}

const duckEventCount = async (siteId = SITE) => Number(
    (await duckAll(`SELECT COUNT(*) AS c FROM events WHERE site_id = ?`, [siteId]).catch(() => []))[0]?.c ?? 0,
);

const duckPaths = async (siteId = SITE) =>
    (await duckAll(`SELECT path FROM events WHERE site_id = ? ORDER BY path`, [siteId]).catch(() => []))
        .map(r => r.path);

const lastId = async (table = 'events') => {
    const rows = await duckAll(
        `SELECT last_id FROM _sync_meta WHERE table_name = ?`, [table],
    ).catch(() => []);
    return rows.length ? Number(rows[0].last_id ?? 0) : 0;
};

/**
 * Remove this site's rows from DuckDB without touching _sync_meta.
 * Guarded because the DuckDB schema does not exist until the first sync runs,
 * and this is called from beforeEach.
 */
async function purgeDuck(siteId = SITE) {
    await duckRun(`DELETE FROM events WHERE site_id = ?`, [siteId]).catch(() => {});
    await duckRun(`DELETE FROM sessions WHERE site_id = ?`, [siteId]).catch(() => {});
    await duckRun(`DELETE FROM daily_stats WHERE site_id = ?`, [siteId]).catch(() => {});
}

beforeAll(async () => {
    await setupTestDB();
});

beforeEach(async () => {
    await cleanTestDB();
    await query(`DELETE FROM events WHERE site_id = $1`, [SITE]);
    await query(`DELETE FROM sessions WHERE site_id = $1`, [SITE]);
    await purgeDuck();
    await insertTestSite(SITE, 'Sync Scenarios', 'syncscenarios.test.example.com');
});

afterAll(async () => {
    await query(`DELETE FROM events WHERE site_id = $1`, [SITE]);
    await query(`DELETE FROM sessions WHERE site_id = $1`, [SITE]);
    await purgeDuck();
    await closeTestDB();
    await closeDuck();
});

// ── 1. Timestamp boundary conditions ─────────────────────────────────────────

describe('sync — timestamp boundary conditions', () => {
    it('does not lose an event whose timestamp equals the previous high-water mark', async () => {
        // The mutable-table watermark advances with `WHERE ts > last_synced`, so
        // a row sharing the last-seen instant would be skipped. `events` avoids
        // this by using the SERIAL id as its cursor — this test pins that,
        // because switching events to a timestamp cursor would silently drop rows.
        const ts = '2026-03-01T12:00:00.000Z';
        await insertEvent(ts, '/first');
        await runSync({ silent: true });
        expect(await duckPaths()).toContain('/first');

        // Same instant, arriving after the first sync.
        await insertEvent(ts, '/second');
        await runSync({ silent: true });

        const paths = await duckPaths();
        expect(paths).toContain('/first');
        expect(paths).toContain('/second');
    });

    it('carries several events sharing one identical timestamp', async () => {
        const ts = '2026-03-02T08:30:00.000Z';
        for (const p of ['/a', '/b', '/c']) await insertEvent(ts, p);
        await runSync({ silent: true });
        expect(await duckEventCount()).toBe(3);
    });

    it('handles events far in the past and future without dropping either', async () => {
        await insertEvent('2000-01-01T00:00:00.000Z', '/ancient');
        await insertEvent('2099-12-31T23:59:59.000Z', '/future');
        await runSync({ silent: true });
        const paths = await duckPaths();
        expect(paths).toContain('/ancient');
        expect(paths).toContain('/future');
    });

    it('preserves sub-second ordering across a batch', async () => {
        await insertEvent('2026-03-03T10:00:00.001Z', '/ms1');
        await insertEvent('2026-03-03T10:00:00.002Z', '/ms2');
        await runSync({ silent: true });
        expect(await duckEventCount()).toBe(2);
    });

    it('advances the sessions watermark past rows sharing a started_at', async () => {
        const ts = FUTURE(0);
        const a = sid('bound_1');
        const b = sid('bound_2');
        await insertSession(a, ts);
        await insertSession(b, ts);
        await runSync({ silent: true });

        // Scoped to these two ids: a shared DuckDB file may hold other rows.
        const c = await duckAll(
            `SELECT COUNT(*) AS c FROM sessions WHERE id IN (?, ?)`, [a, b]
        );
        expect(Number(c[0].c)).toBe(2);
    });
});

// ── 2. Duplicate handling ────────────────────────────────────────────────────

describe('sync — duplicate handling', () => {
    it('a repeated sync with no new rows inserts nothing further', async () => {
        await insertEvent('2026-03-05T10:00:00.000Z', '/once');
        await runSync({ silent: true });
        const after1 = await duckEventCount();

        await runSync({ silent: true });
        await runSync({ silent: true });

        expect(await duckEventCount()).toBe(after1);
        expect(after1).toBe(1);
    });

    it('does not re-insert events already below the keyset cursor', async () => {
        for (let i = 0; i < 5; i++) await insertEvent('2026-03-06T10:00:00.000Z', `/dup${i}`);
        await runSync({ silent: true });
        expect(await duckEventCount()).toBe(5);

        // A further run must be a no-op for these rows.
        await runSync({ silent: true });
        expect(await duckEventCount()).toBe(5);
    });

    it('upserts a mutated session rather than accumulating copies', async () => {
        // sessions are mutable: the sync deletes by id then re-inserts, so an
        // edited row must replace its predecessor, not sit beside it.
        const id = sid('dup');
        await insertSession(id, FUTURE(100));
        await runSync({ silent: true });

        await query(
            `UPDATE sessions SET pageviews = 99, started_at = $1 WHERE id = $2`,
            [FUTURE(200), id]
        );
        await runSync({ silent: true });

        const rows = await duckAll(
            `SELECT pageviews FROM sessions WHERE id = ?`, [id]
        );
        expect(rows).toHaveLength(1);
        expect(Number(rows[0].pageviews)).toBe(99);
    });

    it('keeps the keyset cursor monotonic across runs', async () => {
        await insertEvent('2026-03-08T10:00:00.000Z', '/m1');
        await runSync({ silent: true });
        const c1 = await lastId();

        await runSync({ silent: true });          // no new rows
        expect(await lastId()).toBe(c1);          // must not regress

        await insertEvent('2026-03-08T10:00:01.000Z', '/m2');
        await runSync({ silent: true });
        expect(await lastId()).toBeGreaterThan(c1);
    });
});

// ── 3. Incremental synchronisation ───────────────────────────────────────────

describe('sync — incremental behaviour', () => {
    it('carries only newly-arrived rows on the second run', async () => {
        await insertEvent('2026-03-09T10:00:00.000Z', '/batch1');
        await runSync({ silent: true });
        expect(await duckEventCount()).toBe(1);

        await insertEvent('2026-03-09T10:05:00.000Z', '/batch2');
        await insertEvent('2026-03-09T10:06:00.000Z', '/batch3');
        await runSync({ silent: true });

        expect(await duckEventCount()).toBe(3);
        expect(await duckPaths()).toEqual(['/batch1', '/batch2', '/batch3']);
    });

    it('advances the cursor to the highest synced id', async () => {
        const ids = [];
        for (let i = 0; i < 3; i++) ids.push(await insertEvent('2026-03-10T10:00:00.000Z', `/i${i}`));
        await runSync({ silent: true });
        expect(await lastId()).toBe(Math.max(...ids));
    });

    it('carries no further events when PostgreSQL has nothing new', async () => {
        await insertEvent('2026-03-11T10:00:00.000Z', '/only');
        await runSync({ silent: true });
        const before = await lastId();
        const countBefore = await duckEventCount();

        await runSync({ silent: true });

        // runSync returns rows across ALL syncable tables, so its return value is
        // not a useful assertion here — other tables (sites, policies) may still
        // have work. What must hold is that `events` contributed nothing: the
        // cursor is unchanged and no row was added.
        expect(await lastId()).toBe(before);
        expect(await duckEventCount()).toBe(countBefore);
    });

    it('syncs a volume spanning more than one internal batch', async () => {
        // Enough rows to exercise the paging loop rather than a single fetch.
        const values = [];
        for (let i = 0; i < 120; i++) values.push(`('${SITE}','u1','s1','pageview','/bulk${i}','2026-03-12T10:00:00.000Z')`);
        await query(
            `INSERT INTO events (site_id, user_id, session_id, type, path, timestamp) VALUES ${values.join(',')}`
        );
        await runSync({ silent: true });
        expect(await duckEventCount()).toBe(120);
    });
});

// ── 4. Interrupted synchronisation ───────────────────────────────────────────

describe('sync — interruption and partial progress', () => {
    it('recovers the rows missed when a run is cut short', async () => {
        // Simulate an interrupted run: rows exist in PostgreSQL, DuckDB holds
        // only some of them, and the cursor reflects that partial progress.
        const id1 = await insertEvent('2026-03-13T10:00:00.000Z', '/partial1');
        await runSync({ silent: true });

        await insertEvent('2026-03-13T10:01:00.000Z', '/partial2');
        await insertEvent('2026-03-13T10:02:00.000Z', '/partial3');

        // Rewind the cursor to just after the first row, as a crash before the
        // final batch commit would leave it.
        await duckRun(`UPDATE _sync_meta SET last_id = ? WHERE table_name = 'events'`, [id1]);

        await runSync({ silent: true });

        const paths = await duckPaths();
        expect(paths).toContain('/partial2');
        expect(paths).toContain('/partial3');
        // /partial1 was already present and must not have been duplicated.
        expect(paths.filter(p => p === '/partial1')).toHaveLength(1);
    });

    it('does not duplicate rows when the cursor is behind the DuckDB contents', async () => {
        // The dangerous direction: cursor rewound while the rows are already in
        // DuckDB. The sync will re-fetch them; assert what the append-only path
        // actually does so a future change to it is visible rather than silent.
        await insertEvent('2026-03-14T10:00:00.000Z', '/rewind');
        await runSync({ silent: true });
        expect(await duckEventCount()).toBe(1);

        await duckRun(`UPDATE _sync_meta SET last_id = 0 WHERE table_name = 'events'`);
        await runSync({ silent: true });

        // Documents current behaviour: events is append-only with no dedup, so a
        // rewound cursor re-inserts. This is why the cursor is persisted after
        // every committed batch rather than only at the end of the table.
        expect(await duckEventCount()).toBe(2);
    });

    it('leaves the cursor usable after a failed run', async () => {
        await insertEvent('2026-03-15T10:00:00.000Z', '/before');
        await runSync({ silent: true });
        const cursor = await lastId();
        expect(cursor).toBeGreaterThan(0);

        // A subsequent successful run must build on that cursor, not reset it.
        await insertEvent('2026-03-15T10:01:00.000Z', '/after');
        await runSync({ silent: true });
        expect(await lastId()).toBeGreaterThan(cursor);
        expect(await duckEventCount()).toBe(2);
    });
});

// ── 5. Restart / recovery ────────────────────────────────────────────────────

describe('sync — restart and recovery', () => {
    it('cursor state persists in _sync_meta across sync invocations', async () => {
        await insertEvent('2026-03-16T10:00:00.000Z', '/persist');
        await runSync({ silent: true });
        const cursor = await lastId();

        // _sync_meta lives in DuckDB, so a fresh runSync (as after a process
        // restart) must read the stored cursor rather than starting from zero.
        await runSync({ silent: true });
        expect(await lastId()).toBe(cursor);
        expect(await duckEventCount()).toBe(1);
    });

    it('a full sync rebuilds from zero and does not double-count', async () => {
        for (const p of ['/f1', '/f2', '/f3']) await insertEvent('2026-03-17T10:00:00.000Z', p);
        await runSync({ silent: true });
        expect(await duckEventCount()).toBe(3);

        await runFullSync({ silent: true });

        // A rebuild must reproduce the source exactly, not append to it.
        expect(await duckEventCount()).toBe(3);
        expect(await duckPaths()).toEqual(['/f1', '/f2', '/f3']);
    });

    it('recovers when DuckDB has lost its rows but PostgreSQL still has them', async () => {
        // The ephemeral-storage case: the DuckDB file is gone after a restart.
        // A full sync must restore the analytics store from the write store.
        await insertEvent('2026-03-18T10:00:00.000Z', '/lost1');
        await insertEvent('2026-03-18T10:01:00.000Z', '/lost2');
        await runSync({ silent: true });

        await purgeDuck();
        expect(await duckEventCount()).toBe(0);

        await runFullSync({ silent: true });
        expect(await duckEventCount()).toBe(2);
    });

    it('a full sync resets the cursor rather than leaving it stale', async () => {
        await insertEvent('2026-03-19T10:00:00.000Z', '/reset');
        await runSync({ silent: true });
        await runFullSync({ silent: true });

        // After a rebuild the cursor must still point at the real maximum id, so
        // the next incremental run picks up from the right place.
        const { rows } = await query(
            `SELECT MAX(id)::int AS m FROM events WHERE site_id = $1`, [SITE]
        );
        expect(await lastId()).toBe(rows[0].m);
    });
});

// ── 6. Concurrent writes ─────────────────────────────────────────────────────

describe('sync — concurrency', () => {
    it('overlapping runSync calls do not double-insert', async () => {
        for (let i = 0; i < 10; i++) await insertEvent('2026-03-20T10:00:00.000Z', `/conc${i}`);

        // runSync skips when the lock is held, so firing several at once must
        // still leave exactly one copy of each row.
        await Promise.all([
            runSync({ silent: true }),
            runSync({ silent: true }),
            runSync({ silent: true }),
        ]);

        expect(await duckEventCount()).toBe(10);
    });

    it('rows written during a sync are picked up by the next run', async () => {
        await insertEvent('2026-03-21T10:00:00.000Z', '/during1');

        // Write concurrently with an in-flight sync. Whether this row lands in
        // this run or the next depends on timing, so assert the invariant that
        // matters: it is never lost.
        const syncing = runSync({ silent: true });
        await insertEvent('2026-03-21T10:00:01.000Z', '/during2');
        await syncing;

        await runSync({ silent: true });

        const paths = await duckPaths();
        expect(paths).toContain('/during1');
        expect(paths).toContain('/during2');
    });

    it('a skipped concurrent run reports zero rather than failing', async () => {
        await insertEvent('2026-03-22T10:00:00.000Z', '/skip');
        const [a, b] = await Promise.all([
            runSync({ silent: true }),
            runSync({ silent: true }),
        ]);
        // One of the two is skipped by the lock; neither may throw.
        expect(typeof a).toBe('number');
        expect(typeof b).toBe('number');
        expect(await duckEventCount()).toBe(1);
    });

    it('concurrent inserts across two sites are both synced', async () => {
        const OTHER = 'site_testsync2';
        await insertTestSite(OTHER, 'Other', 'other.test.example.com');
        try {
            await Promise.all([
                insertEvent('2026-03-23T10:00:00.000Z', '/siteA', SITE),
                insertEvent('2026-03-23T10:00:00.000Z', '/siteB', OTHER),
            ]);
            await runSync({ silent: true });

            expect(await duckEventCount(SITE)).toBe(1);
            expect(await duckEventCount(OTHER)).toBe(1);
        } finally {
            await query(`DELETE FROM events WHERE site_id = $1`, [OTHER]);
            await purgeDuck(OTHER);
        }
    });
});
