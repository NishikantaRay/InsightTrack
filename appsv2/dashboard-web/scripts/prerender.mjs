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

// The pristine Vite shell, read once before any route overwrites
// dist/index.html. The SPA fallback must serve THIS, not the file on disk —
// after /landing is written, dist/index.html contains rendered landing HTML,
// so falling back to it would hand every later route a pre-rendered page to
// hydrate instead of letting React route the URL itself.
const SHELL_HTML = readFileSync(join(DIST, 'index.html'), 'utf8');

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
        // SPA fallback — pristine shell, so React routes the URL client-side
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(SHELL_HTML);
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
    //
    // Blog routes are derived from BLOG_POSTS rather than listed by hand, so
    // adding a post to src/data/blogPosts.js automatically prerenders it. A
    // hardcoded list silently goes stale and ships posts that only exist as an
    // empty <div id="root"> to any crawler that doesn't run JS.
    const { BLOG_POSTS, getTags } = await import('../src/data/blogPosts.js');

    const ROUTES = [
        { route: '/landing', out: 'index.html', expandFaq: true },
        { route: '/blog', out: 'blog/index.html' },
        ...BLOG_POSTS.map((p) => ({
            route: `/blog/${p.slug}`,
            out: `blog/${p.slug}/index.html`,
        })),
        // Tag archives: topical hub pages that give each cluster a crawlable
        // landing page and spread link equity across the posts inside it.
        ...getTags().map(({ slug }) => ({
            route: `/blog/tag/${slug}`,
            out: `blog/tag/${slug}/index.html`,
        })),
        { route: '/privacy-policy', out: 'privacy-policy/index.html' },
        { route: '/terms', out: 'terms/index.html' },
        // Static 404. Cloudflare Pages serves dist/404.html with a real HTTP 404
        // for unmatched paths; without it the SPA fallback returns index.html
        // with a 200, which Google reports as a soft 404 and which burns crawl
        // budget on every non-existent URL. `small` because the 404 page is
        // intentionally short and would otherwise trip the empty-render guard.
        { route: '/__not-found__', out: '404.html', small: true, noindex: true },
    ];

    const shell = SHELL_HTML;
    let done = 0;

    for (const { route, out, expandFaq, small, noindex } of ROUTES) {
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
        const { rootHTML, title, desc, canonical, jsonLd, ogImage } = await page.evaluate(() => ({
            rootHTML: document.getElementById('root')?.innerHTML || '',
            title: document.title,
            desc: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
            canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
            jsonLd: document.getElementById('page-jsonld')?.textContent || '',
            ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
        }));

        if (!rootHTML || (!small && rootHTML.length < 500)) {
            console.warn(`prerender: ${route} looked empty — skipping`);
            await page.close();
            continue;
        }

        // Start from the shared shell, inject this route's content + head.
        let html = shell.replace(/<div id="root">\s*<\/div>/, `<div id="root">${rootHTML}</div>`);
        if (title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
        if (desc) html = html.replace(/(<meta name="description"\s+content=")[\s\S]*?(")/, `$1${desc.replace(/"/g, '&quot;')}$2`);
        if (canonical && !noindex) html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`);
        if (noindex) {
            html = html.replace(/(<meta name="robots"\s+content=")[^"]*(")/, `$1noindex, nofollow$2`);
            html = html.replace(/\s*<link rel="canonical"[^>]*>/, '');
        }
        // The shell's OG/Twitter tags describe the home page. Without rewriting
        // them every prerendered URL shares the homepage's title, description,
        // and URL when shared on social — so overwrite them per route.
        const esc = (s) => s.replace(/"/g, '&quot;');
        const setProp = (attr, key, val) => {
            if (!val) return;
            const re = new RegExp(`(<meta ${attr}="${key}"\\s+content=")[\\s\\S]*?(")`);
            if (re.test(html)) html = html.replace(re, `$1${esc(val)}$2`);
        };
        setProp('property', 'og:title', title);
        setProp('property', 'og:description', desc);
        setProp('property', 'og:url', canonical);
        setProp('property', 'og:image', ogImage);
        setProp('name', 'twitter:title', title);
        setProp('name', 'twitter:description', desc);
        setProp('name', 'twitter:image', ogImage);
        // Blog routes are articles, not the site's home page.
        if (route.startsWith('/blog')) html = html.replace(/(<meta property="og:type"\s+content=")[^"]*(")/, `$1article$2`);
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

    // Self-check. These are the failure modes that ship silently: a page whose
    // root never hydrated, or metadata still describing the home page because a
    // rewrite regexp stopped matching after an index.html edit. Fail the build
    // rather than deploy pages that look fine and rank as duplicates.
    const seen = { title: new Map(), canonical: new Map(), ogTitle: new Map(), ogUrl: new Map() };
    const problems = [];
    for (const { out, noindex } of ROUTES) {
        // noindex pages (the 404) intentionally carry no canonical and never
        // compete in search, so uniqueness checks do not apply to them.
        if (noindex) continue;
        const file = join(DIST, out);
        if (!existsSync(file)) continue;
        const html = readFileSync(file, 'utf8');
        const pick = (re) => html.match(re)?.[1] || '';
        if (/<div id="root">\s*<\/div>/.test(html)) problems.push(`${out}: empty #root`);
        // The host serves dist/<path>/index.html at a trailing-slash URL and
        // 308-redirects the bare path to it. A canonical without the slash
        // names a URL that redirects, so Google must guess which is real.
        const canon = pick(/<link rel="canonical" href="([^"]*)"/);
        if (canon && !canon.endsWith('/')) problems.push(`${out}: canonical "${canon}" lacks the trailing slash the host redirects to`);
        for (const [key, re] of [
            ['title', /<title>([\s\S]*?)<\/title>/],
            ['canonical', /<link rel="canonical" href="([^"]*)"/],
            ['ogTitle', /<meta property="og:title"\s+content="([^"]*)"/],
            ['ogUrl', /<meta property="og:url"\s+content="([^"]*)"/],
        ]) {
            const v = pick(re);
            if (!v) { problems.push(`${out}: missing ${key}`); continue; }
            if (seen[key].has(v)) problems.push(`${out}: duplicate ${key} shared with ${seen[key].get(v)} — "${v.slice(0, 60)}"`);
            else seen[key].set(v, out);
        }
    }
    // The 404 is generated from a route that lives inside the app's protected
    // catch-all's shadow; if that route is ever removed it silently renders the
    // landing page instead, producing a noindex duplicate of the home page.
    const notFound = ROUTES.find((r) => r.out === '404.html');
    if (notFound && existsSync(join(DIST, '404.html'))) {
        const html = readFileSync(join(DIST, '404.html'), 'utf8');
        if (!/not found/i.test(html)) problems.push('404.html: does not look like a 404 page (route may be shadowed)');
        if (!/content="noindex/.test(html)) problems.push('404.html: missing noindex');
        if (html.length > 60000) problems.push(`404.html: suspiciously large (${html.length}b) — likely a copy of the landing page`);
    }

    if (problems.length) {
        console.error(`prerender: ${problems.length} problem(s) in the output:`);
        problems.forEach((p) => console.error('  - ' + p));
        process.exit(1);
    }
    console.log(`prerender: verified ${done} page(s) — unique title, canonical, og:title, og:url; no empty roots.`);
    console.log(`prerender: ${done} route(s) prerendered.`);
}

main().catch((e) => { console.error('prerender failed:', e.message); server.close(); process.exit(1); });
