import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bug, AlertTriangle, Search, ChevronLeft, ChevronRight, ChevronDown, X, ExternalLink, Settings2, RefreshCw, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAnalytics } from '../hooks/useAnalytics';
import { useSiteStore } from '../store/useSiteStore';
import { sitesAPI, analyticsAPI } from '../services/api';
import { formatNumber } from '../utils/formatters';
import PageNote from '../components/ui/PageNote';
import FocusToggleButton from '../components/ui/FocusToggleButton';
import { useFocusModeStore } from '../store/useFocusModeStore';

const PAGE_SIZES = [10, 25, 50, 100];

const LEVEL_STYLES = {
    fatal: 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30',
    error: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20',
    warning: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20',
    info: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20',
};

function levelStyle(level) {
    return LEVEL_STYLES[level] || 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-800';
}

function relTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    return `${days}d ago`;
}

function SummaryCards({ summary, loading }) {
    const cards = [
        { key: 'unresolved', label: 'Unresolved Issues', value: summary?.unresolved, accent: 'text-red-500' },
        { key: 'regressions', label: 'Regressions', value: summary?.regressions, accent: 'text-red-600' },
        { key: 'totalEvents', label: 'Total Events', value: summary?.totalEvents, accent: 'text-orange-500' },
        { key: 'usersAffected', label: 'Users Affected', value: summary?.usersAffected, accent: 'text-amber-500' },
        { key: 'totalIssues', label: 'Total Issues', value: summary?.totalIssues, accent: 'text-indigo-500' },
    ];
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {loading && Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse h-24 bg-gray-100 dark:bg-gray-800 rounded-xl" />
            ))}
            {!loading && cards.map((c) => (
                <div key={c.key} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{c.label}</div>
                    <div className={`text-2xl font-bold ${c.accent}`}>{formatNumber(c.value ?? 0)}</div>
                </div>
            ))}
        </div>
    );
}

function TrendChart({ trend, loading }) {
    const hasData = trend?.some((d) => d.events > 0);
    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Error Events Over Time</h3>
            {loading && <div className="animate-pulse h-48 bg-gray-100 dark:bg-gray-800 rounded-lg" />}
            {!loading && hasData && (
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: 8, color: '#F9FAFB' }} />
                            <Area type="monotone" dataKey="events" stroke="#EF4444" fill="#EF4444" fillOpacity={0.15} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
            {!loading && !hasData && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8 text-sm">
                    No event history yet. Sentry stats populate within a few minutes of the next poll.
                </p>
            )}
        </div>
    );
}

