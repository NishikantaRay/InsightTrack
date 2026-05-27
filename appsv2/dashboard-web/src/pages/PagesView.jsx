import { useState, useEffect } from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { formatNumber, formatPercent } from '../utils/formatters';
import ChartCard from '../components/ui/ChartCard';
import DataTable from '../components/ui/DataTable';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import PageNote from '../components/ui/PageNote';
import FocusToggleButton from '../components/ui/FocusToggleButton';
import PageviewsChart from '../components/charts/PageviewsChart';
import PageActionsTable from '../components/PageActionsTable';
import { exportToCSV } from '../utils/exportUtils';
import { useFocusModeStore } from '../store/useFocusModeStore';
import { useDateFilterStore } from '../store/useDateFilterStore';
import { useSiteStore } from '../store/useSiteStore';
import { analyticsAPI } from '../services/api';
import { MousePointerClick, Map, X, ExternalLink, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PagesView() {
    const { data, loading, error } = useAnalytics('getTopPages', { params: { limit: 50 } });
    const { focusMode } = useFocusModeStore();
    const dateRange = useDateFilterStore((s) => s.dateRange);
    const customStart = useDateFilterStore((s) => s.customStart);
    const customEnd = useDateFilterStore((s) => s.customEnd);
    const siteId = useSiteStore((s) => s.siteId);

    const [selectedPage, setSelectedPage] = useState(null);
    const [actionsData, setActionsData] = useState([]);
    const [actionsLoading, setActionsLoading] = useState(false);

    const effectiveDateRange = dateRange === 'custom' && customStart && customEnd
        ? `custom:${customStart}:${customEnd}`
        : dateRange;

    useEffect(() => {
        if (!selectedPage || !siteId) return;
        setActionsLoading(true);
        setActionsData([]);
        analyticsAPI.getPageActions(siteId, effectiveDateRange, selectedPage)
            .then(res => setActionsData(res?.data || []))
            .catch(() => setActionsData([]))
            .finally(() => setActionsLoading(false));
    }, [selectedPage, siteId, effectiveDateRange]);

    const tableData = (data || []).map((d) => {
        const views = Number(d.views || d.pageviews || d.count || 0);
        return {
            page: d.path || d.page || d.url || '',
            views,
            visitors: Number(d.uniqueVisitors || d.visitors || d.unique_visitors || Math.round(views * 0.7)),
            percentage: Number(d.percentage || 0),
        };
    });

    // Calculate percentages if not provided
    const totalViews = tableData.reduce((sum, d) => sum + d.views, 0);
    if (totalViews > 0) {
        tableData.forEach((d) => {
            if (!d.percentage) d.percentage = (d.views / totalViews) * 100;
        });
    }

    const columns = [
        {
            key: 'page',
            label: 'Page',
            render: (val) => (
                <button
                    className="font-mono text-sm text-left hover:text-accent dark:hover:text-accent-light transition-colors flex items-center gap-1 group"
                    onClick={() => setSelectedPage(val === selectedPage ? null : val)}
                >
                    <span>{val}</span>
                    <ChevronRight className={`w-3 h-3 transition-transform ${selectedPage === val ? 'rotate-90 text-accent' : 'opacity-0 group-hover:opacity-50'}`} />
                </button>
            ),
        },
        {
            key: 'views',
            label: 'Views',
            render: (val) => formatNumber(val),
        },
        {
            key: 'visitors',
            label: 'Visitors',
            render: (val) => formatNumber(val),
        },
        {
            key: 'percentage',
            label: '% of Total',
            render: (val) => (
                <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(val, 100)}%` }} />
                    </div>
                    <span>{formatPercent(val)}</span>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                {!focusMode && (
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Pages</h1>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                            Performance of individual pages
                        </p>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <Link
                        to="/heatmap"
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border dark:border-border-dark text-sm text-text-secondary dark:text-text-secondary-dark hover:text-accent dark:hover:text-accent-light hover:border-accent dark:hover:border-accent transition-colors"
                    >
                        <Map className="w-4 h-4" />
                        <span>Visual Heatmap</span>
                    </Link>
                    <FocusToggleButton />
                </div>
            </div>

            {!focusMode && (
                <PageNote
                    title="What is Pages?"
                    summary="The Pages view shows you which pages on your website are getting the most traffic. Click any page row to see top clicked elements on that page."
                    details={[
                        { label: 'Views', text: 'Total number of times each page was loaded, including repeat visits by the same user.' },
                        { label: 'Visitors', text: 'Unique people who visited that page in the selected period.' },
                        { label: '% of Total', text: 'What proportion of your total site traffic this page accounts for. Useful for identifying your most important pages.' },
                        { label: 'Event Explorer', text: 'Click any page row to drill down into which buttons, links and elements were clicked most on that page.' },
                    ]}
                    businessTip="Your top 3 pages typically receive 50-70% of all traffic. Make sure those pages have clear calls-to-action and load fast. Any improvements there have outsized impact."
                    devTip="Sourced from GET /api/analytics/:siteId/top-pages. Click data comes from GET /api/analytics/:siteId/page-actions?path=<path>."
                />
            )}

            <PageviewsChart />

            <ChartCard
                title="All Pages"
                subtitle={`${tableData.length} pages tracked — click a row to explore click events`}
                loading={loading}
                error={error}
                empty={!tableData.length}
                onExport={() => exportToCSV(tableData, 'pages.csv')}
            >
                <DataTable columns={columns} data={tableData} />
            </ChartCard>

            {/* ─── Event Explorer drill-down ─────────────────────── */}
            {selectedPage && (
                <ChartCard
                    title={
                        <span className="flex items-center gap-2">
                            <MousePointerClick className="w-4 h-4 text-accent" />
                            <span>Event Explorer</span>
                            <span className="font-mono text-sm text-text-muted dark:text-text-muted-dark font-normal ml-1">
                                {selectedPage}
                            </span>
                        </span>
                    }
                    subtitle="Top clicked elements on this page"
                    loading={false}
                    error={null}
                    empty={false}
                    headerActions={
                        <div className="flex items-center gap-2">
                            <Link
                                to={`/heatmap?path=${encodeURIComponent(selectedPage)}`}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark hover:text-accent dark:hover:text-accent-light hover:border-accent dark:hover:border-accent transition-colors"
                            >
                                <Map className="w-3 h-3" />
                                Visual Heatmap
                            </Link>
                            <button
                                onClick={() => setSelectedPage(null)}
                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-text-muted dark:text-text-muted-dark"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    }
                    onExport={() => exportToCSV(actionsData, `actions-${selectedPage.replace(/\//g, '-')}.csv`)}
                >
                    <PageActionsTable
                        data={actionsData}
                        loading={actionsLoading}
                    />
                </ChartCard>
            )}
        </div>
    );
}
