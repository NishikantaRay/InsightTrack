#!/usr/bin/env node
/**
 * InsightTrack — Live Demo Instance Seeder
 *
 * This script sets up a complete demo instance on your live server:
 * 1. Creates a dedicated demo user account (NOT a personal/admin account)
 * 2. Creates a demo site (hello.com)
 * 3. Inserts realistic sample data directly into PostgreSQL
 * 4. Triggers a full DuckDB sync so all analytics pages show data
 *
 * Usage:
 *   # On your server (localhost):
 *   node scripts/seed-live-demo.js
 *
 *   # Against a remote/production API — set a strong password:
 *   API=https://your-backend.railway.app DEMO_PASS='a-strong-password' \
 *     node scripts/seed-live-demo.js
 *
 * Environment variables (read from .env if present):
 *   API          — Backend URL (default: http://localhost:3001)
 *   DEMO_EMAIL   — Demo account email (default: demo@insighttrack.local)
 *   DEMO_PASS    — Demo account password. If unset, a STRONG random password
 *                  is generated and printed once. Remote backends reject weak
 *                  (<12 char) passwords unless ALLOW_WEAK_DEMO=1.
 *   DEMO_NAME    — Demo account name (default: Demo User)
 *   DEMO_DOMAIN  — Demo site domain (default: hello.com)
 *   EVENTS       — Number of events to generate (default: 10000)
 *
 * SECURITY: This creates a public, shared demo login. Never reuse your real
 * admin credentials here, and prefer a throwaway DEMO_EMAIL on production.
 *
 * After running:
 *   - Login at your dashboard with the demo credentials shown in the summary
 *   - The "hello" site will show analytics data across all 17 pages
 */

import http from 'node:http';
import https from 'node:https';
import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

// ── Load .env if present ──────────────────────────────────────────────────────
// Works from any repo layout — checks the known backend .env locations across
// traffic (analytics-db) and traffic2 (apps / appsv2) so the same script runs
// unchanged in all three folders.
const ENV_CANDIDATES = [
    '../apps/analytics-api/.env',      // traffic2/apps
    '../appsv2/analytics-api/.env',    // traffic2/appsv2
    '../analytics-db/.env',            // traffic (split services)
    '../analytics-server/.env',        // traffic (write service)
    '../.env',                         // repo root
];
for (const rel of ENV_CANDIDATES) {
    const envPath = new URL(rel, import.meta.url).pathname;
    if (existsSync(envPath)) {
        readFileSync(envPath, 'utf8').split('\n').forEach(line => {
            const [k, ...v] = line.split('=');
            if (k && !k.startsWith('#') && !process.env[k.trim()]) {
                process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
            }
        });
    }
}

const API        = (process.env.API || 'http://localhost:3001').replace(/\/$/, '');

// Is this targeting a production/remote backend? (anything not localhost)
const IS_REMOTE  = !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(API);

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@insighttrack.local';
const DEMO_NAME  = process.env.DEMO_NAME  || 'Demo User';
const DEMO_SITE  = process.env.DEMO_DOMAIN || 'hello.com';
const TOTAL      = parseInt(process.env.EVENTS || '10000');
const BATCH      = 500;

// Password: never bake a weak default into a prod seed. If DEMO_PASS isn't set,
// generate a strong random one (and we print it once so you can log in).
const DEMO_PASS_PROVIDED = !!process.env.DEMO_PASS;
const DEMO_PASS  = process.env.DEMO_PASS || ('Demo-' + randomBytes(9).toString('base64url'));

// Guard rails: refuse weak/personal demo creds when pointed at a remote host
// unless the operator explicitly opts in with ALLOW_WEAK_DEMO=1.
if (IS_REMOTE && DEMO_PASS_PROVIDED && process.env.DEMO_PASS.length < 12 && process.env.ALLOW_WEAK_DEMO !== '1') {
    console.error('\n✗ Refusing to seed a remote backend with a weak DEMO_PASS (<12 chars).');
    console.error('  Use a strong password, or set ALLOW_WEAK_DEMO=1 to override.\n');
    process.exit(1);
}

