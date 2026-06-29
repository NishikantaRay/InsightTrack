#!/usr/bin/env node
/**
 * Post-build prerender for the public landing page.
 *
 * Vite ships a SPA whose index.html has an empty <div id="root">. Crawlers and
 * AI answer engines that don't run JS therefore see no content. This script
 * renders the /landing route headlessly and snapshots the resulting HTML into
 * dist/index.html, so the hero, features, FAQ, and footer are present in the
 * static HTML — turning the home page into crawlable, indexable content while
 * the SPA still hydrates normally for real users.
 *
 * Uses the already-installed playwright-core (no new dependency). Run after
 * `vite build`:  node scripts/prerender.mjs
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PORT = 4317;

if (!existsSync(join(DIST, 'index.html'))) {
    console.error('prerender: dist/index.html not found — run `vite build` first.');
    process.exit(1);
}

const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml',
    '.woff2': 'font/woff2', '.woff': 'font/woff',
};

// Static file server with SPA fallback to index.html.
const server = createServer((req, res) => {
    try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        let filePath = join(DIST, urlPath);
        if (existsSync(filePath) && statSync(filePath).isFile()) {
            res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
            res.end(readFileSync(filePath));
            return;
        }
        // SPA fallback
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(join(DIST, 'index.html')));
    } catch (e) {
        res.writeHead(500); res.end('err');
    }
});

async function main() {
    await new Promise((r) => server.listen(PORT, r));

    const { chromium } = await import('playwright-core');
    const { mkdirSync } = await import('node:fs');
    const browser = await chromium.launch();

    // Routes to prerender. The landing snapshot overwrites dist/index.html;
    // every other route is written to dist/<path>/index.html so static hosts
    // serve crawlable HTML at clean URLs.
    const ROUTES = [
        { route: '/landing', out: 'index.html', expandFaq: true },
        { route: '/blog', out: 'blog/index.html' },
        { route: '/blog/open-source-google-analytics-alternative', out: 'blog/open-source-google-analytics-alternative/index.html' },
        { route: '/blog/self-host-analytics-with-docker', out: 'blog/self-host-analytics-with-docker/index.html' },
        { route: '/blog/cookieless-analytics-explained', out: 'blog/cookieless-analytics-explained/index.html' },
        { route: '/blog/postgres-duckdb-analytics-architecture', out: 'blog/postgres-duckdb-analytics-architecture/index.html' },
        { route: '/blog/migrate-from-google-analytics', out: 'blog/migrate-from-google-analytics/index.html' },
        { route: '/blog/core-web-vitals-monitoring-guide', out: 'blog/core-web-vitals-monitoring-guide/index.html' },
    ];

    const shell = readFileSync(join(DIST, 'index.html'), 'utf8');
    let done = 0;

    for (const { route, out, expandFaq } of ROUTES) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
        if (expandFaq) {
            await page.evaluate(() => {
                document.querySelectorAll('#faq button[aria-expanded="false"]').forEach((b) => b.click());
            });
        }
        await page.waitForTimeout(600);

        // Capture the rendered app HTML + the per-route head metadata useSeo set,
        // including the page-level JSON-LD (Article / BreadcrumbList) it injects.
        const { rootHTML, title, desc, canonical, jsonLd } = await page.evaluate(() => ({
            rootHTML: document.getElementById('root')?.innerHTML || '',
            title: document.title,
            desc: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
            canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
            jsonLd: document.getElementById('page-jsonld')?.textContent || '',
        }));

        if (!rootHTML || rootHTML.length < 500) {
            console.warn(`prerender: ${route} looked empty — skipping`);
            await page.close();
            continue;
        }

        // Start from the shared shell, inject this route's content + head.
        let html = shell.replace(/<div id="root">\s*<\/div>/, `<div id="root">${rootHTML}</div>`);
        if (title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
        if (desc) html = html.replace(/(<meta name="description"\s+content=")[\s\S]*?(")/, `$1${desc.replace(/"/g, '&quot;')}$2`);
        if (canonical) html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`);
        // Inject the page's JSON-LD (Article/BreadcrumbList) into <head> so crawlers
        // and AI engines see it in the static HTML.
        if (jsonLd) html = html.replace('</head>', `  <script type="application/ld+json" id="page-jsonld">${jsonLd}</script>\n</head>`);

        const outPath = join(DIST, out);
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, html);
        console.log(`prerender: ${route} → dist/${out} (${rootHTML.length.toLocaleString()} chars)`);
        done++;
        await page.close();
    }

    await browser.close();
    server.close();
    if (!done) { console.error('prerender: nothing rendered'); process.exit(1); }
    console.log(`prerender: ${done} route(s) prerendered.`);
}

main().catch((e) => { console.error('prerender failed:', e.message); server.close(); process.exit(1); });
