import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Blog from '../pages/Blog';
import { BLOG_POSTS, getTags, getPostsByTag, tagSlug } from '../data/blogPosts';
import { canonicalUrl } from '../hooks/useSeo';

const mountPost = (slug) => render(
    <MemoryRouter initialEntries={[`/blog/${slug}`]}>
        <Routes><Route path="/blog/:slug" element={<Blog />} /></Routes>
    </MemoryRouter>
);

describe('blog post data', () => {
    it('every post has the fields SEO depends on', () => {
        for (const p of BLOG_POSTS) {
            for (const k of ['slug', 'title', 'description', 'keyword', 'date', 'readingMinutes', 'body', 'tags']) {
                expect(p[k], `${p.slug}.${k}`).toBeTruthy();
            }
            expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(p.tags.length).toBeGreaterThan(0);
        }
    });

    it('slugs are unique', () => {
        const s = BLOG_POSTS.map(p => p.slug);
        expect(new Set(s).size).toBe(s.length);
    });
});

describe('internal linking', () => {
    const links = BLOG_POSTS.flatMap(p =>
        [...p.body.matchAll(/\[([^\]]+)\]\((\/blog\/[a-z0-9-]+)\)/g)]
            .map(m => ({ from: p.slug, to: m[2].replace('/blog/', '') })));

    it('no internal link is broken or self-referential', () => {
        const slugs = new Set(BLOG_POSTS.map(p => p.slug));
        const bad = links.filter(l => !slugs.has(l.to) || l.to === l.from);
        expect(bad).toEqual([]);
    });

    it('every post links out, and every post is linked to', () => {
        const out = new Set(links.map(l => l.from));
        const inbound = new Set(links.map(l => l.to));
        expect(BLOG_POSTS.filter(p => !out.has(p.slug)).map(p => p.slug)).toEqual([]);
        expect(BLOG_POSTS.filter(p => !inbound.has(p.slug)).map(p => p.slug)).toEqual([]);
    });

    it('renders internal links as real anchors crawlers can follow', () => {
        const { container } = mountPost('postgres-duckdb-analytics-architecture');
        const hrefs = [...container.querySelectorAll('a[href^="/blog/"]')].map(a => a.getAttribute('href'));
        expect(hrefs.length).toBeGreaterThan(0);
    });
});

describe('tags', () => {
    it('tag slugs round-trip to posts', () => {
        for (const { tag, slug, count } of getTags()) {
            expect(tagSlug(tag)).toBe(slug);
            expect(getPostsByTag(slug).length).toBe(count);
        }
    });
});

