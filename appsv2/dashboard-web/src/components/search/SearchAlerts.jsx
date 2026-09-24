import { useState } from 'react';
import { Bell, AlertOctagon, AlertTriangle, TrendingUp, Check, CheckCheck } from 'lucide-react';
import { searchAlertsAPI } from '../../services/api';

/** Fired after alerts are marked read, so the sidebar count updates at once. */
export const SEARCH_ALERTS_CHANGED = 'analytics-search-alerts-changed';

const SEVERITY = {
    critical: {
        label: 'Critical',
        Icon: AlertOctagon,
        className: 'text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-900/40',
    },
    warning: {
        label: 'Warning',
        Icon: AlertTriangle,
        className: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40',
    },
    positive: {
        label: 'Good news',
        Icon: TrendingUp,
        className: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40',
    },
};

const COLLAPSED = 5;

function timeAgo(iso) {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
}

/**
 * In-app alerts raised by rank checks: a page leaving page one, a real rank
 * drop, a lost AI-answer citation — and the good-news equivalents. Nothing is
 * emailed or sent anywhere; this panel and the sidebar count are the channel.
 */
export default function SearchAlerts({ siteId, data, loading, onChanged }) {
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [busy, setBusy] = useState(false);

    const all = data?.alerts ?? [];
    const unread = data?.unreadCount ?? 0;
    const alerts = unreadOnly ? all.filter((a) => !a.read) : all;
    const shown = expanded ? alerts : alerts.slice(0, COLLAPSED);

    const markRead = async (ids) => {
        setBusy(true);
        try {
            await searchAlertsAPI.markRead(siteId, ids);
            window.dispatchEvent(new Event(SEARCH_ALERTS_CHANGED));
            onChanged?.();
        } finally {
            setBusy(false);
        }
    };

    if (loading && !data) return null;

    return (
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    <Bell className="w-4 h-4 text-indigo-500" aria-hidden="true" />
                    Alerts
                    {unread > 0 && (
                        <span className="px-1.5 py-0.5 text-[11px] font-semibold rounded-full bg-rose-600 text-white tabular-nums">
                            {unread} new
                        </span>
                    )}
                </h2>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden text-xs" role="group" aria-label="Filter alerts">
                        {[['All', false], ['Unread', true]].map(([label, value]) => (
                            <button key={label} type="button" onClick={() => setUnreadOnly(value)}
                                aria-pressed={unreadOnly === value}
                                className={`px-2.5 py-1 font-medium ${
                                    unreadOnly === value
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}>
                                {label}
                            </button>
                        ))}
                    </div>
                    {unread > 0 && (
                        <button type="button" disabled={busy} onClick={() => markRead([])}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                            <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                            Mark all read
                        </button>
                    )}
                </div>
            </header>

            {alerts.length === 0 ? (
                <p className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
                    {unreadOnly
                        ? 'You’re all caught up.'
                        : 'No alerts yet. They appear when a scheduled rank check finds a real change since the previous check.'}
                </p>
            ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                    {shown.map((a) => {
                        const sev = SEVERITY[a.severity] ?? SEVERITY.warning;
                        return (
                            <li key={a.id} className={`flex items-start gap-3 px-4 py-3 ${a.read ? 'opacity-60' : ''}`}>
                                <span className={`mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${sev.className}`}
                                    title={sev.label}>
                                    <sev.Icon className="w-4 h-4" aria-hidden="true" />
                                    <span className="sr-only">{sev.label}</span>
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className={`text-sm text-gray-900 dark:text-gray-100 ${a.read ? '' : 'font-medium'}`}>
                                        {a.message}
                                    </p>
                                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {timeAgo(a.createdAt)}
                                        {a.location ? ` · ${a.location}` : ''}
                                        {a.paths?.length ? ` · ${a.paths.join(', ')}` : ''}
                                    </p>
                                </div>
                                {!a.read && (
                                    <button type="button" disabled={busy} onClick={() => markRead([a.id])}
                                        aria-label="Mark alert read"
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-50">
                                        <Check className="w-4 h-4" aria-hidden="true" />
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {alerts.length > COLLAPSED && (
                <button type="button" onClick={() => setExpanded((v) => !v)}
                    className="w-full px-4 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    {expanded ? 'Show fewer' : `Show all ${alerts.length}`}
                </button>
            )}
        </section>
    );
}
