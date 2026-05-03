import { useState, useCallback, useEffect } from 'react';
import { Calendar, Mail, LayoutDashboard, Download, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { useSiteStore } from '../store/useSiteStore';
import { useAnalytics } from '../hooks/useAnalytics';
import { reportingAPI, analyticsAPI } from '../services/api';
import toast from 'react-hot-toast';
import PageNote from '../components/ui/PageNote';

function AnnotationsTab() {
    const siteId = useSiteStore((s) => s.siteId);
    const { data, loading, refetch } = useAnalytics('getAnnotations');
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], title: '', description: '', category: 'general' });
    const [creating, setCreating] = useState(false);

    const handleCreate = useCallback(async () => {
        if (!form.title) return toast.error('Title is required');
        setCreating(true);
        try {
            await reportingAPI.createAnnotation(siteId, form);
            toast.success('Annotation created');
            setShowCreate(false);
            setForm({ date: new Date().toISOString().split('T')[0], title: '', description: '', category: 'general' });
            refetch();
        } catch (err) {
            toast.error(err.message || 'Failed to create');
        } finally {
            setCreating(false);
        }
    }, [form, siteId, refetch]);

    const handleDelete = useCallback(async (id) => {
        try {
            await reportingAPI.deleteAnnotation(siteId, id);
            toast.success('Deleted');
            refetch();
        } catch (err) {
            toast.error(err.message || 'Failed to delete');
        }
    }, [siteId, refetch]);

    const categoryColors = {
        general: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        deployment: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        marketing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        incident: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Timeline Annotations</h3>
                <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600 transition">
                    <Plus className="w-4 h-4" /> Add Annotation
                </button>
            </div>

            {showCreate && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
                        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
                        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                            <option value="general">General</option>
                            <option value="deployment">Deployment</option>
                            <option value="marketing">Marketing</option>
                            <option value="incident">Incident</option>
                        </select>
                    </div>
                    <textarea placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" rows={2} />
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
                        <button onClick={handleCreate} disabled={creating} className="px-4 py-1.5 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600 disabled:opacity-50">
                            {creating ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                {loading && <div className="animate-pulse h-32 bg-gray-100 dark:bg-gray-800 rounded-lg" />}
                {!loading && (!data?.length) && <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No annotations yet. Mark important events on your analytics timeline.</p>}
                {!loading && data?.length > 0 && (
                    <div className="space-y-3">
                        {data.map((ann) => (
                            <div key={ann.id} className="flex items-start justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                                <div className="flex gap-3">
                                    <div className="text-center shrink-0">
                                        <div className="text-lg font-bold text-gray-900 dark:text-white">{new Date(ann.date).getDate()}</div>
                                        <div className="text-xs text-gray-500">{new Date(ann.date).toLocaleString('default', { month: 'short' })}</div>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900 dark:text-white">{ann.title}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColors[ann.category] || categoryColors.general}`}>{ann.category}</span>
                                        </div>
                                        {ann.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{ann.description}</p>}
                                    </div>
                                </div>
                                <button onClick={() => handleDelete(ann.id)} className="text-gray-400 hover:text-red-500 p-1">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ScheduledReportsTab() {
    const siteId = useSiteStore((s) => s.siteId);
    const [reports, setReports] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ frequency: 'weekly', email: '', metrics: 'kpi,traffic,sources' });

    const load = useCallback(async () => {
        try {
            const res = await reportingAPI.listReports(siteId);
            setReports(res.data || []);
        } catch { /* empty */ }
        setLoaded(true);
    }, [siteId]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = useCallback(async () => {
        if (!form.email) return toast.error('Email is required');
        try {
            await reportingAPI.createReport(siteId, {
                frequency: form.frequency,
                email: form.email,
                metrics: form.metrics.split(',').map(s => s.trim()),
            });
            toast.success('Report scheduled');
            setShowCreate(false);
            setForm({ frequency: 'weekly', email: '', metrics: 'kpi,traffic,sources' });
            load();
        } catch (err) {
            toast.error(err.message || 'Failed');
        }
    }, [form, siteId, load]);

    const handleDelete = useCallback(async (id) => {
        try {
            await reportingAPI.deleteReport(siteId, id);
            toast.success('Deleted');
            load();
        } catch (err) {
            toast.error(err.message || 'Failed');
        }
    }, [siteId, load]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Scheduled Reports</h3>
                <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600 transition">
                    <Plus className="w-4 h-4" /> Schedule Report
                </button>
            </div>

            {showCreate && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
                        <input placeholder="Metrics (comma-separated)" value={form.metrics} onChange={(e) => setForm({ ...form, metrics: e.target.value })}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
                        <button onClick={handleCreate} className="px-4 py-1.5 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600">Create</button>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                {!loaded && <div className="animate-pulse h-32 bg-gray-100 dark:bg-gray-800 rounded-lg" />}
                {loaded && !reports.length && <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No scheduled reports. Set up automated email reports for your team.</p>}
                {loaded && reports.length > 0 && (
                    <div className="space-y-3">
                        {reports.map((r) => (
                            <div key={r.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                <div className="flex items-center gap-3">
                                    <Mail className="w-5 h-5 text-indigo-500" />
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">{r.email}</div>
                                        <div className="text-xs text-gray-500">{r.frequency} &middot; {(r.metrics || []).join(', ')}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                                        {r.enabled ? 'Active' : 'Paused'}
                                    </span>
                                    <button onClick={() => handleDelete(r.id)} className="text-gray-400 hover:text-red-500 p-1">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function DataExportTab() {
    const siteId = useSiteStore((s) => s.siteId);
    const [exporting, setExporting] = useState(null);

    const exportData = useCallback(async (type) => {
        setExporting(type);
        try {
            let data;
            const dateRange = '30d';
            switch (type) {
                case 'kpi': data = await analyticsAPI.getKPIs(siteId, dateRange); break;
                case 'traffic': data = await analyticsAPI.getTraffic(siteId, dateRange); break;
                case 'pages': data = await analyticsAPI.getTopPages(siteId, dateRange); break;
                case 'sources': data = await analyticsAPI.getSources(siteId, dateRange); break;
                default: return;
            }
            const content = JSON.stringify(data?.data || data, null, 2);
            const blob = new Blob([content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics-${type}-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(`${type} data exported`);
        } catch (err) {
            toast.error(err.message || 'Export failed');
        } finally {
            setExporting(null);
        }
    }, [siteId]);

    const exports = [
        { key: 'kpi', label: 'KPI Summary', desc: 'Key performance indicators for the last 30 days' },
        { key: 'traffic', label: 'Traffic Data', desc: 'Daily visitor and session counts' },
        { key: 'pages', label: 'Top Pages', desc: 'Most visited pages with metrics' },
        { key: 'sources', label: 'Traffic Sources', desc: 'Referrer and UTM source breakdown' },
    ];

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Export Data (JSON)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {exports.map(({ key, label, desc }) => (
                        <div key={key} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                            <div>
                                <div className="font-medium text-gray-900 dark:text-white">{label}</div>
                                <div className="text-xs text-gray-500">{desc}</div>
                            </div>
                            <button onClick={() => exportData(key)} disabled={exporting === key}
                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600 disabled:opacity-50 transition">
                                <Download className="w-4 h-4" />
                                {exporting === key ? 'Exporting...' : 'Export'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function Reporting() {
    const [activeTab, setActiveTab] = useState('annotations');

    const TABS = [
        { key: 'annotations', label: 'Annotations', icon: Calendar },
        { key: 'reports', label: 'Scheduled Reports', icon: Mail },
        { key: 'export', label: 'Data Export', icon: Download },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                    <LayoutDashboard className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reporting</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Annotations, scheduled reports, and data exports</p>
                </div>
            </div>

            <PageNote
                title="What is Reporting?"
                summary="Reporting gives you tools to communicate analytics insights across your team — annotate your charts, schedule automated email reports, and export raw data for deeper analysis."
                details={[
                    { label: 'Annotations', text: 'Mark important events on your timeline (e.g. "Launched new homepage", "Sent email campaign"). Helps you connect traffic changes to real-world actions.' },
                    { label: 'Scheduled Reports', text: 'Set up automatic weekly or monthly email digests with key metrics. Keep your whole team informed without anyone needing to log in.' },
                    { label: 'Data Export', text: 'Download your raw analytics data as CSV for use in spreadsheets, BI tools, or custom analysis. Always your data, no lock-in.' },
                ]}
                businessTip="Use annotations every time you make a significant change — new ad campaign, redesigned homepage, changed pricing. They help you understand WHY your metrics changed, not just that they did."
                devTip="Annotations are stored in the annotations table and overlaid on chart data client-side. Scheduled reports use node-cron to trigger email sends. Exports stream CSV directly from DuckDB via the /api/reporting/:siteId/export endpoint."
            />

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

            {activeTab === 'annotations' && <AnnotationsTab />}
            {activeTab === 'reports' && <ScheduledReportsTab />}
            {activeTab === 'export' && <DataExportTab />}
        </div>
    );
}
