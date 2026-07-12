import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    BarChart3, Shield, Zap, Globe, Code, Database,
    ArrowRight, Users, Eye, Lock, Server, Check,
    MousePointerClick, LayoutDashboard, Activity, Target,
    Megaphone, Gauge, Sun, Moon, Menu, X, ChevronRight,
    TrendingUp, TrendingDown, Star, RefreshCw, Layers,
    Terminal, FileText, Map, GitBranch, AlertTriangle,
    Github, PlayCircle, Mail, ExternalLink, Box, Heart, ChevronDown, HelpCircle,
    Sparkles, Plug,
} from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';

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
@keyframes pulse-wave { 0%,100%{ transform:scaleY(0.35) } 50%{ transform:scaleY(1) } }
@keyframes chat-cycle { 0%{ opacity:0;transform:translateY(8px) } 6%{ opacity:1;transform:translateY(0) } 88%{ opacity:1;transform:translateY(0) } 100%{ opacity:0;transform:translateY(-4px) } }
@keyframes caret-blink { 0%,49%{ opacity:1 } 50%,100%{ opacity:0 } }
.pulse-bar { transform-origin:bottom; animation:pulse-wave 1.15s ease-in-out infinite; }
.chat-step { opacity:0; animation:chat-cycle 9s ease-in-out infinite; }
.typing-caret { animation:caret-blink 0.9s step-end infinite; }
@media (prefers-reduced-motion: reduce) { .pulse-bar,.chat-step,.typing-caret{ animation:none !important } .chat-step{ opacity:1 } }
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
                    {[42, 65, 38, 80, 55, 90, 48, 72, 85, 60, 95, 70].map((h, i) => (
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
                        {[['#6366f1', 'Direct 44%'], ['#10b981', 'Google 18%'], ['#f97316', 'Social 12%']].map(([c, l], i) => (
                            <g key={i} transform={`translate(0,${i * 16})`}>
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
        { path: '/home', active: 7 },
        { path: '/docs', active: 5 },
        { path: '/blog', active: 3 },
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
        { x: 85, y: 30, r: 8, c: 'rgba(99,102,241,0.45)' },
        { x: 15, y: 45, r: 7, c: 'rgba(99,102,241,0.4)' },
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
                        style={{
                            left: `${d.x}%`, top: `${d.y}%`, width: d.r * 2, height: d.r * 2,
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

// ─── Pulse (AI analyst) chat mock — loops a question → streamed answer → card ──
function Waveform({ size = 'sm' }) {
    const h = size === 'lg' ? [8, 16, 22, 16, 8] : [5, 9, 13, 9, 5];
    const w = size === 'lg' ? 'w-[3px]' : 'w-[3px]';
    return (
        <span className="inline-flex items-end gap-[3px]" aria-hidden="true">
            {h.map((height, i) => (
                <span key={i} className={`pulse-bar ${w} rounded-full bg-gradient-to-t from-indigo-500 via-violet-500 to-emerald-400`}
                    style={{ height, animationDelay: `${i * 0.12}s` }} />
            ))}
        </span>
    );
}

function PulseChat() {
    return (
        <div className="bg-white dark:bg-[#161822] rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl shadow-violet-500/20 overflow-hidden max-w-md w-full">
            {/* header */}
            <div className="flex items-center gap-2.5 px-4 h-[52px]">
                <Waveform />
                <span className="font-semibold text-sm text-gray-900 dark:text-white">Pulse</span>
                <span className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <span className="relative inline-flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 animate-ping" style={{ animationDuration: '1.4s' }} />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-[11px] font-semibold">Live</span>
                </span>
            </div>
            <div className="h-px bg-gradient-to-r from-indigo-500/70 via-violet-500/40 to-emerald-400/50" />

            {/* looping conversation */}
            <div className="p-4 space-y-3.5 min-h-[264px]">
                <div className="chat-step flex justify-end" style={{ animationDelay: '0s' }}>
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-indigo-500/10 dark:bg-indigo-500/20 text-gray-900 dark:text-white px-3.5 py-2 text-[13px]">
                        Top pages last 7 days?
                    </div>
                </div>
                <div className="chat-step text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed" style={{ animationDelay: '1.2s' }}>
                    Your top page was <strong className="text-gray-900 dark:text-white">/pricing</strong> with 6,046 views.
                    <span className="typing-caret inline-block w-1 h-3.5 -mb-0.5 ml-0.5 bg-indigo-500 rounded-sm align-middle" />
                </div>
                <div className="chat-step rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] overflow-hidden" style={{ animationDelay: '2.2s' }}>
                    <div className="p-3 space-y-1.5">
                        {[['/pricing', '6,046', '100%'], ['/docs', '5,979', '88%'], ['/about', '5,976', '82%']].map(([p, v, w]) => (
                            <div key={p} className="flex items-center gap-2">
                                <span className="text-[11px] w-14 text-gray-500 dark:text-gray-400 font-mono">{p}</span>
                                <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: w }} />
                                </div>
                                <span className="text-[11px] font-semibold text-gray-900 dark:text-white w-10 text-right">{v}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-200 dark:border-white/[0.08]">
                        <span className="inline-flex gap-1 text-gray-400">
                            <span className="w-6 h-5 grid place-items-center rounded bg-indigo-500/15 text-indigo-500 text-[9px]">▦</span>
                            <span className="w-6 h-5 grid place-items-center rounded text-[9px]">▮</span>
                            <span className="w-6 h-5 grid place-items-center rounded text-[9px]">◔</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-gray-200 dark:border-white/[0.12] text-[10px] text-gray-500 dark:text-gray-400">⤓ CSV</span>
                        <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-semibold">Open pages →</span>
                    </div>
                </div>
            </div>

            {/* composer */}
            <div className="px-3 pb-3">
                <div className="flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] px-3 py-2">
                    <span className="text-[13px] text-gray-400 dark:text-gray-500 flex-1">Ask Pulse about your analytics…</span>
                    <span className="w-7 h-7 grid place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs">↑</span>
                </div>
            </div>
        </div>
    );
}

// ─── Brand logos (inline, monochrome — inherit currentColor) ──────────────────
const Logo = {
    anthropic: (p) => (
        <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
            <path d="M16.8 3h-3.2l5.7 18h3.2L16.8 3zM7.2 3L1.5 21h3.26l1.17-3.78h5.96L13.06 21h3.26L10.62 3H7.2zm-.13 11.3l1.94-6.28 1.94 6.28H7.07z" />
        </svg>
    ),
    openai: (p) => (
        <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
            <path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 4.98 4.18a5.98 5.98 0 0 0-3.99 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A5.98 5.98 0 0 0 13.26 24a6.06 6.06 0 0 0 5.77-4.21 5.99 5.99 0 0 0 3.99-2.9 6.06 6.06 0 0 0-.74-7.07zM13.26 22.43a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.79.79 0 0 0 .39-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.49 4.5zM3.6 18.3a4.47 4.47 0 0 1-.54-3.01l.14.09 4.78 2.76a.77.77 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06L9.74 19.95a4.5 4.5 0 0 1-6.14-1.65zM2.34 7.9a4.48 4.48 0 0 1 2.34-1.97V11.6a.77.77 0 0 0 .39.68l5.81 3.35-2.02 1.17a.07.07 0 0 1-.07 0l-4.83-2.79A4.5 4.5 0 0 1 2.34 7.9zm16.6 3.86l-5.84-3.39L15.12 7.2a.07.07 0 0 1 .07 0l4.83 2.78a4.49 4.49 0 0 1-.68 8.1v-5.66a.79.79 0 0 0-.4-.67zm2.01-3.02l-.14-.09-4.77-2.78a.78.78 0 0 0-.79 0L9.42 9.24V6.9a.07.07 0 0 1 .03-.06l4.83-2.79a4.49 4.49 0 0 1 6.67 4.65zM8.32 12.87L6.3 11.7a.08.08 0 0 1-.04-.06V6.08a4.49 4.49 0 0 1 7.37-3.45l-.14.08L8.71 5.47a.79.79 0 0 0-.39.68v6.72zm1.1-2.37L12 8.99l2.6 1.5v3l-2.6 1.5-2.6-1.5v-3z" />
        </svg>
    ),
    gemini: (p) => (
        <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
            <path d="M12 0c.4 6.3 5.7 11.6 12 12-6.3.4-11.6 5.7-12 12-.4-6.3-5.7-11.6-12-12C6.3 11.6 11.6 6.3 12 0z" />
        </svg>
    ),
};

// ─── Feature showcase interactive card ───────────────────────────────────────

const FEATURES = [
    {
        icon: Sparkles,
        accent: '#8b5cf6',
        bg: 'from-violet-500/10 to-emerald-500/5',
        border: 'border-violet-200 dark:border-violet-500/20',
        label: 'Pulse AI · MCP',
        title: 'Just ask — Pulse answers',
        desc: 'A built-in AI analyst. Ask in plain English and get real charts, tables, and CSVs. The same read-only tools work from Claude Desktop & Cursor over MCP.',
        metric: { value: '17', label: 'AI tools', up: true },
    },
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
    ['Built-in AI analyst (ask in plain English)', true, false, false],
    ['MCP — query from Claude Desktop / Cursor', true, false, false],
    ['No cookies / no consent banner', true, false, false],
    ['Self-hosted — you own all data', true, false, false],
    ['Free forever', true, false, false],
    ['Script under 2 KB', true, false, false],
    ['Heatmaps included', true, false, true],
    ['JS error tracking', true, false, true],
    ['SQL editor built-in', true, false, false],
    ['Custom drag-drop dashboards', true, false, false],
    ['Real-time dashboard', true, true, true],
    ['Core Web Vitals monitoring', true, false, true],
];

const HOW_STEPS = [
    { n: '01', icon: Users, title: 'Create an account', desc: 'Sign up, add your website domain. 30 seconds.' },
    { n: '02', icon: Code, title: 'Add one script tag', desc: 'Paste a single <script> into your site\'s <head>. Under 2 KB.' },
    { n: '03', icon: BarChart3, title: 'See everything live', desc: '17 analytics pages ready instantly — no configuration.' },
];

// Self-hosting / deploy-your-own-instance tabs. Each tab shows the exact
// commands to stand up the full stack from the public repo. The two manual
// tabs map to the two supported app layouts: apps/ (stable) and appsv2/
// (hot/cold DuckDB architecture).
const DEPLOY_TABS = [
    {
        id: 'docker', label: 'Docker (fastest)', icon: Box,
        note: 'One command brings up Postgres, the API, the dashboard and a demo site.',
        code: `git clone https://github.com/NishikantaRay/InsightTrack.git
cd InsightTrack

# copy env defaults, then bring the whole stack up
cp .env.example .env
docker-compose up --build -d

# dashboard → http://localhost:4173
# API       → http://localhost:3001`,
    },
    {
        id: 'apps', label: 'Manual · apps/', icon: Server,
        note: 'Run the stable apps/ layout directly with Node 20 + your own Postgres.',
        code: `git clone https://github.com/NishikantaRay/InsightTrack.git
cd InsightTrack

# 1) Backend (Express + Postgres + DuckDB)
cd apps/analytics-api
cp .env.example .env        # set DATABASE_URL, JWT_SECRET, APP_BASE_URL
npm install && npm run migrate && npm start   # :3001

# 2) Frontend (React + Vite)
cd ../dashboard-web
npm install && npm run build && npm run preview  # :4173`,
    },
    {
        id: 'appsv2', label: 'Manual · appsv2/', icon: Database,
        note: 'The hot/cold DuckDB build — hot tier in RAM, cold Parquet on S3/R2.',
        code: `git clone https://github.com/NishikantaRay/InsightTrack.git
cd InsightTrack

# 1) Backend (hot/cold DuckDB + optional S3/R2 cold storage)
cd appsv2/analytics-api
cp .env.example .env        # add S3_* / R2_* vars to enable cold storage
npm install && npm run migrate && npm start   # :3001

# 2) Frontend
cd ../dashboard-web
npm install && npm run build && npm run preview  # :4173`,
    },
];

// FAQ — concise, factual answers. Rendered on the page AND emitted as FAQPage
// JSON-LD so answer engines (Google, ChatGPT, Perplexity, Gemini) can quote them.
const FAQS = [
    {
        q: 'What is InsightsTrack?',
        a: 'InsightsTrack is an open-source, self-hosted web analytics platform — a privacy-friendly alternative to Google Analytics. You run it on your own server and track visitors, pageviews, conversions, heatmaps, and Core Web Vitals without cookies or third-party data sharing.',
    },
    {
        q: 'How is InsightsTrack different from Google Analytics?',
        a: 'InsightsTrack stores all data on your own infrastructure, sets no cookies, needs no consent banner, and never sells or shares data. It is open-source and free, where Google Analytics is closed-source and monetises your visitors’ data.',
    },
    {
        q: 'Is InsightsTrack privacy-friendly?',
        a: 'Yes. It is cookieless by design, stores no IP addresses, does no fingerprinting, generates anonymous first-party visitor IDs, and honors Do Not Track (DNT) and Global Privacy Control (GPC). This makes it GDPR-compliant without a cookie banner in most jurisdictions.',
    },
    {
        q: 'How do I install InsightsTrack?',
        a: 'Self-host the stack with one Docker command (git clone, then docker-compose up), create a site in Settings, and paste a single ~2 KB <script> tag into your website’s <head>. Tracking starts immediately — setup takes under 15 minutes.',
    },
    {
        q: 'What is Pulse, the AI analyst?',
        a: 'Pulse is InsightsTrack’s built-in AI analyst. Ask questions about your traffic in plain English — "top pages last 7 days", "where is my traffic from?", "how is my funnel doing?" — and get real charts, tables, and CSV exports. It is read-only: Pulse calls 17 analytics tools to fetch live numbers and can never change or delete data. Bring your own Anthropic, OpenAI, or Google Gemini key, stored encrypted on your own server.',
    },
    {
        q: 'Can I use InsightsTrack from Claude Desktop or Cursor (MCP)?',
        a: 'Yes. InsightsTrack exposes its analytics tools over the Model Context Protocol (MCP), so any MCP client — Claude Desktop, Cursor, Zed, or your own agent — can query your traffic directly. Connect with a remote HTTP URL (nothing to install) or a local bridge, then ask your assistant about your analytics and it fetches live data. All tools are read-only and scoped to your account.',
    },
    {
        q: 'Does InsightsTrack work with React and Next.js?',
        a: 'Yes. The lightweight script tag works on any website or framework — React, Next.js, Vue, Nuxt, SvelteKit, WordPress, Shopify, or plain HTML. It tracks SPA route changes automatically.',
    },
    {
        q: 'Can I track custom events?',
        a: 'Yes. After the script loads, call window.trackEvent(\'name\', { …props }) to record custom events such as signups, purchases, or clicks alongside automatic pageviews, sessions, scroll depth, Web Vitals, and heatmap data.',
    },
    {
        q: 'How fast is InsightsTrack?',
        a: 'The tracking script is ~2 KB and loads asynchronously, so it does not slow your site. On the backend, a DuckDB columnar engine answers 90-day analytics queries in under 100 ms even across millions of events.',
    },
    {
        q: 'How does real-time tracking work?',
        a: 'Events are written to PostgreSQL on arrival and streamed into DuckDB by a background sync. The Realtime page shows the live visitor count, active pages, and a world map of current visitors, refreshing every few seconds.',
    },
    {
        q: 'Is InsightsTrack really free and open source?',
        a: 'Yes — it is MIT licensed and free forever, with no seat limits. You can read, modify, and self-host the full source code from GitHub.',
    },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Landing() {
    // Use the app-wide theme store as the single source of truth. App.jsx
    // applies the `dark` class on a wrapper <div> that Tailwind's
    // darkMode:'class' resolves against, so toggling here flips the same class
    // — no separate <html> mechanism (which previously fought the wrapper div).
    const theme = useThemeStore((s) => s.theme);
    const toggleTheme = useThemeStore((s) => s.toggleTheme);
    const dark = theme === 'dark';

    const [menuOpen, setMenuOpen] = useState(false);
    const [activeFeature, setActiveFeature] = useState(0);
    const [scrolled, setScrolled] = useState(false);
    const [deployTab, setDeployTab] = useState('docker');
    const [openFaq, setOpenFaq] = useState(0);
    const mouse = useMouseParallax(0.018);

    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 24);
        window.addEventListener('scroll', fn, { passive: true });
        return () => window.removeEventListener('scroll', fn);
    }, []);

    // ── Desktop layout on mobile ──────────────────────────────────────────────
    // The landing page is dense and built for wide screens. On phones we widen
    // the viewport meta to a desktop width so the browser renders the FULL
    // desktop layout and then auto-scales it to fit the device — visitors see
    // everything compactly with far less scrolling, instead of an endless
    // single column. Restored to responsive on unmount so the app's internal
    // pages stay mobile-friendly.
    useEffect(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        if (!meta) return;
        const original = meta.getAttribute('content');
        const apply = () => {
            if (window.innerWidth < 768) {
                meta.setAttribute('content', 'width=1280, initial-scale=' + (window.innerWidth / 1280));
            } else {
                meta.setAttribute('content', original || 'width=device-width, initial-scale=1');
            }
        };
        apply();
        window.addEventListener('resize', apply, { passive: true });
        return () => {
            window.removeEventListener('resize', apply);
            meta.setAttribute('content', original || 'width=device-width, initial-scale=1');
        };
    }, []);

    // Auto-cycle features
    useEffect(() => {
        const t = setInterval(() => setActiveFeature(i => (i + 1) % FEATURES.length), 3800);
        return () => clearInterval(t);
    }, []);

    const feat = FEATURES[activeFeature];

    return (
        <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] text-gray-900 dark:text-white overflow-x-hidden">

            {/* ── Open Source Top Banner ──────────────────────────────── */}
            <div className="bg-indigo-600 dark:bg-indigo-700 text-white text-center py-2.5 px-4 text-xs sm:text-sm font-medium">
                <span className="flex items-center justify-center gap-2 flex-wrap">
                    <Github className="w-3.5 h-3.5 shrink-0" />
                    InsightsTrack is <strong>100% open source</strong> — self-host on your own server, free forever.
                    <a href="https://github.com/NishikantaRay/InsightTrack" target="_blank" rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:no-underline inline-flex items-center gap-1">
                        View on GitHub <ExternalLink className="w-3 h-3" />
                    </a>
                    <span className="hidden sm:inline opacity-60">·</span>
                    <span className="hidden sm:inline opacity-80">⭐ Star us if you find it useful</span>
                </span>
            </div>

            {/* ── NAV ────────────────────────────────────────────────────── */}
            <nav className={`sticky top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled
                ? 'bg-white/90 dark:bg-[#0a0a0f]/90 backdrop-blur-2xl border-b border-gray-200/80 dark:border-gray-800/80 shadow-sm'
                : 'bg-white/80 dark:bg-[#0a0a0f]/80 backdrop-blur-xl'}`}>
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <BarChart3 className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-[15px] tracking-tight">InsightsTrack</span>
                    </div>

                    <div className="hidden md:flex items-center gap-7">
                        {[['#features', 'Features'], ['#showcase', 'Showcase'], ['#pulse', 'Pulse AI'], ['#how', 'Setup'], ['#deploy', 'Deploy'], ['#faq', 'FAQ']].map(([h, l]) => (
                            <a key={l} href={h} className="text-[13px] font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">{l}</a>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={toggleTheme} aria-label="Toggle theme" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>
                        <a href="mailto:nishikantaray1@gmail.com?subject=InsightsTrack%20Demo%20Request&body=Hi%20Nishikanta%2C%0A%0AI%27d%20love%20to%20see%20a%20demo%20of%20InsightsTrack.%0A%0ACompany%3A%20%0AUse%20case%3A%20%0A%0AThanks!"
                            className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-all">
                            <Mail className="w-3.5 h-3.5" /> Book a Demo
                        </a>
                        <Link to="/register?redirect=/demo" className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white rounded-xl
                            bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
                            shadow-md shadow-indigo-500/25 transition-all hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-px">
                            Try Demo <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={() => setMenuOpen(v => !v)} className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
                {menuOpen && (
                    <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0a0a0f] px-4 py-4 space-y-1">
                        {[['#features', 'Features'], ['#showcase', 'Showcase'], ['#pulse', 'Pulse AI'], ['#how', 'Setup'], ['#deploy', 'Deploy'], ['#faq', 'FAQ']].map(([h, l]) => (
                            <a key={l} href={h} onClick={() => setMenuOpen(false)}
                                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                <ChevronRight className="w-3.5 h-3.5 text-indigo-500" />{l}
                            </a>
                        ))}
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-2">
                            <a href="mailto:nishikantaray1@gmail.com?subject=InsightsTrack%20Demo%20Request" className="py-2.5 text-sm font-medium text-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Book a Demo</a>
                            <Link to="/register?redirect=/demo" className="py-2.5 text-sm font-semibold text-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">Try Demo</Link>
                        </div>
                    </div>
                )}
            </nav>

            {/* ── Demo Notice Banner ──────────────────────────────────── */}
            <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/50 px-4 py-3">
                <div className="max-w-6xl mx-auto flex items-start sm:items-center gap-3 text-sm text-amber-800 dark:text-amber-200 flex-wrap">
                    <PlayCircle className="w-4 h-4 mt-0.5 sm:mt-0 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="flex-1 leading-snug">
                        <strong>This is a live demo instance.</strong>{' '}
                        The data you see is pre-seeded sample data, not real traffic from your website.
                    </p>
                    <div className="flex items-center gap-3 flex-wrap text-xs font-semibold">
                        <Link to="/login?redirect=/demo"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors whitespace-nowrap">
                            <Activity className="w-3.5 h-3.5" /> Open live dashboard
                        </Link>
                        <Link to="/register"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/60 transition-colors whitespace-nowrap">
                            <Users className="w-3.5 h-3.5" /> Try with a new account
                        </Link>
                        <Link to="/register"
                            className="underline underline-offset-2 text-amber-700 dark:text-amber-400 hover:no-underline whitespace-nowrap">
                            Set up your own instance →
                        </Link>
                    </div>
                </div>
            </div>

            {/* ── HERO ───────────────────────────────────────────────────── */}
            <section className="relative flex flex-col items-center pt-14 sm:pt-20 pb-0 px-4 sm:px-6 overflow-hidden">

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
                    New · Ask your data with Pulse AI &amp; MCP
                </div>

                {/* ── Headline ── */}
                <h1 className="text-[42px] sm:text-6xl lg:text-[76px] font-black tracking-[-0.02em] leading-[1.04] text-center mb-5 max-w-4xl"
                    style={{ animation: 'fadeUp 0.7s 0.08s ease-out both' }}>
                    Know your{' '}
                    <span className="bg-clip-text text-transparent"
                        style={{ backgroundImage: 'linear-gradient(135deg,#6366f1,#a855f7,#ec4899)', backgroundSize: '200% 200%', animation: 'gradShift 4s ease infinite' }}>
                        visitors
                    </span>
                    , not their identities
                </h1>

                {/* ── Sub ── */}
                <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-lg text-center leading-relaxed mb-8"
                    style={{ animation: 'fadeUp 0.7s 0.16s ease-out both' }}>
                    Cookieless, real-time analytics you can just <span className="font-semibold text-gray-700 dark:text-gray-200">ask</span> —
                    with <span className="font-semibold text-gray-700 dark:text-gray-200">Pulse AI</span> in the dashboard and over MCP.
                    Self-hosted, open source, and free forever.
                </p>

                {/* ── Feature pills ── */}
                <div className="flex flex-wrap justify-center gap-2 mb-8" style={{ animation: 'fadeUp 0.7s 0.22s ease-out both' }}>
                    {[
                        { icon: Sparkles, label: 'Pulse AI', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
                        { icon: Plug, label: 'MCP', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
                        { icon: Activity, label: 'Realtime', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                        { icon: MousePointerClick, label: 'Heatmaps', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10' },
                        { icon: Layers, label: 'Funnels', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
                        { icon: Gauge, label: 'Web Vitals', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
                        { icon: LayoutDashboard, label: 'Dashboards', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
                        { icon: Terminal, label: 'SQL Editor', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-500/10' },
                        { icon: Target, label: 'Goals & A/B', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10' },
                        { icon: GitBranch, label: 'User Flow', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
                    ].map(({ icon: Icon, label, color, bg }) => (
                        <span key={label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border border-gray-200 dark:border-gray-800 ${bg} ${color}`}>
                            <Icon className="w-3 h-3" />{label}
                        </span>
                    ))}
                </div>

                {/* ── CTAs ── */}
                <div className="flex flex-col sm:flex-row items-center gap-3 mb-16"
                    style={{ animation: 'fadeUp 0.7s 0.28s ease-out both' }}>
                    <Link to="/register?redirect=/demo"
                        className="group inline-flex items-center gap-2 px-7 py-3.5 text-sm font-bold text-white rounded-xl
                            bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
                            shadow-xl shadow-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/40
                            transition-all duration-200 hover:-translate-y-0.5">
                        <PlayCircle className="w-4 h-4" />
                        Try Live Demo Free
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                    <a href="mailto:nishikantaray1@gmail.com?subject=InsightsTrack%20Demo%20Request&body=Hi%20Nishikanta%2C%0A%0AI%27d%20love%20to%20book%20a%20demo%20of%20InsightsTrack.%0A%0ACompany%3A%20%0AUse%20case%3A%20%0A%0AThanks!"
                        className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold rounded-xl
                            border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300
                            bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
                            backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5">
                        <Mail className="w-4 h-4" />
                        Book a Personal Demo
                    </a>
                    <a href="https://github.com/sponsors/NishikantaRay" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold rounded-xl
                            border border-pink-200 dark:border-pink-500/30 text-pink-600 dark:text-pink-400
                            bg-pink-50/60 dark:bg-pink-500/10 hover:bg-pink-100 dark:hover:bg-pink-500/20
                            transition-all duration-200 hover:-translate-y-0.5">
                        <Heart className="w-4 h-4" />
                        Sponsor
                    </a>
                </div>

                {/* ── Product Hunt badge ── */}
                <div className="flex justify-center mb-12" style={{ animation: 'fadeUp 0.7s 0.34s ease-out both' }}>
                    <a href="https://www.producthunt.com/products/insightstrack?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-insightstrack"
                        target="_blank" rel="noopener noreferrer">
                        <img
                            src={`https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1183103&theme=${dark ? 'dark' : 'light'}`}
                            alt="InsightsTrack - Open-source, privacy-first analytics with a live demo | Product Hunt"
                            width="250" height="54"
                            style={{ width: 250, height: 54 }}
                        />
                    </a>
                </div>

                {/* ── Dashboard cluster ──
                    Floating side-widgets show on lg+; on phones the centered
                    main dashboard panel (max-w-responsive) carries the hero. */}
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
                            {[['Visit', 100, '#6366f1'], ['Signup', 68, '#8b5cf6'], ['Onboard', 42, '#a855f7'], ['Paid', 19, '#ec4899']].map(([s, p, c]) => (
                                <div key={s} className="mb-1.5">
                                    <div className="flex justify-between text-[9px] text-gray-400 mb-0.5">
                                        <span className="font-medium text-gray-600 dark:text-gray-300">{s}</span>
                                        <span className="font-bold">{p}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${p}%`, background: c }} />
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
                            {[['LCP', '1.8s', 'good'], ['FID', '82ms', 'good'], ['CLS', '0.04', 'good'], ['INP', '140ms', 'warn'], ['TTFB', '620ms', 'good']].map(([m, v, s]) => (
                                <div key={m} className="flex items-center gap-2 mb-1.5 last:mb-0">
                                    <span className="text-[9px] font-bold text-gray-400 w-6">{m}</span>
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${s === 'good' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                    <span className="text-[10px] font-bold text-gray-900 dark:text-white flex-1">{v}</span>
                                    <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${s === 'good' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>{s}</span>
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
                                    <span className="text-[10px] text-gray-400">insightstrack.dev · Dashboard</span>
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
                                        { l: 'Visitors', v: '12,847', t: '+12.3%', up: true, c: 'stroke-indigo-400', dot: 'bg-indigo-500' },
                                        { l: 'Pageviews', v: '34.2K', t: '+8.7%', up: true, c: 'stroke-emerald-400', dot: 'bg-emerald-500' },
                                        { l: 'Bounce', v: '42.5%', t: '↓ 2.1%', up: false, c: 'stroke-rose-400', dot: 'bg-rose-500' },
                                        { l: 'Avg Session', v: '3m 05s', t: '+5.4%', up: true, c: 'stroke-amber-400', dot: 'bg-amber-500' },
                                    ].map((k, i) => (
                                        <div key={i} className="bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/60 p-2.5">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${k.dot}`} />
                                                <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">{k.l}</p>
                                            </div>
                                            <p className="text-sm font-extrabold text-gray-900 dark:text-white">{k.v}</p>
                                            <span className={`text-[9px] font-bold ${k.up ? 'text-emerald-500' : 'text-red-400'}`}>{k.t}</span>
                                            <svg className="mt-1 w-full h-4" viewBox="0 0 80 16" preserveAspectRatio="none">
                                                <path d={k.up ? "M0,13 L15,10 L28,8 L40,10 L52,5 L64,3 L80,1" : "M0,3 L15,5 L28,7 L40,4 L52,9 L64,11 L80,13"}
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
                                                {[['#6366f1', 'Direct 44%'], ['#10b981', 'Search 26%'], ['#f97316', 'Social 18%'], ['#a855f7', 'Email 12%']].map(([c, l]) => (
                                                    <div key={l} className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />{l}</div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Top pages mini */}
                                        <div className="bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/60 p-2.5 flex-1">
                                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Top Pages</p>
                                            {[{ p: '/pricing', w: '88%', v: '4.2K' }, { p: '/home', w: '72%', v: '3.5K' }, { p: '/docs', w: '45%', v: '2.1K' }, { p: '/blog', w: '28%', v: '1.3K' }].map(r => (
                                                <div key={r.p} className="flex items-center gap-1.5 mb-1 last:mb-0">
                                                    <span className="text-[8px] text-gray-400 w-12 truncate font-mono">{r.p}</span>
                                                    <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500/70 rounded-full" style={{ width: r.w }} />
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
                                        {[['🇺🇸', 'US', '38%'], ['🇬🇧', 'UK', '18%'], ['🇩🇪', 'DE', '12%'], ['🇮🇳', 'IN', '9%']].map(([f, c, p]) => (
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
                                        {[['Desktop', '60%', '#3b82f6'], ['Mobile', '30%', '#14b8a6'], ['Tablet', '10%', '#f97316']].map(([d, p, c]) => (
                                            <div key={d} className="mb-1 last:mb-0">
                                                <div className="flex justify-between text-[8px] mb-0.5">
                                                    <span className="text-gray-500">{d}</span>
                                                    <span className="font-bold text-gray-700 dark:text-gray-300">{p}</span>
                                                </div>
                                                <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: p, background: c }} />
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
                                            <span className="text-purple-400">SELECT </span><span className="text-blue-300">path</span><span className="text-gray-500">,</span><br />
                                            <span className="text-blue-300">  COUNT</span><span className="text-gray-300">(</span><span className="text-orange-300">*</span><span className="text-gray-300">) AS views</span><br />
                                            <span className="text-purple-400">FROM </span><span className="text-emerald-400">events</span><br />
                                            <span className="text-purple-400">WHERE </span><span className="text-gray-300">type=</span><span className="text-yellow-300">'pageview'</span><br />
                                            <span className="text-purple-400">GROUP BY </span><span className="text-blue-300">path</span><br />
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
                                        {[['TypeError', 'null read', '47×'], ['ReferenceError', 'not defined', '12×'], ['NetworkErr', 'fetch fail', '8×']].map(([t, m, c]) => (
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
                    <StatCounter value={17} suffix="+" label="Analytics pages" color="text-indigo-600 dark:text-indigo-400" />
                    <StatCounter value={2} suffix=" KB" label="Tracking script" color="text-emerald-600 dark:text-emerald-400" />
                    <StatCounter value={100} suffix="×" label="Faster than GA4" color="text-amber-600 dark:text-amber-400" />
                    <StatCounter value={0} suffix="" label="Cookies, ever" color="text-rose-600 dark:text-rose-400" />
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
                                        {[['No cookies set', true], ['No IP stored', true], ['DNT respected', true], ['GDPR compliant', true], ['GPC signal honored', true]].map(([l, v]) => (
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
                                        {[['90-day KPI', '< 50ms', 'indigo'], ['30-day traffic', '< 24ms', 'emerald'], ['Top pages', '< 39ms', 'amber']].map(([l, t, c]) => (
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
                                        {[['Landing', 100, 28], ['Signup', 72, 20], ['Onboarding', 51, 14], ['Paid', 34, 9]].map(([step, pct, n]) => (
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
                                                {['PNG', 'PDF', 'CSV', 'JSON'].map(f => (
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

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">

                        {/* 1 — KPI Cards */}
                        <Reveal delay={0} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm hover:shadow-lg transition-shadow">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">KPI Overview</p>
                            <div className="space-y-2.5">
                                {[
                                    { l: 'Visitors', v: '12,847', t: '↑ 12.3%', c: 'text-emerald-500', w: '90%', color: '#6366f1' },
                                    { l: 'Pageviews', v: '34,201', t: '↑ 8.7%', c: 'text-emerald-500', w: '75%', color: '#10b981' },
                                    { l: 'Bounce', v: '42.5%', t: '↓ 2.1%', c: 'text-red-400', w: '42%', color: '#f97316' },
                                    { l: 'Avg Time', v: '3m 05s', t: '↑ 5.4%', c: 'text-emerald-500', w: '55%', color: '#a855f7' },
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
                            {[['Homepage', 2840, 100], ['Pricing', 1920, 68], ['Sign up', 870, 31], ['Activated', 420, 15]].map(([s, n, p]) => (
                                <div key={s} className="mb-2">
                                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{s}</span>
                                        <span>{n.toLocaleString()} · <strong className="text-gray-900 dark:text-white">{p}%</strong></span>
                                    </div>
                                    <div className="h-6 bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                                        <div className="h-full rounded-lg flex items-center pl-2 transition-all duration-700"
                                            style={{ width: `${p}%`, background: 'linear-gradient(90deg,#6366f1,#a855f7)' }}>
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
                                {[['LCP', '1.8s', 'good', 'bg-emerald-500'], ['FID', '82ms', 'good', 'bg-emerald-500'], ['CLS', '0.04', 'good', 'bg-emerald-500'], ['INP', '140ms', 'needs-improvement', 'bg-amber-400'], ['TTFB', '620ms', 'good', 'bg-emerald-500']].map(([m, v, s, c]) => (
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

            {/* ── PULSE (AI analyst + MCP) ────────────────────────────────── */}
            <section id="pulse" className="py-24 px-4 sm:px-6 relative overflow-hidden bg-white dark:bg-[#0d0e14]">
                <div className="absolute inset-0 -z-10 pointer-events-none">
                    <div className="absolute top-1/4 right-0 w-[600px] h-[500px] bg-gradient-to-bl from-violet-500/15 via-emerald-500/8 to-transparent rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-1/4 w-[500px] h-[400px] bg-gradient-to-tr from-indigo-500/10 to-transparent rounded-full blur-3xl" />
                </div>
                <div className="max-w-6xl mx-auto">
                    <Reveal className="text-center mb-14">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/8 mb-4">
                            <Waveform />
                            <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">New · Pulse AI</span>
                        </div>
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">Skip the dashboards. Just ask.</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
                            <span className="font-semibold text-gray-900 dark:text-white">Pulse</span> is your built-in AI analyst — ask a
                            question in plain English and get a real answer: live charts, tables, and CSVs, every number backed by your own data.
                        </p>
                    </Reveal>

                    <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
                        {/* animated Pulse panel */}
                        <Reveal type="scale" className="order-2 lg:order-1 flex justify-center lg:justify-end">
                            <div className="relative w-full max-w-md">
                                <div className="absolute -inset-6 -z-10 bg-gradient-to-tr from-indigo-500/10 via-violet-500/10 to-emerald-500/10 blur-2xl rounded-[2rem]" />
                                <PulseChat />
                            </div>
                        </Reveal>

                        {/* capabilities — bordered cards */}
                        <div className="order-1 lg:order-2 flex flex-col gap-3.5">
                            {[
                                { c: 'indigo', t: 'Plain-English questions, real answers', d: '“Where’s my traffic from?” · “How’s my funnel?” · “Compare this month vs last.” Pulse calls 17 read-only tools and answers with numbers you can trust.', icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
                                { c: 'emerald', t: 'Charts, tables & one-click CSV', d: 'Every answer renders as a chart, table, or KPI card. Switch the view, export to CSV, or deep-link to the matching dashboard page.', icon: <><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></> },
                                { c: 'violet', t: 'Works in Claude Desktop & Cursor', badge: 'MCP', d: 'The same tools connect to any Model Context Protocol client. Ask Claude Desktop about your traffic and it queries InsightTrack directly.', icon: <><path d="M4 17l6-6-6-6" /><line x1="12" y1="19" x2="20" y2="19" /></> },
                            ].map((f, i) => (
                                <Reveal key={f.t} delay={i * 80}>
                                    <div className="group flex gap-4 p-4 rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] hover:border-gray-300 dark:hover:border-white/[0.14] hover:bg-gray-50 dark:hover:bg-white/[0.05] hover:shadow-lg transition-all">
                                        <div className={`w-10 h-10 shrink-0 rounded-xl grid place-items-center
                                            ${f.c === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                                : f.c === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                    : 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400'}`}>
                                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                                                {f.t}
                                                {f.badge && <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-600 dark:text-violet-300">{f.badge}</span>}
                                            </h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{f.d}</p>
                                        </div>
                                    </div>
                                </Reveal>
                            ))}
                            <Reveal delay={240}>
                                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/15 text-xs text-emerald-800 dark:text-emerald-300">
                                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                    Bring your own key — Anthropic, OpenAI, or Gemini. Stored encrypted, never leaves your server.
                                </div>
                            </Reveal>
                        </div>
                    </div>

                    {/* Providers + MCP clients — compact support strip */}
                    <Reveal delay={100} className="mt-8">
                        <div className="grid sm:grid-cols-2 gap-4">
                            {/* Powered by — AI providers */}
                            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-5">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Bring your own model</p>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { name: 'Anthropic', sub: 'Claude', Icon: Logo.anthropic, color: 'text-[#d97757]' },
                                        { name: 'OpenAI', sub: 'GPT', Icon: Logo.openai, color: 'text-gray-900 dark:text-white' },
                                        { name: 'Google', sub: 'Gemini', Icon: Logo.gemini, color: 'text-[#4285f4]' },
                                    ].map(({ name, sub, Icon, color }) => (
                                        <span key={name} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04]">
                                            <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                                            <span className="leading-tight">
                                                <span className="block text-xs font-semibold text-gray-900 dark:text-white">{name}</span>
                                                <span className="block text-[10px] text-gray-500 dark:text-gray-400">{sub}</span>
                                            </span>
                                        </span>
                                    ))}
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3 flex items-center gap-1.5">
                                    <svg className="w-3 h-3 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                    Encrypted at rest · never leaves your server
                                </p>
                            </div>

                            {/* Connect via MCP — clients */}
                            <div className="rounded-2xl border border-violet-200 dark:border-violet-500/25 bg-gradient-to-br from-violet-50/80 to-white dark:from-violet-500/[0.09] dark:to-white/[0.02] p-5">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-violet-500 dark:text-violet-400 mb-3 flex items-center gap-1.5">
                                    <Plug className="w-3 h-3" /> Connect over MCP
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {['Claude Desktop', 'Cursor', 'Zed', 'Windsurf', 'Any MCP client'].map((c) => (
                                        <span key={c} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.06] text-xs font-medium text-gray-700 dark:text-gray-200">
                                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />{c}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">
                                    Remote HTTP URL (nothing to install) or a local bridge · 17 read-only tools, scoped to your account.
                                </p>
                            </div>
                        </div>
                    </Reveal>
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
                            {['WordPress', 'Next.js', 'Shopify', 'Webflow', 'Squarespace', 'React', 'Vue', 'Nuxt', 'SvelteKit', 'Plain HTML'].map(p => (
                                <span key={p} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
                                    {p}
                                </span>
                            ))}
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ── DEPLOY YOUR OWN ─────────────────────────────────────────── */}
            <section id="deploy" className="py-24 px-4 sm:px-6 bg-white dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-800">
                <div className="max-w-4xl mx-auto">
                    <Reveal className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/8 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-4">
                            <Server className="w-3 h-3" /> Self-host
                        </div>
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">Deploy your own in minutes</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base max-w-lg mx-auto">
                            100% open source — run the whole stack on your own server. Pick Docker for the
                            fastest path, or run the <code className="text-indigo-600 dark:text-indigo-400">apps/</code> or{' '}
                            <code className="text-indigo-600 dark:text-indigo-400">appsv2/</code> layout manually.
                        </p>
                    </Reveal>

                    <Reveal type="scale">
                        {/* Tab selector */}
                        <div className="flex flex-wrap justify-center gap-2 mb-5">
                            {DEPLOY_TABS.map((t) => (
                                <button key={t.id} onClick={() => setDeployTab(t.id)}
                                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold border transition-all
                                        ${deployTab === t.id
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/25'
                                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'}`}>
                                    <t.icon className="w-3.5 h-3.5" /> {t.label}
                                </button>
                            ))}
                        </div>

                        {(() => {
                            const tab = DEPLOY_TABS.find(t => t.id === deployTab) || DEPLOY_TABS[0];
                            return (
                                <div className="rounded-2xl overflow-hidden border border-gray-800 shadow-2xl shadow-black/30">
                                    {/* terminal chrome */}
                                    <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1a1d27] border-b border-gray-700/60">
                                        <span className="w-3 h-3 rounded-full bg-red-400" />
                                        <span className="w-3 h-3 rounded-full bg-yellow-400" />
                                        <span className="w-3 h-3 rounded-full bg-green-400" />
                                        <span className="ml-3 text-[11px] text-gray-400 font-mono">terminal — {tab.label}</span>
                                    </div>
                                    <pre className="bg-[#0d0f1a] text-gray-200 text-[12px] sm:text-[13px] leading-relaxed p-4 sm:p-6 overflow-x-auto font-mono whitespace-pre">{tab.code}</pre>
                                    <div className="bg-[#0d0f1a] border-t border-gray-800 px-4 sm:px-6 py-3 flex items-center gap-2 text-[12px] text-gray-400">
                                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {tab.note}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* helper links */}
                        <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-[13px]">
                            <a href="https://github.com/NishikantaRay/InsightTrack" target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 font-semibold text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                <Github className="w-4 h-4" /> View on GitHub <ExternalLink className="w-3 h-3" />
                            </a>
                            <Link to="/docs" className="inline-flex items-center gap-1.5 font-semibold text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                <FileText className="w-4 h-4" /> Read the deployment docs
                            </Link>
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
                            GA4 sells your data. Plausible costs $9+/mo. InsightsTrack is both free and private.
                        </p>
                    </Reveal>

                    <Reveal type="scale">
                        <div className="rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                            <div className="grid grid-cols-4 bg-gray-50 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800">
                                <div className="col-span-1 px-4 sm:px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Feature</div>
                                {[
                                    { name: 'InsightsTrack', sub: 'Free forever', accent: '#6366f1', icon: BarChart3 },
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
                                {['No cookies', 'Self-hosted', 'Open source', 'GDPR compliant', 'Free forever'].map(t => (
                                    <span key={t} className="flex items-center gap-1.5">
                                        <Check className="w-3 h-3 text-emerald-400" />{t}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* ── FAQ (with FAQPage structured data for AEO) ──────────────── */}
            <section id="faq" className="py-24 px-4 sm:px-6 bg-[#fafafa] dark:bg-[#0a0a0f] border-t border-gray-200 dark:border-gray-800">
                {/* FAQPage JSON-LD — lets Google & AI answer engines quote these directly */}
                <script type="application/ld+json" dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'FAQPage',
                        mainEntity: FAQS.map(({ q, a }) => ({
                            '@type': 'Question',
                            name: q,
                            acceptedAnswer: { '@type': 'Answer', text: a },
                        })),
                    })
                }} />

                <div className="max-w-3xl mx-auto">
                    <Reveal className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/8 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-4">
                            <HelpCircle className="w-3 h-3" /> FAQ
                        </div>
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">Frequently asked questions</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">
                            Everything you need to know about InsightsTrack.
                        </p>
                    </Reveal>

                    <div className="space-y-3">
                        {FAQS.map((faq, i) => (
                            <Reveal key={faq.q} delay={i * 40}>
                                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 overflow-hidden">
                                    <button
                                        onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                                        aria-expanded={openFaq === i}
                                        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
                                        <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">{faq.q}</span>
                                        <ChevronDown className={`w-5 h-5 shrink-0 text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                                    </button>
                                    {openFaq === i && (
                                        <p className="px-5 pb-5 -mt-1 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                            {faq.a}
                                        </p>
                                    )}
                                </div>
                            </Reveal>
                        ))}
                    </div>

                    <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-10">
                        Still have questions?{' '}
                        <a href="https://github.com/NishikantaRay/InsightTrack" target="_blank" rel="noopener noreferrer"
                            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                            Ask on GitHub
                        </a>{' '}
                        or{' '}
                        <a href="mailto:nishikantaray1@gmail.com" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                            email us
                        </a>.
                    </p>
                </div>
            </section>

            {/* ── FOOTER ─────────────────────────────────────────────────── */}
            <footer className="border-t border-gray-200 dark:border-gray-800 py-10 px-4 sm:px-6 bg-white dark:bg-gray-900/20">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-sm">InsightsTrack</span>
                        <span className="text-xs text-gray-400">· Open-source analytics</span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-1.5 text-sm text-gray-400">
                        {[['#features', 'Features'], ['#showcase', 'Showcase'], ['#pulse', 'Pulse AI'], ['#how', 'Setup'], ['#deploy', 'Deploy'], ['#faq', 'FAQ']].map(([h, l]) => (
                            <a key={l} href={h} className="hover:text-gray-900 dark:hover:text-white transition-colors">{l}</a>
                        ))}
                        <Link to="/blog" className="hover:text-gray-900 dark:hover:text-white transition-colors">Blog</Link>
                        <Link to="/login" className="hover:text-gray-900 dark:hover:text-white transition-colors">Sign in</Link>
                        <Link to="/privacy-policy" className="hover:text-gray-900 dark:hover:text-white transition-colors">Privacy</Link>
                        <Link to="/terms" className="hover:text-gray-900 dark:hover:text-white transition-colors">Terms</Link>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap justify-center">
                        <a href="https://www.producthunt.com/products/insightstrack?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-insightstrack"
                            target="_blank" rel="noopener noreferrer">
                            <img
                                src={`https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1183103&theme=${dark ? 'dark' : 'light'}`}
                                alt="InsightsTrack on Product Hunt" width="200" height="43"
                                style={{ width: 200, height: 43 }}
                            />
                        </a>
                        <a href="https://github.com/sponsors/NishikantaRay" target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold
                                border border-pink-200 dark:border-pink-500/30 text-pink-600 dark:text-pink-400
                                hover:bg-pink-50 dark:hover:bg-pink-500/10 transition-colors">
                            <Heart className="w-4 h-4" /> Sponsor
                        </a>
                        <p className="text-xs text-gray-400 dark:text-gray-600">
                            &copy; {new Date().getFullYear()} InsightsTrack · Built by{' '}
                            <a href="https://nishikanta.in/" target="_blank" rel="noopener noreferrer"
                                className="hover:text-gray-900 dark:hover:text-white transition-colors underline-offset-2 hover:underline">
                                Nishikanta Ray
                            </a>
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
