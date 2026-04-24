import { useState } from 'react';
import {
    Server, Database, Globe, Zap, RefreshCw, ArrowRight, Shield, Code2,
    Terminal, ChevronDown, ChevronRight, Copy, Check, FileText, MousePointerClick,
    Clock, Eye, BarChart3, Users, Layers, GitBranch, Activity, Settings as SettingsIcon,
    Target, Megaphone, TrendingUp, Map, BookOpen, Lock, Cloud, Gauge
} from 'lucide-react';

const apiEndpoints = [
    {
        group: 'Analytics',
        prefix: '/api/analytics/:siteId',
        color: 'text-purple-500',
        bg: 'bg-purple-50 dark:bg-purple-500/10',
        routes: [
            { method: 'GET', path: '/kpi', desc: 'KPI summary (visitors, pageviews, bounce rate, avg duration)' },
            { method: 'GET', path: '/traffic', desc: 'Traffic over time' },
            { method: 'GET', path: '/pageviews', desc: 'Pageview trends' },
            { method: 'GET', path: '/top-pages', desc: 'Most visited pages' },
            { method: 'GET', path: '/sources', desc: 'Traffic sources breakdown' },
            { method: 'GET', path: '/devices', desc: 'Device type distribution' },
            { method: 'GET', path: '/countries', desc: 'Visitor countries' },
            { method: 'GET', path: '/sessions', desc: 'Session duration stats' },
            { method: 'GET', path: '/realtime', desc: 'Live visitor count' },
            { method: 'GET', path: '/realtime/event-stream', desc: 'Server-sent live event feed' },
            { method: 'GET', path: '/funnel', desc: 'Conversion funnel data' },
            { method: 'GET', path: '/utm', desc: 'UTM campaign analytics' },
            { method: 'GET', path: '/user-flow', desc: 'Page navigation paths' },
            { method: 'GET', path: '/alerts', desc: 'Traffic anomaly alerts' },
            { method: 'GET', path: '/bounce-rate-trend', desc: 'Bounce rate over time' },
            { method: 'GET', path: '/avg-session-trend', desc: 'Avg session duration over time' },
            { method: 'GET', path: '/comparison', desc: 'Compare vs previous period' },
            { method: 'GET', path: '/all', desc: 'All analytics in one call' },
            { method: 'GET', path: '/engagement/summary', desc: 'Scroll depth, clicks, time-on-page KPIs' },
            { method: 'GET', path: '/engagement/scroll-depth', desc: 'Per-page scroll depth milestones' },
            { method: 'GET', path: '/engagement/heatmap', desc: 'Click coordinates for a specific page' },
            { method: 'GET', path: '/engagement/heatmap-summary', desc: 'Top clicked elements across all pages' },
        ],
    },
    {
        group: 'Tracking',
        prefix: '/api/track',
        color: 'text-blue-500',
        bg: 'bg-blue-50 dark:bg-blue-500/10',
        routes: [
            { method: 'POST', path: '/event', desc: 'Track a single event' },
            { method: 'POST', path: '/pageview', desc: 'Track a pageview' },
            { method: 'POST', path: '/session', desc: 'Create or update session' },
            { method: 'POST', path: '/session/end', desc: 'End session with final duration' },
            { method: 'POST', path: '/batch', desc: 'Batch multiple events' },
            { method: 'GET', path: '/pixel.gif', desc: '1×1 pixel for email tracking' },
        ],
    },
    {
        group: 'Sites',
        prefix: '/api/sites',
        color: 'text-green-500',
        bg: 'bg-green-50 dark:bg-green-500/10',
        routes: [
            { method: 'GET', path: '/', desc: 'List all sites for current user' },
            { method: 'POST', path: '/', desc: 'Create a new site' },
            { method: 'GET', path: '/:siteId', desc: 'Get site details' },
            { method: 'PUT', path: '/:siteId', desc: 'Update site name / domain' },
            { method: 'DELETE', path: '/:siteId', desc: 'Delete site and all its data' },
            { method: 'GET', path: '/:siteId/script', desc: 'Serve tracking script (JS)' },
            { method: 'GET', path: '/:siteId/snippet', desc: 'Get HTML embed snippet' },
        ],
    },
    {
        group: 'Goals & A/B Tests',
        prefix: '/api/goals',
        color: 'text-amber-500',
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        routes: [
            { method: 'GET', path: '/:siteId', desc: 'List all goals for a site' },
            { method: 'POST', path: '/:siteId', desc: 'Create a goal (pageview / event / duration / scroll)' },
            { method: 'DELETE', path: '/:siteId/:goalId', desc: 'Delete a goal' },
            { method: 'GET', path: '/:siteId/ab-tests', desc: 'List A/B tests' },
            { method: 'POST', path: '/:siteId/ab-tests', desc: 'Create an A/B test' },
            { method: 'PUT', path: '/:siteId/ab-tests/:testId/status', desc: 'Update test status (draft / running / completed)' },
            { method: 'DELETE', path: '/:siteId/ab-tests/:testId', desc: 'Delete an A/B test' },
        ],
    },
    {
        group: 'Reporting',
        prefix: '/api/reporting',
        color: 'text-teal-500',
        bg: 'bg-teal-50 dark:bg-teal-500/10',
        routes: [
            { method: 'GET', path: '/:siteId/annotations', desc: 'List timeline annotations' },
            { method: 'POST', path: '/:siteId/annotations', desc: 'Create annotation (deployment, marketing, incident…)' },
            { method: 'DELETE', path: '/:siteId/annotations/:annotationId', desc: 'Delete annotation' },
            { method: 'GET', path: '/:siteId/reports', desc: 'List scheduled reports' },
            { method: 'POST', path: '/:siteId/reports', desc: 'Create scheduled report' },
            { method: 'PUT', path: '/:siteId/reports/:reportId', desc: 'Update report schedule' },
            { method: 'DELETE', path: '/:siteId/reports/:reportId', desc: 'Delete scheduled report' },
            { method: 'GET', path: '/:siteId/dashboards', desc: 'List custom dashboards' },
            { method: 'POST', path: '/:siteId/dashboards', desc: 'Create custom dashboard' },
            { method: 'PUT', path: '/:siteId/dashboards/:dashboardId', desc: 'Update dashboard layout' },
            { method: 'DELETE', path: '/:siteId/dashboards/:dashboardId', desc: 'Delete custom dashboard' },
            { method: 'GET', path: '/:siteId/retention', desc: 'Get data retention policy' },
            { method: 'PUT', path: '/:siteId/retention', desc: 'Update retention period (days)' },
            { method: 'POST', path: '/:siteId/retention/cleanup', desc: 'Manually trigger expired data deletion' },
        ],
    },
    {
        group: 'Auth',
        prefix: '/api/auth',
        color: 'text-rose-500',
        bg: 'bg-rose-50 dark:bg-rose-500/10',
        routes: [
            { method: 'POST', path: '/register', desc: 'Register new user account' },
            { method: 'POST', path: '/login', desc: 'Login — returns JWT bearer token' },
            { method: 'GET', path: '/me', desc: 'Get current user profile' },
            { method: 'PUT', path: '/me', desc: 'Update profile name / password' },
        ],
    },
];

