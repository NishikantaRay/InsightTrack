import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useState, useEffect, useRef } from 'react';
import { Menu, Monitor, X } from 'lucide-react';
import { useFocusModeStore } from '../../store/useFocusModeStore';
import { useAssistantStore } from '../../store/useAssistantStore';
import AssistantPanel from '../assistant/AssistantPanel';

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
        <div className="lg:hidden sticky top-0 z-30 flex items-start gap-3 pl-16 pr-4 py-3
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
    const { open: assistantOpen, toggle: toggleAssistant } = useAssistantStore();
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
            {/* Mobile overlay — sits below the drawer (z-50) but above page content */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar — off-canvas drawer on mobile (z-50, above navbar & banner),
                static rail on desktop. */}
            <div className={`lg:block ${mobileOpen ? 'block' : 'hidden'} relative z-50`}>
                <Sidebar
                    collapsed={collapsed}
                    onToggleCollapse={() => setCollapsed(c => !c)}
                    onClose={() => setMobileOpen(false)}
                />
            </div>

            <div
                className="flex-1 min-w-0 flex flex-col transition-all duration-300 lg:ml-[var(--sidebar-w)]"
                style={{ '--sidebar-w': collapsed ? '72px' : '260px' }}
            >
                {/* Mobile menu button — top z so it's always tappable above the
                    sticky navbar and warning banner. Hidden while the drawer is open. */}
                {!mobileOpen && (
                    <button
                        onClick={() => setMobileOpen(true)}
                        aria-label="Open navigation menu"
                        className="lg:hidden fixed top-3 left-3 z-[60] p-2.5 rounded-lg bg-card dark:bg-card-dark
              border border-border dark:border-border-dark shadow-card
              active:scale-95 transition-transform"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                )}
                <MobileWarning />
                <Navbar />
                <main className="flex-1 min-w-0 p-4 md:p-6 overflow-x-hidden">
                    {children}
                </main>
            </div>

            {/* ── Pulse (AI analyst) — flexible right-side chat drawer + floating trigger ── */}
            {!assistantOpen && (
                <button
                    onClick={toggleAssistant}
                    aria-label="Open Pulse, the AI analyst"
                    className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2.5 pl-3.5 pr-4 py-3 rounded-full
                        text-sm font-semibold text-white shadow-xl shadow-indigo-500/30
                        bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
                        hover:-translate-y-0.5 active:scale-95 transition-all"
                >
                    <span className="inline-flex items-end gap-[2.5px]" aria-hidden="true">
                        {[5, 9, 13, 9, 5].map((h, i) => (
                            <span key={i} className="w-[2.5px] rounded-full bg-white/90 origin-bottom"
                                style={{ height: h, animation: `pulse-wave 1.15s ease-in-out ${i * 0.12}s infinite` }} />
                        ))}
                    </span>
                    Ask Pulse
                </button>
            )}
            <AssistantPanel />
        </div>
    );
}
