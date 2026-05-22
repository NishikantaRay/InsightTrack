import { Users, Eye, BarChart3, Clock, RefreshCw, BookmarkCheck, X } from 'lucide-react';
import PageNote from '../components/ui/PageNote';
import FocusToggleButton from '../components/ui/FocusToggleButton';
import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import MetricCard from '../components/ui/MetricCard';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import TrafficChart from '../components/charts/TrafficChart';
import PageviewsChart from '../components/charts/PageviewsChart';
import TopPagesChart from '../components/charts/TopPagesChart';
import SourcesChart from '../components/charts/SourcesChart';
import DevicesChart from '../components/charts/DevicesChart';
import CountriesTable from '../components/charts/CountriesTable';
import FunnelChart from '../components/charts/FunnelChart';
import SessionsChart from '../components/charts/SessionsChart';
import VisitorMap from '../components/charts/VisitorMap';
import { useAnalytics } from '../hooks/useAnalytics';
import { formatNumber, formatDuration, formatPercent } from '../utils/formatters';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { useFunnelStore } from '../store/useFunnelStore';
import { useFocusModeStore } from '../store/useFocusModeStore';

export default function Dashboard() {
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { savedSteps, clearSavedFunnel } = useFunnelStore();
    const { focusMode } = useFocusModeStore();

    const { data: kpiData, loading: kpiLoading, refetch: refetchKPI } = useAnalytics('getKPIs');
    const { data: trafficData, refetch: refetchTraffic } = useAnalytics('getTraffic');
    const { data: bounceRateTrendData, refetch: refetchBounce } = useAnalytics('getBounceRateTrend');
    const { data: avgSessionTrendData, refetch: refetchSession } = useAnalytics('getAvgSessionTrend');

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        setLastUpdated(new Date());
        Promise.all([refetchKPI(), refetchTraffic(), refetchBounce(), refetchSession()])
            .finally(() => setIsRefreshing(false));
    }, [refetchKPI, refetchTraffic, refetchBounce, refetchSession]);

    // Build sparkline data from traffic
    const sparklineVisitors = (trafficData || []).map((d) => ({
        value: Number(d.visitors || d.unique_visitors || 0),
    }));
    const sparklinePageviews = (trafficData || []).map((d) => ({
        value: Number(d.pageviews || 0),
    }));
    const sparklineBounceRate = (bounceRateTrendData || []).map((d) => ({
        value: Number(d.bounceRate || 0),
    }));
    const sparklineAvgSession = (avgSessionTrendData || []).map((d) => ({
        value: Number(d.avgDuration || 0),
    }));

    const kpi = kpiData || {};

    return (
        <div className="space-y-6">
            {!focusMode && (
                <PageNote
                    title="What is the Dashboard?"
                    summary="Your Dashboard is a real-time summary of everything happening on your website. It shows unique visitors, pageviews, bounce rate, and average session duration — all in one place."
                    details={[
                        { label: 'Unique Visitors', text: 'The number of distinct people who visited your site in the selected period. Each person is counted once regardless of how many pages they viewed.' },
                        { label: 'Pageviews', text: 'Total number of individual pages loaded. One visitor can generate many pageviews in a single session.' },
                        { label: 'Bounce Rate', text: 'Percentage of visitors who left after viewing only one page. A high bounce rate can indicate a mismatch between ad copy and landing page content.' },
                        { label: 'Avg Session Duration', text: 'How long visitors stay on your site on average. Longer sessions usually mean more engaged audiences.' },
                    ]}
                    businessTip="Focus on the bounce rate and avg session duration together. A low bounce + long session = your audience finds real value in your content."
                    devTip="KPI data comes from GET /api/analytics/:siteId/kpi. Sparklines use /traffic, /bounce-rate-trend, and /avg-session-trend endpoints. All support ?from=&to= date params."
                />
            )}

            {/* Page header */}
            <div className="flex items-start justify-between">
                {!focusMode && (
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                            Overview of your website analytics &mdash;
                            <span className="ml-1 text-xs opacity-60">auto-refreshes every 30s · last updated {lastUpdated.toLocaleTimeString()}</span>
                        </p>
                    </div>
                )}
                <div className="flex items-center gap-2 shrink-0">
                    <FocusToggleButton />
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-accent/10 hover:bg-accent/20 dark:bg-accent/20 dark:hover:bg-accent/30 text-accent transition-colors"
                        title="Refresh dashboard"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            {kpiLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="card">
                            <LoadingSkeleton type="card" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        title="Total Visitors"
                        value={formatNumber(kpi.totalVisitors ?? kpi.visitors)}
                        trend={kpi.visitorsTrend}
                        trendLabel="vs previous period"
                        icon={Users}
                        sparklineData={sparklineVisitors}
                        color="#6366F1"
                        info="Unique visitors in the selected period. Each person is counted once, even if they visit multiple pages."
                    />
                    <MetricCard
                        title="Pageviews"
                        value={formatNumber(kpi.totalPageviews ?? kpi.pageviews)}
                        trend={kpi.pageviewsTrend}
                        trendLabel="vs previous period"
                        icon={Eye}
                        sparklineData={sparklinePageviews}
                        color="#8B5CF6"
                        info="Total number of page loads. One visitor can generate many pageviews. Useful for measuring content consumption."
                    />
                    <MetricCard
                        title="Bounce Rate"
                        value={formatPercent(kpi.bounceRate)}
                        trend={kpi.bounceRateTrend}
                        trendLabel="vs previous period"
                        icon={BarChart3}
                        sparklineData={sparklineBounceRate}
                        color="#06B6D4"
                        info="% of sessions where the visitor left after viewing only one page. Lower is generally better, but some pages (like contact pages) naturally have high bounce rates."
                    />
                    <MetricCard
                        title="Avg. Session"
                        value={kpi.avgSessionDuration || formatDuration(kpi.avgSession)}
                        trend={kpi.sessionTrend}
                        trendLabel="vs previous period"
                        icon={Clock}
                        sparklineData={sparklineAvgSession}
                        color="#10B981"
                        info="Average time visitors spend on your site per session. Longer sessions indicate higher engagement."
                    />
                </div>
            )}

            {/* Main charts row */}
            <ErrorBoundary fallbackMessage="Failed to load charts.">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <TrafficChart />
                    <PageviewsChart />
                </div>
            </ErrorBoundary>

            {/* Secondary charts */}
            <ErrorBoundary fallbackMessage="Failed to load charts.">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <TopPagesChart />
                    <SourcesChart />
                </div>
            </ErrorBoundary>

            {/* Tertiary charts */}
            <ErrorBoundary fallbackMessage="Failed to load charts.">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <DevicesChart />
                    <SessionsChart />
                </div>
            </ErrorBoundary>

            {/* Countries and Funnel */}
            <ErrorBoundary fallbackMessage="Failed to load charts.">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <CountriesTable />
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between px-1">
                            {savedSteps ? (
                                <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
                                    <BookmarkCheck className="w-3.5 h-3.5" />
                                    Saved funnel
                                </span>
                            ) : (
                                <span className="text-xs text-text-muted dark:text-text-muted-dark">
                                    Default funnel
                                </span>
                            )}
                            <div className="flex items-center gap-3">
                                {savedSteps && (
                                    <button
                                        onClick={clearSavedFunnel}
                                        className="flex items-center gap-1 text-xs text-text-muted hover:text-red-500 transition-colors"
                                        title="Remove saved funnel"
                                    >
                                        <X className="w-3 h-3" /> Clear
                                    </button>
                                )}
                                <Link
                                    to="/funnels"
                                    className="text-xs text-accent hover:underline"
                                >
                                    Configure →
                                </Link>
                            </div>
                        </div>
                        <FunnelChart steps={savedSteps || undefined} />
                    </div>
                </div>
            </ErrorBoundary>

            {/* Realtime Visitor Map */}
            <ErrorBoundary fallbackMessage="Failed to load visitor map.">
                <DashboardVisitorMap />
            </ErrorBoundary>
        </div>
    );
}

function DashboardVisitorMap() {
    const { data: countriesData } = useAnalytics('getCountries');
    const countries = (countriesData || []).map(d => ({
        country: d.country || d.name || 'Unknown',
        visitors: Number(d.visitors || d.count || 0),
        percentage: Number(d.percentage || 0),
    }));
    return <VisitorMap countries={countries} />;
}
