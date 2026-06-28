import { NavLink, useLocation } from 'react-router-dom';
import {
    BarChart3, Globe, Layers, Activity, Settings, FileText,
    ChevronLeft, ChevronRight, GitBranch, BookOpen,
    MousePointerClick, Target, Users, Megaphone, Gauge,
    LayoutDashboard, Shield, Terminal, Map, Sliders, X,
} from 'lucide-react';
import { useFeatureStore } from '../../store/useFeatureStore';

const NAV_ITEMS = [
    { key: 'dashboard',    to: '/',            icon: BarChart3,       label: 'Dashboard' },
    { key: 'pages',        to: '/pages',        icon: FileText,        label: 'Pages' },
    { key: 'heatmap',      to: '/heatmap',      icon: Map,             label: 'Heatmap' },
    { key: 'funnels',      to: '/funnels',      icon: Layers,          label: 'Funnels' },
    { key: 'conversions',  to: '/conversions',  icon: Target,          label: 'Conversions' },
    { key: 'audience',     to: '/audience',     icon: Users,           label: 'Audience' },
    { key: 'content',      to: '/content',      icon: BookOpen,        label: 'Content' },
    { key: 'acquisition',  to: '/acquisition',  icon: Megaphone,       label: 'Acquisition' },
    { key: 'performance',  to: '/performance',  icon: Gauge,           label: 'Performance' },
    { key: 'realtime',     to: '/realtime',     icon: Activity,        label: 'Realtime' },
    { key: 'user-flow',    to: '/user-flow',    icon: GitBranch,       label: 'User Flow' },
    { key: 'engagement',   to: '/engagement',   icon: MousePointerClick, label: 'Engagement' },
    { key: 'reporting',    to: '/reporting',    icon: LayoutDashboard, label: 'Reporting' },
    { key: 'sql-editor',   to: '/sql-editor',   icon: Terminal,        label: 'SQL Editor' },
    { key: 'privacy',      to: '/privacy',      icon: Shield,          label: 'Privacy' },
    { key: 'settings',     to: '/settings',     icon: Settings,        label: 'Settings' },
    { key: 'docs',         to: '/docs',         icon: BookOpen,        label: 'Docs' },
];

export default function Sidebar({ collapsed, onToggleCollapse, onClose }) {
    const location = useLocation();
    const isVisible = useFeatureStore((s) => s.isVisible);
    const hiddenCount = useFeatureStore((s) => s.hiddenCount());

    const visibleItems = NAV_ITEMS.filter(item => isVisible(item.key));

    return (
        <aside
            className={`fixed top-0 left-0 z-50 h-screen flex flex-col border-r
                border-border dark:border-border-dark
                bg-card dark:bg-card-dark
                transition-all duration-300 ease-in-out
                ${collapsed ? 'w-[72px]' : 'w-sidebar'}`}
        >
            {/* Logo */}
            <div className="h-16 flex items-center gap-3 px-5 border-b border-border dark:border-border-dark shrink-0">
                <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    <BarChart3 className="w-4 h-4 text-white" />
                </div>
                {!collapsed && (
                    <span className="font-semibold text-lg tracking-tight whitespace-nowrap">
                        InsightsTrack
                    </span>
                )}
                {/* Mobile-only close button */}
                {onClose && (
                    <button
                        onClick={onClose}
                        aria-label="Close navigation menu"
                        className="lg:hidden ml-auto p-1.5 rounded-lg text-text-muted dark:text-text-muted-dark
                            hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
                {visibleItems.map(({ key, to, icon: Icon, label }) => {
                    const active = to === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(to);
                    return (
                        <NavLink
                            key={key}
                            to={to}
                            onClick={onClose}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                                transition-colors duration-150
                                ${active
                                    ? 'bg-accent/10 text-accent dark:bg-accent/20 dark:text-accent-light'
                                    : 'text-text-secondary dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-white/5 hover:text-text-primary dark:hover:text-text-primary-dark'
                                }`}
                            title={collapsed ? label : undefined}
                        >
                            <Icon className="w-5 h-5 shrink-0" />
                            {!collapsed && <span className="whitespace-nowrap">{label}</span>}
                        </NavLink>
                    );
                })}

                {/* Feature Manager shortcut — shows how many items are hidden */}
                {hiddenCount > 0 && (
                    <NavLink
                        to="/profile"
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                            transition-colors duration-150 mt-2 border border-dashed
                            border-amber-200 dark:border-amber-800/50
                            text-amber-600 dark:text-amber-400
                            hover:bg-amber-50 dark:hover:bg-amber-900/20`}
                        title={collapsed ? `${hiddenCount} pages hidden` : undefined}
                    >
                        <Sliders className="w-4 h-4 shrink-0" />
                        {!collapsed && (
                            <span className="flex items-center gap-2 whitespace-nowrap text-xs">
                                {hiddenCount} page{hiddenCount !== 1 ? 's' : ''} hidden
                            </span>
                        )}
                    </NavLink>
                )}
            </nav>

            {/* Collapse toggle */}
            <button
                onClick={onToggleCollapse}
                className="h-12 flex items-center justify-center border-t
                    border-border dark:border-border-dark
                    text-text-muted hover:text-text-primary
                    dark:text-text-muted-dark dark:hover:text-text-primary-dark
                    transition-colors shrink-0"
            >
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
        </aside>
    );
}
