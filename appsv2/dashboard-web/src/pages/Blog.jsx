import { Link, useParams } from 'react-router-dom';
import { BarChart3, ArrowLeft, ArrowRight, Clock, Calendar } from 'lucide-react';
import { BLOG_POSTS, getPost, getTags, getPostsByTag, getTagIntro, tagSlug } from '../data/blogPosts';
import { useSeo, ORIGIN, canonicalUrl } from '../hooks/useSeo';

// ── tiny markdown renderer (headings, tables, code, lists, paragraphs) ──────────
function renderMarkdown(md) {
    const lines = md.trim().split('\n');
    const out = [];
    let i = 0;
    let key = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i++; continue; }

        // code fence
        if (line.startsWith('```')) {
            const code = [];
            i++;
            while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++; }
            i++;
            out.push(
                <pre key={key++} className="my-4 p-4 rounded-xl bg-gray-900 dark:bg-black/60 border border-gray-800 overflow-x-auto text-[13px] leading-relaxed text-gray-200 font-mono">
                    {code.join('\n')}
                </pre>
            );
            continue;
        }
        // table
        if (line.includes('|') && lines[i + 1]?.includes('---')) {
            const header = splitRow(line);
            const rows = [];
            i += 2;
            while (i < lines.length && lines[i].includes('|')) {
                rows.push(splitRow(lines[i]));
                i++;
            }
            out.push(
                <div key={key++} className="my-5 overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead><tr>{header.map((h, j) => <th key={j} className="text-left font-semibold px-3 py-2 border-b border-gray-200 dark:border-gray-700">{inline(h)}</th>)}</tr></thead>
                        <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400">{inline(c)}</td>)}</tr>)}</tbody>
                    </table>
                </div>
            );
            continue;
        }
        // headings
        if (line.startsWith('## ')) { out.push(<h2 key={key++} className="text-2xl font-bold mt-10 mb-3 tracking-tight">{inline(line.slice(3))}</h2>); i++; continue; }
        if (line.startsWith('### ')) { out.push(<h3 key={key++} className="text-lg font-bold mt-6 mb-2">{inline(line.slice(4))}</h3>); i++; continue; }
        // list
        if (line.startsWith('- ')) {
            const items = [];
            while (i < lines.length && lines[i].startsWith('- ')) { items.push(lines[i].slice(2)); i++; }
            out.push(<ul key={key++} className="my-4 space-y-1.5 list-disc pl-5 text-gray-600 dark:text-gray-400">{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>);
            continue;
        }
        // paragraph
        out.push(<p key={key++} className="my-4 leading-relaxed text-gray-600 dark:text-gray-400">{inline(line)}</p>);
        i++;
    }
    return out;
}
// split a markdown table row into cells, dropping only the empty strings the
// leading/trailing pipes produce — an intentionally blank cell (e.g. a corner
// label) is preserved so header and body rows keep the same column count.
function splitRow(line) {
    const cells = line.split('|').map(s => s.trim());
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();
    return cells;
}

// inline: **bold**, `code`, *italic*, and [text](href)
//
// Order in the alternation matters. `code` is matched before *italic* so the
// asterisks in inline SQL like `count(*)` are captured as code and never
// re-scanned as emphasis; **bold** precedes it for the same reason. Links are
// matched first so bold/code inside a label can't split the pattern.
const LINK_CLASS = 'text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:text-indigo-500';

function inline(text) {
    const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*`\n]+\*)/g);
    return parts.map((p, i) => {
        if (!p) return null;
        if (p.startsWith('[')) {
            const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
            if (!m) return p;
            const [, label, href] = m;
            // Internal links use Link so navigation stays client-side; it still
            // renders a real <a href> for crawlers and the prerenderer.
            if (href.startsWith('/')) {
                return <Link key={i} to={href} className={LINK_CLASS}>{label}</Link>;
            }
            return <a key={i} href={href} className={LINK_CLASS} target="_blank" rel="noopener noreferrer">{label}</a>;
        }
        if (p.startsWith('**')) return <strong key={i} className="text-gray-900 dark:text-white font-semibold">{p.slice(2, -2)}</strong>;
        if (p.startsWith('`')) return <code key={i} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 text-[0.9em] font-mono">{p.slice(1, -1)}</code>;
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i} className="italic">{p.slice(1, -1)}</em>;
        return p;
    });
}

