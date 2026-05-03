import { useState, useMemo } from 'react';
import { Gauge, AlertTriangle, Activity, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAnalytics } from '../hooks/useAnalytics';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PageNote from '../components/ui/PageNote';

const VITAL_THRESHOLDS = {
    LCP: { good: 2500, poor: 4000, unit: 'ms', label: 'Largest Contentful Paint' },
    FID: { good: 100, poor: 300, unit: 'ms', label: 'First Input Delay' },
    CLS: { good: 0.1, poor: 0.25, unit: '', label: 'Cumulative Layout Shift' },
    INP: { good: 200, poor: 500, unit: 'ms', label: 'Interaction to Next Paint' },
    TTFB: { good: 800, poor: 1800, unit: 'ms', label: 'Time to First Byte' },
};
const PAGE_SIZE = 10;

function getVitalStatus(metric, value) {
    const t = VITAL_THRESHOLDS[metric];
    if (!t) return 'unknown';
    if (value <= t.good) return 'good';
    if (value <= t.poor) return 'needs-improvement';
    return 'poor';
}

function statusColor(status) {
    if (status === 'good') return 'text-green-500 bg-green-500/10';
    if (status === 'needs-improvement') return 'text-yellow-500 bg-yellow-500/10';
    if (status === 'poor') return 'text-red-500 bg-red-500/10';
    return 'text-gray-500 bg-gray-500/10';
}

