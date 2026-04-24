import { memo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, Cell,
} from 'recharts';
import { useThemeStore } from '../../store/useThemeStore';
import { formatNumber } from '../../utils/formatters';
import ChartCard from '../ui/ChartCard';
import { useAnalytics } from '../../hooks/useAnalytics';
import { exportToCSV } from '../../utils/exportUtils';

function TopPagesChart() {
    const { data, loading, error } = useAnalytics('getTopPages');
    const theme = useThemeStore((s) => s.theme);
    const isDark = theme === 'dark';

    const chartData = (data || []).slice(0, 8).map((d) => ({
        page: d.path || d.page || d.url || '',
        views: Number(d.views || d.pageviews || d.count || 0),
    }));

    const maxViews = Math.max(...chartData.map((d) => d.views), 1);

    return (
        <ChartCard
            title="Top Pages"
            subtitle="Most visited pages"
            loading={loading}
            error={error}
            empty={!chartData.length}
            onExport={() => exportToCSV(chartData, 'top-pages.csv')}
        >
            <div className="space-y-2.5">
                {chartData.map((item, idx) => (
                    <div key={idx} className="group">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-text-primary dark:text-text-primary-dark truncate max-w-[70%] font-mono">
                                {item.page}
                            </span>
                            <span className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                                {formatNumber(item.views)}
                            </span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-accent rounded-full transition-all duration-500 group-hover:bg-accent-light"
                                style={{ width: `${(item.views / maxViews) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </ChartCard>
    );
}

export default memo(TopPagesChart);