describe('markdown rendering', () => {
    it('does not leak raw markdown into prose', () => {
        const strip = (el) => { const c = el.cloneNode(true); c.querySelectorAll('code, pre').forEach(n => n.remove()); return c.textContent; };
        const bad = [];
        for (const p of BLOG_POSTS) {
            const { container } = mountPost(p.slug);
            for (const el of container.querySelectorAll('p, li, h2, h3, th, td')) {
                const t = strip(el);
                if (/(^|[^*])\*[^*]+\*/.test(t) || /\]\(\//.test(t)) bad.push(`${p.slug}: ${t.slice(0, 60)}`);
            }
        }
        expect(bad).toEqual([]);
    });

    it('keeps table headers and body rows aligned', () => {
        const bad = [];
        for (const p of BLOG_POSTS) {
            const { container } = mountPost(p.slug);
            container.querySelectorAll('table').forEach((t) => {
                const th = t.querySelectorAll('th').length;
                const td = t.querySelector('tbody tr')?.querySelectorAll('td').length ?? 0;
                if (th !== td) bad.push(`${p.slug}: ${th} th vs ${td} td`);
            });
        }
        expect(bad).toEqual([]);
    });

    it('preserves asterisks inside code blocks', () => {
        const { container } = mountPost('sql-queries-for-web-analytics');
        const code = [...container.querySelectorAll('pre')].map(e => e.textContent).join('\n');
        expect(code).toContain('count(*)');
    });
});

describe('regressions', () => {
    // useSeo used to be called after early returns, so hook order changed with
    // the route. Each branch is its own component now; assert every route type
    // still sets its own title and React logs no hook-order error.
    it('each route type sets its own title with no hook-order error', () => {
        const errs = [];
        const orig = console.error;
        console.error = (...a) => errs.push(a.join(' '));
        try {
            const routes = (
                <Routes>
                    <Route path="/blog" element={<Blog />} />
                    <Route path="/blog/tag/:tag" element={<Blog />} />
                    <Route path="/blog/:slug" element={<Blog />} />
                </Routes>
            );
            const seen = [];
            for (const path of ['/blog/bounce-rate-explained', '/blog', '/blog/tag/duckdb']) {
                const { unmount } = render(<MemoryRouter initialEntries={[path]}>{routes}</MemoryRouter>);
                seen.push(document.title);
                unmount();
            }
            expect(new Set(seen).size).toBe(3);
            expect(errs.filter(e => /hook/i.test(e))).toEqual([]);
        } finally { console.error = orig; }
    });

    // The blog index must not rely on array order in blogPosts.js — the source
    // array is oldest-first, so an unsorted index buries the newest content.
    it('blog index lists posts newest-first', () => {
        const { container } = render(
            <MemoryRouter initialEntries={['/blog']}>
                <Routes><Route path="/blog" element={<Blog />} /></Routes>
            </MemoryRouter>
        );
        const order = [...container.querySelectorAll('a[href^="/blog/"]')]
            .map(a => a.getAttribute('href').replace('/blog/', ''))
            .filter(s => !s.startsWith('tag/'));
        const dates = order.map(slug => BLOG_POSTS.find(p => p.slug === slug)?.date).filter(Boolean);
        expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
        expect(dates.length).toBe(BLOG_POSTS.length);
    });
});

describe('canonical URLs', () => {
    // The host serves dist/<path>/index.html and 308-redirects the bare path to
    // the trailing-slash URL. Canonicals used to name the pre-redirect URL, so
    // every page declared a canonical that immediately redirected.
    it('always carries the trailing slash the host serves', () => {
        for (const p of ['/blog', '/blog/bounce-rate-explained', '/privacy-policy', '/terms']) {
            expect(canonicalUrl(p)).toBe(`https://insightstrack.dev${p}/`);
        }
    });

    it('leaves the root as a single slash and never doubles one', () => {
        expect(canonicalUrl('/')).toBe('https://insightstrack.dev/');
        expect(canonicalUrl('/blog/')).toBe('https://insightstrack.dev/blog/');
    });

    it('drops query strings and fragments', () => {
        expect(canonicalUrl('/blog?page=2')).toBe('https://insightstrack.dev/blog/');
        expect(canonicalUrl('/blog#top')).toBe('https://insightstrack.dev/blog/');
    });

    it('is what the rendered page declares', () => {
        mountPost('bounce-rate-explained');
        expect(document.querySelector('link[rel="canonical"]').getAttribute('href'))
            .toBe('https://insightstrack.dev/blog/bounce-rate-explained/');
    });

    // Article/breadcrumb JSON-LD naming a different URL than the canonical tells
    // Google two different things about the same page.
    it('matches the page URLs in the post JSON-LD', () => {
        mountPost('bounce-rate-explained');
        const ld = JSON.parse(document.getElementById('page-jsonld').textContent);
        const article = ld['@graph'].find((n) => n['@type'] === 'BlogPosting');
        const crumbs = ld['@graph'].find((n) => n['@type'] === 'BreadcrumbList');
        const expected = 'https://insightstrack.dev/blog/bounce-rate-explained/';
        expect(article.mainEntityOfPage).toBe(expected);
        expect(crumbs.itemListElement.at(-1).item).toBe(expected);
        // Image URLs are files, not routes — they must not gain a slash.
        expect(article.image).toBe('https://insightstrack.dev/og/bounce-rate-explained.png');
    });
});

describe('article dates', () => {
    // Google's Article guidance asks for ISO 8601 "with timezone information".
    it('carries an explicit timezone offset in the schema', () => {
        mountPost('plausible-alternative');
        const ld = JSON.parse(document.getElementById('page-jsonld').textContent);
        const a = ld['@graph'].find((n) => n['@type'] === 'BlogPosting');
        expect(a.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/);
        expect(a.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/);
    });

    // Google expects marked-up values to be visible on the page.
    it('shows the update date on posts that advertise one', () => {
        const { container } = mountPost('plausible-alternative');
        expect(container.textContent).toMatch(/Updated\s+\w+ \d+, \d{4}/);
    });

    it('shows no update line on posts that were never revised', () => {
        const { container } = mountPost('bounce-rate-explained');
        expect(container.textContent).not.toMatch(/Updated\s+\w+ \d+, \d{4}/);
    });

    // lastmod must be verifiably accurate, so a substantially rewritten post
    // has to advertise the rewrite rather than its original publish date.
    it('reports dateModified later than datePublished for revised posts', () => {
        for (const slug of ['plausible-alternative', 'matomo-alternative', 'umami-alternative']) {
            const { unmount } = mountPost(slug);
            const ld = JSON.parse(document.getElementById('page-jsonld').textContent);
            const a = ld['@graph'].find((n) => n['@type'] === 'BlogPosting');
            expect(new Date(a.dateModified).getTime(), slug)
                .toBeGreaterThan(new Date(a.datePublished).getTime());
            unmount();
        }
    });
});
