import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    BarChart3, Shield, Zap, Globe, Code, Database, ArrowRight, ArrowDown,
    CheckCircle, TrendingUp, Users, Eye, LineChart, Layers,
    Lock, Server, GitBranch, Clock, Sun, Moon, Monitor, RefreshCw,
    FileCode, MousePointerClick, LayoutDashboard, Activity
} from 'lucide-react';

const features = [
    {
        icon: Eye,
        title: 'Real-Time Analytics',
        description: 'See visitors on your site right now. Track pageviews, sessions, and engagement as they happen.',
    },
    {
        icon: Shield,
        title: 'Privacy-First',
        description: 'No cookies, no fingerprinting, no personal data collection. Fully GDPR compliant out of the box.',
    },
    {
        icon: Zap,
        title: 'Lightweight Script',
        description: 'Under 2KB tracking script. Zero impact on your site performance — no slowdowns, ever.',
    },
    {
        icon: Globe,
        title: 'Country Detection',
        description: 'Automatic visitor country detection using timezone — no external GeoIP services required.',
    },
    {
        icon: TrendingUp,
        title: 'Conversion Funnels',
        description: 'Define multi-step funnels to track user journeys from landing to conversion.',
    },
    {
        icon: Layers,
        title: 'Multi-Site Support',
        description: 'Manage unlimited websites from a single dashboard. Switch between sites instantly.',
    },
];

const techStack = [
    { icon: Code, label: 'React 18', desc: 'Modern dashboard UI' },
    { icon: Server, label: 'Express + Node.js', desc: 'Rock-solid backend' },
    { icon: Database, label: 'PostgreSQL + DuckDB', desc: 'Dual-database architecture' },
    { icon: Lock, label: 'JWT Auth', desc: 'Secure authentication' },
    { icon: GitBranch, label: 'Open Source', desc: 'Self-hosted, full control' },
    { icon: Clock, label: 'Auto Sync', desc: 'PG → DuckDB every 60s' },
];

