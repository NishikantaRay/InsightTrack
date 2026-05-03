import { useState } from 'react';
import { useSiteStore } from '../store/useSiteStore';
import {
    Copy, Check, Code, Server, Bell, Globe, Info, ChevronDown, ChevronUp,
    BookOpen, Zap, Database, Shield, AlertTriangle, ExternalLink, Settings as SettingsIcon
} from 'lucide-react';
import AlertsPanel from '../components/charts/AlertsPanel';
import SiteManager from '../components/ui/SiteManager';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import InfoTooltip from '../components/ui/InfoTooltip';
import PageNote from '../components/ui/PageNote';

const _raw = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_BASE = /^https?:\/\//i.test(_raw) ? _raw : `https://${_raw}`;

function CopyButton({ value, size = 'sm' }) {
    const [copied, setCopied] = useState(false);
    const handle = async () => {
        try { await navigator.clipboard.writeText(value); }
        catch {
            const ta = document.createElement('textarea');
            ta.value = value; document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button onClick={handle}
            className={`flex items-center gap-1 rounded-md border border-border dark:border-border-dark
                bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 transition-colors
                ${size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`}
            title="Copy">
            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-text-muted dark:text-text-muted-dark" />}
            {copied ? 'Copied!' : 'Copy'}
        </button>
    );
}

function Section({ icon: Icon, iconColor = 'text-accent', title, subtitle, children, action }) {
    return (
        <div className="rounded-xl border border-border dark:border-border-dark bg-card dark:bg-card-dark overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border dark:border-border-dark">
                <div className={`p-1.5 rounded-lg bg-gray-100 dark:bg-white/10 shrink-0`}>
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">{title}</h3>
                    {subtitle && <p className="text-xs text-text-muted dark:text-text-muted-dark mt-0.5">{subtitle}</p>}
                </div>
                {action}
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

export default function Settings() {
    const { siteId, sites } = useSiteStore();
    const [tab, setTab] = useState('sites');

    const activeSite = sites?.find(s => s.id === siteId);
    const trackingSnippet = siteId ? `<script src="${API_BASE}/api/sites/${siteId}/script"></script>` : '';

    const tabs = [
        { id: 'sites', label: 'Sites', icon: Globe },
        { id: 'tracking', label: 'Tracking', icon: Code },
        { id: 'config', label: 'Connection', icon: Server },
        { id: 'alerts', label: 'Alerts', icon: Bell },
    ];

    return (
        <div className="space-y-6">
            <PageNote
                title="Settings — Site Management & Tracking"
                summary="Add and switch between multiple websites, get your tracking snippet, and configure alert thresholds."
                details={[
                    { label: 'Sites', text: 'Each website you want to track needs its own site entry. Switch between them using the site selector in the top bar.' },
                    { label: 'Tracking Script', text: 'A one-line script tag that goes in your website\'s <head>. It auto-tracks pageviews, clicks, scroll depth, performance metrics, and errors — no extra code needed.' },
                    { label: 'Custom Events', text: 'After adding the script, you can fire custom events with window.trackEvent("name", { key: value }). Use these for purchases, sign-ups, or any action you care about.' },
                    { label: 'Alerts', text: 'Set thresholds for traffic drops or spikes. InsightTrack checks these automatically and flags anomalies on your dashboard.' },
                ]}
                businessTip="Add a new site for each domain you want to track. Paste the one-line script into your website's header — no developer needed for most website builders."
                devTip="The tracking script is dynamically served from /api/sites/:siteId/script. It fingerprints visitors using a hashed localStorage ID — no cookies, no PII. Use window.trackEvent() for custom instrumentation."
            />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-text-primary dark:text-text-primary-dark">Settings</h1>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                        {activeSite
                            ? <>Active site: <span className="font-medium text-accent">{activeSite.name}</span> <span className="text-text-muted dark:text-text-muted-dark font-mono text-xs">({activeSite.domain})</span></>
                            : 'No site selected — add one below to start tracking'}
                    </p>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit flex-wrap">
                {tabs.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTab(id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                            ${tab === id
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                    </button>
                ))}
            </div>

            {/* ── Sites tab ── */}
            {tab === 'sites' && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 px-4 py-3 flex items-start gap-3 text-sm">
                        <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        <div className="text-indigo-700 dark:text-indigo-300">
                            <strong>How multi-site tracking works:</strong> Each site gets a unique ID. The tracking script is bound to that ID — events from one site never appear in another.
                            Switch the active site using the dropdown in the top navigation bar.
                        </div>
                    </div>
                    <ErrorBoundary fallbackMessage="Failed to load site manager.">
                        <SiteManager />
                    </ErrorBoundary>
                </div>
            )}

            {/* ── Tracking tab ── */}
            {tab === 'tracking' && (
                <div className="space-y-5">
                    {!siteId && (
                        <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 flex items-start gap-3 text-sm">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-amber-700 dark:text-amber-300">No site selected. Go to the <button onClick={() => setTab('sites')} className="underline font-medium">Sites tab</button> to add or select a site first.</p>
                        </div>
                    )}

                    {siteId && (
                        <>
                            {/* Main snippet */}
                            <Section icon={Code} iconColor="text-indigo-500" title="Tracking Script"
                                subtitle="Paste inside <head> on every page of your website">
                                <div className="space-y-3">
                                    <div className="relative group">
                                        <pre className="px-4 py-3 pr-16 rounded-lg bg-gray-900 text-green-400 text-xs font-mono overflow-x-auto select-all leading-relaxed">
                                            {trackingSnippet}
                                        </pre>
                                        <div className="absolute top-2 right-2">
                                            <CopyButton value={trackingSnippet} size="sm" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                        {[
                                            { icon: Zap, color: 'text-amber-500', label: 'Auto-tracked', items: ['Pageviews & SPA nav', 'Clicks & outbound links', 'Form submissions', 'Scroll depth (25/50/75/100%)', 'Rage clicks', 'Core Web Vitals (LCP/CLS/INP)', 'JS errors'] },
                                            { icon: Code, color: 'text-indigo-500', label: 'Custom events API', items: ['window.trackEvent(name, props)', 'window.trackAddToCart(product, price)', 'window.trackCheckout(items)', 'window.trackPurchase(amount)'] },
                                            { icon: Shield, color: 'text-emerald-500', label: 'Privacy-safe', items: ['No cookies set', 'No IP addresses stored', 'Anonymous visitor ID only', 'Respects DNT & GPC signals', 'Script size < 5 KB'] },
                                        ].map(({ icon: Icon, color, label, items }) => (
                                            <div key={label} className="rounded-lg border border-border dark:border-border-dark p-3 space-y-1.5">
                                                <div className="flex items-center gap-1.5 mb-2">
                                                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                                                    <span className="font-semibold text-text-primary dark:text-text-primary-dark">{label}</span>
                                                </div>
                                                {items.map(i => <div key={i} className="text-text-secondary dark:text-text-secondary-dark">✓ {i}</div>)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Section>

                            {/* Custom events examples */}
                            <Section icon={Zap} iconColor="text-amber-500" title="Custom Event Examples"
                                subtitle="Optional — fire these after the tracking script is loaded">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        {
                                            label: 'E-commerce purchase', code: `// After successful checkout
window.trackPurchase(49.99);
window.trackEvent('order_complete', {
  order_id: 'ORD-1234',
  items: 3,
  revenue: 49.99
});` },
                                        {
                                            label: 'Sign-up / lead form', code: `// After form submission
window.trackEvent('signup', {
  plan: 'free',
  source: 'homepage_hero'
});` },
                                        {
                                            label: 'Add to cart', code: `// When user clicks Add to Cart
window.trackAddToCart('Blue Widget', 29.99);` },
                                        {
                                            label: 'Video engagement', code: `// When video reaches 50%
video.addEventListener('timeupdate', () => {
  if (pct === 50) window.trackEvent('video_50pct', {
    video: 'product-demo'
  });
});` },
                                    ].map(({ label, code }) => (
                                        <div key={label} className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-wide">{label}</span>
                                                <CopyButton value={code} size="sm" />
                                            </div>
                                            <pre className="text-[11px] font-mono bg-gray-50 dark:bg-gray-800/50 border border-border dark:border-border-dark rounded-lg p-3 text-text-secondary dark:text-text-secondary-dark overflow-x-auto leading-relaxed">{code}</pre>
                                        </div>
                                    ))}
                                </div>
                            </Section>

                            {/* Platform guides */}
                            <Section icon={Globe} iconColor="text-blue-500" title="Platform Installation Guides"
                                subtitle="How to add the snippet on common platforms">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    {[
                                        { name: 'WordPress', steps: ['Go to Appearance → Theme Editor (or use a plugin like Insert Headers and Footers)', 'Open header.php or add the snippet to the "Scripts in Header" field', 'Paste the tracking script and save'] },
                                        { name: 'Webflow', steps: ['Site Settings → Custom Code → Head Code', 'Paste the script tag', 'Publish your site'] },
                                        { name: 'Shopify', steps: ['Online Store → Themes → Edit Code', 'Open layout/theme.liquid', 'Paste inside <head> and save'] },
                                        { name: 'Next.js / React', steps: ['Add to _app.jsx or app/layout.tsx in <Head>', 'Use next/script with strategy="afterInteractive"', 'Or use useEffect to inject dynamically'] },
                                        { name: 'Squarespace', steps: ['Settings → Advanced → Code Injection', 'Paste in the Header field', 'Save and refresh your site'] },
                                        { name: 'Static HTML', steps: ['Open each .html file', 'Paste the script tag inside <head>', 'Upload/deploy the updated files'] },
                                    ].map(({ name, steps }) => (
                                        <div key={name} className="rounded-lg border border-border dark:border-border-dark p-3">
                                            <p className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">{name}</p>
                                            <ol className="space-y-1 list-decimal list-inside text-text-secondary dark:text-text-secondary-dark">
                                                {steps.map((s, i) => <li key={i}>{s}</li>)}
                                            </ol>
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        </>
                    )}
                </div>
            )}

            {/* ── Connection tab ── */}
            {tab === 'config' && (
                <div className="space-y-4">
                    <Section icon={Server} iconColor="text-green-500" title="API Connection"
                        subtitle="Current backend configuration">
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-2 text-sm">
                                {[
                                    {
                                        label: 'API Base URL',
                                        value: API_BASE,
                                        tip: 'Set via VITE_API_URL environment variable at build time',
                                        mono: true,
                                    },
                                    {
                                        label: 'Active Site ID',
                                        value: siteId || 'None selected',
                                        tip: 'The currently selected site. All dashboard queries use this ID.',
                                        mono: true,
                                    },
                                    {
                                        label: 'Analytics Endpoint',
                                        value: siteId ? `${API_BASE}/api/analytics/${siteId}` : '—',
                                        tip: 'Base path for all analytics GET requests',
                                        mono: true,
                                    },
                                    {
                                        label: 'Tracking Endpoint',
                                        value: `${API_BASE}/api/track`,
                                        tip: 'Where the tracking script sends events — no auth required',
                                        mono: true,
                                    },
                                ].map(({ label, value, tip, mono }) => (
                                    <div key={label} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-border dark:border-border-dark">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className="text-xs font-medium text-text-muted dark:text-text-muted-dark">{label}</span>
                                                <InfoTooltip content={tip} size="w-3 h-3" />
                                            </div>
                                            <span className={`text-sm text-text-primary dark:text-text-primary-dark break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
                                        </div>
                                        {value && value !== '—' && <CopyButton value={value} size="sm" />}
                                    </div>
                                ))}
                            </div>

                            <div className="rounded-lg border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 text-xs text-indigo-700 dark:text-indigo-300">
                                <strong>To change the API URL:</strong> set the <code className="font-mono bg-indigo-100 dark:bg-indigo-900 px-1 rounded">VITE_API_URL</code> environment variable before building the frontend.
                                In Docker, edit the <code className="font-mono bg-indigo-100 dark:bg-indigo-900 px-1 rounded">environment:</code> section of <code className="font-mono bg-indigo-100 dark:bg-indigo-900 px-1 rounded">docker-compose.v2.yml</code>.
                            </div>
                        </div>
                    </Section>

                    <Section icon={Database} iconColor="text-purple-500" title="Database Architecture"
                        subtitle="How InsightTrack stores and queries your data">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="rounded-lg border-2 border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 p-3 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <Database className="w-4 h-4 text-indigo-500" />
                                    <span className="font-semibold text-indigo-800 dark:text-indigo-200">PostgreSQL — Writes</span>
                                </div>
                                <div className="text-indigo-700 dark:text-indigo-300 space-y-1">
                                    <div>✓ All tracking events stored here first</div>
                                    <div>✓ Auth, site config, funnels, goals</div>
                                    <div>✓ ACID-compliant — no data loss on crash</div>
                                </div>
                            </div>
                            <div className="rounded-lg border-2 border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 p-3 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-purple-500" />
                                    <span className="font-semibold text-purple-800 dark:text-purple-200">DuckDB — Reads</span>
                                </div>
                                <div className="text-purple-700 dark:text-purple-300 space-y-1">
                                    <div>✓ All analytics queries run here</div>
                                    <div>✓ Hot tier (RAM): last 30 days</div>
                                    <div>✓ Cold tier (Parquet): older history</div>
                                </div>
                            </div>
                        </div>
                        <p className="mt-3 text-xs text-text-muted dark:text-text-muted-dark">
                            A sync worker runs every 5 minutes, copying new rows from PostgreSQL → DuckDB using a watermark to avoid duplicates. See the <strong>Documentation → Developer → Architecture</strong> tab for the full hot/cold deep-dive.
                        </p>
                    </Section>
                </div>
            )}

            {/* ── Alerts tab ── */}
            {tab === 'alerts' && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 flex items-start gap-3 text-sm">
                        <Bell className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-amber-700 dark:text-amber-300">
                            <strong>Traffic Alerts</strong> — InsightTrack checks your recent visitor count and flags unusual drops or spikes.
                            Set your thresholds below. Alerts appear on the main Dashboard and in the Realtime page.
                        </div>
                    </div>
                    <ErrorBoundary fallbackMessage="Failed to load alerts.">
                        <AlertsPanel />
                    </ErrorBoundary>
                </div>
            )}
        </div>
    );
}