const dbTables = [
    { name: 'events', cols: 'id, site_id, user_id, session_id, type, url, path, referrer, device, browser, os, country, timestamp, properties, utm_*', purpose: 'Raw event log' },
    { name: 'sessions', cols: 'id, site_id, user_id, started_at, ended_at, duration, pageviews, entry_page, exit_page, is_bounce, utm_*', purpose: 'Session aggregates' },
    { name: 'sites', cols: 'id, user_id, name, domain, created_at', purpose: 'Registered websites' },
    { name: 'users', cols: 'id, name, email, password, role, created_at', purpose: 'User accounts' },
    { name: 'funnels', cols: 'id, site_id, name, steps (JSON), created_at', purpose: 'Funnel definitions' },
    { name: 'goals', cols: 'id, site_id, name, type, config (JSON), created_at', purpose: 'Conversion goals' },
    { name: 'ab_tests', cols: 'id, site_id, name, description, variants (JSON), status, created_at', purpose: 'A/B test experiments' },
    { name: 'annotations', cols: 'id, site_id, title, description, date, category, created_at', purpose: 'Timeline annotations' },
    { name: 'report_schedules', cols: 'id, site_id, name, frequency, recipients (JSON), enabled, config (JSON)', purpose: 'Scheduled report delivery' },
    { name: 'custom_dashboards', cols: 'id, site_id, name, description, widgets (JSON), created_at', purpose: 'Saved dashboard layouts' },
    { name: 'data_retention_policies', cols: 'id, site_id, retention_days, created_at, updated_at', purpose: 'Per-site data retention config' },
    { name: 'daily_stats', cols: 'id, site_id, date, visitors, sessions, pageviews, bounces, avg_duration', purpose: 'Pre-aggregated daily rollups' },
];

