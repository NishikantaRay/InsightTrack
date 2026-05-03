import { useState, useEffect, useRef } from 'react';
import { Eye, MousePointer, ArrowDown, Clock, Globe, Monitor, Smartphone, Tablet } from 'lucide-react';
import { analyticsAPI } from '../../services/api';
import { useSiteStore } from '../../store/useSiteStore';

const EVENT_ICONS = {
    pageview: Eye,
    click: MousePointer,
    scroll_depth: ArrowDown,
    time_on_page: Clock,
};

const DEVICE_ICONS = {
    Desktop: Monitor,
    Mobile: Smartphone,
    Tablet: Tablet,
};

const EVENT_COLORS = {
    pageview: 'bg-blue-500',
    click: 'bg-green-500',
    scroll_depth: 'bg-purple-500',
    time_on_page: 'bg-amber-500',
};

function timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
}

function EventRow({ event, isNew }) {
    const Icon = EVENT_ICONS[event.type] || Eye;
    const DeviceIcon = DEVICE_ICONS[event.device] || Monitor;
    const colorClass = EVENT_COLORS[event.type] || 'bg-gray-500';

    return (
        <div className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all duration-500 ${isNew ? 'bg-accent/5 dark:bg-accent/10' : ''}`}>
            {/* Event type indicator */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full ${colorClass} bg-opacity-15 dark:bg-opacity-25 flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${colorClass.replace('bg-', 'text-')}`} />
            </div>

            {/* Event details */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary dark:text-text-secondary-dark">
                        {event.type.replace('_', ' ')}
                    </span>
                    {event.utmSource && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                            {event.utmSource}
                        </span>
                    )}
                </div>
                <p className="text-sm font-mono text-text-primary dark:text-text-primary-dark truncate">
                    {event.path}
                </p>
            </div>

            {/* Metadata */}
            <div className="flex-shrink-0 flex items-center gap-3 text-text-muted dark:text-text-muted-dark">
                <div className="hidden sm:flex items-center gap-1" title={event.device}>
                    <DeviceIcon className="w-3.5 h-3.5" />
                </div>
                <div className="hidden md:flex items-center gap-1" title={event.country}>
                    <Globe className="w-3.5 h-3.5" />
                    <span className="text-xs">{event.country}</span>
                </div>
                <span className="text-xs whitespace-nowrap w-14 text-right">
                    {timeAgo(event.timestamp)}
                </span>
            </div>
        </div>
    );
}

export default function EventStream() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [paused, setPaused] = useState(false);
    const [newIds, setNewIds] = useState(new Set());
    const siteId = useSiteStore((s) => s.siteId);
    const prevIdsRef = useRef(new Set());
    const containerRef = useRef(null);

    useEffect(() => {
        if (!siteId) return;

        const fetchEvents = async () => {
            try {
                const result = await analyticsAPI.getRealtimeEventStream(siteId, 50);
                const data = result?.data ?? result;
                if (Array.isArray(data)) {
                    // Detect new events
                    const incoming = new Set(data.map(e => e.id));
                    const fresh = new Set();
                    incoming.forEach(id => {
                        if (!prevIdsRef.current.has(id)) fresh.add(id);
                    });
                    prevIdsRef.current = incoming;

                    if (!paused) {
                        setEvents(data);
                        setNewIds(fresh);
                        // Clear "new" highlight after animation
                        if (fresh.size > 0) {
                            setTimeout(() => setNewIds(new Set()), 2000);
                        }
                    }
                }
                setLoading(false);
            } catch {
                setLoading(false);
            }
        };

        fetchEvents();
        const interval = setInterval(fetchEvents, 10000);
        return () => clearInterval(interval);
    }, [siteId, paused]);

    if (loading) {
        return (
            <div className="animate-pulse space-y-3">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 px-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48" />
                        </div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div>
            {/* Controls */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {!paused && (
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
                        </span>
                    )}
                    <span className="text-xs text-text-muted dark:text-text-muted-dark">
                        {paused ? 'Paused' : 'Live'} · {events.length} events
                    </span>
                </div>
                <button
                    onClick={() => setPaused(!paused)}
                    className="text-xs px-2.5 py-1 rounded-md border border-border dark:border-border-dark
                               hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors"
                >
                    {paused ? 'Resume' : 'Pause'}
                </button>
            </div>

            {/* Event list */}
            <div ref={containerRef} className="space-y-0.5 max-h-[480px] overflow-y-auto">
                {events.length > 0 ? (
                    events.map((event) => (
                        <EventRow
                            key={event.id}
                            event={event}
                            isNew={newIds.has(event.id)}
                        />
                    ))
                ) : (
                    <p className="text-sm text-text-muted dark:text-text-muted-dark py-8 text-center">
                        No events in the last 5 minutes
                    </p>
                )}
            </div>
        </div>
    );
}