function Shell({ children }) {
    return (
        <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] text-gray-900 dark:text-white">
            <header className="border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-[#fafafa]/90 dark:bg-[#0a0a0f]/90 backdrop-blur z-10">
                <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-[15px]">InsightsTrack</span>
                    </Link>
                    <Link to="/blog" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">Blog</Link>
                </div>
            </header>
            {children}
        </div>
    );
}


const AUTHOR = { '@type': 'Person', name: 'Nishikanta Ray', url: 'https://nishikanta.in/' };

function PostMeta({ post, size = 'sm' }) {
    const icon = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
    const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: size === 'sm' ? 'short' : 'long', day: 'numeric', year: 'numeric' });
    return (
        <>
            <span className="flex items-center gap-1">
                <Calendar className={icon} />
                {fmt(post.date)}
            </span>
            {/* Structured data reports `updated` as dateModified, and Google
                expects marked-up values to be visible on the page — so a post
                that advertises a revision has to show it. */}
            {post.updated && post.updated !== post.date && (
                <span className="flex items-center gap-1">Updated {fmt(post.updated)}</span>
            )}
            <span className="flex items-center gap-1"><Clock className={icon} />{post.readingMinutes} min read</span>
        </>
    );
}

function TagChips({ tags, className = '' }) {
    if (!tags?.length) return null;
    return (
        <div className={`flex flex-wrap gap-1.5 ${className}`}>
            {tags.map(t => (
                <Link key={t} to={`/blog/tag/${tagSlug(t)}`}
                    className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                    {t}
                </Link>
            ))}
        </div>
    );
}

function PostCard({ post }) {
    return (
        <Link to={`/blog/${post.slug}`}
            className="block p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors">
            <h2 className="text-lg font-bold mb-1.5">{post.title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{post.description}</p>
            <div className="flex items-center gap-4 text-xs text-gray-400">
                <PostMeta post={post} />
                <span className="ml-auto text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">Read <ArrowRight className="w-3 h-3" /></span>
            </div>
        </Link>
    );
}

function TagNav({ activeSlug }) {
    return (
        <div className="flex flex-wrap gap-2 mb-10">
            <Link to="/blog"
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${!activeSlug
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                All {BLOG_POSTS.length}
            </Link>
            {getTags().map(({ tag, slug, count }) => (
                <Link key={slug} to={`/blog/tag/${slug}`}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeSlug === slug
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                    {tag} {count}
                </Link>
            ))}
        </div>
    );
}

// ── Blog index ──────────────────────────────────────────────────────────────
function BlogIndex() {
    useSeo({
        title: 'Blog — Privacy-First Analytics Guides',
        description: 'Guides on open-source analytics, self-hosting with Docker, cookieless tracking, DuckDB architecture, and getting off Google Analytics — from the InsightsTrack team.',
        path: '/blog',
        jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: 'InsightsTrack Blog',
            url: canonicalUrl('/blog'),
            blogPost: BLOG_POSTS.map(p => ({
                '@type': 'BlogPosting',
                headline: p.title,
                url: canonicalUrl(`/blog/${p.slug}`),
                datePublished: isoDate(p.date),
                dateModified: isoDate(p.updated || p.date),
                description: p.description,
            })),
        },
    });
    const posts = [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date));
    return (
        <Shell>
            <main className="max-w-3xl mx-auto px-5 py-12">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">Blog</h1>
                <p className="text-gray-500 dark:text-gray-400 mb-8">
                    Guides on privacy-first analytics, self-hosting, DuckDB architecture, and moving off Google Analytics.
                </p>
                <TagNav />
                <div className="space-y-4">
                    {posts.map(p => <PostCard key={p.slug} post={p} />)}
                </div>
            </main>
        </Shell>
    );
}

