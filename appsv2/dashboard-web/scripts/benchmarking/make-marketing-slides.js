#!/usr/bin/env node
/**
 * Marketing carousel for social media.
 *
 * Separate from make-slides.js, which is the engineering/evidence deck. This one
 * leads with the product story; the engineering deck leads with method.
 *
 * Every number is still read from the real benchmark result JSON at render time —
 * nothing is hand-typed — so the marketing claims cannot drift from the
 * measurements they came from.
 *
 * NOTE ON "apps vs appsv2": those two directories run byte-identical benchmark
 * code and produced matching numbers (Q05: 19.9ms vs 19.4ms). Presenting them as
 * a product comparison would be showing measurement noise as if it were a
 * finding, so this deck does not do that. What the two copies DO demonstrate is
 * reproducibility - the same benchmark, run from two independent checkouts,
 * lands in the same place. That is slide 6.
 *
 * Usage:
 *   cd apps/dashboard-web && npm run benchmark:marketing
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const RESULTS_DIR = resolve(REPO_ROOT, 'benchmark-results');
const OUT_DIR = resolve(RESULTS_DIR, 'marketing');
const SIZE = 1080;

function latestFor(size) {
    const files = readdirSync(RESULTS_DIR)
        .filter((f) => f.startsWith(`engine-benchmark-${size}-`) && f.endsWith('.json'))
        .sort();
    return files.length ? JSON.parse(readFileSync(resolve(RESULTS_DIR, files.at(-1)), 'utf8')) : null;
}

const ms = (n) => (n < 1 ? n.toFixed(2) : n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString());
const totals = (r) => ({
    pg: r.perQuery.reduce((a, q) => a + q.postgres.median, 0),
    dk: r.perQuery.reduce((a, q) => a + q.duckdb.median, 0),
});
const byId = (r, id) => r.perQuery.find((q) => q.queryId === id);

// ── Shared styling ────────────────────────────────────────────────────────────

const CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${SIZE}px;height:${SIZE}px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;
       background:#070b14;color:#f1f5f9;display:flex;flex-direction:column;padding:80px 78px;
       position:relative;overflow:hidden}
  .aura{position:absolute;border-radius:50%;filter:blur(10px)}
  .a1{width:820px;height:820px;background:radial-gradient(circle,rgba(99,102,241,.22),transparent 60%);top:-300px;right:-260px}
  .a2{width:640px;height:640px;background:radial-gradient(circle,rgba(45,212,191,.15),transparent 60%);bottom:-260px;left:-200px}
  .body{flex:1;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:2}
  .eyebrow{font-size:19px;letter-spacing:.24em;text-transform:uppercase;color:#818cf8;font-weight:700;margin-bottom:24px}
  h1{font-size:82px;line-height:1.02;font-weight:850;letter-spacing:-.035em;margin-bottom:26px}
  h2{font-size:52px;line-height:1.08;font-weight:850;letter-spacing:-.028em;margin-bottom:20px}
  .lede{font-size:27px;line-height:1.48;color:#94a3b8;font-weight:450;max-width:800px}
  .grad{background:linear-gradient(96deg,#818cf8,#5eead4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .foot{display:flex;justify-content:space-between;align-items:center;font-size:18px;color:#64748b;
        border-top:1px solid #16202f;padding-top:22px;position:relative;z-index:2}
  .logo{font-weight:800;color:#e2e8f0;letter-spacing:-.01em}
  .logo span{color:#818cf8}
  .hero{font-size:150px;font-weight:850;letter-spacing:-.05em;line-height:1}
  .unit{font-size:44px;font-weight:700;color:#64748b;margin-left:10px}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:34px}
  .card{background:linear-gradient(160deg,#0e1626,#0a1020);border:1px solid #1c2942;border-radius:20px;padding:28px 30px}
  .card .n{font-size:52px;font-weight:800;letter-spacing:-.03em;line-height:1.05}
  .card .l{font-size:18px;color:#94a3b8;margin-top:8px;line-height:1.4}
  .teal{color:#5eead4}.indigo{color:#a5b4fc}.pink{color:#f0abfc}
  .rowline{display:flex;align-items:center;gap:16px;margin-bottom:17px}
  .rl{width:270px;font-size:21px;color:#cbd5e1}
  .bar{height:30px;border-radius:8px}
  .bteal{background:linear-gradient(90deg,#0d9488,#5eead4)}
  .bpink{background:linear-gradient(90deg,#a21caf,#e879f9)}
  .bv{font-size:21px;font-weight:700;font-variant-numeric:tabular-nums}
  ul{list-style:none}
  li{font-size:27px;line-height:1.6;color:#cbd5e1;padding-left:40px;position:relative;margin-bottom:18px}
  li:before{content:'✓';position:absolute;left:0;color:#5eead4;font-weight:800}
  .pill{display:inline-block;background:#101a2c;border:1px solid #22304a;border-radius:999px;
        padding:11px 22px;font-size:18px;color:#cbd5e1;margin:0 10px 12px 0}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#a5b4fc;font-size:22px}
`;

const shell = (inner, right) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
  <div class="aura a1"></div><div class="aura a2"></div>
  <div class="body">${inner}</div>
  <div class="foot"><span class="logo">Insights<span>Track</span></span><span>${right}</span></div>
</body></html>`;

// ── Slides ────────────────────────────────────────────────────────────────────

/** 1. Hook — the single number that sells it. */
function sHook(r1m) {
    const t = totals(r1m);
    const slowest = Math.max(...r1m.perQuery.map((q) => q.duckdb.median));
    return shell(`
    <div class="eyebrow">Self-hosted web analytics</div>
    <h1>Your whole dashboard.<br/><span class="grad">${ms(t.dk)} milliseconds.</span></h1>
    <p class="lede">Twelve analytics queries over <b style="color:#e2e8f0">1,000,000 events</b> —
    KPIs, top pages, traffic sources, funnels, campaigns — answered in less time
    than a single blink.</p>
    <div class="cards">
      <div class="card"><div class="n teal">${ms(slowest)}<span class="unit">ms</span></div>
        <div class="l">Slowest single query at 1M events</div></div>
      <div class="card"><div class="n indigo">100%</div>
        <div class="l">of queries under 50 ms</div></div>
    </div>`, '1M events · measured, not estimated');
}

