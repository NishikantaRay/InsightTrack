import { useState, useRef, useEffect } from 'react';
import ThemeToggle from '../ui/ThemeToggle';
import DateFilter from '../ui/DateFilter';
import SiteSwitcher from '../ui/SiteSwitcher';
import UserMenu from '../ui/UserMenu';
import { Bell, RefreshCw } from 'lucide-react';
import { useRealtime } from '../../hooks/useAnalytics';

const DUMMY_NOTIFICATIONS = [
    { id: 1, title: 'Traffic spike detected', body: 'Your site received 3x more visitors in the last hour.', time: '2 min ago', read: false },
    { id: 2, title: 'New visitor from Germany', body: 'First-time visitor from Berlin, Germany.', time: '15 min ago', read: false },
    { id: 3, title: 'Weekly report ready', body: 'Your weekly analytics summary is available.', time: '1 hour ago', read: true },
    { id: 4, title: 'Goal completed', body: '"Sign-up funnel" goal reached 100 conversions.', time: '3 hours ago', read: true },
    { id: 5, title: 'Bot traffic filtered', body: '42 bot requests were blocked in the last 24h.', time: '5 hours ago', read: true },
];

export default function Navbar() {
    const { data: realtime } = useRealtime();
    const activeVisitors = realtime?.activeVisitors ?? 0;

    const [spinning, setSpinning] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState(DUMMY_NOTIFICATIONS);
    const panelRef = useRef(null);

    const unreadCount = notifications.filter(n => !n.read).length;

    const handleRefresh = () => {
        setSpinning(true);
        window.location.reload();
    };

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    // Close panel on outside click
    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setShowNotifications(false);
            }
        };
        if (showNotifications) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showNotifications]);

    return (
        <header className="h-16 flex items-center justify-between px-6
      border-b border-border dark:border-border-dark
      bg-card/80 dark:bg-card-dark/80 backdrop-blur-sm
      sticky top-0 z-40">
            <div className="flex items-center gap-3">
                <SiteSwitcher />
                <div className="w-px h-6 bg-border dark:bg-border-dark hidden sm:block" />
                <DateFilter />
            </div>

            <div className="flex items-center gap-3">
                {/* Live visitors */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full
          bg-success/10 border border-success/20 text-success text-sm font-medium">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span>{activeVisitors} live</span>
                </div>

                {/* Refresh button */}
                <button
                    onClick={handleRefresh}
                    title="Refresh dashboard"
                    className="p-2 rounded-lg text-text-muted dark:text-text-muted-dark hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                >
                    <RefreshCw className={`w-5 h-5 ${spinning ? 'animate-spin' : ''}`} />
                </button>

                {/* Notifications */}
                <div className="relative" ref={panelRef}>
                    <button
                        onClick={() => setShowNotifications(prev => !prev)}
                        className="relative p-2 rounded-lg text-text-muted dark:text-text-muted-dark hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl shadow-xl
                            bg-card dark:bg-card-dark border border-border dark:border-border-dark z-50">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-border-dark">
                                <h3 className="text-sm font-semibold">Notifications</h3>
                                {unreadCount > 0 && (
                                    <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                                        Mark all read
                                    </button>
                                )}
                            </div>
                            <div>
                                {notifications.map(n => (
                                    <div
                                        key={n.id}
                                        onClick={() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}
                                        className={`px-4 py-3 border-b border-border/50 dark:border-border-dark/50 cursor-pointer
                                            hover:bg-gray-50 dark:hover:bg-white/5 transition-colors
                                            ${!n.read ? 'bg-primary/5' : ''}`}
                                    >
                                        <div className="flex items-start gap-2">
                                            {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                                            <div className={!n.read ? '' : 'ml-4'}>
                                                <p className="text-sm font-medium">{n.title}</p>
                                                <p className="text-xs text-text-muted dark:text-text-muted-dark mt-0.5">{n.body}</p>
                                                <p className="text-[11px] text-text-muted dark:text-text-muted-dark mt-1">{n.time}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <ThemeToggle />

                <UserMenu />
            </div>
        </header>
    );
}