const trackingEvents = [
    { event: 'pageview', desc: 'Every page load + SPA navigation', auto: true },
    { event: 'click', desc: 'Outbound link clicks + data-track elements', auto: true },
    { event: 'form_submit', desc: 'All form submissions', auto: true },
    { event: 'scroll_depth', desc: 'Max scroll % (25/50/75/100) on page unload', auto: true },
    { event: 'heatmap_click', desc: 'Click x/y coordinates + CSS selector', auto: true },
    { event: 'rage_click', desc: '3+ rapid clicks on same element within 1s', auto: true },
    { event: 'time_on_page', desc: 'Seconds spent on page (sent on unload)', auto: true },
    { event: 'web_vital', desc: 'LCP, FID, CLS, INP, TTFB via PerformanceObserver', auto: true },
    { event: 'js_error', desc: 'window.onerror + unhandledrejection captures', auto: true },
    { event: 'site_search', desc: 'Search query from form interception', auto: true },
    { event: 'add_to_cart', desc: 'trackAddToCart(product, price)', auto: false },
    { event: 'checkout', desc: 'trackCheckout(items)', auto: false },
    { event: 'purchase', desc: 'trackPurchase(amount)', auto: false },
    { event: 'custom', desc: 'trackCustomEvent(type, props)', auto: false },
];

const dashboardPages = [
    { icon: BarChart3, name: 'Dashboard', path: '/', desc: 'KPI cards with sparklines, traffic + pageview charts, bounce rate trend, period comparison' },
    { icon: FileText, name: 'Pages', path: '/pages', desc: 'Top pages table with pageview counts, unique visitors, % of traffic, configurable limit' },
    { icon: Activity, name: 'Realtime', path: '/realtime', desc: 'Live active visitors, world map, live pages list, device breakdown, event stream' },
    { icon: Eye, name: 'Engagement', path: '/engagement', desc: 'Scroll depth milestones, click heatmaps, rage click detection, time-on-page stats' },
    { icon: Users, name: 'Audience', path: '/audience', desc: 'New vs returning, cohort retention heatmap, visitor segments by device/browser/OS/country' },
    { icon: BookOpen, name: 'Content', path: '/content', desc: 'Entry pages, exit pages, site search queries with frequency counts' },
    { icon: Megaphone, name: 'Acquisition', path: '/acquisition', desc: 'UTM campaign dashboard, social media traffic breakdown, search keywords' },
    { icon: Gauge, name: 'Performance', path: '/performance', desc: 'Core Web Vitals (LCP/FID/CLS/INP/TTFB) with color-coded thresholds, JS error tracking' },
    { icon: Layers, name: 'Funnels', path: '/funnels', desc: 'Multi-step conversion funnel with per-stage drop-off rates and visual narrowing chart' },
    { icon: GitBranch, name: 'User Flow', path: '/user-flow', desc: 'Sankey-style page navigation diagram with entry/transition/exit nodes' },
    { icon: Target, name: 'Conversions', path: '/conversions', desc: 'Goal tracking, A/B test management and results, revenue attribution' },
    { icon: TrendingUp, name: 'Reporting', path: '/reporting', desc: 'Timeline annotations, scheduled reports, custom dashboards, JSON data export' },
    { icon: Lock, name: 'Privacy', path: '/privacy', desc: 'DNT/GPC status, data retention policy config, manual cleanup trigger' },
    { icon: SettingsIcon, name: 'Settings', path: '/settings', desc: 'Site management (add/edit/delete), tracking snippet, site selector' },
    { icon: Users, name: 'Profile', path: '/profile', desc: 'User account name, email, password update' },
];

