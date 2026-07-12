import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
    Download, ArrowUpRight, Table2, BarChart3,
    LineChart as LineChartIcon, PieChart as PieChartIcon,
} from 'lucide-react';
import { exportToCSV } from '../../utils/exportUtils';

const COLORS = ['#6366f1', '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#22d3ee'];

// User-switchable views for any multi-row result — no re-fetch needed,
// the data is already in the envelope.
const VIEWS = [
    { id: 'table', icon: Table2, label: 'Table' },
    { id: 'bar', icon: BarChart3, label: 'Bar chart' },
    { id: 'line', icon: LineChartIcon, label: 'Line chart' },
    { id: 'donut', icon: PieChartIcon, label: 'Donut chart' },
];
// area/funnel envelopes highlight the "line" toggle (same family).
const toToggleId = (v) => (v === 'area' || v === 'funnel' ? 'line' : v);

/**
 * Renders one tool result envelope as a compact card in the chat:
 *   { summary, data, render:{type,chart,columns}, download, deepLink }
 * Reuses Recharts + exportUtils so cards feel native.
 */
export default function ResultCard({ envelope }) {
    const navigate = useNavigate();
    const [view, setView] = useState(null); // null = the envelope's default
    if (!envelope) return null;
    const { data, render = {}, download, deepLink } = envelope;
    const rows = Array.isArray(data) ? data : data ? [data] : [];

    const defaultView = render.type === 'chart' ? (render.chart || 'bar') : render.type;
    const active = view ?? defaultView;
    const switchable = render.type !== 'kpi' && rows.length > 1;

    return (
        <div className="mt-2 rounded-xl border border-border dark:border-border-dark bg-bg dark:bg-bg-dark overflow-hidden">
            <div className="p-3">
                {active === 'kpi' && <KpiView data={data} />}
                {active === 'table' && <TableView columns={render.columns} rows={rows} />}
                {active !== 'kpi' && active !== 'table' && <ChartView chart={active} rows={rows} />}
            </div>

            {(download || deepLink || switchable) && (
                <div className="flex items-center gap-2 px-3 py-2 border-t border-border dark:border-border-dark bg-card/40 dark:bg-card-dark/40">
                    {switchable && (
                        <div className="inline-flex rounded-lg border border-border dark:border-border-dark overflow-hidden">
                            {VIEWS.map(({ id, icon: Icon, label }) => (
                                <button key={id} onClick={() => setView(id)} title={label} aria-label={`View as ${label}`}
                                    className={`w-7 h-6 grid place-items-center transition-colors
                                        ${toToggleId(active) === id
                                            ? 'bg-accent/15 text-accent'
                                            : 'text-text-muted dark:text-text-muted-dark hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                                    <Icon className="w-3.5 h-3.5" />
                                </button>
                            ))}
                        </div>
                    )}
                    {download?.csv && rows.length > 0 && (
                        <button
                            onClick={() => exportToCSV(rows, download.filename || 'data.csv')}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg
                                border border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark
                                hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                            <Download className="w-3.5 h-3.5" /> CSV
                        </button>
                    )}
                    {deepLink && (
                        <button
                            onClick={() => navigate(deepLink.to)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg
                                bg-accent/10 text-accent hover:bg-accent/20 transition-colors ml-auto">
                            {deepLink.label || 'Open'} <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// pick reasonable x/y keys from arbitrary rows
function keysOf(rows) {
    const r = rows[0] || {};
    const num = Object.keys(r).find((k) => typeof r[k] === 'number');
    const cat = Object.keys(r).find((k) => typeof r[k] === 'string');
    return { cat: cat || Object.keys(r)[0], num: num || Object.keys(r)[1] };
}

function ChartView({ chart, rows }) {
    if (!rows.length) return <Empty />;
    const { cat, num } = keysOf(rows);

    if (chart === 'donut') {
        return (
            <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                    <Pie data={rows} dataKey={num} nameKey={cat} innerRadius={40} outerRadius={70} paddingAngle={2}>
                        {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
            </ResponsiveContainer>
        );
    }
    if (chart === 'area' || chart === 'line' || chart === 'funnel') {
        const Chart = chart === 'line' ? LineChart : AreaChart;
        const Series = chart === 'line' ? Line : Area;
        return (
            <ResponsiveContainer width="100%" height={180}>
                <Chart data={rows}>
                    <XAxis dataKey={cat} tick={{ fontSize: 10 }} hide={rows.length > 12} />
                    <YAxis tick={{ fontSize: 10 }} width={30} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Series type="monotone" dataKey={num} stroke="#6366f1" fill="#6366f133" strokeWidth={2} />
                </Chart>
            </ResponsiveContainer>
        );
    }
    // bar (default)
    return (
        <ResponsiveContainer width="100%" height={180}>
            <BarChart data={rows}>
                <XAxis dataKey={cat} tick={{ fontSize: 10 }} hide={rows.length > 12} />
                <YAxis tick={{ fontSize: 10 }} width={30} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey={num} fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}

function TableView({ columns, rows }) {
    if (!rows.length) return <Empty />;
    const cols = columns?.length ? columns : Object.keys(rows[0]).slice(0, 3);
    // map friendly column names to the row's actual keys
    const resolve = (row, col) => row[col] ?? row[col.toLowerCase()] ?? row[aliases[col]] ?? '—';
    return (
        <div className="max-h-56 overflow-y-auto -m-1">
            <table className="w-full text-xs">
                <thead className="sticky top-0 bg-bg dark:bg-bg-dark">
                    <tr>{cols.map((c) => <th key={c} className="text-left font-semibold px-2 py-1.5 text-text-muted dark:text-text-muted-dark capitalize">{c}</th>)}</tr>
                </thead>
                <tbody>
                    {rows.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-t border-border/50 dark:border-border-dark/50">
                            {cols.map((c) => <td key={c} className="px-2 py-1.5 text-text-primary dark:text-text-primary-dark">{format(resolve(row, c))}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
const aliases = { page: 'path', views: 'views', visitors: 'uniqueVisitors' };

function KpiView({ data }) {
    if (!data || typeof data !== 'object') return <Empty />;
    const entries = Object.entries(data).filter(([, v]) => typeof v === 'number' || typeof v === 'string').slice(0, 4);
    return (
        <div className="grid grid-cols-2 gap-2">
            {entries.map(([k, v]) => (
                <div key={k} className="rounded-lg bg-card dark:bg-card-dark p-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-text-muted dark:text-text-muted-dark truncate">{k.replace(/([A-Z])/g, ' $1').trim()}</div>
                    <div className="text-lg font-bold text-text-primary dark:text-text-primary-dark">{format(v)}</div>
                </div>
            ))}
        </div>
    );
}

function format(v) {
    if (v == null) return '—';
    if (typeof v === 'number') return v.toLocaleString();
    // Guard against object/array cells so we never render "[object Object]".
    if (typeof v === 'object') {
        const nums = Object.values(v).filter((x) => typeof x === 'number');
        return nums.length ? nums.map((n) => n.toLocaleString()).join(' / ') : JSON.stringify(v);
    }
    return String(v);
}
function Empty() {
    return <p className="text-xs text-text-muted dark:text-text-muted-dark py-3 text-center">No data.</p>;
}
const tooltipStyle = { background: '#1E2130', border: '1px solid #2D3348', borderRadius: 8, fontSize: 12, color: '#E2E8F0' };
