import { Users, Eye, BarChart3, Clock, RefreshCw } from 'lucide-react';
import { useState, useCallback } from 'react';
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
import { useAnalytics } from '../hooks/useAnalytics';
import { formatNumber, formatDuration, formatPercent } from '../utils/formatters';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';

export default function Dashboard() {
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);

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
            {/* Page header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                        Overview of your website analytics &mdash;
                        <span className="ml-1 text-xs opacity-60">auto-refreshes every 30s · last updated {lastUpdated.toLocaleTimeString()}</span>
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-accent/10 hover:bg-accent/20 dark:bg-accent/20 dark:hover:bg-accent/30 text-accent transition-colors"
                    title="Refresh dashboard"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
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
                    />
                    <MetricCard
                        title="Pageviews"
                        value={formatNumber(kpi.totalPageviews ?? kpi.pageviews)}
                        trend={kpi.pageviewsTrend}
                        trendLabel="vs previous period"
                        icon={Eye}
                        sparklineData={sparklinePageviews}
                        color="#8B5CF6"
                    />
                    <MetricCard
                        title="Bounce Rate"
                        value={formatPercent(kpi.bounceRate)}
                        trend={kpi.bounceRateTrend}
                        trendLabel="vs previous period"
                        icon={BarChart3}
                        sparklineData={sparklineBounceRate}
                        color="#06B6D4"
                    />
                    <MetricCard
                        title="Avg. Session"
                        value={kpi.avgSessionDuration || formatDuration(kpi.avgSession)}
                        trend={kpi.sessionTrend}
                        trendLabel="vs previous period"
                        icon={Clock}
                        sparklineData={sparklineAvgSession}
                        color="#10B981"
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
                    <FunnelChart />
                </div>
            </ErrorBoundary>
        </div>
    );
}
