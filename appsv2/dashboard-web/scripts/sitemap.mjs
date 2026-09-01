#!/usr/bin/env node
/**
 * Generates dist/sitemap.xml from BLOG_POSTS.
 *
 * Previously hand-maintained, which drifted: eight URLs had lost their
 * <lastmod> and every entry named the pre-redirect URL. Generating from the
 * same source as the posts and the feed keeps all three in step, and means a
 * new post appears in the sitemap without anyone remembering to add it.
 *
 * URLs carry the trailing slash the host serves (see canonicalUrl in
 * src/hooks/useSeo.js) so <loc> matches the page's own canonical rather than a
 * URL that 308-redirects.
 */
import { writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const ORIGIN = 'https://insightstrack.dev';

// Mirrors canonicalUrl() in src/hooks/useSeo.js. Kept as a copy rather than an
// import because that module touches `document` at import time; the invariant
// is asserted by the sitemap tests.
const url = (path) => `${ORIGIN}${path === '/' ? '/' : `${path.replace(/\/+$/, '')}/`}`;

async function main() {
    if (!existsSync(DIST)) {
        console.error('sitemap: dist/ not found — run `vite build` first.');
        process.exit(1);
    }
    const { BLOG_POSTS, getTags } = await import('../src/data/blogPosts.js');
    const posts = [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date));

    // Newest post date doubles as the last-modified date for the indexes that
    // list posts: adding a post genuinely changes those pages.
    const newest = posts[0]?.date;
    const lastmodOf = (p) => p.updated || p.date;

    const entries = [
        { loc: url('/'), lastmod: newest, changefreq: 'weekly', priority: '1.0' },
        // The Markdown twin is a file, not a route — no trailing slash.
        { loc: `${ORIGIN}/index.md`, lastmod: newest, changefreq: 'weekly', priority: '0.9' },
        { loc: url('/blog'), lastmod: newest, changefreq: 'weekly', priority: '0.8' },
        ...posts.map((p) => ({
            loc: url(`/blog/${p.slug}`),
            lastmod: lastmodOf(p),
            changefreq: 'monthly',
            priority: '0.8',
        })),
        // Tag archives change whenever a post joins the cluster.
        ...getTags().map(({ slug }) => ({
            loc: url(`/blog/tag/${slug}`),
            lastmod: newest,
            changefreq: 'monthly',
            priority: '0.6',
        })),
        { loc: url('/privacy-policy'), lastmod: newest, changefreq: 'monthly', priority: '0.5' },
        { loc: url('/terms'), lastmod: newest, changefreq: 'monthly', priority: '0.5' },
    ];

    const body = entries.map((e) => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
    writeFileSync(join(DIST, 'sitemap.xml'), xml);
    console.log(`sitemap: dist/sitemap.xml written (${entries.length} urls)`);
}

main().catch((e) => { console.error('sitemap failed:', e.message); process.exit(1); });
