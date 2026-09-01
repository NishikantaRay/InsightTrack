import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { BLOG_POSTS, getTags } from '../data/blogPosts';
import { canonicalUrl } from '../hooks/useSeo';

// dist/sitemap.xml is a build artifact (npm run sitemap). Skip when absent so a
// clean checkout's `npm test` doesn't fail on something the build produces.
const FILE = join(process.cwd(), 'dist', 'sitemap.xml');
const present = existsSync(FILE);
const d = present ? describe : describe.skip;

d('sitemap.xml', () => {
    let xml, urls;
    beforeAll(() => {
        xml = readFileSync(FILE, 'utf8');
        urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, u]) => ({
            loc: u.match(/<loc>(.*?)<\/loc>/)?.[1],
            lastmod: u.match(/<lastmod>(.*?)<\/lastmod>/)?.[1],
        }));
    });

    it('lists every blog post and tag archive', () => {
        const locs = new Set(urls.map((u) => u.loc));
        for (const p of BLOG_POSTS) expect(locs, p.slug).toContain(canonicalUrl(`/blog/${p.slug}`));
        for (const t of getTags()) expect(locs, t.slug).toContain(canonicalUrl(`/blog/tag/${t.slug}`));
    });

    // Eight URLs had silently lost their <lastmod> while the file was hand-maintained.
    it('gives every URL a valid lastmod', () => {
        const bad = urls.filter((u) => !/^\d{4}-\d{2}-\d{2}$/.test(u.lastmod || ''));
        expect(bad.map((u) => u.loc)).toEqual([]);
    });

    it('dates each post from its own publish/updated date', () => {
        for (const p of BLOG_POSTS) {
            const entry = urls.find((u) => u.loc === canonicalUrl(`/blog/${p.slug}`));
            expect(entry.lastmod, p.slug).toBe(p.updated || p.date);
        }
    });

    // A <loc> that redirects makes Google resolve the canonical itself.
    it('names post-redirect URLs, matching each page canonical', () => {
        const routes = urls.filter((u) => !u.loc.endsWith('.md'));
        expect(routes.filter((u) => !u.loc.endsWith('/')).map((u) => u.loc)).toEqual([]);
    });

    it('has no duplicate URLs', () => {
        const locs = urls.map((u) => u.loc);
        expect(locs.length).toBe(new Set(locs).size);
    });
});
