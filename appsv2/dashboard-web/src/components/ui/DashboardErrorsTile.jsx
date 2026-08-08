import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bug, AlertTriangle, ChevronRight } from 'lucide-react';
import { useSiteStore } from '../../store/useSiteStore';
import { sitesAPI } from '../../services/api';
import { useAnalytics } from '../../hooks/useAnalytics';
import { formatNumber } from '../../utils/formatters';

/**
 * Compact errors summary for the main Dashboard. Renders nothing unless the
 * active site has a connected Sentry integration — so the tile only appears for
 * sites that opted into error monitoring. Links through to the Errors page.
 */
export default function DashboardErrorsTile() {
    const siteId = useSiteStore((s) => s.siteId);
    const [connected, setConnected] = useState(false);
    const [authIssue, setAuthIssue] = useState(null); // { project } when a token needs attention
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        let alive = true;
        setChecked(false);
        if (!siteId) return;
        sitesAPI.getSentryIntegrations(siteId)
            .then((res) => {
                const list = res?.data?.data ?? res?.data ?? [];
                const arr = Array.isArray(list) ? list : [];
                const anyConnected = arr.some((i) => i.connected);
                const broken = arr.find((i) => i.authError);
                if (alive) { setConnected(anyConnected); setAuthIssue(broken || null); setChecked(true); }
            })
            .catch(() => { if (alive) { setConnected(false); setAuthIssue(null); setChecked(true); } });
        return () => { alive = false; };
    }, [siteId]);

    // Only fetch the summary once we know Sentry is connected.
    const { data: summary } = useAnalytics('getSentrySummary', { enabled: connected });

    if (!checked || !connected) return null;

    // Token/target problem: prompt the user to reconnect (P3.3). Takes priority
    // over the normal count tile since polling is stalled until it's fixed.
    if (authIssue) {
        return (
            <Link to="/settings?tab=integrations"
                className="flex items-center justify-between gap-4 p-4 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-900/15 hover:bg-amber-50 dark:hover:bg-amber-900/25 transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-amber-500/15 shrink-0"><AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">Sentry needs attention</div>
                        <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
                            The token for {authIssue.project ? <span className="font-mono">{authIssue.project}</span> : 'a project'} was rejected — error data is paused until you reconnect.
                        </p>
                    </div>
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 shrink-0">Fix <ChevronRight className="w-4 h-4" /></span>
            </Link>
        );
    }

    const unresolved = summary?.unresolved ?? 0;
    const regressions = summary?.regressions ?? 0;
    const events = summary?.totalEvents ?? 0;
    const hasProblems = unresolved > 0 || regressions > 0;

    return (
        <Link
            to="/errors"
            className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors group
                ${hasProblems
                    ? 'border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'}`}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-lg shrink-0 ${hasProblems ? 'bg-red-500/10' : 'bg-gray-500/10'}`}>
                    {hasProblems
                        ? <AlertTriangle className="w-5 h-5 text-red-500" />
                        : <Bug className="w-5 h-5 text-gray-400" />}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {hasProblems
                                ? `${formatNumber(unresolved)} unresolved error${unresolved === 1 ? '' : 's'}`
                                : 'No unresolved errors'}
                        </span>
                        {regressions > 0 && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase text-white bg-red-600">
                                {formatNumber(regressions)} regressed
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatNumber(events)} events in this period · from Sentry
                    </p>
                </div>
            </div>
            <span className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 shrink-0">
                View <ChevronRight className="w-4 h-4" />
            </span>
        </Link>
    );
}
