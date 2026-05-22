import { useState, useMemo } from 'react';
import { FileText, LogIn, LogOut, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAnalytics } from '../hooks/useAnalytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PageNote from '../components/ui/PageNote';
import FocusToggleButton from '../components/ui/FocusToggleButton';
import { useFocusModeStore } from '../store/useFocusModeStore';

const TABS = [
    { key: 'entry', label: 'Entry Pages', icon: LogIn },
    { key: 'exit', label: 'Exit Pages', icon: LogOut },
    { key: 'search', label: 'Site Search', icon: Search },
];

const PAGE_SIZE = 10;

function TablePagination({ page, totalPages, onPrev, onNext, totalRows, filteredRows, query }) {
    return (
        <div className="flex items-center justify-between gap-4 pt-2 text-sm flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400">
                {query ? `${filteredRows} of ${totalRows} rows` : `${totalRows} rows`}
            </span>
            <div className="flex items-center gap-1">
                <button onClick={onPrev} disabled={page === 1} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums px-1">{page} / {totalPages}</span>
                <button onClick={onNext} disabled={page === totalPages} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

function PageTable({ data, loading, type }) {
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        if (!query.trim() || !data) return data || [];
        const q = query.toLowerCase();
        return data.filter((r) => r.page?.toLowerCase().includes(q));
    }, [data, query]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    if (loading) return <div className="animate-pulse h-64 bg-gray-100 dark:bg-gray-800 rounded-lg" />;
    if (!data?.length) return <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No data available</p>;

    return (
        <div className="space-y-3">
            <div className="relative max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                    placeholder="Filter pages…"
                    className="w-full pl-8 pr-7 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-indigo-400"
                />
                {query && (
                    <button onClick={() => { setQuery(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            <th className="py-3 px-4 font-medium">Page</th>
                            <th className="py-3 px-4 font-medium text-right">{type === 'entry' ? 'Entries' : 'Exits'}</th>
                            <th className="py-3 px-4 font-medium text-right">Unique Users</th>
                            <th className="py-3 px-4 font-medium text-right">%</th>
                            {type === 'entry' && <th className="py-3 px-4 font-medium text-right">Bounce Rate</th>}
                            <th className="py-3 px-4 font-medium text-right">Avg Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={type === 'entry' ? 6 : 5} className="py-8 text-center text-sm text-gray-400 italic">No pages match &ldquo;{query}&rdquo;</td></tr>
                        ) : (
                            rows.map((row, i) => (
                                <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="py-3 px-4 font-mono text-xs truncate max-w-xs">{row.page}</td>
                                    <td className="py-3 px-4 text-right font-semibold">{(row.entries || row.exits || 0).toLocaleString()}</td>
                                    <td className="py-3 px-4 text-right">{row.uniqueUsers?.toLocaleString()}</td>
                                    <td className="py-3 px-4 text-right">{row.percentage}%</td>
                                    {type === 'entry' && <td className="py-3 px-4 text-right">{row.bounceRate}%</td>}
                                    <td className="py-3 px-4 text-right">{row.avgSessionDuration ? `${Math.round(row.avgSessionDuration)}s` : '-'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <TablePagination page={safePage} totalPages={totalPages} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))} totalRows={data.length} filteredRows={filtered.length} query={query} />
        </div>
    );
}

function EntryPagesTab() {
    const { data, loading } = useAnalytics('getEntryPages');
    const chartData = (data || []).slice(0, 10);

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Top Entry Pages</h3>
                {chartData.length > 0 && (
                    <div className="h-64 mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                                <XAxis type="number" tick={{ fontSize: 12 }} />
                                <YAxis type="category" dataKey="page" tick={{ fontSize: 11 }} width={110} />
                                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: 8, color: '#F9FAFB' }} />
                                <Bar dataKey="entries" fill="#6366F1" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
                <PageTable data={data} loading={loading} type="entry" />
            </div>
        </div>
    );
}

function ExitPagesTab() {
    const { data, loading } = useAnalytics('getExitPages');
    const chartData = (data || []).slice(0, 10);

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Top Exit Pages</h3>
                {chartData.length > 0 && (
                    <div className="h-64 mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                                <XAxis type="number" tick={{ fontSize: 12 }} />
                                <YAxis type="category" dataKey="page" tick={{ fontSize: 11 }} width={110} />
                                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: 8, color: '#F9FAFB' }} />
                                <Bar dataKey="exits" fill="#EF4444" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
                <PageTable data={data} loading={loading} type="exit" />
            </div>
        </div>
    );
}

function SearchQueriesTable({ data }) {
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        if (!query.trim()) return data;
        const q = query.toLowerCase();
        return data.filter((r) => r.query?.toLowerCase().includes(q) || r.page?.toLowerCase().includes(q));
    }, [data, query]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    return (
        <div className="space-y-3">
            <div className="relative max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                    placeholder="Filter queries…"
                    className="w-full pl-8 pr-7 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-indigo-400"
                />
                {query && (
                    <button onClick={() => { setQuery(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            <th className="py-3 px-4 font-medium">Query</th>
                            <th className="py-3 px-4 font-medium text-right">Searches</th>
                            <th className="py-3 px-4 font-medium text-right">Unique Users</th>
                            <th className="py-3 px-4 font-medium">Page</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={4} className="py-8 text-center text-sm text-gray-400 italic">No results match &ldquo;{query}&rdquo;</td></tr>
                        ) : (
                            rows.map((row, i) => (
                                <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="py-3 px-4 font-medium">{row.query}</td>
                                    <td className="py-3 px-4 text-right">{row.searches}</td>
                                    <td className="py-3 px-4 text-right">{row.uniqueUsers}</td>
                                    <td className="py-3 px-4 font-mono text-xs truncate max-w-xs">{row.page}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <TablePagination page={safePage} totalPages={totalPages} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))} totalRows={data.length} filteredRows={filtered.length} query={query} />
        </div>
    );
}

function SiteSearchTab() {
    const { data, loading } = useAnalytics('getSiteSearch');

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Search Queries</h3>
                {loading && <div className="animate-pulse h-64 bg-gray-100 dark:bg-gray-800 rounded-lg" />}
                {!loading && (!data?.length) && (
                    <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No site search data yet. Search tracking captures form submissions with search inputs.</p>
                )}
                {!loading && data?.length > 0 && (
                    <SearchQueriesTable data={data} />
                )}
            </div>
        </div>
    );
}

export default function Content() {
    const [activeTab, setActiveTab] = useState('entry');
    const { focusMode } = useFocusModeStore();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                {!focusMode && (
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <FileText className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Analytics</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Understand how visitors navigate your content</p>
                        </div>
                    </div>
                )}
                <FocusToggleButton />
            </div>

            {!focusMode && (
                <PageNote
                    title="What is Content Analytics?"
                    summary="Content Analytics reveals how visitors move through your website — which pages hook them first, where they leave, and what they search for."
                    details={[
                        { label: 'Entry Pages', text: 'The first pages visitors land on. A high-bounce entry page needs better content or a clearer call-to-action.' },
                        { label: 'Exit Pages', text: 'Pages where visitors leave your site. High exits on checkout or sign-up pages often indicate friction or confusion.' },
                        { label: 'Site Search', text: 'What visitors type into your on-site search box. These terms reveal exactly what your audience wants but can’t easily find.' },
                    ]}
                    businessTip="Your top entry pages are your most important real estate. If those pages have high bounce rates, improving them will have the biggest impact on conversions."
                    devTip="Entry/exit data is derived from session first/last pageview. Site search captures ?q= or ?search= query params. All sourced from GET /api/analytics/:siteId/top-pages with type filters."
                />
            )}

            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                {TABS.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === key
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {activeTab === 'entry' && <EntryPagesTab />}
            {activeTab === 'exit' && <ExitPagesTab />}
            {activeTab === 'search' && <SiteSearchTab />}
        </div>
    );
}
