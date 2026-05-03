import { useState, useCallback, useMemo } from 'react';
import { Target, FlaskConical, DollarSign, Plus, Trash2, TrendingUp, ArrowUpRight, ArrowDownRight, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAnalytics } from '../hooks/useAnalytics';
import { useSiteStore } from '../store/useSiteStore';
import { goalsAPI } from '../services/api';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import toast from 'react-hot-toast';
import PageNote from '../components/ui/PageNote';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const PAGE_SIZE = 10;

function RevPagination({ page, totalPages, onPrev, onNext, totalRows, filteredRows, query }) {
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

function RevenueBySourceTable({ bySource }) {
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        if (!query.trim()) return bySource;
        const q = query.toLowerCase();
        return bySource.filter((r) => r.source?.toLowerCase().includes(q));
    }, [bySource, query]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    return (
        <div className="space-y-3">
            <div className="relative max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input type="text" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Filter sources…" className="w-full pl-8 pr-7 py-1.5 text-sm rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark placeholder:text-text-muted focus:outline-none focus:border-accent" />
                {query && <button onClick={() => { setQuery(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"><X className="w-3 h-3" /></button>}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border dark:border-border-dark">
                            <th className="text-left py-2 text-text-secondary dark:text-text-secondary-dark font-medium">Source</th>
                            <th className="text-right py-2 text-text-secondary dark:text-text-secondary-dark font-medium">Revenue</th>
                            <th className="text-right py-2 text-text-secondary dark:text-text-secondary-dark font-medium">Purchases</th>
                            <th className="text-right py-2 text-text-secondary dark:text-text-secondary-dark font-medium">Avg Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={4} className="py-8 text-center text-sm text-text-muted dark:text-text-muted-dark italic">No sources match &ldquo;{query}&rdquo;</td></tr>
                        ) : (
                            rows.map((row) => (
                                <tr key={row.source} className="border-b border-border/50 dark:border-border-dark/50 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                                    <td className="py-2.5 text-text-primary dark:text-text-primary-dark font-medium">{row.source}</td>
                                    <td className="py-2.5 text-right text-emerald-500 font-semibold">${row.revenue.toLocaleString()}</td>
                                    <td className="py-2.5 text-right text-text-secondary dark:text-text-secondary-dark">{row.purchases}</td>
                                    <td className="py-2.5 text-right text-text-secondary dark:text-text-secondary-dark">${row.avgValue}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <RevPagination page={safePage} totalPages={totalPages} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))} totalRows={bySource.length} filteredRows={filtered.length} query={query} />
        </div>
    );
}

function GoalsSection() {
    const siteId = useSiteStore((s) => s.siteId);
    const { data: conversions, loading: convLoading, refetch } = useAnalytics('getGoalConversions');
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', type: 'page_visit', path: '', eventType: '', selector: '' });
    const [creating, setCreating] = useState(false);
    const [selectedGoalId, setSelectedGoalId] = useState(null);
    const { data: trendData } = useAnalytics('getGoalConversionsOverTime', {
        params: { goalId: selectedGoalId },
        enabled: !!selectedGoalId,
    });

    const handleCreate = useCallback(async () => {
        if (!form.name) return toast.error('Goal name is required');
        setCreating(true);
        try {
            const config = {};
            if (form.type === 'page_visit') config.path = form.path || '/';
            else if (form.type === 'event') config.eventType = form.eventType || 'custom';
            else if (form.type === 'click') config.selector = form.selector;
            await goalsAPI.create(siteId, { name: form.name, type: form.type, config });
            toast.success('Goal created');
            setShowCreate(false);
            setForm({ name: '', type: 'page_visit', path: '', eventType: '', selector: '' });
            refetch();
        } catch (err) {
            toast.error(err.message || 'Failed to create goal');
        } finally {
            setCreating(false);
        }
    }, [form, siteId, refetch]);

    const handleDelete = useCallback(async (goalId) => {
        try {
            await goalsAPI.delete(siteId, goalId);
            toast.success('Goal deleted');
            refetch();
        } catch (err) {
            toast.error(err.message || 'Failed to delete goal');
        }
    }, [siteId, refetch]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10">
                        <Target className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">Conversion Goals</h2>
                        <p className="text-sm text-text-muted dark:text-text-muted-dark">Track how many visitors complete key actions</p>
                    </div>
                </div>
                <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium">
                    <Plus className="w-4 h-4" /> New Goal
                </button>
            </div>

            {showCreate && (
                <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-5 space-y-4">
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Goal name (e.g., Signup completion)" className="w-full px-4 py-2 rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark text-sm" />
                    <div className="flex gap-3">
                        {['page_visit', 'event', 'click'].map((t) => (
                            <button key={t} onClick={() => setForm({ ...form, type: t })} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${form.type === t ? 'bg-accent text-white' : 'bg-bg dark:bg-bg-dark text-text-secondary dark:text-text-secondary-dark border border-border dark:border-border-dark'}`}>
                                {t === 'page_visit' ? 'Page Visit' : t === 'event' ? 'Event' : 'Click'}
                            </button>
                        ))}
                    </div>
                    {form.type === 'page_visit' && <input value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="Page path (e.g., /signup)" className="w-full px-4 py-2 rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark text-sm" />}
                    {form.type === 'event' && <input value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} placeholder="Event type (e.g., purchase, signup)" className="w-full px-4 py-2 rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark text-sm" />}
                    {form.type === 'click' && <input value={form.selector} onChange={(e) => setForm({ ...form, selector: e.target.value })} placeholder="CSS selector (e.g., #cta-button)" className="w-full px-4 py-2 rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark text-sm" />}
                    <div className="flex gap-3">
                        <button onClick={handleCreate} disabled={creating} className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 text-sm font-medium disabled:opacity-50">{creating ? 'Creating...' : 'Create Goal'}</button>
                        <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-text-secondary dark:text-text-secondary-dark text-sm">Cancel</button>
                    </div>
                </div>
            )}

            {convLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl bg-card dark:bg-card-dark animate-pulse" />)}
                </div>
            ) : conversions?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {conversions.map((goal) => (
                        <div key={goal.goalId} onClick={() => setSelectedGoalId(goal.goalId)} className={`relative bg-card dark:bg-card-dark rounded-xl border p-5 cursor-pointer transition-all hover:shadow-md ${selectedGoalId === goal.goalId ? 'border-accent ring-1 ring-accent/30' : 'border-border dark:border-border-dark'}`}>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(goal.goalId); }} className="absolute top-3 right-3 p-1 text-text-muted hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <p className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-1">{goal.goalName}</p>
                            <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">{goal.conversions.toLocaleString()}</p>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500">{goal.type.replace('_', ' ')}</span>
                                <span className="text-sm font-semibold text-emerald-500">{goal.conversionRate}%</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark">
                    <Target className="w-10 h-10 text-text-muted dark:text-text-muted-dark mx-auto mb-3" />
                    <p className="text-text-secondary dark:text-text-secondary-dark">No goals defined yet. Create your first conversion goal.</p>
                </div>
            )}

            {selectedGoalId && trendData && (
                <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-5">
                    <h3 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-4">Conversions Over Time</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
                            <YAxis tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
                            <Area type="monotone" dataKey="conversions" stroke="#6366F1" fill="#6366F1" fillOpacity={0.1} strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}

function ABTestsSection() {
    const { data: testResults, loading } = useAnalytics('getABTestResults');

    if (loading) return <div className="h-48 rounded-xl bg-card dark:bg-card-dark animate-pulse" />;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                    <FlaskConical className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">A/B Tests</h2>
                    <p className="text-sm text-text-muted dark:text-text-muted-dark">Compare variants and see which performs better</p>
                </div>
            </div>

            {testResults?.length > 0 ? testResults.map((test) => (
                <div key={test.testId} className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-text-primary dark:text-text-primary-dark">{test.testName}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${test.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-500/10 text-gray-500'}`}>{test.status}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {test.variants.map((variant, idx) => {
                            const isWinner = test.variants.length > 1 && variant.conversionRate === Math.max(...test.variants.map(v => v.conversionRate)) && variant.conversionRate > 0;
                            return (
                                <div key={idx} className={`p-4 rounded-lg border ${isWinner ? 'border-emerald-500 bg-emerald-500/5' : 'border-border dark:border-border-dark'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-sm text-text-primary dark:text-text-primary-dark">{variant.name}</span>
                                        {isWinner && <span className="text-xs px-2 py-0.5 bg-emerald-500 text-white rounded-full">Winner</span>}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div>
                                            <p className="text-lg font-bold text-text-primary dark:text-text-primary-dark">{variant.visitors}</p>
                                            <p className="text-xs text-text-muted dark:text-text-muted-dark">Visitors</p>
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold text-text-primary dark:text-text-primary-dark">{variant.conversions}</p>
                                            <p className="text-xs text-text-muted dark:text-text-muted-dark">Conversions</p>
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold text-emerald-500">{variant.conversionRate}%</p>
                                            <p className="text-xs text-text-muted dark:text-text-muted-dark">Conv. Rate</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )) : (
                <div className="text-center py-12 bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark">
                    <FlaskConical className="w-10 h-10 text-text-muted dark:text-text-muted-dark mx-auto mb-3" />
                    <p className="text-text-secondary dark:text-text-secondary-dark">No A/B tests running. Create tests via the API to start comparing variants.</p>
                </div>
            )}
        </div>
    );
}

function RevenueSection() {
    const { data: revenue, loading } = useAnalytics('getRevenue');

    if (loading) return <div className="h-48 rounded-xl bg-card dark:bg-card-dark animate-pulse" />;

    const summary = revenue?.summary || {};
    const daily = revenue?.daily || [];
    const bySource = revenue?.bySource || [];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">Revenue Attribution</h2>
                    <p className="text-sm text-text-muted dark:text-text-muted-dark">Track purchase events and see where your income comes from</p>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Revenue', value: `$${summary.totalRevenue?.toLocaleString() || '0'}`, color: 'text-emerald-500' },
                    { label: 'Purchases', value: summary.totalPurchases?.toLocaleString() || '0', color: 'text-indigo-500' },
                    { label: 'Avg Order Value', value: `$${summary.avgOrderValue || '0'}`, color: 'text-amber-500' },
                    { label: 'Unique Buyers', value: summary.uniqueBuyers?.toLocaleString() || '0', color: 'text-purple-500' },
                ].map((card) => (
                    <div key={card.label} className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-4">
                        <p className="text-xs text-text-muted dark:text-text-muted-dark mb-1">{card.label}</p>
                        <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                    </div>
                ))}
            </div>

            {daily.length > 0 && (
                <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-5">
                    <h3 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-4">Revenue Over Time</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={daily}>
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
                            <YAxis tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
                            <Tooltip contentStyle={{ borderRadius: '8px' }} />
                            <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {bySource.length > 0 && (
                <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-5">
                    <h3 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-4">Revenue by Source</h3>
                    <RevenueBySourceTable bySource={bySource} />
                </div>
            )}
        </div>
    );
}

const TABS = [
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'ab-tests', label: 'A/B Tests', icon: FlaskConical },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
];

export default function Conversions() {
    const [activeTab, setActiveTab] = useState('goals');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">Conversions & Funnels</h1>
                <p className="text-text-muted dark:text-text-muted-dark mt-1">Track goals, compare A/B tests, and measure revenue</p>
            </div>

            <PageNote
                title="What are Conversions?"
                summary="Conversions measure the actions that matter most to your business — sign-ups, purchases, button clicks, or time spent. Everything here is tied directly to business outcomes."
                details={[
                    { label: 'Goals', text: 'Define what a “conversion” means for you: a page visit, a button click, a custom event, or a minimum time on site. The dashboard then tracks how many visitors complete each goal.' },
                    { label: 'A/B Tests', text: 'Compare two versions of a page or feature. InsightTrack tracks which variant gets more conversions so you can pick a winner with real data.' },
                    { label: 'Revenue', text: 'Track purchase events with a value attached. See total revenue, revenue by traffic source, and average order value.' },
                ]}
                businessTip="Start with one high-value goal (e.g. sign-up or purchase). Measure it for 2 weeks, then set up an A/B test on your main CTA button to try to improve it."
                devTip="Goals are stored in the goals table. Conversions fire when the tracking script emits an event matching the goal config. A/B test variants are assigned by the frontend and sent as a custom event. Revenue uses track event with type=purchase and a value field."
            />

            <div className="flex gap-1 bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-1">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 justify-center ${activeTab === id ? 'bg-accent text-white' : 'text-text-secondary dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                        <Icon className="w-4 h-4" /> {label}
                    </button>
                ))}
            </div>

            {activeTab === 'goals' && <GoalsSection />}
            {activeTab === 'ab-tests' && <ABTestsSection />}
            {activeTab === 'revenue' && <RevenueSection />}
        </div>
    );
}
