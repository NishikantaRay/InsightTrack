import { useState } from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import ChartCard from '../components/ui/ChartCard';
import DataTable from '../components/ui/DataTable';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import MetricCard from '../components/ui/MetricCard';
import PageNote from '../components/ui/PageNote';
import FocusToggleButton from '../components/ui/FocusToggleButton';
import { exportToCSV } from '../utils/exportUtils';
import { useFocusModeStore } from '../store/useFocusModeStore';
import {
    ArrowDown,
    MousePointerClick,
    AlertTriangle,
    Clock,
} from 'lucide-react';

function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Scroll Depth Table ──────────────────────────────────────────

const scrollColumns = [
    {
        key: 'path',
        label: 'Page',
        render: (val) => <span className="font-mono text-sm">{val}</span>,
    },
    {
        key: 'avgDepth',
        label: 'Avg Depth',
        render: (val) => (
            <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${Math.min(val, 100)}%` }}
                    />
                </div>
                <span className="text-xs">{val}%</span>
            </div>
        ),
    },
    { key: 'reached25', label: '25%' },
    { key: 'reached50', label: '50%' },
    { key: 'reached75', label: '75%' },
    { key: 'reached100', label: '100%' },
];

// ─── Heatmap Summary Table ───────────────────────────────────────

const heatmapColumns = [
    {
        key: 'path',
        label: 'Page',
        render: (val) => <span className="font-mono text-sm">{val}</span>,
    },
    {
        key: 'selector',
        label: 'Element',
        render: (val) => (
            <span className="font-mono text-xs text-text-muted dark:text-text-muted-dark truncate max-w-[200px] inline-block">
                {val}
            </span>
        ),
    },
    { key: 'clicks', label: 'Clicks' },
];

// ─── Rage Click Table ────────────────────────────────────────────

const rageColumns = [
    {
        key: 'path',
        label: 'Page',
        render: (val) => <span className="font-mono text-sm">{val}</span>,
    },
    {
        key: 'selector',
        label: 'Element',
        render: (val) => (
            <span className="font-mono text-xs text-red-500 dark:text-red-400 truncate max-w-[200px] inline-block">
                {val}
            </span>
        ),
    },
    { key: 'incidents', label: 'Incidents' },
    { key: 'totalClicks', label: 'Total Clicks' },
];

// ─── Time on Page Table ──────────────────────────────────────────

const timeColumns = [
    {
        key: 'path',
        label: 'Page',
        render: (val) => <span className="font-mono text-sm">{val}</span>,
    },
    {
        key: 'avgTime',
        label: 'Avg Time',
        render: (val) => formatTime(val),
    },
    {
        key: 'medianTime',
        label: 'Median',
        render: (val) => formatTime(val),
    },
    {
        key: 'minTime',
        label: 'Min',
        render: (val) => formatTime(val),
    },
    {
        key: 'maxTime',
        label: 'Max',
        render: (val) => formatTime(val),
    },
    { key: 'samples', label: 'Samples' },
];

// ─── Main Page ───────────────────────────────────────────────────

export default function Engagement() {
    const [activeTab, setActiveTab] = useState('scroll');
    const { focusMode } = useFocusModeStore();

    const { data: summary, loading: summaryLoading } = useAnalytics('getEngagementSummary');
    const { data: scrollData, loading: scrollLoading } = useAnalytics('getScrollDepth');
    const { data: heatmapData, loading: heatmapLoading } = useAnalytics('getHeatmapSummary');
    const { data: rageData, loading: rageLoading } = useAnalytics('getRageClicks');
    const { data: timeData, loading: timeLoading } = useAnalytics('getTimeOnPage');

    const tabs = [
        { id: 'scroll', label: 'Scroll Depth', icon: ArrowDown },
        { id: 'heatmap', label: 'Click Heatmap', icon: MousePointerClick },
        { id: 'rage', label: 'Rage Clicks', icon: AlertTriangle },
        { id: 'time', label: 'Time on Page', icon: Clock },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                {!focusMode && (
                    <div>
                        <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                            Engagement
                        </h1>
                        <p className="text-sm text-text-muted dark:text-text-muted-dark mt-1">
                            Understand how visitors interact with your pages
                        </p>
                    </div>
                )}
                <FocusToggleButton />
            </div>

            {!focusMode && (
                <>
                    {/* Page Header */}
                    <PageNote
                title="What is Engagement?"
                summary="Engagement measures the quality of visitor interactions — how far they scroll, where they click, whether they click the same element in frustration, and how long they spend on each page."
                details={[
                    { label: 'Scroll Depth', text: 'Tracks how far down each page visitors scroll. If most visitors only see 25% of your page, everything below the fold is invisible to them.' },
                    { label: 'Click Heatmap', text: 'Shows which elements get the most clicks. Helps identify what visitors find interesting and whether important buttons are being ignored.' },
                    { label: 'Rage Clicks', text: 'Detects when a visitor clicks the same element rapidly — a sign of frustration, usually caused by a broken link, unresponsive button, or confusing UI.' },
                    { label: 'Time on Page', text: 'Measures how long visitors spend on individual pages. Low time on a long article suggests your content isn’t compelling enough.' },
                ]}
                businessTip="Rage clicks are your fastest wins. Each one points to a broken or confusing element. Fix those first, then use scroll depth to decide where to put your most important calls-to-action."
                devTip="Scroll events fire at 25/50/75/100% thresholds via IntersectionObserver in the tracking script. Click coordinates are captured on document click and stored as events with type=click. Rage = 3+ clicks in 500ms."
                    />
                </>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {summaryLoading ? (
                    Array.from({ length: 4 }).map((_, i) => <LoadingSkeleton key={i} type="card" />)
                ) : (
                    <>
                        <MetricCard
                            title="Avg Scroll Depth"
                            value={`${summary?.avgScrollDepth || 0}%`}
                            icon={ArrowDown}
                            color="#6366F1"
                        />
                        <MetricCard
                            title="Avg Time on Page"
                            value={formatTime(summary?.avgTimeOnPage || 0)}
                            icon={Clock}
                            color="#10B981"
                        />
                        <MetricCard
                            title="Total Clicks Tracked"
                            value={summary?.totalClicks?.toLocaleString() || '0'}
                            icon={MousePointerClick}
                            color="#3B82F6"
                        />
                        <MetricCard
                            title="Rage Click Incidents"
                            value={summary?.totalRageClicks?.toLocaleString() || '0'}
                            icon={AlertTriangle}
                            color={summary?.totalRageClicks > 0 ? '#EF4444' : '#10B981'}
                        />
                    </>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-lg w-fit">
                {tabs.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
                            ${activeTab === id
                                ? 'bg-white dark:bg-card-dark text-accent shadow-sm'
                                : 'text-text-muted dark:text-text-muted-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                            }`}
                    >
                        <Icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'scroll' && (
                <ChartCard
                    title="Scroll Depth by Page"
                    subtitle="How far visitors scroll on each page (milestone: 25%, 50%, 75%, 100%)"
                    loading={scrollLoading}
                    empty={!scrollData?.length}
                    onExport={() => exportToCSV(scrollData, 'scroll-depth')}
                >
                    <DataTable
                        columns={scrollColumns}
                        data={scrollData || []}
                        searchable
                        paginated
                        pageSize={10}
                        emptyMessage="No scroll depth data yet. Data appears once visitors scroll your pages."
                    />
                </ChartCard>
            )}

            {activeTab === 'heatmap' && (
                <ChartCard
                    title="Top Clicked Elements"
                    subtitle="Most clicked elements across your pages"
                    loading={heatmapLoading}
                    empty={!heatmapData?.length}
                    onExport={() => exportToCSV(heatmapData, 'heatmap-summary')}
                >
                    <DataTable
                        columns={heatmapColumns}
                        data={heatmapData || []}
                        searchable
                        paginated
                        pageSize={10}
                        emptyMessage="No click heatmap data yet. Data appears once visitors click on your pages."
                    />
                </ChartCard>
            )}

            {activeTab === 'rage' && (
                <ChartCard
                    title="Rage Click Incidents"
                    subtitle="Repeated rapid clicks indicating user frustration"
                    loading={rageLoading}
                    empty={!rageData?.length}
                    onExport={() => exportToCSV(rageData, 'rage-clicks')}
                >
                    {rageData?.length > 0 ? (
                        <DataTable
                            columns={rageColumns}
                            data={rageData || []}
                            searchable
                            paginated
                            pageSize={10}
                            emptyMessage="No rage clicks detected."
                        />
                    ) : (
                        <div className="py-12 text-center">
                            <AlertTriangle className="w-10 h-10 mx-auto text-green-400 mb-3" />
                            <p className="text-sm text-text-muted dark:text-text-muted-dark">
                                No rage clicks detected — your users seem happy!
                            </p>
                        </div>
                    )}
                </ChartCard>
            )}

            {activeTab === 'time' && (
                <ChartCard
                    title="Time on Page"
                    subtitle="Average read time per page"
                    loading={timeLoading}
                    empty={!timeData?.length}
                    onExport={() => exportToCSV(timeData, 'time-on-page')}
                >
                    <DataTable
                        columns={timeColumns}
                        data={timeData || []}
                        searchable
                        paginated
                        pageSize={10}
                        emptyMessage="No time-on-page data yet. Data appears once visitors leave pages."
                    />
                </ChartCard>
            )}
        </div>
    );
}
