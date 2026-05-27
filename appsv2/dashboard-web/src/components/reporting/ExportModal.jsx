/**
 * ExportModal — InsightTrack Professional Export Engine
 *
 * Architecture:
 *   Dashboard Canvas (live Recharts SVGs)
 *     → SVG Serializer (svgToDataURL)
 *     → Per-widget PNG Snapshots (html2canvas + SVG swap)
 *     → PrintRenderTree (portal, CSS grid, flow layout)
 *       → window.print()  (PDF via browser)
 *       → html2canvas full composite (PNG download)
 *
 * Root-cause fixes:
 *   1. Empty widget boxes: html2canvas can't capture SVG natively.
 *      Fix: serialize each <svg.recharts-surface> to data:image/svg+xml,
 *      replace with <img> before html2canvas, restore after.
 *   2. Broken print layout: widgets use position:absolute.
 *      Fix: PrintRenderTree uses normal CSS flow grid — completely separate DOM.
 *   3. Dark-mode bleeds into print: PrintRenderTree forces light/dark theme.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Download, Printer, FileJson, FileSpreadsheet, ChevronDown,
    Loader2, Check, AlertCircle, Monitor, Moon, Sun, Layout,
    FileText, Image, Layers,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { analyticsAPI } from '../../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// SVG → data URL (inline all attributes so html2canvas sees a proper image)
// ─────────────────────────────────────────────────────────────────────────────
function svgToDataURL(svgEl) {
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    // Inline critical CSS so the serialized SVG carries its own font/color info
    const styles = window.getComputedStyle(svgEl);
    clone.setAttribute('style', `font-family:${styles.fontFamily};font-size:${styles.fontSize}`);
    const serialized = new XMLSerializer().serializeToString(clone);
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized);
}

// ─────────────────────────────────────────────────────────────────────────────
// Capture a single widget DOM element as PNG data URL
// Swaps every Recharts SVG → <img src="data:image/svg+xml"> before capture,
// restores originals in the finally block — zero visual flicker.
// ─────────────────────────────────────────────────────────────────────────────
async function captureElementAsPNG(el, isDark, scale = 2) {
    if (!el) return null;

    const svgEls = [...el.querySelectorAll('svg.recharts-surface, svg[class*="recharts"]')];
    const swaps = [];

    for (const svg of svgEls) {
        const parent = svg.parentElement;
        if (!parent) continue;
        const rect = svg.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;

        const dataUrl = svgToDataURL(svg);
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = `
            display:block;
            width:${rect.width}px;
            height:${rect.height}px;
            position:absolute;
            top:0; left:0;
        `;
        parent.style.position = 'relative';
        parent.appendChild(img);
        svg.style.visibility = 'hidden';
        swaps.push({ parent, svg, img });
        // Wait for img to decode — max 300ms
        await Promise.race([
            new Promise(r => { img.onload = r; img.onerror = r; }),
            new Promise(r => setTimeout(r, 300)),
        ]);
    }

    let dataURL = null;
    try {
        const canvas = await html2canvas(el, {
            scale,
            useCORS: true,
            allowTaint: true,
            backgroundColor: isDark ? '#111827' : '#ffffff',
            logging: false,
            imageTimeout: 3000,
            ignoreElements: (node) =>
                node.classList?.contains('no-capture') ||
                node.classList?.contains('canvas-resize-handle') ||
                node.dataset?.noCapture === 'true',
        });
        dataURL = canvas.toDataURL('image/png');
    } finally {
        for (const { svg, img } of swaps) {
            svg.style.visibility = '';
            img.remove();
        }
    }
    return dataURL;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build snapshots map: { [widgetId]: pngDataURL }
// Called once before print/export, shows progress via onProgress(0-100)
// ─────────────────────────────────────────────────────────────────────────────
async function buildSnapshots(widgets, isDark, onProgress) {
    const snapshots = {};
    for (let i = 0; i < widgets.length; i++) {
        const w = widgets[i];
        const el = document.getElementById(`canvas-widget-${w.id}`);
        if (el) {
            snapshots[w.id] = await captureElementAsPNG(el, isDark, 2);
        }
        onProgress(Math.round(((i + 1) / widgets.length) * 80));
        // Yield to main thread between captures
        await new Promise(r => setTimeout(r, 16));
    }
    return snapshots;
}

// ─────────────────────────────────────────────────────────────────────────────
// dlFile — trigger browser file download
// ─────────────────────────────────────────────────────────────────────────────
function dlFile(content, name, mime) {
    const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([content], { type: mime })),
        download: name,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

function toCSV(rows) {
    if (!rows?.length) return '';
    const keys = Object.keys(rows[0]);
    const esc = (v) => { const s = String(v ?? ''); return (s.includes(',') || s.includes('"')) ? `"${s.replace(/"/g, '""')}"` : s; };
    return [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
}

function normalise(raw) {
    const d = raw?.data ?? raw;
    return Array.isArray(d) ? d : (d && typeof d === 'object') ? [d] : [];
}

async function fetchWidgetData(siteId, widget) {
    if (!siteId || !widget || widget.type === 'text_note') return [];
    const source = widget.dataSource || (widget.type === 'kpi_card' ? 'kpi' : 'top_pages');
    const dateRange = widget.dateRange || '30d';
    switch (source) {
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

// ─────────────────────────────────────────────────────────────────────────────
// PrintLayout — the dedicated print DOM tree
// Rendered into a portal at #insighttrack-print-root.
// CSS: @media print { #root { display:none } #insighttrack-print-root { display:block } }
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_SIZES = {
    a4: { label: 'A4 Portrait', width: '210mm', aspect: 1.414 },
    a4l: { label: 'A4 Landscape', width: '297mm', aspect: 0.707 },
    letter: { label: 'Letter Portrait', width: '216mm', aspect: 1.294 },
    wide: { label: 'Widescreen 16:9', width: '297mm', aspect: 0.5625 },
};

function PrintLayout({ dashName, snapshots, widgets, layoutMap, exportTheme, pageSize, showCover, showTimestamp, showBranding }) {
    const ts = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
    const isLight = exportTheme !== 'dark';

    const bg = isLight ? '#f8fafc' : '#0f172a';
    const surface = isLight ? '#ffffff' : '#1e293b';
    const border = isLight ? '#e5e7eb' : '#334155';
    const text = isLight ? '#111827' : '#f1f5f9';
    const muted = isLight ? '#6b7280' : '#94a3b8';
    const accent = '#6366f1';

    // Sort by Y then X from layoutMap
    const sorted = [...widgets].sort((a, b) => {
        const la = layoutMap[a.id] || a.px || {};
        const lb = layoutMap[b.id] || b.px || {};
        return (la.y || 0) !== (lb.y || 0)
            ? (la.y || 0) - (lb.y || 0)
            : (la.x || 0) - (lb.x || 0);
    });

    // Split KPI cards into groups of 4, others go full width or half width
    const kpis = sorted.filter(w => w.type === 'kpi_card');
    const rest = sorted.filter(w => w.type !== 'kpi_card');

    return (
        <div style={{ background: bg, minHeight: '100%', fontFamily: 'Inter,-apple-system,BlinkMacSystemFont,sans-serif', color: text }}>

            {/* ── Cover Page ────────────────────────────────────────────── */}
            {showCover && (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '72px 80px',
                    pageBreakAfter: 'always',
                    breakAfter: 'page',
                    background: isLight ? '#fff' : '#0f172a',
                    borderBottom: `1px solid ${border}`,
                }}>
                    {/* Header stripe */}
                    <div style={{ height: 4, background: `linear-gradient(90deg, ${accent}, #8b5cf6, #06b6d4)`, borderRadius: 2, marginBottom: 64 }} />

                    {/* Title block */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent, marginBottom: 16 }}>
                            Analytics Report
                        </p>
                        <h1 style={{ fontSize: 48, fontWeight: 700, lineHeight: 1.1, color: text, marginBottom: 20, letterSpacing: '-0.02em' }}>
                            {dashName}
                        </h1>
                        <p style={{ fontSize: 16, color: muted, maxWidth: 560, lineHeight: 1.6 }}>
                            Comprehensive analytics dashboard export containing {widgets.length} widget{widgets.length !== 1 ? 's' : ''} across traffic, engagement, and performance metrics.
                        </p>
                    </div>

                    {/* Footer meta */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 48, borderTop: `1px solid ${border}` }}>
                        <div>
                            {showTimestamp && (
                                <p style={{ fontSize: 13, color: muted, marginBottom: 4 }}>Generated {ts}</p>
                            )}
                            <p style={{ fontSize: 13, color: muted }}>
                                {widgets.length} widgets · InsightTrack Analytics
                            </p>
                        </div>
                        {showBranding && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>I</span>
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: muted }}>InsightTrack</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── KPI Row ────────────────────────────────────────────────── */}
            {kpis.length > 0 && (
                <div style={{ padding: '48px 48px 0' }}>
                    <div style={{ marginBottom: 20 }}>
                        <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent }}>
                            Key Metrics
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(kpis.length, 4)}, 1fr)`, gap: 16, marginBottom: 40 }}>
                        {kpis.map(w => {
                            const snap = snapshots[w.id];
                            return (
                                <div key={w.id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden', breakInside: 'avoid' }}>
                                    {snap
                                        ? <img src={snap} alt={w.title} style={{ width: '100%', display: 'block' }} />
                                        : <div style={{ padding: 20 }}>
                                            <p style={{ fontSize: 11, color: muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{w.title}</p>
                                            <p style={{ fontSize: 28, fontWeight: 700, color: text }}>—</p>
                                        </div>
                                    }
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Chart / Table Widgets ────────────────────────────────── */}
            {rest.length > 0 && (
                <div style={{ padding: '24px 48px 48px' }}>
                    {rest.map((w, idx) => {
                        const snap = snapshots[w.id];
                        const isWide = ['area_chart', 'data_table', 'text_note'].includes(w.type);
                        return (
                            <div key={w.id} style={{
                                marginBottom: 32,
                                breakInside: 'avoid',
                                pageBreakInside: 'avoid',
                            }}>
                                {/* Section divider for non-first items */}
                                {idx > 0 && (
                                    <div style={{ height: 1, background: border, marginBottom: 32 }} />
                                )}

                                {/* Widget header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                    <div style={{ width: 3, height: 18, background: accent, borderRadius: 2 }} />
                                    <h3 style={{ fontSize: 14, fontWeight: 600, color: text, margin: 0 }}>{w.title}</h3>
                                    <span style={{ fontSize: 11, color: muted, padding: '2px 8px', borderRadius: 99, border: `1px solid ${border}` }}>
                                        {w.type?.replace(/_/g, ' ')}
                                    </span>
                                </div>

                                {/* Widget snapshot */}
                                <div style={{
                                    background: surface,
                                    border: `1px solid ${border}`,
                                    borderRadius: 12,
                                    overflow: 'hidden',
                                    boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                                }}>
                                    {snap ? (
                                        <img
                                            src={snap}
                                            alt={w.title}
                                            style={{ width: '100%', display: 'block', maxHeight: isWide ? 'none' : 360, objectFit: 'contain' }}
                                        />
                                    ) : (
                                        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: muted, fontSize: 13 }}>
                                            Chart data unavailable
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Footer ────────────────────────────────────────────────── */}
            <div style={{ padding: '24px 48px', borderTop: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {showTimestamp && <p style={{ fontSize: 11, color: muted }}>Generated {ts}</p>}
                {showBranding && <p style={{ fontSize: 11, color: muted, fontWeight: 600 }}>InsightTrack Analytics</p>}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExportModal — the main UI component
// ─────────────────────────────────────────────────────────────────────────────
const FORMATS = [
    { key: 'pdf', label: 'PDF', icon: FileText, desc: 'Browser print dialog → Save as PDF' },
    { key: 'png', label: 'PNG', icon: Image, desc: 'High-resolution dashboard image' },
    { key: 'json', label: 'JSON', icon: FileJson, desc: 'Raw dashboard configuration' },
    { key: 'csv', label: 'CSV', icon: FileSpreadsheet, desc: 'Widget data as spreadsheet' },
];

const THEMES = [
    { key: 'light', label: 'Light', icon: Sun },
    { key: 'dark', label: 'Dark', icon: Moon },
];

export default function ExportModal({
    widgets,
    layoutMap,
    dashName,
    isDark,
    siteId,
    widgetData,   // optional: { [widgetId]: rawDataArray } for CSV export
    onClose,
}) {
    const [format, setFormat] = useState('pdf');
    const [exportTheme, setExportTheme] = useState(isDark ? 'dark' : 'light');
    const [pageSize, setPageSize] = useState('a4');
    const [showCover, setShowCover] = useState(true);
    const [showTimestamp, setShowTimestamp] = useState(true);
    const [showBranding, setShowBranding] = useState(true);
    const [pngScale, setPngScale] = useState('2');
    const [status, setStatus] = useState('idle');  // idle | building | printing | done | error
    const [progress, setProgress] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');

    // Print portal state
    const [printSnapshots, setPrintSnapshots] = useState(null);
    const [showPrintTree, setShowPrintTree] = useState(false);
    const printRootRef = useRef(null);
    const cancelRef = useRef(false);

    // Ensure portal div exists in body
    useEffect(() => {
        let el = document.getElementById('insighttrack-print-root');
        if (!el) {
            el = document.createElement('div');
            el.id = 'insighttrack-print-root';
            document.body.appendChild(el);
        }
        printRootRef.current = el;
        return () => { /* keep the div — @media print CSS references it */ };
    }, []);

    // Clean up print tree on unmount
    useEffect(() => {
        return () => {
            cancelRef.current = true;
            setShowPrintTree(false);
        };
    }, []);

    const handleExport = useCallback(async () => {
        cancelRef.current = false;
        setStatus('building');
        setProgress(0);
        setErrorMsg('');

        const fileBase = (dashName || 'dashboard').replace(/[^\w\-]/g, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '') || 'dashboard';

        try {
            // ── JSON export (no snapshot needed) ────────────────────────
            if (format === 'json') {
                const payload = JSON.stringify({ name: dashName, widgets }, null, 2);
                dlFile(payload, `${fileBase}.dashboard.json`, 'application/json');
                setStatus('done'); setProgress(100);
                return;
            }

            // ── CSV export (no snapshot needed) ─────────────────────────
            if (format === 'csv') {
                const lines = [];
                for (const w of widgets) {
                    let data = widgetData?.[w.id];
                    if (!data?.length) {
                        try {
                            data = await fetchWidgetData(siteId, w);
                        } catch {
                            data = [];
                        }
                    }
                    if (data?.length) {
                        lines.push(`# ${w.title} (${w.type})`);
                        lines.push(toCSV(data));
                        lines.push('');
                    }
                }
                if (!lines.length) {
                    // Fallback: export dashboard structure when live data is unavailable
                    lines.push('# Dashboard Summary');
                    lines.push('title,type,dataSource,dateRange');
                    widgets.forEach(w => {
                        const esc = v => { const s = String(v ?? ''); return s.includes(',') ? `"${s}"` : s; };
                        lines.push([esc(w.title), esc(w.type), esc(w.dataSource || ''), esc(w.dateRange || '30d')].join(','));
                    });
                }
                dlFile(lines.join('\n'), `${fileBase}.csv`, 'text/csv');
                setStatus('done'); setProgress(100);
                return;
            }

            // ── Build chart snapshots (required for PDF + PNG) ───────────
            setProgress(5);
            const snapshots = await buildSnapshots(widgets, isDark, (p) => {
                if (!cancelRef.current) setProgress(p);
            });
            if (cancelRef.current) return;
            setProgress(85);

            // ── PNG: capture full dashboard composite ────────────────────
            if (format === 'png') {
                // Inject snapshots into a temporary off-screen composite div
                const scale = Number(pngScale) || 2;
                const dashEl = document.getElementById('dashboard-canvas');
                if (!dashEl) { setErrorMsg('Dashboard canvas not found.'); setStatus('error'); return; }

                // For the full dashboard PNG we use the live canvas
                // but with SVG-swap pipeline on each widget already done above
                // Instead, compose from snapshots in a clean container
                const comp = document.createElement('div');
                comp.style.cssText = `
                    position:fixed; left:-9999px; top:0;
                    background:${exportTheme === 'dark' ? '#0f172a' : '#f8fafc'};
                    padding:32px; font-family:Inter,-apple-system,sans-serif;
                `;
                // Sort widgets
                const sorted = [...widgets].sort((a, b) => {
                    const la = layoutMap[a.id] || a.px || {};
                    const lb = layoutMap[b.id] || b.px || {};
                    return (la.y || 0) !== (lb.y || 0) ? (la.y || 0) - (lb.y || 0) : (la.x || 0) - (lb.x || 0);
                });
                // Header
                const hdr = document.createElement('div');
                hdr.style.cssText = `margin-bottom:24px; padding-bottom:16px; border-bottom:1px solid ${exportTheme === 'dark' ? '#334155' : '#e5e7eb'}`;
                hdr.innerHTML = `<h1 style="margin:0;font-size:22px;font-weight:700;color:${exportTheme === 'dark' ? '#f1f5f9' : '#111827'}">${dashName}</h1>
                    ${showTimestamp ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280">Generated ${new Date().toLocaleString()}</p>` : ''}`;
                comp.appendChild(hdr);
                // Widgets grid
                const grid = document.createElement('div');
                grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:20px;';
                sorted.forEach(w => {
                    const snap = snapshots[w.id];
                    if (!snap) return;
                    const card = document.createElement('div');
                    card.style.cssText = `background:${exportTheme === 'dark' ? '#1e293b' : '#fff'};border-radius:10px;overflow:hidden;border:1px solid ${exportTheme === 'dark' ? '#334155' : '#e5e7eb'}`;
                    const title = document.createElement('p');
                    title.style.cssText = `margin:0;padding:10px 14px 8px;font-size:11px;font-weight:600;color:${exportTheme === 'dark' ? '#94a3b8' : '#6b7280'};text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid ${exportTheme === 'dark' ? '#334155' : '#f3f4f6'}`;
                    title.textContent = w.title;
                    const img = document.createElement('img');
                    img.src = snap;
                    img.style.cssText = 'width:100%;display:block;';
                    card.appendChild(title);
                    card.appendChild(img);
                    grid.appendChild(card);
                });
                comp.appendChild(grid);
                document.body.appendChild(comp);
                setProgress(90);

                await new Promise(r => setTimeout(r, 100)); // paint flush

                try {
                    const c = await html2canvas(comp, {
                        scale,
                        useCORS: true,
                        allowTaint: true,
                        backgroundColor: exportTheme === 'dark' ? '#0f172a' : '#f8fafc',
                        logging: false,
                    });
                    setProgress(98);
                    c.toBlob(blob => {
                        if (!blob) { setErrorMsg('PNG generation failed.'); setStatus('error'); return; }
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = `${fileBase}-dashboard.png`;
                        a.click(); URL.revokeObjectURL(url);
                        setStatus('done'); setProgress(100);
                    }, 'image/png');
                } finally {
                    document.body.removeChild(comp);
                }
                return;
            }

            // ── PDF: inject PrintRenderTree portal → window.print() ───────
            if (format === 'pdf') {
                setPrintSnapshots(snapshots);
                setShowPrintTree(true);
                setProgress(90);
                // Allow React to commit the portal DOM, then print
                await new Promise(r => setTimeout(r, 250));
                setProgress(95);
                setStatus('printing');

                const restore = () => {
                    setShowPrintTree(false);
                    setPrintSnapshots(null);
                    setStatus('done');
                    setProgress(100);
                    window.removeEventListener('afterprint', restore);
                };
                window.addEventListener('afterprint', restore);
                window.print();
                return;
            }

        } catch (err) {
            console.error('[ExportModal] export error:', err);
            setErrorMsg(err?.message || 'Export failed. Please try again.');
            setStatus('error');
            setShowPrintTree(false);
        }
    }, [format, exportTheme, pageSize, showCover, showTimestamp, showBranding, pngScale,
        widgets, layoutMap, dashName, isDark, siteId, widgetData]);

    const isRunning = status === 'building' || status === 'printing';
    const isDone = status === 'done';
    const isError = status === 'error';

    return (
        <>
            {/* ── Portal: PrintRenderTree ── */}
            {showPrintTree && printRootRef.current && createPortal(
                <PrintLayout
                    dashName={dashName}
                    snapshots={printSnapshots || {}}
                    widgets={widgets}
                    layoutMap={layoutMap}
                    exportTheme={exportTheme}
                    pageSize={pageSize}
                    showCover={showCover}
                    showTimestamp={showTimestamp}
                    showBranding={showBranding}
                />,
                printRootRef.current
            )}

            {/* ── Modal overlay ── */}
            <div
                className="fixed inset-0 z-[300] flex items-center justify-center p-4"
                onClick={onClose}
            >
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

                <div
                    className="relative z-10 w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl shadow-gray-900/30 dark:shadow-black/60 overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
                        <div>
                            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Export Dashboard</h2>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-xs">{dashName}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Format selector */}
                        <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Format</p>
                            <div className="grid grid-cols-4 gap-2">
                                {FORMATS.map(({ key, label, icon: Icon, desc }) => (
                                    <button
                                        key={key}
                                        onClick={() => { setFormat(key); setStatus('idle'); }}
                                        title={desc}
                                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-xs font-medium transition ${format === key
                                            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                                            }`}
                                    >
                                        <Icon className="w-5 h-5" />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* PDF/PNG options */}
                        {(format === 'pdf' || format === 'png') && (
                            <>
                                {/* Theme */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Theme</p>
                                        <div className="flex gap-1.5">
                                            {THEMES.map(({ key, label, icon: Icon }) => (
                                                <button
                                                    key={key}
                                                    onClick={() => setExportTheme(key)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition flex-1 justify-center ${exportTheme === key
                                                        ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                                                        }`}
                                                >
                                                    <Icon className="w-3.5 h-3.5" /> {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {format === 'png' && (
                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Resolution</p>
                                            <select
                                                value={pngScale}
                                                onChange={e => setPngScale(e.target.value)}
                                                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                            >
                                                <option value="1">1× Standard</option>
                                                <option value="2">2× Retina</option>
                                                <option value="3">3× High-DPI</option>
                                            </select>
                                        </div>
                                    )}

                                    {format === 'pdf' && (
                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Page Size</p>
                                            <select
                                                value={pageSize}
                                                onChange={e => setPageSize(e.target.value)}
                                                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                            >
                                                {Object.entries(PAGE_SIZES).map(([k, { label }]) => (
                                                    <option key={k} value={k}>{label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* Options (PDF only) */}
                                {format === 'pdf' && (
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Options</p>
                                        <div className="space-y-2.5">
                                            {[
                                                [showCover, setShowCover, 'Include cover page'],
                                                [showTimestamp, setShowTimestamp, 'Include generated timestamp'],
                                                [showBranding, setShowBranding, 'Include InsightTrack branding'],
                                            ].map(([val, set, label]) => (
                                                <label key={label} className="flex items-center gap-2.5 cursor-pointer">
                                                    <button
                                                        onClick={() => set(v => !v)}
                                                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition shrink-0 ${val
                                                            ? 'bg-indigo-500 border-indigo-500'
                                                            : 'border-gray-300 dark:border-gray-600'
                                                            }`}
                                                    >
                                                        {val && <Check className="w-2.5 h-2.5 text-white" />}
                                                    </button>
                                                    <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Progress bar */}
                        {(isRunning || isDone) && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                    <span>{status === 'printing' ? 'Opening print dialog…' : isDone ? 'Export complete' : 'Capturing charts…'}</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {isError && (
                            <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700 dark:text-red-300">{errorMsg}</p>
                            </div>
                        )}

                        {/* Info for CSV/JSON */}
                        {(format === 'csv' || format === 'json') && status === 'idle' && (
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                {format === 'json'
                                    ? 'Exports dashboard layout and widget configuration as a JSON file. Charts and data are not included.'
                                    : 'Exports all available widget data as comma-separated values. Import into Excel, Google Sheets, etc.'}
                            </p>
                        )}
                    </div>

                    {/* Footer actions */}
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={isDone ? onClose : handleExport}
                            disabled={isRunning}
                            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${isDone
                                ? 'bg-green-500 text-white shadow-green-500/20'
                                : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-indigo-500/20'
                                }`}
                        >
                            {isRunning && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isDone && <Check className="w-4 h-4" />}
                            {!isRunning && !isDone && (format === 'pdf' ? <Printer className="w-4 h-4" /> : <Download className="w-4 h-4" />)}
                            {isRunning
                                ? status === 'printing' ? 'Printing…' : 'Processing…'
                                : isDone ? 'Done'
                                    : format === 'pdf' ? 'Export as PDF'
                                        : format === 'png' ? 'Export as PNG'
                                            : format === 'json' ? 'Download JSON'
                                                : 'Download CSV'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
