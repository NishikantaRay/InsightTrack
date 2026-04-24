import { memo } from 'react';
import { Globe } from 'lucide-react';
import { formatNumber, formatPercent } from '../../utils/formatters';
import ChartCard from '../ui/ChartCard';
import DataTable from '../ui/DataTable';
import { useAnalytics } from '../../hooks/useAnalytics';
import { exportToCSV } from '../../utils/exportUtils';

const FLAG_EMOJIS = {
    'United States': '\u{1F1FA}\u{1F1F8}',
    'United Kingdom': '\u{1F1EC}\u{1F1E7}',
    'Germany': '\u{1F1E9}\u{1F1EA}',
    'France': '\u{1F1EB}\u{1F1F7}',
    'Canada': '\u{1F1E8}\u{1F1E6}',
    'India': '\u{1F1EE}\u{1F1F3}',
    'Japan': '\u{1F1EF}\u{1F1F5}',
    'Australia': '\u{1F1E6}\u{1F1FA}',
    'Brazil': '\u{1F1E7}\u{1F1F7}',
    'Netherlands': '\u{1F1F3}\u{1F1F1}',
    'Spain': '\u{1F1EA}\u{1F1F8}',
    'Italy': '\u{1F1EE}\u{1F1F9}',
    'Mexico': '\u{1F1F2}\u{1F1FD}',
    'South Korea': '\u{1F1F0}\u{1F1F7}',
    'Sweden': '\u{1F1F8}\u{1F1EA}',
    'Norway': '\u{1F1F3}\u{1F1F4}',
    'Denmark': '\u{1F1E9}\u{1F1F0}',
    'Finland': '\u{1F1EB}\u{1F1EE}',
    'Poland': '\u{1F1F5}\u{1F1F1}',
    'Singapore': '\u{1F1F8}\u{1F1EC}',
};

const columns = [
    {
        key: 'country',
        label: 'Country',
        render: (val) => (
            <div className="flex items-center gap-2">
                <span>{FLAG_EMOJIS[val] || '\u{1F30D}'}</span>
                <span className="font-medium">{val}</span>
            </div>
        ),
    },
    {
        key: 'visitors',
        label: 'Visitors',
        render: (val) => formatNumber(val),
    },
    {
        key: 'percentage',
        label: '%',
        render: (val) => (
            <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${Math.min(val, 100)}%` }}
                    />
                </div>
                <span className="text-text-muted dark:text-text-muted-dark">{formatPercent(val)}</span>
            </div>
        ),
    },
];

function CountriesTable() {
    const { data, loading, error } = useAnalytics('getCountries');

    const tableData = (data || []).map((d) => ({
        country: d.country || d.name || 'Unknown',
        visitors: Number(d.visitors || d.count || 0),
        percentage: Number(d.percentage || 0),
    }));

    return (
        <ChartCard
            title="Countries"
            subtitle="Visitors by country"
            loading={loading}
            error={error}
            empty={!tableData.length}
            onExport={() => exportToCSV(tableData, 'countries.csv')}
        >
            <DataTable columns={columns} data={tableData} />
        </ChartCard>
    );
}

export default memo(CountriesTable);
