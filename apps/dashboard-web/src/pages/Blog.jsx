import { Link, useParams } from 'react-router-dom';
import { BarChart3, ArrowLeft, ArrowRight, Clock, Calendar } from 'lucide-react';
import { BLOG_POSTS, getPost } from '../data/blogPosts';
import { useSeo, ORIGIN } from '../hooks/useSeo';

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
            const header = line.split('|').map(s => s.trim()).filter(Boolean);
            const rows = [];
            i += 2;
            while (i < lines.length && lines[i].includes('|')) {
                rows.push(lines[i].split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length));
                i++;
            }
            out.push(
                <div key={key++} className="my-5 overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead><tr>{header.map((h, j) => <th key={j} className="text-left font-semibold px-3 py-2 border-b border-gray-200 dark:border-gray-700">{h}</th>)}</tr></thead>
                        <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400">{inline(c)}</td>)}</tr>)}</tbody>
                    </table>
                </div>
            );
            continue;
        }
        // headings
        if (line.startsWith('## ')) { out.push(<h2 key={key++} className="text-2xl font-bold mt-10 mb-3 tracking-tight">{line.slice(3)}</h2>); i++; continue; }
        if (line.startsWith('### ')) { out.push(<h3 key={key++} className="text-lg font-bold mt-6 mb-2">{line.slice(4)}</h3>); i++; continue; }
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
// inline: **bold** and `code`
function inline(text) {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((p, i) => {
        if (p.startsWith('**')) return <strong key={i} className="text-gray-900 dark:text-white font-semibold">{p.slice(2, -2)}</strong>;
        if (p.startsWith('`')) return <code key={i} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 text-[0.9em] font-mono">{p.slice(1, -1)}</code>;
        return p;
    });
}

function Shell({ children }) {
    return (
        <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] text-gray-900 dark:text-white">
            <header className="border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-[#fafafa]/90 dark:bg-[#0a0a0f]/90 backdrop-blur z-10">
                <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
                    <Link to="/landing" className="flex items-center gap-2.5">
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

export default function Blog() {
    const { slug } = useParams();

    // ── Blog index ──────────────────────────────────────────────────────────
    if (!slug) {
        useSeo({
            title: 'Blog — Privacy-First Analytics Guides',
            description: 'Guides on open-source analytics, self-hosting with Docker, cookieless tracking, and getting off Google Analytics — from the InsightsTrack team.',
            path: '/blog',
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'Blog',
                name: 'InsightsTrack Blog',
                url: `${ORIGIN}/blog`,
                blogPost: BLOG_POSTS.map(p => ({
                    '@type': 'BlogPosting',
                    headline: p.title,
                    url: `${ORIGIN}/blog/${p.slug}`,
                    datePublished: p.date,
                    description: p.description,
                })),
            },
        });
        return (
            <Shell>
                <main className="max-w-3xl mx-auto px-5 py-12">
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">Blog</h1>
                    <p className="text-gray-500 dark:text-gray-400 mb-10">
                        Guides on privacy-first analytics, self-hosting, and moving off Google Analytics.
                    </p>
                    <div className="space-y-4">
                        {BLOG_POSTS.map(p => (
                            <Link key={p.slug} to={`/blog/${p.slug}`}
                                className="block p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors">
                                <h2 className="text-lg font-bold mb-1.5">{p.title}</h2>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{p.description}</p>
                                <div className="flex items-center gap-4 text-xs text-gray-400">
                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{p.readingMinutes} min read</span>
                                    <span className="ml-auto text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">Read <ArrowRight className="w-3 h-3" /></span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </main>
            </Shell>
        );
    }

    // ── Single post ─────────────────────────────────────────────────────────
    const post = getPost(slug);
    if (!post) {
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

    useSeo({
        title: post.title,
        description: post.description,
        path: `/blog/${post.slug}`,
        jsonLd: {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'BlogPosting',
                    headline: post.title,
                    description: post.description,
                    datePublished: post.date,
                    dateModified: post.date,
                    keywords: post.keyword,
                    author: { '@type': 'Person', name: 'Nishikanta Ray', url: 'https://nishikanta.in/' },
                    publisher: { '@type': 'Organization', name: 'InsightsTrack', url: ORIGIN },
                    mainEntityOfPage: `${ORIGIN}/blog/${post.slug}`,
                    image: `${ORIGIN}/og-image.png`,
                },
                {
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                        { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN },
                        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${ORIGIN}/blog` },
                        { '@type': 'ListItem', position: 3, name: post.title, item: `${ORIGIN}/blog/${post.slug}` },
                    ],
                },
            ],
        },
    });

    return (
        <Shell>
            <article className="max-w-3xl mx-auto px-5 py-12">
                <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white mb-6">
                    <ArrowLeft className="w-4 h-4" /> All posts
                </Link>
                <nav className="text-xs text-gray-400 mb-4" aria-label="Breadcrumb">
                    <Link to="/landing" className="hover:underline">Home</Link> / <Link to="/blog" className="hover:underline">Blog</Link> / <span className="text-gray-500 dark:text-gray-300">{post.title}</span>
                </nav>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-4">{post.title}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-400 mb-8 pb-8 border-b border-gray-200 dark:border-gray-800">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{post.readingMinutes} min read</span>
                </div>
                <div className="prose-content">{renderMarkdown(post.body)}</div>

                <div className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-500/10 dark:to-violet-500/10 border border-indigo-100 dark:border-indigo-500/20 text-center">
                    <h3 className="text-lg font-bold mb-2">Try InsightsTrack free</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Open-source, self-hosted, privacy-first analytics — explore the live demo, no install required.</p>
                    <Link to="/register?redirect=/demo" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all">
                        Open live dashboard <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </article>
        </Shell>
    );
}
