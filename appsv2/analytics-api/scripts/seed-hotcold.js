/**
 * Hot/Cold Stress-Test Seed Script
 * ─────────────────────────────────
 * Creates a large, realistic dataset spanning 120 days for site_d0fa12f3
 * so the hot+cold archival pipeline can be properly exercised.
 *
 * - Events from today back to 120 days ago  (~200 k rows)
 * - Events newer than HOT_DAYS (default 30) stay in events_hot (DuckDB)
 * - Events older than HOT_DAYS get written to Parquet cold partitions
 * - After seeding, triggers a manual sync & verifies Parquet files exist
 *
 * Usage (from appsv2/analytics-api/):
 *   node scripts/seed-hotcold.js
 *   node scripts/seed-hotcold.js --days 120 --visitors 300
 */

import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name, def) => {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 ? Number(args[idx + 1]) : def;
};
const DAYS = getArg('days', 120);   // total history window
const VISITORS = getArg('visitors', 300);   // avg visitors/day
const HOT_DAYS = Number(process.env.HOT_DAYS) || 30;
const SITE_ID = 'site_d0fa12f3';
const DATA_LAKE = path.resolve(__dirname, '../data-lake');

// ── PostgreSQL pool ───────────────────────────────────────────────────────────
const pool = new pg.Pool({
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT) || 5432,
    user: process.env.PG_USER || 'analytics',
    password: process.env.PG_PASSWORD || 'analytics123',
    database: process.env.PG_DATABASE || 'analytics_db',
    max: 10,
});

// ── Weighted random helper ────────────────────────────────────────────────────
function weightedRandom(items, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
    }
    return items[items.length - 1];
}

