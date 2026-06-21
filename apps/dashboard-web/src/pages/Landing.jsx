import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    BarChart3, Shield, Zap, Globe, Code, Database,
    ArrowRight, Users, Eye, Lock, Server, Check,
    MousePointerClick, LayoutDashboard, Activity, Target,
    Megaphone, Gauge, Sun, Moon, Menu, X, ChevronRight,
    TrendingUp, TrendingDown, Star, RefreshCw, Layers,
    Terminal, FileText, Map, GitBranch, AlertTriangle,
} from 'lucide-react';

// ─── CSS-in-JS animation keyframes injected once ─────────────────────────────
const ANIM_CSS = `
@keyframes fadeUp   { from { opacity:0; transform:translateY(28px) } to { opacity:1; transform:translateY(0) } }
@keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
@keyframes scaleIn  { from { opacity:0; transform:scale(0.92) } to { opacity:1; transform:scale(1) } }
@keyframes slideLeft{ from { opacity:0; transform:translateX(40px) } to { opacity:1; transform:translateX(0) } }
@keyframes float    { 0%,100% { transform:translateY(0px) } 50% { transform:translateY(-10px) } }
@keyframes float2   { 0%,100% { transform:translateY(-6px) } 50% { transform:translateY(6px) } }
@keyframes pulse-ring { 0%{ box-shadow:0 0 0 0 rgba(99,102,241,0.4) } 70%{ box-shadow:0 0 0 12px rgba(99,102,241,0) } 100%{ box-shadow:0 0 0 0 rgba(99,102,241,0) } }
@keyframes shimmer  { from{ background-position:-200% 0 } to{ background-position:200% 0 } }
@keyframes ticker   { from{ opacity:0;transform:translateY(8px) } to{ opacity:1;transform:translateY(0) } }
@keyframes gradShift{ 0%,100%{ background-position:0% 50% } 50%{ background-position:100% 50% } }
@keyframes spin-slow{ to{ transform:rotate(360deg) } }
.reveal { opacity:0; transform:translateY(24px); transition:opacity 0.6s cubic-bezier(.22,1,.36,1), transform 0.6s cubic-bezier(.22,1,.36,1); }
.reveal.visible { opacity:1; transform:translateY(0); }
.reveal-scale { opacity:0; transform:scale(0.94); transition:opacity 0.5s cubic-bezier(.22,1,.36,1), transform 0.5s cubic-bezier(.22,1,.36,1); }
.reveal-scale.visible { opacity:1; transform:scale(1); }
.reveal-left { opacity:0; transform:translateX(32px); transition:opacity 0.6s cubic-bezier(.22,1,.36,1), transform 0.6s cubic-bezier(.22,1,.36,1); }
.reveal-left.visible { opacity:1; transform:translateX(0); }
`;
if (typeof document !== 'undefined' && !document.getElementById('landing-anim-css')) {
    const s = document.createElement('style');
    s.id = 'landing-anim-css'; s.textContent = ANIM_CSS;
    document.head.appendChild(s);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useIntersect(options = {}) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current; if (!el) return;
        const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { threshold: 0.12, ...options });
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return [ref, visible];
}

function useCounter(target, duration = 1400, start = false) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!start) return;
        let frame; const step = () => {
            const now = performance.now();
            const progress = Math.min((now - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            setVal(Math.floor(ease * target));
            if (progress < 1) frame = requestAnimationFrame(step);
        };
        const startTime = performance.now();
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, [target, duration, start]);
    return val;
}

function useMouseParallax(strength = 0.02) {
    const [pos, setPos] = useState({ x: 0, y: 0 });
    useEffect(() => {
        const move = (e) => setPos({
            x: (e.clientX - window.innerWidth / 2) * strength,
            y: (e.clientY - window.innerHeight / 2) * strength,
        });
        window.addEventListener('mousemove', move, { passive: true });
        return () => window.removeEventListener('mousemove', move);
    }, [strength]);
    return pos;
}

// ─── Reusable ─────────────────────────────────────────────────────────────────

function Reveal({ children, className = '', delay = 0, type = 'up' }) {
    const [ref, visible] = useIntersect();
    const cls = type === 'scale' ? 'reveal-scale' : type === 'left' ? 'reveal-left' : 'reveal';
    return (
        <div ref={ref} className={`${cls} ${visible ? 'visible' : ''} ${className}`}
            style={visible ? {} : { transitionDelay: `${delay}ms` }}>
            {children}
        </div>
    );
}

// ─── Animated counter widget ──────────────────────────────────────────────────
function StatCounter({ value, suffix = '', label, color = 'text-indigo-600 dark:text-indigo-400' }) {
    const [ref, visible] = useIntersect();
    const num = useCounter(value, 1200, visible);
    return (
        <div ref={ref} className="text-center">
            <div className={`text-3xl sm:text-4xl font-black tabular-nums ${color}`}>
                {num}{suffix}
            </div>
            <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">{label}</div>
        </div>
    );
}

// ─── Mini KPI card (used in floating widgets) ─────────────────────────────────
function KpiChip({ label, value, trend, up, color }) {
    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-lg shadow-black/8 p-4 min-w-[148px]">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white leading-none">{value}</p>
            <div className={`flex items-center gap-1 mt-1.5 text-[11px] font-semibold ${up ? 'text-emerald-500' : 'text-red-400'}`}>
                {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {trend}
            </div>
            {/* Sparkline */}
            <svg className="mt-2 w-full h-8" viewBox="0 0 80 24" preserveAspectRatio="none">
                <path d={up ? "M0,20 L10,16 L20,13 L30,15 L40,9 L50,11 L60,5 L70,7 L80,3"
                             : "M0,4  L10,7  L20,10 L30,8  L40,14 L50,12 L60,18 L70,16 L80,20"}
                    fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        </div>
    );
}

