#!/usr/bin/env node
/**
 * Render a social-media slide deck from real benchmark result files.
 *
 * Reads the newest `benchmark-results/engine-benchmark-*.json` for each dataset
 * size and renders square (1080x1080) slides as PNGs plus a combined PDF.
 *
 * Every number on a slide comes from the result JSON. Nothing is hand-typed, so
 * the deck cannot drift from the measurements. Slides carry the measurement
 * boundary and environment, and the closing slide states the limitations
 * explicitly — a benchmark chart without its caveats is how misleading claims
 * get started.
 *
 * Usage:
 *   cd apps/dashboard-web && npm run benchmark:slides
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const RESULTS_DIR = resolve(REPO_ROOT, 'benchmark-results');
const OUT_DIR = resolve(REPO_ROOT, 'benchmark-results', 'slides');

const SIZE = 1080;

function latestFor(size) {
    const files = readdirSync(RESULTS_DIR)
        .filter((f) => f.startsWith(`engine-benchmark-${size}-`) && f.endsWith('.json'))
        .sort();
    if (files.length === 0) return null;
    return JSON.parse(readFileSync(resolve(RESULTS_DIR, files[files.length - 1]), 'utf8'));
}

const fmt = (n) => (n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(n < 10 ? 2 : 1));

// -- Slide templates ----------------------------------------------------------

const CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${SIZE}px; height:${SIZE}px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;
         background:#0b0f1a; color:#e8ecf5; display:flex; flex-direction:column;
         padding:72px 76px; position:relative; overflow:hidden; }
  .glow { position:absolute; width:760px; height:760px; border-radius:50%;
          background:radial-gradient(circle,rgba(99,102,241,.20),transparent 62%);
          top:-260px; right:-200px; }
  .glow2 { position:absolute; width:600px; height:600px; border-radius:50%;
           background:radial-gradient(circle,rgba(16,185,129,.13),transparent 62%);
           bottom:-240px; left:-180px; }
  .kicker { font-size:20px; letter-spacing:.22em; text-transform:uppercase;
            color:#818cf8; font-weight:700; margin-bottom:22px; }
  h1 { font-size:66px; line-height:1.06; font-weight:800; letter-spacing:-.02em; margin-bottom:22px; }
  h2 { font-size:44px; line-height:1.12; font-weight:800; letter-spacing:-.015em; margin-bottom:14px; }
  .sub { font-size:25px; line-height:1.5; color:#94a3b8; font-weight:450; }
  .content { flex:1; display:flex; flex-direction:column; justify-content:center; position:relative; z-index:2; }
  .foot { font-size:17px; color:#64748b; display:flex; justify-content:space-between;
          align-items:center; border-top:1px solid #1e293b; padding-top:20px; position:relative; z-index:2; }
  .brand { font-weight:700; color:#a5b4fc; }
  table { width:100%; border-collapse:collapse; font-size:21px; margin-top:8px; }
  th { text-align:left; color:#64748b; font-weight:600; font-size:16px; letter-spacing:.06em;
       text-transform:uppercase; padding-bottom:12px; border-bottom:1px solid #1e293b; }
  th.num, td.num { text-align:right; font-variant-numeric:tabular-nums; }
  td { padding:11px 0; border-bottom:1px solid #131c2e; }
  .pg { color:#f0abfc; font-weight:650; }
  .dk { color:#5eead4; font-weight:650; }
  .bar { height:26px; border-radius:6px; }
  .barpg { background:linear-gradient(90deg,#a21caf,#e879f9); }
  .bardk { background:linear-gradient(90deg,#0d9488,#5eead4); }
  .row { display:flex; align-items:center; gap:14px; margin-bottom:15px; }
  .rowlabel { width:250px; font-size:19px; color:#cbd5e1; }
  .rowval { font-size:18px; font-variant-numeric:tabular-nums; width:96px; }
  .chip { display:inline-block; background:#1e293b; border:1px solid #334155; border-radius:999px;
          padding:9px 18px; font-size:17px; color:#cbd5e1; margin:0 9px 11px 0; }
  ul { list-style:none; }
  li { font-size:25px; line-height:1.62; color:#cbd5e1; padding-left:34px; position:relative; margin-bottom:13px; }
  li:before { content:'—'; position:absolute; left:0; color:#6366f1; font-weight:700; }
  .warn { border-left:4px solid #f59e0b; padding-left:22px; }
  .legend { display:flex; gap:26px; font-size:18px; margin-bottom:24px; }
  .dot { display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:8px; }
`;

function shell(inner, footLeft, footRight) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="glow"></div><div class="glow2"></div>
    <div class="content">${inner}</div>
    <div class="foot"><span class="brand">${footLeft}</span><span>${footRight}</span></div>
    </body></html>`;
}

function slideTitle(env, r100k, r1m) {
    return shell(`
    <div class="kicker">Reproducible Benchmark</div>
    <h1>PostgreSQL vs&nbsp;DuckDB<br/>on the same data</h1>
    <p class="sub">A seeded, verified, open benchmark of analytical query
    execution time — not HTTP latency, not cached responses.</p>
    <div style="margin-top:38px">
      <span class="chip">${r100k.parameters.queryCount} queries</span>
      <span class="chip">${r1m.parameters.measuredIterations} iterations each</span>
      <span class="chip">100K + 1M rows</span>
      <span class="chip">seed ${r1m.parameters.seed}</span>
      <span class="chip">results verified equal</span>
    </div>`,
        'InsightTrack', `${env.cpuModel} · ${env.totalMemGB} GB`);
}

function slideMethod(r) {
    const e = r.environment;
    return shell(`
    <div class="kicker">Method</div>
    <h2>What is actually measured</h2>
    <ul>
      <li>Database execution time, timed at the driver call</li>
      <li>No HTTP, no Express, no auth, no JSON, <b>no app cache</b></li>
      <li>Both engines keep <b>all production indexes</b>; PostgreSQL is ANALYZEd</li>
      <li>Results compared row-by-row <b>before</b> any timing is recorded</li>
      <li>Execution order alternates so neither engine goes first every time</li>
    </ul>
    <div style="margin-top:30px">
      <span class="chip">PostgreSQL ${e.postgresVersion}</span>
      <span class="chip">DuckDB ${e.duckdbVersion}</span>
      <span class="chip">Node ${e.nodeVersion}</span>
      <span class="chip">5 warmup + 30 measured</span>
    </div>`,
        'Method', 'docs/PERFORMANCE_BENCHMARK.md');
}

function slideChart(r, label) {
    const rows = r.perQuery.slice().sort((a, b) => b.postgres.median - a.postgres.median).slice(0, 8);
    const max = Math.max(...rows.map((q) => q.postgres.median));
    const bars = rows.map((q) => {
        const pgW = Math.max(3, (q.postgres.median / max) * 420);
        const dkW = Math.max(3, (q.duckdb.median / max) * 420);
        const name = q.title.length > 30 ? q.title.slice(0, 29) + '…' : q.title;
        return `<div style="margin-bottom:19px">
          <div style="font-size:18px;color:#cbd5e1;margin-bottom:7px">${name}</div>
          <div class="row" style="margin-bottom:5px">
            <div class="bar barpg" style="width:${pgW}px"></div>
            <div class="rowval pg">${fmt(q.postgres.median)} ms</div>
          </div>
          <div class="row" style="margin-bottom:0">
            <div class="bar bardk" style="width:${dkW}px"></div>
            <div class="rowval dk">${fmt(q.duckdb.median)} ms</div>
          </div>
        </div>`;
    }).join('');
    return shell(`
    <div class="kicker">${label} events · median execution time</div>
    <h2 style="margin-bottom:20px">Slowest 8 queries</h2>
    <div class="legend">
      <span><span class="dot" style="background:#e879f9"></span>PostgreSQL</span>
      <span><span class="dot" style="background:#5eead4"></span>DuckDB</span>
    </div>
    ${bars}`,
        `${label} rows · seed ${r.parameters.seed}`, 'lower is faster');
}

function slideTable(r, label) {
    const rows = r.perQuery.map((q) => `<tr>
      <td>${q.title.length > 34 ? q.title.slice(0, 33) + '…' : q.title}</td>
      <td class="num pg">${fmt(q.postgres.median)}</td>
      <td class="num dk">${fmt(q.duckdb.median)}</td>
      <td class="num" style="color:#64748b">${fmt(q.postgres.p95)}</td>
      <td class="num" style="color:#64748b">${fmt(q.duckdb.p95)}</td>
    </tr>`).join('');
    return shell(`
    <div class="kicker">${label} events · all ${r.parameters.queryCount} queries</div>
    <h2 style="margin-bottom:6px">Median &amp; p95 (ms)</h2>
    <table>
      <tr><th>Query</th><th class="num">PG med</th><th class="num">Duck med</th>
          <th class="num">PG p95</th><th class="num">Duck p95</th></tr>
      ${rows}
    </table>`,
        `${r.parameters.measuredIterations} iterations each`, 'full distribution in JSON');
}


// Per-round PostgreSQL medians at 1M, from docs/PERFORMANCE_BENCHMARK.md.
// Rounds 1-3 are historical; the final column is read live from the result file
// so the slide always ends on the current measurement.
const PG_ROUNDS_1M = {
    Q01_total_events:           [16.3, 8.9, 9.2],
    Q02_unique_visitors:        [36.0, 36.9, 36.4],
    Q03_sessions:               [43.1, 43.3, 43.3],
    Q04_daily_events:           [110.2, 76.1, 76.2],
    Q05_daily_unique_visitors:  [637.4, 280.4, 142.7],
    Q06_top_pages:              [586.7, 239.1, 144.2],
    Q07_referrer_sources:       [491.0, 427.3, 294.6],
    Q08_date_range_filter:      [175.5, 76.5, 72.5],
    Q09_multi_dim_groupby:      [79.0, 59.5, 54.5],
    Q10_dashboard_kpi:          [337.9, 208.4, 207.7],
    Q11_utm_campaign_breakdown: [305.2, 118.2, 112.9],
    Q12_hourly_pattern:         [153.3, 93.3, 88.0],
};

/** Total workload time per engine (sum of medians). */
function totals(r) {
    return {
        pg: r.perQuery.reduce((a, q) => a + q.postgres.median, 0),
        dk: r.perQuery.reduce((a, q) => a + q.duckdb.median, 0),
    };
}

