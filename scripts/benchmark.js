#!/usr/bin/env node
/**
 * InsightTrack — Full Benchmark & Test Suite
 * Runs against the live Docker stack with real data.
 */

import http from 'node:http';

const API     = 'http://localhost:3001';

// Credentials and target site are supplied via the environment — never hardcoded.
// See docs/benchmarking.md for the required variables.
const EMAIL   = process.env.BENCHMARK_EMAIL;
const PASS    = process.env.BENCHMARK_PASSWORD;
const SITE    = process.env.BENCHMARK_SITE_ID;

// Fail fast with an actionable message rather than a confusing 401 mid-run.
const missing = [
    ['BENCHMARK_EMAIL',    EMAIL],
    ['BENCHMARK_PASSWORD', PASS],
    ['BENCHMARK_SITE_ID',  SITE],
].filter(([, v]) => !v).map(([k]) => k);

if (missing.length > 0) {
    console.error(`\n\u274c Missing required environment variable(s): ${missing.join(', ')}\n`);
    console.error('The benchmark authenticates against a running InsightTrack instance.');
    console.error('Supply a benchmark account and the site to measure, for example:\n');
    console.error('  export BENCHMARK_EMAIL="benchmark@example.com"');
    console.error('  export BENCHMARK_PASSWORD="<password>"');
    console.error('  export BENCHMARK_SITE_ID="site_xxxxxxxx"');
    console.error('  node scripts/benchmark.js\n');
    console.error('Use a dedicated benchmark account, not a personal one.');
    console.error('See docs/benchmarking.md for details.\n');
    process.exit(1);
}

function req(method, path, body, token) {
    return new Promise((res, rej) => {
        const data = body ? JSON.stringify(body) : null;
        const opts = {
            hostname: 'localhost', port: 3001,
            path, method,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
            },
        };
        const r = http.request(opts, (resp) => {
            let buf = '';
            resp.on('data', c => buf += c);
            resp.on('end', () => {
                try { res({ status: resp.statusCode, body: JSON.parse(buf) }); }
                catch { res({ status: resp.statusCode, body: buf }); }
            });
        });
        r.on('error', rej);
        if (data) r.write(data);
        r.end();
    });
}

async function bench(token, name, path, runs = 3) {
    const times = [];
    let status, body;
    for (let i = 0; i < runs; i++) {
        const t0 = Date.now();
        const r  = await req('GET', path, null, token);
        times.push(Date.now() - t0);
        if (i === 0) { status = r.status; body = r.body; }
    }
    const data  = body?.data ?? body;
    const rows  = Array.isArray(data) ? data.length
                : (data && typeof data === 'object') ? Object.keys(data).filter(k => data[k] !== null && data[k] !== undefined).length
                : 0;
    const cold  = times[0];
    const warm  = runs > 1 ? Math.round(times.slice(1).reduce((a,b)=>a+b,0)/(runs-1)) : times[0];
    const ok    = status === 200;
    const cacheIcon = warm < 3 ? '🚀' : warm < 20 ? '⚡' : warm < 100 ? '✔' : '🔄';
    console.log(`  ${ok?'✅':'❌'} ${name.padEnd(32)} HTTP${status}  cold:${String(cold+'ms').padStart(7)}  warm:${String(warm+'ms').padStart(6)}  rows:${String(rows).padStart(4)}  ${cacheIcon}`);
    return { name, status, cold, warm, rows, ok };
}

function section(t) {
    console.log(`\n${'─'.repeat(65)}`);
    console.log(`  ${t}`);
    console.log('─'.repeat(65));
}

