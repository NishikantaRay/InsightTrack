/**
 * Seed the search-visibility demo scenario.
 *
 * Creates everything the one demo question needs:
 *   1. 90 days of pageviews for /guides/email-templates, with a deliberate
 *      -33% week-over-week drop in the last complete week.
 *   2. A keyword mapping: that page → 'free email templates'.
 *   3. Backfilled rank_history so a DELTA exists on first load — without a
 *      prior observation the tool can only report "this is the first snapshot",
 *      which is honest but makes for a flat demo.
 *
 * Idempotent: safe to re-run. Writes to PostgreSQL only (invariant 2); the
 * PG→DuckDB sync makes the events readable by analytics queries.
 *
 * Usage:  npm run seed:search
 */
import { createPool, initializeDatabase, query, closeConnection } from '../src/db/postgres.js';
import dotenv from 'dotenv';

dotenv.config();

const SITE_ID = process.env.SEED_SITE_ID || 'site_demo';
const PATH = '/guides/email-templates';
const KEYWORD = 'free email templates';
// A SECOND keyword that did NOT move. Proves the engine attributes the drop to
// the keyword that actually slipped rather than blaming everything mapped to the
// page — single-keyword demos can't show that.
const KEYWORD_STABLE = 'email marketing software';
const LOCATION = 'United States';

// Weekly pageview totals, oldest → newest. The last COMPLETE week (413) against
// the one before it (616) is the -33% drop the demo explains. A short trailing
// partial week is added so the correlation's in-progress-week guard is exercised.
// The correlation excludes the in-progress week, so the DROP must land on the
// last COMPLETE week — i.e. the second-to-last entry. The final entry is the
// partial current week (only days up to today get seeded), which exists to
// exercise the partial-week guard.
const WEEKLY = [520, 545, 588, 602, 575, 590, 616, 413, 120];

/** Midnight UTC, `daysAgo` days back. */
function dayStart(daysAgo) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d;
}

/**
 * Monday 00:00 UTC of the ISO week containing `d`.
 *
 * The correlation buckets traffic into ISO weeks, so the seed must lay its
 * weekly totals on the SAME boundaries. Spreading them from "today minus N
 * days" splits each intended week across two real ones and smears the drop
 * away — which is exactly what happened before this was added.
 */
export function isoWeekStart(d) {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
    return x;
}

/**
 * Lay WEEKLY totals onto real ISO weeks, ending with the in-progress one.
 *
 * Exported and pure so the two bugs this file hit are regression-tested without
 * a database: (a) every timestamp must land in the ISO week it was meant for,
 * and (b) the drop must sit on the last COMPLETE week, since the correlation
 * discards the partial current week.
 *
 * @returns {Array<{ts: Date, weekIndex: number}>}
 */
export function layOutWeeks(weekly, now = new Date()) {
    const thisWeek = isoWeekStart(now);
    const out = [];
    for (let w = 0; w < weekly.length; w++) {
        const perDay = Math.round(weekly[w] / 7);
        const weeksBack = weekly.length - 1 - w;
        const weekStart = new Date(thisWeek);
        weekStart.setUTCDate(weekStart.getUTCDate() - weeksBack * 7);
        for (let d = 0; d < 7; d++) {
            const base = new Date(weekStart);
            base.setUTCDate(base.getUTCDate() + d);
            if (base > now) continue;            // never seed the future
            for (let i = 0; i < perDay; i++) {
                out.push({
                    ts: new Date(base.getTime() + Math.floor(Math.random() * 86_400_000)),
                    weekIndex: w,
                });
            }
        }
    }
    return out;
}