function CodeBlock({ children, label }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(children);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="relative group">
            {label && <span className="text-[10px] font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-wider">{label}</span>}
            <pre className="mt-1 text-xs leading-relaxed bg-gray-50 dark:bg-gray-800/50 border border-border dark:border-border-dark rounded-lg p-3 overflow-x-auto font-mono text-text-secondary dark:text-text-secondary-dark">
                {children}
            </pre>
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-white dark:bg-gray-700 border border-border dark:border-border-dark opacity-0 group-hover:opacity-100 transition-opacity"
            >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-text-muted dark:text-text-muted-dark" />}
            </button>
        </div>
    );
}

function Collapsible({ title, icon: Icon, color, children, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-xl border border-border dark:border-border-dark bg-card dark:bg-card-dark overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
                {Icon && <Icon className={`w-5 h-5 ${color || 'text-accent'}`} />}
                <span className="font-semibold text-text-primary dark:text-text-primary-dark flex-1">{title}</span>
                {open ? <ChevronDown className="w-4 h-4 text-text-muted dark:text-text-muted-dark" /> : <ChevronRight className="w-4 h-4 text-text-muted dark:text-text-muted-dark" />}
            </button>
            {open && <div className="px-5 pb-5 border-t border-border dark:border-border-dark pt-4">{children}</div>}
        </div>
    );
}

function MethodBadge({ method }) {
    const colors = {
        GET: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
        POST: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
        PUT: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
        DELETE: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
    };
    return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors[method]}`}>{method}</span>;
}

export default function Documentation() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">Documentation</h1>
                <p className="mt-1 text-text-secondary dark:text-text-secondary-dark">
                    Complete reference for InsightTrack — architecture, APIs, tracking, deployment, and all dashboard features.
                </p>
            </div>

            {/* Architecture Overview */}
            <div className="rounded-xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-5">
                <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-accent" /> Architecture Overview
                </h2>
                <div className="flex flex-col md:flex-row items-center gap-4">
                    {/* Clients */}
                    <div className="flex flex-col gap-3 shrink-0 w-full md:w-auto">
                        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-500/20">
                            <Globe className="w-4 h-4 text-blue-500" />
                            <div>
                                <div className="text-sm font-semibold">Your Website</div>
                                <div className="text-[10px] text-text-muted dark:text-text-muted-dark">(tracking script)</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-cyan-50 dark:bg-cyan-500/10 rounded-lg border border-cyan-200 dark:border-cyan-500/20">
                            <BarChart3 className="w-4 h-4 text-cyan-500" />
                            <div>
                                <div className="text-sm font-semibold">Dashboard</div>
                                <div className="text-[10px] text-text-muted dark:text-text-muted-dark">React SPA · Cloudflare Pages</div>
                            </div>
                        </div>
                    </div>
                    {/* Arrows */}
                    <div className="flex flex-col gap-4 items-center shrink-0">
                        <div className="text-center">
                            <ArrowRight className="w-4 h-4 text-text-muted dark:text-text-muted-dark mx-auto hidden md:block" />
                            <span className="text-[9px] text-text-muted dark:text-text-muted-dark font-medium">POST /api/track/*</span>
                        </div>
                        <div className="text-center">
                            <ArrowRight className="w-4 h-4 text-text-muted dark:text-text-muted-dark mx-auto rotate-180 hidden md:block" />
                            <span className="text-[9px] text-text-muted dark:text-text-muted-dark font-medium">GET /api/analytics/*</span>
                        </div>
                    </div>
                    {/* Backend */}
                    <div className="flex-1 w-full bg-green-50 dark:bg-green-500/10 rounded-lg border border-green-200 dark:border-green-500/20 p-3.5">
                        <div className="flex items-center gap-2 mb-3">
                            <Server className="w-4 h-4 text-green-500" />
                            <div>
                                <div className="text-sm font-semibold">Unified Backend</div>
                                <div className="text-[10px] text-text-muted dark:text-text-muted-dark">Express + Node.js · Railway</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 justify-center">
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded border border-indigo-200 dark:border-indigo-500/20">
                                <Database className="w-3.5 h-3.5 text-indigo-500" />
                                <div className="text-xs font-semibold">PG <span className="font-normal text-text-muted dark:text-text-muted-dark text-[9px]">(writes)</span></div>
                            </div>
                            <div className="flex flex-col items-center">
                                <RefreshCw className="w-3 h-3 text-amber-500" />
                                <span className="text-[8px] text-amber-600 dark:text-amber-400 font-medium">sync</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 dark:bg-purple-500/10 rounded border border-purple-200 dark:border-purple-500/20">
                                <Zap className="w-3.5 h-3.5 text-purple-500" />
                                <div className="text-xs font-semibold">DuckDB <span className="font-normal text-text-muted dark:text-text-muted-dark text-[9px]">(reads)</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Start */}
            <Collapsible title="Quick Start (Local / Docker)" icon={Terminal} color="text-green-500" defaultOpen>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <CodeBlock label="Docker (recommended)">{`# Clone and start everything