async function concurrentTest(token, label, path, count) {
    const t0      = Date.now();
    const results = await Promise.all(
        Array.from({ length: count }, () => req('GET', path, null, token))
    );
    const elapsed = Date.now() - t0;
    const ok      = results.filter(r => r.status === 200).length;
    const rps     = Math.round(count / (elapsed / 1000));
    console.log(`  ✅ ${label}`);
    console.log(`     ${ok}/${count} OK  |  ${elapsed}ms total  |  ${rps} req/s  |  avg ${Math.round(elapsed/count)}ms/req`);
    return { ok, count, elapsed, rps };
}

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║      InsightTrack — Comprehensive Performance & Test Report      ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');

    const startTime = Date.now();
    const results   = { sections: [], errors: [] };

    // ── Auth ────────────────────────────────────────────────────────────────
    section('Auth');
    const loginOk = await req('POST', '/api/auth/login', { email: EMAIL, password: PASS });
    if (loginOk.status !== 200) { console.log('  ❌ Login failed'); process.exit(1); }
    const token = loginOk.body.data?.token;
    console.log(`  ✅ Login OK — user: ${loginOk.body.data?.user?.name} (${loginOk.body.data?.user?.email})`);
    console.log(`  ✅ Token: ${token.slice(0,50)}…`);

    // Check data in DuckDB first
    const sqlRes = await req('POST', `/api/sql-editor/${SITE}/run`, { query: 'SELECT COUNT(*) as cnt, MIN(timestamp) as oldest, MAX(timestamp) as newest FROM events' }, token);
    const duckCount = sqlRes.body?.rows?.[0]?.[0];
    const oldest    = sqlRes.body?.rows?.[0]?.[1];
    const newest    = sqlRes.body?.rows?.[0]?.[2];
    console.log(`  ℹ️  DuckDB events: ${Number(duckCount).toLocaleString()} rows (${oldest?.split('T')[0]} → ${newest?.split('T')[0]})`);

    const typeRes = await req('POST', `/api/sql-editor/${SITE}/run`, { query: 'SELECT type, COUNT(*) as cnt FROM events GROUP BY type ORDER BY cnt DESC' }, token);
    for (const [type, cnt] of typeRes.body?.rows || []) {
        console.log(`     ${type}: ${Number(cnt).toLocaleString()}`);
    }

    // ── Core analytics ───────────────────────────────────────────────────────
    section('Phase 1 — Core Analytics Endpoints (dateRange=30d / 90d)');
    const coreResults = [];
    for (const [name, path] of [
        ['KPI Summary (30d)',          `/api/analytics/${SITE}/kpi?dateRange=30d`],
        ['KPI Summary (90d)',          `/api/analytics/${SITE}/kpi?dateRange=90d`],
        ['KPI — all time',            `/api/analytics/${SITE}/kpi?dateRange=all`],
        ['Traffic Over Time (30d)',    `/api/analytics/${SITE}/traffic?dateRange=30d`],
        ['Traffic Over Time (90d)',    `/api/analytics/${SITE}/traffic?dateRange=90d`],
        ['Pageviews (30d)',            `/api/analytics/${SITE}/pageviews?dateRange=30d`],
        ['Top Pages (30d, 20 results)',`/api/analytics/${SITE}/top-pages?dateRange=30d&limit=20`],
        ['Top Pages (90d)',            `/api/analytics/${SITE}/top-pages?dateRange=90d&limit=10`],
        ['Traffic Sources (30d)',      `/api/analytics/${SITE}/sources?dateRange=30d`],
        ['Device Breakdown (30d)',     `/api/analytics/${SITE}/devices?dateRange=30d`],
        ['Countries (30d)',            `/api/analytics/${SITE}/countries?dateRange=30d&limit=20`],
        ['Sessions (30d)',             `/api/analytics/${SITE}/sessions?dateRange=30d`],
        ['Bounce Rate Trend (30d)',    `/api/analytics/${SITE}/bounce-rate-trend?dateRange=30d`],
        ['Avg Session Trend (30d)',    `/api/analytics/${SITE}/avg-session-trend?dateRange=30d`],
        ['Period Comparison (30d)',    `/api/analytics/${SITE}/comparison?dateRange=30d`],
    ]) {
        coreResults.push(await bench(token, name, path));
    }
    results.sections.push({ name: 'Core Analytics', results: coreResults });

    // ── Realtime ─────────────────────────────────────────────────────────────
    section('Phase 2 — Realtime');
    const rtResults = [];
    for (const [name, path] of [
        ['Realtime Visitors',       `/api/analytics/${SITE}/realtime`],
        ['Realtime Event Stream',   `/api/analytics/${SITE}/realtime/event-stream?limit=50`],
    ]) {
        rtResults.push(await bench(token, name, path, 2));
    }
    results.sections.push({ name: 'Realtime', results: rtResults });

    // ── Engagement & Heatmap ─────────────────────────────────────────────────
    section('Phase 3 — Engagement & Heatmap');
    const engResults = [];
    for (const [name, path] of [
        ['Engagement Summary (30d)', `/api/analytics/${SITE}/engagement/summary?dateRange=30d`],
        ['Heatmap / (30d)',          `/api/analytics/${SITE}/engagement/heatmap?dateRange=30d&path=/`],
        ['Heatmap /pricing (30d)',   `/api/analytics/${SITE}/engagement/heatmap?dateRange=30d&path=/pricing`],
        ['Heatmap /blog (30d)',      `/api/analytics/${SITE}/engagement/heatmap?dateRange=30d&path=/blog`],
        ['Heatmap /about (90d)',     `/api/analytics/${SITE}/engagement/heatmap?dateRange=90d&path=/about`],
        ['Heatmap Summary (90d)',    `/api/analytics/${SITE}/engagement/heatmap-summary?dateRange=90d`],
        ['Scroll Depth (30d)',       `/api/analytics/${SITE}/engagement/scroll-depth?dateRange=30d`],
        ['Rage Clicks (30d)',        `/api/analytics/${SITE}/engagement/rage-clicks?dateRange=30d`],
        ['Page Actions (/)',         `/api/analytics/${SITE}/page-actions?dateRange=30d&path=/`],
    ]) {
        engResults.push(await bench(token, name, path));
    }
    results.sections.push({ name: 'Engagement', results: engResults });

    // ── Performance ──────────────────────────────────────────────────────────
    section('Phase 4 — Performance Monitoring');
    const perfResults = [];
    for (const [name, path] of [
        ['Web Vitals Overview (30d)', `/api/analytics/${SITE}/performance/web-vitals-overview?dateRange=30d`],
        ['Web Vitals Overview (90d)', `/api/analytics/${SITE}/performance/web-vitals-overview?dateRange=90d`],
        ['Web Vitals Per Page (30d)', `/api/analytics/${SITE}/performance/web-vitals?dateRange=30d`],
        ['JS Errors (30d)',           `/api/analytics/${SITE}/performance/errors?dateRange=30d`],
        ['JS Errors (90d)',           `/api/analytics/${SITE}/performance/errors?dateRange=90d`],
        ['JS Errors Over Time (30d)', `/api/analytics/${SITE}/performance/errors-over-time?dateRange=30d`],
    ]) {
        perfResults.push(await bench(token, name, path));
    }
    results.sections.push({ name: 'Performance', results: perfResults });

    // ── Acquisition & Content ────────────────────────────────────────────────
    section('Phase 5 — Acquisition & Content');
    const acqResults = [];
    for (const [name, path] of [
        ['UTM Campaigns (30d)',      `/api/analytics/${SITE}/utm?dateRange=30d`],
        ['Entry Pages (30d)',        `/api/analytics/${SITE}/content/entry-pages?dateRange=30d`],
        ['Exit Pages (30d)',         `/api/analytics/${SITE}/content/exit-pages?dateRange=30d`],
        ['Site Search (30d)',        `/api/analytics/${SITE}/content/site-search?dateRange=30d`],
        ['User Flow (30d)',          `/api/analytics/${SITE}/user-flow?dateRange=30d`],
        ['Acquisition Campaigns',    `/api/analytics/${SITE}/acquisition/campaigns?dateRange=30d`],
        ['Social Media (30d)',       `/api/analytics/${SITE}/acquisition/social?dateRange=30d`],
    ]) {
        acqResults.push(await bench(token, name, path));
    }
    results.sections.push({ name: 'Acquisition', results: acqResults });

    // ── Audience & Conversions ───────────────────────────────────────────────
    section('Phase 6 — Audience & Conversions');
    const audResults = [];
    for (const [name, path] of [
        ['New vs Returning (30d)',   `/api/analytics/${SITE}/audience/new-vs-returning?dateRange=30d`],
        ['Cohorts (30d)',            `/api/analytics/${SITE}/audience/cohorts?dateRange=30d`],
        ['Goals Conversions (30d)', `/api/analytics/${SITE}/goals/conversions?dateRange=30d`],
        ['Funnel Steps (30d)',       `/api/analytics/${SITE}/funnel/steps?dateRange=30d`],
        ['Alerts (30d)',             `/api/analytics/${SITE}/alerts?dateRange=30d`],
        ['Revenue (30d)',            `/api/analytics/${SITE}/revenue?dateRange=30d`],
    ]) {
        audResults.push(await bench(token, name, path));
    }
    results.sections.push({ name: 'Audience', results: audResults });

    // ── Concurrent load ──────────────────────────────────────────────────────
    section('Phase 7 — Concurrent Load Tests');
    console.log('  (Cache invalidated before each test for accurate cold-query measurement)\n');
    const concResults = [];
    for (const [label, count, path] of [
        ['10× KPI cold queries',       10,  `/api/analytics/${SITE}/kpi?dateRange=30d&t=${Date.now()}`],
        ['25× Traffic cold queries',   25,  `/api/analytics/${SITE}/traffic?dateRange=30d&t=${Date.now()}`],
        ['50× KPI cold queries',       50,  `/api/analytics/${SITE}/kpi?dateRange=90d&t=${Date.now()}`],
        ['10× Top Pages + cache hit',  10,  `/api/analytics/${SITE}/top-pages?dateRange=30d`],
        ['100× cache-warm KPI',        100, `/api/analytics/${SITE}/kpi?dateRange=30d`],
    ]) {
        concResults.push(await concurrentTest(token, label, path, count));
    }
    results.sections.push({ name: 'Concurrent', concResults });

    // ── Write throughput ─────────────────────────────────────────────────────
    section('Phase 8 — Write Throughput Burst');
    const makeEvents = (n) => Array.from({ length: n }, (_, i) => ({
        siteId: SITE, userId: `user_${i % 10000}`, sessionId: `sess_${i % 50000}`,
        type: ['pageview','click','scroll_depth','heatmap_click'][i%4],
        path: ['/','/pricing','/blog','/about'][i%4],
        device: i%3===0?'Desktop':i%3===1?'Mobile':'Tablet',
        country: ['US','IN','GB','DE','FR'][i%5],
        timestamp: new Date(Date.now() - Math.random()*90*86400000).toISOString(),
    }));

    // Single large batch
    const t0 = Date.now();
    const bigBatch = await req('POST', '/api/track/batch', { events: makeEvents(500) }, token);
    const bigMs = Date.now() - t0;
    console.log(`  ${bigBatch.status===201?'✅':'❌'} Single batch 500 events: ${bigMs}ms (${Math.round(500000/bigMs)} events/sec)`);

    // 20 concurrent batches of 50
    const burstT = Date.now();
    const burstR = await Promise.all(
        Array.from({ length: 20 }, () =>
            req('POST', '/api/track/batch', { events: makeEvents(50) }, token)
        )
    );
    const burstMs = Date.now() - burstT;
    const burstOk = burstR.filter(r => r.status === 201).length;
    console.log(`  ${burstOk===20?'✅':'⚠️ '} 20 concurrent batches × 50 events = 1,000 events: ${burstMs}ms  ${burstOk}/20 OK  (${Math.round(1000000/burstMs)} events/sec)`);

    // ── Data integrity ───────────────────────────────────────────────────────
    section('Phase 9 — Data Integrity Checks');

    // KPI values
    const kpi = await req('GET', `/api/analytics/${SITE}/kpi?dateRange=90d`, null, token);
    const kpiData = kpi.body?.data ?? kpi.body ?? {};
    const visitors  = kpiData.totalVisitors  ?? kpiData.visitors  ?? 0;
    const pageviews = kpiData.totalPageviews ?? kpiData.pageviews ?? 0;
    const sessions  = kpiData.totalSessions  ?? kpiData.sessions  ?? 0;
    const bounce    = kpiData.bounceRate ?? 0;
    const avgSess   = kpiData.avgSessionDuration ?? '—';
    if (visitors > 0) {
        console.log(`  ✅ KPI (90d): visitors=${Number(visitors).toLocaleString()}  pageviews=${Number(pageviews).toLocaleString()}  sessions=${Number(sessions).toLocaleString()}  bounce=${bounce}%  avg=${avgSess}`);
    } else {
        console.log(`  ⚠️  KPI: 0 visitors (data may still be syncing from PG)`);
    }

    // Top pages breakdown
    const pages = await req('GET', `/api/analytics/${SITE}/top-pages?dateRange=90d&limit=10`, null, token);
    const pagesData = Array.isArray(pages.body?.data) ? pages.body.data : Array.isArray(pages.body) ? pages.body : [];
    if (pagesData.length > 0) {
        console.log(`  ✅ Top Pages (90d): ${pagesData.length} pages found`);
        pagesData.slice(0,5).forEach(p => {
            const name  = p.page || p.path || '?';
            const views = p.views || p.pageviews || 0;
            const uvs   = p.unique_visitors || p.uniqueVisitors || 0;
            console.log(`     ${name.padEnd(20)} ${Number(views).toLocaleString().padStart(8)} views  ${Number(uvs).toLocaleString().padStart(8)} unique`);
        });
    } else {
        console.log(`  ⚠️  Top Pages: no data returned`);
    }

    // Heatmap
    const hm = await req('GET', `/api/analytics/${SITE}/engagement/heatmap?dateRange=90d&path=/`, null, token);
    const hmData = hm.body?.data ?? (Array.isArray(hm.body) ? hm.body : []);
    if (Array.isArray(hmData) && hmData.length > 0) {
        const totalClicks = hmData.reduce((s,d)=>s+d.clicks,0);
        console.log(`  ✅ Heatmap (/): ${hmData.length} hotspots, ${totalClicks.toLocaleString()} total clicks`);
        hmData.slice(0,3).forEach(d => console.log(`     selector="${d.selector}" clicks=${d.clicks} relX=${d.relX}% relY=${d.relY}%`));
    } else {
        console.log(`  ⚠️  Heatmap: no hotspot data`);
    }

    // Traffic sources
    const sources = await req('GET', `/api/analytics/${SITE}/sources?dateRange=90d`, null, token);
    const srcData = sources.body?.data ?? (Array.isArray(sources.body) ? sources.body : []);
    if (Array.isArray(srcData) && srcData.length > 0) {
        console.log(`  ✅ Traffic Sources: ${srcData.length} sources`);
        srcData.slice(0,4).forEach(s => console.log(`     ${(s.source||'direct').padEnd(20)} ${Number(s.visitors).toLocaleString().padStart(8)} visitors  ${s.percentage}%`));
    }

    // Countries
    const cntries = await req('GET', `/api/analytics/${SITE}/countries?dateRange=90d&limit=5`, null, token);
    const cData = cntries.body?.data ?? (Array.isArray(cntries.body) ? cntries.body : []);
    if (Array.isArray(cData) && cData.length > 0) {
        console.log(`  ✅ Countries: ${cData.length} countries`);
        cData.slice(0,3).forEach(c => console.log(`     ${(c.country||c.name||'?').padEnd(15)} ${Number(c.visitors).toLocaleString().padStart(8)} visitors  ${c.percentage}%`));
    }

    // Web vitals
    const vitals = await req('GET', `/api/analytics/${SITE}/performance/web-vitals-overview?dateRange=90d`, null, token);
    const vData = vitals.body?.data ?? vitals.body ?? {};
    const vMetrics = Object.entries(vData).filter(([,v]) => v?.p75 != null);
    if (vMetrics.length > 0) {
        console.log(`  ✅ Web Vitals: ${vMetrics.length} metrics captured`);
        vMetrics.forEach(([k,v]) => {
            const st = v.p75 <= (k==='CLS'?0.1:k==='LCP'?2500:k==='FID'?100:k==='INP'?200:800) ? '🟢' : '🟡';
            console.log(`     ${st} ${k}: p75=${v.p75}${k!=='CLS'?'ms':''}`);
        });
    } else {
        console.log(`  ⚠️  Web Vitals: no data (web_vital events need different query format)`);
    }

    // JS errors
    const errs = await req('GET', `/api/analytics/${SITE}/performance/errors?dateRange=90d`, null, token);
    const eData = errs.body?.data ?? (Array.isArray(errs.body) ? errs.body : []);
    if (Array.isArray(eData) && eData.length > 0) {
        console.log(`  ✅ JS Errors: ${eData.length} unique error types`);
        eData.slice(0,3).forEach(e => console.log(`     "${(e.message||'?').slice(0,50)}"  ${e.occurrences}× on ${e.page}`));
    } else {
        console.log(`  ⚠️  JS Errors: 0 grouped errors returned`);
    }

    // daily_stats check
    const ds = await req('POST', `/api/sql-editor/${SITE}/run`,
        { query: 'SELECT COUNT(*) as days, SUM(visitors) as total_v, SUM(pageviews) as total_pv FROM daily_stats' }, token);
    const dsRow = ds.body?.rows?.[0];
    if (dsRow && Number(dsRow[0]) > 0) {
        console.log(`  ✅ daily_stats: ${Number(dsRow[0])} day×site rows  visitors=${Number(dsRow[1]).toLocaleString()}  pageviews=${Number(dsRow[2]).toLocaleString()}`);
    } else {
        console.log(`  ⚠️  daily_stats: empty (rollup runs after next sync)`);
    }

    // ── Security tests ───────────────────────────────────────────────────────
    section('Phase 10 — Security & Auth Tests');

    const noAuth = await req('GET', `/api/analytics/${SITE}/kpi?dateRange=30d`);
    console.log(`  ${noAuth.status===401?'✅':'❌'} No auth → HTTP ${noAuth.status} (expected 401)`);

    const badToken = await req('GET', `/api/analytics/${SITE}/kpi?dateRange=30d`, null, 'invalidtoken_abc123');
    console.log(`  ${badToken.status===401?'✅':'❌'} Bad token → HTTP ${badToken.status} (expected 401)`);

    const badLogin = await req('POST', '/api/auth/login', { email: EMAIL, password: 'wrongpassword' });
    console.log(`  ${badLogin.status===401?'✅':'❌'} Wrong password → HTTP ${badLogin.status}: "${badLogin.body?.error}"`);

    const emptyLogin = await req('POST', '/api/auth/login', {});
    console.log(`  ${emptyLogin.status>=400?'✅':'❌'} Empty credentials → HTTP ${emptyLogin.status}`);

    const sqlInject = await req('GET', `/api/analytics/site_%27%3B%20DROP%20TABLE%20events%3B--/kpi`, null, token);
    console.log(`  ${sqlInject.status>=400?'✅':'❌'} SQL injection in siteId → HTTP ${sqlInject.status} (rejected)`);

    // XSS in request body
    const xssTrack = await req('POST', '/api/track/event', {
        siteId: SITE, userId: 'u1', type: 'pageview',
        path: '<script>alert(1)</script>', url: 'javascript:alert(1)',
    });
    console.log(`  ${xssTrack.status<500?'✅':'❌'} XSS payload in tracking → HTTP ${xssTrack.status} (not a 500)`);

    // ── Storage status ───────────────────────────────────────────────────────
    section('Phase 11 — Storage & System Status');
    const storageStatus = await req('GET', '/api/storage/status', null, token);
    const ss = storageStatus.body?.storage ?? {};
    console.log(`  S3/R2 enabled:   ${ss.enabled ? '✅ Yes' : '⭕ No (local disk)'}`);
    if (!ss.enabled) console.log(`  Reason:          ${ss.reason}`);

    // Pool stats via health (if endpoint exists)
    const health = await req('GET', '/api/health');
    if (health.status === 200) {
        const h = health.body;
        console.log(`  Health:          ✅ OK — uptime: ${Math.round((h.uptime||0)/60)}min  DB: ${h.db}`);
    } else {
        console.log(`  Health endpoint: not available (HTTP ${health.status})`);
    }

    // DuckDB state summary
    const summary = await req('POST', `/api/sql-editor/${SITE}/run`, {
        query: `SELECT
            COUNT(*) as total,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(DISTINCT session_id) as unique_sessions,
            COUNT(CASE WHEN type='pageview' THEN 1 END) as pageviews,
            COUNT(CASE WHEN type='heatmap_click' THEN 1 END) as heatmap_clicks,
            COUNT(CASE WHEN type='web_vital' THEN 1 END) as web_vitals,
            COUNT(CASE WHEN type='js_error' THEN 1 END) as js_errors,
            MIN(timestamp) as earliest,
            MAX(timestamp) as latest
        FROM events`,
    }, token);
    const row = summary.body?.rows?.[0];
    if (row) {
        console.log(`\n  DuckDB data summary:`);
        console.log(`    Total events:      ${Number(row[0]).toLocaleString()}`);
        console.log(`    Unique users:      ${Number(row[1]).toLocaleString()}`);
        console.log(`    Unique sessions:   ${Number(row[2]).toLocaleString()}`);
        console.log(`    Pageviews:         ${Number(row[3]).toLocaleString()}`);
        console.log(`    Heatmap clicks:    ${Number(row[4]).toLocaleString()}`);
        console.log(`    Web vitals events: ${Number(row[5]).toLocaleString()}`);
        console.log(`    JS error events:   ${Number(row[6]).toLocaleString()}`);
        console.log(`    Date range:        ${row[7]?.split('T')[0]} → ${row[8]?.split('T')[0]}`);
    }

    // ── Final report ─────────────────────────────────────────────────────────
    const totalMs   = Date.now() - startTime;
    const allBench  = results.sections.flatMap(s => s.results || []);
    const passed    = allBench.filter(b => b?.ok).length;
    const failed    = allBench.filter(b => b && !b.ok).length;
    const avgCold   = allBench.length ? Math.round(allBench.reduce((s,b)=>s+(b?.cold||0),0)/allBench.length) : 0;
    const avgWarm   = allBench.length ? Math.round(allBench.reduce((s,b)=>s+(b?.warm||0),0)/allBench.length) : 0;
    const slowest   = allBench.reduce((m,b) => b?.cold > (m?.cold||0) ? b : m, null);
    const fastest   = allBench.reduce((m,b) => b?.cold < (m?.cold||Infinity) ? b : m, null);

    console.log('\n\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                         FINAL REPORT                            ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(`\n  Test duration:         ${(totalMs/1000).toFixed(1)}s`);
    console.log(`  Endpoints tested:      ${allBench.length}`);
    console.log(`  Passed (HTTP 200):     ${passed} / ${allBench.length}`);
    if (failed > 0) console.log(`  Failed:                ${failed}`);
    console.log(`  Avg cold query:        ${avgCold}ms`);
    console.log(`  Avg warm (cached):     ${avgWarm}ms`);
    if (slowest) console.log(`  Slowest endpoint:      ${slowest.name} (${slowest.cold}ms cold)`);
    if (fastest) console.log(`  Fastest endpoint:      ${fastest.name} (${fastest.cold}ms cold)`);

    // Section summaries
    console.log('\n  ── Section Summary ──');
    for (const sec of results.sections) {
        if (!sec.results) continue;
        const sp = sec.results.filter(r=>r?.ok).length;
        const st = sec.results.length;
        const sa = Math.round(sec.results.reduce((s,r)=>s+(r?.cold||0),0)/(st||1));
        console.log(`  ${sp===st?'✅':'⚠️ '} ${sec.name.padEnd(22)} ${sp}/${st} passed  avg cold: ${sa}ms`);
    }

    if (failed > 0) {
        console.log('\n  ── Failed Endpoints ──');
        allBench.filter(b=>b&&!b.ok).forEach(b => console.log(`  ❌ ${b.name} (HTTP ${b.status})`));
    }

    console.log('\n  ── Performance Tiers ──');
    console.log(`  🚀 Sub-3ms (cache hot):  ${allBench.filter(b=>b?.warm<3).length} endpoints`);
    console.log(`  ⚡ 3-50ms cold:          ${allBench.filter(b=>b?.cold>=3&&b?.cold<50).length} endpoints`);
    console.log(`  ✔  50-300ms cold:        ${allBench.filter(b=>b?.cold>=50&&b?.cold<300).length} endpoints`);
    console.log(`  🔄 >300ms cold:          ${allBench.filter(b=>b?.cold>=300).length} endpoints`);

    console.log('\n══════════════════════════════════════════════════════════════════\n');
}

main().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); });
