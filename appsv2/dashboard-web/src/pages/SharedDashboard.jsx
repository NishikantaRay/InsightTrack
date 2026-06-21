import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid, AlertCircle, RefreshCw } from 'lucide-react';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { useThemeStore } from '../store/useThemeStore';
import ThemeToggle from '../components/ui/ThemeToggle';
import {
    WidgetRenderer,
    decodeSharePayload,
    isValidPx,
    buildPixelLayout,
} from './Reporting';

export default function SharedDashboard() {
    const [searchParams] = useSearchParams();
    const theme = useThemeStore((s) => s.theme);
    const isDark = theme === 'dark';

    const [parsed, setParsed] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        const token = searchParams.get('dash');
        if (!token) { setError(true); return; }
        const result = decodeSharePayload(token);
        if (!result?.widgets?.length) { setError(true); return; }
        setParsed(result);
    }, [searchParams]);

    return (
        <div className={theme === 'dark' ? 'dark' : ''}>
            <div className="min-h-screen bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark">

                {/* Minimal header — no sidebar, no auth, no nav */}
                <header className="sticky top-0 z-50 border-b border-border dark:border-border-dark bg-card dark:bg-card-dark px-6 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 shrink-0">
                            <LayoutGrid className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark truncate">
                                {parsed?.name || 'Shared Dashboard'}
                            </h1>
                            <p className="text-xs text-text-muted dark:text-text-muted-dark">
                                Read-only · shared via link
                            </p>
                        </div>
                    </div>
                    <ThemeToggle />
                </header>

                <main className="p-6">
                    {error && (
                        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                            <AlertCircle className="w-12 h-12 text-red-400" />
                            <h2 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">
                                Invalid share link
                            </h2>
                            <p className="text-sm text-text-muted dark:text-text-muted-dark max-w-sm">
                                This link is broken or the dashboard no longer exists. Ask the owner to generate a new share link.
                            </p>
                        </div>
                    )}

                    {!error && !parsed && <LoadingSkeleton type="page" />}

                    {!error && parsed && (
                        <SharedCanvas widgets={parsed.widgets} isDark={isDark} />
                    )}
                </main>
            </div>
        </div>
    );
}

function SharedCanvas({ widgets, isDark }) {
    // Restore saved layout positions exactly as the owner arranged them
    const savedLayout = {};
    for (const w of widgets) { if (isValidPx(w.px)) savedLayout[w.id] = w.px; }
    const layoutMap = buildPixelLayout(widgets, savedLayout, 900);
    const canvasH = Math.max(400, ...Object.values(layoutMap).map(l => l.y + l.h + 40));

    return (
        <div
            className="relative rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
            style={{ height: canvasH, background: isDark ? '#111827' : '#f9fafb' }}
        >
            {widgets.map(w => {
                const r = layoutMap[w.id];
                if (!r) return null;
                return (
                    <div
                        key={w.id}
                        className="absolute flex flex-col overflow-hidden bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm"
                        style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
                    >
                        {/* Widget title bar */}
                        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 shrink-0 gap-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300 truncate leading-tight">
                                {w.title}
                            </span>
                            {w.dateRange && w.type !== 'text_note' && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 font-mono">
                                    {w.dateRange === 'all' ? 'All time' : w.dateRange}
                                </span>
                            )}
                        </div>

                        {/* Widget body — passes snapshot data so no API call is made */}
                        <div className="relative flex-1 overflow-hidden">
                            <div className="absolute inset-0 p-3">
                                <WidgetRenderer
                                    widget={w}
                                    siteId={null}
                                    isDark={isDark}
                                    staticData={w.type === 'text_note' ? undefined : (w._data ?? [])}
                                />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
