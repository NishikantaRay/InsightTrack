import { useState, useMemo, useEffect, useCallback } from 'react';
import { Megaphone, Share2, KeyRound, Search, ChevronLeft, ChevronRight, X, Link2, Copy, Check, Info, Trash2, Save, ExternalLink, Users, BarChart2 } from 'lucide-react';
import PageNote from '../components/ui/PageNote';
import FocusToggleButton from '../components/ui/FocusToggleButton';
import { useAnalytics } from '../hooks/useAnalytics';
import { useSiteStore } from '../store/useSiteStore';
import { reportingAPI, analyticsAPI } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useFocusModeStore } from '../store/useFocusModeStore';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
const PAGE_SIZE = 10;

function AcqPagination({ page, totalPages, onPrev, onNext, totalRows, filteredRows, query }) {
    return (
        <div className="flex items-center justify-between gap-4 pt-2 text-sm flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400">
                {query ? `${filteredRows} of ${totalRows} rows` : `${totalRows} rows`}
            </span>
            <div className="flex items-center gap-1">
                <button onClick={onPrev} disabled={page === 1} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums px-1">{page} / {totalPages}</span>
                <button onClick={onNext} disabled={page === totalPages} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

function CampaignsTab({ onBuildLink }) {
    const { data, loading } = useAnalytics('getCampaigns');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        if (!query.trim() || !data) return data || [];
        const q = query.toLowerCase();
        return data.filter((r) => [r.source, r.medium, r.campaign].some((v) => v?.toLowerCase().includes(q)));
    }, [data, query]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    if (loading) return <div className="animate-pulse h-96 bg-gray-100 dark:bg-gray-800 rounded-lg" />;
    if (!data?.length) return (
        <div className="text-center py-12 space-y-4">
            <p className="text-gray-500 dark:text-gray-400">No campaign data yet. UTM-tagged traffic will appear here.</p>
            <button onClick={() => onBuildLink({ source: 'google', medium: 'cpc', campaign: '' })}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors">
                <Link2 className="w-4 h-4" /> Create your first UTM link
            </button>
        </div>
    );

    const chartData = data.slice(0, 10);

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Campaign Performance</h3>
                <div className="h-72 mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                            <XAxis dataKey="campaign" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: 8, color: '#F9FAFB' }} />
                            <Bar dataKey="visitors" fill="#6366F1" radius={[4, 4, 0, 0]} name="Visitors" />
                            <Bar dataKey="pageviews" fill="#10B981" radius={[4, 4, 0, 0]} name="Pageviews" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="relative max-w-xs flex-1">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input type="text" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Filter campaigns…" className="w-full pl-8 pr-7 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-indigo-400" />
                            {query && <button onClick={() => { setQuery(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
                        </div>
                        <button onClick={() => onBuildLink({ source: '', medium: '', campaign: '' })}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors whitespace-nowrap">
                            <Link2 className="w-3.5 h-3.5" /> Build UTM Link
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                    <th className="py-3 px-4 font-medium">Source</th>
                                    <th className="py-3 px-4 font-medium">Medium</th>
                                    <th className="py-3 px-4 font-medium">Campaign</th>
                                    <th className="py-3 px-4 font-medium text-right">Visitors</th>
                                    <th className="py-3 px-4 font-medium text-right">Pageviews</th>
                                    <th className="py-3 px-4 font-medium text-right">Revenue</th>
                                    <th className="py-3 px-4 font-medium text-right">%</th>
                                    <th className="py-3 px-4 font-medium text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr><td colSpan={7} className="py-8 text-center text-sm text-gray-400 italic">No campaigns match &ldquo;{query}&rdquo;</td></tr>
                                ) : (
                                    rows.map((row, i) => (
                                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                            <td className="py-3 px-4 font-medium">{row.source}</td>
                                            <td className="py-3 px-4">{row.medium}</td>
                                            <td className="py-3 px-4">{row.campaign}</td>
                                            <td className="py-3 px-4 text-right font-semibold">{row.visitors?.toLocaleString()}</td>
                                            <td className="py-3 px-4 text-right">{row.pageviews?.toLocaleString()}</td>
                                            <td className="py-3 px-4 text-right">{row.revenue > 0 ? `$${row.revenue.toLocaleString()}` : '-'}</td>
                                            <td className="py-3 px-4 text-right">{row.percentage}%</td>
                                            <td className="py-3 px-4 text-right">
                                                <button onClick={() => onBuildLink({ source: row.source, medium: row.medium, campaign: row.campaign })}
                                                    className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1">
                                                    <Link2 className="w-3 h-3" /> Build
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <AcqPagination page={safePage} totalPages={totalPages} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))} totalRows={data.length} filteredRows={filtered.length} query={query} />
                </div>
            </div>
        </div>
    );
}

function SocialTab({ onBuildLink }) {
    const { data, loading } = useAnalytics('getSocialMedia');

    if (loading) return <div className="animate-pulse h-96 bg-gray-100 dark:bg-gray-800 rounded-lg" />;
    if (!data?.length) return (
        <div className="text-center py-12 space-y-4">
            <p className="text-gray-500 dark:text-gray-400">No social media traffic detected yet.</p>
            <button onClick={() => onBuildLink({ source: 'twitter', medium: 'social', campaign: '' })}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors">
                <Link2 className="w-4 h-4" /> Create a social UTM link
            </button>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Social Media Traffic</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={data} dataKey="visitors" nameKey="platform" cx="50%" cy="50%" outerRadius={100} label={({ platform, percentage }) => `${platform} ${percentage}%`}>
                                    {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: 8, color: '#F9FAFB' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                        {data.map((row, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                    <span className="font-medium text-gray-900 dark:text-white">{row.platform}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <div className="font-semibold text-gray-900 dark:text-white">{row.visitors?.toLocaleString()}</div>
                                        <div className="text-xs text-gray-500">{row.sessions} sessions</div>
                                    </div>
                                    <button onClick={() => onBuildLink({ source: row.platform?.toLowerCase(), medium: 'social', campaign: '' })}
                                        className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 whitespace-nowrap">
                                        <Link2 className="w-3 h-3" /> Build
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function KeywordsTab({ onBuildLink }) {
    const { data, loading } = useAnalytics('getSearchKeywords');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        if (!query.trim() || !data) return data || [];
        const q = query.toLowerCase();
        return data.filter((r) => [r.keyword, r.source].some((v) => v?.toLowerCase().includes(q)));
    }, [data, query]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    if (loading) return <div className="animate-pulse h-64 bg-gray-100 dark:bg-gray-800 rounded-lg" />;
    if (!data?.length) return (
        <div className="text-center py-12 space-y-4">
            <p className="text-gray-500 dark:text-gray-400">No keyword data. UTM term tracking will show results here.</p>
            <button onClick={() => onBuildLink({ source: 'google', medium: 'cpc', campaign: '', term: '' })}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors">
                <Link2 className="w-4 h-4" /> Create a keyword UTM link
            </button>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Search Keywords</h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="relative max-w-xs flex-1">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input type="text" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Filter keywords…" className="w-full pl-8 pr-7 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-indigo-400" />
                            {query && <button onClick={() => { setQuery(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
                        </div>
                        <button onClick={() => onBuildLink({ source: 'google', medium: 'cpc', campaign: '', term: '' })}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors whitespace-nowrap">
                            <Link2 className="w-3.5 h-3.5" /> Build UTM Link
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                    <th className="py-3 px-4 font-medium">Keyword</th>
                                    <th className="py-3 px-4 font-medium">Source</th>
                                    <th className="py-3 px-4 font-medium text-right">Visitors</th>
                                    <th className="py-3 px-4 font-medium text-right">Pageviews</th>
                                    <th className="py-3 px-4 font-medium text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr><td colSpan={4} className="py-8 text-center text-sm text-gray-400 italic">No keywords match &ldquo;{query}&rdquo;</td></tr>
                                ) : (
                                    rows.map((row, i) => (
                                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                            <td className="py-3 px-4 font-medium">{row.keyword}</td>
                                            <td className="py-3 px-4">{row.source}</td>
                                            <td className="py-3 px-4 text-right font-semibold">{row.visitors?.toLocaleString()}</td>
                                            <td className="py-3 px-4 text-right">{row.pageviews?.toLocaleString()}</td>
                                            <td className="py-3 px-4 text-right">
                                                <button onClick={() => onBuildLink({ source: row.source, medium: 'cpc', campaign: '', term: row.keyword })}
                                                    className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1">
                                                    <Link2 className="w-3 h-3" /> Build
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <AcqPagination page={safePage} totalPages={totalPages} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))} totalRows={data.length} filteredRows={filtered.length} query={query} />
                </div>
            </div>
        </div>
    );
}

export default function Acquisition() {
    const [activeTab, setActiveTab] = useState('campaigns');
    const [prefill, setPrefill] = useState(null);
    const { focusMode } = useFocusModeStore();

    const goToBuilder = (vals) => {
        setPrefill(vals);
        setActiveTab('builder');
    };

    const TABS = [
        { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
        { key: 'social', label: 'Social Media', icon: Share2 },
        { key: 'keywords', label: 'Keywords', icon: KeyRound },
        { key: 'builder', label: 'URL Builder', icon: Link2 },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                {!focusMode && (
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/10">
                            <Megaphone className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Acquisition</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Understand where your visitors come from</p>
                        </div>
                    </div>
                )}
                <FocusToggleButton />
            </div>

            {!focusMode && (
                <PageNote
                    title="What is Acquisition?"
                    summary="Acquisition shows you exactly how visitors found your website — through paid ads, social media, organic search, direct links, or email campaigns."
                    details={[
                        { label: 'Campaigns', text: 'Traffic tagged with UTM parameters (utm_source, utm_medium, utm_campaign). Use this to measure ROI of marketing spend.' },
                        { label: 'Social Media', text: 'Visits originating from social platforms like Facebook, Twitter, LinkedIn, and Instagram.' },
                        { label: 'Keywords', text: 'Search keywords that drove visitors to your site. Requires utm_term parameter on your links.' },
                        { label: 'URL Builder', text: 'A tool to generate properly formatted UTM links. Paste any URL and fill in the fields to build a tracked link.' },
                    ]}
                    businessTip="Focus on campaigns with the highest visitor-to-conversion ratio, not just traffic volume. A small campaign that converts well is more valuable than a high-traffic one that doesn’t."
                    devTip="UTM data is parsed from query strings on the tracking script and stored in the events table. Query via GET /api/analytics/:siteId/utm. The URL Builder is client-side only."
                />
            )}

            {/* How it works info banner */}
            <div className="flex gap-3 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800">
                <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                <div className="text-sm text-indigo-700 dark:text-indigo-300 space-y-1">
                    <p className="font-semibold">How acquisition tracking works</p>
                    <p className="text-indigo-600 dark:text-indigo-400">Add <span className="font-mono font-medium">UTM parameters</span> to any link pointing to your site. When a visitor clicks the link, InsightsTrack reads those parameters and attributes the visit to the correct campaign, source, and keyword.</p>
                    <p className="text-indigo-600 dark:text-indigo-400">Example: <span className="font-mono text-xs bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded">https://yoursite.com?utm_source=google&amp;utm_medium=cpc&amp;utm_campaign=spring&amp;utm_term=analytics+tool</span></p>
                </div>
            </div>

            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex-wrap">
                {TABS.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === key
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {activeTab === 'campaigns' && <CampaignsTab onBuildLink={goToBuilder} />}
            {activeTab === 'social' && <SocialTab onBuildLink={goToBuilder} />}
            {activeTab === 'keywords' && <KeywordsTab onBuildLink={goToBuilder} />}
            {activeTab === 'builder' && <URLBuilderTab prefill={prefill} onPrefillUsed={() => setPrefill(null)} />}
        </div>
    );
}

function URLBuilderTab({ prefill, onPrefillUsed }) {
    const siteId = useSiteStore((s) => s.siteId);
    const [url, setUrl] = useState('');
    const [source, setSource] = useState('');
    const [medium, setMedium] = useState('');
    const [campaign, setCampaign] = useState('');
    const [term, setTerm] = useState('');
    const [content, setContent] = useState('');
    const [label, setLabel] = useState('');

    useEffect(() => {
        if (!prefill) return;
        if (prefill.source !== undefined) setSource(prefill.source);
        if (prefill.medium !== undefined) setMedium(prefill.medium);
        if (prefill.campaign !== undefined) setCampaign(prefill.campaign);
        if (prefill.term !== undefined) setTerm(prefill.term || '');
        if (prefill.content !== undefined) setContent(prefill.content || '');
        onPrefillUsed?.();
    }, [prefill]);
    const [copied, setCopied] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState(null);
    const [savedLinks, setSavedLinks] = useState([]);
    const [loadingLinks, setLoadingLinks] = useState(false);
    const [linkStats, setLinkStats] = useState({});

    const builtUrl = useMemo(() => {
        if (!url.trim()) return '';
        try {
            const base = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
            const u = new URL(base);
            if (source.trim()) u.searchParams.set('utm_source', source.trim());
            if (medium.trim()) u.searchParams.set('utm_medium', medium.trim());
            if (campaign.trim()) u.searchParams.set('utm_campaign', campaign.trim());
            if (term.trim()) u.searchParams.set('utm_term', term.trim());
            if (content.trim()) u.searchParams.set('utm_content', content.trim());
            return u.toString();
        } catch {
            return '';
        }
    }, [url, source, medium, campaign, term, content]);

    const loadLinks = useCallback(async () => {
        if (!siteId) return;
        setLoadingLinks(true);
        try {
            const res = await reportingAPI.listUtmLinks(siteId);
            const links = res?.data || [];
            setSavedLinks(links);
            // Fetch visit stats for each link in parallel
            const statsEntries = await Promise.all(
                links.map(async (link) => {
                    try {
                        const s = await analyticsAPI.getUTMLinkStats(siteId, link.utm_source, link.utm_medium, link.utm_campaign);
                        return [link.id, s?.data || { visitors: 0, pageviews: 0 }];
                    } catch {
                        return [link.id, { visitors: 0, pageviews: 0 }];
                    }
                })
            );
            setLinkStats(Object.fromEntries(statsEntries));
        } catch {
            setSavedLinks([]);
        } finally {
            setLoadingLinks(false);
        }
    }, [siteId]);

    useEffect(() => { loadLinks(); }, [loadLinks]);

    const handleCopy = () => {
        if (!builtUrl) return;
        navigator.clipboard.writeText(builtUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyLink = (link) => {
        navigator.clipboard.writeText(link.built_url);
        setCopiedId(link.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleSave = async () => {
        if (!builtUrl || !siteId) return;
        if (!label.trim()) { setSaveMsg({ type: 'error', text: 'Enter a label to identify this link.' }); return; }
        setSaving(true);
        setSaveMsg(null);
        try {
            await reportingAPI.saveUtmLink(siteId, {
                label: label.trim(), url: url.trim(),
                utm_source: source.trim(), utm_medium: medium.trim(),
                utm_campaign: campaign.trim(), utm_term: term.trim(),
                utm_content: content.trim(), built_url: builtUrl,
            });
            setSaveMsg({ type: 'success', text: 'Link saved!' });
            setLabel('');
            loadLinks();
            setTimeout(() => setSaveMsg(null), 3000);
        } catch {
            setSaveMsg({ type: 'error', text: 'Failed to save link.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (linkId) => {
        if (!siteId) return;
        try {
            await reportingAPI.deleteUtmLink(siteId, linkId);
            setSavedLinks((prev) => prev.filter((l) => l.id !== linkId));
        } catch {
            // ignore
        }
    };

    const EXAMPLES = [
        { label: 'Google Ads', values: { source: 'google', medium: 'cpc', campaign: 'brand', term: 'analytics tool', content: '' } },
        { label: 'Email Newsletter', values: { source: 'newsletter', medium: 'email', campaign: 'may-2026', term: '', content: 'header-cta' } },
        { label: 'Twitter/X Post', values: { source: 'twitter', medium: 'social', campaign: 'launch', term: '', content: 'tweet-1' } },
        { label: 'Facebook Ad', values: { source: 'facebook', medium: 'paid-social', campaign: 'retargeting', term: '', content: 'carousel-v2' } },
    ];

    const applyExample = (vals) => {
        setSource(vals.source);
        setMedium(vals.medium);
        setCampaign(vals.campaign);
        setTerm(vals.term);
        setContent(vals.content);
    };

    const PARAMS = [
        { key: 'utm_source', label: 'Source', value: source, set: setSource, placeholder: 'google, newsletter, twitter…', required: true, desc: 'Where the traffic comes from' },
        { key: 'utm_medium', label: 'Medium', value: medium, set: setMedium, placeholder: 'cpc, email, social, organic…', required: true, desc: 'Marketing channel type' },
        { key: 'utm_campaign', label: 'Campaign', value: campaign, set: setCampaign, placeholder: 'spring-sale, launch-v2…', required: true, desc: 'Specific campaign name' },
        { key: 'utm_term', label: 'Keyword (term)', value: term, set: setTerm, placeholder: 'analytics tool, free plan…', required: false, desc: 'Paid keyword that triggered the ad' },
        { key: 'utm_content', label: 'Content', value: content, set: setContent, placeholder: 'banner-a, cta-blue…', required: false, desc: 'Differentiate ads or links in the same campaign' },
    ];

    return (
        <div className="space-y-6">
            {/* Quick-fill examples */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Quick-fill examples</h3>
                <div className="flex flex-wrap gap-2">
                    {EXAMPLES.map((ex) => (
                        <button key={ex.label} onClick={() => applyExample(ex.values)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-gray-600 dark:text-gray-400">
                            {ex.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Builder form */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-5">
                <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Website URL <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://yoursite.com/landing-page"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {PARAMS.map(({ key, label: lbl, value, set, placeholder, required, desc }) => (
                        <div key={key}>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-0.5">
                                {lbl} {required && <span className="text-red-400">*</span>}
                                <span className="font-normal text-gray-400 dark:text-gray-500 ml-1">— {desc}</span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono pointer-events-none">{key}=</span>
                                <input
                                    type="text" value={value} onChange={(e) => set(e.target.value)}
                                    placeholder={placeholder}
                                    className="w-full pl-28 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Generated URL + Save */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Generated URL</h3>
                    <button onClick={handleCopy} disabled={!builtUrl}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>
                {builtUrl ? (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 font-mono text-sm text-gray-800 dark:text-gray-200 break-all select-all mb-4">
                        {builtUrl}
                    </div>
                ) : (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-400 dark:text-gray-500 italic mb-4">
                        Fill in the Website URL and at least one parameter to generate a link.
                    </div>
                )}

                {/* Save row */}
                <div className="flex items-center gap-2 flex-wrap">
                    <input
                        type="text" value={label} onChange={(e) => setLabel(e.target.value)}
                        placeholder="Label for this link (e.g. Google Ads — May)"
                        className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400"
                    />
                    <button onClick={handleSave} disabled={!builtUrl || saving}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-green-500 hover:bg-green-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving…' : 'Save Link'}
                    </button>
                </div>
                {saveMsg && (
                    <p className={`mt-2 text-xs ${saveMsg.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                        {saveMsg.text}
                    </p>
                )}
            </div>

            {/* Saved Links */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Saved Links</h3>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{savedLinks.length} saved</span>
                </div>
                {loadingLinks ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">Loading…</p>
                ) : savedLinks.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center italic">
                        No saved links yet. Build a URL above and click "Save Link".
                    </p>
                ) : (
                    <div className="space-y-3">
                        {savedLinks.map((link) => (
                            <div key={link.id} className="flex items-start gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{link.label}</span>
                                        {link.utm_source && <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">{link.utm_source}</span>}
                                        {link.utm_medium && <span className="text-[10px] bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">{link.utm_medium}</span>}
                                        {link.utm_campaign && <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">{link.utm_campaign}</span>}
                                    </div>
                                    <p className="font-mono text-xs text-gray-500 dark:text-gray-400 break-all">{link.built_url}</p>
                                    {/* Visit stats */}
                                    <div className="flex items-center gap-4 mt-2">
                                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                            <Users className="w-3 h-3" />
                                            <strong className="text-gray-700 dark:text-gray-300">{linkStats[link.id]?.visitors ?? '…'}</strong> visitors
                                        </span>
                                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                            <BarChart2 className="w-3 h-3" />
                                            <strong className="text-gray-700 dark:text-gray-300">{linkStats[link.id]?.pageviews ?? '…'}</strong> pageviews
                                        </span>
                                        {linkStats[link.id]?.visitors > 0 ? (
                                            <span className="text-[10px] bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded font-medium">✓ Traffic detected</span>
                                        ) : (
                                            <span className="text-[10px] text-gray-400 dark:text-gray-600 italic">No visits yet</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">Saved {new Date(link.created_at).toLocaleDateString()}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <a href={link.built_url} target="_blank" rel="noopener noreferrer"
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors" title="Open URL">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                    <button onClick={() => handleCopyLink(link)}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors" title="Copy URL">
                                        {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                    <button onClick={() => handleDelete(link.id)}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Parameter reference */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">UTM Parameter Reference</h3>
                <div className="space-y-3">
                    {[
                        { param: 'utm_source', required: true, desc: 'Identifies who sends traffic.', example: 'google, bing, newsletter, twitter' },
                        { param: 'utm_medium', required: true, desc: 'The marketing channel or medium.', example: 'cpc, email, social, organic, referral' },
                        { param: 'utm_campaign', required: true, desc: 'The campaign name you are running.', example: 'spring-sale, product-launch, retargeting' },
                        { param: 'utm_term', required: false, desc: 'The paid keyword for the ad. Shows up in the Keywords tab.', example: 'analytics software, free dashboard, site tracker' },
                        { param: 'utm_content', required: false, desc: 'Differentiates ads/links in the same campaign (A/B test labels).', example: 'hero-banner, sidebar-cta, footer-link' },
                    ].map(({ param, required, desc, example }) => (
                        <div key={param} className="flex gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                            <div className="shrink-0 w-40">
                                <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">{param}</span>
                                {required && <span className="ml-1 text-[10px] text-red-400">required</span>}
                            </div>
                            <div>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{desc}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Examples: {example}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
