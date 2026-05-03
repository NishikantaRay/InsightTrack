import { memo, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useThemeStore } from '../../store/useThemeStore';
import ChartCard from '../ui/ChartCard';
import { formatNumber } from '../../utils/formatters';

const PAGE_SIZE = 10;

function FlowPagination({ page, totalPages, onPrev, onNext, total, filtered }) {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-400">
                {filtered < total ? `${filtered} of ${total}` : `${total} rows`}
            </span>
            <div className="flex items-center gap-1">
                <button onClick={onPrev} disabled={page === 0} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs px-2 text-gray-600 dark:text-gray-400">{page + 1} / {totalPages}</span>
                <button onClick={onNext} disabled={page >= totalPages - 1} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

function UserFlowChart() {
    const { data, loading, error } = useAnalytics('getUserFlow');
    const theme = useThemeStore((s) => s.theme);
    const isDark = theme === 'dark';

    const transitions = data?.transitions || [];
    const entryPages = data?.entryPages || [];
    const exitPages = data?.exitPages || [];

    const [transPage, setTransPage] = useState(0);
    const [entryPage, setEntryPage] = useState(0);
    const [exitPage, setExitPage] = useState(0);

    const maxCount = transitions.length > 0
        ? Math.max(...transitions.map(t => t.count))
        : 1;

    const pagedTransitions = useMemo(() => transitions.slice(transPage * PAGE_SIZE, (transPage + 1) * PAGE_SIZE), [transitions, transPage]);
    const pagedEntry = useMemo(() => entryPages.slice(entryPage * PAGE_SIZE, (entryPage + 1) * PAGE_SIZE), [entryPages, entryPage]);
    const pagedExit = useMemo(() => exitPages.slice(exitPage * PAGE_SIZE, (exitPage + 1) * PAGE_SIZE), [exitPages, exitPage]);

    const transTotalPages = Math.ceil(transitions.length / PAGE_SIZE);
    const entryTotalPages = Math.ceil(entryPages.length / PAGE_SIZE);
    const exitTotalPages = Math.ceil(exitPages.length / PAGE_SIZE);

    return (
        <div className="space-y-4">
            {/* Transitions */}
            <ChartCard
                title="Page Transitions"
                subtitle="How visitors navigate between pages"
                loading={loading}
                error={error}
                empty={!transitions.length}
            >
                <div className="space-y-2">
                    {pagedTransitions.map((t, i) => (
                        <div key={i} className="flex items-center gap-3 py-2">
                            <span className="text-xs font-mono truncate w-[30%] text-right text-text-primary dark:text-text-primary-dark">
                                {t.from}
                            </span>
                            <div className="flex-1 relative">
                                <div className="h-6 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full flex items-center justify-end pr-2"
                                        style={{ width: `${Math.max((t.count / maxCount) * 100, 8)}%` }}
                                    >
                                        <span className="text-[10px] font-medium text-white whitespace-nowrap">
                                            {formatNumber(t.count)}
                                        </span>
                                    </div>
                                </div>
                                <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-text-muted dark:text-text-muted-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </div>
                            <span className="text-xs font-mono truncate w-[30%] text-text-primary dark:text-text-primary-dark">
                                {t.to}
                            </span>
                        </div>
                    ))}
                    <FlowPagination page={transPage} totalPages={transTotalPages} onPrev={() => setTransPage(p => p - 1)} onNext={() => setTransPage(p => p + 1)} total={transitions.length} filtered={transitions.length} />
                </div>
            </ChartCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Entry Pages */}
                <ChartCard
                    title="Entry Pages"
                    subtitle="Where visitors start their journey"
                    loading={loading}
                    error={error}
                    empty={!entryPages.length}
                >
                    <div className="space-y-2">
                        {pagedEntry.map((p, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5">
                                <div className="flex items-center gap-2">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                                        ${i === 0 && entryPage === 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'}`}>
                                        {entryPage * PAGE_SIZE + i + 1}
                                    </span>
                                    <span className="text-sm font-mono text-text-primary dark:text-text-primary-dark truncate max-w-[200px]">
                                        {p.page}
                                    </span>
                                </div>
                                <span className="text-sm font-medium text-accent">{formatNumber(p.count)}</span>
                            </div>
                        ))}
                        <FlowPagination page={entryPage} totalPages={entryTotalPages} onPrev={() => setEntryPage(p => p - 1)} onNext={() => setEntryPage(p => p + 1)} total={entryPages.length} filtered={entryPages.length} />
                    </div>
                </ChartCard>

                {/* Exit Pages */}
                <ChartCard
                    title="Exit Pages"
                    subtitle="Where visitors leave"
                    loading={loading}
                    error={error}
                    empty={!exitPages.length}
                >
                    <div className="space-y-2">
                        {pagedExit.map((p, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5">
                                <div className="flex items-center gap-2">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                                        ${i === 0 && exitPage === 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'}`}>
                                        {exitPage * PAGE_SIZE + i + 1}
                                    </span>
                                    <span className="text-sm font-mono text-text-primary dark:text-text-primary-dark truncate max-w-[200px]">
                                        {p.page}
                                    </span>
                                </div>
                                <span className="text-sm font-medium text-red-500">{formatNumber(p.count)}</span>
                            </div>
                        ))}
                        <FlowPagination page={exitPage} totalPages={exitTotalPages} onPrev={() => setExitPage(p => p - 1)} onNext={() => setExitPage(p => p + 1)} total={exitPages.length} filtered={exitPages.length} />
                    </div>
                </ChartCard>
            </div>
        </div>
    );
}

export default memo(UserFlowChart);
