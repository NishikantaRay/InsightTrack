import { memo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { useThemeStore } from '../../store/useThemeStore';
import { formatNumber } from '../../utils/formatters';
import ChartCard from '../ui/ChartCard';
import { useAnalytics } from '../../hooks/useAnalytics';

function SessionsChart() {
    const { data, loading, error } = useAnalytics('getSessions');
    const theme = useThemeStore((s) => s.theme);
    const isDark = theme === 'dark';

    const chartData = (data || []).map((d) => ({
        bucket: d.bucket || d.range || d.duration || '',
        count: Number(d.sessions || d.count || 0),
    }));

    return (
        <ChartCard
            title="Session Duration"
            subtitle="Distribution of session lengths"
            loading={loading}
            error={error}
            empty={!chartData.length}
        >
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={isDark ? '#2D3348' : '#E2E8F0'}
                            vertical={false}
                        />
                        <XAxis
                            dataKey="bucket"
                            tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#64748B' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tickFormatter={formatNumber}
                            tick={{ fontSize: 12, fill: isDark ? '#94A3B8' : '#64748B' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isDark ? '#1E2130' : '#FFFFFF',
                                border: `1px solid ${isDark ? '#2D3348' : '#E2E8F0'}`,
                                borderRadius: '12px',
                                fontSize: '13px',
                            }}
                            formatter={(value) => [formatNumber(value), 'Sessions']}
                        />
                        <Bar
                            dataKey="count"
                            fill="#06B6D4"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </ChartCard>
    );
}

export default memo(SessionsChart);