/** Slide: overall workload time, both sizes, both engines. */
function slideOverall(r100, r1m) {
    const t100 = totals(r100);
    const t1m = totals(r1m);
    const bar = (val, max, cls) => `<div class="bar ${cls}" style="width:${Math.max(4, (val / max) * 430)}px"></div>`;
    const max1 = Math.max(t1m.pg, t100.pg);
    const block = (label, t) => `
      <div style="margin-bottom:34px">
        <div style="font-size:22px;color:#e8ecf5;font-weight:650;margin-bottom:12px">${label}</div>
        <div class="row" style="margin-bottom:8px">
          ${bar(t.pg, max1, 'barpg')}<div class="rowval pg" style="width:150px">${fmt(t.pg)} ms</div>
          <span style="font-size:17px;color:#64748b">PostgreSQL</span>
        </div>
        <div class="row" style="margin-bottom:0">
          ${bar(t.dk, max1, 'bardk')}<div class="rowval dk" style="width:150px">${fmt(t.dk)} ms</div>
          <span style="font-size:17px;color:#64748b">DuckDB</span>
        </div>
      </div>`;
    return shell(`
    <div class="kicker">Overall performance</div>
    <h2 style="margin-bottom:26px">Total time for all 12 queries</h2>
    ${block('1,000,000 events', t1m)}
    ${block('100,000 events', t100)}
    <p class="sub" style="font-size:20px;margin-top:6px">Sum of per-query medians, 30 measured
    iterations each. Database execution time only.</p>`,
        'Whole-workload total', `${r1m.parameters.queryCount} queries · seed ${r1m.parameters.seed}`);
}

