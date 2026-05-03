import { memo } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Bell } from 'lucide-react';
import { useAnalytics } from '../../hooks/useAnalytics';
import ChartCard from '../ui/ChartCard';
import { formatNumber, formatDate } from '../../utils/formatters';

function AlertsPanel() {
    const { data: alerts, loading, error } = useAnalytics('getAlerts');

    const alertList = alerts || [];

    return (
        <ChartCard
            title="Traffic Alerts"
            subtitle="Automatic spike and drop detection"
            loading={loading}
            error={error}
            empty={!alertList.length}
        >
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {alertList.map((alert, i) => {
                    const isSpike = alert.type === 'spike';
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
                                {isSpike
                                    ? <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                    : <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs font-semibold uppercase tracking-wide
                                        ${isSpike ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {alert.type}
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

            {alertList.length === 0 && !loading && !error && (
                <div className="flex flex-col items-center py-8 text-text-muted dark:text-text-muted-dark">
                    <Bell className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-sm">No alerts detected</p>
                    <p className="text-xs mt-1">Traffic patterns look normal</p>
                </div>
            )}
        </ChartCard>
    );
}

export default memo(AlertsPanel);
