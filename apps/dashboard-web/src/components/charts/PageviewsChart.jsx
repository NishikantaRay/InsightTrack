import { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useThemeStore } from '../../store/useThemeStore';
import { formatDate, formatNumber } from '../../utils/formatters';
import ChartCard from '../ui/ChartCard';
import { useAnalytics } from '../../hooks/useAnalytics';

function PageviewsChart() {
  const { data, loading, error } = useAnalytics('getPageviews');
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';

  const chartData = data?.map((d) => ({
    date: d.date,
    pageviews: Number(d.pageviews || d.count || 0),
  })) || [];

  return (
    <ChartCard
      title="Pageviews Over Time"
      subtitle="Total page views per day"
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
              formatter={(value) => [formatNumber(value), 'Pageviews']}
              cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
            />
            <Bar
              dataKey="pageviews"
              fill="#6366F1"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export default memo(PageviewsChart);
