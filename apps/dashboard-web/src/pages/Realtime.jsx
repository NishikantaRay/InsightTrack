import { Activity, Users, Globe, Monitor, Radio } from 'lucide-react';
import { useRealtime, useRealtimeEventStream } from '../hooks/useAnalytics';
import { formatNumber } from '../utils/formatters';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import VisitorMap from '../components/charts/VisitorMap';
import EventStream from '../components/realtime/EventStream';

export default function Realtime() {
    const { data, loading } = useRealtime();
    const { data: eventStreamData } = useRealtimeEventStream();

    const activeVisitors = data?.activeVisitors ?? 0;
    const topPages = data?.topPages || [];
    const devices = data?.devices || {};
    const countries = data?.countries || [];
    const activeEvents = eventStreamData || [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Realtime</h1>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                    Live activity on your website
                </p>
            </div>

            {loading ? (
                <LoadingSkeleton type="page" />
            ) : (
                <>
                    {/* Live counter */}
                    <div className="card text-center py-12">
                        <div className="inline-flex items-center gap-3 mb-2">
                            <span className="relative flex h-4 w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-success" />
                            </span>
                            <span className="text-lg font-medium text-text-secondary dark:text-text-secondary-dark">
                                Active right now
                            </span>
                        </div>
                        <p className="text-6xl font-bold text-accent">{activeVisitors}</p>
                        <p className="text-sm text-text-muted dark:text-text-muted-dark mt-2">
                            visitors in the last 5 minutes
                        </p>
                    </div>

                    {/* Live visitor map */}
                    <div className="card">
                        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                            <Globe className="w-4 h-4 text-accent" />
                            Live Visitor Map
                        </h3>
                        {countries.length > 0 || activeEvents.length > 0 ? (
                            <VisitorMap countries={countries} activeVisitors={activeEvents} />
                        ) : (
                            <p className="text-sm text-text-muted dark:text-text-muted-dark py-8 text-center">
                                No geographic data available
                            </p>
                        )}
                    </div>

                    {/* Real-time event stream */}
                    <div className="card">
                        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                            <Radio className="w-4 h-4 text-accent" />
                            Live Event Stream
                        </h3>
                        <EventStream />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Active pages */}
                        <div className="card">
                            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                <Globe className="w-4 h-4 text-accent" />
                                Active Pages
                            </h3>
                            <div className="space-y-2">
                                {topPages.length ? topPages.map((page, i) => (
                                    <div key={i} className="flex items-center justify-between py-1.5">
                                        <span className="text-sm font-mono text-text-primary dark:text-text-primary-dark truncate max-w-[70%]">
                                            {page.path || page.page}
                                        </span>
                                        <span className="text-sm font-medium text-accent">
                                            {page.visitors || page.count} visitors
                                        </span>
                                    </div>
                                )) : (
                                    <p className="text-sm text-text-muted dark:text-text-muted-dark py-4 text-center">
                                        No active pages
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Device & country breakdown */}
                        <div className="card">
                            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                <Monitor className="w-4 h-4 text-accent" />
                                Active Visitors Info
                            </h3>
                            {typeof devices === 'object' && Object.keys(devices).length > 0 ? (
                                <div className="space-y-3">
                                    {Object.entries(devices).map(([device, count]) => (
                                        <div key={device} className="flex items-center justify-between">
                                            <span className="text-sm">{device}</span>
                                            <span className="text-sm font-medium">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-text-muted dark:text-text-muted-dark py-4 text-center">
                                    No device data available
                                </p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