// ── Tag archive ─────────────────────────────────────────────────────────────
function TagPage({ tagParam }) {
    const posts = getPostsByTag(tagParam);
    const label = posts[0]?.tags.find(t => tagSlug(t) === tagParam) || tagParam;
    const found = posts.length > 0;
    const intro = getTagIntro(tagParam, label, posts.length);

    useSeo(found ? {
        title: `${label} — Analytics Guides`,
        description: intro.length > 160 ? `${intro.slice(0, 157).trimEnd()}…` : intro,
        path: `/blog/tag/${tagParam}`,
        jsonLd: {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'CollectionPage',
                    name: `${label} — InsightsTrack Blog`,
                    url: canonicalUrl(`/blog/tag/${tagParam}`),
                    mainEntity: {
                        '@type': 'ItemList',
                        itemListElement: posts.map((p, i) => ({
                            '@type': 'ListItem',
                            position: i + 1,
                            url: canonicalUrl(`/blog/${p.slug}`),
                            name: p.title,
                        })),
                    },
                },
                {
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                        { '@type': 'ListItem', position: 1, name: 'Home', item: canonicalUrl('/') },
                        { '@type': 'ListItem', position: 2, name: 'Blog', item: canonicalUrl('/blog') },
                        { '@type': 'ListItem', position: 3, name: label, item: canonicalUrl(`/blog/tag/${tagParam}`) },
                    ],
                },
            ],
        },
    } : { title: 'Tag not found', noindex: true });

    if (!found) {
        return (
            <Shell>
                <main className="max-w-3xl mx-auto px-5 py-20 text-center">
                    <h1 className="text-2xl font-bold mb-3">Tag not found</h1>
                    <Link to="/blog" className="text-indigo-600 dark:text-indigo-400 font-semibold">← Back to blog</Link>
                </main>
            </Shell>
        );
    }

    return (
        <Shell>
            <main className="max-w-3xl mx-auto px-5 py-12">
                <nav className="text-xs text-gray-400 mb-4" aria-label="Breadcrumb">
                    <Link to="/" className="hover:underline">Home</Link> / <Link to="/blog" className="hover:underline">Blog</Link> / <span className="text-gray-500 dark:text-gray-300">{label}</span>
                </nav>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">{label}</h1>
                <p className="text-[15px] leading-relaxed text-gray-600 dark:text-gray-300 mb-3">
                    {intro}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                    {posts.length} guide{posts.length === 1 ? '' : 's'} on {label.toLowerCase()}.
                </p>
                <TagNav activeSlug={tagParam} />
                <div className="space-y-4">
                    {posts.map(p => <PostCard key={p.slug} post={p} />)}
                </div>
            </main>
        </Shell>
    );
}

// ── Single post ─────────────────────────────────────────────────────────────

// Pulls the "## Frequently asked questions" section out of a post body as
// question/answer pairs. Derived from the body rather than duplicated in the
// post data, so the structured data cannot drift from what the page shows —
// Google requires the marked-up answer to match the visible text.
// Google's Article guidance asks for ISO 8601 dates "with timezone information".
// Posts carry a plain YYYY-MM-DD, which is valid ISO 8601 but leaves the zone
// for Google to assume. Pinning it to UTC midnight states it explicitly.
const isoDate = (d) => `${d}T00:00:00+00:00`;

