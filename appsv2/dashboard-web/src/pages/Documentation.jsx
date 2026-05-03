import { useState } from 'react';
import {
    Server, Database, Globe, Zap, RefreshCw, ArrowRight, Shield, Code2,
    Terminal, ChevronDown, ChevronRight, Copy, Check, FileText, MousePointerClick,
    Clock, Eye, BarChart3, Users, Layers, GitBranch, Activity, Settings as SettingsIcon,
    Target, Megaphone, TrendingUp, Map, BookOpen, Lock, Cloud, Gauge,
    Building2, Briefcase, HelpCircle, CheckCircle2, AlertCircle
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

// ─── Business Owner Guide ────────────────────────────────────────────────────
function BusinessOwnerGuide() {
    const sections = [
        {
            icon: HelpCircle,
            color: 'text-indigo-500',
            bg: 'bg-indigo-500/10',
            title: 'What is InsightTrack?',
            content: (
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                    <p>InsightTrack is a <strong className="text-gray-800 dark:text-gray-200">self-hosted web analytics platform</strong> — like Google Analytics, but you own all the data, there are no third parties involved, and there is no tracking consent banner required.</p>
                    <p>It runs on your own server (or a cheap cloud host like Railway) and shows you:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>How many people visit your website and when</li>
                        <li>Where they come from (Google, social media, direct links, email campaigns)</li>
                        <li>What pages they look at and for how long</li>
                        <li>Whether they complete your most important actions (sign-ups, purchases, form fills)</li>
                        <li>How fast your site loads and whether there are any broken features</li>
                    </ul>
                </div>
            ),
        },
        {
            icon: Building2,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            title: 'Getting started — 3 steps',
            content: (
                <div className="space-y-4">
                    {[
                        { step: '1', title: 'Create an account', text: 'Go to the login page and register. You\'ll be the admin of your own InsightTrack instance. No subscription, no monthly fees — it runs on your servers.' },
                        { step: '2', title: 'Add your website', text: 'Go to Settings → Add Site. Enter your website name and domain. InsightTrack will give you a tracking snippet (a small piece of code).' },
                        { step: '3', title: 'Paste the snippet into your website', text: 'Copy the tracking snippet from Settings and paste it inside the <head> tag of every page on your website. If you use WordPress, Webflow, or similar, there is usually a "Header Code" setting where you can paste it.' },
                    ].map(({ step, title, text }) => (
                        <div key={step} className="flex gap-3">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">{step}</div>
                            <div>
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ),
        },
        {
            icon: BarChart3,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            title: 'What each page tells you',
            content: (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {[
                        { name: 'Dashboard', icon: '📊', tip: 'Your daily health check. Look at this first every morning. If visitors are up, bounce rate is low, and sessions are long — you\'re doing well.' },
                        { name: 'Realtime', icon: '🟢', tip: 'Watch this when you send an email campaign or post on social media. See the visitor spike happen in real time.' },
                        { name: 'Acquisition', icon: '📣', tip: 'Find out which marketing channel actually brings visitors. Add UTM tags to your links so campaigns are tracked properly.' },
                        { name: 'Audience', icon: '👥', tip: 'Are your visitors coming back? Low return rate means your content isn\'t sticky enough. Cohorts show loyalty over time.' },
                        { name: 'Content', icon: '📄', tip: 'Which pages do visitors land on first? Which pages do they leave from? Fix high-exit pages to stop losing visitors.' },
                        { name: 'Engagement', icon: '🖱️', tip: 'How far down your pages do people scroll? Are they clicking your call-to-action buttons? Rage clicks reveal broken UX.' },
                        { name: 'Conversions', icon: '🎯', tip: 'The most important page. Set up a goal for your most valuable action (e.g. "Visit /thank-you page after sign-up"). Track your conversion rate weekly.' },
                        { name: 'Funnels', icon: '🔽', tip: 'See where in the sign-up or purchase journey you lose the most people. Fixing the worst drop-off step has the highest return.' },
                        { name: 'Performance', icon: '⚡', tip: 'Slow pages = lost visitors. If your LCP is over 2.5 seconds, it hurts Google rankings. Fix the biggest issues first.' },
                        { name: 'User Flow', icon: '🔀', tip: 'Like a map of how people walk through your website. Useful for navigation redesigns.' },
                        { name: 'Reporting', icon: '📅', tip: 'Set up a weekly email summary so your team gets key metrics without logging in. Add annotations to remember why traffic changed.' },
                        { name: 'Privacy', icon: '🔒', tip: 'No action needed — InsightTrack is privacy-compliant by default. Review if you want to configure how long data is kept.' },
                    ].map(({ name, icon, tip }) => (
                        <div key={name} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                            <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">{icon} {name}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{tip}</p>
                        </div>
                    ))}
                </div>
            ),
        },
        {
            icon: Megaphone,
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
            title: 'How to track marketing campaigns (UTM links)',
            content: (
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                    <p>When you share a link to your website (in an email, social post, or ad), add UTM parameters to the URL. InsightTrack will automatically group and report that traffic under the campaign name you set.</p>
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono text-xs break-all">
                        https://yoursite.com/landing?<span className="text-indigo-500">utm_source=newsletter</span>&amp;<span className="text-green-500">utm_medium=email</span>&amp;<span className="text-orange-500">utm_campaign=may-promo</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                        <li><strong className="text-gray-700 dark:text-gray-300">utm_source</strong> — where the traffic comes from (e.g. newsletter, facebook, google)</li>
                        <li><strong className="text-gray-700 dark:text-gray-300">utm_medium</strong> — the type of channel (e.g. email, cpc, social)</li>
                        <li><strong className="text-gray-700 dark:text-gray-300">utm_campaign</strong> — the campaign name (e.g. may-promo, product-launch)</li>
                    </ul>
                    <p className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs">
                        💡 Use the <strong>URL Builder</strong> tool in the Acquisition page to generate these links automatically without typing them manually.
                    </p>
                </div>
            ),
        },
        {
            icon: Target,
            color: 'text-rose-500',
            bg: 'bg-rose-500/10',
            title: 'How to measure conversions',
            content: (
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                    <p>Go to <strong className="text-gray-700 dark:text-gray-300">Conversions → Goals</strong> and click <em>+ Add Goal</em>. Choose what counts as a conversion for your business:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                            { type: 'Page Visit', example: 'Visitor reaches /thank-you or /order-confirmation', use: 'E-commerce purchase or lead form' },
                            { type: 'Button Click', example: 'Visitor clicks element #signup-btn', use: 'Sign-up button, add-to-cart' },
                            { type: 'Custom Event', example: 'trackEvent("trial_started")', use: 'Requires a line of code in your app' },
                            { type: 'Time on Page', example: 'Visitor spends 60+ seconds', use: 'Content engagement measurement' },
                        ].map(({ type, example, use }) => (
                            <div key={type} className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                                <p className="font-semibold text-gray-700 dark:text-gray-300 text-xs">{type}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{example}</p>
                                <p className="text-xs text-indigo-500 mt-1">Best for: {use}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ),
        },
        {
            icon: Shield,
            color: 'text-teal-500',
            bg: 'bg-teal-500/10',
            title: 'Privacy & compliance — what you need to know',
            content: (
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        <p><strong className="text-green-700 dark:text-green-400">No cookie banner needed.</strong> InsightTrack does not use cookies. It uses anonymous localStorage identifiers. Most data privacy laws (GDPR, CCPA, PECR) only require consent banners for cookies and personal data — InsightTrack uses neither.</p>
                    </div>
                    <div className="flex gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        <p><strong className="text-green-700 dark:text-green-400">Your data stays on your servers.</strong> Unlike Google Analytics, no visitor data is sent to any external company. You are the data controller and data processor. This simplifies GDPR compliance significantly.</p>
                    </div>
                    <div className="flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <p><strong className="text-amber-700 dark:text-amber-400">Consult a lawyer for your specific situation.</strong> InsightTrack reduces your privacy obligations, but you should confirm compliance with legal counsel, especially if you operate in regulated industries.</p>
                    </div>
                    <p>For full details, see the <strong>Privacy &amp; Compliance</strong> page in the dashboard sidebar.</p>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200 dark:border-indigo-800/50 p-5 mb-2">
                <div className="flex items-start gap-3">
                    <Briefcase className="w-7 h-7 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                        <h2 className="font-bold text-indigo-900 dark:text-indigo-100">For Business Owners &amp; Non-Technical Users</h2>
                        <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
                            Everything you need to know to use InsightTrack effectively, without needing to understand the code.
                        </p>
                    </div>
                </div>
            </div>
            {sections.map(({ icon: Icon, color, bg, title, content }) => (
                <div key={title} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
                    <details className="group">
                        <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors list-none">
                            <div className={`p-1.5 rounded-lg ${bg} shrink-0`}><Icon className={`w-4 h-4 ${color}`} /></div>
                            <span className="font-semibold text-gray-900 dark:text-white flex-1">{title}</span>
                            <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
                        </summary>
                        <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800 pt-4">{content}</div>
                    </details>
                </div>
            ))}
        </div>
    );
}

export default function Documentation() {
    const [audience, setAudience] = useState('business');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">Documentation</h1>
                <p className="mt-1 text-text-secondary dark:text-text-secondary-dark">
                    Complete reference for InsightTrack — pick your audience below.
                </p>
            </div>

            {/* Audience switcher */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
                <button
                    onClick={() => setAudience('business')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${audience === 'business'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    <Briefcase className="w-4 h-4" />
                    Business Owner
                </button>
                <button
                    onClick={() => setAudience('dev')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${audience === 'dev'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    <Code2 className="w-4 h-4" />
                    Developer
                </button>
            </div>

            {audience === 'business' ? <BusinessOwnerGuide /> : <DeveloperGuide />}
        </div>
    );
}

// ─── Architecture Diagram ────────────────────────────────────────────────────
function ArchitectureDiagram() {
    const [view, setView] = useState('v2');
    const tabs = [
        { id: 'v1', label: 'v1 — Flat DuckDB', color: 'text-amber-600 dark:text-amber-400' },
        { id: 'v2', label: 'v2 — Hot/Cold', color: 'text-emerald-600 dark:text-emerald-400' },
        { id: 'hotcold', label: 'Hot/Cold Deep-Dive', color: 'text-purple-600 dark:text-purple-400' },
        { id: 'engines', label: 'Query Engine Migration', color: 'text-blue-600 dark:text-blue-400' },
    ];

    return (
        <div className="rounded-xl border border-border dark:border-border-dark bg-card dark:bg-card-dark overflow-hidden">
            {/* Tab bar */}
            <div className="flex flex-wrap gap-1 px-4 pt-4 pb-0 border-b border-border dark:border-border-dark">
                <div className="flex items-center gap-2 mr-3 mb-3">
                    <Shield className="w-4 h-4 text-accent" />
                    <span className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">Architecture</span>
                </div>
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setView(t.id)}
                        className={`mb-3 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                            ${view === t.id
                                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent'
                                : 'border-border dark:border-border-dark text-text-muted dark:text-text-muted-dark hover:border-gray-400'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="p-5">
                {/* ── V1 ── */}
                {view === 'v1' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">LEGACY v1</span>
                            <span className="text-xs text-text-muted dark:text-text-muted-dark">Flat DuckDB — single table, full scan on every query</span>
                        </div>

                        {/* Data flow */}
                        <div className="flex flex-col md:flex-row items-stretch gap-3">
                            {/* Clients */}
                            <div className="flex flex-col gap-2 shrink-0">
                                <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-500/20">
                                    <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                                    <div>
                                        <div className="text-xs font-semibold">Your Website</div>
                                        <div className="text-[10px] text-text-muted dark:text-text-muted-dark">tracking script</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2.5 bg-cyan-50 dark:bg-cyan-500/10 rounded-lg border border-cyan-200 dark:border-cyan-500/20">
                                    <BarChart3 className="w-4 h-4 text-cyan-500 shrink-0" />
                                    <div>
                                        <div className="text-xs font-semibold">Dashboard</div>
                                        <div className="text-[10px] text-text-muted dark:text-text-muted-dark">React SPA</div>
                                    </div>
                                </div>
                            </div>
                            {/* Arrows */}
                            <div className="flex flex-col gap-3 items-center justify-center shrink-0 px-1">
                                <div className="text-center">
                                    <ArrowRight className="w-4 h-4 text-text-muted dark:text-text-muted-dark mx-auto" />
                                    <div className="text-[9px] text-text-muted dark:text-text-muted-dark font-mono">POST /api/track/*</div>
                                </div>
                                <div className="text-center">
                                    <ArrowRight className="w-4 h-4 text-text-muted dark:text-text-muted-dark mx-auto rotate-180" />
                                    <div className="text-[9px] text-text-muted dark:text-text-muted-dark font-mono">GET /api/analytics/*</div>
                                </div>
                            </div>
                            {/* Backend */}
                            <div className="flex-1 bg-green-50 dark:bg-green-500/10 rounded-lg border border-green-200 dark:border-green-500/20 p-3">
                                <div className="flex items-center gap-2 mb-3">
                                    <Server className="w-4 h-4 text-green-500" />
                                    <span className="text-xs font-semibold">Express API (port 3001)</span>
                                </div>
                                <div className="flex items-center gap-2 justify-center flex-wrap">
                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded border border-indigo-200 dark:border-indigo-500/20">
                                        <Database className="w-3.5 h-3.5 text-indigo-500" />
                                        <span className="text-xs font-semibold">PostgreSQL<span className="font-normal text-[9px] text-text-muted dark:text-text-muted-dark ml-1">(writes)</span></span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <RefreshCw className="w-3 h-3 text-amber-500" />
                                        <span className="text-[8px] text-amber-600 dark:text-amber-400 font-medium">full sync</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 dark:bg-purple-500/10 rounded border border-purple-200 dark:border-purple-500/20">
                                        <Zap className="w-3.5 h-3.5 text-purple-500" />
                                        <div>
                                            <div className="text-xs font-semibold">DuckDB<span className="font-normal text-[9px] text-text-muted dark:text-text-muted-dark ml-1">(reads)</span></div>
                                            <div className="text-[9px] text-text-muted dark:text-text-muted-dark">events (flat table)</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Problems table */}
                        <div>
                            <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">⚠ Known problems with v1</p>
                            <div className="rounded-lg border border-red-200 dark:border-red-800/50 overflow-hidden text-xs">
                                <table className="w-full">
                                    <thead><tr className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/50">
                                        <th className="px-3 py-2 text-left font-medium text-red-700 dark:text-red-400">Problem</th>
                                        <th className="px-3 py-2 text-left font-medium text-red-700 dark:text-red-400">Impact</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-red-100 dark:divide-red-900/30">
                                        {[
                                            ['Single large DuckDB file', 'Startup sync slowed down linearly with history'],
                                            ['All rows scanned for every query', '90-day queries scanned data unchanged for weeks'],
                                            ['No historical partitioning', 'Impossible to archive old data without losing query capability'],
                                            ['Re-sync on crash = full table rebuild', 'Recovery time grew with dataset size'],
                                        ].map(([p, i]) => (
                                            <tr key={p} className="bg-white dark:bg-transparent">
                                                <td className="px-3 py-2 text-red-700 dark:text-red-300 font-medium">{p}</td>
                                                <td className="px-3 py-2 text-text-secondary dark:text-text-secondary-dark">{i}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── V2 ── */}
                {view === 'v2' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">CURRENT v2</span>
                            <span className="text-xs text-text-muted dark:text-text-muted-dark">Hot/Cold split — DuckDB hot tables + Parquet cold tier, transparent UNION ALL views</span>
                        </div>

                        {/* Main flow */}
                        <div className="flex flex-col md:flex-row items-stretch gap-3">
                            {/* Clients */}
                            <div className="flex flex-col gap-2 shrink-0">
                                <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-500/20">
                                    <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                                    <div>
                                        <div className="text-xs font-semibold">Your Website</div>
                                        <div className="text-[10px] text-text-muted dark:text-text-muted-dark">tracking script</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2.5 bg-cyan-50 dark:bg-cyan-500/10 rounded-lg border border-cyan-200 dark:border-cyan-500/20">
                                    <BarChart3 className="w-4 h-4 text-cyan-500 shrink-0" />
                                    <div>
                                        <div className="text-xs font-semibold">Dashboard</div>
                                        <div className="text-[10px] text-text-muted dark:text-text-muted-dark">React SPA</div>
                                    </div>
                                </div>
                            </div>
                            {/* Arrows */}
                            <div className="flex flex-col gap-3 items-center justify-center shrink-0 px-1">
                                <div className="text-center">
                                    <ArrowRight className="w-4 h-4 text-text-muted dark:text-text-muted-dark mx-auto" />
                                    <div className="text-[9px] text-text-muted dark:text-text-muted-dark font-mono">POST /api/track/*</div>
                                </div>
                                <div className="text-center">
                                    <ArrowRight className="w-4 h-4 text-text-muted dark:text-text-muted-dark mx-auto rotate-180" />
                                    <div className="text-[9px] text-text-muted dark:text-text-muted-dark font-mono">GET /api/analytics/*</div>
                                </div>
                            </div>
                            {/* Backend */}
                            <div className="flex-1 bg-green-50 dark:bg-green-500/10 rounded-lg border border-green-200 dark:border-green-500/20 p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Server className="w-4 h-4 text-green-500" />
                                    <span className="text-xs font-semibold">Express API (port 3001)</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {/* Write side */}
                                    <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded border border-indigo-200 dark:border-indigo-500/20 p-2">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <Database className="w-3.5 h-3.5 text-indigo-500" />
                                            <span className="text-xs font-semibold">PostgreSQL</span>
                                            <span className="text-[9px] text-indigo-500 font-medium ml-auto">WRITES</span>
                                        </div>
                                        <div className="text-[9px] text-text-muted dark:text-text-muted-dark space-y-0.5">
                                            <div>events, sessions, sites</div>
                                            <div>users, funnels, goals</div>
                                            <div>sync_state (watermarks)</div>
                                        </div>
                                    </div>
                                    {/* Read side */}
                                    <div className="bg-purple-50 dark:bg-purple-500/10 rounded border border-purple-200 dark:border-purple-500/20 p-2">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <Zap className="w-3.5 h-3.5 text-purple-500" />
                                            <span className="text-xs font-semibold">DuckDB</span>
                                            <span className="text-[9px] text-purple-500 font-medium ml-auto">READS</span>
                                        </div>
                                        <div className="text-[9px] text-text-muted dark:text-text-muted-dark space-y-0.5">
                                            <div>🔴 events_hot (last 30d, RAM)</div>
                                            <div>🔵 VIEW events = hot ∪ cold</div>
                                            <div>📂 data-lake/*.parquet (disk)</div>
                                        </div>
                                    </div>
                                </div>
                                {/* Sync worker */}
                                <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-50 dark:bg-amber-500/10 rounded border border-amber-200 dark:border-amber-500/20">
                                    <RefreshCw className="w-3 h-3 text-amber-500 shrink-0" />
                                    <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">Sync worker — every 5 min · watermark-based · hot/cold split on cutoff date</span>
                                </div>
                            </div>
                        </div>

                        {/* Performance comparison */}
                        <div>
                            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">✅ v1 vs v2 query latency (98 837 events, 120-day window, Apple M1)</p>
                            <div className="rounded-lg border border-border dark:border-border-dark overflow-hidden text-xs">
                                <table className="w-full">
                                    <thead><tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-border dark:border-border-dark">
                                        <th className="px-3 py-2 text-left font-medium text-text-muted dark:text-text-muted-dark">Query</th>
                                        <th className="px-3 py-2 text-right font-medium text-text-muted dark:text-text-muted-dark">v1 flat</th>
                                        <th className="px-3 py-2 text-right font-medium text-text-muted dark:text-text-muted-dark">v2 hot/cold</th>
                                        <th className="px-3 py-2 text-right font-medium text-text-muted dark:text-text-muted-dark">Speedup</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-border/50 dark:divide-border-dark/50">
                                        {[
                                            ['KPI — 7 days', '~80 ms', '55 ms', '1.5×'],
                                            ['KPI — 30 days', '~210 ms', '64 ms', '3.3×'],
                                            ['KPI — 90 days', '~620 ms', '25 ms', '25×'],
                                            ['Traffic chart — 30 days', '~180 ms', '24 ms', '7.5×'],
                                            ['Traffic chart — 90 days', '~490 ms', '44 ms', '11×'],
                                            ['Top pages — 90 days', '~520 ms', '39 ms', '13×'],
                                        ].map(([q, v1, v2, s]) => (
                                            <tr key={q} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                                <td className="px-3 py-2 text-text-primary dark:text-text-primary-dark">{q}</td>
                                                <td className="px-3 py-2 text-right text-red-500">{v1}</td>
                                                <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{v2}</td>
                                                <td className="px-3 py-2 text-right font-bold text-indigo-600 dark:text-indigo-400">{s}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        {/* Storage */}
                        <div className="grid grid-cols-3 gap-2 text-xs text-center">
                            {[
                                { label: 'PostgreSQL', sub: 'Row store · writes', size: '~45 MB', color: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300' },
                                { label: 'DuckDB hot (30d)', sub: 'Columnar · RAM', size: '~2 MB', color: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300' },
                                { label: 'Parquet cold (90d)', sub: 'Compressed · disk', size: '~3 MB', color: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300' },
                            ].map(({ label, sub, size, color }) => (
                                <div key={label} className={`rounded-lg border p-2 ${color}`}>
                                    <div className="font-semibold text-[11px]">{label}</div>
                                    <div className="text-[9px] opacity-70">{sub}</div>
                                    <div className="text-base font-bold mt-1">{size}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Hot/Cold Deep-Dive ── */}
                {view === 'hotcold' && (
                    <div className="space-y-5">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400">HOT / COLD CONCEPT</span>
                            <span className="text-xs text-text-muted dark:text-text-muted-dark">Two storage tiers with transparent query unification</span>
                        </div>

                        {/* Tier comparison */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="rounded-lg border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-sm font-bold text-red-700 dark:text-red-400">🔴 Hot Tier</span>
                                    <span className="ml-auto text-[10px] bg-red-200 dark:bg-red-700/50 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded-full font-medium">last {'{HOT_DAYS}'} days</span>
                                </div>
                                <div className="text-xs text-red-800 dark:text-red-300 space-y-1">
                                    <div>• <strong>Storage:</strong> DuckDB in-memory tables (<code className="bg-red-100 dark:bg-red-900 px-1 rounded font-mono">events_hot</code>, <code className="bg-red-100 dark:bg-red-900 px-1 rounded font-mono">sessions_hot</code>)</div>
                                    <div>• <strong>Default window:</strong> 30 days (env: <code className="font-mono">HOT_DAYS=30</code>)</div>
                                    <div>• <strong>Query speed:</strong> sub-millisecond (columnar RAM scan)</div>
                                    <div>• <strong>Rebuilt on:</strong> server startup from PostgreSQL watermark</div>
                                    <div>• <strong>Eviction:</strong> rows older than HOT_DAYS are moved to cold Parquet after sync</div>
                                </div>
                            </div>
                            <div className="rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                                    <span className="text-sm font-bold text-blue-700 dark:text-blue-400">🔵 Cold Tier</span>
                                    <span className="ml-auto text-[10px] bg-blue-200 dark:bg-blue-700/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium">older data</span>
                                </div>
                                <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                                    <div>• <strong>Storage:</strong> Parquet files on disk (Hive-partitioned)</div>
                                    <div>• <strong>Layout:</strong> <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded font-mono text-[10px]">data-lake/events/site_id=X/event_date=Y/part-0001.parquet</code></div>
                                    <div>• <strong>Query speed:</strong> fast — partition pruning skips irrelevant files</div>
                                    <div>• <strong>Compression:</strong> ~90 days of events ≈ 3 MB on disk</div>
                                    <div>• <strong>Engine-agnostic:</strong> Hive convention — readable by DuckDB, Spark, Trino, Athena</div>
                                </div>
                            </div>
                        </div>

                        {/* Transparent union */}
                        <div className="rounded-lg border border-purple-200 dark:border-purple-800/50 bg-purple-50 dark:bg-purple-900/20 p-3">
                            <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-2">🔀 Transparent UNION ALL views — no query changes needed</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <p className="text-[10px] font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-wide mb-1">With cold files (after HOT_DAYS)</p>
                                    <pre className="text-[10px] font-mono bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-800 rounded p-2 text-text-primary dark:text-text-primary-dark overflow-x-auto">{`CREATE OR REPLACE VIEW events AS
  SELECT * FROM events_hot
  UNION ALL
  SELECT * FROM read_parquet(
    'data-lake/events/
     site_id=*/event_date=*/*.parquet',
    hive_partitioning = true
  );`}</pre>
                                </div>
                                <div>
                                    <p className="text-[10px] font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-wide mb-1">Fresh install (hot only)</p>
                                    <pre className="text-[10px] font-mono bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-800 rounded p-2 text-text-primary dark:text-text-primary-dark overflow-x-auto">{`-- Fallback: no Parquet files yet
CREATE OR REPLACE VIEW events AS
  SELECT * FROM events_hot;

-- Automatically upgraded to UNION ALL
-- view once first cold file appears`}</pre>
                                </div>
                            </div>
                        </div>

                        {/* Sync cycle */}
                        <div>
                            <p className="text-xs font-semibold text-text-primary dark:text-text-primary-dark mb-2">Sync cycle — every {'{SYNC_INTERVAL_MS}'} ms (default 5 min)</p>
                            <div className="flex flex-wrap gap-0 text-[10px]">
                                {[
                                    { n: '1', label: 'Read watermark', sub: '_sync_meta: last_event_id, last_synced', color: 'bg-gray-100 dark:bg-gray-800' },
                                    { n: '2', label: 'Fetch from PG', sub: 'WHERE id > last_event_id (batches of 5000)', color: 'bg-blue-50 dark:bg-blue-900/20' },
                                    { n: '3', label: 'Split by age', sub: 'cutoff = NOW() − HOT_DAYS → hot vs cold batch', color: 'bg-amber-50 dark:bg-amber-900/20' },
                                    { n: '4', label: 'Write hot', sub: 'INSERT INTO events_hot', color: 'bg-red-50 dark:bg-red-900/20' },
                                    { n: '5', label: 'Write cold', sub: 'COPY TO data-lake/…/part-0001.parquet', color: 'bg-blue-50 dark:bg-blue-900/20' },
                                    { n: '6', label: 'Advance watermark', sub: 'UPDATE _sync_meta after successful write', color: 'bg-green-50 dark:bg-green-900/20' },
                                    { n: '7', label: 'Refresh views', sub: 'CREATE OR REPLACE VIEW events = hot ∪ cold', color: 'bg-purple-50 dark:bg-purple-900/20' },
                                ].map(({ n, label, sub, color }, i, arr) => (
                                    <div key={n} className="flex items-stretch">
                                        <div className={`${color} border border-border dark:border-border-dark rounded-lg px-2.5 py-2 text-center w-28`}>
                                            <div className="font-bold text-accent mb-0.5">Step {n}</div>
                                            <div className="font-semibold text-text-primary dark:text-text-primary-dark text-[10px]">{label}</div>
                                            <div className="text-text-muted dark:text-text-muted-dark text-[9px] mt-0.5">{sub}</div>
                                        </div>
                                        {i < arr.length - 1 && <div className="flex items-center px-1 text-text-muted dark:text-text-muted-dark">→</div>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tuning */}
                        <div className="rounded-lg border border-border dark:border-border-dark overflow-hidden text-xs">
                            <div className="bg-gray-50 dark:bg-gray-800/50 px-3 py-2 font-semibold text-text-primary dark:text-text-primary-dark border-b border-border dark:border-border-dark">⚙ Configuration tuning</div>
                            <table className="w-full">
                                <thead><tr className="bg-gray-50/50 dark:bg-gray-800/30 border-b border-border dark:border-border-dark">
                                    <th className="px-3 py-2 text-left font-medium text-text-muted dark:text-text-muted-dark">Variable</th>
                                    <th className="px-3 py-2 text-left font-medium text-text-muted dark:text-text-muted-dark">Default</th>
                                    <th className="px-3 py-2 text-left font-medium text-text-muted dark:text-text-muted-dark">Guidance</th>
                                </tr></thead>
                                <tbody className="divide-y divide-border/50 dark:divide-border-dark/50">
                                    {[
                                        ['HOT_DAYS', '30', 'Set 7 to minimise RAM · set 90 for heavy historical dashboard use'],
                                        ['SYNC_INTERVAL_MS', '300000', 'Decrease to 60000 for near-realtime cold archiving'],
                                        ['SYNC_BATCH_SIZE', '5000', 'Increase to 10000 for high-traffic catch-up after downtime'],
                                        ['DUCKDB_PATH', 'duckdb/analytics.duckdb', 'Point to a mounted volume in production for persistence'],
                                    ].map(([k, d, g]) => (
                                        <tr key={k}>
                                            <td className="px-3 py-2 font-mono text-text-primary dark:text-text-primary-dark">{k}</td>
                                            <td className="px-3 py-2 font-mono text-indigo-600 dark:text-indigo-400">{d}</td>
                                            <td className="px-3 py-2 text-text-secondary dark:text-text-secondary-dark">{g}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── Query Engine Migration ── */}
                {view === 'engines' && (
                    <div className="space-y-5">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400">ENGINE PORTABILITY</span>
                            <span className="text-xs text-text-muted dark:text-text-muted-dark">The Parquet+Hive layout lets you swap or augment the query engine without re-ingesting data</span>
                        </div>

                        <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                            Because all cold data is stored as standard <strong className="text-text-primary dark:text-text-primary-dark">Hive-partitioned Parquet files</strong>, any SQL engine that supports the Hive convention can query or process the data. DuckDB is used today because it's embedded and zero-ops — but the data is never locked in.
                        </p>

                        {/* Engine cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                                {
                                    name: 'DuckDB (current)',
                                    badge: 'ACTIVE',
                                    badgeColor: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
                                    color: 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20',
                                    effort: 'None',
                                    pros: ['Embedded in Node.js process — zero extra infra', 'In-process reads: no network round-trip', 'Native Parquet + Hive partitioning support', 'Sub-millisecond hot table scans'],
                                    cons: ['Single machine — no distributed query', 'Limited concurrent write throughput'],
                                    snippet: `// Already running — no changes needed
import { duckAll } from './db/duckdb.js';
const rows = await duckAll(
  'SELECT * FROM events WHERE site_id = ?', [id]
);`,
                                },
                                {
                                    name: 'Apache Spark / EMR',
                                    badge: 'MIGRATE PATH',
                                    badgeColor: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
                                    color: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20',
                                    effort: 'Medium — swap query layer only',
                                    pros: ['Distributed processing for billions of events', 'Familiar PySpark / Spark SQL API', 'Delta Lake or Iceberg table formats on same files', 'Native AWS S3 / GCS integration'],
                                    cons: ['Requires cluster management (EMR / Databricks)', 'Cold-start latency — not suitable for realtime'],
                                    snippet: `# Point Spark at existing Parquet layout
df = spark.read.format("parquet")\\
  .option("basePath", "s3://bucket/data-lake/events")\\
  .load("s3://bucket/data-lake/events/*/*/*.parquet")
df.createOrReplaceTempView("events")
spark.sql("SELECT COUNT(*) FROM events WHERE site_id='X'")`,
                                },
                                {
                                    name: 'Trino / Presto',
                                    badge: 'MIGRATE PATH',
                                    badgeColor: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
                                    color: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20',
                                    effort: 'Medium — add Hive Metastore',
                                    pros: ['Federated queries across PostgreSQL + Parquet', 'Sub-second interactive queries at petabyte scale', 'Standard ANSI SQL — no code change for existing queries', 'Works with existing Hive partition naming'],
                                    cons: ['Requires Hive Metastore or AWS Glue catalog', 'Separate cluster to operate'],
                                    snippet: `-- Register existing partition layout in Hive Metastore
CREATE TABLE hive.analytics.events (
  id BIGINT, site_id VARCHAR, type VARCHAR,
  timestamp TIMESTAMP, ...
) WITH (
  format = 'PARQUET',
  partitioned_by = ARRAY['site_id','event_date'],
  external_location = 's3://bucket/data-lake/events'
);
SELECT COUNT(*) FROM hive.analytics.events WHERE site_id='X';`,
                                },
                                {
                                    name: 'AWS Athena',
                                    badge: 'EASY MIGRATION',
                                    badgeColor: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
                                    color: 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20',
                                    effort: 'Low — S3 upload + Glue crawler',
                                    pros: ['Serverless — no cluster management', 'Pay-per-query pricing (~$5/TB scanned)', 'Automatic schema discovery via Glue Crawler', 'Partition pruning works out-of-the-box with Hive naming'],
                                    cons: ['AWS lock-in', 'Query latency 2-10s — not suitable for realtime dashboard'],
                                    snippet: `# 1. Upload cold Parquet to S3 (preserving Hive path)
aws s3 sync data-lake/ s3://your-bucket/data-lake/

# 2. Run Glue Crawler → auto-discovers partitions
# 3. Query via Athena console
SELECT COUNT(*) FROM "analytics"."events"
WHERE site_id = 'your-site'
  AND event_date BETWEEN '2026-01-01' AND '2026-04-30';`,
                                },
                                {
                                    name: 'ClickHouse',
                                    badge: 'MIGRATE PATH',
                                    badgeColor: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
                                    color: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20',
                                    effort: 'Medium — change write path + import Parquet',
                                    pros: ['Fastest columnar OLAP for high cardinality', 'Excellent compression (MergeTree engine)', 'Real-time inserts + analytical queries in same engine', 'Can ingest existing Parquet via COPY FROM'],
                                    cons: ['Replace DuckDB entirely — no embedded option', 'Requires running ClickHouse server'],
                                    snippet: `-- Import existing Parquet cold data
INSERT INTO events
SELECT * FROM file(
  'data-lake/events/*/*/*.parquet', 'Parquet'
);
-- Future writes go direct to ClickHouse (skip DuckDB)`,
                                },
                                {
                                    name: 'BigQuery',
                                    badge: 'EASY MIGRATION',
                                    badgeColor: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
                                    color: 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20',
                                    effort: 'Low — GCS upload + external table',
                                    pros: ['Petabyte-scale serverless analytics', 'Native Parquet + Hive partition ingestion', 'BQML for built-in ML on analytics data', 'Automatic partition discovery from GCS path'],
                                    cons: ['GCP lock-in', 'Cost unpredictable at scale', 'Not suitable for sub-second dashboard queries'],
                                    snippet: `# 1. Upload to GCS
gsutil -m rsync -r data-lake/ gs://bucket/data-lake/

# 2. Create BigQuery external table
bq mk --table --external_table_definition=@PARQUET=gs://bucket/data-lake/events/*/*/*.parquet \\
  myproject:analytics.events_cold`,
                                },
                            ].map(({ name, badge, badgeColor, color, effort, pros, cons, snippet }) => (
                                <div key={name} className={`rounded-lg border-2 ${color} p-3 space-y-2`}>
                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                        <span className="font-semibold text-sm text-text-primary dark:text-text-primary-dark">{name}</span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
                                    </div>
                                    <div className="text-[10px] text-text-muted dark:text-text-muted-dark">Migration effort: <span className="font-medium text-text-primary dark:text-text-primary-dark">{effort}</span></div>
                                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                                        <div>
                                            <p className="font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">Pros</p>
                                            {pros.map(p => <div key={p} className="text-text-secondary dark:text-text-secondary-dark">✓ {p}</div>)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-red-500 mb-0.5">Cons</p>
                                            {cons.map(c => <div key={c} className="text-text-secondary dark:text-text-secondary-dark">✗ {c}</div>)}
                                        </div>
                                    </div>
                                    <details className="group">
                                        <summary className="text-[10px] font-medium text-accent cursor-pointer list-none hover:underline">Show migration snippet ▾</summary>
                                        <pre className="mt-1 text-[9px] font-mono bg-gray-900 dark:bg-black text-green-400 rounded p-2 overflow-x-auto whitespace-pre-wrap">{snippet}</pre>
                                    </details>
                                </div>
                            ))}
                        </div>

                        {/* Key insight */}
                        <div className="rounded-lg border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-900/20 p-3 text-xs text-indigo-700 dark:text-indigo-300">
                            <strong>Key insight:</strong> Because the write path (PostgreSQL) and cold storage (Hive Parquet) are fully decoupled from the query engine, you can migrate the analytics read layer to any of these engines <em>without touching the tracking script or PostgreSQL schema</em>. Only the query functions in <code className="font-mono">src/queries/queries.js</code> need updating.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function DeveloperGuide() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">Documentation</h1>
                <p className="mt-1 text-text-secondary dark:text-text-secondary-dark">
                    Technical reference — architecture evolution (v1→v2 hot/cold), APIs, tracking events, DB schema, deployment, and query engine migration paths.
                </p>
            </div>

            {/* Architecture Overview */}
            <ArchitectureDiagram />

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