function WebVitalsPerPageTable({ perPage }) {
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        if (!query.trim()) return perPage;
        const q = query.toLowerCase();
        return perPage.filter((r) => r.page?.toLowerCase().includes(q));
    }, [perPage, query]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    return (
        <div className="space-y-3">
            <div className="relative max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input type="text" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Filter pages…" className="w-full pl-8 pr-7 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-indigo-400" />
                {query && <button onClick={() => { setQuery(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            <th className="py-3 px-4 font-medium">Page</th>
                            {Object.keys(VITAL_THRESHOLDS).map(m => (
                                <th key={m} className="py-3 px-4 font-medium text-right">{m} (p75)</th>
                            ))}
                            <th className="py-3 px-4 font-medium text-right">Samples</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={Object.keys(VITAL_THRESHOLDS).length + 2} className="py-8 text-center text-sm text-gray-400 italic">No pages match &ldquo;{query}&rdquo;</td></tr>
                        ) : (
                            rows.map((row, i) => (
                                <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="py-3 px-4 font-mono text-xs truncate max-w-xs">{row.page}</td>
                                    {Object.keys(VITAL_THRESHOLDS).map(m => {
                                        const v = row.metrics?.[m];
                                        const status = v ? getVitalStatus(m, v.p75) : 'unknown';
                                        return (
                                            <td key={m} className="py-3 px-4 text-right">
                                                {v ? (
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(status)}`}>
                                                        {v.p75}{VITAL_THRESHOLDS[m].unit}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                        );
                                    })}
                                    <td className="py-3 px-4 text-right text-gray-500">{row.totalSamples}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div className="flex items-center justify-between gap-4 pt-2 text-sm flex-wrap">
                <span className="text-xs text-gray-500 dark:text-gray-400">{query ? `${filtered.length} of ${perPage.length} rows` : `${perPage.length} rows`}</span>
                <div className="flex items-center gap-1">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums px-1">{safePage} / {totalPages}</span>
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
                </div>
            </div>
        </div>
    );
}

function WebVitalsOverviewTab() {
    const { data: overview, loading: ovLoading } = useAnalytics('getWebVitalsOverview');
    const { data: perPage, loading: ppLoading } = useAnalytics('getWebVitals');

    return (
        <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {ovLoading && Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse h-28 bg-gray-100 dark:bg-gray-800 rounded-xl" />
                ))}
                {!ovLoading && Object.entries(VITAL_THRESHOLDS).map(([metric, info]) => {
                    const val = overview?.[metric];
                    const p75 = val?.p75 ?? '-';
                    const status = val ? getVitalStatus(metric, val.p75) : 'unknown';
                    return (
                        <div key={metric} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{metric}</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{p75}{info.unit && <span className="text-sm font-normal"> {info.unit}</span>}</div>
                            <div className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full ${statusColor(status)}`}>
                                {status === 'good' ? 'Good' : status === 'needs-improvement' ? 'Needs Work' : status === 'poor' ? 'Poor' : 'No data'}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1">{info.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* Per-Page Breakdown */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Web Vitals by Page</h3>
                {ppLoading && <div className="animate-pulse h-64 bg-gray-100 dark:bg-gray-800 rounded-lg" />}
                {!ppLoading && (!perPage?.length) && <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No Web Vitals data yet. Metrics are collected automatically via the tracking script.</p>}
                {!ppLoading && perPage?.length > 0 && (
                    <WebVitalsPerPageTable perPage={perPage} />
                )}
            </div>
        </div>
    );
}

function ErrorsTab() {
    const { data: errors, loading: errLoading } = useAnalytics('getJSErrors');
    const { data: trend, loading: trendLoading } = useAnalytics('getJSErrorsOverTime');

    return (
        <div className="space-y-6">
            {/* Error Trend */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Error Trend</h3>
                {trendLoading && <div className="animate-pulse h-48 bg-gray-100 dark:bg-gray-800 rounded-lg" />}
                {!trendLoading && trend?.length > 0 && (
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: 8, color: '#F9FAFB' }} />
                                <Area type="monotone" dataKey="errors" stroke="#EF4444" fill="#EF4444" fillOpacity={0.15} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
                {!trendLoading && !trend?.length && <p className="text-gray-500 dark:text-gray-400 text-center py-4">No errors recorded</p>}
            </div>

            {/* Error List */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Top Errors</h3>
                {errLoading && <div className="animate-pulse h-64 bg-gray-100 dark:bg-gray-800 rounded-lg" />}
                {!errLoading && (!errors?.length) && <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No JavaScript errors detected.</p>}
                {!errLoading && errors?.length > 0 && (
                    <div className="space-y-3">
                        {errors.map((err, i) => (
                            <div key={i} className="p-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="font-mono text-sm text-red-700 dark:text-red-400 break-all">{err.message}</p>
                                        {err.sourceFile && <p className="text-xs text-gray-500 mt-1 truncate">{err.sourceFile}</p>}
                                        <p className="text-xs text-gray-400 mt-1">on {err.page}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-lg font-bold text-red-600 dark:text-red-400">{err.occurrences}</div>
                                        <div className="text-xs text-gray-500">{err.affectedUsers} users</div>
                                    </div>
                                </div>
                                <div className="flex gap-4 mt-2 text-xs text-gray-400">
                                    <span>First: {err.firstSeen ? new Date(err.firstSeen).toLocaleDateString() : '-'}</span>
                                    <span>Last: {err.lastSeen ? new Date(err.lastSeen).toLocaleDateString() : '-'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Performance() {
    const [activeTab, setActiveTab] = useState('vitals');

    const TABS = [
        { key: 'vitals', label: 'Web Vitals', icon: Activity },
        { key: 'errors', label: 'JS Errors', icon: AlertTriangle },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                    <Gauge className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Performance</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Monitor page speed and track JavaScript errors</p>
                </div>
            </div>

            <PageNote
                title="What is Performance Monitoring?"
                summary="Performance tracks the technical health of your website. Slow pages lose visitors. Broken JavaScript costs conversions. This page helps you catch both."
                details={[
                    { label: 'LCP (Largest Contentful Paint)', text: 'Time until the largest visible element loads. Under 2.5s is good. Over 4s is poor. Affects SEO rankings.' },
                    { label: 'FID / INP (Interactivity)', text: 'How quickly the page responds to a user’s first click or tap. Over 200ms feels sluggish. Direct impact on user experience.' },
                    { label: 'CLS (Layout Shift)', text: 'Measures how much the page visually shifts after loading. Score above 0.1 causes users to misclick and feels unstable.' },
                    { label: 'TTFB (Time to First Byte)', text: 'How long your server takes to respond. Over 800ms usually points to slow hosting or unoptimised backend queries.' },
                    { label: 'JS Errors', text: 'Uncaught exceptions from your JavaScript. Each error can silently break features for real users.' },
                ]}
                businessTip="LCP directly affects Google search rankings (Core Web Vitals). If your LCP is over 2.5s, fixing it can improve your organic traffic. Rage clicks + JS errors together pinpoint broken user experiences."
                devTip="Web Vitals are captured via the PerformanceObserver API in the tracking script and sent as events with type=web_vital. JS errors use window.onerror. All stored in the events table with metric_name and metric_value columns."
            />

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

            {activeTab === 'vitals' && <WebVitalsOverviewTab />}
            {activeTab === 'errors' && <ErrorsTab />}
        </div>
    );
}