// ── Data pools ────────────────────────────────────────────────────────────────
const DEVICES = ['Desktop', 'Mobile', 'Tablet'];
const DEV_W = [55, 35, 10];
const COUNTRIES = ['United States', 'United Kingdom', 'Germany', 'France', 'Canada', 'India', 'Australia', 'Japan', 'Brazil', 'Spain', 'Netherlands', 'Singapore'];
const CTR_W = [28, 10, 9, 7, 7, 8, 5, 5, 4, 3, 2, 2];
const PAGES = ['/', '/products', '/about', '/pricing', '/contact', '/blog', '/docs', '/signup', '/features', '/changelog'];
const PAGE_W = [25, 18, 8, 15, 6, 10, 6, 5, 5, 2];
const REFERRERS = [null, 'https://google.com', 'https://bing.com', 'https://facebook.com', 'https://twitter.com', 'https://linkedin.com', 'https://github.com', 'https://reddit.com', 'https://youtube.com'];
const REF_W = [28, 22, 5, 10, 8, 7, 8, 7, 5];
const UTM_SRC = [null, 'google', 'facebook', 'twitter', 'newsletter', 'linkedin', 'bing'];
const UTM_SRC_W = [48, 15, 10, 8, 10, 6, 3];
const UTM_MED = [null, 'cpc', 'social', 'email', 'organic', 'referral'];
const UTM_MED_W = [48, 15, 12, 10, 8, 7];
const UTM_CAM = [null, 'spring_launch', 'product_v2', 'brand_awareness', 'retargeting', 'weekly_digest', 'summer_sale'];
const UTM_CAM_W = [48, 10, 10, 10, 10, 8, 4];
const EVENT_TYPES = ['pageview', 'pageview', 'pageview', 'pageview', 'click', 'form_submit', 'video_play', 'add_to_cart', 'signup_start'];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  InsightsTrack v2 — Hot+Cold Stress-Test Seed             ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`  Site     : ${SITE_ID}`);
    console.log(`  Days     : ${DAYS}  (hot window = last ${HOT_DAYS} days)`);
    console.log(`  Visitors : ~${VISITORS}/day  ≈ ${(DAYS * VISITORS / 1000).toFixed(0)}k total events`);
    console.log(`  Cold days: ${DAYS - HOT_DAYS} days → Parquet partitions\n`);

    // Ensure site exists
    await pool.query(
        `INSERT INTO sites (id, name, domain, created_at)
         VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
        [SITE_ID, 'Demo Website v2', 'demo-v2.insightstrack.dev', new Date()]
    );
    console.log(`✅  Site ${SITE_ID} ready`);

    // Wipe existing data for this site so we get a clean slate
    await pool.query('DELETE FROM events   WHERE site_id = $1', [SITE_ID]);
    await pool.query('DELETE FROM sessions WHERE site_id = $1', [SITE_ID]);
    console.log(`🗑   Cleared old events/sessions for ${SITE_ID}`);

    const now = new Date();
    const users = Array.from({ length: 5000 }, () => `u_${uuidv4().slice(0, 8)}`);

    let totalEvents = 0, totalSessions = 0;
    const t0 = Date.now();

    // ── Day loop ─────────────────────────────────────────────────────────────
    for (let daysAgo = DAYS; daysAgo >= 0; daysAgo--) {
        const dayDate = new Date(now);
        dayDate.setDate(dayDate.getDate() - daysAgo);

        const isWeekend = [0, 6].includes(dayDate.getDay());
        const trendBoost = 1 + (DAYS - daysAgo) / DAYS * 0.5; // organic growth over time
        const dailyVisitors = Math.round((isWeekend ? VISITORS * 0.6 : VISITORS) * trendBoost * (0.8 + Math.random() * 0.4));

        const evBatch = [];
        const sesBatch = [];

        for (let v = 0; v < dailyVisitors; v++) {
            const userId = users[Math.floor(Math.random() * users.length)];
            const sessionId = `s_${uuidv4().slice(0, 8)}`;
            const device = weightedRandom(DEVICES, DEV_W);
            const country = weightedRandom(COUNTRIES, CTR_W);
            const referrer = weightedRandom(REFERRERS, REF_W);
            const utmSrc = weightedRandom(UTM_SRC, UTM_SRC_W);
            const utmMed = weightedRandom(UTM_MED, UTM_MED_W);
            const utmCam = weightedRandom(UTM_CAM, UTM_CAM_W);

            const sessionStart = new Date(dayDate);
            sessionStart.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

            const pagesInSession = Math.max(1, Math.round(Math.random() < 0.4 ? 1 : 1 + Math.random() * 5));
            const duration = pagesInSession === 1 ? Math.floor(Math.random() * 40) : 30 + Math.floor(Math.random() * 600);
            const isBounce = pagesInSession === 1;
            let entryPage = weightedRandom(PAGES, PAGE_W);
            let exitPage = entryPage;

            for (let pg2 = 0; pg2 < pagesInSession; pg2++) {
                const evTime = new Date(sessionStart.getTime() + pg2 * Math.floor(duration * 1000 / pagesInSession));
                const evPage = pg2 === 0 ? entryPage : weightedRandom(PAGES, PAGE_W);
                if (pg2 === pagesInSession - 1) exitPage = evPage;

                const evType = pg2 === 0 ? 'pageview' : weightedRandom(EVENT_TYPES, [4, 4, 4, 4, 1, 1, 1, 1, 1]);
                evBatch.push([
                    SITE_ID, userId, sessionId, evType,
                    `https://demo-v2.insightstrack.dev${evPage}`, evPage,
                    pg2 === 0 ? referrer : null,
                    device, country, evTime.toISOString(),
                    JSON.stringify({ page_title: evPage.slice(1) || 'home' }),
                    utmSrc, utmMed, utmCam,
                ]);
            }

            sesBatch.push([
                sessionId, SITE_ID, userId,
                sessionStart.toISOString(),
                new Date(sessionStart.getTime() + duration * 1000).toISOString(),
                duration, pagesInSession, entryPage, exitPage,
                referrer, device, country, isBounce,
                utmSrc, utmMed, utmCam,
            ]);
        }

        // Bulk insert events
        if (evBatch.length > 0) {
            const evVals = evBatch.map((row, i) => {
                const base = i * 14;
                return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},$${base + 14})`;
            }).join(',');
            await pool.query(
                `INSERT INTO events (site_id,user_id,session_id,type,url,path,referrer,device,country,timestamp,properties,utm_source,utm_medium,utm_campaign) VALUES ${evVals}`,
                evBatch.flat()
            );
            totalEvents += evBatch.length;
        }

        // Bulk insert sessions
        if (sesBatch.length > 0) {
            const sesVals = sesBatch.map((row, i) => {
                const base = i * 16;
                return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},$${base + 14},$${base + 15},$${base + 16})`;
            }).join(',');
            await pool.query(
                `INSERT INTO sessions (id,site_id,user_id,started_at,ended_at,duration,pageviews,entry_page,exit_page,referrer,device,country,is_bounce,utm_source,utm_medium,utm_campaign) VALUES ${sesVals}`,
                sesBatch.flat()
            );
            totalSessions += sesBatch.length;
        }

        if (daysAgo % 10 === 0) {
            const pct = Math.round(((DAYS - daysAgo) / DAYS) * 100);
            process.stdout.write(`\r  Progress: ${pct}% (${totalEvents.toLocaleString()} events, ${totalSessions.toLocaleString()} sessions)`);
        }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n\n✅  Seeded ${totalEvents.toLocaleString()} events and ${totalSessions.toLocaleString()} sessions in ${elapsed}s`);

    // ── Count breakdown ───────────────────────────────────────────────────────
    const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - HOT_DAYS);
    const { rows: [hotCount] } = await pool.query(
        `SELECT COUNT(*) AS n FROM events WHERE site_id=$1 AND timestamp >= $2`,
        [SITE_ID, cutoff.toISOString()]
    );
    const { rows: [coldCount] } = await pool.query(
        `SELECT COUNT(*) AS n FROM events WHERE site_id=$1 AND timestamp < $2`,
        [SITE_ID, cutoff.toISOString()]
    );
    console.log('\n📊  Data breakdown (PostgreSQL source of truth):');
    console.log(`   Hot  (>= ${HOT_DAYS} days ago): ${Number(hotCount.n).toLocaleString()} events  → will go to events_hot`);
    console.log(`   Cold (<  ${HOT_DAYS} days ago): ${Number(coldCount.n).toLocaleString()} events  → will go to Parquet`);

    await pool.end();

    // ── Trigger sync via API ──────────────────────────────────────────────────
    console.log('\n⏳  Triggering full sync via API…');
    try {
        const res = await fetch('http://localhost:3001/api/sync/full', { method: 'POST' });
        if (res.ok) {
            const body = await res.json();
            console.log(`✅  Sync response: ${JSON.stringify(body)}`);
        } else {
            console.log(`⚠️   Sync endpoint returned ${res.status} — run manually: docker exec <backend> node -e "import('./src/sync/sync.js').then(m=>m.runFullSync())"`);
        }
    } catch {
        console.log('⚠️   Could not reach sync API endpoint — run the manual sync command above.');
    }

    // ── Verify Parquet files ──────────────────────────────────────────────────
    console.log('\n🔍  Checking for Parquet cold files…');
    verifyParquet();

    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  Login credentials for manual verification:');
    console.log('  Email    : demo@insightstrack.dev');
    console.log('  Password : Demo@2024!');
    console.log(`  Dashboard: http://localhost:4173`);
    console.log(`  Site ID  : ${SITE_ID}`);
    console.log('══════════════════════════════════════════════════════════');
}