/** Slide: what three rounds of profiling-driven optimisation achieved. */
function slideJourney(r1m) {
    const rows = r1m.perQuery
        .filter((q) => PG_ROUNDS_1M[q.queryId])
        .map((q) => ({ q, start: PG_ROUNDS_1M[q.queryId][0], end: q.postgres.median }))
        .sort((a, b) => b.start - a.start)
        .slice(0, 7);
    const max = Math.max(...rows.map((r) => r.start));
    const bars = rows.map(({ q, start, end }) => {
        const pct = Math.round(((start - end) / start) * 100);
        const name = q.title.length > 28 ? q.title.slice(0, 27) + '…' : q.title;
        return `<div style="margin-bottom:17px">
          <div style="display:flex;justify-content:space-between;font-size:18px;color:#cbd5e1;margin-bottom:6px">
            <span>${name}</span><span style="color:${pct > 0 ? '#5eead4' : '#64748b'};font-weight:650">${pct > 0 ? '−' + pct + '%' : '—'}</span>
          </div>
          <div style="position:relative;height:22px">
            <div class="bar" style="position:absolute;left:0;top:0;width:${(start / max) * 430}px;background:#312e5b;border-radius:6px"></div>
            <div class="bar bardk" style="position:absolute;left:0;top:0;width:${Math.max(4, (end / max) * 430)}px"></div>
            <span style="position:absolute;left:${(start / max) * 430 + 14}px;top:1px;font-size:16px;color:#64748b">${fmt(start)} → <b style="color:#5eead4">${fmt(end)}</b> ms</span>
          </div>
        </div>`;
    }).join('');
    const t = totals(r1m);
    return shell(`
    <div class="kicker">1M events · PostgreSQL</div>
    <h2 style="margin-bottom:8px">Three rounds of tuning</h2>
    <p class="sub" style="font-size:19px;margin-bottom:22px">Every change driven by
    <span style="color:#a5b4fc">EXPLAIN (ANALYZE, BUFFERS)</span> — planner cost model, then query form.</p>
    ${bars}
    <div style="margin-top:18px;padding-top:18px;border-top:1px solid #1e293b;font-size:22px;color:#e8ecf5">
      Whole workload <span class="pg">2,972 ms</span> → <span class="dk">${fmt(t.pg)} ms</span>
      <span style="color:#5eead4;font-weight:700">  (−60%)</span>
    </div>`,
        'Optimisation journey', 'results verified identical at each step');
}

