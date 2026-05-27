import { useState } from 'react';
import { MousePointerClick, User, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { formatNumber } from '../utils/formatters';

function getTagColor(tag) {
    switch (tag) {
        case 'a': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
        case 'button': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
        case 'input': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
        default: return 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300';
    }
}

export default function PageActionsTable({ data = [], loading = false, maxClicks = 0 }) {
    const [sortBy, setSortBy] = useState('clicks');
    const [sortDir, setSortDir] = useState('desc');

    const toggleSort = (col) => {
        if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setSortBy(col); setSortDir('desc'); }
    };

    const sorted = [...data].sort((a, b) => {
        const va = a[sortBy] ?? 0;
        const vb = b[sortBy] ?? 0;
        if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortDir === 'asc' ? va - vb : vb - va;
    });

    const top = maxClicks || (sorted[0]?.clicks ?? 1);

    const SortIcon = ({ col }) => {
        if (sortBy !== col) return <ChevronDown className="w-3 h-3 opacity-30" />;
        return sortDir === 'asc'
            ? <ChevronUp className="w-3 h-3 text-accent" />
            : <ChevronDown className="w-3 h-3 text-accent" />;
    };

    if (loading) {
        return (
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-white/5 animate-pulse" />
                ))}
            </div>
        );
    }

    if (!data.length) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted dark:text-text-muted-dark">
                <MousePointerClick className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No click data yet for this page.</p>
                <p className="text-xs mt-1 opacity-60">Data appears once visitors click buttons or links.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-border dark:border-border-dark">
                        <th className="text-left py-2 px-3 text-text-muted dark:text-text-muted-dark font-medium text-xs">
                            Element
                        </th>
                        <th
                            className="text-left py-2 px-3 text-text-muted dark:text-text-muted-dark font-medium text-xs cursor-pointer select-none"
                            onClick={() => toggleSort('tag')}
                        >
                            <span className="flex items-center gap-1">Type <SortIcon col="tag" /></span>
                        </th>
                        <th className="text-left py-2 px-3 text-text-muted dark:text-text-muted-dark font-medium text-xs min-w-[160px]">
                            Clicks
                        </th>
                        <th
                            className="text-right py-2 px-3 text-text-muted dark:text-text-muted-dark font-medium text-xs cursor-pointer select-none"
                            onClick={() => toggleSort('uniqueUsers')}
                        >
                            <span className="flex items-center justify-end gap-1">Unique <SortIcon col="uniqueUsers" /></span>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border dark:divide-border-dark">
                    {sorted.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                            <td className="py-2.5 px-3 max-w-[240px]">
                                <div className="flex flex-col gap-0.5">
                                    <span
                                        className="font-medium text-text-primary dark:text-text-primary-dark truncate"
                                        title={row.text}
                                    >
                                        {row.text || <span className="italic text-text-muted dark:text-text-muted-dark">(no label)</span>}
                                    </span>
                                    <span
                                        className="font-mono text-xs text-text-muted dark:text-text-muted-dark truncate"
                                        title={row.selector}
                                    >
                                        {row.selector}
                                    </span>
                                </div>
                            </td>
                            <td className="py-2.5 px-3">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-medium ${getTagColor(row.tag)}`}>
                                    {row.tag || '—'}
                                </span>
                            </td>
                            <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden max-w-[100px]">
                                        <div
                                            className="h-full bg-accent rounded-full"
                                            style={{ width: `${Math.min((row.clicks / top) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <span className="font-medium text-text-primary dark:text-text-primary-dark">
                                        {formatNumber(row.clicks)}
                                    </span>
                                </div>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                                <span className="flex items-center justify-end gap-1 text-text-secondary dark:text-text-secondary-dark">
                                    <User className="w-3 h-3 opacity-50" />
                                    {formatNumber(row.uniqueUsers)}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
