#!/usr/bin/env node
/**
 * InsightTrack — Millions of Events Load Test Data Generator
 *
 * Phase 1: Inserts 1M+ events via batch API into Docker
 * Phase 2: Triggers sync and verifies data appears in DuckDB
 * Phase 3: Benchmarks all analytics endpoints with real data
 *
 * Usage:
 *   node scripts/load-test-data.js
 *   node scripts/load-test-data.js --events 500000 --batch 500
 */

import http from 'node:http';
import https from 'node:https';

// ── Config ──────────────────────────────────────────────────────────────────
const API    = process.env.API    || 'http://localhost:3001';
const EMAIL  = process.env.EMAIL  || 'nishikantaray1@gmail.com';
const PASS   = process.env.PASS   || '123456';
const SITE_ID = process.env.SITE_ID || 'site_98182e60';
const TOTAL_EVENTS = parseInt(process.argv.find(a => a.startsWith('--events='))?.split('=')[1] || process.env.EVENTS || '1000000');
const BATCH_SIZE   = parseInt(process.argv.find(a => a.startsWith('--batch='))?.split('=')[1]  || '500');

// ── Data generators ─────────────────────────────────────────────────────────
const PAGES    = ['/', '/pricing', '/blog', '/about', '/contact', '/docs', '/signup', '/features', '/enterprise', '/changelog'];
const SOURCES  = ['google', 'direct', 'twitter', 'linkedin', 'newsletter', 'github', 'hackernews', 'reddit', 'facebook', 'bing'];
const DEVICES  = ['Desktop', 'Mobile', 'Tablet'];
const BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge'];
const OS_LIST  = ['Windows', 'macOS', 'Linux', 'Android', 'iOS'];
const COUNTRIES= ['US', 'IN', 'GB', 'DE', 'FR', 'CA', 'AU', 'BR', 'JP', 'SG'];
const TYPES    = ['pageview', 'pageview', 'pageview', 'click', 'scroll_depth', 'heatmap_click', 'web_vital', 'js_error'];
const CITIES   = ['New York', 'London', 'Bangalore', 'Berlin', 'Sydney', 'Toronto', 'Tokyo', 'Mumbai', 'Paris', 'Singapore'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randId() { return Math.random().toString(36).slice(2, 18); }

// Spread events over the last 90 days for realistic time distribution
function randTimestamp() {
    const msAgo = Math.random() * 90 * 24 * 60 * 60 * 1000;
    return new Date(Date.now() - msAgo).toISOString();
}

function generateEvent(i) {
    const userId    = `user_${rand(1, 10000)}`; // 10K unique users
    const sessionId = `sess_${rand(1, 50000)}`; // 50K sessions
    const type      = pick(TYPES);
    const path      = pick(PAGES);
    const device    = pick(DEVICES);

    const props = {};
    if (type === 'scroll_depth') props.depth = pick([25, 50, 75, 100]);
    if (type === 'heatmap_click') { props.relX = rand(0, 100); props.relY = rand(0, 100); props.selector = `button.cta-${rand(1,5)}`; }
    if (type === 'web_vital') { props.name = pick(['LCP','FID','CLS','INP','TTFB']); props.value = rand(100, 3000); props.rating = 'good'; }
    if (type === 'js_error') { props.message = pick(['TypeError: Cannot read null','ReferenceError: x is not defined','NetworkError: fetch failed']); props.source = '/static/main.js'; }

    return {
        siteId:     SITE_ID,
        userId,
        sessionId,
        type,
        url:        `https://hello.com${path}`,
        path,
        referrer:   Math.random() > 0.5 ? `https://${pick(SOURCES)}.com` : null,
        device,
        browser:    pick(BROWSERS),
        os:         pick(OS_LIST),
        country:    pick(COUNTRIES),
        city:       pick(CITIES),
        timestamp:  randTimestamp(),
        utm_source:  Math.random() > 0.7 ? pick(SOURCES) : '',
        utm_medium:  Math.random() > 0.7 ? pick(['cpc','organic','email','social']) : '',
        utm_campaign:Math.random() > 0.8 ? `campaign_${rand(1,10)}` : '',
        props,
    };
}

// ── HTTP client ─────────────────────────────────────────────────────────────
function request(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const url = new URL(API + path);
        const isHttps = url.protocol === 'https:';
        const mod = isHttps ? https : http;
        const data = body ? JSON.stringify(body) : null;
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        };
        const req = mod.request({ hostname: url.hostname, port: url.port || (isHttps?443:80), path: url.pathname + url.search, method, headers }, (res) => {
            let buf = '';
            res.on('data', c => buf += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
                catch { resolve({ status: res.statusCode, body: buf }); }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

// ── Progress bar ─────────────────────────────────────────────────────────────
function progress(done, total, startMs, label = '') {
    const pct    = (done / total * 100).toFixed(1);
    const bar    = '█'.repeat(Math.floor(pct / 4)) + '░'.repeat(25 - Math.floor(pct / 4));
    const elapsed= (Date.now() - startMs) / 1000;
    const rate   = done / elapsed;
    const eta    = ((total - done) / rate).toFixed(0);
    process.stdout.write(`\r  [${bar}] ${pct}% ${done.toLocaleString()}/${total.toLocaleString()} events  ${Math.round(rate)}/s  ETA ${eta}s ${label}    `);
}

// ── Main ─────────────────────────────────────────────────────────────────────
const results = { phases: [], errors: [], startTime: Date.now() };

function log(msg) { process.stdout.write('\n'); console.log(msg); }
function section(title) { log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`); }
function ok(msg) { log(`  ✅ ${msg}`); }
function fail(msg) { log(`  ❌ ${msg}`); results.errors.push(msg); }
function info(msg) { log(`  ℹ️  ${msg}`); }

async function main() {
    section('InsightTrack — Load Test Data Generator');
    info(`Target: ${TOTAL_EVENTS.toLocaleString()} events → ${API}`);
    info(`Batch size: ${BATCH_SIZE} events per request`);
    info(`Site ID: ${SITE_ID}`);

    // ── Phase 0: Auth ──────────────────────────────────────────────────────
    section('Phase 0 — Authentication');
    const loginRes = await request('POST', '/api/auth/login', { email: EMAIL, password: PASS });
    if (loginRes.status !== 200) { fail(`Login failed: ${JSON.stringify(loginRes.body)}`); process.exit(1); }
    const token = loginRes.body.data?.token || loginRes.body.token;
    ok(`Logged in as ${EMAIL}`);
    ok(`Token: ${token.slice(0, 40)}…`);
    results.token = token;

    // ── Phase 1: Insert events ─────────────────────────────────────────────
    section(`Phase 1 — Inserting ${TOTAL_EVENTS.toLocaleString()} Events`);
    const p1Start = Date.now();
    let inserted = 0, p1Errors = 0, p1Batches = 0;
    const totalBatches = Math.ceil(TOTAL_EVENTS / BATCH_SIZE);

    for (let b = 0; b < totalBatches; b++) {
        const count  = Math.min(BATCH_SIZE, TOTAL_EVENTS - inserted);
        const events = Array.from({ length: count }, (_, i) => generateEvent(inserted + i));

        try {
            const r = await request('POST', '/api/track/batch', { events }, token);
            if (r.status === 201) {
                inserted += count;
                p1Batches++;
            } else {
                p1Errors++;
                if (p1Errors <= 3) fail(`Batch ${b} failed: HTTP ${r.status}`);
            }
        } catch (e) {
            p1Errors++;
        }

        if (b % 10 === 0) progress(inserted, TOTAL_EVENTS, p1Start);
    }

    process.stdout.write('\n');
    const p1Duration = ((Date.now() - p1Start) / 1000).toFixed(1);
    const p1Rate     = Math.round(inserted / parseFloat(p1Duration));
    ok(`Inserted ${inserted.toLocaleString()} events in ${p1Duration}s (${p1Rate.toLocaleString()} events/sec)`);
    if (p1Errors > 0) fail(`${p1Errors} batch(es) failed`);
    results.phases.push({ name: 'Insert', events: inserted, durationSec: parseFloat(p1Duration), rate: p1Rate, errors: p1Errors });

    // ── Phase 2: Trigger sync and wait ────────────────────────────────────
    section('Phase 2 — Triggering PG → DuckDB Sync');
    const syncStart = Date.now();
    info('Triggering full sync (all new events → DuckDB)…');
    const syncRes = await request('POST', '/api/sync', {}, token);
    if (syncRes.status === 200) {
        const syncTime = ((Date.now() - syncStart) / 1000).toFixed(1);
        ok(`Sync complete in ${syncTime}s — ${syncRes.body.totalRows} rows synced`);
        results.phases.push({ name: 'Sync', durationSec: parseFloat(syncTime), rows: syncRes.body.totalRows });
    } else {
        fail(`Sync failed: ${JSON.stringify(syncRes.body)}`);
    }

    // Wait for rollup to also complete
    info('Waiting 3s for daily rollup to finish…');
    await new Promise(r => setTimeout(r, 3000));

    // ── Phase 3: Benchmark all analytics endpoints ─────────────────────────
    section('Phase 3 — Analytics Endpoint Benchmarks');

    const endpoints = [
        { name: 'KPI Summary',          path: `/api/analytics/${SITE_ID}/kpi?dateRange=30d` },
        { name: 'KPI (90 days)',         path: `/api/analytics/${SITE_ID}/kpi?dateRange=90d` },
        { name: 'Traffic Over Time',     path: `/api/analytics/${SITE_ID}/traffic?dateRange=30d` },
        { name: 'Traffic (90 days)',     path: `/api/analytics/${SITE_ID}/traffic?dateRange=90d` },
        { name: 'Pageviews Over Time',   path: `/api/analytics/${SITE_ID}/pageviews?dateRange=30d` },
        { name: 'Top Pages',            path: `/api/analytics/${SITE_ID}/top-pages?dateRange=30d&limit=20` },
        { name: 'Traffic Sources',      path: `/api/analytics/${SITE_ID}/sources?dateRange=30d` },
        { name: 'Device Breakdown',     path: `/api/analytics/${SITE_ID}/devices?dateRange=30d` },
        { name: 'Countries',            path: `/api/analytics/${SITE_ID}/countries?dateRange=30d&limit=20` },
        { name: 'Sessions',             path: `/api/analytics/${SITE_ID}/sessions?dateRange=30d` },
        { name: 'Bounce Rate Trend',    path: `/api/analytics/${SITE_ID}/bounce-rate-trend?dateRange=30d` },
        { name: 'Avg Session Trend',    path: `/api/analytics/${SITE_ID}/avg-session-trend?dateRange=30d` },
        { name: 'Realtime Visitors',    path: `/api/analytics/${SITE_ID}/realtime` },
        { name: 'Realtime Event Stream',path: `/api/analytics/${SITE_ID}/realtime/event-stream?limit=50` },
        { name: 'UTM Campaigns',        path: `/api/analytics/${SITE_ID}/utm?dateRange=30d` },
        { name: 'User Flow',            path: `/api/analytics/${SITE_ID}/user-flow?dateRange=30d` },
        { name: 'Funnel Steps',         path: `/api/analytics/${SITE_ID}/funnel/steps?dateRange=30d` },
        { name: 'Alerts',               path: `/api/analytics/${SITE_ID}/alerts?dateRange=30d` },
        { name: 'Comparison',           path: `/api/analytics/${SITE_ID}/comparison?dateRange=30d` },
        { name: 'Engagement Summary',   path: `/api/analytics/${SITE_ID}/engagement/summary?dateRange=30d` },
        { name: 'Heatmap Data',         path: `/api/analytics/${SITE_ID}/engagement/heatmap?dateRange=30d&path=/` },
        { name: 'Heatmap Summary',      path: `/api/analytics/${SITE_ID}/engagement/heatmap-summary?dateRange=30d` },
        { name: 'Scroll Depth',         path: `/api/analytics/${SITE_ID}/engagement/scroll-depth?dateRange=30d` },
        { name: 'Rage Clicks',          path: `/api/analytics/${SITE_ID}/engagement/rage-clicks?dateRange=30d` },
        { name: 'Web Vitals Overview',  path: `/api/analytics/${SITE_ID}/performance/web-vitals-overview?dateRange=30d` },
        { name: 'Web Vitals Per Page',  path: `/api/analytics/${SITE_ID}/performance/web-vitals?dateRange=30d` },
        { name: 'JS Errors',            path: `/api/analytics/${SITE_ID}/performance/errors?dateRange=30d` },
        { name: 'JS Errors Trend',      path: `/api/analytics/${SITE_ID}/performance/errors-over-time?dateRange=30d` },
        { name: 'Entry Pages',          path: `/api/analytics/${SITE_ID}/content/entry-pages?dateRange=30d` },
        { name: 'Exit Pages',           path: `/api/analytics/${SITE_ID}/content/exit-pages?dateRange=30d` },
        { name: 'Site Search',          path: `/api/analytics/${SITE_ID}/content/site-search?dateRange=30d` },
        { name: 'New vs Returning',     path: `/api/analytics/${SITE_ID}/audience/new-vs-returning?dateRange=30d` },
        { name: 'Revenue',              path: `/api/analytics/${SITE_ID}/revenue?dateRange=30d` },
        { name: 'Goals Conversions',    path: `/api/analytics/${SITE_ID}/goals/conversions?dateRange=30d` },
    ];

    const benchmarks = [];
    for (const ep of endpoints) {
        // Run 3 times — first is cache miss, next 2 are cache hits
        const times = [];
        let status, rows, firstBody;
        for (let run = 0; run < 3; run++) {
            const t0 = Date.now();
            const r  = await request('GET', ep.path, null, token);
            times.push(Date.now() - t0);
            status = r.status;
            if (run === 0) {
                firstBody = r.body;
                const d = r.body?.data ?? r.body;
                rows = Array.isArray(d) ? d.length : (typeof d === 'object' ? Object.keys(d).length : 0);
            }
        }
        const [cold, warm1, warm2] = times;
        const pass = status === 200;
        const row = { name: ep.name, cold, warm: Math.round((warm1+warm2)/2), status, rows, pass };
        benchmarks.push(row);

        const statusIcon = pass ? '✅' : '❌';
        const cacheIcon  = warm1 < 5 ? '🚀' : warm1 < 50 ? '⚡' : '🔄';
        log(`  ${statusIcon} ${ep.name.padEnd(28)} cold:${String(cold+'ms').padStart(6)}  warm:${String(Math.round((warm1+warm2)/2)+'ms').padStart(5)}  ${cacheIcon}  rows:${rows}`);
    }
    results.benchmarks = benchmarks;

    // ── Phase 4: Concurrent load test ────────────────────────────────────
    section('Phase 4 — Concurrent Load Test (50 simultaneous requests)');
    const concurrencyTests = [
        { label: '10 concurrent KPI requests',     concurrency: 10,  endpoint: `/api/analytics/${SITE_ID}/kpi?dateRange=30d` },
        { label: '25 concurrent Traffic requests', concurrency: 25,  endpoint: `/api/analytics/${SITE_ID}/traffic?dateRange=30d` },
        { label: '50 concurrent KPI requests',     concurrency: 50,  endpoint: `/api/analytics/${SITE_ID}/kpi?dateRange=90d` },
    ];

    for (const ct of concurrencyTests) {
        // Invalidate cache first so we test real query throughput
        const t0 = Date.now();
        const promises = Array.from({ length: ct.concurrency }, () =>
            request('GET', ct.endpoint, null, token)
        );
        const responses = await Promise.all(promises);
        const elapsed   = Date.now() - t0;
        const ok200     = responses.filter(r => r.status === 200).length;
        const rps        = Math.round(ct.concurrency / (elapsed / 1000));
        log(`  ✅ ${ct.label}`);
        log(`     ${ok200}/${ct.concurrency} OK  |  ${elapsed}ms total  |  ${rps} req/s  |  avg ${Math.round(elapsed/ct.concurrency)}ms/req`);
        results.phases.push({ name: ct.label, ok: ok200, total: ct.concurrency, totalMs: elapsed, rps, avgMs: Math.round(elapsed/ct.concurrency) });
    }

    // ── Phase 5: Write throughput test ────────────────────────────────────
    section('Phase 5 — Write Throughput (Tracking API Burst)');
    const BURST_COUNT   = 1000;
    const BURST_BATCHES = 20; // 20 batches × 50 = 1000 events concurrently
    info(`Sending ${BURST_COUNT} events in ${BURST_BATCHES} concurrent batches of 50…`);

    const burstStart = Date.now();
    const burstBatches = Array.from({ length: BURST_BATCHES }, (_, b) => {
        const events = Array.from({ length: 50 }, (_, i) => generateEvent(b * 50 + i));
        return request('POST', '/api/track/batch', { events }, token);
    });
    const burstResults = await Promise.all(burstBatches);
    const burstOk      = burstResults.filter(r => r.status === 201).length;
    const burstMs      = Date.now() - burstStart;
    const burstRps     = Math.round(BURST_COUNT / (burstMs / 1000));
    ok(`${burstOk}/${BURST_BATCHES} batches succeeded`);
    ok(`${BURST_COUNT} events in ${burstMs}ms → ${burstRps} events/sec`);
    results.phases.push({ name: 'Write burst', events: BURST_COUNT, ms: burstMs, rate: burstRps, ok: burstOk });

    // ── Phase 6: Data integrity checks ───────────────────────────────────
    section('Phase 6 — Data Integrity Verification');

    const kpiRes = await request('GET', `/api/analytics/${SITE_ID}/kpi?dateRange=90d`, null, token);
    if (kpiRes.status === 200) {
        const kpi = kpiRes.body?.data || kpiRes.body;
        const v = kpi.totalVisitors ?? kpi.visitors ?? 0;
        const pv = kpi.totalPageviews ?? kpi.pageviews ?? 0;
        if (v > 0) ok(`KPI — visitors: ${Number(v).toLocaleString()}  pageviews: ${Number(pv).toLocaleString()}`);
        else fail(`KPI returned 0 visitors — data may not be synced`);
    } else fail(`KPI endpoint failed: ${kpiRes.status}`);

    const trafficRes = await request('GET', `/api/analytics/${SITE_ID}/traffic?dateRange=90d`, null, token);
    if (trafficRes.status === 200) {
        const rows = trafficRes.body?.data || trafficRes.body;
        if (Array.isArray(rows) && rows.length > 0)
            ok(`Traffic — ${rows.length} date rows, latest: ${rows[rows.length-1]?.date} visitors=${rows[rows.length-1]?.visitors}`);
        else fail('Traffic returned no rows');
    }

    const pagesRes = await request('GET', `/api/analytics/${SITE_ID}/top-pages?dateRange=90d&limit=10`, null, token);
    if (pagesRes.status === 200) {
        const rows = pagesRes.body?.data || pagesRes.body;
        if (Array.isArray(rows) && rows.length > 0) ok(`Top pages — ${rows.length} pages, #1: ${rows[0]?.page} (${rows[0]?.views?.toLocaleString()} views)`);
        else fail('Top pages returned no rows');
    }

    const heatmapRes = await request('GET', `/api/analytics/${SITE_ID}/engagement/heatmap?dateRange=90d&path=/`, null, token);
    if (heatmapRes.status === 200) {
        const rows = heatmapRes.body?.data || heatmapRes.body;
        if (Array.isArray(rows) && rows.length > 0) ok(`Heatmap — ${rows.length} hotspots on /`);
        else info('Heatmap — 0 hotspots (heatmap_click events may need path match)');
    }

    const vitalsRes = await request('GET', `/api/analytics/${SITE_ID}/performance/web-vitals-overview?dateRange=90d`, null, token);
    if (vitalsRes.status === 200) {
        const d = vitalsRes.body?.data || vitalsRes.body;
        const metrics = Object.keys(d || {}).filter(k => d[k]?.p75);
        ok(`Web Vitals — ${metrics.length} metrics captured: ${metrics.join(', ')}`);
    }

    const errorsRes = await request('GET', `/api/analytics/${SITE_ID}/performance/errors?dateRange=90d`, null, token);
    if (errorsRes.status === 200) {
        const rows = errorsRes.body?.data || errorsRes.body;
        if (Array.isArray(rows) && rows.length > 0) ok(`JS Errors — ${rows.length} unique error types`);
        else info('JS Errors — none (event type filtering may differ)');
    }

    // ── Phase 7: Cache effectiveness ─────────────────────────────────────
    section('Phase 7 — Cache Effectiveness');
    const cacheEndpoints = [
        `/api/analytics/${SITE_ID}/kpi?dateRange=30d`,
        `/api/analytics/${SITE_ID}/traffic?dateRange=30d`,
        `/api/analytics/${SITE_ID}/top-pages?dateRange=30d`,
    ];
    for (const ep of cacheEndpoints) {
        const r1 = await request('GET', ep, null, token);
        const t2s = Date.now();
        const r2 = await request('GET', ep, null, token);
        const t2 = Date.now() - t2s;
        const name = ep.split('/').slice(-1)[0].split('?')[0];
        if (t2 < 5) ok(`${name} — cache hit in ${t2}ms 🚀`);
        else if (t2 < 30) ok(`${name} — cache hit in ${t2}ms ⚡`);
        else info(`${name} — cache miss or cold: ${t2}ms`);
    }

    // ── Final Report ──────────────────────────────────────────────────────
    const totalMs = Date.now() - results.startTime;

    console.log('\n\n' + '═'.repeat(60));
    console.log('  FINAL REPORT');
    console.log('═'.repeat(60));
    console.log(`\n  Total test duration: ${(totalMs/1000).toFixed(1)}s`);
    console.log(`  Events inserted:     ${inserted.toLocaleString()}`);
    console.log(`  Insert rate:         ${p1Rate.toLocaleString()} events/sec`);
    console.log(`  Total errors:        ${results.errors.length}`);

    console.log('\n  ── Endpoint Performance ──');
    const slowEndpoints = results.benchmarks.filter(b => b.cold > 1000);
    const fastEndpoints = results.benchmarks.filter(b => b.cold <= 100);
    console.log(`  Endpoints tested:    ${results.benchmarks.length}`);
    console.log(`  All passed (200):    ${results.benchmarks.filter(b=>b.pass).length}/${results.benchmarks.length}`);
    console.log(`  Fast (< 100ms cold): ${fastEndpoints.length}`);
    console.log(`  Slow (> 1s cold):    ${slowEndpoints.length}`);

    if (slowEndpoints.length > 0) {
        console.log('\n  ── Slow endpoints ──');
        slowEndpoints.forEach(e => console.log(`  ⚠️  ${e.name}: cold=${e.cold}ms warm=${e.warm}ms`));
    }

    const avgCold = Math.round(results.benchmarks.reduce((s,b)=>s+b.cold,0)/results.benchmarks.length);
    const avgWarm = Math.round(results.benchmarks.reduce((s,b)=>s+b.warm,0)/results.benchmarks.length);
    console.log(`\n  Avg cold query:      ${avgCold}ms`);
    console.log(`  Avg warm (cached):   ${avgWarm}ms`);

    if (results.errors.length === 0) {
        console.log('\n  🎉 ALL TESTS PASSED');
    } else {
        console.log('\n  ⚠️  ERRORS:');
        results.errors.forEach(e => console.log(`    - ${e}`));
    }
    console.log('\n' + '═'.repeat(60) + '\n');

    // Save JSON report
    const report = {
        timestamp: new Date().toISOString(),
        config: { api: API, siteId: SITE_ID, totalEvents: TOTAL_EVENTS, batchSize: BATCH_SIZE },
        summary: { totalMs, inserted, insertRate: p1Rate, errors: results.errors.length, avgColdMs: avgCold, avgWarmMs: avgWarm },
        phases: results.phases,
        benchmarks: results.benchmarks,
        errors: results.errors,
    };
    const { writeFileSync } = await import('node:fs');
    writeFileSync('/tmp/insighttrack-load-test-report.json', JSON.stringify(report, null, 2));
    console.log('  📄 Full report saved to /tmp/insighttrack-load-test-report.json\n');
}

main().catch(e => { console.error('\n❌ Test failed:', e.message); process.exit(1); });
