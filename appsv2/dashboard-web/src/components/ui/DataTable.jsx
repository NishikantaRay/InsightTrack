import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { exportToCSV } from '../../utils/exportUtils';

export default function DataTable({
    columns,
    data,
    title,
    sortable = true,
    exportable = true,
    searchable = true,
    pageSize: defaultPageSize = 10,
    paginated = true,
}) {
    const [sortKey, setSortKey] = useState(null);
    const [sortDir, setSortDir] = useState('desc');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize);

    const filtered = useMemo(() => {
        if (!query.trim() || !data) return data || [];
        const q = query.toLowerCase();
        return data.filter((row) =>
            columns.some((col) => {
                const val = row[col.key];
                return val != null && String(val).toLowerCase().includes(q);
            })
        );
    }, [data, query, columns]);

    const sorted = useMemo(() => {
        if (!sortKey) return filtered;
        return [...filtered].sort((a, b) => {
            const av = a[sortKey];
            const bv = b[sortKey];
            if (typeof av === 'number' && typeof bv === 'number') {
                return sortDir === 'asc' ? av - bv : bv - av;
            }
            return sortDir === 'asc'
                ? String(av).localeCompare(String(bv))
                : String(bv).localeCompare(String(av));
        });
    }, [filtered, sortKey, sortDir]);

    const totalPages = paginated ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
    const safePage = Math.min(page, totalPages);
    const paginated_rows = paginated ? sorted.slice((safePage - 1) * pageSize, safePage * pageSize) : sorted;

    const handleSort = (key) => {
        if (!sortable) return;
        setPage(1);
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const handleSearch = (e) => {
        setQuery(e.target.value);
        setPage(1);
    };

    const handleExport = () => {
        if (data?.length) exportToCSV(data, `${title || 'data'}.csv`);
    };

    if (!data || !data.length) return null;

    return (
        <div className="space-y-3">
            {/* Toolbar */}
            {(searchable || exportable) && (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    {searchable && (
                        <div className="relative flex-1 min-w-[160px] max-w-xs">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                            <input
                                type="text"
                                value={query}
                                onChange={handleSearch}
                                placeholder="Filter rows…"
                                className="w-full pl-8 pr-7 py-1.5 text-sm rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark placeholder:text-text-muted focus:outline-none focus:border-accent"
                            />
                            {query && (
                                <button
                                    onClick={() => { setQuery(''); setPage(1); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    )}
                    {exportable && (
                        <button
                            onClick={handleExport}
                            className="text-xs text-accent hover:underline flex-shrink-0 ml-auto"
                        >
                            Export CSV
                        </button>
                    )}
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border dark:border-border-dark">
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    onClick={() => handleSort(col.key)}
                                    className={`px-4 py-3 text-left font-medium text-text-muted dark:text-text-muted-dark
                                        ${sortable ? 'cursor-pointer select-none hover:text-text-primary dark:hover:text-text-primary-dark' : ''}`}
                                >
                                    <div className="flex items-center gap-1">
                                        {col.label}
                                        {sortKey === col.key && (
                                            sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paginated_rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-text-muted dark:text-text-muted-dark italic">
                                    No results match &ldquo;{query}&rdquo;
                                </td>
                            </tr>
                        ) : (
                            paginated_rows.map((row, i) => (
                                <tr
                                    key={i}
                                    className="border-b border-border/50 dark:border-border-dark/50 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                                >
                                    {columns.map((col) => (
                                        <td key={col.key} className="px-4 py-3">
                                            {col.render ? col.render(row[col.key], row) : row[col.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {paginated && sorted.length > 0 && (
                <div className="flex items-center justify-between gap-4 pt-1 text-sm flex-wrap">
                    <span className="text-text-muted dark:text-text-muted-dark text-xs">
                        {query ? `${sorted.length} of ${data.length} rows` : `${data.length} rows`}
                    </span>
                    <div className="flex items-center gap-2">
                        <select
                            value={pageSize}
                            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                            className="text-xs px-2 py-1 rounded border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark focus:outline-none"
                        >
                            {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
                        </select>
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={safePage === 1}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-text-muted dark:text-text-muted-dark tabular-nums">
                            {safePage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage === totalPages}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
