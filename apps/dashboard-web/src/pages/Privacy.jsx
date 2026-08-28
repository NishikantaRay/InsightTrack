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
            title: 'No Cookies',
            business: 'InsightsTrack sets no cookies. It uses first-party localStorage to generate a pseudonymous visitor identifier. Whether that removes a consent-banner obligation depends on your jurisdiction and deployment — consult applicable privacy/ePrivacy requirements.',
            dev: 'The visitor identifier is a random (not cryptographically random, and not a UUID) string stored in localStorage under the key _analytics_uid. It is cleared when the visitor clears browser storage. No Set-Cookie headers are sent by the tracking endpoints.',
        },
        {
            icon: Lock,
            color: 'text-indigo-500',
            bg: 'bg-indigo-500/10',
            title: 'Do Not Track (DNT) & Global Privacy Control (GPC)',
            business: 'Visitors who have told their browser "do not track me" are excluded from tracking. This respects the browser signal without any action needed from you.',
            dev: 'The script checks navigator.doNotTrack === "1" and navigator.globalPrivacyControl === true before any storage or network access. If either is set it exits immediately — no visitor id, session id, or request is created. The tracking API additionally declines to persist requests carrying DNT: 1 or Sec-GPC: 1, covering cached scripts and direct API calls.',
        },
        {
            icon: Database,
            color: 'text-violet-500',
            bg: 'bg-violet-500/10',
            title: 'Self-Hosted — Your Data, Your Servers',
            business: 'Visitor data stays on your own infrastructure. The tracking pipeline sends nothing to any third-party analytics company. You own the database and control access. Optional integrations you enable — Pulse AI providers, Sentry, S3/R2 storage — send data to those services by design.',
            dev: 'The backend is a standard Express + PostgreSQL + DuckDB stack. Deploy to any VPS, Docker host, or cloud provider. The tracking script calls your own domain, not a third-party CDN. The backend makes outbound calls only for integrations you configure (AI providers, Sentry, S3/R2).',
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
            title: 'Pseudonymous Visitor IDs Only',
            business: 'Visitor IDs are random identifiers with no connection to any personal information. They cannot be traced back to a specific person, email address, or account.',
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
                            InsightsTrack is built so that meaningful analytics and user privacy are not in conflict.
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
                    <h3 className="font-semibold text-gray-900 dark:text-white">Privacy Properties</h3>
                    <InfoTooltip
                        title="How to read this"
                        content="These are technical properties of the implementation, not a compliance determination. Regulations such as GDPR (Europe), CCPA (California) and PECR (UK) apply to your deployment as a whole — your lawful basis, notices, and processes. Consult applicable privacy/ePrivacy requirements for your situation."
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                        { ok: true, text: 'No cookies set' },
                        { ok: true, text: 'No name, email, or IP address stored' },
                        { ok: true, text: 'No cross-site tracking' },
                        { ok: true, text: 'Visitor data stays on your servers' },
                        { ok: true, text: 'Configurable retention with manual cleanup' },
                        { ok: true, text: 'DNT and GPC signals respected' },
                        { ok: true, text: 'No third-party processors in the tracking pipeline' },
                        { ok: true, text: 'Per-site data deletion (not per-visitor erasure)' },
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
                            <strong>Important:</strong> While InsightsTrack is designed to minimise privacy obligations, you should consult a legal professional to confirm compliance for your specific use case, jurisdiction, and any other tools you use on your website.
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
                    Every data point InsightsTrack collects is listed below. Nothing else is stored.
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
                                { field: 'Pseudonymous visitor ID', example: 'u_k3f9b2c1', personal: false, note: 'Random identifier; persists on the device until storage is cleared' },
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