function extractFaq(body) {
    const section = body.split(/^## Frequently asked questions\s*$/m)[1];
    if (!section) return [];
    // Stop at the next h2, so a trailing "## How to decide" is not swallowed.
    const scoped = section.split(/^## /m)[0];
    // `(?=^### |$(?![\s\S]))` — next question, or true end of input. JS has no
    // \Z, and a bare `$` under /m would match the first line ending and cut
    // every answer to one line.
    return [...scoped.matchAll(/^### (.+?)[^\S\n]*\n([\s\S]*?)(?=^### |$(?![\s\S]))/gm)]
        .map(([, q, a]) => ({
            q: q.trim(),
            // Strip markdown links/emphasis to plain text for the schema value.
            a: a.trim()
                .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
                .replace(/\*\*([^*]+)\*\*/g, '$1')
                .replace(/\s+/g, ' '),
        }))
        .filter((x) => x.q && x.a);
}
function BlogPost({ post }) {
    const faq = extractFaq(post.body);

    useSeo({
        // seoTitle (optional) is a shorter variant used only for the <title>
        // tag, so long editorial headlines stay intact as the on-page H1 while
        // the SERP still shows the whole title instead of a truncation.
        title: post.seoTitle || post.title,
        description: post.description,
        path: `/blog/${post.slug}`,
        // Per-post card generated at build time by scripts/og-images.mjs.
        image: `${ORIGIN}/og/${post.slug}.png`,
        jsonLd: {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'BlogPosting',
                    headline: post.title,
                    description: post.description,
                    datePublished: isoDate(post.date),
                    // dateModified tracks real revisions when `updated` is set,
                    // so a re-edited evergreen post can signal freshness.
                    dateModified: isoDate(post.updated || post.date),
                    keywords: [post.keyword, ...(post.tags || [])].join(', '),
                    articleSection: post.tags?.[0],
                    wordCount: post.body.trim().split(/\s+/).length,
                    timeRequired: `PT${post.readingMinutes}M`,
                    inLanguage: 'en',
                    author: AUTHOR,
                    publisher: { '@type': 'Organization', name: 'InsightsTrack', url: canonicalUrl('/') },
                    mainEntityOfPage: canonicalUrl(`/blog/${post.slug}`),
                    image: `${ORIGIN}/og/${post.slug}.png`,
                },
                {
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                        { '@type': 'ListItem', position: 1, name: 'Home', item: canonicalUrl('/') },
                        { '@type': 'ListItem', position: 2, name: 'Blog', item: canonicalUrl('/blog') },
                        { '@type': 'ListItem', position: 3, name: post.title, item: canonicalUrl(`/blog/${post.slug}`) },
                    ],
                },
                // Only emitted for posts that actually show an FAQ section.
                //
                // Google retired the FAQ rich result (announced 2023, fully gone
                // from Search by May 2026), so this earns no snippet there and
                // FAQPage is no longer in Google's rich-results gallery. It is
                // kept because it is cheap, valid, matches the visible text, and
                // is still consumed by Bing and by the AI answer engines this
                // site targets — see docs/aeo.md. Do not add it expecting a
                // Google rich result.
                ...(faq.length ? [{
                    '@type': 'FAQPage',
                    mainEntity: faq.map(({ q, a }) => ({
                        '@type': 'Question',
                        name: q,
                        acceptedAnswer: { '@type': 'Answer', text: a },
                    })),
                }] : []),
            ],
        },
    });

    // Related posts: most tags in common, newest first. Gives every post a
    // crawlable path to its topical neighbours instead of only back to /blog.
    const related = BLOG_POSTS
        .filter(p => p.slug !== post.slug)
        .map(p => ({ p, overlap: (p.tags || []).filter(t => (post.tags || []).includes(t)).length }))
        .filter(x => x.overlap > 0)
        .sort((a, b) => b.overlap - a.overlap || b.p.date.localeCompare(a.p.date))
        .slice(0, 3)
        .map(x => x.p);

    return (
        <Shell>
            <article className="max-w-3xl mx-auto px-5 py-12">
                <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white mb-6">
                    <ArrowLeft className="w-4 h-4" /> All posts
                </Link>
                <nav className="text-xs text-gray-400 mb-4" aria-label="Breadcrumb">
                    <Link to="/" className="hover:underline">Home</Link> / <Link to="/blog" className="hover:underline">Blog</Link> / <span className="text-gray-500 dark:text-gray-300">{post.title}</span>
                </nav>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-4">{post.title}</h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-4">
                    <PostMeta post={post} size="lg" />
                </div>
                <TagChips tags={post.tags} className="mb-8 pb-8 border-b border-gray-200 dark:border-gray-800" />
                <div className="prose-content">{renderMarkdown(post.body)}</div>

                {related.length > 0 && (
                    <aside className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
                        <h2 className="text-lg font-bold mb-4">Related guides</h2>
                        <div className="space-y-3">
                            {related.map(p => (
                                <Link key={p.slug} to={`/blog/${p.slug}`}
                                    className="block p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors">
                                    <div className="font-semibold text-sm mb-1">{p.title}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{p.description}</div>
                                </Link>
                            ))}
                        </div>
                    </aside>
                )}

                <div className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-500/10 dark:to-violet-500/10 border border-indigo-100 dark:border-indigo-500/20 text-center">
                    <h3 className="text-lg font-bold mb-2">Try InsightsTrack free</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Open-source, self-hosted, privacy-first analytics — explore the live demo, no install required.</p>
                    <Link rel="nofollow" to="/register?redirect=/demo" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all">
                        Open live dashboard <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </article>
        </Shell>
    );
}

function NotFoundPost() {
    useSeo({ title: 'Post not found', noindex: true });
    return (
        <Shell>
            <main className="max-w-3xl mx-auto px-5 py-20 text-center">
                <h1 className="text-2xl font-bold mb-3">Post not found</h1>
                <Link to="/blog" className="text-indigo-600 dark:text-indigo-400 font-semibold">← Back to blog</Link>
            </main>
        </Shell>
    );
}

// Routing shim. Each branch is its own component so useSeo is called
// unconditionally inside it — calling a hook after an early return violates
// the rules of hooks and breaks when the route changes without a remount.
export default function Blog() {
    const { slug, tag } = useParams();
    if (tag) return <TagPage tagParam={tag} />;
    if (!slug) return <BlogIndex />;
    const post = getPost(slug);
    return post ? <BlogPost post={post} /> : <NotFoundPost />;
}