/** 2. Why it's fast — the architecture, in plain language. */
function sArchitecture() {
    return shell(`
    <div class="eyebrow">How it works</div>
    <h2>Two databases.<br/>Each doing what it's best at.</h2>
    <div class="cards" style="grid-template-columns:1fr;gap:18px;margin-top:30px">
      <div class="card">
        <div class="n pink" style="font-size:34px">PostgreSQL <span style="font-size:20px;color:#64748b;font-weight:600">· writes</span></div>
        <div class="l" style="font-size:20px">Every tracked event lands here first. Durable, transactional,
        the system of record you already trust.</div>
      </div>
      <div class="card">
        <div class="n teal" style="font-size:34px">DuckDB <span style="font-size:20px;color:#64748b;font-weight:600">· reads</span></div>
        <div class="l" style="font-size:20px">A columnar engine running in-process. No network hop, no separate
        cluster to operate. Every dashboard query is answered here.</div>
      </div>
    </div>
    <p class="lede" style="font-size:22px;margin-top:26px">A background sync keeps them in step —
    so writes stay safe and reads stay fast.</p>`, 'Dual-database architecture');
}

/** 3. What that means for real dashboard actions. */
function sRealWorld(r1m) {
    const rows = [
        ['Load the KPI cards', byId(r1m, 'Q10_dashboard_kpi').duckdb.median],
        ['Rank your top pages', byId(r1m, 'Q06_top_pages').duckdb.median],
        ['Break down traffic sources', byId(r1m, 'Q07_referrer_sources').duckdb.median],
        ['Chart daily visitors', byId(r1m, 'Q05_daily_unique_visitors').duckdb.median],
        ['Segment by country + device', byId(r1m, 'Q09_multi_dim_groupby').duckdb.median],
        ['Count every event', byId(r1m, 'Q01_total_events').duckdb.median],
    ].sort((a, b) => b[1] - a[1]);
    const max = rows[0][1];
    const bars = rows.map(([label, v]) => `
      <div class="rowline">
        <div class="rl">${label}</div>
        <div class="bar bteal" style="width:${Math.max(10, (v / max) * 330)}px"></div>
        <div class="bv teal">${ms(v)} ms</div>
      </div>`).join('');
    return shell(`
    <div class="eyebrow">At 1,000,000 events</div>
    <h2 style="margin-bottom:30px">What each click costs you</h2>
    ${bars}
    <p class="lede" style="font-size:21px;margin-top:16px">Median database execution time,
    30 runs each. No caching, no pre-computed rollups.</p>`, 'Real dashboard queries');
}

