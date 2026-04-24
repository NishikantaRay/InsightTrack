import { memo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useThemeStore } from '../../store/useThemeStore';
import { formatNumber } from '../../utils/formatters';
import ChartCard from '../ui/ChartCard';
import { useAnalytics } from '../../hooks/useAnalytics';

const DEVICE_COLORS = {
    Desktop: '#6366F1',
    Mobile: '#06B6D4',
    Tablet: '#F59E0B',
};

function DevicesChart() {
    const { data, loading, error } = useAnalytics('getDevices');
    const theme = useThemeStore((s) => s.theme);
    const isDark = theme === 'dark';

    const chartData = (data || []).map((d) => ({
        name: d.device || d.name || 'Unknown',
        value: Number(d.visitors || d.count || d.value || 0),
    }));

    const total = chartData.reduce((sum, d) => sum + d.value, 0);

    return (
        <ChartCard
            title="Devices"
            subtitle="Visitor device breakdown"
            loading={loading}
            error={error}
            empty={!chartData.length}
        >
            <div className="flex items-center gap-6">
                <div className="h-56 w-56 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={3}
                                dataKey="value"
                            >
                                {chartData.map((entry) => (
                                    <Cell key={entry.name} fill={DEVICE_COLORS[entry.name] || '#94A3B8'} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: isDark ? '#1E2130' : '#FFFFFF',
                                    border: `1px solid ${isDark ? '#2D3348' : '#E2E8F0'}`,
                                    borderRadius: '12px',
                                    fontSize: '13px',
                                }}
                                formatter={(value) => [formatNumber(value), 'Visitors']}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                    {chartData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: DEVICE_COLORS[item.name] || '#94A3B8' }}
                                />
                                <span className="text-sm text-text-primary dark:text-text-primary-dark">{item.name}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-medium">{formatNumber(item.value)}</span>
                                <span className="text-xs text-text-muted dark:text-text-muted-dark ml-2">
                                    {total > 0 ? `${((item.value / total) * 100).toFixed(1)}%` : '0%'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </ChartCard>
    );
}

export default memo(DevicesChart);