git clone <repo>
cd traffic
docker-compose up --build

# Services:
# http://localhost:4173  → Dashboard
# http://localhost:3001  → Backend API
# http://localhost:8080  → Demo site
# http://localhost:5050  → pgAdmin`}</CodeBlock>
                    </div>
                    <div>
                        <CodeBlock label="Manual setup">{`# 1. PostgreSQL
docker run -d --name analytics-pg \\
  -e POSTGRES_USER=analytics \\
  -e POSTGRES_PASSWORD=analytics123 \\
  -e POSTGRES_DB=analytics_db \\
  -p 5432:5432 postgres:16-alpine

# 2. Backend
cd apps/analytics-api
npm install && npm run migrate
npm run seed && npm run init
npm run sync && npm start

# 3. Dashboard
cd apps/dashboard-web
npm install && npm run dev`}</CodeBlock>
                    </div>
                    <div>
                        <CodeBlock label="Add Tracking Script">{`<!-- Paste in your website's <head> -->
<script src="https://your-backend.railway.app/api/sites/YOUR_SITE_ID/script"></script>`}</CodeBlock>
                    </div>
                    <div>
                        <CodeBlock label="Custom Events">{`// Manual event tracking
window.trackEvent('purchase', { amount: 49.99 });
window.trackAddToCart('Widget', 29.99);
window.trackCheckout([{ name: 'Widget', qty: 1 }]);
window.trackPurchase(29.99);`}</CodeBlock>
                    </div>
                </div>
            </Collapsible>

            {/* Deployment */}
            <Collapsible title="Production Deployment (Railway + Cloudflare Pages)" icon={Cloud} color="text-sky-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2"><Server className="w-4 h-4 text-green-500" /> Backend → Railway</h3>
                        <ol className="space-y-2 text-xs text-text-secondary dark:text-text-secondary-dark list-decimal list-inside">
                            <li>Create a Railway project and connect your GitHub repo</li>
                            <li>Add a <strong>PostgreSQL</strong> database plugin — <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded font-mono">DATABASE_URL</code> is injected automatically</li>
                            <li>Set <strong>Root Directory</strong> to <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded font-mono">apps/analytics-api</code></li>
                            <li>Add required env vars (see table below)</li>
                            <li>Set Start Command to <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded font-mono">npm run migrate &amp;&amp; npm run init &amp;&amp; npm start</code></li>
                            <li>Optionally attach a <strong>Volume</strong> at <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded font-mono">/data</code> for DuckDB persistence</li>
                        </ol>
                        <div className="rounded-lg border border-border dark:border-border-dark overflow-hidden">
                            <table className="w-full text-xs">
                                <thead><tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-border dark:border-border-dark">
                                    <th className="px-3 py-2 text-left font-medium text-text-muted dark:text-text-muted-dark">Variable</th>
                                    <th className="px-3 py-2 text-left font-medium text-text-muted dark:text-text-muted-dark">Value</th>
                                </tr></thead>
                                <tbody>
                                    {[
                                        ['DATABASE_URL', 'Auto-injected by PostgreSQL plugin'],
                                        ['JWT_SECRET', 'Long random string'],
                                        ['CORS_ORIGINS', 'https://your-app.pages.dev'],
                                        ['NODE_ENV', 'production'],
                                        ['DUCKDB_PATH', '/data/analytics.duckdb'],
                                    ].map(([k, v]) => (
                                        <tr key={k} className="border-b border-border/50 dark:border-border-dark/50 last:border-0">
                                            <td className="px-3 py-2 font-mono text-text-primary dark:text-text-primary-dark">{k}</td>
                                            <td className="px-3 py-2 text-text-secondary dark:text-text-secondary-dark">{v}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2"><Globe className="w-4 h-4 text-cyan-500" /> Dashboard → Cloudflare Pages</h3>
                        <ol className="space-y-2 text-xs text-text-secondary dark:text-text-secondary-dark list-decimal list-inside">
                            <li>Cloudflare Dashboard → Workers &amp; Pages → Create application → Pages → Connect to Git</li>
                            <li>Set <strong>Root directory</strong> to <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded font-mono">apps/dashboard-web</code></li>
                            <li>Build command: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded font-mono">npm run build</code></li>
                            <li>Output directory: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded font-mono">dist</code></li>
                            <li>Add env var <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded font-mono">VITE_API_URL</code> = your Railway backend URL (with <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded font-mono">https://</code>)</li>
                            <li>Deploy — preview deployments created automatically for every PR</li>
                        </ol>
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                            <strong>Note:</strong> <code className="font-mono">VITE_API_URL</code> must include <code className="font-mono">https://</code> — Cloudflare Pages bakes env vars at build time. After any change, retrigger a deployment.
                        </div>
                    </div>
                </div>
            </Collapsible>

            {/* API Reference */}
            <Collapsible title={`API Reference — ${apiEndpoints.reduce((n, g) => n + g.routes.length, 0)} Endpoints`} icon={Code2} color="text-indigo-500">
                <div className="space-y-5">
                    {apiEndpoints.map(({ group, prefix, color, bg, routes }) => (
                        <div key={group}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`font-semibold text-sm ${color}`}>{group}</span>
                                <span className="text-[10px] font-mono text-text-muted dark:text-text-muted-dark">{prefix}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-text-muted dark:text-text-muted-dark">{routes.length}</span>
                            </div>
                            <div className="rounded-lg border border-border dark:border-border-dark overflow-hidden">
                                <table className="w-full text-xs">
                                    <tbody>
                                        {routes.map((r) => (
                                            <tr key={r.path} className="border-b border-border/50 dark:border-border-dark/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                                <td className="px-3 py-2 w-14"><MethodBadge method={r.method} /></td>
                                                <td className="px-3 py-2 font-mono text-text-primary dark:text-text-primary-dark whitespace-nowrap">{r.path}</td>
                                                <td className="px-3 py-2 text-text-secondary dark:text-text-secondary-dark">{r.desc}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            </Collapsible>

            {/* Tracking Script */}
            <Collapsible title="Tracking Script — Auto-Captured Events" icon={MousePointerClick} color="text-blue-500">
                <div className="space-y-4">
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        Lightweight (&lt;2KB gzipped) — no cookies, no fingerprinting, no IP storage. Respects DNT and GPC signals automatically.
                    </p>
                    <div className="rounded-lg border border-border dark:border-border-dark overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-border dark:border-border-dark">
                                    <th className="px-3 py-2 text-left font-medium text-text-muted dark:text-text-muted-dark">Event</th>
                                    <th className="px-3 py-2 text-left font-medium text-text-muted dark:text-text-muted-dark">Description</th>
                                    <th className="px-3 py-2 text-center font-medium text-text-muted dark:text-text-muted-dark">Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trackingEvents.map((t) => (
                                    <tr key={t.event} className="border-b border-border/50 dark:border-border-dark/50 last:border-0">
                                        <td className="px-3 py-2 font-mono text-text-primary dark:text-text-primary-dark">{t.event}</td>
                                        <td className="px-3 py-2 text-text-secondary dark:text-text-secondary-dark">{t.desc}</td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.auto ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                                                {t.auto ? 'Auto' : 'Manual'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <CodeBlock label="Manual Event Examples">{`window.trackEvent('purchase', { amount: 49.99, plan: 'pro' });
window.trackAddToCart('Widget', 29.99);
window.trackCheckout([{ name: 'Widget', qty: 1 }]);
window.trackPurchase(29.99);`}</CodeBlock>
                </div>
            </Collapsible>

            {/* Dashboard Pages */}
            <Collapsible title={`Dashboard Pages — ${dashboardPages.length} Views`} icon={Layers} color="text-cyan-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dashboardPages.map((p) => (
                        <div key={p.path} className="flex items-start gap-3 p-3 rounded-lg border border-border dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                            <p.icon className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                            <div>
                                <div className="text-sm font-medium">{p.name} <span className="text-[10px] font-mono text-text-muted dark:text-text-muted-dark ml-1">{p.path}</span></div>
                                <div className="text-xs text-text-secondary dark:text-text-secondary-dark">{p.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </Collapsible>

            {/* Database Schema */}
            <Collapsible title={`Database Schema — ${dbTables.length} Tables`} icon={Database} color="text-indigo-500">
                <div className="space-y-4">
                    <div className="flex items-center gap-4 text-xs text-text-secondary dark:text-text-secondary-dark mb-2">
                        <span className="flex items-center gap-1"><Database className="w-3 h-3 text-indigo-500" /> PostgreSQL — source of truth (writes, auth, CRUD)</span>
                        <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-purple-500" /> DuckDB — OLAP replica (analytics reads, synced every 60s)</span>
                    </div>
                    <div className="rounded-lg border border-border dark:border-border-dark overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-border dark:border-border-dark">
                                    <th className="px-3 py-2 text-left font-medium text-text-muted dark:text-text-muted-dark">Table</th>
                                    <th className="px-3 py-2 text-left font-medium text-text-muted dark:text-text-muted-dark">Key Columns</th>
                                    <th className="px-3 py-2 text-left font-medium text-text-muted dark:text-text-muted-dark">Purpose</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dbTables.map((t) => (
                                    <tr key={t.name} className="border-b border-border/50 dark:border-border-dark/50 last:border-0">
                                        <td className="px-3 py-2 font-mono font-semibold text-text-primary dark:text-text-primary-dark">{t.name}</td>
                                        <td className="px-3 py-2 font-mono text-text-secondary dark:text-text-secondary-dark">{t.cols}</td>
                                        <td className="px-3 py-2 text-text-secondary dark:text-text-secondary-dark">{t.purpose}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Collapsible>

            {/* Sync Mechanism */}
            <Collapsible title="Data Sync (PG → DuckDB)" icon={RefreshCw} color="text-amber-500">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                            { label: 'Sync Interval', value: 'Every 60s', sub: 'auto on server start' },
                            { label: 'Batch Size', value: '5,000 rows', sub: 'per table per cycle' },
                            { label: 'Strategy', value: 'Incremental', sub: 'high-water-mark via _sync_meta' },
                        ].map((s) => (
                            <div key={s.label} className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-border dark:border-border-dark">
                                <div className="text-[10px] text-text-muted dark:text-text-muted-dark uppercase tracking-wider">{s.label}</div>
                                <div className="text-sm font-semibold mt-1">{s.value}</div>
                                <div className="text-[10px] text-text-muted dark:text-text-muted-dark">{s.sub}</div>
                            </div>
                        ))}
                    </div>
                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark space-y-1.5">
                        <p><strong>Tables synced:</strong> events, sessions, sites, funnels, daily_stats, users</p>
                        <p><strong>Upsert logic:</strong> DELETE by ID + INSERT (handles updates to existing rows)</p>
                        <p><strong>Full sync:</strong> <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">npm run sync -- --full</code> truncates and re-imports all data</p>
                        <p><strong>Manual trigger:</strong> <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">POST /api/sync</code> (add <code className="font-mono">?full=true</code> for full sync)</p>
                    </div>
                </div>
            </Collapsible>

            {/* Caching */}
            <Collapsible title="Cache TTLs" icon={Clock} color="text-teal-500">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { endpoint: 'Realtime', ttl: '10s' },
                        { endpoint: 'KPI', ttl: '30s' },
                        { endpoint: 'Traffic / Pages', ttl: '60s' },
                        { endpoint: 'General', ttl: '2 min' },
                    ].map((c) => (
                        <div key={c.endpoint} className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-border dark:border-border-dark">
                            <div className="text-xs font-medium">{c.endpoint}</div>
                            <div className="text-lg font-bold text-accent mt-1">{c.ttl}</div>
                        </div>
                    ))}
                </div>
                <p className="mt-3 text-xs text-text-muted dark:text-text-muted-dark">In-memory TTL cache (no Redis required). Cache is per-route and keyed by siteId + query params.</p>
            </Collapsible>

            {/* Privacy */}
            <Collapsible title="Privacy & Compliance" icon={Lock} color="text-rose-500">
                <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {[
                            { feature: 'Do Not Track (DNT)', detail: 'Tracking script checks navigator.doNotTrack and halts if enabled' },
                            { feature: 'Global Privacy Control (GPC)', detail: 'Respects navigator.globalPrivacyControl signal' },
                            { feature: 'No cookies', detail: 'Anonymous user ID in localStorage only' },
                            { feature: 'No IP storage', detail: 'IP addresses never written to any table' },
                            { feature: 'Self-hosted', detail: 'All data stays on your own infrastructure' },
                            { feature: 'Data Retention', detail: 'Per-site configurable retention (30/90/180/365 days), manual cleanup trigger' },
                        ].map((r) => (
                            <div key={r.feature} className="flex items-start gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
                                <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                                <div>
                                    <div className="font-medium text-text-primary dark:text-text-primary-dark">{r.feature}</div>
                                    <div className="text-text-secondary dark:text-text-secondary-dark">{r.detail}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Collapsible>

            {/* Tech Stack */}
            <div className="rounded-xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-5">
                <h2 className="text-base font-semibold mb-3">Tech Stack</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {[
                        { label: 'React 18 + Vite 5', detail: 'Frontend SPA' },
                        { label: 'Tailwind CSS 3', detail: 'Styling + dark mode' },
                        { label: 'Recharts', detail: 'Charts & graphs' },
                        { label: 'Zustand', detail: 'State management' },
                        { label: 'Express 4', detail: 'Backend API' },
                        { label: 'PostgreSQL 16', detail: 'Write DB (OLTP)' },
                        { label: 'DuckDB', detail: 'Read DB (OLAP)' },
                        { label: 'JWT + bcrypt', detail: 'Auth & security' },
                        { label: 'Railway', detail: 'Backend hosting' },
                        { label: 'Cloudflare Pages', detail: 'Frontend hosting' },
                        { label: 'Docker', detail: 'Local development' },
                        { label: 'Vitest + Playwright', detail: 'Testing' },
                    ].map((t) => (
                        <div key={t.label} className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-border dark:border-border-dark text-center">
                            <div className="font-semibold text-text-primary dark:text-text-primary-dark">{t.label}</div>
                            <div className="text-[10px] text-text-muted dark:text-text-muted-dark">{t.detail}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