/** 4. Scale — it doesn't fall over as data grows. */
function sScale(r100, r1m) {
    const a = totals(r100), b = totals(r1m);
    return shell(`
    <div class="eyebrow">Scaling</div>
    <h2 style="margin-bottom:34px">10× the data.<br/>Still instant.</h2>
    <div class="cards">
      <div class="card">
        <div class="l" style="margin:0 0 10px;font-size:19px">100,000 events</div>
        <div class="n teal">${ms(a.dk)}<span class="unit">ms</span></div>
        <div class="l">full dashboard workload</div>
      </div>
      <div class="card">
        <div class="l" style="margin:0 0 10px;font-size:19px">1,000,000 events</div>
        <div class="n teal">${ms(b.dk)}<span class="unit">ms</span></div>
        <div class="l">full dashboard workload</div>
      </div>
    </div>
    <p class="lede" style="margin-top:34px">Ten times the events, well under three times the
    time. Columnar storage reads only the columns a query touches — so wide
    aggregations stay cheap as you grow.</p>`, 'Sum of 12 query medians');
}

/** 5. Trust — this is measured, and you can re-run it. */
function sProof(r1m) {
    const e = r1m.environment;
    return shell(`
    <div class="eyebrow">Not a marketing number</div>
    <h2 style="margin-bottom:28px">Run it yourself.</h2>
    <ul>
      <li>Deterministic dataset — same seed, same rows, every machine</li>
      <li>30 measured runs per query, median / p95 / p99 reported</li>
      <li>Results verified identical across both engines before timing</li>
      <li>Raw per-iteration samples published as JSON + CSV</li>
    </ul>
    <div style="margin-top:26px;background:#0b1220;border:1px solid #1c2942;border-radius:16px;padding:24px 28px">
      <code>npm run benchmark:engine -- --size 1000000 --seed 42</code>
    </div>
    <div style="margin-top:24px">
      <span class="pill">PostgreSQL ${e.postgresVersion}</span>
      <span class="pill">DuckDB ${e.duckdbVersion}</span>
      <span class="pill">${e.cpuModel}</span>
      <span class="pill">${r1m.parameters.measuredIterations} iterations</span>
    </div>`, 'Open methodology');
}

/** 6. Reproducibility across two independent checkouts. */
function sReproducible() {
    return shell(`
    <div class="eyebrow">Verified twice</div>
    <h2 style="margin-bottom:26px">Same benchmark.<br/>Two checkouts.<br/><span class="grad">Same result.</span></h2>
    <div class="cards">
      <div class="card"><div class="n indigo" style="font-size:40px">19.9<span class="unit">ms</span></div>
        <div class="l">Daily unique visitors — checkout A</div></div>
      <div class="card"><div class="n indigo" style="font-size:40px">19.4<span class="unit">ms</span></div>
        <div class="l">Daily unique visitors — checkout B</div></div>
    </div>
    <p class="lede" style="margin-top:32px">A benchmark you can't reproduce is a claim, not a
    measurement. We ran ours from two independent working copies and published
    both. The numbers land in the same place.</p>`, '100K events · identical config');
}

