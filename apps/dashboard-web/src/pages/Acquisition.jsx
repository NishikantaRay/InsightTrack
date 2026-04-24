import { useState } from 'react';
import { Megaphone, Share2, KeyRound } from 'lucide-react';
import { useAnalytics } from '../hooks/useAnalytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

function CampaignsTab() {
    const { data, loading } = useAnalytics('getCampaigns');

    if (loading) return <div className="animate-pulse h-96 bg-gray-100 dark:bg-gray-800 rounded-lg" />;
    if (!data?.length) return <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No campaign data. UTM-tagged traffic will appear here.</p>;

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Campaign Performance</h3>
                <div className="h-72 mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                            <XAxis dataKey="campaign" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: 8, color: '#F9FAFB' }} />
                            <Bar dataKey="visitors" fill="#6366F1" radius={[4, 4, 0, 0]} name="Visitors" />
                            <Bar dataKey="pageviews" fill="#10B981" radius={[4, 4, 0, 0]} name="Pageviews" />
                        </BarChart>
                    </ResponsiveContainer>
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
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row, i) => (
                                <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="py-3 px-4 font-medium">{row.source}</td>
                                    <td className="py-3 px-4">{row.medium}</td>
                                    <td className="py-3 px-4">{row.campaign}</td>
                                    <td className="py-3 px-4 text-right font-semibold">{row.visitors?.toLocaleString()}</td>
                                    <td className="py-3 px-4 text-right">{row.pageviews?.toLocaleString()}</td>
                                    <td className="py-3 px-4 text-right">{row.revenue > 0 ? `$${row.revenue.toLocaleString()}` : '-'}</td>
                                    <td className="py-3 px-4 text-right">{row.percentage}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function SocialTab() {
    const { data, loading } = useAnalytics('getSocialMedia');

    if (loading) return <div className="animate-pulse h-96 bg-gray-100 dark:bg-gray-800 rounded-lg" />;
    if (!data?.length) return <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No social media traffic detected yet.</p>;

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
                                <div className="text-right">
                                    <div className="font-semibold text-gray-900 dark:text-white">{row.visitors?.toLocaleString()}</div>
                                    <div className="text-xs text-gray-500">{row.sessions} sessions</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function KeywordsTab() {
    const { data, loading } = useAnalytics('getSearchKeywords');

    if (loading) return <div className="animate-pulse h-64 bg-gray-100 dark:bg-gray-800 rounded-lg" />;
    if (!data?.length) return <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No keyword data. UTM term tracking will show results here.</p>;

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Search Keywords</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                <th className="py-3 px-4 font-medium">Keyword</th>
                                <th className="py-3 px-4 font-medium">Source</th>
                                <th className="py-3 px-4 font-medium text-right">Visitors</th>
                                <th className="py-3 px-4 font-medium text-right">Pageviews</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row, i) => (
                                <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                                    <td className="py-3 px-4 font-medium">{row.keyword}</td>
                                    <td className="py-3 px-4">{row.source}</td>
                                    <td className="py-3 px-4 text-right font-semibold">{row.visitors?.toLocaleString()}</td>
                                    <td className="py-3 px-4 text-right">{row.pageviews?.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default function Acquisition() {
    const [activeTab, setActiveTab] = useState('campaigns');

    const TABS = [
        { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
        { key: 'social', label: 'Social Media', icon: Share2 },
        { key: 'keywords', label: 'Keywords', icon: KeyRound },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                    <Megaphone className="w-6 h-6 text-green-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Acquisition</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Understand where your visitors come from</p>
                </div>
            </div>

            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
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

            {activeTab === 'campaigns' && <CampaignsTab />}
            {activeTab === 'social' && <SocialTab />}
            {activeTab === 'keywords' && <KeywordsTab />}
        </div>
    );
}
