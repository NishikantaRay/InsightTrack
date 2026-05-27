import { NavLink, useLocation } from 'react-router-dom';
import {
    BarChart3,
    Globe,
    Layers,
    Activity,
    Settings,
    FileText,
    ChevronLeft,
    ChevronRight,
    GitBranch,
    BookOpen,
    MousePointerClick,
    Target,
    Users,
    Megaphone,
    Gauge,
    LayoutDashboard,
    Shield,
    Terminal,
    Map,
} from 'lucide-react';
const navItems = [
    { to: '/', icon: BarChart3, label: 'Dashboard' },
    { to: '/pages', icon: FileText, label: 'Pages' },
    { to: '/heatmap', icon: Map, label: 'Heatmap' },
    { to: '/funnels', icon: Layers, label: 'Funnels' },
    { to: '/conversions', icon: Target, label: 'Conversions' },
    { to: '/audience', icon: Users, label: 'Audience' },
    { to: '/content', icon: BookOpen, label: 'Content' },
    { to: '/acquisition', icon: Megaphone, label: 'Acquisition' },
    { to: '/performance', icon: Gauge, label: 'Performance' },
    { to: '/realtime', icon: Activity, label: 'Realtime' },
    { to: '/user-flow', icon: GitBranch, label: 'User Flow' },
    { to: '/engagement', icon: MousePointerClick, label: 'Engagement' },
    { to: '/reporting', icon: LayoutDashboard, label: 'Reporting' },
    { to: '/sql-editor', icon: Terminal, label: 'SQL Editor' },
    { to: '/privacy', icon: Shield, label: 'Privacy' },
    { to: '/settings', icon: Settings, label: 'Settings' },
    { to: '/docs', icon: BookOpen, label: 'Docs' },
];

export default function Sidebar({ collapsed, onToggleCollapse }) {
    const location = useLocation();

    return (
        <aside
            className={`fixed top-0 left-0 z-40 h-screen flex flex-col border-r
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
                        InsightTrack
                    </span>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                {navItems.map(({ to, icon: Icon, label }) => {
                    const active = location.pathname === to;
                    return (
                        <NavLink
                            key={to}
                            to={to}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-colors duration-150
                ${active
                                    ? 'bg-accent/10 text-accent dark:bg-accent/20 dark:text-accent-light'
                                    : 'text-text-secondary dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-white/5 hover:text-text-primary dark:hover:text-text-primary-dark'
                                }`}
                        >
                            <Icon className="w-5 h-5 shrink-0" />
                            {!collapsed && <span className="whitespace-nowrap">{label}</span>}
                        </NavLink>
                    );
                })}
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