function verifyParquet() {
    const eventsDir = path.join(DATA_LAKE, 'events');
    if (!existsSync(eventsDir)) {
        console.log(`  ⚠️   data-lake/events/ not found yet — sync has not run yet or Parquet is in Docker volume.`);
        console.log(`       Run: docker exec traffic-backend-1 ls /app/data-lake/events/`);
        return;
    }
    const siteDirs = readdirSync(eventsDir, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => d.name);
    if (siteDirs.length === 0) {
        console.log('  ⚠️   No site partition dirs found. Sync may not have run yet.');
        return;
    }
    let totalFiles = 0;
    for (const siteDir of siteDirs) {
        const dateDirs = readdirSync(path.join(eventsDir, siteDir), { withFileTypes: true })
            .filter(d => d.isDirectory()).map(d => d.name);
        console.log(`  📁  ${siteDir}/ → ${dateDirs.length} date partitions`);
        for (const dd of dateDirs.slice(0, 3)) {
            const files = readdirSync(path.join(eventsDir, siteDir, dd)).filter(f => f.endsWith('.parquet'));
            console.log(`       ${dd}/ → ${files.join(', ')}`);
            totalFiles += files.length;
        }
        if (dateDirs.length > 3) console.log(`       … and ${dateDirs.length - 3} more date partitions`);
    }
    console.log(`  ✅  ${totalFiles} Parquet file(s) confirmed`);
}

main().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
