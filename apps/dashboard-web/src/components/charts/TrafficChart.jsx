import { memo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend,
} from 'recharts';
import { useThemeStore } from '../../store/useThemeStore';
import { useDateFilterStore } from '../../store/useDateFilterStore';
import { formatDate, formatNumber } from '../../utils/formatters';
import ChartCard from '../ui/ChartCard';
import { useAnalytics } from '../../hooks/useAnalytics';

function TrafficChart() {
    const compareMode = useDateFilterStore((s) => s.compareMode);
    const { data, loading, error } = useAnalytics(compareMode ? 'getComparison' : 'getTraffic');
    const theme = useThemeStore((s) => s.theme);
    const isDark = theme === 'dark';

    const chartData = compareMode
        ? (data?.merged || []).map((d) => ({
            date: d.date,
            visitors: d.visitors,
            sessions: d.sessions,
            prevVisitors: d.prevVisitors,
            prevSessions: d.prevSessions,
        }))
        : (data?.map?.((d) => ({
            date: d.date,
            visitors: Number(d.visitors || d.unique_visitors || 0),
            sessions: Number(d.sessions || 0),
        })) || []);

    const subtitle = compareMode
        ? `Current vs previous period`
        : 'Unique visitors and sessions per day';

    return (
        <ChartCard
            title="Traffic Over Time"
            subtitle={subtitle}
            loading={loading}
            error={error}
            empty={!chartData.length}
        >
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="visitorsGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366F1" stopOpacity={0.15} />
                                <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="sessionsGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.1} />
                                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={isDark ? '#2D3348' : '#E2E8F0'}
                            vertical={false}
                        />
                        <XAxis
                            dataKey="date"
                            tickFormatter={formatDate}
                            tick={{ fontSize: 12, fill: isDark ? '#94A3B8' : '#64748B' }}
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
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            }}
                            labelFormatter={formatDate}
                            formatter={(value, name) => {
                                const labels = {
                                    visitors: 'Visitors',
                                    sessions: 'Sessions',
                                    prevVisitors: 'Prev Visitors',
                                    prevSessions: 'Prev Sessions',
                                };
                                return [formatNumber(value), labels[name] || name];
                            }}
                        />
                        <Legend
                            verticalAlign="top"
                            height={36}
                            iconType="circle"
                            iconSize={8}
                            formatter={(value) => {
                                const labels = {
                                    visitors: 'Visitors',
                                    sessions: 'Sessions',
                                    prevVisitors: 'Prev Visitors',
                                    prevSessions: 'Prev Sessions',
                                };
                                return (
                                    <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                        {labels[value] || value}
                                    </span>
                                );
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="visitors"
                            stroke="#6366F1"
                            strokeWidth={2}
                            fill="url(#visitorsGrad)"
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 2, fill: isDark ? '#1E2130' : '#fff' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="sessions"
                            stroke="#8B5CF6"
                            strokeWidth={2}
                            fill="url(#sessionsGrad)"
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 2, fill: isDark ? '#1E2130' : '#fff' }}
                        />
                        {compareMode && (
                            <>
                                <Area
                                    type="monotone"
                                    dataKey="prevVisitors"
                                    stroke="#6366F1"
                                    strokeWidth={1.5}
                                    strokeDasharray="5 5"
                                    fill="none"
                                    dot={false}
                                    activeDot={{ r: 3, strokeWidth: 1 }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="prevSessions"
                                    stroke="#8B5CF6"
                                    strokeWidth={1.5}
                                    strokeDasharray="5 5"
                                    fill="none"
                                    dot={false}
                                    activeDot={{ r: 3, strokeWidth: 1 }}
                                />
                            </>
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </ChartCard>
    );
}

export default memo(TrafficChart);
