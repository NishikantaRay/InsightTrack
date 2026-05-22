import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo, memo } from 'react';
import html2canvas from 'html2canvas';
import ExportModal from '../components/reporting/ExportModal';
import {
    Download, Plus, Trash2, Mail, Calendar,
    BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon,
    Table2, TrendingUp, TrendingDown, Edit2, Eye, Check, X, Grip, ChevronRight,
    LayoutGrid, LayoutDashboard, StickyNote, Share2, AlignLeft,
    AlignCenter, AlignRight, Camera, GripHorizontal, ArrowUp, ArrowDown,
    Copy, AlertCircle, RefreshCw, ChevronDown, Loader2,
    Save,
} from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ── inject widget canvas CSS once ────────────────────────────────────────────
const CANVAS_CSS = `
.dragging-widget { box-shadow:0 20px 48px rgba(0,0,0,0.15) !important; opacity:0.97; z-index:100 !important; }
@media print {
  /* ── Hide the entire live app; show only the dedicated print tree ── */
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { margin: 0 !important; padding: 0 !important; }
  #root { display: none !important; }
  #insighttrack-print-root { display: block !important; }
  .no-print { display: none !important; }
}
`;
if (typeof document !== 'undefined' && !document.getElementById('canvas-grid-css')) {
    const s = document.createElement('style'); s.id = 'canvas-grid-css'; s.textContent = CANVAS_CSS; document.head.appendChild(s);
}
// Ensure print portal root exists but is invisible outside @media print
if (typeof document !== 'undefined' && !document.getElementById('insighttrack-print-root')) {
    const pr = document.createElement('div');
    pr.id = 'insighttrack-print-root';
    pr.style.cssText = 'display:none;';
    document.body.appendChild(pr);
}

// ── pixel layout engine ───────────────────────────────────────────────────────
const SNAP_PX = 20;
const WIDGET_PX = {
    kpi_card: { minW: 160, minH: 100, defaultW: 280, defaultH: 180 },
    area_chart: { minW: 320, minH: 200, defaultW: 640, defaultH: 300 },
    bar_chart: { minW: 320, minH: 200, defaultW: 480, defaultH: 300 },
    pie_chart: { minW: 240, minH: 200, defaultW: 340, defaultH: 300 },
    data_table: { minW: 320, minH: 160, defaultW: 480, defaultH: 300 },
    text_note: { minW: 160, minH: 80, defaultW: 760, defaultH: 160 },
};
const RH_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
function snapV(v, on) { return on ? Math.round(v / SNAP_PX) * SNAP_PX : v; }
function buildPixelLayout(widgets, existing = {}, canvasW = 900) {
    const PAD = 16, GAP = 16;
    let cx = PAD, cy = PAD, rowH = 0;
    const result = {};
    for (const w of widgets) {
        if (existing[w.id]) { result[w.id] = existing[w.id]; continue; }
        if (w.px) { result[w.id] = w.px; continue; }
        const meta = WIDGET_PX[w.type] || WIDGET_PX.area_chart;
        const ww = Math.min(meta.defaultW, canvasW - PAD * 2);
        if (cx + ww > canvasW - PAD && cx > PAD) { cx = PAD; cy += rowH + GAP; rowH = 0; }
        result[w.id] = { x: cx, y: cy, w: ww, h: meta.defaultH };
        cx += ww + GAP; rowH = Math.max(rowH, meta.defaultH);
    }
    return result;
}

