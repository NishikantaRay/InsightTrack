import { useState, useMemo } from 'react';
import { Users, UserCheck, UserPlus, Grid3x3, Filter, BarChart3, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAnalytics } from '../hooks/useAnalytics';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import PageNote from '../components/ui/PageNote';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
const PAGE_SIZE = 10;

function AudPagination({ page, totalPages, onPrev, onNext, totalRows, filteredRows, query }) {
    return (
        <div className="flex items-center justify-between gap-4 pt-2 text-sm flex-wrap">
            <span className="text-xs text-text-muted dark:text-text-muted-dark">
                {query ? `${filteredRows} of ${totalRows} rows` : `${totalRows} rows`}
            </span>
            <div className="flex items-center gap-1">
                <button onClick={onPrev} disabled={page === 1} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs text-text-muted dark:text-text-muted-dark tabular-nums px-1">{page} / {totalPages}</span>
                <button onClick={onNext} disabled={page === totalPages} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
            </div>
        </div>
    );
}

function CohortTable({ cohorts }) {
    const dayLabels = ['Day 0', 'Day 1', 'Day 3', 'Day 7', 'Day 14', 'Day 30'];
    const dayKeys = ['day0', 'day1', 'day3', 'day7', 'day14', 'day30'];

    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        if (!query.trim()) return cohorts;
        const q = query.toLowerCase();
        return cohorts.filter((c) => c.date?.toLowerCase().includes(q));
    }, [cohorts, query]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const getColorIntensity = (rate) => {
        if (rate >= 80) return 'bg-indigo-600 text-white';
        if (rate >= 60) return 'bg-indigo-500 text-white';
        if (rate >= 40) return 'bg-indigo-400 text-white';
        if (rate >= 20) return 'bg-indigo-300 text-indigo-900';
        if (rate > 0) return 'bg-indigo-200 text-indigo-800';
        return 'bg-gray-100 dark:bg-gray-800 text-text-muted dark:text-text-muted-dark';
    };

    return (
        <div className="space-y-3">
            <div className="relative max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input type="text" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Filter cohorts…" className="w-full pl-8 pr-7 py-1.5 text-sm rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark placeholder:text-text-muted focus:outline-none focus:border-accent" />
                {query && <button onClick={() => { setQuery(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"><X className="w-3 h-3" /></button>}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border dark:border-border-dark">
                            <th className="text-left py-2 px-3 text-text-secondary dark:text-text-secondary-dark font-medium">Cohort</th>
                            <th className="text-center py-2 px-3 text-text-secondary dark:text-text-secondary-dark font-medium">Users</th>
                            {dayLabels.map((d) => (
                                <th key={d} className="text-center py-2 px-3 text-text-secondary dark:text-text-secondary-dark font-medium">{d}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={dayLabels.length + 2} className="py-8 text-center text-sm text-text-muted dark:text-text-muted-dark italic">No cohorts match &ldquo;{query}&rdquo;</td></tr>
                        ) : (
                            rows.map((cohort) => (
                                <tr key={cohort.date} className="border-b border-border/50 dark:border-border-dark/50 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                                    <td className="py-2 px-3 text-text-primary dark:text-text-primary-dark font-medium whitespace-nowrap">{cohort.date}</td>
                                    <td className="py-2 px-3 text-center text-text-secondary dark:text-text-secondary-dark">{cohort.cohortSize}</td>
                                    {dayKeys.map((dk) => {
                                        const cell = cohort.retention?.[dk];
                                        const rate = cell?.rate || 0;
                                        return (
                                            <td key={dk} className="py-1 px-1 text-center">
                                                <span className={`inline-block w-14 py-1 rounded text-xs font-medium ${getColorIntensity(rate)}`}>
                                                    {rate > 0 ? `${rate}%` : '-'}
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <AudPagination page={safePage} totalPages={totalPages} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))} totalRows={cohorts.length} filteredRows={filtered.length} query={query} />
        </div>
    );
}

function NewVsReturningSection() {
    const { data, loading } = useAnalytics('getNewVsReturning');

    if (loading) return <div className="h-64 rounded-xl bg-card dark:bg-card-dark animate-pulse" />;

    const summary = data?.summary || {};
    const daily = data?.daily || [];
    const pieData = [
        { name: 'New Visitors', value: summary.newVisitors || 0 },
        { name: 'Returning Visitors', value: summary.returningVisitors || 0 },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10">
                    <Users className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">New vs Returning Visitors</h2>
                    <p className="text-sm text-text-muted dark:text-text-muted-dark">See how many visitors are coming back to your site</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-5 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/10">
                        <UserPlus className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">{summary.newVisitors?.toLocaleString() || 0}</p>
                        <p className="text-sm text-text-muted dark:text-text-muted-dark">New Visitors ({summary.newPercentage || 0}%)</p>
                    </div>
                </div>
                <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-5 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/10">
                        <UserCheck className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">{summary.returningVisitors?.toLocaleString() || 0}</p>
                        <p className="text-sm text-text-muted dark:text-text-muted-dark">Returning ({summary.returningPercentage || 0}%)</p>
                    </div>
                </div>
                <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-5 flex items-center justify-center">
                    {pieData.some(d => d.value > 0) ? (
                        <ResponsiveContainer width="100%" height={120}>
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={5} dataKey="value">
                                    <Cell fill="#6366F1" />
                                    <Cell fill="#10B981" />
                                </Pie>
                                <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-sm text-text-muted dark:text-text-muted-dark">No data yet</p>
                    )}
                </div>
            </div>

            {daily.length > 0 && (
                <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-5">
                    <h3 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-4">Daily Breakdown</h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={daily}>
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
                            <YAxis tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
                            <Tooltip contentStyle={{ borderRadius: '8px' }} />
                            <Area type="monotone" dataKey="newVisitors" stackId="1" stroke="#6366F1" fill="#6366F1" fillOpacity={0.3} name="New" />
                            <Area type="monotone" dataKey="returningVisitors" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.3} name="Returning" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}

function CohortSection() {
    const { data: cohorts, loading } = useAnalytics('getCohorts');

    if (loading) return <div className="h-64 rounded-xl bg-card dark:bg-card-dark animate-pulse" />;

    const dayLabels = ['Day 0', 'Day 1', 'Day 3', 'Day 7', 'Day 14', 'Day 30'];
    const dayKeys = ['day0', 'day1', 'day3', 'day7', 'day14', 'day30'];

    const getColorIntensity = (rate) => {
        if (rate >= 80) return 'bg-indigo-600 text-white';
        if (rate >= 60) return 'bg-indigo-500 text-white';
        if (rate >= 40) return 'bg-indigo-400 text-white';
        if (rate >= 20) return 'bg-indigo-300 text-indigo-900';
        if (rate > 0) return 'bg-indigo-200 text-indigo-800';
        return 'bg-gray-100 dark:bg-gray-800 text-text-muted dark:text-text-muted-dark';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                    <Grid3x3 className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">User Cohort Analysis</h2>
                    <p className="text-sm text-text-muted dark:text-text-muted-dark">Track how many users return after their first visit</p>
                </div>
            </div>

            {cohorts?.length > 0 ? (
                <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-5">
                    <CohortTable cohorts={cohorts} />
                </div>
            ) : (
                <div className="text-center py-12 bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark">
                    <Grid3x3 className="w-10 h-10 text-text-muted dark:text-text-muted-dark mx-auto mb-3" />
                    <p className="text-text-secondary dark:text-text-secondary-dark">Not enough data for cohort analysis yet.</p>
                </div>
            )}
        </div>
    );
}

function SegmentsSection({ filters, setFilters }) {
    const { data: segments, loading } = useAnalytics('getSegments', { params: { filters } });

    const summary = segments?.summary || {};

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                    <Filter className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">Visitor Segments</h2>
                    <p className="text-sm text-text-muted dark:text-text-muted-dark">Filter and compare audiences by device, country, source, or browser</p>
                </div>
            </div>

            <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-5">
                {loading ? (
                    <div className="h-32 animate-pulse bg-bg dark:bg-bg-dark rounded-lg" />
                ) : (
                    <>
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="text-center p-4 bg-bg dark:bg-bg-dark rounded-lg">
                                <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">{summary.visitors?.toLocaleString() || 0}</p>
                                <p className="text-xs text-text-muted dark:text-text-muted-dark">Visitors</p>
                            </div>
                            <div className="text-center p-4 bg-bg dark:bg-bg-dark rounded-lg">
                                <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">{summary.pageviews?.toLocaleString() || 0}</p>
                                <p className="text-xs text-text-muted dark:text-text-muted-dark">Pageviews</p>
                            </div>
                            <div className="text-center p-4 bg-bg dark:bg-bg-dark rounded-lg">
                                <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">{summary.events?.toLocaleString() || 0}</p>
                                <p className="text-xs text-text-muted dark:text-text-muted-dark">Total Events</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                { title: 'By Device', data: segments?.devices || [], key: 'device' },
                                { title: 'By Browser', data: segments?.browsers || [], key: 'browser' },
                                { title: 'By Country', data: segments?.countries || [], key: 'country' },
                                { title: 'By Source', data: segments?.sources || [], key: 'source' },
                            ].map(({ title, data, key }) => (
                                <div key={title}>
                                    <h4 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-3">{title}</h4>
                                    {data.length > 0 ? (
                                        <div className="space-y-2">
                                            {data.slice(0, 6).map((item, idx) => {
                                                const max = Math.max(...data.map(d => d.visitors));
                                                const pct = max > 0 ? (item.visitors / max) * 100 : 0;
                                                return (
                                                    <div key={idx} className="flex items-center gap-3">
                                                        <span className="text-sm text-text-primary dark:text-text-primary-dark w-24 truncate">{item[key]}</span>
                                                        <div className="flex-1 bg-bg dark:bg-bg-dark rounded-full h-2.5 overflow-hidden">
                                                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                                                        </div>
                                                        <span className="text-sm text-text-muted dark:text-text-muted-dark w-12 text-right">{item.visitors}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-text-muted dark:text-text-muted-dark">No data</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

const TABS = [
    { id: 'new-returning', label: 'New vs Returning', icon: Users },
    { id: 'cohorts', label: 'Cohort Analysis', icon: Grid3x3 },
    { id: 'segments', label: 'Visitor Segments', icon: Filter },
];

export default function Audience() {
    const [activeTab, setActiveTab] = useState('new-returning');
    const [filters, setFilters] = useState({});
    const hasFilters = Object.values(filters).some(Boolean);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">Audience</h1>
                <p className="text-text-muted dark:text-text-muted-dark mt-1">Understand who your visitors are and how they come back</p>
            </div>

            <PageNote
                title="What is Audience?"
                summary="Audience shows you the characteristics of your website visitors — who is new vs returning, how loyal they are over time (cohorts), and how different segments behave."
                details={[
                    { label: 'New vs Returning', text: 'Compares first-time visitors against people who have been to your site before. Returning visitors usually convert better.' },
                    { label: 'Cohort Analysis', text: 'Groups visitors by the week or month they first arrived and tracks what percentage came back on Day 1, 7, 30, etc. High day-30 retention = strong loyalty.' },
                    { label: 'Segments', text: 'Filter your audience by device, browser, country, or UTM source to compare behaviour across different groups.' },
                ]}
                businessTip="A healthy site should see returning visitor rate above 20-30%. If your cohort day-7 retention drops below 10%, focus on email capture or push notifications to bring people back."
                devTip="New vs returning is determined by a first-seen cookie set by the tracking script. Cohort data is aggregated from the events table grouped by DATE_TRUNC('week', first_seen). Segments apply WHERE clause filters."
            />

            {/* Top-level filters */}
            <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-4">
                <div className="flex flex-wrap items-center gap-3">
                    <Filter className="w-4 h-4 text-text-muted dark:text-text-muted-dark shrink-0" />
                    <select value={filters.device || ''} onChange={(e) => setFilters((f) => ({ ...f, device: e.target.value || undefined }))} className="px-3 py-1.5 rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark text-sm">
                        <option value="">All Devices</option>
                        <option value="Desktop">Desktop</option>
                        <option value="Mobile">Mobile</option>
                        <option value="Tablet">Tablet</option>
                    </select>
                    <select value={filters.browser || ''} onChange={(e) => setFilters((f) => ({ ...f, browser: e.target.value || undefined }))} className="px-3 py-1.5 rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark text-sm">
                        <option value="">All Browsers</option>
                        <option value="Chrome">Chrome</option>
                        <option value="Firefox">Firefox</option>
                        <option value="Safari">Safari</option>
                        <option value="Edge">Edge</option>
                    </select>
                    <input value={filters.country || ''} onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value || undefined }))} placeholder="Country…" className="px-3 py-1.5 rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark text-sm w-36" />
                    <input value={filters.source || ''} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value || undefined }))} placeholder="UTM source…" className="px-3 py-1.5 rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark text-sm w-36" />
                    {hasFilters && (
                        <button onClick={() => setFilters({})} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                            <X className="w-3.5 h-3.5" /> Clear
                        </button>
                    )}
                </div>
            </div>

            <div className="flex gap-1 bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-1">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 justify-center ${activeTab === id ? 'bg-accent text-white' : 'text-text-secondary dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                        <Icon className="w-4 h-4" /> {label}
                    </button>
                ))}
            </div>

            {activeTab === 'new-returning' && <NewVsReturningSection />}
            {activeTab === 'cohorts' && <CohortSection />}
            {activeTab === 'segments' && <SegmentsSection filters={filters} setFilters={setFilters} />}
        </div>
    );
}