// ─── Mini chart widget ────────────────────────────────────────────────────────
function MiniChart({ title, type = 'area' }) {
    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-lg shadow-black/8 p-4">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-3">{title}</p>
            <svg className="w-full h-20" viewBox="0 0 200 60" preserveAspectRatio="none">
                {type === 'area' ? <>
                    <defs>
                        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path d="M0,50 C20,45 35,28 55,32 C75,36 90,18 110,22 C130,26 145,10 165,14 C180,17 195,8 200,5"
                        fill="none" stroke="#6366f1" strokeWidth="2" />
                    <path d="M0,50 C20,45 35,28 55,32 C75,36 90,18 110,22 C130,26 145,10 165,14 C180,17 195,8 200,5 L200,60 L0,60Z"
                        fill="url(#g1)" />
                </> : type === 'bar' ? <>
                    {[42,65,38,80,55,90,48,72,85,60,95,70].map((h, i) => (
                        <rect key={i} x={i * 17 + 1} y={60 - h * 0.58} width="12" height={h * 0.58}
                            rx="3" fill={i === 11 ? '#6366f1' : '#6366f115'} />
                    ))}
                </> : <>
                    {/* Donut */}
                    <circle cx="40" cy="30" r="22" fill="none" stroke="#6366f1" strokeWidth="8" strokeDasharray="83 56" strokeDashoffset="0" />
                    <circle cx="40" cy="30" r="22" fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray="34 105" strokeDashoffset="-83" />
                    <circle cx="40" cy="30" r="22" fill="none" stroke="#f97316" strokeWidth="8" strokeDasharray="22 117" strokeDashoffset="-117" />
                    <text x="40" y="35" textAnchor="middle" fontSize="9" fontWeight="700" fill="#6366f1">62%</text>
                    <g transform="translate(100,4)">
                        {[['#6366f1','Direct 44%'],['#10b981','Google 18%'],['#f97316','Social 12%']].map(([c,l],i) => (
                            <g key={i} transform={`translate(0,${i*16})`}>
                                <circle cx="5" cy="5" r="4" fill={c} />
                                <text x="14" y="9" fontSize="8" fill="currentColor" className="text-gray-500">{l}</text>
                            </g>
                        ))}
                    </g>
                </>}
            </svg>
        </div>
    );
}

