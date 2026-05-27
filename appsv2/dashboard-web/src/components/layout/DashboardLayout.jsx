import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useState, useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
import { useFocusModeStore } from '../../store/useFocusModeStore';

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
                <Navbar />
                <main className="flex-1 p-4 md:p-6 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
