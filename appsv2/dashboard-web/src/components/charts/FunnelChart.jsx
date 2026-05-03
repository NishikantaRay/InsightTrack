import { memo } from 'react';
import { useThemeStore } from '../../store/useThemeStore';
import { formatNumber, formatPercent, CHART_COLORS } from '../../utils/formatters';
import ChartCard from '../ui/ChartCard';
import { useAnalytics } from '../../hooks/useAnalytics';

/**
 * FunnelChart
 * @param {Array<{label:string, type:string, path?:string}>|null} [steps]
 *   Optional custom funnel steps. When null/empty the API returns the default funnel.
 */
function FunnelChart({ steps }) {
    const { data, loading, error } = useAnalytics('getFunnel', {
        params: steps && steps.length > 0 ? { steps } : {},
    });
    const theme = useThemeStore((s) => s.theme);
    const isDark = theme === 'dark';

    const funnelSteps = (data || []).map((d, idx) => ({
        name: d.step || d.name || `Step ${idx + 1}`,
        count: Number(d.visitors || d.count || d.value || 0),
        percentage: Number(d.percentage || 0),
    }));

    const maxCount = Math.max(...funnelSteps.map((s) => s.count), 1);

    // Safe arithmetic helpers — never produce NaN or Infinity
    const safeDropoff = (prev, curr) => {
        if (!prev || prev === 0) return 0;
        return Math.max(0, ((prev - curr) / prev) * 100);
    };
    const safeConversion = (first, curr) => {
        if (!first || first === 0) return curr > 0 ? 100 : 0;
        return (curr / first) * 100;
    };

    return (
        <ChartCard
            title="Conversion Funnel"
            subtitle="User journey through key steps"
            loading={loading}
            error={error}
            empty={!funnelSteps.length}
        >
            <div className="space-y-4 py-2">
                {funnelSteps.map((step, idx) => {
                    const widthPercent = (step.count / maxCount) * 100;
                    const dropoff = safeDropoff(funnelSteps[idx - 1]?.count, step.count);
                    const conversionRate = safeConversion(funnelSteps[0]?.count, step.count);
                    const hasData = step.count > 0;

                    return (
                        <div key={idx} className="group">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                                    >
                                        {idx + 1}
                                    </span>
                                    <span className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                        {step.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold">
                                        {hasData ? formatNumber(step.count) : <span className="text-text-muted dark:text-text-muted-dark text-xs">no data</span>}
                                    </span>
                                    {idx > 0 && hasData && (
                                        <span className="text-xs text-red-500 dark:text-red-400 font-medium tabular-nums">
                                            ↓{dropoff.toFixed(1)}%
                                        </span>
                                    )}
                                    {idx > 0 && !hasData && (
                                        <span className="text-xs text-text-muted dark:text-text-muted-dark">—</span>
                                    )}
                                </div>
                            </div>

                            {/* Bar */}
                            <div className="h-9 bg-gray-50 dark:bg-white/[0.03] rounded-lg overflow-hidden relative">
                                {hasData ? (
                                    <div
                                        className="h-full rounded-lg transition-all duration-700 ease-out flex items-center justify-end pr-3"
                                        style={{
                                            width: `${Math.max(widthPercent, 4)}%`,
                                            backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                                            opacity: 0.85,
                                        }}
                                    >
                                        <span className="text-xs font-semibold text-white tabular-nums">
                                            {conversionRate === 100 ? '100%' : formatPercent(conversionRate)}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center pl-3">
                                        <span className="text-xs text-text-muted dark:text-text-muted-dark italic">
                                            0 visitors matched this step
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Connector arrow between steps */}
                            {idx < funnelSteps.length - 1 && (
                                <div className="flex justify-center mt-1">
                                    <span className="text-text-muted/30 dark:text-text-muted-dark/30 text-xs">↓</span>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Summary row */}
                {funnelSteps.length >= 2 && funnelSteps[0].count > 0 && (
                    <div className="mt-2 pt-4 border-t border-border dark:border-border-dark flex items-center justify-between">
                        <span className="text-xs text-text-muted dark:text-text-muted-dark">Overall conversion</span>
                        <span className="text-sm font-bold text-accent tabular-nums">
                            {formatPercent(safeConversion(funnelSteps[0].count, funnelSteps[funnelSteps.length - 1].count))}
                        </span>
                    </div>
                )}
            </div>
        </ChartCard>
    );
}

export default memo(FunnelChart);
