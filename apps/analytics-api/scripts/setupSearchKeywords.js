#!/usr/bin/env node
/**
 * Set up rank tracking from a CREDIT BUDGET, using real traffic.
 *
 * The existing setupStudytub.js maps a hardcoded list of static paths. That list
 * was written against the site's page files, but visitors arrive on quite
 * different URLs — a Drive mount, query strings, generated pages — so it tracks
 * pages that may get no search traffic at all. A keyword whose page nobody lands
 * on can never explain a traffic change, and still spends a credit every sweep.
 *
 * So this starts from the other end:
 *
 *   1. Read the site's busiest pages from first-party analytics
 *   2. Derive a keyword for each (percent-decoded, app routes and file types
 *      dropped — see keywordDiscoveryService)
 *   3. Work out how many of those a monthly credit budget actually affords
 *   4. Map that many, busiest first, and set the cadence to match
 *
 * The budget is the input, not an afterthought. Costing it out AFTER mapping is
 * how you end up 200 credits over on a 250-credit plan.
 *
 * Spends ZERO SerpApi credits: every signal used here is first-party.
 *
 * Usage:
 *   npm run setup:keywords -- --site site_abc123 --budget 250
 *   npm run setup:keywords -- --site site_abc123 --budget 250 --dry-run
 *
 * Options (each has an env-var equivalent, for hosts with no shell):
 *   --site      SEARCH_SETUP_SITE_ID   site id (required)
 *   --budget    SEARCH_SETUP_BUDGET    SerpApi searches per month (default 250)
 *   --max       SEARCH_SETUP_MAX       ceiling on keywords (default 40)
 *   --location  SEARCH_SETUP_LOCATION  SERP locale (default "India")
 *   --days      SEARCH_SETUP_DAYS      traffic window (default 90d)
 *   --by        SEARCH_SETUP_BY        "movement" (default) or "traffic"
 *   --min-move  SEARCH_SETUP_MIN_MOVE  min weekly visitor change (default 3)
 *   --exclude   SEARCH_SETUP_EXCLUDE   comma-separated path prefixes to skip
 *   --dry-run   SEARCH_SETUP_DRY_RUN=1 print the plan, write nothing
 */
import { createPool, initializeDatabase, query, closeConnection } from '../src/db/postgres.js';
import { phraseFromPath } from '../src/services/pathKeyword.js';
import serpapiKeys from '../src/services/serpapiKeyService.js';
import dotenv from 'dotenv';

dotenv.config();

/** Minimal flag parsing — no dependency for six options. */
function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith('--')) continue;
        const key = a.slice(2);
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) { out[key] = true; continue; }
        out[key] = next; i++;
    }
    return out;
}

/**
 * The cheapest cadence that fits, and how many keywords it affords.
 *
 * Checking every keyword daily is the most responsive option, so prefer it and
 * only slow down when the budget cannot carry the whole set. Slowing down beats
 * dropping pages: 20 keywords every 2 days explains more than 10 every day.
 */
function planBudget(candidateCount, monthlyCredits, maxKeywords) {
    const CADENCES = [24, 48, 72, 96, 120, 168];   // 1 day … 1 week
    const wanted = Math.min(candidateCount, maxKeywords);

    for (const minHours of CADENCES) {
        const checksPerMonth = 30 / (minHours / 24);
        const affordable = Math.floor(monthlyCredits / checksPerMonth);
        if (affordable >= wanted) {
            return { minHours, keywords: wanted, cost: Math.round(wanted * checksPerMonth) };
        }
    }

    // Even the slowest cadence cannot carry them all — take what fits.
    const slowest = CADENCES[CADENCES.length - 1];
    const checksPerMonth = 30 / (slowest / 24);
    const affordable = Math.max(1, Math.floor(monthlyCredits / checksPerMonth));
    return {
        minHours: slowest,
        keywords: Math.min(affordable, wanted),
        cost: Math.round(Math.min(affordable, wanted) * checksPerMonth),
        truncated: true,
    };
}

const cadenceLabel = (h) => (h < 24 ? `every ${h}h` : `every ${Math.round(h / 24)} day${h === 24 ? '' : 's'}`);