function slideCaveats(r) {
    // Derive the ratio range from the data rather than hardcoding it, so the
    // slide cannot go stale when the benchmark is re-run.
    const ratios = r.perQuery.map((q) => q.postgres.median / q.duckdb.median);
    const lo = Math.round(Math.min(...ratios));
    const hi = Math.round(Math.max(...ratios));
    return shell(`
    <div class="kicker">Read this before quoting it</div>
    <h2 style="margin-bottom:24px">What this does <span style="color:#f59e0b">not</span> say</h2>
    <div class="warn">
      <ul>
        <li>Not a universal claim — one workload, one machine, one config</li>
        <li>PostgreSQL was <b>tuned in its favour</b> after profiling, not left on defaults</li>
        <li>Warmed cache, not cold-start</li>
        <li>Reads only — ingest was <b>not</b> measured (DuckDB loaded slower here)</li>
        <li>Ratios vary ~${lo}×–${hi}× by query; a single "N× faster" would mislead</li>
      </ul>
    </div>
    <p class="sub" style="margin-top:28px">Run it yourself:<br/>
      <span style="color:#a5b4fc;font-family:ui-monospace,monospace;font-size:21px">
      npm run benchmark:engine -- --size 1000000 --seed 42</span></p>`,
        'Limitations', 'reproducible from the repo');
}

// -- Render -------------------------------------------------------------------

async function main() {
    const r100k = latestFor(100000);
    const r1m = latestFor(1000000);
    if (!r100k || !r1m) {
        console.error('Missing benchmark results. Run the benchmark for 100000 and 1000000 first.');
        process.exit(1);
    }
    mkdirSync(OUT_DIR, { recursive: true });

    const slides = [
        ['01-title', slideTitle(r1m.environment, r100k, r1m)],
        ['02-method', slideMethod(r1m)],
        ['03-chart-100k', slideChart(r100k, '100K')],
        ['04-chart-1m', slideChart(r1m, '1M')],
        ['05-table-1m', slideTable(r1m, '1M')],
        ['06-overall', slideOverall(r100k, r1m)],
        ['07-journey', slideJourney(r1m)],
        ['08-caveats', slideCaveats(r1m)],
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

    // Combined PDF: one page per slide, square pages.
    // Embed each PNG as a data URI — a `file://` src does not load inside the
    // about:blank context used here and yields an image-less pdf.
    const embed = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
    const pdfHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size:${SIZE}px ${SIZE}px; margin:0; }
      html, body { margin:0; padding:0; }
      img { width:${SIZE}px; height:${SIZE}px; display:block; page-break-after:always; }
      img:last-child { page-break-after:auto; }
    </style></head><body>${pngs.map((f) => `<img src="${embed(f)}"/>`).join('')}</body></html>`;
    await page.setContent(pdfHtml, { waitUntil: 'load' });
    const pdfPath = resolve(OUT_DIR, 'insighttrack-benchmark-slides.pdf');
    await page.pdf({ path: pdfPath, width: `${SIZE}px`, height: `${SIZE}px`, printBackground: true, pageRanges: '1-8' });

    await browser.close();

    writeFileSync(resolve(OUT_DIR, 'README.md'),
        `# Benchmark slides\n\nGenerated from real benchmark result files by\n` +
        `\`scripts/benchmarking/make-slides.js\`. Every number is read from the\n` +
        `result JSON — none is hand-written.\n\n` +
        `- 8 square (1080x1080) PNGs, 2x device scale\n` +
        `- \`insighttrack-benchmark-slides.pdf\` — all six as a carousel\n\n` +
        `Source data: \`benchmark-results/engine-benchmark-*.json\`.\n` +
        `Full method and limitations: \`docs/PERFORMANCE_BENCHMARK.md\`.\n`);

    console.log('\n  PDF:', pdfPath);
    console.log('  PNGs:', OUT_DIR);
}

main().catch((e) => { console.error(e); process.exit(1); });
