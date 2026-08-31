#!/usr/bin/env node
/**
 * Generates dist/feed.xml (RSS 2.0) from BLOG_POSTS.
 *
 * Feed readers, aggregators, and several AI crawlers discover content through
 * RSS. Generated from the same source as the posts and sitemap so it cannot
 * drift out of sync.
 */
import { writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const ORIGIN = 'https://insightstrack.dev';

const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

async function main() {
    if (!existsSync(DIST)) {
        console.error('feed: dist/ not found — run `vite build` first.');
        process.exit(1);
    }
    const { BLOG_POSTS } = await import('../src/data/blogPosts.js');
    const posts = [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date));
    const built = new Date().toUTCString();

    const items = posts.map((p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${ORIGIN}/blog/${p.slug}</link>
      <guid isPermaLink="true">${ORIGIN}/blog/${p.slug}</guid>
      <description>${esc(p.description)}</description>
      <pubDate>${new Date(`${p.updated || p.date}T00:00:00Z`).toUTCString()}</pubDate>
      <author>noreply@insightstrack.dev (Nishikanta Ray)</author>
${(p.tags || []).map((t) => `      <category>${esc(t)}</category>`).join('\n')}
    </item>`).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>InsightsTrack Blog</title>
    <link>${ORIGIN}/blog</link>
    <description>Guides on privacy-first analytics, self-hosting, DuckDB architecture, and moving off Google Analytics.</description>
    <language>en</language>
    <lastBuildDate>${built}</lastBuildDate>
    <atom:link href="${ORIGIN}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
    writeFileSync(join(DIST, 'feed.xml'), xml);
    console.log(`feed: dist/feed.xml written (${posts.length} items)`);
}

main().catch((e) => { console.error('feed failed:', e.message); process.exit(1); });