async function main() {
    const args = parseArgs(process.argv.slice(2));
    // Every option also reads an env var, because some hosts (Railway, Render)
    // only offer a one-off command box or a start-command override, where
    // passing flags through `npm run … --` is fiddly or impossible.
    const siteId = args.site || process.env.SEARCH_SETUP_SITE_ID;
    const budget = parseInt(args.budget || process.env.SEARCH_SETUP_BUDGET) || 250;
    const maxKeywords = parseInt(args.max || process.env.SEARCH_SETUP_MAX) || 40;
    const location = args.location || process.env.SEARCH_SETUP_LOCATION || 'India';
    const dateRange = args.days || process.env.SEARCH_SETUP_DAYS || '90d';
    const rankBy = String(args.by || process.env.SEARCH_SETUP_BY || 'movement').toLowerCase();
    const minMove = parseInt(args['min-move'] || process.env.SEARCH_SETUP_MIN_MOVE) || 3;
    const exclude = String(args.exclude || process.env.SEARCH_SETUP_EXCLUDE || '')
        .split(',').map((x) => x.trim()).filter(Boolean);
    const dryRun = !!args['dry-run']
        || /^(1|true|yes)$/i.test(process.env.SEARCH_SETUP_DRY_RUN || '');

    if (!siteId) {
        console.error('❌ A site id is required.');
        console.error('   Flag:    npm run setup:keywords -- --site site_abc123 --budget 250');
        console.error('   Or env:  SEARCH_SETUP_SITE_ID=site_abc123 npm run setup:keywords');
        process.exit(1);
    }

    console.log('🔍 Planning rank tracking from real traffic…\n');
    createPool();
    await initializeDatabase();

    const { rows: site } = await query('SELECT id, name, domain FROM sites WHERE id = $1', [siteId]);
    if (!site.length) {
        console.error(`❌ Site ${siteId} not found in this database.`);
        process.exit(1);
    }
    console.log(`  site:     ${site[0].name} (${site[0].domain})`);
    console.log(`  budget:   ${budget} SerpApi searches/month`);
    console.log(`  ranking:  ${rankBy === 'traffic'
        ? `busiest pages over ${dateRange}`
        : `pages that moved ${minMove}+ visitors this week`}`);
    if (exclude.length) console.log(`  skipping: ${exclude.join(', ')}`);
    console.log();

    // 1 — busiest pages, most-visited first.
    //
    // Read from PostgreSQL rather than the DuckDB analytics layer: DuckDB is
    // single-writer, so a running API server holds the file lock and this
    // script would refuse to start. Setup has to work on a LIVE instance
    // without taking the server down, and events is the source of truth anyway.
    const days = parseInt(String(dateRange).replace(/\D/g, '')) || 90;

    // Ranked by MOVEMENT, not raw traffic.
    //
    // Sorting by visitors favours whatever is structurally busiest — on a site
    // with a file browser, that is directory listings nobody searches for and
    // nobody can optimise. The pages worth a credit are the ones whose traffic
    // actually CHANGED, because that is the question this feature answers:
    // "why did this move?" A page sitting flat at any volume has nothing to
    // explain.
    //
    // Week-over-week on visitors, with the shape of getPageTrafficWoW — but
    // written against PostgreSQL, since DuckDB is single-writer and a running
    // API server holds the lock.
    const { rows: top } = rankBy === 'traffic'
        ? await query(
            `SELECT path, COUNT(DISTINCT user_id)::int AS visitors
               FROM events
              WHERE site_id = $1 AND type = 'pageview'
                AND timestamp >= NOW() - ($2 || ' days')::interval
                AND path IS NOT NULL AND path <> ''
              GROUP BY path
              ORDER BY visitors DESC
              LIMIT 200`,
            [siteId, String(days)],
        )
        : await query(
            `WITH w AS (
               SELECT path,
                      COUNT(DISTINCT user_id) FILTER (
                        WHERE timestamp > NOW() - INTERVAL '7 days') AS cur,
                      COUNT(DISTINCT user_id) FILTER (
                        WHERE timestamp <= NOW() - INTERVAL '7 days'
                          AND timestamp >  NOW() - INTERVAL '14 days') AS prev,
                      COUNT(DISTINCT user_id) AS total
                 FROM events
                WHERE site_id = $1 AND type = 'pageview'
                  AND timestamp >= NOW() - ($2 || ' days')::interval
                  AND path IS NOT NULL AND path <> ''
                GROUP BY path
             )
             SELECT path, total::int AS visitors, cur::int AS cur, prev::int AS prev,
                    ABS(cur - prev)::int AS movement
               FROM w
              -- Two floors, both necessary.
              --
              -- A 1→0 week is not a traffic change, it is one person; tracking
              -- it spends ~15 credits/month to explain nothing. So the change
              -- itself must be big enough to be a signal ($3), AND the page
              -- must have current traffic worth explaining — a page that has
              -- gone quiet has no ranking left to investigate.
              WHERE ABS(cur - prev) >= $3
                AND cur >= $3
              ORDER BY movement DESC, total DESC
              LIMIT 200`,
            [siteId, String(days), minMove],
        );
    if (!top.length) {
        if (rankBy === 'traffic') {
            console.error('❌ No traffic recorded for this site yet.');
            console.error('   Rank tracking is only useful for pages people actually land on,');
            console.error('   so let the tracker collect some pageviews first.');
        } else {
            console.error(`❌ No page moved by ${minMove}+ visitors this week.`);
            console.error('   Nothing changed enough to be worth explaining. Either wait for');
            console.error(`   real movement, lower the bar with --min-move 1, or rank by raw`);
            console.error('   volume instead with --by traffic.');
        }
        process.exit(1);
    }

    // 2 — one keyword per page, skipping what is already mapped.
    const { rows: existing } = await query(
        'SELECT DISTINCT path FROM page_keywords WHERE site_id = $1', [siteId]);
    const mapped = new Set(existing.map((r) => r.path));

    const candidates = [];
    const seen = new Set();
    for (const p of top) {
        const path = p.path || p.page;
        if (!path || path === '/' || mapped.has(path)) continue;
        if (exclude.some((prefix) => path.startsWith(prefix))) continue;
        const keyword = phraseFromPath(path);
        // phraseFromPath returns null for app routes (/login) and topicless paths.
        if (!keyword || seen.has(keyword.toLowerCase())) continue;
        seen.add(keyword.toLowerCase());
        candidates.push({
            path, keyword,
            visitors: p.visitors ?? p.views ?? 0,
            cur: p.cur, prev: p.prev, movement: p.movement,
        });
    }

    if (!candidates.length) {
        console.log('✓ Nothing new to map — every busy page already has a keyword.');
        await closeConnection();
        return;
    }

    // 3 — what the budget affords.
    const plan = planBudget(candidates.length, budget, maxKeywords);
    const chosen = candidates.slice(0, plan.keywords);

    console.log(`  ${candidates.length} unmapped page${candidates.length === 1 ? '' : 's'} with a usable keyword.\n`);
    console.log(`  Plan: ${plan.keywords} keyword${plan.keywords === 1 ? '' : 's'}, checked ${cadenceLabel(plan.minHours)}`);
    console.log(`        ≈ ${plan.cost} credits/month of your ${budget}  (${budget - plan.cost} spare)\n`);
    if (plan.truncated) {
        console.log(`  ⚠  ${candidates.length - plan.keywords} page(s) left unmapped — even at the slowest`);
        console.log(`     cadence the budget will not carry them. Raise --budget to include more.\n`);
    }

    for (const [i, c] of chosen.entries()) {
        // Show WHY each page was picked, so the list can be judged rather than
        // taken on trust.
        const why = c.movement !== undefined
            ? `  ${c.prev} → ${c.cur} visitors/wk`
            : `  ${c.visitors} visitors`;
        console.log(`   ${String(i + 1).padStart(2)}. ${c.keyword.padEnd(34)}${why.padEnd(24)} ← ${c.path}`);
    }
    console.log();

    if (dryRun) {
        console.log('🔎 Dry run — nothing written.');
        await closeConnection();
        return;
    }

    // 4 — map them, and store the cadence the plan assumed.
    let added = 0;
    for (const c of chosen) {
        const { rowCount } = await query(
            `INSERT INTO page_keywords (site_id, path, keyword, location, is_primary)
             VALUES ($1, $2, $3, $4, TRUE)
             ON CONFLICT (site_id, path, keyword, location) DO NOTHING`,
            [siteId, c.path, c.keyword, location],
        );
        if (rowCount) added++;
    }
    console.log(`  ✓ ${added} keyword mapping${added === 1 ? '' : 's'} added`);

    // The cadence is only meaningful once a key exists; saveBudget enforces that.
    try {
        await serpapiKeys.saveBudget(siteId, { minHours: plan.minHours, maxPerRun: plan.keywords });
        console.log(`  ✓ cadence set to ${cadenceLabel(plan.minHours)}`);
    } catch {
        console.log(`  · cadence not saved yet — connect a SerpApi key first, then set`);
        console.log(`    "${cadenceLabel(plan.minHours)}" in Search Visibility → Connect SerpApi.`);
    }

    const { key } = await serpapiKeys.resolveKey(siteId);
    console.log();
    if (key) {
        console.log('✅ Ready. The next sweep records the first positions.');
        console.log('   Rank deltas need two observations, so the first real');
        console.log(`   comparison appears about ${Math.round(plan.minHours / 24)} day(s) from now.`);
    } else {
        console.log('⚠  No SerpApi key yet, so nothing will be recorded.');
        console.log('   Add one in the dashboard: Search Visibility → Connect SerpApi.');
    }

    await closeConnection();
}

main().catch(async (err) => {
    console.error('❌', err.message);
    try { await closeConnection(); } catch { /* already closed */ }
    process.exit(1);
});