export default function Landing() {
    const [dark, setDark] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('insighttrack-landing-theme');
            if (saved) return saved === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return true;
    });

    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark);
        localStorage.setItem('insighttrack-landing-theme', dark ? 'dark' : 'light');
    }, [dark]);

    return (
        <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">InsightTrack</span>
                    </div>
                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Features</a>
                        <a href="#how-it-works" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">How It Works</a>
                        <a href="#tech-stack" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Tech Stack</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setDark(d => !d)}
                            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
                            aria-label="Toggle theme"
                        >
                            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>
                        <Link
                            to="/login"
                            className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            Sign In
                        </Link>
                        <Link
                            to="/register"
                            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6 relative overflow-hidden">
                <div className="absolute inset-0 -z-10">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent rounded-full blur-3xl" />
                </div>

                <div className="max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 mb-8">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Open-Source &amp; Self-Hosted</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
                        Web analytics that<br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-500 to-pink-500">respect your users</span>
                    </h1>

                    <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Powerful, real-time website analytics without cookies or personal data tracking.
                        Self-hosted, open source, and blazingly fast with DuckDB-powered queries.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                        <Link
                            to="/register"
                            className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold text-white
                                bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-lg shadow-indigo-500/30"
                        >
                            Start Tracking Free
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                        <a
                            href="#how-it-works"
                            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold
                                text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
                                rounded-xl transition-colors"
                        >
                            See How It Works
                        </a>
                    </div>

                    {/* Dashboard Preview Mockup */}
                    <div className="max-w-5xl mx-auto relative">
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[80%] h-48 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-2xl shadow-black/10 dark:shadow-black/40">
                            {/* Browser bar */}
                            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                                <span className="w-3 h-3 rounded-full bg-red-400" />
                                <span className="w-3 h-3 rounded-full bg-yellow-400" />
                                <span className="w-3 h-3 rounded-full bg-green-400" />
                                <div className="flex-1 ml-3 px-3 py-1 rounded-md bg-gray-200/70 dark:bg-gray-700/60 text-xs text-gray-500 dark:text-gray-400">
                                    localhost:5173
                                </div>
                            </div>
                            {/* Dashboard body */}
                            <div className="flex min-h-[380px]">
                                {/* Sidebar */}
                                <div className="hidden md:flex flex-col w-48 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-4">
                                    <div className="flex items-center gap-2 mb-6">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
                                            <BarChart3 className="w-3.5 h-3.5 text-white" />
                                        </div>
                                        <span className="text-xs font-bold">InsightTrack</span>
                                    </div>
                                    {['Dashboard', 'Pages', 'Funnels', 'Realtime', 'Settings'].map((item, i) => (
                                        <div key={item} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-0.5 ${i === 0 ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                                            {item}
                                        </div>
                                    ))}
                                </div>
                                {/* Main */}
                                <div className="flex-1 p-5 overflow-hidden">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-bold">Dashboard</span>
                                        <div className="flex gap-1">
                                            {['Today', '7d', '30d', '90d'].map(d => (
                                                <span key={d} className={`px-2 py-0.5 rounded text-[10px] font-medium ${d === '30d' ? 'bg-indigo-600 text-white' : 'text-gray-400 dark:text-gray-500'}`}>{d}</span>
                                            ))}
                                        </div>
                                    </div>
                                    {/* KPI cards */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                                        {[
                                            { label: 'Visitors', value: '12,847', trend: '↑ 12.3%', color: 'text-emerald-500', sparkColor: 'stroke-indigo-400' },
                                            { label: 'Pageviews', value: '34,201', trend: '↑ 8.7%', color: 'text-emerald-500', sparkColor: 'stroke-emerald-400' },
                                            { label: 'Bounce Rate', value: '42.5%', trend: '↓ 2.1%', color: 'text-red-500', sparkColor: 'stroke-orange-400' },
                                            { label: 'Avg. Duration', value: '3m 05s', trend: '↑ 5.4%', color: 'text-emerald-500', sparkColor: 'stroke-purple-400' },
                                        ].map(kpi => (
                                            <div key={kpi.label} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-xl p-3">
                                                <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">{kpi.label}</p>
                                                <p className="text-lg font-extrabold">{kpi.value}</p>
                                                <span className={`text-[10px] font-semibold ${kpi.color}`}>{kpi.trend}</span>
                                                <svg className="mt-1 w-full h-6" viewBox="0 0 120 24" preserveAspectRatio="none">
                                                    <path d="M0,20 L10,17 L20,14 L30,16 L40,11 L50,13 L60,8 L70,10 L80,5 L90,7 L100,3 L110,5 L120,2" fill="none" className={kpi.sparkColor} strokeWidth="1.5" />
                                                </svg>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Charts */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-xl p-4">
                                            <p className="text-xs font-semibold mb-3">Traffic Over Time</p>
                                            <svg className="w-full h-24" viewBox="0 0 300 90" preserveAspectRatio="none">
                                                <path d="M0,70 C20,65 40,45 60,50 C80,55 100,30 120,35 C140,40 160,22 180,27 C200,32 220,15 240,20 C260,25 280,12 300,8" fill="none" stroke="#818cf8" strokeWidth="2" />
                                                <path d="M0,70 C20,65 40,45 60,50 C80,55 100,30 120,35 C140,40 160,22 180,27 C200,32 220,15 240,20 C260,25 280,12 300,8 L300,90 L0,90Z" fill="#6366f1" opacity="0.1" />
                                                <path d="M0,75 C20,72 40,60 60,64 C80,67 100,48 120,52 C140,56 160,40 180,44 C200,48 220,33 240,37 C260,40 280,28 300,24" fill="none" stroke="#a78bfa" strokeWidth="1.5" opacity="0.5" />
                                            </svg>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-xl p-4">
                                            <p className="text-xs font-semibold mb-3">Traffic Sources</p>
                                            <div className="flex items-center gap-4 h-24">
                                                <svg width="80" height="80" viewBox="0 0 80 80">
                                                    <circle cx="40" cy="40" r="30" fill="none" stroke="#6366f1" strokeWidth="10" strokeDasharray="66 124" strokeDashoffset="0" />
                                                    <circle cx="40" cy="40" r="30" fill="none" stroke="#22c55e" strokeWidth="10" strokeDasharray="38 152" strokeDashoffset="-66" />
                                                    <circle cx="40" cy="40" r="30" fill="none" stroke="#f97316" strokeWidth="10" strokeDasharray="28 162" strokeDashoffset="-104" />
                                                    <circle cx="40" cy="40" r="30" fill="none" stroke="#a78bfa" strokeWidth="10" strokeDasharray="24 166" strokeDashoffset="-132" />
                                                    <circle cx="40" cy="40" r="30" fill="none" stroke="#14b8a6" strokeWidth="10" strokeDasharray="14 176" strokeDashoffset="-156" />
                                                </svg>
                                                <div className="flex flex-col gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                                                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500" />Direct 35%</div>
                                                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Google 20%</div>
                                                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500" />Social 15%</div>
                                                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-400" />Referral 13%</div>
                                                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-500" />Email 8%</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-xl p-4">
                                            <p className="text-xs font-semibold mb-3">Top Pages</p>
                                            <div className="space-y-2">
                                                {[
                                                    { path: '/home', width: '90%', views: '4,230' },
                                                    { path: '/pricing', width: '65%', views: '2,810' },
                                                    { path: '/about', width: '45%', views: '1,940' },
                                                    { path: '/blog', width: '35%', views: '1,520' },
                                                    { path: '/contact', width: '20%', views: '870' },
                                                ].map(p => (
                                                    <div key={p.path} className="flex items-center gap-2">
                                                        <span className="w-14 text-[10px] text-gray-400 dark:text-gray-500 truncate">{p.path}</span>
                                                        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: p.width }} />
                                                        </div>
                                                        <span className="w-8 text-right text-[10px] text-gray-400 dark:text-gray-500">{p.views}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-xl p-4">
                                            <p className="text-xs font-semibold mb-3">Devices</p>
                                            <div className="flex items-center gap-4 h-24">
                                                <svg width="80" height="80" viewBox="0 0 80 80">
                                                    <circle cx="40" cy="40" r="30" fill="none" stroke="#3b82f6" strokeWidth="10" strokeDasharray="113 77" strokeDashoffset="0" />
                                                    <circle cx="40" cy="40" r="30" fill="none" stroke="#14b8a6" strokeWidth="10" strokeDasharray="57 133" strokeDashoffset="-113" />
                                                    <circle cx="40" cy="40" r="30" fill="none" stroke="#f97316" strokeWidth="10" strokeDasharray="19 171" strokeDashoffset="-170" />
                                                </svg>
                                                <div className="flex flex-col gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                                                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />Desktop 60%</div>
                                                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-500" />Mobile 30%</div>
                                                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500" />Tablet 10%</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 px-6 bg-gray-50 dark:bg-gray-900/50">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to understand your users</h2>
                        <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                            A complete analytics suite that puts you in control — no third-party dependencies.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((f) => (
                            <div key={f.title} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-lg transition-shadow group">
                                <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-colors">
                                    <f.icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{f.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="py-24 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Up and running in 3 steps</h2>
                        <p className="text-gray-600 dark:text-gray-400">
                            From zero to full analytics in under 5 minutes.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                step: '01',
                                title: 'Create an Account',
                                description: 'Sign up and add your first website. Enter your site name and domain — that\'s it.',
                                icon: Users,
                            },
                            {
                                step: '02',
                                title: 'Add Tracking Script',
                                description: 'Copy the one-line script tag and paste it into your website\'s <head>. Under 2KB, no setup needed.',
                                icon: Code,
                            },
                            {
                                step: '03',
                                title: 'View Your Dashboard',
                                description: 'Traffic, pageviews, sources, devices, countries — all updating in real-time within seconds.',
                                icon: LineChart,
                            },
                        ].map((s) => (
                            <div key={s.step} className="relative">
                                <div className="text-6xl font-black text-gray-100 dark:text-gray-800 mb-4">{s.step}</div>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                                        <s.icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold">{s.title}</h3>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{s.description}</p>
                            </div>
                        ))}
                    </div>

                    {/* Code snippet */}
                    <div className="mt-16 bg-gray-900 rounded-2xl p-6 overflow-hidden shadow-2xl">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span className="ml-3 text-xs text-gray-500">index.html</span>
                        </div>
                        <pre className="text-sm text-gray-300 overflow-x-auto">
                            <code>{`<head>
  <!-- One line — that's all you need -->
  <script src="https://your-server.com/api/sites/YOUR_SITE_ID/script"></script>
</head>`}</code>
                        </pre>
                    </div>
                </div>
            </section>

            {/* Architecture / Tech Stack */}
            <section id="tech-stack" className="py-24 px-6 bg-gray-50 dark:bg-gray-900/50">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for speed &amp; reliability</h2>
                        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                            Dual-database architecture: PostgreSQL handles writes (tracking, auth), DuckDB powers
                            lightning-fast analytical queries. Auto-synced every 60 seconds.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-16">
                        {techStack.map((t) => (
                            <div key={t.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 text-center hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors">
                                <t.icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mx-auto mb-3" />
                                <h4 className="font-semibold text-sm mb-1">{t.label}</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{t.desc}</p>
                            </div>
                        ))}
                    </div>

                    {/* Architecture diagram */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 max-w-4xl mx-auto">
                        <h3 className="text-lg font-semibold mb-6 text-center">System Architecture</h3>

                        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
                            {/* Left: Clients */}
                            <div className="flex flex-col gap-4 w-full md:w-auto shrink-0">
                                <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
                                    <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-sm">Your Website</div>
                                        <div className="text-[10px] text-gray-500 dark:text-gray-400">(tracking)</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 px-4 py-3 bg-cyan-50 dark:bg-cyan-500/10 rounded-xl border border-cyan-200 dark:border-cyan-500/20">
                                    <LayoutDashboard className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-sm">Dashboard</div>
                                        <div className="text-[10px] text-gray-500 dark:text-gray-400">React SPA · port 5173</div>
                                    </div>
                                </div>
                            </div>

                            {/* Center: Arrows */}
                            <div className="flex flex-col gap-6 items-center shrink-0">
                                <div className="flex flex-col items-center">
                                    <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500 hidden md:block" />
                                    <ArrowDown className="w-5 h-5 text-gray-400 dark:text-gray-500 md:hidden" />
                                    <span className="text-[8px] text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap">POST /api/track/*</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500 hidden md:block rotate-180" />
                                    <ArrowDown className="w-5 h-5 text-gray-400 dark:text-gray-500 md:hidden rotate-180" />
                                    <span className="text-[8px] text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap">GET /api/analytics/*</span>
                                </div>
                            </div>

                            {/* Right: Unified Backend */}
                            <div className="flex-1 w-full bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-200 dark:border-green-500/20 p-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <Server className="w-5 h-5 text-green-600 dark:text-green-400" />
                                    <div>
                                        <div className="font-semibold text-sm">Unified Backend</div>
                                        <div className="text-[10px] text-gray-500 dark:text-gray-400">Express + Node.js · port 3001</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 justify-center">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg border border-indigo-200 dark:border-indigo-500/20">
                                        <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                        <div>
                                            <div className="text-xs font-semibold">PG</div>
                                            <div className="text-[9px] text-gray-500 dark:text-gray-400">(writes)</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5">
                                        <RefreshCw className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                                        <span className="text-[8px] text-amber-600 dark:text-amber-400 font-medium">sync</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-500/10 rounded-lg border border-purple-200 dark:border-purple-500/20">
                                        <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                        <div>
                                            <div className="text-xs font-semibold">DuckDB</div>
                                            <div className="text-[9px] text-gray-500 dark:text-gray-400">(reads)</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Comparison */}
            <section className="py-24 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Why InsightTrack?</h2>
                    </div>

                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-800">
                                    <th className="text-left px-6 py-4 font-semibold">Feature</th>
                                    <th className="px-6 py-4 font-semibold text-indigo-600">InsightTrack</th>
                                    <th className="px-6 py-4 font-semibold text-gray-400">Google Analytics</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    ['Privacy-first (no cookies)', true, false],
                                    ['Self-hosted / own your data', true, false],
                                    ['Open source', true, false],
                                    ['Lightweight script (<2KB)', true, false],
                                    ['Real-time dashboard', true, true],
                                    ['No GDPR cookie banner needed', true, false],
                                    ['Conversion funnels', true, true],
                                    ['DuckDB-powered analytics', true, false],
                                    ['Free forever', true, false],
                                ].map(([feature, us, them]) => (
                                    <tr key={feature} className="border-b border-gray-100 dark:border-gray-800/50 last:border-0">
                                        <td className="px-6 py-3.5 text-gray-700 dark:text-gray-300">{feature}</td>
                                        <td className="px-6 py-3.5 text-center">
                                            {us ? <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto" /> :
                                                <span className="text-gray-300 dark:text-gray-600">—</span>}
                                        </td>
                                        <td className="px-6 py-3.5 text-center">
                                            {them ? <CheckCircle className="w-5 h-5 text-gray-400 mx-auto" /> :
                                                <span className="text-gray-300 dark:text-gray-600">—</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 rounded-3xl p-12 md:p-16 text-white relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute top-10 left-10 w-40 h-40 bg-white rounded-full blur-3xl" />
                            <div className="absolute bottom-10 right-10 w-60 h-60 bg-purple-300 rounded-full blur-3xl" />
                        </div>
                        <div className="relative z-10">
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">
                                Ready to take control of your analytics?
                            </h2>
                            <p className="text-white/70 mb-8 max-w-lg mx-auto">
                                Set up in minutes. No credit card required. Own your data, understand your audience.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link
                                    to="/register"
                                    className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold
                                        bg-white text-indigo-700 hover:bg-gray-100 rounded-xl transition-colors shadow-lg"
                                >
                                    Create Free Account
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                                <Link
                                    to="/login"
                                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold
                                        text-white/90 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                                >
                                    Sign In
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-gray-200 dark:border-gray-800 py-12 px-6">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm font-semibold">InsightTrack</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                        <a href="#features" className="hover:text-gray-900 dark:hover:text-white transition-colors">Features</a>
                        <a href="#how-it-works" className="hover:text-gray-900 dark:hover:text-white transition-colors">How It Works</a>
                        <a href="#tech-stack" className="hover:text-gray-900 dark:hover:text-white transition-colors">Tech Stack</a>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-600">
                        &copy; {new Date().getFullYear()} InsightTrack. Open-source web analytics.
                    </p>
                </div>
            </footer>
        </div>
    );
}
