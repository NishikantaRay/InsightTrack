import { useState, useCallback, useEffect } from 'react';
import { Shield, Clock, Eye, AlertCircle, CheckCircle2, Lock, Database, Globe, Code2, BookOpen, Info, Trash2 } from 'lucide-react';
import { useSiteStore } from '../store/useSiteStore';
import { reportingAPI } from '../services/api';
import toast from 'react-hot-toast';
import InfoTooltip from '../components/ui/InfoTooltip';

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
    const features = [
        {
            icon: Globe,
            color: 'text-green-500',
            bg: 'bg-green-500/10',
            title: 'No Cookies — No Consent Banner Required',
            business: 'You do not need to show a GDPR cookie banner. InsightTrack uses first-party localStorage to generate anonymous visitor IDs — no cookies means no cookie law obligations in most jurisdictions.',
            dev: 'Visitor ID is generated as a UUID stored in localStorage under the key _itv. This is cleared when the user clears browser storage. No Set-Cookie headers are ever sent by the tracking endpoints.',
        },
        {
            icon: Lock,
            color: 'text-indigo-500',
            bg: 'bg-indigo-500/10',
            title: 'Do Not Track (DNT) & Global Privacy Control (GPC)',
            business: 'Visitors who have told their browser "do not track me" are automatically excluded from all tracking. This respects user preference without any action needed from you.',
            dev: 'The tracking script checks navigator.doNotTrack === "1" and navigator.globalPrivacyControl === true at initialisation. If either is set, the script exits immediately — no events or sessions are created.',
        },
        {
            icon: Database,
            color: 'text-violet-500',
            bg: 'bg-violet-500/10',
            title: 'Self-Hosted — Your Data, Your Servers',
            business: 'All visitor data stays on your own infrastructure. Nothing is sent to any third-party analytics company. You own the database. You control access. You can delete everything at any time.',
            dev: 'The backend is a standard Express + PostgreSQL + DuckDB stack. Deploy to any VPS, Docker host, or cloud provider. No external network calls are made from the backend. The tracking script calls your own domain, not a third-party CDN.',
        },
        {
            icon: Shield,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            title: 'No IP Addresses Stored',
            business: 'We never store your visitors\' IP addresses. Location (country) is derived from the visitor\'s timezone setting in their browser — a much less sensitive signal that cannot be used to identify individuals.',
            dev: 'The tracking script reads Intl.DateTimeFormat().resolvedOptions().timeZone and maps it to a country via a client-side lookup table (no server call needed). The IP address from the HTTP request is discarded in the Express middleware before any database write.',
        },
        {
            icon: Eye,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            title: 'Anonymous Visitor IDs Only',
            business: 'Visitor IDs are random UUIDs with no connection to any personal information. They cannot be traced back to a specific person, email address, or account.',
            dev: 'IDs are generated using crypto.randomUUID() in the tracking script. They are stored only in the events and sessions tables alongside behavioural data. There is no users table in the analytics database — only the auth database has user records.',
        },
        {
            icon: Code2,
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
            title: 'Lightweight Script — Under 5KB',
            business: 'The tracking snippet loads asynchronously and adds less than 5KB to your page. It does not slow down your website or affect Core Web Vitals scores.',
            dev: 'The script is served as a raw JS IIFE from GET /api/sites/:siteId/script with Cache-Control headers. It uses fetch() and navigator.sendBeacon() — no external dependencies, no SDK to install or update.',
        },
    ];

    return (
        <div className="space-y-6">
            {/* Hero banner */}
            <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800/50 p-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/10">
                        <Shield className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mb-1">
                            Privacy-first analytics, by design
                        </h2>
                        <p className="text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed max-w-2xl">
                            InsightTrack is built so that meaningful analytics and user privacy are not in conflict.
                            No cookies. No fingerprinting. No IP storage. No third-party data sharing.
                            Just honest, accurate analytics that you own.
                        </p>
                    </div>
                </div>
            </div>

            {/* GDPR compliance summary */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">GDPR / CCPA / PECR Compliance Summary</h3>
                    <InfoTooltip
                        title="What are these regulations?"
                        content="GDPR (Europe), CCPA (California), and PECR (UK) are data privacy laws that regulate how websites can collect and use visitor data. Most analytics tools require cookie consent banners to comply. InsightTrack is designed to be compliant without needing consent banners."
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                        { ok: true, text: 'No cookie consent banner needed' },
                        { ok: true, text: 'No personal data collected or stored' },
                        { ok: true, text: 'No cross-site tracking' },
                        { ok: true, text: 'Visitor data stays on your servers' },
                        { ok: true, text: 'Automatic data retention & deletion' },
                        { ok: true, text: 'DNT and GPC signals respected' },
                        { ok: true, text: 'No third-party data processors' },
                        { ok: true, text: 'Right to erasure: delete any site\'s data instantly' },
                    ].map(({ ok, text }) => (
                        <div key={text} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <CheckCircle2 className={`w-4 h-4 shrink-0 ${ok ? 'text-green-500' : 'text-red-400'}`} />
                            {text}
                        </div>
                    ))}
                </div>
                <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                    <div className="flex gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 dark:text-amber-300">
                            <strong>Important:</strong> While InsightTrack is designed to minimise privacy obligations, you should consult a legal professional to confirm compliance for your specific use case, jurisdiction, and any other tools you use on your website.
                        </p>
                    </div>
                </div>
            </div>

            {/* Feature cards — business + dev view */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Privacy Features — How They Work</h3>
                {features.map(({ icon: Icon, color, bg, title, business, dev }) => (
                    <div key={title} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                        <div className="flex items-start gap-3 mb-3">
                            <div className={`p-2 rounded-lg ${bg} shrink-0`}>
                                <Icon className={`w-5 h-5 ${color}`} />
                            </div>
                            <h4 className="font-semibold text-gray-900 dark:text-white pt-1">{title}</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-11">
                            <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30">
                                <span className="text-base leading-none shrink-0">💼</span>
                                <div>
                                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">For Business Owners</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{business}</p>
                                </div>
                            </div>
                            <div className="flex gap-2 p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-900/30">
                                <span className="text-base leading-none shrink-0">🛠️</span>
                                <div>
                                    <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-1">For Developers</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-mono">{dev}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* What data IS collected */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">What data is actually collected?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Every data point InsightTrack collects is listed below. Nothing else is stored.
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                                <th className="py-2 pr-4 text-gray-500 dark:text-gray-400 font-medium">Data Point</th>
                                <th className="py-2 pr-4 text-gray-500 dark:text-gray-400 font-medium">Example</th>
                                <th className="py-2 text-gray-500 dark:text-gray-400 font-medium">Personal? <InfoTooltip content="'Personal data' under GDPR means any information that can be used to identify a natural person, directly or indirectly." /></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {[
                                { field: 'Page URL', example: '/products/widget', personal: false },
                                { field: 'Referrer URL', example: 'https://google.com', personal: false },
                                { field: 'Browser type', example: 'Chrome 120', personal: false },
                                { field: 'Device type', example: 'Desktop', personal: false },
                                { field: 'Country (from timezone)', example: 'India', personal: false },
                                { field: 'Screen resolution', example: '1920×1080', personal: false },
                                { field: 'UTM parameters', example: 'utm_source=google', personal: false },
                                { field: 'Anonymous visitor ID', example: 'a3f9b2c1-...', personal: false, note: 'Random UUID, no link to real identity' },
                                { field: 'Session ID', example: 'sess_a1b2c3', personal: false },
                                { field: 'Event type & timestamp', example: 'pageview at 14:32', personal: false },
                                { field: 'Scroll depth', example: '75%', personal: false },
                                { field: 'Web Vitals metrics', example: 'LCP: 1800ms', personal: false },
                            ].map(({ field, example, personal, note }) => (
                                <tr key={field} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300 font-medium">
                                        {field}
                                        {note && <span className="ml-1.5 text-xs text-gray-400">({note})</span>}
                                    </td>
                                    <td className="py-2 pr-4 font-mono text-xs text-gray-500 dark:text-gray-400">{example}</td>
                                    <td className="py-2">
                                        {personal
                                            ? <span className="px-2 py-0.5 rounded text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">Yes</span>
                                            : <span className="px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">No</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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

