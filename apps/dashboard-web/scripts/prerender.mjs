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
import { extname, join, resolve } from 'node:path';
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
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    // Render the landing route (the public marketing page we want indexed).
    await page.goto(`http://localhost:${PORT}/landing`, { waitUntil: 'networkidle', timeout: 30000 });
    // Expand all FAQ answers so their text is in the static snapshot for AEO.
    await page.evaluate(() => {
        document.querySelectorAll('#faq button[aria-expanded="false"]').forEach((b) => b.click());
    });
    await page.waitForTimeout(600);

    const rootHTML = await page.evaluate(() => document.getElementById('root')?.innerHTML || '');
    await browser.close();
    server.close();

    if (!rootHTML || rootHTML.length < 1000) {
        console.error('prerender: rendered HTML looked empty — leaving index.html untouched.');
        process.exit(1);
    }

    // Inject the prerendered markup into the SPA shell. React will hydrate/replace
    // it on load; crawlers keep the static content.
    const indexPath = join(DIST, 'index.html');
    let html = readFileSync(indexPath, 'utf8');
    html = html.replace(
        /<div id="root">\s*<\/div>/,
        `<div id="root">${rootHTML}</div>`
    );
    writeFileSync(indexPath, html);
    console.log(`prerender: injected ${rootHTML.length.toLocaleString()} chars of landing HTML into dist/index.html`);
}

main().catch((e) => { console.error('prerender failed:', e.message); server.close(); process.exit(1); });
