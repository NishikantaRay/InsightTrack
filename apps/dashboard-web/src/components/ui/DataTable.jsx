import { ChevronUp, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { exportToCSV } from '../../utils/exportUtils';

export default function DataTable({ columns, data, title, sortable = true, exportable = true }) {
    const [sortKey, setSortKey] = useState(null);
    const [sortDir, setSortDir] = useState('desc');

    const sorted = useMemo(() => {
        if (!sortKey || !data) return data || [];
        return [...data].sort((a, b) => {
            const av = a[sortKey];
            const bv = b[sortKey];
            if (typeof av === 'number' && typeof bv === 'number') {
                return sortDir === 'asc' ? av - bv : bv - av;
            }
            return sortDir === 'asc'
                ? String(av).localeCompare(String(bv))
                : String(bv).localeCompare(String(av));
        });
    }, [data, sortKey, sortDir]);

    const handleSort = (key) => {
        if (!sortable) return;
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const handleExport = () => {
        if (data?.length) exportToCSV(data, `${title || 'data'}.csv`);
    };

    if (!data || !data.length) return null;

    return (
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
                    {sorted.map((row, i) => (
                        <tr
                            key={i}
                            className="border-b border-border/50 dark:border-border-dark/50
                hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                        >
                            {columns.map((col) => (
                                <td key={col.key} className="px-4 py-3">
                                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