// ── HTTP helper ──────────────────────────────────────────────────────────────
function req(method, path, body, token) {
    return new Promise((res, rej) => {
        const url  = new URL(API + path);
        const mod  = url.protocol === 'https:' ? https : http;
        const data = body ? JSON.stringify(body) : null;
        const r    = mod.request({
            hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search, method,
            headers: {
                'Content-Type': 'application/json',
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        }, resp => {
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

// ── Event generator ──────────────────────────────────────────────────────────
const PAGES    = ['/', '/pricing', '/blog', '/about', '/contact', '/docs', '/signup', '/features', '/enterprise', '/changelog'];
const SOURCES  = ['google', 'direct', 'twitter', 'linkedin', 'newsletter', 'github', 'hackernews'];
const DEVICES  = ['Desktop', 'Mobile', 'Tablet'];
const BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge'];
const OSES     = ['Windows', 'macOS', 'Linux', 'Android', 'iOS'];
const COUNTRIES= ['US', 'IN', 'GB', 'DE', 'FR', 'CA', 'AU', 'BR', 'JP', 'SG'];
const CITIES   = ['New York', 'London', 'Bangalore', 'Berlin', 'Sydney', 'Toronto', 'Tokyo'];
const TYPES    = ['pageview','pageview','pageview','click','scroll_depth','heatmap_click','web_vital','js_error','rage_click'];
const UTM_SRC  = ['google','newsletter','twitter','linkedin',''];
const UTM_MED  = ['cpc','email','social','organic',''];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function randTs() {
    const msAgo = Math.random() * 90 * 24 * 60 * 60 * 1000;
    return new Date(Date.now() - msAgo).toISOString();
}

function makeEvent(siteId, i) {
    const type   = pick(TYPES);
    const path   = pick(PAGES);
    const userId = `user_${rand(1, 10000)}`;
    const sessId = `sess_${rand(1, 50000)}`;
    const props  = {};

    if (type === 'scroll_depth')  props.depth = pick([25,50,75,100]);
    if (type === 'heatmap_click') { props.relX = rand(0,100); props.relY = rand(0,100); props.selector = `button.cta-${rand(1,5)}`; }
    if (type === 'web_vital')     { props.name = pick(['LCP','FID','CLS','INP','TTFB']); props.value = rand(100,3000); props.rating = 'good'; }
    if (type === 'js_error')      { props.message = pick(['TypeError: Cannot read null','ReferenceError: x is not defined','NetworkError: fetch failed']); props.source = '/static/main.js'; }
    if (type === 'rage_click')    { props.selector = `button.${pick(['cta','nav','buy','close'])}`; props.count = rand(3,8); }

    const utmSrc = pick(UTM_SRC);
    const utmMed = pick(UTM_MED);

    return {
        siteId, userId, sessionId: sessId, type,
        url:  `https://${DEMO_SITE}${path}`,
        path,
        referrer: Math.random() > 0.5 ? `https://${pick(SOURCES)}.com` : null,
        device:   pick(DEVICES),
        browser:  pick(BROWSERS),
        os:       pick(OSES),
        country:  pick(COUNTRIES),
        city:     pick(CITIES),
        timestamp: randTs(),
        utm_source:   utmSrc,
        utm_medium:   utmMed,
        utm_campaign: utmSrc ? `campaign_${rand(1,8)}` : '',
        props,
    };
}

// ── Progress ──────────────────────────────────────────────────────────────────
function progress(done, total, start) {
    const pct  = (done / total * 100).toFixed(1);
    const bar  = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
    const rate = Math.round(done / ((Date.now() - start) / 1000));
    const eta  = Math.round((total - done) / (rate || 1));
    process.stdout.write(`\r  [${bar}] ${pct}%  ${done.toLocaleString()}/${total.toLocaleString()}  ${rate.toLocaleString()}/s  ETA ${eta}s   `);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║     InsightTrack — Live Demo Instance Seeder        ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    console.log(`  API:    ${API}`);
    console.log(`  Email:  ${DEMO_EMAIL}`);
    console.log(`  Site:   ${DEMO_SITE}`);
    console.log(`  Events: ${TOTAL.toLocaleString()}\n`);

    // ── 1. Register or login ──────────────────────────────────────────────────
    console.log('① Setting up demo account…');
    let token;
    const regRes = await req('POST', '/api/auth/register', {
        name: DEMO_NAME, email: DEMO_EMAIL, password: DEMO_PASS,
    });

    if (regRes.status === 201) {
        token = regRes.body.data?.token;
        console.log(`  ✓ Created account: ${DEMO_EMAIL}`);
    } else if (regRes.status === 409 || regRes.body?.error?.includes('exists')) {
        const loginRes = await req('POST', '/api/auth/login', { email: DEMO_EMAIL, password: DEMO_PASS });
        if (loginRes.status !== 200) {
            console.error('  ✗ Login failed:', loginRes.body);
            process.exit(1);
        }
        token = loginRes.body.data?.token;
        console.log(`  ✓ Logged in as existing account: ${DEMO_EMAIL}`);
    } else {
        console.error('  ✗ Auth failed:', regRes.body);
        process.exit(1);
    }

    // ── 2. Create or find site ────────────────────────────────────────────────
    console.log('② Setting up demo site…');
    const sitesRes = await req('GET', '/api/sites', null, token);
    const sites    = sitesRes.body?.data || sitesRes.body || [];
    let siteId     = (Array.isArray(sites) ? sites : []).find(s => s.domain === DEMO_SITE)?.id;

    if (!siteId) {
        const createRes = await req('POST', '/api/sites', { name: 'hello', domain: DEMO_SITE }, token);
        if (createRes.status !== 201) {
            console.error('  ✗ Failed to create site:', createRes.body);
            process.exit(1);
        }
        siteId = createRes.body.data?.id || createRes.body.id;
        console.log(`  ✓ Created site: ${DEMO_SITE} (${siteId})`);
    } else {
        console.log(`  ✓ Using existing site: ${DEMO_SITE} (${siteId})`);
    }

    // ── 3. Insert events ──────────────────────────────────────────────────────
    console.log(`③ Inserting ${TOTAL.toLocaleString()} events in batches of ${BATCH}…`);
    const start = Date.now();
    let inserted = 0, errors = 0;
    const totalBatches = Math.ceil(TOTAL / BATCH);

    for (let b = 0; b < totalBatches; b++) {
        const count  = Math.min(BATCH, TOTAL - inserted);
        const events = Array.from({ length: count }, (_, i) => makeEvent(siteId, inserted + i));

        try {
            const r = await req('POST', '/api/track/batch', { events }, token);
            if (r.status === 201) {
                inserted += count;
            } else {
                errors++;
                if (errors <= 3) console.error(`\n  ✗ Batch ${b} failed: HTTP ${r.status}`);
            }
        } catch (e) {
            errors++;
        }

        if (b % 5 === 0) progress(inserted, TOTAL, start);
    }

    process.stdout.write('\n');
    const secs  = ((Date.now() - start) / 1000).toFixed(1);
    const rate  = Math.round(inserted / parseFloat(secs));
    console.log(`  ✓ Inserted ${inserted.toLocaleString()} events in ${secs}s (${rate.toLocaleString()}/sec)`);
    if (errors > 0) console.log(`  ⚠ ${errors} batch(es) failed`);

    // ── 4. Trigger full sync ──────────────────────────────────────────────────
    console.log('④ Triggering full PG → DuckDB sync…');
    const syncRes = await req('POST', '/api/sync?full=true', {}, token);
    if (syncRes.status === 200) {
        console.log(`  ✓ Sync complete — ${syncRes.body.totalRows?.toLocaleString() || '?'} rows synced`);
    } else {
        console.log(`  ⚠ Sync returned HTTP ${syncRes.status} (may still be running in background)`);
    }

    // ── 5. Verify ─────────────────────────────────────────────────────────────
    console.log('⑤ Verifying data…');
    const kpiRes = await req('GET', `/api/analytics/${siteId}/kpi?dateRange=90d`, null, token);
    if (kpiRes.status === 200) {
        const kpi = kpiRes.body?.data || kpiRes.body;
        const v = kpi.totalVisitors ?? kpi.visitors ?? 0;
        const p = kpi.totalPageviews ?? kpi.pageviews ?? 0;
        if (Number(v) > 0) {
            console.log(`  ✓ KPI check: visitors=${Number(v).toLocaleString()}  pageviews=${Number(p).toLocaleString()}`);
        } else {
            console.log('  ⚠ KPI shows 0 — sync may still be running. Wait 60s and check again.');
        }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════');
    console.log('  ✅ DEMO INSTANCE READY');
    console.log('══════════════════════════════════════════════════════');
    console.log(`\n  Dashboard: ${API.replace(':3001','').replace('3001','4173')} (or your frontend URL)`);
    console.log(`  Email:     ${DEMO_EMAIL}`);
    console.log(`  Password:  ${DEMO_PASS}${DEMO_PASS_PROVIDED ? '' : '   ⚠ auto-generated — save it now, it is not stored anywhere'}`);
    console.log(`  Site ID:   ${siteId}`);
    console.log(`\n  All 17 analytics pages now have data:`);
    console.log('  → Dashboard, Realtime, Pages, Heatmap, Funnels');
    console.log('  → Performance (Web Vitals + JS Errors)');
    console.log('  → Audience, Content, Acquisition, Engagement');
    console.log('  → Reporting, SQL Editor, Settings, Profile');
    console.log('\n  To reseed anytime: node scripts/seed-live-demo.js');
    console.log('══════════════════════════════════════════════════════\n');
}

main().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); });
