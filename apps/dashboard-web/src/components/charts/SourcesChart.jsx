import { memo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useThemeStore } from '../../store/useThemeStore';
import { formatNumber, CHART_COLORS } from '../../utils/formatters';
import ChartCard from '../ui/ChartCard';
import { useAnalytics } from '../../hooks/useAnalytics';

const RADIAN = Math.PI / 180;

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
}

function SourcesChart() {
    const { data, loading, error } = useAnalytics('getSources');
    const theme = useThemeStore((s) => s.theme);
    const isDark = theme === 'dark';

    const chartData = (data || []).map((d) => ({
        name: d.source || d.referrer || d.name || 'Unknown',
        value: Number(d.visitors || d.count || d.value || 0),
    }));

    return (
        <ChartCard
            title="Traffic Sources"
            subtitle="Where your visitors come from"
            loading={loading}
            error={error}
            empty={!chartData.length}
        >
            <div className="h-72 flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            labelLine={false}
                            label={renderCustomLabel}
                        >
                            {chartData.map((_, idx) => (
                                <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isDark ? '#1E2130' : '#FFFFFF',
                                border: `1px solid ${isDark ? '#2D3348' : '#E2E8F0'}`,
                                borderRadius: '12px',
                                fontSize: '13px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            }}
                            formatter={(value) => [formatNumber(value), 'Visitors']}
                        />
                        <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            iconSize={8}
                            formatter={(value) => (
                                <span className="text-xs text-text-secondary dark:text-text-secondary-dark ml-1">{value}</span>
                            )}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </ChartCard>
    );
}

export default memo(SourcesChart);