// Live drill-down: fetches the newest event for one issue on expand (not stored).
function IssueDetail({ siteId, sentryId }) {
    const [state, setState] = useState({ loading: true, error: null, event: null });

    useEffect(() => {
        let alive = true;
        setState({ loading: true, error: null, event: null });
        analyticsAPI.getSentryLatestEvent(siteId, sentryId)
            .then((res) => { if (alive) setState({ loading: false, error: null, event: res?.data?.data ?? res?.data ?? null }); })
            .catch((err) => { if (alive) setState({ loading: false, error: err?.response?.data?.error || 'Could not load event details.', event: null }); });
        return () => { alive = false; };
    }, [siteId, sentryId]);

    if (state.loading) {
        return <div className="mt-3 flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading latest event…</div>;
    }
    if (state.error) {
        return <div className="mt-3 text-xs text-red-500">{state.error}</div>;
    }
    const ev = state.event;
    if (!ev) return <div className="mt-3 text-xs text-gray-400">No event detail available.</div>;

    return (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 space-y-3 text-xs">
            {(ev.exceptionType || ev.exceptionValue) && (
                <div>
                    <span className="font-mono text-red-600 dark:text-red-400">{ev.exceptionType}</span>
                    {ev.exceptionValue && <span className="text-gray-600 dark:text-gray-300">: {ev.exceptionValue}</span>}
                </div>
            )}
            {ev.frames?.length > 0 && (
                <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-1 font-medium">Stack trace</div>
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 overflow-x-auto max-h-56">
                        {ev.frames.map((f, i) => (
                            <div key={i} className={`px-3 py-1 font-mono whitespace-nowrap ${f.inApp ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
                                <span>{f.function || '<anonymous>'}</span>
                                <span className="text-gray-400"> — {f.filename}{f.lineNo != null ? `:${f.lineNo}` : ''}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {ev.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {ev.tags.map((t, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                            <span className="text-gray-400">{t.key}:</span> {t.value}
                        </span>
                    ))}
                </div>
            )}
            {ev.breadcrumbs?.length > 0 && (
                <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-1 font-medium">Breadcrumbs</div>
                    <div className="space-y-0.5 max-h-40 overflow-y-auto">
                        {ev.breadcrumbs.map((b, i) => (
                            <div key={i} className="flex gap-2 text-gray-500 dark:text-gray-400">
                                <span className="text-gray-400 shrink-0">{b.category || b.level || '·'}</span>
                                <span className="truncate">{b.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function IssuesTable({ issues, siteId }) {
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [expanded, setExpanded] = useState(null); // sentryId of the open row
    const [pageSize, setPageSize] = useState(25);

    const filtered = useMemo(() => {
        if (!issues?.length) return [];
        if (!query.trim()) return issues;
        const q = query.toLowerCase();
        return issues.filter((e) =>
            e.title?.toLowerCase().includes(q) ||
            e.culprit?.toLowerCase().includes(q) ||
            e.shortId?.toLowerCase().includes(q)
        );
    }, [issues, query]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs text-gray-400">{filtered.length} of {issues.length} issues</p>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                            placeholder="Search issues…"
                            className="pl-8 pr-7 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-red-400 w-48"
                        />
                        {query && (
                            <button onClick={() => { setQuery(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                    <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                        className="py-1.5 px-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
                    >
                        {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} per page</option>)}
                    </select>
                </div>
            </div>

            {filtered.length === 0 ? (
                <p className="text-gray-400 text-sm py-8 text-center">No issues match &ldquo;{query}&rdquo;</p>
            ) : (
                <div className="space-y-2">
                    {rows.map((issue) => {
                        const isOpen = expanded === issue.sentryId;
                        return (
                        <div key={issue.sentryId} className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-red-300 dark:hover:border-red-900/50 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                                <button
                                    type="button"
                                    onClick={() => setExpanded(isOpen ? null : issue.sentryId)}
                                    aria-expanded={isOpen}
                                    className="min-w-0 text-left flex-1"
                                >
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
                                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium uppercase ${levelStyle(issue.level)}`}>{issue.level}</span>
                                        {issue.isRegression && (
                                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase text-white bg-red-600 dark:bg-red-500" title="This issue regressed — it was resolved and has reoccurred">
                                                Regressed
                                            </span>
                                        )}
                                        {issue.shortId && <span className="text-xs font-mono text-gray-400">{issue.shortId}</span>}
                                        {issue.status && issue.status !== 'unresolved' && (
                                            <span className="text-[11px] text-gray-400 italic">{issue.status}</span>
                                        )}
                                    </div>
                                    <p className="font-medium text-sm text-gray-900 dark:text-white break-words mt-1.5">{issue.title}</p>
                                    {issue.culprit && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate font-mono">{issue.culprit}</p>}
                                    <div className="flex gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                                        <span>First: {relTime(issue.firstSeen)}</span>
                                        <span>Last: {relTime(issue.lastSeen)}</span>
                                        {issue.project && <span>{issue.project}</span>}
                                        {issue.lastRelease && <span className="font-mono">release {issue.lastRelease}</span>}
                                    </div>
                                </button>
                                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                    <div className="text-lg font-bold text-red-600 dark:text-red-400">{formatNumber(issue.count)}</div>
                                    <div className="text-xs text-gray-500">{formatNumber(issue.userCount)} users</div>
                                    {issue.permalink && (
                                        <a href={issue.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:text-indigo-600 inline-flex items-center gap-1 mt-1">
                                            Sentry <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                            {isOpen && <IssueDetail siteId={siteId} sentryId={issue.sentryId} />}
                        </div>
                        );
                    })}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
                    </span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums px-2">Page {safePage} of {totalPages}</span>
                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>
            )}
        </div>
    );
}

function NotConnected() {
    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
                <Bug className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Connect Sentry to see your errors</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
                Link this site&rsquo;s Sentry project and we&rsquo;ll pull its issues, event counts, and affected
                users into this dashboard automatically.
            </p>
            <Link to="/settings?tab=integrations" className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors">
                <Settings2 className="w-4 h-4" /> Connect Sentry
            </Link>
        </div>
    );
}

export default function Errors() {
    const siteId = useSiteStore((s) => s.siteId);
    const { focusMode } = useFocusModeStore();
    const [integrations, setIntegrations] = useState([]);
    const [intLoading, setIntLoading] = useState(true);

    const loadIntegration = useCallback(async () => {
        if (!siteId) return;
        try {
            const res = await sitesAPI.getSentryIntegrations(siteId);
            const list = res?.data?.data ?? res?.data ?? [];
            setIntegrations(Array.isArray(list) ? list : []);
        } catch {
            setIntegrations([]);
        } finally {
            setIntLoading(false);
        }
    }, [siteId]);

    useEffect(() => { setIntLoading(true); loadIntegration(); }, [loadIntegration]);

    // Connected = at least one project has a token on file.
    const connected = integrations.some((i) => i.connected);
    // Surface the first project reporting an error (for the banner below).
    const errored = integrations.find((i) => i.status === 'error' && i.lastError);
    const { data: summary, loading: sumLoading } = useAnalytics('getSentrySummary', { enabled: !!connected });
    const { data: trend, loading: trendLoading } = useAnalytics('getSentryTrend', { enabled: !!connected });
    const { data: issues, loading: issuesLoading, refetch } = useAnalytics('getSentryIssues', { enabled: !!connected });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                {!focusMode && (
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-500/10">
                            <Bug className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Errors</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Runtime errors and crashes from your connected Sentry project</p>
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    {connected && (
                        <button onClick={refetch} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors" title="Refresh">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    )}
                    <FocusToggleButton />
                </div>
            </div>

            {!focusMode && (
                <PageNote
                    title="What is Error Monitoring?"
                    summary="This page mirrors your Sentry issues inside InsightTrack, so you can watch traffic and bugs side by side. Each site connects its own Sentry project; every connected project is polled on a schedule."
                    details={[
                        { label: 'Issue', text: 'A group of similar error events (same fingerprint). The count is how many times it fired; users is how many distinct people it affected.' },
                        { label: 'Level', text: 'Severity reported by Sentry — fatal and error are crashes; warning is a non-fatal problem.' },
                        { label: 'Unresolved', text: 'Issues still open in Sentry. Resolving or ignoring them in Sentry is reflected here on the next poll.' },
                    ]}
                    businessTip="A spike in the error-events chart right after a deploy usually means a regression. Watching Errors next to your traffic charts helps you catch bugs that quietly cost conversions."
                    devTip="Connect a project under Settings → Integrations. The backend polls Sentry's issues + project-stats APIs, stores them in PostgreSQL, and syncs to DuckDB for these reads. Click any issue to fetch its latest event (stack trace, breadcrumbs, tags) live from Sentry. The auth token is stored encrypted (AES-256-GCM) and never sent to the browser."
                />
            )}

            {intLoading && <div className="animate-pulse h-40 bg-gray-100 dark:bg-gray-800 rounded-xl" />}

            {!intLoading && !connected && <NotConnected />}

            {!intLoading && connected && (
                <>
                    {errored && (
                        <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
                            errored.authError
                                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300'
                                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300'}`}>
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>
                                {errored.authError
                                    ? <>The Sentry token{errored.project ? ` for ${errored.project}` : ''} was rejected — error data is paused until you reconnect. </>
                                    : <>Sentry poll failed{errored.project ? ` for ${errored.project}` : ''}: {errored.lastError}. </>}
                                <Link to="/settings?tab=integrations" className="underline font-medium">Fix it in Settings → Integrations</Link>.
                            </span>
                        </div>
                    )}
                    <SummaryCards summary={summary} loading={sumLoading} />
                    <TrendChart trend={trend} loading={trendLoading} />
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Issues</h3>
                        {issuesLoading && <div className="animate-pulse h-64 bg-gray-100 dark:bg-gray-800 rounded-lg" />}
                        {!issuesLoading && !issues?.length && (
                            <div className="flex flex-col items-center py-12 text-gray-400">
                                <Bug className="w-10 h-10 mb-3 opacity-30" />
                                <p className="text-sm">No issues in this period. </p>
                                <p className="text-xs mt-1 opacity-70">Newly connected projects populate within a few minutes of the next poll.</p>
                            </div>
                        )}
                        {!issuesLoading && issues?.length > 0 && <IssuesTable issues={issues} siteId={siteId} />}
                    </div>
                </>
            )}
        </div>
    );
}
