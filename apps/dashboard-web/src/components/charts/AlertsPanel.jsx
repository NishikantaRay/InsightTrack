import { memo, useState, useMemo } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Bell, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { useAnalytics } from '../../hooks/useAnalytics';
import ChartCard from '../ui/ChartCard';
import { formatNumber, formatDate } from '../../utils/formatters';

const ALERTS_PAGE_SIZE = 10;

function AlertsPanel() {
    const { data: alerts, loading, error } = useAnalytics('getAlerts');
    const [page, setPage] = useState(1);
    const [query, setQuery] = useState('');

    const alertList = alerts || [];

    const filtered = useMemo(() => {
        if (!query.trim()) return alertList;
        const q = query.toLowerCase();
        return alertList.filter(a =>
            a.message?.toLowerCase().includes(q) ||
            a.type?.toLowerCase().includes(q) ||
            (a.date && formatDate(a.date).toLowerCase().includes(q))
        );
    }, [alertList, query]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ALERTS_PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageAlerts = filtered.slice((safePage - 1) * ALERTS_PAGE_SIZE, safePage * ALERTS_PAGE_SIZE);

    return (
        <ChartCard
            title="Traffic Alerts"
            subtitle={`Automatic spike and drop detection${alertList.length > 0 ? ` · ${alertList.length} total` : ''}`}
            loading={loading}
            error={error}
            empty={false}
        >
            {alertList.length > 0 && (
                <div className="mb-3">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={query}
                            onChange={e => { setQuery(e.target.value); setPage(1); }}
                            placeholder="Search alerts…"
                            className="w-full pl-8 pr-7 py-1.5 text-sm rounded-lg border border-border dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent/40 placeholder:text-text-muted"
                        />
                        {query && (
                            <button onClick={() => { setQuery(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                    {query && (
                        <p className="text-xs text-text-muted dark:text-text-muted-dark mt-1.5">
                            {filtered.length} of {alertList.length} alerts
                        </p>
                    )}
                </div>
            )}

            {pageAlerts.length > 0 && (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-0.5">
                    {pageAlerts.map((alert, i) => {
                        const isSpike = alert.type === 'spike';
                        const isUp = isSpike || alert.type === 'error_spike';
                        const label = alert.type === 'error_spike' ? 'Error Spike' : alert.type;
                        return (
                            <div
                                key={i}
                                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors
                                    ${isSpike
                                        ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-900/10'
                                        : 'border-red-200 bg-red-50/50 dark:border-red-800/30 dark:bg-red-900/10'
                                    }`}
                            >
                                <div className={`mt-0.5 p-1.5 rounded-lg ${isSpike
                                    ? 'bg-amber-100 dark:bg-amber-900/30'
                                    : 'bg-red-100 dark:bg-red-900/30'
                                    }`}>
                                    {isUp
                                        ? <TrendingUp className={`w-4 h-4 ${isSpike ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`} />
                                        : <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs font-semibold uppercase tracking-wide
                                            ${isSpike ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {label}
                                        </span>
                                        <span className="text-xs text-text-muted dark:text-text-muted-dark">
                                            {formatDate(alert.date)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-text-primary dark:text-text-primary-dark">
                                        {alert.message}
                                    </p>
                                    <div className="flex items-center gap-4 mt-1.5">
                                        <span className="text-xs text-text-muted dark:text-text-muted-dark">
                                            Change: <span className={`font-medium ${alert.change > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                                                {alert.change > 0 ? '+' : ''}{alert.change}%
                                            </span>
                                        </span>
                                        <span className="text-xs text-text-muted dark:text-text-muted-dark">
                                            Avg: {formatNumber(alert.average)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border dark:border-border-dark">
                    <span className="text-xs text-text-muted dark:text-text-muted-dark">
                        {(safePage - 1) * ALERTS_PAGE_SIZE + 1}–{Math.min(safePage * ALERTS_PAGE_SIZE, filtered.length)} of {filtered.length}
                    </span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-text-muted dark:text-text-muted-dark tabular-nums px-1">
                            {safePage} / {totalPages}
                        </span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {alertList.length === 0 && !loading && !error && (
                <div className="flex flex-col items-center py-8 text-text-muted dark:text-text-muted-dark">
                    <Bell className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-sm">No alerts detected</p>
                    <p className="text-xs mt-1">Traffic patterns look normal</p>
                </div>
            )}

            {alertList.length > 0 && filtered.length === 0 && (
                <p className="text-xs text-text-muted dark:text-text-muted-dark text-center py-4">
                    No alerts match &ldquo;{query}&rdquo;
                </p>
            )}
        </ChartCard>
    );
}

export default memo(AlertsPanel);