// ── CanvasEngine: freeform pixel drag+resize canvas ───────────────────────────
function CanvasEngine({
    widgets, layoutMap, onLayoutChange,
    isShared, siteId, isDark,
    selectedId, onSelect,
    capturingId, onCapture, onDuplicate, onRemove,
    resizeInfo, onResizeInfo,
    snapEnabled,
}) {
    const canvasRef = useRef(null);
    const canvasWR = useRef(900);
    const drag = useRef(null);
    const resize = useRef(null);
    const raf = useRef(null);
    const mapRef = useRef(layoutMap);
    useEffect(() => { mapRef.current = layoutMap; }, [layoutMap]);

    useLayoutEffect(() => {
        if (!canvasRef.current) return;
        canvasWR.current = canvasRef.current.getBoundingClientRect().width || 900;
        const ro = new ResizeObserver(([e]) => {
            const cw = e.contentRect.width;
            canvasWR.current = cw;
            const cur = mapRef.current;
            const over = Object.entries(cur).filter(([, r]) => r.x + r.w > cw);
            if (over.length) {
                const fixed = { ...cur };
                over.forEach(([id, r]) => {
                    const w = Math.min(r.w, cw - 16);
                    fixed[id] = { ...r, x: Math.min(r.x, Math.max(0, cw - w - 16)), w };
                });
                mapRef.current = fixed;
                onLayoutChange(fixed);
            }
        });
        ro.observe(canvasRef.current);
        return () => ro.disconnect();
    }, [onLayoutChange]);

    const canvasH = useMemo(() => {
        const vals = Object.values(layoutMap);
        return vals.length ? Math.max(400, ...vals.map(l => l.y + l.h + 40)) : 400;
    }, [layoutMap]);

    const handleDragDown = useCallback((e, id) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        const r = mapRef.current[id];
        if (!r) return;
        drag.current = { id, sx: e.clientX, sy: e.clientY, ox: r.x, oy: r.y, ow: r.w, oh: r.h };
        e.currentTarget.setPointerCapture(e.pointerId);
        const el = document.getElementById(`canvas-widget-${id}`);
        if (el) el.classList.add('dragging-widget');
    }, []);

    const handleResizeDown = useCallback((e, id, dir) => {
        e.stopPropagation(); e.preventDefault();
        const r = mapRef.current[id];
        if (!r) return;
        resize.current = { id, dir, sx: e.clientX, sy: e.clientY, ox: r.x, oy: r.y, ow: r.w, oh: r.h };
        onResizeInfo({ id, w: Math.round(r.w), h: Math.round(r.h) });
        e.currentTarget.setPointerCapture(e.pointerId);
    }, [onResizeInfo]);

    const handlePointerMove = useCallback((e) => {
        if (!drag.current && !resize.current) return;
        cancelAnimationFrame(raf.current);
        const ex = e.clientX, ey = e.clientY;
        raf.current = requestAnimationFrame(() => {
            const cw = canvasWR.current;
            if (drag.current) {
                const { id, sx, sy, ox, oy, ow, oh } = drag.current;
                const nx = Math.max(0, Math.min(snapV(ox + ex - sx, snapEnabled), cw - ow));
                const ny = Math.max(0, snapV(oy + ey - sy, snapEnabled));
                mapRef.current = { ...mapRef.current, [id]: { x: nx, y: ny, w: ow, h: oh } };
                const el = document.getElementById(`canvas-widget-${id}`);
                if (el) { el.style.left = `${nx}px`; el.style.top = `${ny}px`; }
            }
            if (resize.current) {
                const { id, dir, sx, sy, ox, oy, ow, oh } = resize.current;
                const meta = WIDGET_PX[widgets.find(w => w.id === id)?.type] || WIDGET_PX.area_chart;
                const dx = ex - sx, dy = ey - sy;
                let x = ox, y = oy, w = ow, h = oh;
                if (dir.includes('e')) w = Math.max(meta.minW, snapV(ow + dx, snapEnabled));
                if (dir.includes('s')) h = Math.max(meta.minH, snapV(oh + dy, snapEnabled));
                if (dir.includes('w')) {
                    const nx = Math.max(0, Math.min(snapV(ox + dx, snapEnabled), ox + ow - meta.minW));
                    w = ow + (ox - nx); x = nx;
                }
                if (dir.includes('n')) {
                    const ny = Math.max(0, Math.min(snapV(oy + dy, snapEnabled), oy + oh - meta.minH));
                    h = oh + (oy - ny); y = ny;
                }
                w = Math.min(w, cw - x);
                mapRef.current = { ...mapRef.current, [id]: { x, y, w, h } };
                onResizeInfo({ id, w: Math.round(w), h: Math.round(h) });
                const el = document.getElementById(`canvas-widget-${id}`);
                if (el) { el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.width = `${w}px`; el.style.height = `${h}px`; }
            }
        });
    }, [snapEnabled, widgets, onResizeInfo]);

    const handlePointerUp = useCallback(() => {
        cancelAnimationFrame(raf.current);
        if (drag.current) {
            const el = document.getElementById(`canvas-widget-${drag.current.id}`);
            if (el) el.classList.remove('dragging-widget');
        }
        if (drag.current || resize.current) {
            onLayoutChange({ ...mapRef.current });
            onResizeInfo(null);
        }
        drag.current = null; resize.current = null;
    }, [onLayoutChange, onResizeInfo]);

    const rhStyle = {
        n: { position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 48, height: 8, cursor: 'n-resize' },
        s: { position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 48, height: 8, cursor: 's-resize' },
        e: { position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', width: 8, height: 48, cursor: 'e-resize' },
        w: { position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)', width: 8, height: 48, cursor: 'w-resize' },
        ne: { position: 'absolute', top: -5, right: -5, width: 10, height: 10, cursor: 'ne-resize' },
        nw: { position: 'absolute', top: -5, left: -5, width: 10, height: 10, cursor: 'nw-resize' },
        se: { position: 'absolute', bottom: -5, right: -5, width: 10, height: 10, cursor: 'se-resize' },
        sw: { position: 'absolute', bottom: -5, left: -5, width: 10, height: 10, cursor: 'sw-resize' },
    };

    return (
        <div
            ref={canvasRef}
            id="dashboard-canvas"
            className="relative rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden dashboard-canvas"
            style={{
                height: canvasH,
                background: snapEnabled
                    ? 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)'
                    : 'var(--canvas-bg, #f9fafb)',
                backgroundSize: snapEnabled ? `${SNAP_PX}px ${SNAP_PX}px` : undefined,
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={() => onSelect(null)}
        >
            {snapEnabled && (
                <div className="absolute inset-0 pointer-events-none dark:opacity-30" style={{
                    backgroundImage: 'radial-gradient(circle, #6366f140 1px, transparent 1px)',
                    backgroundSize: `${SNAP_PX}px ${SNAP_PX}px`,
                    zIndex: 0,
                }} />
            )}
            {widgets.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-center pointer-events-none">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
                        <LayoutGrid className="w-7 h-7 text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">Canvas is empty</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">Click <strong>Add Widget</strong> in the toolbar to get started</p>
                    </div>
                </div>
            )}
            {widgets.map(w => {
                const r = layoutMap[w.id];
                if (!r) return null;
                const isSel = selectedId === w.id;
                const isCap = capturingId === w.id;
                return (
                    <div
                        key={w.id}
                        id={`canvas-widget-${w.id}`}
                        className={[
                            'absolute flex flex-col overflow-hidden',
                            'bg-white dark:bg-gray-900 rounded-xl border',
                            isSel
                                ? 'border-indigo-400 ring-2 ring-indigo-400/25 shadow-lg shadow-indigo-500/10 widget-selected'
                                : 'border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700',
                            isCap ? 'ring-2 ring-amber-400' : '',
                        ].join(' ')}
                        style={{ left: r.x, top: r.y, width: r.w, height: r.h, zIndex: isSel ? 20 : 10 }}
                        onClick={(e) => { e.stopPropagation(); onSelect(w.id); }}
                    >
                        <div
                            className="widget-drag-handle flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 select-none shrink-0 group/header"
                            style={{ cursor: isShared ? 'default' : 'grab' }}
                            onPointerDown={!isShared ? (e) => handleDragDown(e, w.id) : undefined}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <GripHorizontal className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 group-hover/header:text-gray-400 transition" />
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 truncate leading-tight">{w.title}</span>
                            </div>
                            <div className={`flex items-center gap-0.5 shrink-0 transition-opacity duration-150 ${isSel ? 'opacity-100' : 'opacity-0 group-hover/header:opacity-100'}`}>
                                <button title="Capture as PNG" onClick={(e) => { e.stopPropagation(); onCapture(w.id); }} disabled={isCap}
                                    className="p-1.5 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-400 hover:text-indigo-500 transition">
                                    {isCap ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" /> : <Camera className="w-3.5 h-3.5" />}
                                </button>
                                <button title="Duplicate" onClick={(e) => { e.stopPropagation(); onDuplicate(w); }}
                                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                                {!isShared && (
                                    <button title="Remove" onClick={(e) => { e.stopPropagation(); onRemove(w.id); }}
                                        className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="relative flex-1 overflow-hidden" style={{ minHeight: 0 }}>
                            {resizeInfo?.id === w.id && (
                                <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full font-mono z-20 pointer-events-none shadow-sm">
                                    {resizeInfo.w}×{resizeInfo.h}px
                                </div>
                            )}
                            <div className="absolute inset-0 p-3">
                                <WidgetRenderer widget={w} siteId={siteId} isDark={isDark} />
                            </div>
                        </div>
                        {!isShared && isSel && RH_DIRS.map(dir => (
                            <div key={dir} style={rhStyle[dir]} onPointerDown={(e) => handleResizeDown(e, w.id, dir)}>
                                <div className="w-full h-full rounded-sm bg-indigo-500 opacity-80 hover:opacity-100 transition-opacity" />
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}

import { useSiteStore } from '../store/useSiteStore';
import { useAnalytics } from '../hooks/useAnalytics';
import { reportingAPI, analyticsAPI } from '../services/api';
import { useThemeStore } from '../store/useThemeStore';
import { formatNumber, formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';
import PageNote from '../components/ui/PageNote';
import { useFocusModeStore } from '../store/useFocusModeStore';

// ── constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#84CC16'];

const COLOR_PALETTES = {
    default: ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#84CC16'],
    ocean: ['#0EA5E9', '#06B6D4', '#14B8A6', '#22D3EE', '#0284C7', '#0369A1', '#38BDF8', '#7DD3FC'],
    warm: ['#F97316', '#EF4444', '#F59E0B', '#EC4899', '#E11D48', '#C2410C', '#B45309', '#DB2777'],
    mono: ['#374151', '#6B7280', '#9CA3AF', '#4B5563', '#1F2937', '#D1D5DB', '#111827', '#E5E7EB'],
    forest: ['#16A34A', '#22C55E', '#84CC16', '#15803D', '#166534', '#4D7C0F', '#65A30D', '#86EFAC'],
    candy: ['#EC4899', '#8B5CF6', '#F59E0B', '#06B6D4', '#7C3AED', '#DB2777', '#D97706', '#0891B2'],
    fire: ['#DC2626', '#F97316', '#FBBF24', '#EF4444', '#B91C1C', '#EA580C', '#D97706', '#991B1B'],
    purple: ['#7C3AED', '#8B5CF6', '#A78BFA', '#6366F1', '#4C1D95', '#5B21B6', '#7E22CE', '#9333EA'],
};

const DATE_RANGES = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
];

const WIDGET_TYPES = [
    { key: 'kpi_card', label: 'KPI Card', icon: TrendingUp, desc: 'Single metric with comparison' },
    { key: 'area_chart', label: 'Area Chart', icon: LineChartIcon, desc: 'Trend over time (filled)' },
    { key: 'bar_chart', label: 'Bar Chart', icon: BarChart3, desc: 'Ranked comparison bars' },
    { key: 'pie_chart', label: 'Pie Chart', icon: PieChartIcon, desc: 'Proportional breakdown' },
    { key: 'data_table', label: 'Data Table', icon: Table2, desc: 'Sortable rows with values' },
    { key: 'text_note', label: 'Text / Note', icon: StickyNote, desc: 'Heading, paragraph or callout' },
];

const DATA_SOURCES = [
    { key: 'traffic', label: 'Traffic Over Time', xKey: 'date', metrics: ['visitors', 'sessions'] },
    { key: 'top_pages', label: 'Top Pages', xKey: 'page', metrics: ['views'] },
    { key: 'sources', label: 'Traffic Sources', xKey: 'source', metrics: ['visits'] },
    { key: 'devices', label: 'Devices', xKey: 'device', metrics: ['count'] },
    { key: 'countries', label: 'Countries', xKey: 'country', metrics: ['visitors'] },
    { key: 'sessions', label: 'Sessions', xKey: 'date', metrics: ['sessions', 'pageviews'] },
];

const KPI_METRICS = [
    { key: 'visitors', label: 'Total Visitors', field: (d) => d?.visitors ?? d?.unique_visitors },
    { key: 'sessions', label: 'Total Sessions', field: (d) => d?.sessions },
    { key: 'pageviews', label: 'Total Pageviews', field: (d) => d?.pageviews },
    { key: 'bounce_rate', label: 'Bounce Rate', field: (d) => d?.bounce_rate, suffix: '%' },
    { key: 'avg_duration', label: 'Avg Session Duration', field: (d) => d?.avg_duration, isTime: true },
];

// ── helpers ──────────────────────────────────────────────────────────────────

function uid() { return `w_${Math.random().toString(36).slice(2, 9)}`; }

function normalise(raw) {
    const d = raw?.data ?? raw;
    return Array.isArray(d) ? d : (d && typeof d === 'object') ? [d] : [];
}

function toCSV(rows) {
    if (!rows?.length) return '';
    const keys = Object.keys(rows[0]);
    const esc = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s; };
    return [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
}

function dlFile(content, name, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

function encodeSharePayload(name, widgets) {
    return btoa(encodeURIComponent(JSON.stringify({ name, widgets })));
}

function decodeSharePayload(token) {
    try { return JSON.parse(decodeURIComponent(atob(token))); } catch { return null; }
}

// infer column types from first data row
function inferSchema(data) {
    if (!data?.length) return { strings: [], numbers: [], dates: [] };
    const sample = data[0];
    const strings = [], numbers = [], dates = [];
    for (const [k, v] of Object.entries(sample ?? {})) {
        if (v === null || v === undefined) continue;
        if (typeof v === 'number') { numbers.push(k); continue; }
        if (typeof v === 'string') {
            if (/^\d{4}-\d{2}-\d{2}/.test(v)) dates.push(k);
            else strings.push(k);
        }
    }
    return { strings: [...dates, ...strings], numbers, dates };
}

// robust date label (ISO → short human)
function safeDate(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
        try {
            const d = new Date(v);
            if (!isNaN(d)) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch { /* fall through */ }
    }
    const s = String(v);
    return s.length > 18 ? `${s.slice(0, 16)}…` : s;
}

// ── widget data fetcher ───────────────────────────────────────────────────────

async function fetchWidgetData(siteId, dataSource, dateRange) {
    switch (dataSource) {
        case 'traffic': return normalise(await analyticsAPI.getTraffic(siteId, dateRange));
        case 'top_pages': return normalise(await analyticsAPI.getTopPages(siteId, dateRange, 20));
        case 'sources': return normalise(await analyticsAPI.getSources(siteId, dateRange));
        case 'devices': return normalise(await analyticsAPI.getDevices(siteId, dateRange));
        case 'countries': return normalise(await analyticsAPI.getCountries(siteId, dateRange, 15));
        case 'sessions': return normalise(await analyticsAPI.getSessions(siteId, dateRange));
        case 'kpi': return normalise(await analyticsAPI.getKPIs(siteId, dateRange));
        default: return [];
    }
}

// ── widget renderer ───────────────────────────────────────────────────────────

const WidgetRenderer = memo(function WidgetRenderer({ widget, siteId, isDark }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(widget.type !== 'text_note');
    const [error, setError] = useState(false);

    useEffect(() => {
        if (widget.type === 'text_note') return;
        setLoading(true);
        setError(false);
        fetchWidgetData(siteId, widget.dataSource, widget.dateRange || '30d')
            .then(setData)
            .catch(() => { setData([]); setError(true); })
            .finally(() => setLoading(false));
    }, [siteId, widget.dataSource, widget.dateRange, widget.type]);

    // Text / Note widget — no data needed
    if (widget.type === 'text_note') {
        const fsMap = { sm: '0.8125rem', base: '0.9375rem', lg: '1.0625rem', xl: '1.25rem', '2xl': '1.5rem' };
        const alignMap = { left: 'text-left', center: 'text-center', right: 'text-right' };
        const colorMap = {
            default: 'text-gray-800 dark:text-gray-200',
            muted: 'text-gray-500 dark:text-gray-400',
            indigo: 'text-indigo-600 dark:text-indigo-400',
            green: 'text-green-600 dark:text-green-400',
            red: 'text-red-600 dark:text-red-400',
            amber: 'text-amber-600 dark:text-amber-400',
        };
        const bgMap = {
            none: '',
            info: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3',
            warn: 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3',
            success: 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3',
            error: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3',
        };
        return (
            <div
                style={{ fontSize: fsMap[widget.fontSize || 'base'] }}
                className={`leading-relaxed min-h-[48px] ${alignMap[widget.textAlign || 'left']} ${colorMap[widget.textColor || 'default']} ${bgMap[widget.bgStyle || 'none']}`}
            >
                {(widget.content || '_Start typing your note…_').split('\n').map((line, i) => {
                    if (line.startsWith('# ')) return <h2 key={i} className="text-2xl font-bold mb-2 mt-1">{line.slice(2)}</h2>;
                    if (line.startsWith('## ')) return <h3 key={i} className="text-lg font-semibold mb-1 mt-1">{line.slice(3)}</h3>;
                    if (line.startsWith('> ')) return <blockquote key={i} className="border-l-4 border-indigo-400 pl-3 italic opacity-80 my-1">{line.slice(2)}</blockquote>;
                    if (!line.trim()) return <br key={i} />;
                    return <p key={i} className="mb-1">{line}</p>;
                })}
            </div>
        );
    }

    // ── resolved field mappings (widget overrides > DATA_SOURCES defaults > schema auto-detect)
    const src = DATA_SOURCES.find(s => s.key === widget.dataSource);
    const schema = inferSchema(data);
    const xKey = widget.xField || src?.xKey || schema.strings[0] || schema.dates[0] || Object.keys(data?.[0] || {})[0] || 'date';
    const availMetrics = src?.metrics?.length ? src.metrics : schema.numbers;
    const metrics = (widget.yFields?.filter(f => f !== xKey) || []).length
        ? widget.yFields.filter(f => f !== xKey)
        : availMetrics;
    const colors = COLOR_PALETTES[widget.colorPalette] ?? CHART_COLORS;
    // clean: rows where at least one metric is a valid number
    const cleanData = (data || []).filter(row =>
        metrics.some(m => row[m] != null && !Number.isNaN(Number(row[m])))
    );
    const isDateX = schema.dates.includes(xKey) || /date|time|day|created/i.test(xKey);
    const xFmt = isDateX ? safeDate : (v) => (v == null ? '' : String(v).length > 14 ? `${String(v).slice(0, 13)}…` : String(v));
    const gridColor = isDark ? '#374151' : '#F3F4F6';
    const tickColor = isDark ? '#9CA3AF' : '#6B7280';
    const ttStyle = { background: isDark ? '#1F2937' : '#fff', border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`, borderRadius: 8, fontSize: 12 };

    if (loading) return (
        <div className="flex flex-col gap-3 p-4 h-full">
            <div className="h-4 w-2/3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse min-h-[80px]" />
            <div className="h-3 w-1/3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        </div>
    );
    if (error) return (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-center p-4 min-h-[80px]">
            <AlertCircle className="w-7 h-7 text-red-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Failed to load data</p>
            <button onClick={() => { setError(false); setLoading(true); fetchWidgetData(siteId, widget.dataSource, widget.dateRange || '30d').then(setData).catch(() => { setData([]); setError(true); }).finally(() => setLoading(false)); }}
                className="text-xs text-indigo-500 hover:underline flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Retry
            </button>
        </div>
    );
    if (!data?.length) return (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-center p-4 min-h-[80px]">
            <BarChart3 className="w-8 h-8 text-gray-200 dark:text-gray-700" />
            <p className="text-sm text-gray-400">No data for this period</p>
            <p className="text-xs text-gray-300 dark:text-gray-600">Try a wider date range</p>
        </div>
    );

    if (widget.type === 'kpi_card') {
        const kpiMeta = KPI_METRICS.find(k => k.key === widget.kpiMetric) || KPI_METRICS[0];
        const raw = data[0] ?? {};
        const val = kpiMeta.field(Array.isArray(raw) ? raw[0] : raw);
        const display = kpiMeta.isTime
            ? (() => { const s = Math.round(val || 0); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; })()
            : kpiMeta.suffix ? `${Number(val || 0).toFixed(1)}${kpiMeta.suffix}` : formatNumber(val || 0);
        // Simple mock trend: show positive indicator
        const trendUp = (val || 0) > 0;
        return (
            <div className="flex flex-col justify-between h-full p-2">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{kpiMeta.label}</p>
                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                </div>
                <div className="flex items-end gap-2 my-2">
                    <p className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white leading-none">{display}</p>
                    <div className={`flex items-center gap-0.5 text-xs font-medium mb-0.5 ${trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                        {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    </div>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">{DATE_RANGES.find(r => r.value === widget.dateRange)?.label || 'Last 30 days'}</p>
            </div>
        );
    }

    if (widget.type === 'area_chart') {
        return (
            <div className="relative w-full h-full min-h-[180px] overflow-hidden">
                <div className="absolute inset-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={cleanData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                            <defs>
                                {metrics.map((m, i) => (
                                    <linearGradient key={m} id={`grad_${widget.id}_${i}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={colors[i % colors.length]} stopOpacity={0.22} />
                                        <stop offset="100%" stopColor={colors[i % colors.length]} stopOpacity={0} />
                                    </linearGradient>
                                ))}
                            </defs>
                            {widget.showGrid !== false && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />}
                            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} tickFormatter={xFmt} minTickGap={30} />
                            <YAxis tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} tickFormatter={formatNumber} width={48} />
                            <Tooltip formatter={(v, name) => [formatNumber(v), name]} labelFormatter={xFmt} contentStyle={ttStyle} />
                            {widget.showLegend !== false && metrics.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                            {metrics.map((m, i) => (
                                <Area key={m} type="monotone" dataKey={m} stroke={colors[i % colors.length]}
                                    fill={`url(#grad_${widget.id}_${i})`} strokeWidth={2}
                                    dot={widget.showDots ? { r: 3, fill: colors[i % colors.length] } : false}
                                    activeDot={{ r: 4 }} />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    if (widget.type === 'bar_chart') {
        const isVertical = widget.barOrientation === 'vertical';
        return (
            <div className="relative w-full h-full min-h-[180px] overflow-hidden">
                <div className="absolute inset-0">
                    <ResponsiveContainer width="100%" height="100%">
                        {isVertical ? (
                            <BarChart data={cleanData.slice(0, 16)} margin={{ top: 5, right: 8, left: -20, bottom: 20 }}>
                                {widget.showGrid !== false && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={true} vertical={false} />}
                                <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false}
                                    tickFormatter={xFmt} angle={-30} textAnchor="end" interval={0} />
                                <YAxis tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} tickFormatter={formatNumber} width={44} />
                                <Tooltip formatter={(v, name) => [formatNumber(v), name]} labelFormatter={xFmt} contentStyle={ttStyle} />
                                {widget.showLegend !== false && metrics.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                                {metrics.map((m, i) => <Bar key={m} dataKey={m} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} maxBarSize={40} />)}
                            </BarChart>
                        ) : (
                            <BarChart data={cleanData.slice(0, 14)} layout="vertical" margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
                                {widget.showGrid !== false && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />}
                                <XAxis type="number" tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                                <YAxis type="category" dataKey={xKey} tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} width={92}
                                    tickFormatter={(v) => v && String(v).length > 15 ? `${String(v).slice(0, 15)}…` : String(v ?? '')} />
                                <Tooltip formatter={(v, name) => [formatNumber(v), name]} contentStyle={ttStyle} />
                                {widget.showLegend !== false && metrics.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                                {metrics.map((m, i) => <Bar key={m} dataKey={m} fill={colors[i % colors.length]} radius={[0, 4, 4, 0]} maxBarSize={28} />)}
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    if (widget.type === 'pie_chart') {
        const rows = cleanData.slice(0, 9);
        const inner = widget.innerRadius ?? 0;
        return (
            <div className="relative w-full h-full min-h-[180px] overflow-hidden">
                <div className="absolute inset-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                            <Pie
                                data={rows}
                                dataKey={metrics[0] || 'value'}
                                nameKey={xKey}
                                cx="50%" cy="50%"
                                outerRadius="72%"
                                innerRadius={inner > 0 ? `${inner}%` : 0}
                                label={({ percent }) => percent > 0.06 ? `${(percent * 100).toFixed(0)}%` : ''}
                                labelLine={false}
                                paddingAngle={inner > 0 ? 2 : 0}
                            >
                                {rows.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v, name) => [formatNumber(v), name]} contentStyle={ttStyle} />
                            {widget.showLegend !== false && <Legend wrapperStyle={{ fontSize: 11 }} />}
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    if (widget.type === 'data_table') {
        const allCols = Object.keys(cleanData[0] || data?.[0] || {});
        const cols = (widget.visibleCols?.length ? widget.visibleCols : allCols).slice(0, 6);
        const limit = widget.rowLimit || 10;
        // Sort all rows first, then slice to limit
        let rows = [...(cleanData.length ? cleanData : data)];
        if (widget.sortBy && cols.includes(widget.sortBy)) {
            const dir = widget.sortDir === 'asc' ? 1 : -1;
            rows.sort((a, b) => {
                const av = a[widget.sortBy], bv = b[widget.sortBy];
                if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
                return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
            });
        }
        rows = rows.slice(0, limit);
        return (
            <div className="h-full overflow-auto">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10">
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            {cols.map(c => (
                                <th key={c} className="text-left py-2 pr-3 text-gray-500 dark:text-gray-400 font-semibold capitalize">
                                    {c.replace(/_/g, ' ')}
                                    {widget.sortBy === c && <span className="ml-1">{widget.sortDir === 'asc' ? '↑' : '↓'}</span>}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {rows.map((row, i) => (
                            <tr key={i} className={[
                                'transition-colors',
                                widget.stripedRows && i % 2 === 1 ? 'bg-gray-50/60 dark:bg-gray-800/30' : '',
                                'hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10',
                            ].join(' ')}>
                                {cols.map(c => (
                                    <td key={c} className="py-2 pr-3 text-gray-900 dark:text-white">
                                        {typeof row[c] === 'number' ? formatNumber(row[c]) : (row[c] == null ? '—' : String(row[c]))}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    return null;
}, (prev, next) =>
    prev.widget.id === next.widget.id &&
    prev.widget.dataSource === next.widget.dataSource &&
    prev.widget.dateRange === next.widget.dateRange &&
    prev.widget.type === next.widget.type &&
    prev.widget.content === next.widget.content &&
    prev.widget.title === next.widget.title &&
    prev.widget.xField === next.widget.xField &&
    prev.widget.yFields === next.widget.yFields &&
    prev.widget.kpiMetric === next.widget.kpiMetric &&
    prev.widget.showLegend === next.widget.showLegend &&
    prev.widget.showGrid === next.widget.showGrid &&
    prev.widget.showDots === next.widget.showDots &&
    prev.widget.barOrientation === next.widget.barOrientation &&
    prev.widget.innerRadius === next.widget.innerRadius &&
    prev.widget.rowLimit === next.widget.rowLimit &&
    prev.widget.sortBy === next.widget.sortBy &&
    prev.widget.sortDir === next.widget.sortDir &&
    prev.widget.stripedRows === next.widget.stripedRows &&
    prev.widget.colorPalette === next.widget.colorPalette &&
    prev.siteId === next.siteId &&
    prev.isDark === next.isDark
);

// ── right-side widget configuration panel ────────────────────────────────────────────
const PALETTE_PREVIEW = {
    default: ['#6366F1', '#10B981', '#F59E0B', '#EF4444'],
    ocean: ['#0EA5E9', '#06B6D4', '#14B8A6', '#22D3EE'],
    warm: ['#F97316', '#EF4444', '#F59E0B', '#EC4899'],
    mono: ['#374151', '#6B7280', '#9CA3AF', '#4B5563'],
    forest: ['#16A34A', '#22C55E', '#84CC16', '#15803D'],
    candy: ['#EC4899', '#8B5CF6', '#F59E0B', '#06B6D4'],
    fire: ['#DC2626', '#F97316', '#FBBF24', '#EF4444'],
    purple: ['#7C3AED', '#8B5CF6', '#A78BFA', '#6366F1'],
};

function Toggle({ on, onToggle }) {
    return (
        <button onClick={onToggle}
            className={`relative inline-flex w-9 h-5 rounded-full transition-colors shrink-0 ${on ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'
                }`} />
        </button>
    );
}

function PanelField({ label, children }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
            {children}
        </div>
    );
}

function PanelSelect({ value, onChange, options, className = '' }) {
    return (
        <select value={value} onChange={e => onChange(e.target.value)}
            className={`w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm ${className}`}>
            {options.map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
        </select>
    );
}

function WidgetConfigPanel({ widget, onUpdate, onClose }) {
    const [tab, setTab] = useState('data');
    const isText = widget.type === 'text_note';
    const isKPI = widget.type === 'kpi_card';
    const isChart = ['area_chart', 'bar_chart', 'pie_chart'].includes(widget.type);
    const isTable = widget.type === 'data_table';
    const src = DATA_SOURCES.find(s => s.key === widget.dataSource);

    const patch = useCallback((p) => onUpdate({ ...widget, ...p }), [widget, onUpdate]);

    const tabs = isText ? ['display', 'style'] : ['data', 'display', 'style'];

    return (
        <div
            className="fixed right-0 top-0 h-screen w-[300px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl shadow-gray-900/20 dark:shadow-black/40 z-[200] flex flex-col"
            onClick={e => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
                <span className="flex-1 text-xs font-semibold px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 truncate">
                    {WIDGET_TYPES.find(t => t.key === widget.type)?.label || 'Widget'}
                </span>
                <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Title */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
                <input
                    value={widget.title || ''}
                    onChange={e => patch({ title: e.target.value })}
                    placeholder="Widget title"
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-medium"
                />
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-800 shrink-0">
                {tabs.map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors border-b-2 ${tab === t
                            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}>
                        {t}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">

                {/* ── DATA TAB ── */}
                {tab === 'data' && !isText && (
                    <>
                        {/* Widget type switcher */}
                        <PanelField label="Widget Type">
                            <div className="grid grid-cols-3 gap-1">
                                {WIDGET_TYPES.filter(t => t.key !== 'text_note').map(({ key, label, icon: Icon }) => (
                                    <button key={key} onClick={() => patch({ type: key })}
                                        className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-xs transition ${widget.type === key
                                            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                                            }`}>
                                        <Icon className="w-4 h-4" />
                                        <span className="truncate w-full text-center leading-tight">{label}</span>
                                    </button>
                                ))}
                            </div>
                        </PanelField>

                        {/* KPI metric selector */}
                        {isKPI && (
                            <PanelField label="KPI Metric">
                                <PanelSelect
                                    value={widget.kpiMetric || 'visitors'}
                                    onChange={v => patch({ kpiMetric: v, dataSource: 'kpi' })}
                                    options={KPI_METRICS.map(k => ({ v: k.key, l: k.label }))}
                                />
                            </PanelField>
                        )}

                        {/* Data source */}
                        {!isKPI && (
                            <PanelField label="Data Source">
                                <PanelSelect
                                    value={widget.dataSource || 'traffic'}
                                    onChange={v => patch({ dataSource: v, xField: null, yFields: null })}
                                    options={DATA_SOURCES.map(s => ({ v: s.key, l: s.label }))}
                                />
                            </PanelField>
                        )}

                        {/* Date range */}
                        <PanelField label="Date Range">
                            <div className="grid grid-cols-2 gap-1">
                                {DATE_RANGES.map(r => (
                                    <button key={r.value} onClick={() => patch({ dateRange: r.value })}
                                        className={`py-1.5 text-xs rounded-lg border transition ${(widget.dateRange || '30d') === r.value
                                            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                                            }`}>
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </PanelField>

                        {/* X / Y field mapping for time-series charts */}
                        {isChart && widget.type !== 'pie_chart' && src && (
                            <>
                                <PanelField label="X Axis Field">
                                    <PanelSelect
                                        value={widget.xField || src.xKey}
                                        onChange={v => patch({ xField: v })}
                                        options={[src.xKey, ...src.metrics].map(f => ({ v: f, l: f }))}
                                    />
                                </PanelField>
                                <PanelField label="Y Axis Metrics">
                                    <div className="space-y-2">
                                        {src.metrics.map(m => {
                                            const active = widget.yFields || src.metrics;
                                            return (
                                                <label key={m} className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox"
                                                        checked={active.includes(m)}
                                                        onChange={e => {
                                                            const next = e.target.checked
                                                                ? [...active, m]
                                                                : active.filter(x => x !== m);
                                                            if (next.length) patch({ yFields: next });
                                                        }}
                                                        className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-400" />
                                                    <span className="text-sm text-gray-600 dark:text-gray-300">{m}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </PanelField>
                            </>
                        )}

                        {/* Table: row limit + sort */}
                        {isTable && (
                            <>
                                <PanelField label="Row Limit">
                                    <PanelSelect
                                        value={String(widget.rowLimit || 10)}
                                        onChange={v => patch({ rowLimit: Number(v) })}
                                        options={[5, 10, 20, 50, 100].map(n => ({ v: String(n), l: `${n} rows` }))}
                                    />
                                </PanelField>
                                {src && (
                                    <PanelField label="Sort By">
                                        <PanelSelect
                                            value={widget.sortBy || ''}
                                            onChange={v => patch({ sortBy: v })}
                                            options={[{ v: '', l: 'Default order' }, ...([src.xKey, ...src.metrics].map(f => ({ v: f, l: f })))]}
                                        />
                                    </PanelField>
                                )}
                                {widget.sortBy && (
                                    <PanelField label="Sort Direction">
                                        <div className="flex gap-1">
                                            {[['asc', '↑ Ascending'], ['desc', '↓ Descending']].map(([v, l]) => (
                                                <button key={v} onClick={() => patch({ sortDir: v })}
                                                    className={`flex-1 py-1.5 text-xs rounded-lg border transition ${(widget.sortDir || 'desc') === v
                                                        ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'
                                                        : 'border-gray-200 dark:border-gray-700 text-gray-500'
                                                        }`}>{l}</button>
                                            ))}
                                        </div>
                                    </PanelField>
                                )}
                            </>
                        )}
                    </>
                )}

                {/* ── DISPLAY TAB ── */}
                {tab === 'display' && (
                    <>
                        {isText && (
                            <>
                                <PanelField label="Content">
                                    <textarea
                                        value={widget.content || ''}
                                        onChange={e => patch({ content: e.target.value })}
                                        rows={7}
                                        placeholder={'# Heading\nParagraph text.\n> Blockquote'}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-mono resize-y"
                                    />
                                    <p className="text-xs text-gray-400"># H1 · ## H2 · &gt; blockquote</p>
                                </PanelField>
                                <PanelField label="Font Size">
                                    <PanelSelect value={widget.fontSize || 'base'} onChange={v => patch({ fontSize: v })}
                                        options={[{ v: 'sm', l: 'Small' }, { v: 'base', l: 'Normal' }, { v: 'lg', l: 'Large' }, { v: 'xl', l: 'X-Large' }]} />
                                </PanelField>
                                <PanelField label="Alignment">
                                    <div className="flex gap-1">
                                        {[[AlignLeft, 'left'], [AlignCenter, 'center'], [AlignRight, 'right']].map(([Icon, v]) => (
                                            <button key={v} onClick={() => patch({ textAlign: v })}
                                                className={`flex-1 py-2 rounded-lg border transition flex items-center justify-center ${(widget.textAlign || 'left') === v
                                                    ? 'bg-indigo-500 border-indigo-500 text-white'
                                                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                                                    }`}><Icon className="w-3.5 h-3.5" /></button>
                                        ))}
                                    </div>
                                </PanelField>
                                <PanelField label="Background">
                                    <PanelSelect value={widget.bgStyle || 'none'} onChange={v => patch({ bgStyle: v })}
                                        options={[{ v: 'none', l: 'None' }, { v: 'info', l: 'Info (blue)' }, { v: 'warn', l: 'Warning (amber)' }, { v: 'success', l: 'Success (green)' }, { v: 'error', l: 'Alert (red)' }]} />
                                </PanelField>
                            </>
                        )}

                        {isChart && (
                            <>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-300">Show Legend</span>
                                    <Toggle on={widget.showLegend !== false} onToggle={() => patch({ showLegend: !(widget.showLegend !== false) })} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-300">Show Grid</span>
                                    <Toggle on={widget.showGrid !== false} onToggle={() => patch({ showGrid: !(widget.showGrid !== false) })} />
                                </div>
                                {widget.type === 'area_chart' && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600 dark:text-gray-300">Show Data Dots</span>
                                        <Toggle on={!!widget.showDots} onToggle={() => patch({ showDots: !widget.showDots })} />
                                    </div>
                                )}
                                {widget.type === 'bar_chart' && (
                                    <PanelField label="Bar Orientation">
                                        <div className="flex gap-1">
                                            {[['', 'Horizontal'], ['vertical', 'Vertical']].map(([v, l]) => (
                                                <button key={v} onClick={() => patch({ barOrientation: v || undefined })}
                                                    className={`flex-1 py-1.5 text-xs rounded-lg border transition ${(widget.barOrientation || '') === v
                                                        ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'
                                                        : 'border-gray-200 dark:border-gray-700 text-gray-500'
                                                        }`}>{l}</button>
                                            ))}
                                        </div>
                                    </PanelField>
                                )}
                                {widget.type === 'pie_chart' && (
                                    <PanelField label="Chart Style">
                                        <div className="flex gap-1">
                                            {[[0, 'Pie'], [40, 'Donut']].map(([v, l]) => (
                                                <button key={v} onClick={() => patch({ innerRadius: v })}
                                                    className={`flex-1 py-1.5 text-xs rounded-lg border transition ${(widget.innerRadius ?? 0) === v
                                                        ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'
                                                        : 'border-gray-200 dark:border-gray-700 text-gray-500'
                                                        }`}>{l}</button>
                                            ))}
                                        </div>
                                    </PanelField>
                                )}
                            </>
                        )}

                        {isTable && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-300">Striped Rows</span>
                                <Toggle on={!!widget.stripedRows} onToggle={() => patch({ stripedRows: !widget.stripedRows })} />
                            </div>
                        )}
                    </>
                )}

                {/* ── STYLE TAB ── */}
                {tab === 'style' && (
                    <PanelField label="Color Palette">
                        <div className="grid grid-cols-4 gap-2">
                            {Object.entries(PALETTE_PREVIEW).map(([key, colors]) => (
                                <button key={key} onClick={() => patch({ colorPalette: key })}
                                    title={key}
                                    className={`p-1 rounded-lg border-2 transition ${(widget.colorPalette || 'default') === key
                                        ? 'border-indigo-500 shadow-sm'
                                        : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}>
                                    <div className="flex gap-0.5 h-5">
                                        {colors.map((c, i) => <div key={i} style={{ background: c }} className="flex-1 rounded-[2px]" />)}
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-0.5 capitalize text-center">{key}</p>
                                </button>
                            ))}
                        </div>
                    </PanelField>
                )}
            </div>
        </div>
    );
}

// ── widget config form ────────────────────────────────────────────────────────

function WidgetConfigForm({ widget, onChange, onRemove, onMoveUp, onMoveDown }) {
    const isText = widget.type === 'text_note';
    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-grab text-gray-400 select-none">
                    <Grip className="w-4 h-4" />
                    <span className="text-xs font-medium">{WIDGET_TYPES.find(t => t.key === widget.type)?.label || 'Widget'}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={onMoveUp} title="Move up" className="p-1 text-gray-400 hover:text-indigo-500 transition"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button onClick={onMoveDown} title="Move down" className="p-1 text-gray-400 hover:text-indigo-500 transition"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button onClick={onRemove} title="Remove" className="p-1 text-gray-400 hover:text-red-500 transition"><X className="w-4 h-4" /></button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Title */}
                <div className={isText ? '' : ''}>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Title</label>
                    <input value={widget.title} onChange={(e) => onChange({ ...widget, title: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
                </div>

                {/* Chart type selector */}
                <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Widget Type</label>
                    <select value={widget.type} onChange={(e) => onChange({ ...widget, type: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                        {WIDGET_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                </div>

                {/* Text note specific fields */}
                {isText && (
                    <>
                        <div className="sm:col-span-2">
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                Content <span className="text-gray-400">(# Heading, ## Subheading, &gt; Quote)</span>
                            </label>
                            <textarea
                                value={widget.content || ''}
                                onChange={(e) => onChange({ ...widget, content: e.target.value })}
                                placeholder={'# Heading\nYour paragraph text here.\n> A quoted callout'}
                                rows={5}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono resize-y"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Font Size</label>
                            <select value={widget.fontSize || 'base'} onChange={(e) => onChange({ ...widget, fontSize: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                                <option value="sm">Small</option>
                                <option value="base">Normal</option>
                                <option value="lg">Large</option>
                                <option value="xl">X-Large</option>
                                <option value="2xl">2X-Large</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Alignment</label>
                            <div className="flex gap-1">
                                {[{ v: 'left', icon: AlignLeft }, { v: 'center', icon: AlignCenter }, { v: 'right', icon: AlignRight }].map(({ v, icon: Icon }) => (
                                    <button key={v} onClick={() => onChange({ ...widget, textAlign: v })}
                                        className={`flex-1 py-2 rounded-lg border transition flex items-center justify-center ${(widget.textAlign || 'left') === v
                                            ? 'bg-indigo-500 border-indigo-500 text-white'
                                            : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-400'}`}>
                                        <Icon className="w-3.5 h-3.5" />
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Text Color</label>
                            <select value={widget.textColor || 'default'} onChange={(e) => onChange({ ...widget, textColor: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                                <option value="default">Default</option>
                                <option value="muted">Muted gray</option>
                                <option value="indigo">Indigo</option>
                                <option value="green">Green</option>
                                <option value="red">Red</option>
                                <option value="amber">Amber</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Background Style</label>
                            <select value={widget.bgStyle || 'none'} onChange={(e) => onChange({ ...widget, bgStyle: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                                <option value="none">None</option>
                                <option value="info">Info (blue)</option>
                                <option value="warn">Warning (amber)</option>
                                <option value="success">Success (green)</option>
                                <option value="error">Alert (red)</option>
                            </select>
                        </div>
                    </>
                )}

                {/* Chart / data fields (hidden for text notes) */}
                {!isText && (
                    <>
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Data Source</label>
                            <select value={widget.dataSource} onChange={(e) => onChange({ ...widget, dataSource: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                                {DATA_SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                {widget.type === 'kpi_card' && <option value="kpi">KPI Summary</option>}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date Range</label>
                            <select value={widget.dateRange || '30d'} onChange={(e) => onChange({ ...widget, dateRange: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                                {DATE_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        {widget.type === 'kpi_card' && (
                            <div className="sm:col-span-2">
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">KPI Metric</label>
                                <select value={widget.kpiMetric || 'visitors'} onChange={(e) => onChange({ ...widget, kpiMetric: e.target.value, dataSource: 'kpi' })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                                    {KPI_METRICS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                                </select>
                            </div>
                        )}
                    </>
                )}

                {/* Width selector for all types */}
                <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Width</label>
                    <div className="flex gap-2">
                        {[
                            { v: 'full', l: '▬▬ Full width' },
                            { v: 'half', l: '▬ Half width' },
                            { v: 'third', l: '▭ One third' },
                        ].map(({ v, l }) => (
                            <button key={v} onClick={() => onChange({ ...widget, size: v })}
                                className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition ${(widget.size || 'full') === v
                                    ? 'bg-indigo-500 border-indigo-500 text-white'
                                    : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-400'}`}>
                                {l}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Dashboard Builder Tab ─────────────────────────────────────────────────────

function DashboardBuilderTab() {
    const siteId = useSiteStore((s) => s.siteId);
    const theme = useThemeStore((s) => s.theme);
    const isDark = theme === 'dark';

    const [dashboards, setDashboards] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [view, setView] = useState('list');   // 'list' | 'edit' | 'view'
    const [current, setCurrent] = useState(null);
    const [saving, setSaving] = useState(false);
    const [dashName, setDashName] = useState('');
    const [widgets, setWidgets] = useState([]);
    const [isShared, setIsShared] = useState(false);
    // canvas state
    const [layoutMap, setLayoutMap] = useState({});
    const [snapEnabled, setSnapEnabled] = useState(true);
    const [capturingId, setCapturingId] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [resizeInfo, setResizeInfo] = useState(null);
    const [showAddPopover, setShowAddPopover] = useState(false);
    // dirty state + autosave
    const [isDirty, setIsDirty] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const autosaveRef = useRef(null);
    const widgetsRef = useRef(widgets);
    const layoutMapRef = useRef(layoutMap);
    const dashNameRef = useRef(dashName);
    useEffect(() => { widgetsRef.current = widgets; }, [widgets]);
    useEffect(() => { layoutMapRef.current = layoutMap; }, [layoutMap]);
    useEffect(() => { dashNameRef.current = dashName; }, [dashName]);

    // ensure all widgets in view mode have layout entries
    useEffect(() => {
        if (view !== 'view' || !widgets.length) return;
        const missing = widgets.filter(w => !layoutMap[w.id]);
        if (!missing.length) return;
        setLayoutMap(prev => buildPixelLayout(widgets, prev, 900));
    }, [view, widgets]); // eslint-disable-line react-hooks/exhaustive-deps

    // autosave: debounce 3s after any dirty layout change
    useEffect(() => {
        if (!isDirty || !current?.id || isShared || view !== 'view') return;
        clearTimeout(autosaveRef.current);
        autosaveRef.current = setTimeout(async () => {
            try {
                const cur = widgetsRef.current;
                const lm = layoutMapRef.current;
                const name = dashNameRef.current;
                const widgetsToSave = cur.map(w => lm[w.id] ? { ...w, px: lm[w.id] } : w);
                await reportingAPI.updateDashboard(current.siteId || siteId, current.id, { name, widgets: widgetsToSave });
                setIsDirty(false);
                toast.success('Auto-saved', { duration: 1800, icon: '💾', position: 'bottom-right' });
            } catch { /* silent */ }
        }, 3000);
        return () => clearTimeout(autosaveRef.current);
    }, [isDirty, current, isShared, view, siteId]);

    // drag-to-reorder state
    const dragIndex = useRef(null);
    const [dragOver, setDragOver] = useState(null);

    // ── on mount: detect shared-dashboard URL param
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tok = params.get('dash');
        if (tok) {
            const parsed = decodeSharePayload(tok);
            if (parsed?.widgets) {
                setDashName(parsed.name || 'Shared Dashboard');
                setWidgets(parsed.widgets);
                setLayoutMap(buildPixelLayout(parsed.widgets, {}, 900));
                setIsShared(true);
                setView('view');
            }
        }
    }, []);

    const loadList = useCallback(async () => {
        try {
            const res = await reportingAPI.listDashboards(siteId);
            setDashboards(res?.data || []);
        } catch { /* empty */ }
        setLoaded(true);
    }, [siteId]);

    useEffect(() => { loadList(); }, [loadList]);

    // ── helpers ──────────────────────────────────────────────────────────────

    const parseWidgets = (w) => Array.isArray(w) ? w : (typeof w === 'string' ? JSON.parse(w) : []);

    const startCreate = () => {
        setCurrent(null); setIsShared(false);
        setDashName('My Dashboard');
        const ws = [{ id: uid(), type: 'area_chart', title: 'Traffic Over Time', dataSource: 'traffic', dateRange: '30d', size: 'full' }];
        setWidgets(ws);
        setLayoutMap(buildPixelLayout(ws, {}, 900));
        setView('edit');
    };

    const startEdit = (dash) => {
        setCurrent(dash); setIsShared(false);
        setDashName(dash.name);
        const ws = parseWidgets(dash.widgets);
        setWidgets(ws);
        setLayoutMap(buildPixelLayout(ws, {}, 900));
        setView('edit');
    };

    const startView = (dash) => {
        setCurrent(dash); setIsShared(false);
        const ws = parseWidgets(dash.widgets);
        setWidgets(ws);
        setLayoutMap(buildPixelLayout(ws, {}, 900));
        setView('view');
    };

    const addWidget = (type = 'bar_chart') => {
        const defaults = type === 'text_note'
            ? { id: uid(), type: 'text_note', title: 'Note', content: '## Your Heading\nAdd your paragraph here.', size: 'full', fontSize: 'base', textAlign: 'left', textColor: 'default', bgStyle: 'none' }
            : { id: uid(), type, title: 'New Widget', dataSource: 'top_pages', dateRange: '30d', size: 'half' };
        setWidgets(ws => [...ws, defaults]);
    };

    // canvas-mode quick-add
    const addWidgetToCanvas = (type) => {
        const id = uid();
        const isText = type === 'text_note';
        const newW = isText
            ? { id, type: 'text_note', title: 'Note', content: '## Heading\nYour text here.', size: 'full', fontSize: 'base', textAlign: 'left', textColor: 'default', bgStyle: 'none' }
            : { id, type, title: WIDGET_TYPES.find(t => t.key === type)?.label || 'New Widget', dataSource: 'top_pages', dateRange: '30d', size: 'half' };
        const meta = WIDGET_PX[type] || WIDGET_PX.area_chart;
        setWidgets(ws => [...ws, newW]);
        setLayoutMap(prev => {
            const maxY = Object.values(prev).reduce((m, l) => Math.max(m, l.y + l.h), 0);
            return { ...prev, [id]: { x: 16, y: maxY + 16, w: Math.min(meta.defaultW, 640), h: meta.defaultH } };
        });
    };

    // commit layout from CanvasEngine
    const handleLayoutChange = (newMap) => {
        setLayoutMap(newMap);
        setWidgets(ws => ws.map(w => newMap[w.id] ? { ...w, px: newMap[w.id] } : w));
        setIsDirty(true);
    };

    // html2canvas — capture a single widget card and download as PNG
    // (still available for the per-widget camera button on the canvas)
    const captureWidget = useCallback(async (id) => {
        const el = document.getElementById(`canvas-widget-${id}`);
        if (!el) { toast.error('Widget not found'); return; }
        setCapturingId(id);
        const toastId = toast.loading('Capturing…');
        try {
            // SVG swap pipeline: replace Recharts SVGs with serialized data URLs
            const svgEls = [...el.querySelectorAll('svg.recharts-surface, svg[class*="recharts"]')];
            const swaps = [];
            for (const svg of svgEls) {
                const parent = svg.parentElement;
                if (!parent) continue;
                const rect = svg.getBoundingClientRect();
                if (!rect.width || !rect.height) continue;
                const clone = svg.cloneNode(true);
                clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
                const img = document.createElement('img');
                img.src = dataUrl;
                img.style.cssText = `display:block;width:${rect.width}px;height:${rect.height}px;position:absolute;top:0;left:0`;
                parent.style.position = 'relative';
                parent.appendChild(img);
                svg.style.visibility = 'hidden';
                swaps.push({ svg, img });
                await Promise.race([
                    new Promise(r => { img.onload = r; img.onerror = r; }),
                    new Promise(r => setTimeout(r, 300)),
                ]);
            }
            try {
                const canvas = await html2canvas(el, {
                    scale: 2, useCORS: true, allowTaint: true, logging: false,
                    backgroundColor: isDark ? '#111827' : '#ffffff',
                    ignoreElements: (n) => n.classList?.contains('no-capture') || n.classList?.contains('canvas-resize-handle'),
                });
                canvas.toBlob((blob) => {
                    if (!blob) { toast.error('Capture failed', { id: toastId }); return; }
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const title = widgets.find(w => w.id === id)?.title || 'widget';
                    a.href = url; a.download = `${title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    toast.success('Widget saved as PNG', { id: toastId });
                }, 'image/png');
            } finally {
                for (const { svg, img } of swaps) { svg.style.visibility = ''; img.remove(); }
            }
        } catch (e) {
            console.error('Capture error:', e);
            toast.error('Capture failed', { id: toastId });
        } finally {
            setCapturingId(null);
        }
    }, [isDark, widgets]);

    // ── edit-view drag-to-reorder handlers ───────────────────────────────────
    const updateWidget = (id, patch) => setWidgets(ws => ws.map(w => w.id === id ? patch : w));
    const removeWidget = (id) => setWidgets(ws => ws.filter(w => w.id !== id));
    const moveWidget = (from, to) => {
        if (to < 0 || to >= widgets.length) return;
        setWidgets(ws => { const a = [...ws]; a.splice(to, 0, a.splice(from, 1)[0]); return a; });
    };
    const onDragStart = (i) => { dragIndex.current = i; };
    const onDragOver = (e, i) => { e.preventDefault(); setDragOver(i); };
    const onDrop = (i) => {
        const from = dragIndex.current;
        if (from != null && from !== i) moveWidget(from, i);
        dragIndex.current = null; setDragOver(null);
    };
    const onDragEnd = () => { dragIndex.current = null; setDragOver(null); };

    // ── save / delete ────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!dashName.trim()) return toast.error('Dashboard name is required');
        if (!widgets.length) return toast.error('Add at least one widget');
        setSaving(true);
        try {
            if (current?.id) {
                await reportingAPI.updateDashboard(siteId, current.id, { name: dashName, widgets });
                toast.success('Dashboard updated');
            } else {
                await reportingAPI.createDashboard(siteId, { name: dashName, widgets });
                toast.success('Dashboard created');
            }
            loadList(); setView('list');
        } catch (err) { toast.error(err.message || 'Failed to save'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        try { await reportingAPI.deleteDashboard(siteId, id); toast.success('Deleted'); loadList(); }
        catch (err) { toast.error(err.message || 'Failed'); }
    };

    // ── share / export ───────────────────────────────────────────────────────
    const handleShare = (name, wgs) => {
        const token = encodeSharePayload(name, wgs);
        const url = `${window.location.origin}${window.location.pathname}?dash=${token}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => toast.success('Share link copied to clipboard!'));
        } else {
            prompt('Copy this link:', url);
        }
    };

    const handleExportJSON = (name, wgs) => {
        dlFile(JSON.stringify({ name, widgets: wgs }, null, 2), `${name.replace(/\s+/g, '-').toLowerCase()}.dashboard.json`, 'application/json');
        toast.success('Dashboard exported as JSON');
    };

    // ── size → col span (edit view only) ─────────────────────────────────────
    const sizeClass = (s) => ({ full: 'md:col-span-3', half: 'md:col-span-1', third: 'md:col-span-1' }[s] || 'md:col-span-3');

    // ──────────────────────────────────────────────────────────────────────────
    // LIST VIEW
    // ──────────────────────────────────────────────────────────────────────────
    if (view === 'list') return (
        <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Custom Dashboards</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Build, share and export fully custom chart layouts</p>
                </div>
                <button onClick={startCreate}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600 transition">
                    <Plus className="w-4 h-4" /> New Dashboard
                </button>
            </div>

            {/* Widget type palette */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {WIDGET_TYPES.map(({ key, label, icon: Icon, desc }) => (
                    <div key={key} className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-center">
                        <div className="flex justify-center mb-1.5">
                            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
                                <Icon className="w-4 h-4 text-indigo-500" />
                            </div>
                        </div>
                        <p className="text-xs font-medium text-gray-900 dark:text-white">{label}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight hidden sm:block">{desc}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                {!loaded && <div className="animate-pulse h-32 m-4 bg-gray-100 dark:bg-gray-800 rounded-lg" />}
                {loaded && !dashboards.length && (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 flex items-center justify-center mb-5 border border-indigo-100 dark:border-indigo-900/50">
                            <LayoutGrid className="w-7 h-7 text-indigo-400" />
                        </div>
                        <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">No dashboards yet</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm leading-relaxed mb-6">
                            Build custom report layouts by combining KPI cards, charts, and tables. Share as links or export as PNG.
                        </p>
                        <button onClick={startCreate} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition shadow-sm shadow-indigo-500/25">
                            <Plus className="w-4 h-4" /> Create your first dashboard
                        </button>
                    </div>
                )}
                {loaded && dashboards.length > 0 && (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {dashboards.map((d) => {
                            const ws = parseWidgets(d.widgets);
                            return (
                                <div key={d.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 dark:text-white">{d.name}</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                            {ws.length} widget{ws.length !== 1 ? 's' : ''} &middot; {new Date(d.created_at).toLocaleDateString()}
                                        </p>
                                        <div className="flex gap-1 mt-1.5 flex-wrap">
                                            {ws.slice(0, 4).map(w => (
                                                <span key={w.id} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full">{w.title}</span>
                                            ))}
                                            {ws.length > 4 && <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-full">+{ws.length - 4} more</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 ml-4 shrink-0">
                                        <button onClick={() => handleShare(d.name, ws)} title="Copy share link"
                                            className="p-2 text-gray-400 hover:text-green-500 transition rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20">
                                            <Share2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleExportJSON(d.name, ws)} title="Export JSON"
                                            className="p-2 text-gray-400 hover:text-indigo-500 transition rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => startView(d)} title="View"
                                            className="p-2 text-gray-400 hover:text-indigo-500 transition rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => startEdit(d)} title="Edit"
                                            className="p-2 text-gray-400 hover:text-indigo-500 transition rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(d.id)} title="Delete"
                                            className="p-2 text-gray-400 hover:text-red-500 transition rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );

    // ──────────────────────────────────────────────────────────────────────────
    // EDIT VIEW — drag-to-reorder, text notes, add widget buttons
    // ──────────────────────────────────────────────────────────────────────────
    if (view === 'edit') return (
        <div className="space-y-5">
            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
                <button onClick={() => setView('list')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition shrink-0">
                    <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
                <input value={dashName} onChange={(e) => setDashName(e.target.value)} placeholder="Dashboard name"
                    className="flex-1 min-w-0 text-lg font-semibold bg-transparent border-0 border-b-2 border-gray-200 dark:border-gray-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none text-gray-900 dark:text-white pb-1 transition" />
                <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleShare(dashName, widgets)} title="Copy share link"
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:border-green-400 hover:text-green-600 transition">
                        <Share2 className="w-3.5 h-3.5" /> Share
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600 disabled:opacity-50 transition">
                        <Check className="w-4 h-4" />
                        {saving ? 'Saving…' : current ? 'Update' : 'Save'}
                    </button>
                </div>
            </div>

            {/* Drag tip */}
            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                <Grip className="w-3.5 h-3.5" />
                Drag the <strong>⠿</strong> handle on any widget to reorder, or use ↑ ↓ arrows. Drop anywhere to rearrange your layout.
            </p>

            {/* Widget forms */}
            <div className="space-y-3">
                {widgets.map((w, i) => (
                    <div
                        key={w.id}
                        draggable
                        onDragStart={() => onDragStart(i)}
                        onDragOver={(e) => onDragOver(e, i)}
                        onDrop={() => onDrop(i)}
                        onDragEnd={onDragEnd}
                        className={`transition-all duration-150 ${dragOver === i && dragIndex.current !== i ? 'ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-gray-900 rounded-xl opacity-80' : ''}`}
                    >
                        <WidgetConfigForm
                            widget={w}
                            onChange={(patch) => updateWidget(w.id, patch)}
                            onRemove={() => removeWidget(w.id)}
                            onMoveUp={() => moveWidget(i, i - 1)}
                            onMoveDown={() => moveWidget(i, i + 1)}
                        />
                    </div>
                ))}
            </div>

            {/* Add buttons */}
            <div className="flex gap-3">
                <button onClick={() => addWidget('bar_chart')}
                    className="flex-1 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-400 dark:text-gray-500 hover:border-indigo-400 hover:text-indigo-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition flex items-center justify-center gap-2 text-sm font-medium">
                    <Plus className="w-4 h-4" /> Add Chart Widget
                </button>
                <button onClick={() => addWidget('text_note')}
                    className="flex-1 py-3 border-2 border-dashed border-amber-200 dark:border-amber-800 rounded-xl text-amber-400 dark:text-amber-500 hover:border-amber-400 hover:text-amber-500 dark:hover:border-amber-400 dark:hover:text-amber-400 transition flex items-center justify-center gap-2 text-sm font-medium">
                    <StickyNote className="w-4 h-4" /> Add Text / Note
                </button>
            </div>
        </div>
    );

    // ──────────────────────────────────────────────────────────────────────────
    // VIEW MODE — freeform pixel canvas engine
    // ──────────────────────────────────────────────────────────────────────────
    if (view === 'view') return (
        <div className="space-y-4" onClick={() => { setSelectedId(null); setShowAddPopover(false); }}>
            {/* ── Toolbar ── */}
            <div className="flex items-center justify-between flex-wrap gap-3 no-print" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                    {!isShared && (
                        <button onClick={() => setView('list')}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                            <ChevronRight className="w-5 h-5 rotate-180" />
                        </button>
                    )}
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">{dashName}</h2>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            {isShared ? 'Shared view — read only' : `${widgets.length} widget${widgets.length !== 1 ? 's' : ''} · click to select, drag to move, handles to resize`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* ── Snap to Grid toggle ── */}
                    {!isShared && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setSnapEnabled(v => !v); }}
                            title={snapEnabled
                                ? 'Snap to Grid: ON — widgets snap to a 20px grid. Click to switch to freeform pixel placement.'
                                : 'Snap to Grid: OFF — freeform placement. Click to enable grid snapping.'}
                            className={`group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${snapEnabled
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400'
                                : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300'
                                }`}>
                            <LayoutGrid className="w-3.5 h-3.5" />
                            Snap to Grid
                            {snapEnabled && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 ml-0.5" />}
                        </button>
                    )}

                    {/* ── Add Widget popover ── */}
                    {!isShared && (
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowAddPopover(v => !v); }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition shadow-sm shadow-indigo-500/20"
                            >
                                <Plus className="w-4 h-4" />
                                Add Widget
                                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                            </button>
                            {showAddPopover && (
                                <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl shadow-gray-900/10 dark:shadow-black/30 p-2 z-50"
                                    onClick={e => e.stopPropagation()}>
                                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 pt-1 pb-2">Choose widget type</p>
                                    <div className="grid grid-cols-3 gap-1">
                                        {WIDGET_TYPES.map(({ key, label, icon: Icon }) => (
                                            <button key={key}
                                                onClick={() => { addWidgetToCanvas(key); setShowAddPopover(false); }}
                                                className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition group/add"
                                            >
                                                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover/add:bg-indigo-100 dark:group-hover/add:bg-indigo-900/30 transition">
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                <span className="text-xs font-medium">{label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Secondary actions ── */}
                    <div className="flex items-center gap-1 border border-gray-200 dark:border-gray-700 rounded-lg p-0.5">
                        <button onClick={() => handleShare(dashName, widgets)} title="Copy share link"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-green-600 dark:hover:text-green-400 text-xs font-medium transition">
                            <Share2 className="w-3.5 h-3.5" /> Share
                        </button>
                        <button onClick={() => setShowExportModal(true)} title="Export / Print dashboard"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-medium transition">
                            <Download className="w-3.5 h-3.5" /> Export
                        </button>
                    </div>

                    {!isShared && current && (
                        <button onClick={() => startEdit(current)}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:border-indigo-400 hover:text-indigo-500 transition">
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                    )}
                    {!isShared && (
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                if (!current?.id) {
                                    toast.error('Open a saved dashboard first, then save the layout from Edit view.');
                                    return;
                                }
                                setSaving(true);
                                clearTimeout(autosaveRef.current);
                                try {
                                    // Always embed current layoutMap positions before saving
                                    const widgetsToSave = widgets.map(w => layoutMap[w.id] ? { ...w, px: layoutMap[w.id] } : w);
                                    await reportingAPI.updateDashboard(siteId, current.id, { name: dashName, widgets: widgetsToSave });
                                    setWidgets(widgetsToSave);
                                    setIsDirty(false);
                                    toast.success('Layout saved');
                                } catch { toast.error('Save failed'); }
                                finally { setSaving(false); }
                            }}
                            disabled={saving}
                            title={isDirty ? 'Unsaved layout changes — click to save' : 'Layout is saved'}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition shadow-sm ${isDirty
                                ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-indigo-500/20'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                                } disabled:opacity-50`}>
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {saving ? 'Saving…' : 'Save Layout'}
                            {isDirty && !saving && <span className="w-2 h-2 rounded-full bg-amber-400 shadow-sm" title="Unsaved changes" />}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Canvas ── */}
            <CanvasEngine
                widgets={widgets}
                layoutMap={layoutMap}
                onLayoutChange={handleLayoutChange}
                isShared={isShared}
                siteId={siteId}
                isDark={isDark}
                selectedId={selectedId}
                onSelect={(id) => { setSelectedId(id); setShowAddPopover(false); }}
                capturingId={capturingId}
                onCapture={captureWidget}
                onDuplicate={(w) => {
                    const newW = { ...w, id: uid() };
                    setWidgets(ws => [...ws, newW]);
                    setLayoutMap(prev => {
                        const src = prev[w.id];
                        const maxY = Object.values(prev).reduce((m, l) => Math.max(m, l.y + l.h), 0);
                        return { ...prev, [newW.id]: { x: src?.x ?? 16, y: maxY + 16, w: src?.w ?? 400, h: src?.h ?? 300 } };
                    });
                }}
                onRemove={(id) => {
                    setWidgets(ws => ws.filter(x => x.id !== id));
                    setLayoutMap(prev => { const n = { ...prev }; delete n[id]; return n; });
                    setSelectedId(null);
                }}
                resizeInfo={resizeInfo}
                onResizeInfo={setResizeInfo}
                snapEnabled={snapEnabled}
            />

            {/* ── Widget config panel (right-side drawer) ── */}
            {selectedId && !isShared && (() => {
                const selW = widgets.find(x => x.id === selectedId);
                if (!selW) return null;
                return (
                    <WidgetConfigPanel
                        key={selectedId}
                        widget={selW}
                        onUpdate={(updated) => {
                            setWidgets(ws => ws.map(x => x.id === updated.id ? updated : x));
                            setIsDirty(true);
                        }}
                        onClose={() => setSelectedId(null)}
                    />
                );
            })()}

            {/* ── Export modal ── */}
            {showExportModal && (
                <ExportModal
                    widgets={widgets}
                    layoutMap={layoutMap}
                    dashName={dashName}
                    isDark={isDark}
                    onClose={() => setShowExportModal(false)}
                />
            )}
        </div>
    );

    return null;
}

// ── Annotations Tab ───────────────────────────────────────────────────────────

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
                {!loading && !data?.length && <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No annotations yet. Mark important events on your analytics timeline.</p>}
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

// ── Scheduled Reports Tab ─────────────────────────────────────────────────────

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

// ── Data Export Tab ───────────────────────────────────────────────────────────

function DataExportTab() {
    const siteId = useSiteStore((s) => s.siteId);
    const [exporting, setExporting] = useState(null);
    const [dateRange, setDateRange] = useState('30d');
    const [format, setFormat] = useState('csv');

    const DATASETS = [
        { key: 'kpi', label: 'KPI Summary', icon: Layers, desc: 'Sessions, pageviews, bounce rate, avg duration', fetch: () => analyticsAPI.getKPIs(siteId, dateRange) },
        { key: 'traffic', label: 'Traffic Over Time', icon: FileText, desc: 'Daily visitors & sessions time-series', fetch: () => analyticsAPI.getTraffic(siteId, dateRange) },
        { key: 'pages', label: 'Top Pages', icon: FileSpreadsheet, desc: 'Most visited pages with view counts', fetch: () => analyticsAPI.getTopPages(siteId, dateRange, 100) },
        { key: 'sources', label: 'Traffic Sources', icon: Globe, desc: 'Referrer & UTM source breakdown', fetch: () => analyticsAPI.getSources(siteId, dateRange) },
        { key: 'devices', label: 'Devices', icon: Layers, desc: 'Browser, OS and device type distribution', fetch: () => analyticsAPI.getDevices(siteId, dateRange) },
        { key: 'countries', label: 'Countries', icon: Globe, desc: 'Visitor geographic distribution', fetch: () => analyticsAPI.getCountries(siteId, dateRange, 100) },
        { key: 'sessions', label: 'Sessions', icon: FileText, desc: 'Session-level data with duration & pages', fetch: () => analyticsAPI.getSessions(siteId, dateRange) },
        { key: 'utm', label: 'UTM Performance', icon: FileSpreadsheet, desc: 'Campaign, medium & source UTM attribution', fetch: () => analyticsAPI.getUTM(siteId, dateRange) },
    ];

    const handleExport = useCallback(async (dataset) => {
        setExporting(dataset.key);
        try {
            const raw = await dataset.fetch();
            const rows = normalise(raw);
            const date = new Date().toISOString().split('T')[0];
            const base = `insighttrack-${dataset.key}-${dateRange}-${date}`;
            format === 'json'
                ? dlFile(JSON.stringify(rows, null, 2), `${base}.json`, 'application/json')
                : dlFile(toCSV(rows), `${base}.csv`, 'text/csv');
            toast.success(`${dataset.label} exported as ${format.toUpperCase()}`);
        } catch (err) {
            toast.error(err.message || 'Export failed');
        } finally {
            setExporting(null);
        }
    }, [siteId, dateRange, format]);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Date range:</span>
                    <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                        {DATE_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Format:</span>
                    <div className="flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden text-sm">
                        {['csv', 'json'].map((f) => (
                            <button key={f} onClick={() => setFormat(f)}
                                className={`px-3 py-1.5 font-medium transition ${format === f
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                                {f.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DATASETS.map((ds) => {
                    const Icon = ds.icon;
                    return (
                        <div key={ds.key} className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 shrink-0">
                                    <Icon className="w-4 h-4 text-indigo-500" />
                                </div>
                                <div>
                                    <div className="font-medium text-gray-900 dark:text-white text-sm">{ds.label}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ds.desc}</div>
                                </div>
                            </div>
                            <button onClick={() => handleExport(ds)} disabled={exporting === ds.key}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600 disabled:opacity-50 transition shrink-0 ml-3">
                                <Download className="w-3.5 h-3.5" />
                                {exporting === ds.key ? '…' : format.toUpperCase()}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Reporting() {
    const [activeTab, setActiveTab] = useState('builder');
    const { focusMode, toggleFocusMode } = useFocusModeStore();

    const TABS = [
        { key: 'builder', label: 'Dashboard Builder', icon: LayoutGrid },
        { key: 'annotations', label: 'Annotations', icon: Calendar },
        { key: 'reports', label: 'Scheduled Reports', icon: Mail },
        { key: 'export', label: 'Data Export', icon: Download },
    ];

    return (
        <div className="space-y-6">
            {/* Header — hidden in focus mode */}
            {!focusMode && (
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                        <LayoutDashboard className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reporting</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Custom dashboards, annotations, scheduled reports, and data exports</p>
                    </div>
                </div>
            )}

            {/* PageNote — hidden in focus mode */}
            {!focusMode && (
                <PageNote
                    title="What is Reporting?"
                    summary="Build custom chart dashboards with drag-to-reorder widgets, text notes, shareable links, and PDF export."
                    details={[
                        { label: 'Dashboard Builder', text: 'Drag widgets to reorder them. Add chart widgets (area, bar, pie, table, KPI) or text/note widgets with headings and callouts. Save to the backend. Share via link or export as JSON / PDF.' },
                        { label: 'Annotations', text: 'Mark important events on your timeline (deployments, campaigns, incidents).' },
                        { label: 'Scheduled Reports', text: 'Configure automatic weekly or monthly email digests with key metrics for your team.' },
                        { label: 'Data Export', text: 'Download any dataset as CSV or JSON. Choose date range and format before exporting.' },
                    ]}
                    businessTip="Share a dashboard link with stakeholders — they get a read-only live view with all your chosen charts. No login required for shared links."
                    devTip="Share URLs encode the full dashboard config as base64 in ?dash= query param. Widgets are rendered client-side, so shared links always show live data."
                />
            )}

            {/* Tab bar + Focus toggle */}
            <div className="flex items-center gap-2">
                <div className="flex-1 flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto">
                    {TABS.map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === key
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                            <Icon className="w-4 h-4" />
                            {label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={toggleFocusMode}
                    title={focusMode ? 'Show header & info panel' : 'Hide header — more space for dashboard'}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${focusMode
                        ? 'bg-indigo-500 border-indigo-500 text-white hover:bg-indigo-600'
                        : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 hover:border-indigo-400 hover:text-indigo-500'
                        }`}
                >
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${focusMode ? '-rotate-90' : 'rotate-90'}`} />
                    {focusMode ? 'Show' : 'Focus'}
                </button>
            </div>

            {activeTab === 'builder' && <DashboardBuilderTab />}
            {activeTab === 'annotations' && <AnnotationsTab />}
            {activeTab === 'reports' && <ScheduledReportsTab />}
            {activeTab === 'export' && <DataExportTab />}
        </div>
    );
}