async function seedPageviews() {
    const { rows: existing } = await query(
        `SELECT COUNT(*)::int AS n FROM events WHERE site_id = $1 AND path = $2`,
        [SITE_ID, PATH],
    );
    if (existing[0].n > 0) {
        console.log(`  · ${PATH} already has ${existing[0].n} events — skipping pageview seed.`);
        return existing[0].n;
    }

    // Rows are kept as tuples (not pre-flattened params) so each insert chunk
    // numbers its own placeholders and there is no index arithmetic to get wrong.
    //
    // events.id is a SERIAL — PostgreSQL assigns it, so it is NOT in the column
    // list below. url/device are filled so rows look like real tracked pageviews.
    const rows = layOutWeeks(WEEKLY).map(({ ts }, n) => ([
        SITE_ID,
        `seed_user_${(n % 240) + 1}`,
        `seed_sess_${Math.floor(n / 3)}`,
        'pageview', PATH, `https://demo.example.com${PATH}`,
        n % 3 === 0 ? 'mobile' : 'desktop',
        ts.toISOString(),
    ]));

    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        let n = 1;
        const placeholders = chunk.map(() => `($${n++}, $${n++}, $${n++}, $${n++}, $${n++}, $${n++}, $${n++}, $${n++})`);
        await query(
            `INSERT INTO events (site_id, user_id, session_id, type, path, url, device, timestamp)
             VALUES ${placeholders.join(', ')}`,
            chunk.flat(),
        );
    }
    return rows.length;
}

async function seedKeyword() {
    await query(
        `INSERT INTO page_keywords (site_id, path, keyword, location, is_primary)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (site_id, path, keyword, location) DO UPDATE SET is_primary = true`,
        [SITE_ID, PATH, KEYWORD, LOCATION],
    );
    await query(
        `INSERT INTO page_keywords (site_id, path, keyword, location, is_primary)
         VALUES ($1, $2, $3, $4, false)
         ON CONFLICT (site_id, path, keyword, location) DO NOTHING`,
        [SITE_ID, PATH, KEYWORD_STABLE, LOCATION],
    );
}

/**
 * Backfill rank history: #3 and cited a week ago, so today's fixture (#6, AI
 * Overview present, not cited) reads as a real change rather than a first
 * observation. Only the PRIOR row is seeded — today's is written by the live
 * (or fixture-backed) check, exactly as it would be in production.
 */
async function seedRankHistory() {
    const { rows } = await query(
        `SELECT COUNT(*)::int AS n FROM rank_history WHERE site_id = $1 AND keyword = $2`,
        [SITE_ID, KEYWORD],
    );
    if (rows[0].n > 0) {
        console.log(`  · rank_history already seeded for '${KEYWORD}' — skipping.`);
        return 0;
    }

    // Two prior observations: stable at #3, cited, with no AI Overview present.
    const priors = [
        { keyword: KEYWORD, daysAgo: 14, position: 3, aiOverview: false, cited: true },
        { keyword: KEYWORD, daysAgo: 7, position: 3, aiOverview: false, cited: true },
        // The stable keyword: unchanged at #4, so the engine must NOT blame it.
        { keyword: KEYWORD_STABLE, daysAgo: 14, position: 4, aiOverview: false, cited: false },
        { keyword: KEYWORD_STABLE, daysAgo: 7, position: 4, aiOverview: false, cited: false },
    ];
    for (const p of priors) {
        await query(
            `INSERT INTO rank_history
               (site_id, keyword, location, device, position, url, ai_overview, is_cited, checked_at)
             VALUES ($1, $2, $3, 'desktop', $4, $5, $6, $7, $8)`,
            [
                SITE_ID, p.keyword, LOCATION, p.position,
                `https://demo.example.com${PATH}`,
                p.aiOverview, p.cited, dayStart(p.daysAgo).toISOString(),
            ],
        );
    }
    return priors.length;
}

async function main() {
    console.log('🔍 Seeding search-visibility demo scenario...\n');
    try {
        createPool();
        await initializeDatabase();

        const events = await seedPageviews();
        console.log(`  ✓ ${events} pageviews for ${PATH}`);

        await seedKeyword();
        console.log(`  ✓ mapped ${PATH} → '${KEYWORD}' + '${KEYWORD_STABLE}'`);

        const ranks = await seedRankHistory();
        console.log(`  ✓ ${ranks} prior rank observations (#3, cited)\n`);

        console.log('✅ Done. Now run `npm run sync` so DuckDB sees the new events, then ask:');
        console.log(`   "Why did traffic to ${PATH} drop last week?"\n`);
    } catch (error) {
        console.error('❌ Search-visibility seeding failed:', error);
        process.exit(1);
    } finally {
        await closeConnection();
    }
}

// Only run when invoked directly — the helpers above are imported by tests.
if (process.argv[1] && process.argv[1].endsWith('seedSearchVisibility.js')) {
    main();
}
