import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useState, useEffect, useRef } from 'react';
import { Menu, Monitor, X } from 'lucide-react';
import { useFocusModeStore } from '../../store/useFocusModeStore';

// ── Mobile warning banner ─────────────────────────────────────────────────────
// InsightsTrack's analytics dashboard is designed for desktop/laptop use.
// Shows a dismissible notice on screens narrower than 1024px.
function MobileWarning() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const dismissed = sessionStorage.getItem('mobile-warning-dismissed');
        if (!dismissed && window.innerWidth < 1024) setVisible(true);
    }, []);

    if (!visible) return null;

    return (
        <div className="lg:hidden sticky top-0 z-50 flex items-start gap-3 px-4 py-3
            bg-amber-50 dark:bg-amber-950/80 border-b border-amber-200 dark:border-amber-800/60
            text-amber-800 dark:text-amber-200 text-sm backdrop-blur-sm">
            <Monitor className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="flex-1 leading-snug">
                <strong>Best viewed on a laptop or desktop.</strong>{' '}
                Analytics dashboards need screen space — some charts and tables may be cropped on mobile.
            </p>
            <button
                onClick={() => { setVisible(false); sessionStorage.setItem('mobile-warning-dismissed', '1'); }}
                className="shrink-0 p-0.5 rounded text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                aria-label="Dismiss"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

export default function DashboardLayout({ children }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const { focusMode } = useFocusModeStore();
    // remember sidebar state before focus mode collapses it
    const preCollapseRef = useRef(false);

    useEffect(() => {
        if (focusMode) {
            preCollapseRef.current = collapsed;
            setCollapsed(true);
        } else {
            setCollapsed(preCollapseRef.current);
        }
    }, [focusMode]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="flex min-h-screen">
            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-30 lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar - hidden on mobile unless toggled */}
            <div className={`lg:block ${mobileOpen ? 'block' : 'hidden'}`}>
                <Sidebar
                    collapsed={collapsed}
                    onToggleCollapse={() => setCollapsed(c => !c)}
                    onClose={() => setMobileOpen(false)}
                />
            </div>

            <div
                className="flex-1 flex flex-col transition-all duration-300 lg:ml-[var(--sidebar-w)]"
                style={{ '--sidebar-w': collapsed ? '72px' : '260px' }}
            >
                {/* Mobile menu button */}
                <div className="lg:hidden">
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="fixed top-4 left-4 z-20 p-2 rounded-lg bg-card dark:bg-card-dark
              border border-border dark:border-border-dark shadow-card"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                </div>
                <MobileWarning />
                <Navbar />
                <main className="flex-1 p-4 md:p-6 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