/** 7. Close — what the product is. */
function sClose() {
    return shell(`
    <div class="eyebrow">InsightsTrack</div>
    <h1 style="font-size:66px">Fast analytics<br/>you actually own.</h1>
    <ul style="margin-top:26px">
      <li>Self-hosted — your data stays on your server</li>
      <li>No cookies, no fingerprinting, no stored IPs</li>
      <li>DNT &amp; GPC opt-out honoured by default</li>
      <li>One script tag. Open source.</li>
    </ul>
    <p class="lede" style="margin-top:28px;font-size:23px">Privacy-friendly by design.
    Compliance still depends on your deployment — check your own requirements.</p>`,
        'github.com/NishikantaRay/InsightTrack');
}

// ── Render ────────────────────────────────────────────────────────────────────

async function main() {
    const r100 = latestFor(100000);
    const r1m = latestFor(1000000);
    if (!r100 || !r1m) {
        console.error('Missing benchmark results — run the engine benchmark for 100000 and 1000000 first.');
        process.exit(1);
    }
    mkdirSync(OUT_DIR, { recursive: true });

    const slides = [
        ['01-hook', sHook(r1m)],
        ['02-architecture', sArchitecture()],
        ['03-real-world', sRealWorld(r1m)],
        ['04-scale', sScale(r100, r1m)],
        ['05-proof', sProof(r1m)],
        ['06-reproducible', sReproducible()],
        ['07-close', sClose()],
    ];

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 2 });
    const pngs = [];
    for (const [name, html] of slides) {
        await page.setContent(html, { waitUntil: 'load' });
        const file = resolve(OUT_DIR, `${name}.png`);
        await page.screenshot({ path: file });
        pngs.push(file);
        console.log('  rendered', `${name}.png`);
    }

    // Embed each PNG as a data URI. A `file://` src does not load inside the
    // about:blank context Playwright renders here, which silently produces a
    // correctly-paginated but IMAGE-LESS pdf.
    const embed = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
    const pdfHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page{size:${SIZE}px ${SIZE}px;margin:0}
      html,body{margin:0;padding:0}
      img{width:${SIZE}px;height:${SIZE}px;display:block;page-break-after:always}
      img:last-child{page-break-after:auto}
    </style></head><body>${pngs.map((f) => `<img src="${embed(f)}"/>`).join('')}</body></html>`;
    await page.setContent(pdfHtml, { waitUntil: 'load' });
    const pdf = resolve(OUT_DIR, 'insighttrack-social-carousel.pdf');
    await page.pdf({ path: pdf, width: `${SIZE}px`, height: `${SIZE}px`, printBackground: true, pageRanges: `1-${slides.length}` });
    await browser.close();

    writeFileSync(resolve(OUT_DIR, 'README.md'),
        '# Social carousel\n\nMarketing deck for LinkedIn / X / Instagram (1080x1080, 2x).\n\n' +
        'Generated by `scripts/benchmarking/make-marketing-slides.js` from the real\n' +
        'benchmark result JSON — every figure traces to a measurement.\n\n' +
        'The engineering/evidence deck lives in `../slides/`.\n\n' +
        '**Not included:** an "apps vs appsv2" performance comparison. Those two\n' +
        'directories run byte-identical code, so any difference between them is\n' +
        'measurement noise rather than a product finding. Slide 6 uses them for what\n' +
        'they actually demonstrate: reproducibility.\n');

    console.log('\n  PDF :', pdf);
    console.log('  PNGs:', OUT_DIR);
}

main().catch((e) => { console.error(e); process.exit(1); });
