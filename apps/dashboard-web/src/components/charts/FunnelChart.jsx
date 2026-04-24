import { memo } from 'react';
import { useThemeStore } from '../../store/useThemeStore';
import { formatNumber, formatPercent, CHART_COLORS } from '../../utils/formatters';
import ChartCard from '../ui/ChartCard';
import { useAnalytics } from '../../hooks/useAnalytics';

function FunnelChart() {
    const { data, loading, error } = useAnalytics('getFunnel');
    const theme = useThemeStore((s) => s.theme);
    const isDark = theme === 'dark';

    const steps = (data || []).map((d, idx) => ({
        name: d.step || d.name || `Step ${idx + 1}`,
        count: Number(d.visitors || d.count || d.value || 0),
    }));

    const maxCount = Math.max(...steps.map((s) => s.count), 1);

    return (
        <ChartCard
            title="Conversion Funnel"
            subtitle="User journey through key steps"
            loading={loading}
            error={error}
            empty={!steps.length}
        >
            <div className="space-y-3 py-2">
                {steps.map((step, idx) => {
                    const widthPercent = (step.count / maxCount) * 100;
                    const dropoff = idx > 0
                        ? ((steps[idx - 1].count - step.count) / steps[idx - 1].count * 100)
                        : 0;
                    const conversionRate = idx > 0
                        ? ((step.count / steps[0].count) * 100)
                        : 100;

                    return (
                        <div key={idx} className="group">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white"
                                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                                    >
                                        {idx + 1}
                                    </span>
                                    <span className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                        {step.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold">{formatNumber(step.count)}</span>
                                    {idx > 0 && (
                                        <span className="text-xs text-error font-medium">
                                            -{dropoff.toFixed(1)}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="h-8 bg-gray-50 dark:bg-white/[0.03] rounded-lg overflow-hidden relative">
                                <div
                                    className="h-full rounded-lg transition-all duration-700 ease-out relative flex items-center justify-end pr-3"
                                    style={{
                                        width: `${widthPercent}%`,
                                        backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                                        opacity: 0.85,
                                    }}
                                >
                                    <span className="text-xs font-semibold text-white">
                                        {formatPercent(conversionRate)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ChartCard>
    );
}

export default memo(FunnelChart);