// ─── Realtime widget ──────────────────────────────────────────────────────────
function RealtimeWidget() {
    const [count, setCount] = useState(24);
    const [pages, setPages] = useState([
        { path: '/pricing', active: 9 },
        { path: '/home',    active: 7 },
        { path: '/docs',    active: 5 },
        { path: '/blog',    active: 3 },
    ]);
    useEffect(() => {
        const t = setInterval(() => {
            setCount(c => Math.max(18, Math.min(38, c + Math.round((Math.random() - 0.5) * 3))));
            setPages(prev => prev.map(p => ({ ...p, active: Math.max(1, p.active + Math.round((Math.random() - 0.5) * 2)) })));
        }, 2200);
        return () => clearInterval(t);
    }, []);
    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-black/10 p-4 min-w-[200px]">
            <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute" style={{ animationDuration: '1.4s' }} />
                <span className="w-2 h-2 rounded-full bg-emerald-500 relative" />
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Live visitors</span>
            </div>
            <div className="text-3xl font-black text-gray-900 dark:text-white tabular-nums mb-3" key={count}
                style={{ animation: 'ticker 0.25s ease-out' }}>
                {count}
            </div>
            <div className="space-y-1.5">
                {pages.map(p => (
                    <div key={p.path} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 w-20 truncate font-mono">{p.path}</span>
                        <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500/70 rounded-full transition-all duration-700"
                                style={{ width: `${(p.active / 12) * 100}%` }} />
                        </div>
                        <span className="text-[10px] tabular-nums text-gray-400 w-3">{p.active}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Heatmap dot widget ───────────────────────────────────────────────────────
function HeatmapWidget() {
    const dots = [
        { x: 55, y: 35, r: 28, c: 'rgba(239,68,68,0.7)' },
        { x: 78, y: 62, r: 18, c: 'rgba(249,115,22,0.6)' },
        { x: 25, y: 70, r: 14, c: 'rgba(234,179,8,0.6)' },
        { x: 40, y: 20, r: 10, c: 'rgba(34,197,94,0.5)' },
        { x: 85, y: 30, r: 8,  c: 'rgba(99,102,241,0.45)' },
        { x: 15, y: 45, r: 7,  c: 'rgba(99,102,241,0.4)' },
    ];
    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-black/10 overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Visual Heatmap</p>
                <p className="text-[10px] text-gray-400">Click hotspots · /pricing</p>
            </div>
            <div className="relative h-28 bg-gray-50 dark:bg-gray-800/50">
                {/* Fake page grid lines */}
                {[30, 60, 90].map(y => <div key={y} className="absolute w-full h-px bg-gray-200/60 dark:bg-gray-700/40" style={{ top: `${y}%` }} />)}
                {/* Dots */}
                {dots.map((d, i) => (
                    <div key={i} className="absolute rounded-full transition-all duration-500"
                        style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.r * 2, height: d.r * 2,
                            transform: 'translate(-50%,-50%)', background: d.c,
                            boxShadow: `0 0 ${d.r * 1.4}px ${d.c}`,
                            animation: `float ${2.5 + i * 0.4}s ease-in-out infinite`,
                        }} />
                ))}
                <div className="absolute bottom-2 right-2 text-[9px] text-gray-400 font-mono">
                    342 clicks · 18 elements
                </div>
            </div>
        </div>
    );
}

// ─── Feature showcase interactive card ───────────────────────────────────────

const FEATURES = [
    {
        icon: Activity,
        accent: '#6366f1',
        bg: 'from-indigo-500/10 to-indigo-500/5',
        border: 'border-indigo-200 dark:border-indigo-500/20',
        label: 'Realtime',
        title: 'See who\'s on your site right now',
        desc: 'Live visitor count, active pages, device breakdown, and a world map — updating every 5 seconds. Know the moment a campaign lands.',
        metric: { value: '24', label: 'live now', up: true },
    },
    {
        icon: Shield,
        accent: '#10b981',
        bg: 'from-emerald-500/10 to-emerald-500/5',
        border: 'border-emerald-200 dark:border-emerald-500/20',
        label: 'Privacy',
        title: 'No cookies. No consent banner.',
        desc: 'Cookieless tracking using anonymous localStorage IDs. No IP storage, no fingerprinting. GDPR-compliant by design. DNT and GPC respected automatically.',
        metric: { value: '0', label: 'cookies set', up: true },
    },
    {
        icon: Zap,
        accent: '#f59e0b',
        bg: 'from-amber-500/10 to-amber-500/5',
        border: 'border-amber-200 dark:border-amber-500/20',
        label: 'Speed',
        title: '90-day queries in under 50ms',
        desc: 'DuckDB runs analytics reads in-process. No network round-trip to a query engine. Hot tier (last 30 days) in RAM, cold Parquet on disk.',
        metric: { value: '50', label: 'ms p99 query', up: true },
    },
    {
        icon: MousePointerClick,
        accent: '#ef4444',
        bg: 'from-rose-500/10 to-rose-500/5',
        border: 'border-rose-200 dark:border-rose-500/20',
        label: 'Heatmaps',
        title: 'See exactly where users click',
        desc: 'Colour-coded click dots overlaid on your live page. Filter by desktop vs mobile. Cluster nearby clicks, export as CSV, paginated distribution table.',
        metric: { value: '342', label: 'clicks tracked', up: true },
    },
    {
        icon: Layers,
        accent: '#8b5cf6',
        bg: 'from-violet-500/10 to-violet-500/5',
        border: 'border-violet-200 dark:border-violet-500/20',
        label: 'Funnels',
        title: 'Find where users drop off',
        desc: 'Define multi-step conversion funnels. Visual narrowing chart with per-stage drop-off rates. Pin your best funnel to the main dashboard.',
        metric: { value: '68', label: '% conversion', up: false },
    },
    {
        icon: LayoutDashboard,
        accent: '#06b6d4',
        bg: 'from-cyan-500/10 to-cyan-500/5',
        border: 'border-cyan-200 dark:border-cyan-500/20',
        label: 'Dashboards',
        title: 'Drag-drop custom dashboards',
        desc: 'Freeform pixel canvas. KPI cards, charts, tables, text notes. Snap-to-grid, per-widget PNG capture, share via public URL — no login needed.',
        metric: { value: '18', label: 'data sources', up: true },
    },
];

const WHY_TABLE = [
    ['No cookies / no consent banner',  true, false, false],
    ['Self-hosted — you own all data',  true, false, false],
    ['Free forever',                    true, false, false],
    ['Script under 2 KB',               true, false, false],
    ['Heatmaps included',               true, false, true],
    ['JS error tracking',               true, false, true],
    ['SQL editor built-in',             true, false, false],
    ['Custom drag-drop dashboards',     true, false, false],
    ['Real-time dashboard',             true, true,  true],
    ['Core Web Vitals monitoring',      true, false, true],
];

const HOW_STEPS = [
    { n: '01', icon: Users,    title: 'Create an account',     desc: 'Sign up, add your website domain. 30 seconds.' },
    { n: '02', icon: Code,     title: 'Add one script tag',    desc: 'Paste a single <script> into your site\'s <head>. Under 2 KB.' },
    { n: '03', icon: BarChart3, title: 'See everything live', desc: '17 analytics pages ready instantly — no configuration.' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Landing() {
    const [dark, setDark] = useState(() => {
        if (typeof window !== 'undefined') {
            const s = localStorage.getItem('it-theme');
            if (s) return s === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return true;
    });
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeFeature, setActiveFeature] = useState(0);
    const [scrolled, setScrolled] = useState(false);
    const mouse = useMouseParallax(0.018);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark);
        localStorage.setItem('it-theme', dark ? 'dark' : 'light');
    }, [dark]);

    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 24);
        window.addEventListener('scroll', fn, { passive: true });
        return () => window.removeEventListener('scroll', fn);
    }, []);

    // Auto-cycle features
    useEffect(() => {
        const t = setInterval(() => setActiveFeature(i => (i + 1) % FEATURES.length), 3800);
        return () => clearInterval(t);
    }, []);

    const feat = FEATURES[activeFeature];

    return (
        <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] text-gray-900 dark:text-white overflow-x-hidden">

            {/* ── NAV ────────────────────────────────────────────────────── */}
            <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled
                ? 'bg-white/90 dark:bg-[#0a0a0f]/90 backdrop-blur-2xl border-b border-gray-200/80 dark:border-gray-800/80 shadow-sm'
                : 'bg-transparent'}`}>
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <BarChart3 className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-[15px] tracking-tight">InsightTrack</span>
                    </div>

                    <div className="hidden md:flex items-center gap-7">
                        {[['#features','Features'],['#showcase','Showcase'],['#how','Setup'],['#why','Why Us']].map(([h,l]) => (
                            <a key={l} href={h} className="text-[13px] font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">{l}</a>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => setDark(d => !d)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>
                        <Link to="/login" className="hidden sm:flex text-[13px] font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-2 transition-colors">Sign in</Link>
                        <Link to="/register" className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white rounded-xl
                            bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
                            shadow-md shadow-indigo-500/25 transition-all hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-px">
                            Get started <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={() => setMenuOpen(v => !v)} className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
                {menuOpen && (
                    <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0a0a0f] px-4 py-4 space-y-1">
                        {[['#features','Features'],['#showcase','Showcase'],['#how','Setup'],['#why','Why Us']].map(([h,l]) => (
                            <a key={l} href={h} onClick={() => setMenuOpen(false)}
                                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                <ChevronRight className="w-3.5 h-3.5 text-indigo-500" />{l}
                            </a>
                        ))}
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-2">
                            <Link to="/login" className="py-2.5 text-sm font-medium text-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Sign in</Link>
                            <Link to="/register" className="py-2.5 text-sm font-semibold text-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">Get started</Link>
                        </div>
                    </div>
                )}
            </nav>

            {/* ── HERO ───────────────────────────────────────────────────── */}
            <section className="relative flex flex-col items-center pt-28 sm:pt-32 pb-0 px-4 sm:px-6 overflow-hidden">

                {/* Background grid */}
                <div className="absolute inset-0 -z-10"
                    style={{ backgroundImage: 'radial-gradient(circle, #6366f108 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
                {/* Glow orbs */}
                <div className="absolute -z-10 top-20 left-1/2 w-[800px] h-[500px] rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.13) 0%, transparent 70%)', transform: `translate(calc(-50% + ${mouse.x}px), ${mouse.y}px)` }} />
                <div className="absolute -z-10 top-40 right-0 w-[360px] h-[360px] rounded-full opacity-40 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />
                <div className="absolute -z-10 top-40 left-0 w-[300px] h-[300px] rounded-full opacity-40 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse, rgba(236,72,153,0.08) 0%, transparent 70%)' }} />

                {/* ── Badge ── */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-500/25
                    bg-indigo-50 dark:bg-indigo-500/8 mb-6 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300"
                    style={{ animation: 'fadeUp 0.6s ease-out both' }}>
                    <span className="relative flex w-2 h-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
                    </span>
                    Open-source · Self-hosted · Privacy-first
                </div>

                {/* ── Headline ── */}
                <h1 className="text-[42px] sm:text-6xl lg:text-[76px] font-black tracking-[-0.02em] leading-[1.04] text-center mb-5 max-w-4xl"
                    style={{ animation: 'fadeUp 0.7s 0.08s ease-out both' }}>
                    Analytics that{' '}
                    <span className="bg-clip-text text-transparent"
                        style={{ backgroundImage: 'linear-gradient(135deg,#6366f1,#a855f7,#ec4899)', backgroundSize: '200% 200%', animation: 'gradShift 4s ease infinite' }}>
                        respect
                    </span>
                    {' '}your users
                </h1>

                {/* ── Sub ── */}
                <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-lg text-center leading-relaxed mb-8"
                    style={{ animation: 'fadeUp 0.7s 0.16s ease-out both' }}>
                    Real-time analytics without cookies, consent banners, or data selling.
                    Self-hosted, free forever, and 100× faster than GA4 with DuckDB.
                </p>

                {/* ── Feature pills ── */}
                <div className="flex flex-wrap justify-center gap-2 mb-8" style={{ animation: 'fadeUp 0.7s 0.22s ease-out both' }}>
                    {[
                        { icon: Activity,         label: 'Realtime',       color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                        { icon: MousePointerClick, label: 'Heatmaps',      color: 'text-rose-600 dark:text-rose-400',     bg: 'bg-rose-50 dark:bg-rose-500/10' },
                        { icon: Layers,            label: 'Funnels',       color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
                        { icon: Gauge,             label: 'Web Vitals',    color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-500/10' },
                        { icon: LayoutDashboard,   label: 'Dashboards',    color: 'text-cyan-600 dark:text-cyan-400',     bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
                        { icon: Terminal,          label: 'SQL Editor',    color: 'text-slate-600 dark:text-slate-400',   bg: 'bg-slate-50 dark:bg-slate-500/10' },
                        { icon: Target,            label: 'Goals & A/B',  color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-50 dark:bg-green-500/10' },
                        { icon: GitBranch,         label: 'User Flow',    color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
                    ].map(({ icon: Icon, label, color, bg }) => (
                        <span key={label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border border-gray-200 dark:border-gray-800 ${bg} ${color}`}>
                            <Icon className="w-3 h-3" />{label}
                        </span>
                    ))}
                </div>

                {/* ── CTAs ── */}
                <div className="flex flex-col sm:flex-row items-center gap-3 mb-16"
                    style={{ animation: 'fadeUp 0.7s 0.28s ease-out both' }}>
                    <Link to="/register"
                        className="group inline-flex items-center gap-2 px-7 py-3.5 text-sm font-bold text-white rounded-xl
                            bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
                            shadow-xl shadow-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/40
                            transition-all duration-200 hover:-translate-y-0.5">
                        Start for free
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                    <a href="#showcase"
                        className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold rounded-xl
                            border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300
                            bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
                            backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5">
                        See demo
                    </a>
                </div>

                {/* ── Dashboard cluster ── */}
                <div className="relative w-full max-w-[1100px] mx-auto pb-0"
                    style={{ animation: 'fadeUp 0.9s 0.38s ease-out both' }}>

                    {/* ── Left column floating widgets ── */}
                    {/* Heatmap — left mid */}
                    <div className="absolute left-0 top-24 hidden lg:block w-52 z-20"
                        style={{ animation: 'float2 5.5s ease-in-out infinite' }}>
                        <HeatmapWidget />
                    </div>

                    {/* Funnel mini — left bottom */}
                    <div className="absolute -left-2 bottom-20 hidden lg:block w-52 z-20"
                        style={{ animation: 'float 4.5s 0.8s ease-in-out infinite' }}>
                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-black/10 p-4">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Conversion Funnel</p>
                            {[['Visit',100,'#6366f1'],['Signup',68,'#8b5cf6'],['Onboard',42,'#a855f7'],['Paid',19,'#ec4899']].map(([s,p,c]) => (
                                <div key={s} className="mb-1.5">
                                    <div className="flex justify-between text-[9px] text-gray-400 mb-0.5">
                                        <span className="font-medium text-gray-600 dark:text-gray-300">{s}</span>
                                        <span className="font-bold">{p}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width:`${p}%`, background:c }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Right column floating widgets ── */}
                    {/* Realtime — top right */}
                    <div className="absolute right-0 top-8 hidden lg:block z-20"
                        style={{ animation: 'float 4s ease-in-out infinite' }}>
                        <RealtimeWidget />
                    </div>

                    {/* Web Vitals — right mid */}
                    <div className="absolute right-0 top-64 hidden lg:block w-52 z-20"
                        style={{ animation: 'float2 5s 1.2s ease-in-out infinite' }}>
                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-black/10 p-4">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Web Vitals</p>
                            {[['LCP','1.8s','good'],['FID','82ms','good'],['CLS','0.04','good'],['INP','140ms','warn'],['TTFB','620ms','good']].map(([m,v,s]) => (
                                <div key={m} className="flex items-center gap-2 mb-1.5 last:mb-0">
                                    <span className="text-[9px] font-bold text-gray-400 w-6">{m}</span>
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${s==='good'?'bg-emerald-500':'bg-amber-400'}`} />
                                    <span className="text-[10px] font-bold text-gray-900 dark:text-white flex-1">{v}</span>
                                    <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${s==='good'?'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400':'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>{s}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Alert chip — right bottom */}
                    <div className="absolute right-0 bottom-28 hidden xl:block z-20"
                        style={{ animation: 'float 3.8s 0.5s ease-in-out infinite' }}>
                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-amber-200 dark:border-amber-500/30 shadow-xl shadow-amber-500/10 p-3.5 w-52">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Traffic Spike</span>
                            </div>
                            <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-snug">Visitors up <strong className="text-gray-900 dark:text-white">3.2×</strong> vs 7-day avg. Campaign or viral?</p>
                            <div className="flex items-center gap-2 mt-2">
                                <TrendingUp className="w-3 h-3 text-emerald-500" />
                                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">+220% change</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Main dashboard panel ── */}
                    <div className="relative mx-auto" style={{ maxWidth: '780px' }}>
                        <div className="rounded-t-2xl overflow-hidden shadow-2xl shadow-black/25 dark:shadow-black/70
                            border border-b-0 border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-900">
                            {/* Window chrome */}
                            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100/80 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700/60">
                                <span className="w-3 h-3 rounded-full bg-red-400 shrink-0" />
                                <span className="w-3 h-3 rounded-full bg-yellow-400 shrink-0" />
                                <span className="w-3 h-3 rounded-full bg-green-400 shrink-0" />
                                <div className="flex-1 mx-3 h-5 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center px-2.5">
                                    <span className="text-[10px] text-gray-400">app.insighttrack.io · Dashboard</span>
                                </div>
                                <div className="hidden sm:flex items-center gap-3 ml-2">
                                    <span className="text-[10px] text-gray-400">Last 30 days</span>
                                    <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Live
                                    </div>
                                </div>
                            </div>

                            {/* Dashboard body */}
                            <div className="p-4 bg-gray-50/80 dark:bg-[#0f1117]">

                                {/* KPI row */}
                                <div className="grid grid-cols-4 gap-2.5 mb-3">
                                    {[
                                        { l:'Visitors',   v:'12,847', t:'+12.3%', up:true,  c:'stroke-indigo-400',  dot:'bg-indigo-500' },
                                        { l:'Pageviews',  v:'34.2K',  t:'+8.7%',  up:true,  c:'stroke-emerald-400', dot:'bg-emerald-500' },
                                        { l:'Bounce',     v:'42.5%',  t:'↓ 2.1%', up:false, c:'stroke-rose-400',    dot:'bg-rose-500' },
                                        { l:'Avg Session',v:'3m 05s', t:'+5.4%',  up:true,  c:'stroke-amber-400',   dot:'bg-amber-500' },
                                    ].map((k,i) => (
                                        <div key={i} className="bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/60 p-2.5">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${k.dot}`} />
                                                <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">{k.l}</p>
                                            </div>
                                            <p className="text-sm font-extrabold text-gray-900 dark:text-white">{k.v}</p>
                                            <span className={`text-[9px] font-bold ${k.up?'text-emerald-500':'text-red-400'}`}>{k.t}</span>
                                            <svg className="mt-1 w-full h-4" viewBox="0 0 80 16" preserveAspectRatio="none">
                                                <path d={k.up?"M0,13 L15,10 L28,8 L40,10 L52,5 L64,3 L80,1":"M0,3 L15,5 L28,7 L40,4 L52,9 L64,11 L80,13"}
                                                    fill="none" className={k.c} strokeWidth="1.5" strokeLinecap="round" />
                                            </svg>
                                        </div>
                                    ))}
                                </div>

                                {/* Charts row */}
                                <div className="grid grid-cols-8 gap-2.5 mb-2.5">
                                    {/* Traffic — wide */}
                                    <div className="col-span-5 bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/60 p-3">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <p className="text-[10px] font-bold text-gray-700 dark:text-gray-200">Traffic over time</p>
                                            <div className="flex gap-2 text-[8px] text-gray-400">
                                                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-indigo-500 inline-block rounded" />Visitors</span>
                                                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-purple-400 inline-block rounded opacity-50" />Sessions</span>
                                            </div>
                                        </div>
                                        <svg className="w-full h-20" viewBox="0 0 300 68" preserveAspectRatio="none">
                                            <defs>
                                                <linearGradient id="hg2" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#6366f1" stopOpacity=".2" />
                                                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                                                </linearGradient>
                                            </defs>
                                            <path d="M0,55 C18,50 30,34 50,38 C70,42 88,22 108,26 C128,30 148,14 168,17 C188,20 208,8 228,11 C248,14 270,4 300,2"
                                                fill="none" stroke="#6366f1" strokeWidth="2" />
                                            <path d="M0,55 C18,50 30,34 50,38 C70,42 88,22 108,26 C128,30 148,14 168,17 C188,20 208,8 228,11 C248,14 270,4 300,2 L300,68 L0,68Z"
                                                fill="url(#hg2)" />
                                            <path d="M0,60 C18,57 30,46 50,49 C70,52 88,40 108,43 C128,46 148,36 168,38 C188,40 208,30 228,32 C248,34 270,25 300,22"
                                                fill="none" stroke="#a855f7" strokeWidth="1.5" opacity=".45" />
                                            {/* Tooltip dot */}
                                            <circle cx="228" cy="11" r="3" fill="#6366f1" />
                                            <rect x="200" y="0" width="40" height="16" rx="4" fill="#6366f1" />
                                            <text x="220" y="11" textAnchor="middle" fontSize="7" fill="white" fontWeight="700">2,847</text>
                                        </svg>
                                    </div>

                                    {/* Right col — sources + top pages */}
                                    <div className="col-span-3 flex flex-col gap-2.5">
                                        {/* Sources donut */}
                                        <div className="bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/60 p-2.5 flex items-center gap-2">
                                            <svg width="44" height="44" viewBox="0 0 44 44">
                                                <circle cx="22" cy="22" r="16" fill="none" stroke="#6366f1" strokeWidth="7" strokeDasharray="44 57" strokeDashoffset="0" />
                                                <circle cx="22" cy="22" r="16" fill="none" stroke="#10b981" strokeWidth="7" strokeDasharray="26 75" strokeDashoffset="-44" />
                                                <circle cx="22" cy="22" r="16" fill="none" stroke="#f97316" strokeWidth="7" strokeDasharray="18 83" strokeDashoffset="-70" />
                                                <circle cx="22" cy="22" r="16" fill="none" stroke="#a855f7" strokeWidth="7" strokeDasharray="13 88" strokeDashoffset="-88" />
                                                <text x="22" y="26" textAnchor="middle" fontSize="7" fontWeight="800" fill="#6366f1">44%</text>
                                            </svg>
                                            <div className="text-[8px] text-gray-500 dark:text-gray-400 space-y-0.5 flex-1">
                                                {[['#6366f1','Direct 44%'],['#10b981','Search 26%'],['#f97316','Social 18%'],['#a855f7','Email 12%']].map(([c,l]) => (
                                                    <div key={l} className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:c}} />{l}</div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Top pages mini */}
                                        <div className="bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/60 p-2.5 flex-1">
                                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Top Pages</p>
                                            {[{p:'/pricing',w:'88%',v:'4.2K'},{p:'/home',w:'72%',v:'3.5K'},{p:'/docs',w:'45%',v:'2.1K'},{p:'/blog',w:'28%',v:'1.3K'}].map(r => (
                                                <div key={r.p} className="flex items-center gap-1.5 mb-1 last:mb-0">
                                                    <span className="text-[8px] text-gray-400 w-12 truncate font-mono">{r.p}</span>
                                                    <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500/70 rounded-full" style={{width:r.w}} />
                                                    </div>
                                                    <span className="text-[8px] text-gray-500 w-6 text-right">{r.v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom row — countries + devices + SQL + alerts */}
                                <div className="grid grid-cols-4 gap-2.5">
                                    {/* Countries */}
                                    <div className="bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/60 p-2.5">
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Countries</p>
                                        {[['🇺🇸','US','38%'],['🇬🇧','UK','18%'],['🇩🇪','DE','12%'],['🇮🇳','IN','9%']].map(([f,c,p]) => (
                                            <div key={c} className="flex items-center gap-1 mb-1 last:mb-0">
                                                <span className="text-[10px]">{f}</span>
                                                <span className="text-[8px] text-gray-500 flex-1">{c}</span>
                                                <span className="text-[8px] font-bold text-gray-700 dark:text-gray-300">{p}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Devices */}
                                    <div className="bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/60 p-2.5">
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Devices</p>
                                        {[['Desktop','60%','#3b82f6'],['Mobile','30%','#14b8a6'],['Tablet','10%','#f97316']].map(([d,p,c]) => (
                                            <div key={d} className="mb-1 last:mb-0">
                                                <div className="flex justify-between text-[8px] mb-0.5">
                                                    <span className="text-gray-500">{d}</span>
                                                    <span className="font-bold text-gray-700 dark:text-gray-300">{p}</span>
                                                </div>
                                                <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full" style={{width:p, background:c}} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {/* SQL Editor mini */}
                                    <div className="bg-gray-900 dark:bg-black rounded-xl border border-gray-700 p-2.5">
                                        <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                            <Terminal className="w-2.5 h-2.5" /> SQL Editor
                                        </p>
                                        <div className="font-mono text-[7px] leading-relaxed">
                                            <span className="text-purple-400">SELECT </span><span className="text-blue-300">path</span><span className="text-gray-500">,</span><br/>
                                            <span className="text-blue-300">  COUNT</span><span className="text-gray-300">(</span><span className="text-orange-300">*</span><span className="text-gray-300">) AS views</span><br/>
                                            <span className="text-purple-400">FROM </span><span className="text-emerald-400">events</span><br/>
                                            <span className="text-purple-400">WHERE </span><span className="text-gray-300">type=</span><span className="text-yellow-300">'pageview'</span><br/>
                                            <span className="text-purple-400">GROUP BY </span><span className="text-blue-300">path</span><br/>
                                            <div className="mt-1 pt-1 border-t border-gray-700">
                                                <span className="text-emerald-400">✓ 127 rows · 42ms</span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* JS Errors mini */}
                                    <div className="bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/60 p-2.5">
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                            <AlertTriangle className="w-2.5 h-2.5 text-red-400" /> JS Errors
                                        </p>
                                        {[['TypeError','null read','47×'],['ReferenceError','not defined','12×'],['NetworkErr','fetch fail','8×']].map(([t,m,c]) => (
                                            <div key={t} className="mb-1 last:mb-0">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[7px] font-mono text-red-400 truncate flex-1">{t}</span>
                                                    <span className="text-[7px] font-bold text-gray-500 ml-1 shrink-0">{c}</span>
                                                </div>
                                                <p className="text-[7px] text-gray-400 truncate">{m}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Conversion rate chip — below main panel center */}
                    <div className="flex justify-center mt-0 relative z-10 hidden sm:flex">
                        <div className="bg-white dark:bg-gray-900 rounded-b-2xl border border-t-0 border-gray-200 dark:border-gray-700/80
                            shadow-xl shadow-black/10 px-5 py-2.5 flex items-center gap-6">
                            <KpiChip label="Conversion rate" value="3.8%" trend="+0.6% this week" up color="#6366f1" />
                            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
                            <KpiChip label="Revenue" value="$4,210" trend="+18% MoM" up color="#10b981" />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── STATS STRIP ────────────────────────────────────────────── */}
            <section className="py-14 px-4 sm:px-6 border-y border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40">
                <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
                    <StatCounter value={17}  suffix="+"  label="Analytics pages"    color="text-indigo-600 dark:text-indigo-400" />
                    <StatCounter value={2}   suffix=" KB" label="Tracking script"   color="text-emerald-600 dark:text-emerald-400" />
                    <StatCounter value={100} suffix="×"  label="Faster than GA4"   color="text-amber-600 dark:text-amber-400" />
                    <StatCounter value={0}   suffix=""   label="Cookies, ever"      color="text-rose-600 dark:text-rose-400" />
                </div>
            </section>

            {/* ── FEATURES ───────────────────────────────────────────────── */}
            <section id="features" className="py-24 px-4 sm:px-6 bg-[#fafafa] dark:bg-[#0a0a0f]">
                <div className="max-w-6xl mx-auto">
                    <Reveal className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/8 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-4">
                            Features
                        </div>
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
                            Everything in one place
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto text-sm sm:text-base">
                            17 analytics pages covering traffic, engagement, conversions, performance, and more.
                        </p>
                    </Reveal>

                    <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-start">
                        {/* Left — feature tab list */}
                        <div className="space-y-2">
                            {FEATURES.map((f, i) => (
                                <Reveal key={f.label} delay={i * 60}>
                                    <button onClick={() => setActiveFeature(i)}
                                        className={`w-full text-left p-4 rounded-2xl border transition-all duration-250 group
                                            ${activeFeature === i
                                                ? `bg-gradient-to-r ${f.bg} ${f.border} border shadow-sm`
                                                : 'border-transparent hover:border-gray-200 dark:hover:border-gray-800 hover:bg-white dark:hover:bg-gray-900/60'
                                            }`}>
                                        <div className="flex items-start gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${activeFeature === i ? 'bg-white/80 dark:bg-white/10' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                                <f.icon className="w-4 h-4" style={{ color: activeFeature === i ? f.accent : undefined }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: f.accent }}>{f.label}</span>
                                                </div>
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{f.title}</p>
                                                {activeFeature === i && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">{f.desc}</p>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0 hidden sm:block">
                                                <span className="text-xs font-bold text-gray-900 dark:text-white">{f.metric.value}</span>
                                                <p className="text-[9px] text-gray-400">{f.metric.label}</p>
                                            </div>
                                        </div>
                                    </button>
                                </Reveal>
                            ))}
                        </div>

                        {/* Right — animated preview panel */}
                        <Reveal type="left" className="sticky top-24">
                            <div className={`rounded-3xl border p-6 sm:p-8 bg-gradient-to-br ${feat.bg} ${feat.border} min-h-[380px] flex flex-col justify-between transition-all duration-500`}>
                                <div>
                                    <div className="w-12 h-12 rounded-2xl bg-white/80 dark:bg-white/10 flex items-center justify-center mb-5 shadow-sm">
                                        <feat.icon className="w-6 h-6" style={{ color: feat.accent }} />
                                    </div>
                                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3">{feat.title}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">{feat.desc}</p>
                                </div>

                                {/* Live preview per feature */}
                                {activeFeature === 0 && <RealtimeWidget />}
                                {activeFeature === 1 && (
                                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-2.5">
                                        {[['No cookies set', true],['No IP stored', true],['DNT respected', true],['GDPR compliant', true],['GPC signal honored', true]].map(([l,v]) => (
                                            <div key={l} className="flex items-center gap-2.5 text-sm">
                                                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                                                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <span className="text-gray-700 dark:text-gray-300 text-xs font-medium">{l}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {activeFeature === 2 && (
                                    <div className="space-y-3">
                                        {[['90-day KPI','< 50ms','indigo'],['30-day traffic','< 24ms','emerald'],['Top pages','< 39ms','amber']].map(([l,t,c]) => (
                                            <div key={l} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
                                                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{l}</span>
                                                <span className={`text-sm font-black text-${c}-600 dark:text-${c}-400`}>{t}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {activeFeature === 3 && <HeatmapWidget />}
                                {activeFeature === 4 && (
                                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                                        {[['Landing',100,28],['Signup',72,20],['Onboarding',51,14],['Paid',34,9]].map(([step, pct, n]) => (
                                            <div key={step} className="mb-2 last:mb-0">
                                                <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                                                    <span className="font-medium">{step}</span><span>{n} users · {pct}%</span>
                                                </div>
                                                <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                                                    <div className="h-full rounded-lg bg-violet-500/80 transition-all duration-700 flex items-center pl-2"
                                                        style={{ width: `${pct}%` }}>
                                                        <span className="text-[9px] text-white font-bold">{pct}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {activeFeature === 5 && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <MiniChart title="Traffic" type="area" />
                                        <MiniChart title="Sources" type="donut" />
                                        <MiniChart title="Conversions" type="bar" />
                                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex flex-col justify-center items-center">
                                            <p className="text-[10px] text-gray-400 mb-1">Export</p>
                                            <div className="flex gap-1">
                                                {['PNG','PDF','CSV','JSON'].map(f => (
                                                    <span key={f} className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">{f}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Indicator dots */}
                                <div className="flex gap-1.5 mt-4">
                                    {FEATURES.map((_, i) => (
                                        <button key={i} onClick={() => setActiveFeature(i)}
                                            className="h-1 rounded-full transition-all duration-300"
                                            style={{ width: activeFeature === i ? 20 : 6, background: activeFeature === i ? feat.accent : '#d1d5db' }} />
                                    ))}
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* ── SHOWCASE — Live UI panels ───────────────────────────────── */}
            <section id="showcase" className="py-24 px-4 sm:px-6 bg-white dark:bg-gray-900/30">
                <div className="max-w-6xl mx-auto">
                    <Reveal className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/8 text-[11px] font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-4">
                            Product showcase
                        </div>
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">Built different</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base max-w-md mx-auto">
                            Interactive previews of every major feature — not screenshots, live UI components.
                        </p>
                    </Reveal>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">

                        {/* 1 — KPI Cards */}
                        <Reveal delay={0} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm hover:shadow-lg transition-shadow">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">KPI Overview</p>
                            <div className="space-y-2.5">
                                {[
                                    { l:'Visitors', v:'12,847', t:'↑ 12.3%', c:'text-emerald-500', w:'90%', color:'#6366f1' },
                                    { l:'Pageviews', v:'34,201', t:'↑ 8.7%',  c:'text-emerald-500', w:'75%', color:'#10b981' },
                                    { l:'Bounce',   v:'42.5%',  t:'↓ 2.1%',  c:'text-red-400',     w:'42%', color:'#f97316' },
                                    { l:'Avg Time', v:'3m 05s', t:'↑ 5.4%',  c:'text-emerald-500', w:'55%', color:'#a855f7' },
                                ].map(k => (
                                    <div key={k.l} className="flex items-center gap-3">
                                        <span className="text-[10px] text-gray-400 w-14 shrink-0">{k.l}</span>
                                        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-1000" style={{ width: k.w, background: k.color }} />
                                        </div>
                                        <span className="text-xs font-bold text-gray-900 dark:text-white w-12 text-right shrink-0">{k.v}</span>
                                        <span className={`text-[10px] font-semibold w-14 text-right shrink-0 ${k.c}`}>{k.t}</span>
                                    </div>
                                ))}
                            </div>
                        </Reveal>

                        {/* 2 — Realtime (live) */}
                        <Reveal delay={60} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm hover:shadow-lg transition-shadow">
                            <RealtimeWidget />
                        </Reveal>

                        {/* 3 — Heatmap */}
                        <Reveal delay={120} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm hover:shadow-lg transition-shadow">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Heatmap</p>
                            <HeatmapWidget />
                        </Reveal>

                        {/* 4 — Funnel */}
                        <Reveal delay={180} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm hover:shadow-lg transition-shadow">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Conversion Funnel</p>
                            {[['Homepage', 2840, 100], ['Pricing', 1920, 68], ['Sign up', 870, 31], ['Activated', 420, 15]].map(([s,n,p]) => (
                                <div key={s} className="mb-2">
                                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{s}</span>
                                        <span>{n.toLocaleString()} · <strong className="text-gray-900 dark:text-white">{p}%</strong></span>
                                    </div>
                                    <div className="h-6 bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                                        <div className="h-full rounded-lg flex items-center pl-2 transition-all duration-700"
                                            style={{ width:`${p}%`, background:'linear-gradient(90deg,#6366f1,#a855f7)' }}>
                                            {p > 20 && <span className="text-[9px] text-white font-bold">{p}%</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </Reveal>

                        {/* 5 — Traffic chart */}
                        <Reveal delay={240} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm hover:shadow-lg transition-shadow">
                            <MiniChart title="Traffic · Last 30 days" type="area" />
                        </Reveal>

                        {/* 6 — Web Vitals */}
                        <Reveal delay={300} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm hover:shadow-lg transition-shadow">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Core Web Vitals</p>
                            <div className="space-y-2">
                                {[['LCP','1.8s','good','bg-emerald-500'],['FID','82ms','good','bg-emerald-500'],['CLS','0.04','good','bg-emerald-500'],['INP','140ms','needs-improvement','bg-amber-400'],['TTFB','620ms','good','bg-emerald-500']].map(([m,v,s,c]) => (
                                    <div key={m} className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-gray-500 w-8">{m}</span>
                                        <div className={`w-2 h-2 rounded-full ${c} shrink-0`} />
                                        <span className="text-xs font-bold text-gray-900 dark:text-white flex-1">{v}</span>
                                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${s === 'good' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>{s}</span>
                                    </div>
                                ))}
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* ── SETUP ──────────────────────────────────────────────────── */}
            <section id="how" className="py-24 px-4 sm:px-6 bg-[#fafafa] dark:bg-[#0a0a0f]">
                <div className="max-w-4xl mx-auto">
                    <Reveal className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/8 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide mb-4">
                            Setup
                        </div>
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">3 steps. 5 minutes.</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">No developer needed. Works on any platform.</p>
                    </Reveal>

                    <div className="relative">
                        {/* Connector */}
                        <div className="hidden sm:block absolute top-12 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-300/50 dark:via-indigo-700/30 to-transparent" />

                        <div className="grid sm:grid-cols-3 gap-8 sm:gap-6">
                            {HOW_STEPS.map((s, i) => (
                                <Reveal key={s.n} delay={i * 100}>
                                    <div className="relative text-center sm:text-left">
                                        <div className="text-7xl font-black text-gray-100 dark:text-gray-800 select-none mb-3">{s.n}</div>
                                        <div className="flex items-center gap-2 justify-center sm:justify-start mb-3">
                                            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center">
                                                <s.icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <h3 className="font-bold text-gray-900 dark:text-white text-sm">{s.title}</h3>
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{s.desc}</p>
                                        {i === 1 && (
                                            <div className="mt-4 bg-gray-900 rounded-xl p-3 text-left overflow-x-auto">
                                                <p className="text-[10px] text-gray-500 mb-1 font-mono">&lt;head&gt;</p>
                                                <p className="text-[11px] text-green-400 font-mono leading-relaxed">{'  '}<span className="text-blue-400">&lt;script</span> <span className="text-yellow-300">src</span>=<span className="text-emerald-300">"…/script"</span><span className="text-blue-400">&gt;&lt;/script&gt;</span></p>
                                                <p className="text-[10px] text-gray-500 font-mono">&lt;/head&gt;</p>
                                            </div>
                                        )}
                                    </div>
                                </Reveal>
                            ))}
                        </div>
                    </div>

                    {/* Platform chips */}
                    <Reveal className="mt-14 text-center">
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-4">Works with</p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {['WordPress','Next.js','Shopify','Webflow','Squarespace','React','Vue','Nuxt','SvelteKit','Plain HTML'].map(p => (
                                <span key={p} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
                                    {p}
                                </span>
                            ))}
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ── WHY ────────────────────────────────────────────────────── */}
            <section id="why" className="py-24 px-4 sm:px-6 bg-white dark:bg-gray-900/30">
                <div className="max-w-4xl mx-auto">
                    <Reveal className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/8 text-[11px] font-semibold text-rose-700 dark:text-rose-300 uppercase tracking-wide mb-4">
                            Comparison
                        </div>
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">Why switch?</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base max-w-md mx-auto">
                            GA4 sells your data. Plausible costs $9+/mo. InsightTrack is both free and private.
                        </p>
                    </Reveal>

                    <Reveal type="scale">
                        <div className="rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                            <div className="grid grid-cols-4 bg-gray-50 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800">
                                <div className="col-span-1 px-4 sm:px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Feature</div>
                                {[
                                    { name: 'InsightTrack', sub: 'Free forever', accent: '#6366f1', icon: BarChart3 },
                                    { name: 'GA4', sub: 'Sells your data', accent: '#9ca3af' },
                                    { name: 'Plausible', sub: '$9+/month', accent: '#9ca3af' },
                                ].map(({ name, sub, accent, icon: Icon }) => (
                                    <div key={name} className="px-2 sm:px-6 py-4 text-center">
                                        <div className="font-bold text-xs sm:text-sm" style={{ color: accent }}>{name}</div>
                                        <div className="text-[9px] text-gray-400 mt-0.5">{sub}</div>
                                    </div>
                                ))}
                            </div>

                            {WHY_TABLE.map(([feature, us, ga, pl], i) => (
                                <div key={feature} className={`grid grid-cols-4 border-b border-gray-100 dark:border-gray-800/60 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-900/20'}`}>
                                    <div className="col-span-1 px-4 sm:px-6 py-3.5 text-[11px] sm:text-sm text-gray-700 dark:text-gray-300 flex items-center font-medium">{feature}</div>
                                    {[us, ga, pl].map((v, j) => (
                                        <div key={j} className="px-2 sm:px-6 py-3.5 flex items-center justify-center">
                                            {v
                                                ? <Check className="w-4 h-4 stroke-[2.5]" style={{ color: j === 0 ? '#10b981' : '#9ca3af' }} />
                                                : <span className="text-gray-200 dark:text-gray-700 text-base font-light">—</span>}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ── CTA ────────────────────────────────────────────────────── */}
            <section className="py-24 px-4 sm:px-6 bg-[#fafafa] dark:bg-[#0a0a0f]">
                <Reveal type="scale" className="max-w-2xl mx-auto">
                    <div className="relative text-center overflow-hidden rounded-3xl p-10 sm:p-16"
                        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #4f46e5 100%)', backgroundSize: '200% 200%', animation: 'gradShift 6s ease infinite' }}>
                        {/* Mesh */}
                        <div className="absolute inset-0 pointer-events-none opacity-20"
                            style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                        <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
                        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-300/15 rounded-full blur-3xl" />

                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 border border-white/25 text-white/90 text-xs font-semibold mb-6">
                                <Star className="w-3.5 h-3.5 text-amber-300" />
                                Free forever · No credit card needed
                            </div>
                            <h2 className="text-3xl sm:text-5xl font-black text-white mb-4 leading-tight">
                                Own your analytics.
                            </h2>
                            <p className="text-white/70 mb-8 text-sm sm:text-base max-w-sm mx-auto">
                                5 minutes to set up. 17 pages of analytics. Your data, your server, your rules.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <Link to="/register"
                                    className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-bold text-indigo-700 bg-white hover:bg-gray-50 rounded-xl transition-all shadow-xl hover:-translate-y-0.5">
                                    Create free account
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                                <Link to="/login"
                                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold text-white/90 bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 transition-all hover:-translate-y-0.5">
                                    Sign in
                                </Link>
                            </div>

                            <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/55">
                                {['No cookies','Self-hosted','Open source','GDPR compliant','Free forever'].map(t => (
                                    <span key={t} className="flex items-center gap-1.5">
                                        <Check className="w-3 h-3 text-emerald-400" />{t}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* ── FOOTER ─────────────────────────────────────────────────── */}
            <footer className="border-t border-gray-200 dark:border-gray-800 py-10 px-4 sm:px-6 bg-white dark:bg-gray-900/20">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-sm">InsightTrack</span>
                        <span className="text-xs text-gray-400">· Open-source analytics</span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-1.5 text-sm text-gray-400">
                        {[['#features','Features'],['#showcase','Showcase'],['#how','Setup'],['#why','Why Us']].map(([h,l]) => (
                            <a key={l} href={h} className="hover:text-gray-900 dark:hover:text-white transition-colors">{l}</a>
                        ))}
                        <Link to="/login" className="hover:text-gray-900 dark:hover:text-white transition-colors">Sign in</Link>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-600">&copy; {new Date().getFullYear()} InsightTrack</p>
                </div>
            </footer>
        </div>
    );
}
