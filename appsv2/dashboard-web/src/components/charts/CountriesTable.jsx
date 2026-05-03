import { memo } from 'react';
import { Globe } from 'lucide-react';
import { formatNumber, formatPercent } from '../../utils/formatters';
import ChartCard from '../ui/ChartCard';
import DataTable from '../ui/DataTable';
import { useAnalytics } from '../../hooks/useAnalytics';
import { exportToCSV } from '../../utils/exportUtils';

// Map country names to ISO 3166-1 alpha-2 codes for flag emoji generation
const COUNTRY_ISO2 = {
    'Afghanistan': 'AF', 'Albania': 'AL', 'Algeria': 'DZ', 'Argentina': 'AR',
    'Armenia': 'AM', 'Australia': 'AU', 'Austria': 'AT', 'Azerbaijan': 'AZ',
    'Bahrain': 'BH', 'Bangladesh': 'BD', 'Belarus': 'BY', 'Belgium': 'BE',
    'Bolivia': 'BO', 'Bosnia and Herzegovina': 'BA', 'Brazil': 'BR',
    'Bulgaria': 'BG', 'Cambodia': 'KH', 'Canada': 'CA', 'Chile': 'CL',
    'China': 'CN', 'Colombia': 'CO', 'Costa Rica': 'CR', 'Croatia': 'HR',
    'Cuba': 'CU', 'Cyprus': 'CY', 'Czech Republic': 'CZ', 'Denmark': 'DK',
    'Dominican Republic': 'DO', 'Ecuador': 'EC', 'Egypt': 'EG',
    'Estonia': 'EE', 'Ethiopia': 'ET', 'Finland': 'FI', 'France': 'FR',
    'Georgia': 'GE', 'Germany': 'DE', 'Ghana': 'GH', 'Greece': 'GR',
    'Guatemala': 'GT', 'Guam': 'GU', 'Haiti': 'HT', 'Honduras': 'HN',
    'Hong Kong': 'HK', 'Hungary': 'HU', 'Iceland': 'IS', 'India': 'IN',
    'Indonesia': 'ID', 'Iran': 'IR', 'Iraq': 'IQ', 'Ireland': 'IE',
    'Israel': 'IL', 'Italy': 'IT', 'Ivory Coast': 'CI', 'Jamaica': 'JM',
    'Japan': 'JP', 'Jordan': 'JO', 'Kazakhstan': 'KZ', 'Kenya': 'KE',
    'Kuwait': 'KW', 'Latvia': 'LV', 'Lebanon': 'LB', 'Lithuania': 'LT',
    'Luxembourg': 'LU', 'Malaysia': 'MY', 'Malta': 'MT', 'Mexico': 'MX',
    'Morocco': 'MA', 'Mozambique': 'MZ', 'Myanmar': 'MM', 'Nepal': 'NP',
    'Netherlands': 'NL', 'New Zealand': 'NZ', 'Nigeria': 'NG',
    'North Macedonia': 'MK', 'Norway': 'NO', 'Oman': 'OM', 'Pakistan': 'PK',
    'Panama': 'PA', 'Papua New Guinea': 'PG', 'Paraguay': 'PY', 'Peru': 'PE',
    'Philippines': 'PH', 'Poland': 'PL', 'Portugal': 'PT', 'Qatar': 'QA',
    'Romania': 'RO', 'Russia': 'RU', 'Saudi Arabia': 'SA', 'Senegal': 'SN',
    'Serbia': 'RS', 'Singapore': 'SG', 'Slovakia': 'SK', 'Slovenia': 'SI',
    'South Africa': 'ZA', 'South Korea': 'KR', 'Spain': 'ES', 'Sri Lanka': 'LK',
    'Sudan': 'SD', 'Sweden': 'SE', 'Switzerland': 'CH', 'Syria': 'SY',
    'Taiwan': 'TW', 'Tanzania': 'TZ', 'Thailand': 'TH', 'Tunisia': 'TN',
    'Turkey': 'TR', 'Uganda': 'UG', 'Ukraine': 'UA',
    'United Arab Emirates': 'AE', 'United Kingdom': 'GB', 'United States': 'US',
    'Uruguay': 'UY', 'Uzbekistan': 'UZ', 'Venezuela': 'VE', 'Vietnam': 'VN',
    'Zambia': 'ZM', 'Zimbabwe': 'ZW',
};

function getFlag(countryName) {
    const code = COUNTRY_ISO2[countryName];
    if (!code) return '🌐';
    return code.toUpperCase().split('').map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('');
}

const columns = [
    {
        key: 'country',
        label: 'Country',
        render: (val) => (
            <div className="flex items-center gap-2">
                <span>{getFlag(val)}</span>
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
