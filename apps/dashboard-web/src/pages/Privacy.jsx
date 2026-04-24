import { useState, useCallback, useEffect } from 'react';
import { Shield, Clock, Eye, AlertCircle } from 'lucide-react';
import { useSiteStore } from '../store/useSiteStore';
import { reportingAPI } from '../services/api';
import toast from 'react-hot-toast';

function DataRetentionTab() {
    const siteId = useSiteStore((s) => s.siteId);
    const [policy, setPolicy] = useState(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(365);
    const [enabled, setEnabled] = useState(true);
    const [saving, setSaving] = useState(false);
    const [cleaning, setCleaning] = useState(false);

    useEffect(() => {
        if (!siteId) return;
        reportingAPI.getRetention(siteId)
            .then((res) => {
                const p = res.data;
                if (p) {
                    setPolicy(p);
                    setDays(p.retention_days || 365);
                    setEnabled(p.enabled !== false);
                }
            })
            .catch(() => { /* no policy yet */ })
            .finally(() => setLoading(false));
    }, [siteId]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            await reportingAPI.upsertRetention(siteId, { retention_days: days, enabled });
            toast.success('Retention policy saved');
        } catch (err) {
            toast.error(err.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    }, [siteId, days, enabled]);

    const handleCleanup = useCallback(async () => {
        setCleaning(true);
        try {
            const res = await reportingAPI.runCleanup(siteId);
            toast.success(`Cleanup complete: ${res.data?.deletedEvents || 0} events, ${res.data?.deletedSessions || 0} sessions removed`);
        } catch (err) {
            toast.error(err.message || 'Cleanup failed');
        } finally {
            setCleaning(false);
        }
    }, [siteId]);

    const retentionOptions = [
        { value: 30, label: '30 days' },
        { value: 90, label: '90 days' },
        { value: 180, label: '6 months' },
        { value: 365, label: '1 year' },
        { value: 730, label: '2 years' },
    ];

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Clock className="w-5 h-5 text-indigo-500" />
                    <h3 className="font-medium text-gray-900 dark:text-white">Data Retention Policy</h3>
                </div>
                {loading ? (
                    <div className="animate-pulse h-32 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Enable automatic data cleanup</span>
                            </label>
                        </div>
                        <div>
                            <label className="text-sm text-gray-500 dark:text-gray-400 block mb-2">Keep data for:</label>
                            <div className="flex flex-wrap gap-2">
                                {retentionOptions.map(({ value, label }) => (
                                    <button key={value} onClick={() => setDays(value)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${days === value
                                                ? 'bg-indigo-500 text-white'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                            }`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={handleSave} disabled={saving}
                                className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600 disabled:opacity-50 transition">
                                {saving ? 'Saving...' : 'Save Policy'}
                            </button>
                            <button onClick={handleCleanup} disabled={cleaning}
                                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 disabled:opacity-50 transition">
                                {cleaning ? 'Running...' : 'Run Cleanup Now'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-400">Data older than the retention period will be permanently deleted when cleanup runs.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function PrivacyFeaturesTab() {
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Eye className="w-5 h-5 text-green-500" />
                    <h3 className="font-medium text-gray-900 dark:text-white">Built-in Privacy Features</h3>
                </div>
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30">
                        <div className="w-2 h-2 mt-2 rounded-full bg-green-500 shrink-0" />
                        <div>
                            <div className="font-medium text-gray-900 dark:text-white">Do Not Track (DNT) Respect</div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                The tracking script automatically respects the <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">Do Not Track</code> browser header and <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">Global Privacy Control</code>. Users who enable these settings are not tracked.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30">
                        <div className="w-2 h-2 mt-2 rounded-full bg-green-500 shrink-0" />
                        <div>
                            <div className="font-medium text-gray-900 dark:text-white">No Third-Party Cookies</div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Visitor identification uses first-party <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">localStorage</code> only. No cookies are set, and no data is shared with third parties.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30">
                        <div className="w-2 h-2 mt-2 rounded-full bg-green-500 shrink-0" />
                        <div>
                            <div className="font-medium text-gray-900 dark:text-white">Self-Hosted Data</div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                All analytics data is stored on your own infrastructure. No data leaves your servers. Full GDPR compliance through data ownership.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30">
                        <div className="w-2 h-2 mt-2 rounded-full bg-green-500 shrink-0" />
                        <div>
                            <div className="font-medium text-gray-900 dark:text-white">Lightweight Tracking Script</div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                The tracking script is under 5KB and does not slow down your site. It collects only essential analytics data — no fingerprinting, no PII.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    <h3 className="font-medium text-gray-900 dark:text-white">GDPR Compliance Notes</h3>
                </div>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                        <span className="text-yellow-500 mt-0.5">•</span>
                        No cookie banner required — InsightTrack does not use cookies
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-yellow-500 mt-0.5">•</span>
                        Anonymous user IDs are randomly generated, not tied to personal data
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-yellow-500 mt-0.5">•</span>
                        Use the Data Retention tab to configure automatic deletion of old data
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-yellow-500 mt-0.5">•</span>
                        No IP addresses are stored — country is inferred from timezone
                    </li>
                </ul>
            </div>
        </div>
    );
}

export default function Privacy() {
    const [activeTab, setActiveTab] = useState('features');

    const TABS = [
        { key: 'features', label: 'Privacy Features', icon: Eye },
        { key: 'retention', label: 'Data Retention', icon: Clock },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Shield className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Privacy & Compliance</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Data retention, GDPR compliance, and privacy controls</p>
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

            {activeTab === 'features' && <PrivacyFeaturesTab />}
            {activeTab === 'retention' && <DataRetentionTab />}
        </div>
    );
}
