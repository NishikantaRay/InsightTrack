import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { analyticsAPI } from '../services/api';
import { useDateFilterStore } from '../store/useDateFilterStore';
import { useSiteStore } from '../store/useSiteStore';
import FocusToggleButton from '../components/ui/FocusToggleButton';
import { useFocusModeStore } from '../store/useFocusModeStore';
import PageNote from '../components/ui/PageNote';
import {
    Map,
    RefreshCw,
    Info,
    ExternalLink,
    Layers,
    AlertCircle,
    Monitor,
    Smartphone,
    ChevronDown,
    Download,
    BarChart2,
    MousePointer,
    ChevronLeft,
    ChevronRight,
    Search,
    X,
} from 'lucide-react';

// ── Heat colours: indigo → green → yellow → orange → red ──────────────────────
function getHeatColor(weight) {
    if (weight > 0.8) return 'rgba(239,68,68,0.90)';
    if (weight > 0.6) return 'rgba(249,115,22,0.85)';
    if (weight > 0.4) return 'rgba(234,179,8,0.80)';
    if (weight > 0.2) return 'rgba(34,197,94,0.75)';
    return 'rgba(99,102,241,0.65)';
}

// ── Cluster nearby dots within a radius threshold (relative %) ────────────────
function clusterDots(dots, radiusPct = 3) {
    const clusters = [];
    const assigned = new Set();
    for (let i = 0; i < dots.length; i++) {
        if (assigned.has(i)) continue;
        const cluster = { ...dots[i], members: [i] };
        for (let j = i + 1; j < dots.length; j++) {
            if (assigned.has(j)) continue;
            const dx = dots[j].relX - dots[i].relX;
            const dy = dots[j].relY - dots[i].relY;
            if (Math.sqrt(dx * dx + dy * dy) <= radiusPct) {
                cluster.clicks += dots[j].clicks;
                cluster.members.push(j);
                assigned.add(j);
            }
        }
        assigned.add(i);
        clusters.push(cluster);
    }
    return clusters;
}

function HeatDot({ relX, relY, clicks, maxClicks, label }) {
    const weight = maxClicks > 0 ? clicks / maxClicks : 0;
    const size = Math.max(20, Math.min(64, 20 + weight * 44));
    const color = getHeatColor(weight);
    const [hovered, setHovered] = useState(false);

    return (
        <div
            style={{
                position: 'absolute',
                left: `${relX}%`,
                top: `${relY}%`,
                width: size,
                height: size,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 ${size * 0.7}px ${color}`,
                pointerEvents: 'all',
                mixBlendMode: 'multiply',
                cursor: 'crosshair',
                zIndex: hovered ? 30 : 20,
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {hovered && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '110%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(15,17,30,0.92)',
                        color: '#fff',
                        fontSize: 11,
                        padding: '4px 8px',
                        borderRadius: 6,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        zIndex: 50,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}
                >
                    {clicks} click{clicks !== 1 ? 's' : ''}
                    {label && <span style={{ opacity: 0.65 }}> · {label.length > 24 ? label.slice(0, 24) + '…' : label}</span>}
                </div>
            )}
        </div>
    );
}

const CLICK_PAGE_SIZE = 20;

export default function Heatmap() {
    const [searchParams] = useSearchParams();
    const { focusMode } = useFocusModeStore();
    const dateRange = useDateFilterStore((s) => s.dateRange);
    const customStart = useDateFilterStore((s) => s.customStart);
    const customEnd = useDateFilterStore((s) => s.customEnd);
    const siteId = useSiteStore((s) => s.siteId);
    const sites = useSiteStore((s) => s.sites);

    const [path, setPath] = useState(searchParams.get('path') || '/');
    const [pathInput, setPathInput] = useState(searchParams.get('path') || '/');
    const [siteUrl, setSiteUrl] = useState('');
    const [siteUrlInput, setSiteUrlInput] = useState('');
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [iframeError, setIframeError] = useState(false);
    const [heatmapData, setHeatmapData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showOverlay, setShowOverlay] = useState(true);
    const [deviceFilter, setDeviceFilter] = useState('all'); // 'all' | 'desktop' | 'mobile'
    const [clusterEnabled, setClusterEnabled] = useState(true);
    const [pageList, setPageList] = useState([]);
    const [showPagePicker, setShowPagePicker] = useState(false);
    const [pageSearch, setPageSearch] = useState('');
    const [tablePage, setTablePage] = useState(1);
    const iframeRef = useRef(null);
    const pagePickerRef = useRef(null);

    // Close the page picker when the user clicks outside it
    useEffect(() => {
        if (!showPagePicker) return;
        const handler = (e) => {
            if (pagePickerRef.current && !pagePickerRef.current.contains(e.target)) {
                setShowPagePicker(false);
                setPageSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showPagePicker]);

    const effectiveDateRange = dateRange === 'custom' && customStart && customEnd
        ? `custom:${customStart}:${customEnd}`
        : dateRange;

    // Pre-fill site URL from site domain
    useEffect(() => {
        if (sites && sites.length > 0) {
            const current = sites.find(s => s.id === siteId);
            if (current && current.domain) {
                const url = current.domain.startsWith('http') ? current.domain : `https://${current.domain}`;
                setSiteUrl(url);
                setSiteUrlInput(url);
            }
        }
    }, [sites, siteId]);

    // Fetch heatmap summary for page picker
    useEffect(() => {
        if (!siteId) return;
        analyticsAPI.getHeatmapSummary(siteId, effectiveDateRange)
            .then(res => setPageList(res?.data || []))
            .catch(() => setPageList([]));
    }, [siteId, effectiveDateRange]);

    const fetchHeatmap = useCallback(() => {
        if (!siteId) return;
        setLoading(true);
        analyticsAPI.getHeatmap(siteId, effectiveDateRange, path)
            .then(res => setHeatmapData(res?.data || []))
            .catch(() => setHeatmapData([]))
            .finally(() => setLoading(false));
    }, [siteId, effectiveDateRange, path]);

    useEffect(() => {
        fetchHeatmap();
    }, [fetchHeatmap]);

    const handleApply = (e) => {
        e.preventDefault();
        setPath(pathInput.startsWith('/') ? pathInput : '/' + pathInput);
        setSiteUrl(siteUrlInput);
        setIframeLoaded(false);
        setIframeError(false);
        setTablePage(1);
    };

    // ── Filtered and clustered data ────────────────────────────────────────────
    const filteredData = useMemo(() => {
        if (deviceFilter === 'all') return heatmapData;
        return heatmapData.filter(d => {
            const isMobile = d.device === 'mobile' || d.isMobile;
            return deviceFilter === 'mobile' ? isMobile : !isMobile;
        });
    }, [heatmapData, deviceFilter]);

    const displayDots = useMemo(() => {
        if (!clusterEnabled) return filteredData;
        return clusterDots(filteredData);
    }, [filteredData, clusterEnabled]);

    // maxClicks must come from filteredData (unclustered) so the table bar
    // denominator and the dot-color scale use the same reference maximum.
    const sortedDots = useMemo(() => [...filteredData].sort((a, b) => b.clicks - a.clicks), [filteredData]);
    const maxClicks = sortedDots.length > 0 ? sortedDots[0].clicks : 1;
    const totalClicks = filteredData.reduce((s, d) => s + d.clicks, 0);
    const uniqueElements = filteredData.length;

    // ── Click Distribution table pagination ───────────────────────────────────
    const totalTablePages = Math.max(1, Math.ceil(sortedDots.length / CLICK_PAGE_SIZE));
    const safeTablePage = Math.min(tablePage, totalTablePages);
    const tableRows = sortedDots.slice((safeTablePage - 1) * CLICK_PAGE_SIZE, safeTablePage * CLICK_PAGE_SIZE);

    const iframeUrl = siteUrl ? siteUrl.replace(/\/$/, '') + path : null;

    // ── Page picker filtered list ──────────────────────────────────────────────
    const filteredPages = useMemo(() => {
        if (!pageSearch.trim()) return pageList;
        const q = pageSearch.toLowerCase();
        return pageList.filter(p => (p.page || p.path || '').toLowerCase().includes(q));
    }, [pageList, pageSearch]);

    // ── Export heatmap data as CSV ────────────────────────────────────────────
    const handleExportCSV = () => {
        if (!filteredData.length) return;
        const header = 'selector,relX,relY,clicks,device';
        const rows = filteredData.map(d =>
            [d.selector || '', d.relX, d.relY, d.clicks, d.device || 'all'].join(',')
        );
        const csv = [header, ...rows].join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `heatmap-${path.replace(/\//g, '-')}-${Date.now()}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    };

    return (
        <div className="space-y-5">
            {/* ─── Header ─────────────────────────────────────────── */}
            <div className="flex items-start justify-between">
                {!focusMode && (
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Map className="w-6 h-6 text-accent" />
                            Visual Heatmap
                        </h1>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                            Click hotspots overlaid on your live pages
                        </p>
                    </div>
                )}
                <FocusToggleButton />
            </div>

            {!focusMode && (
                <PageNote
                    title="How Visual Heatmap works"
                    summary="Visual Heatmap shows where visitors click on any page of your site. Coloured dots are overlaid on a live preview — red means heavily clicked, indigo means rarely clicked."
                    details={[
                        { label: 'Click recording', text: 'Every click fires a heatmap_click event with the element selector, tag, and relative X/Y position as % of viewport. Dots stay accurate across screen sizes.' },
                        { label: 'Dot colours', text: 'Indigo → green → yellow → orange → red. Colour reflects each element\'s share of the max click count. Red = most-clicked.' },
                        { label: 'Clustering', text: 'Nearby dots are merged into one to reduce visual noise. Toggle clustering off to see raw positions.' },
                        { label: 'Device filter', text: 'Filter clicks by Desktop or Mobile to compare behaviour across device types.' },
                        { label: 'Page picker', text: 'Click "Pick page" to see all tracked pages with click data and select one directly.' },
                        { label: 'Export', text: 'Download the raw click data as CSV for offline analysis.' },
                    ]}
                    businessTip="If your main CTA button is not showing a red/orange dot, visitors aren't seeing or clicking it — move it higher or make it more prominent."
                    devTip="Heatmap data comes from GET /api/analytics/:siteId/engagement/heatmap with relX/relY in the events table properties JSON."
                />
            )}

            {/* ─── Controls ───────────────────────────────────────── */}
            <div className="card">
                <form onSubmit={handleApply} className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-xs font-medium text-text-muted dark:text-text-muted-dark block mb-1">
                            Site URL (for iframe preview)
                        </label>
                        <input
                            type="url"
                            value={siteUrlInput}
                            onChange={e => setSiteUrlInput(e.target.value)}
                            placeholder="https://your-site.com"
                            className="w-full px-3 py-1.5 rounded-lg border border-border dark:border-border-dark bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                        />
                    </div>
                    <div className="flex-1 min-w-[160px]">
                        <label className="text-xs font-medium text-text-muted dark:text-text-muted-dark block mb-1">
                            Page path
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={pathInput}
                                onChange={e => setPathInput(e.target.value)}
                                placeholder="/about"
                                className="flex-1 px-3 py-1.5 rounded-lg border border-border dark:border-border-dark bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                            />
                            {pageList.length > 0 && (
                                <div className="relative" ref={pagePickerRef}>
                                    <button
                                        type="button"
                                        onClick={() => setShowPagePicker(v => !v)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border dark:border-border-dark text-xs text-text-muted dark:text-text-muted-dark hover:text-accent hover:border-accent transition-colors whitespace-nowrap"
                                    >
                                        Pick page <ChevronDown className="w-3 h-3" />
                                    </button>
                                    {showPagePicker && (
                                        <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-900 border border-border dark:border-border-dark rounded-xl shadow-xl z-50 overflow-hidden">
                                            <div className="p-2 border-b border-border dark:border-border-dark">
                                                <div className="relative">
                                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                                    <input
                                                        type="text"
                                                        value={pageSearch}
                                                        onChange={e => setPageSearch(e.target.value)}
                                                        placeholder="Search pages…"
                                                        className="w-full pl-8 py-1.5 text-xs rounded-lg border border-border dark:border-border-dark bg-transparent focus:outline-none"
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto">
                                                {filteredPages.length === 0 && (
                                                    <p className="text-xs text-gray-400 text-center py-4">No pages found</p>
                                                )}
                                                {filteredPages.map((p, i) => {
                                                    const pg = p.page || p.path || '/';
                                                    return (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => {
                                                                setPathInput(pg);
                                                                setShowPagePicker(false);
                                                                setPageSearch('');
                                                            }}
                                                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
                                                        >
                                                            <span className="font-mono text-xs text-text-primary dark:text-text-primary-dark truncate flex-1">{pg}</span>
                                                            <span className="text-xs text-text-muted dark:text-text-muted-dark ml-2 shrink-0">{p.clicks || p.count || 0} clicks</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Apply
                    </button>
                </form>

                {/* Stats + filter row */}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border dark:border-border-dark flex-wrap">
                    <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-text-muted dark:text-text-muted-dark">
                            <MousePointer className="w-3.5 h-3.5" />
                            <span className="font-semibold text-text-primary dark:text-text-primary-dark">{totalClicks.toLocaleString()}</span> clicks
                        </span>
                        <span className="text-text-muted dark:text-text-muted-dark">
                            <span className="font-semibold text-text-primary dark:text-text-primary-dark">{uniqueElements}</span> elements
                        </span>
                        <span className="font-mono text-text-muted dark:text-text-muted-dark">{path}</span>
                    </div>

                    <div className="ml-auto flex items-center gap-2 flex-wrap">
                        {/* Device filter */}
                        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                            {[
                                { v: 'all', label: 'All' },
                                { v: 'desktop', label: <Monitor className="w-3.5 h-3.5" /> },
                                { v: 'mobile', label: <Smartphone className="w-3.5 h-3.5" /> },
                            ].map(({ v, label }) => (
                                <button
                                    key={v}
                                    onClick={() => setDeviceFilter(v)}
                                    title={v === 'all' ? 'All devices' : v === 'desktop' ? 'Desktop only' : 'Mobile only'}
                                    className={`flex items-center px-2 py-1 rounded-md text-xs font-medium transition-all ${deviceFilter === v
                                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Cluster toggle */}
                        <button
                            onClick={() => setClusterEnabled(v => !v)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors ${clusterEnabled
                                ? 'border-accent text-accent bg-accent/5 dark:bg-accent/10'
                                : 'border-border dark:border-border-dark text-text-muted dark:text-text-muted-dark'
                                }`}
                        >
                            <BarChart2 className="w-3.5 h-3.5" />
                            {clusterEnabled ? 'Clustered' : 'Raw dots'}
                        </button>

                        {/* Overlay toggle */}
                        <button
                            onClick={() => setShowOverlay(v => !v)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors ${showOverlay
                                ? 'border-accent text-accent bg-accent/5 dark:bg-accent/10'
                                : 'border-border dark:border-border-dark text-text-muted dark:text-text-muted-dark'
                                }`}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            {showOverlay ? 'Hide overlay' : 'Show overlay'}
                        </button>

                        {/* Export */}
                        {filteredData.length > 0 && (
                            <button
                                onClick={handleExportCSV}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border border-border dark:border-border-dark text-text-muted dark:text-text-muted-dark hover:text-accent hover:border-accent transition-colors"
                            >
                                <Download className="w-3.5 h-3.5" />
                                Export CSV
                            </button>
                        )}

                        {iframeUrl && (
                            <a
                                href={iframeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border border-border dark:border-border-dark text-text-muted dark:text-text-muted-dark hover:text-accent dark:hover:text-accent-light hover:border-accent transition-colors"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Open page
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Summary stats cards ─────────────────────────────── */}
            {filteredData.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Total Clicks', value: totalClicks.toLocaleString(), color: 'text-indigo-600 dark:text-indigo-400' },
                        { label: 'Unique Elements', value: uniqueElements, color: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Top Element', value: sortedDots[0]?.selector?.slice(0, 20) || '—', color: 'text-amber-600 dark:text-amber-400', mono: true },
                        { label: 'Most Clicks', value: sortedDots[0]?.clicks?.toLocaleString() || '—', color: 'text-red-600 dark:text-red-400' },
                    ].map(({ label, value, color, mono }) => (
                        <div key={label} className="card py-3">
                            <p className="text-xs text-text-muted dark:text-text-muted-dark mb-1">{label}</p>
                            <p className={`font-bold text-lg ${color} ${mono ? 'font-mono text-sm' : ''}`}>{value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── Heat legend ────────────────────────────────────── */}
            {filteredData.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-text-muted dark:text-text-muted-dark px-1">
                    <span>Low</span>
                    {[
                        'rgba(99,102,241,0.65)',
                        'rgba(34,197,94,0.75)',
                        'rgba(234,179,8,0.80)',
                        'rgba(249,115,22,0.85)',
                        'rgba(239,68,68,0.90)',
                    ].map((c, i) => (
                        <div key={i} className="w-6 h-3 rounded-sm" style={{ background: c }} />
                    ))}
                    <span>High</span>
                </div>
            )}

            {/* ─── Heatmap viewport ───────────────────────────────── */}
            <div className="card overflow-hidden p-0">
                {!iframeUrl ? (
                    <div className="flex flex-col items-center justify-center py-20 text-text-muted dark:text-text-muted-dark">
                        <Map className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-sm font-medium">Enter your site URL above to preview the heatmap</p>
                        <p className="text-xs mt-1 opacity-60">The tracked page will load in an iframe with click hotspots overlaid</p>
                    </div>
                ) : (
                    <div className="relative w-full" style={{ height: '640px' }}>
                        {/* Loading spinner */}
                        {!iframeLoaded && !iframeError && (
                            <div className="absolute inset-0 flex items-center justify-center bg-bg dark:bg-bg-dark z-10">
                                <RefreshCw className="w-8 h-8 animate-spin text-accent" />
                            </div>
                        )}

                        {/* Iframe error state */}
                        {iframeError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg dark:bg-bg-dark z-10 gap-3">
                                <AlertCircle className="w-10 h-10 text-amber-500" />
                                <p className="text-sm font-medium">Could not load the page preview</p>
                                <p className="text-xs text-text-muted dark:text-text-muted-dark max-w-sm text-center">
                                    The site may have X-Frame-Options restrictions. Click dots are still accurate and shown below.
                                </p>
                                <a
                                    href={iframeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-accent hover:underline flex items-center gap-1"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    Open in new tab
                                </a>
                            </div>
                        )}

                        {/* Iframe */}
                        <iframe
                            ref={iframeRef}
                            key={iframeUrl}
                            src={iframeUrl}
                            title="Page preview"
                            className="w-full h-full border-0"
                            sandbox="allow-scripts allow-same-origin allow-forms"
                            onLoad={() => { setIframeLoaded(true); setIframeError(false); }}
                            onError={() => { setIframeLoaded(true); setIframeError(true); }}
                        />

                        {/* Heat dots overlay — normal iframe */}
                        {showOverlay && iframeLoaded && !iframeError && displayDots.length > 0 && (
                            <div className="absolute inset-0" style={{ zIndex: 20, pointerEvents: 'none' }}>
                                <div className="relative w-full h-full" style={{ pointerEvents: 'all' }}>
                                    {displayDots.map((dot, i) => (
                                        <HeatDot
                                            key={i}
                                            relX={dot.relX}
                                            relY={dot.relY}
                                            clicks={dot.clicks}
                                            maxClicks={maxClicks}
                                            label={dot.selector}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Overlay-only mode when iframe blocked */}
                        {showOverlay && iframeError && displayDots.length > 0 && (
                            <div
                                className="absolute inset-0"
                                style={{ background: 'rgba(15,17,30,0.85)', zIndex: 20 }}
                            >
                                <p className="absolute top-3 left-3 text-xs text-white/60 font-mono">
                                    Click position overlay — iframe blocked by X-Frame-Options
                                </p>
                                {displayDots.map((dot, i) => (
                                    <HeatDot
                                        key={i}
                                        relX={dot.relX}
                                        relY={dot.relY}
                                        clicks={dot.clicks}
                                        maxClicks={maxClicks}
                                        label={dot.selector}
                                    />
                                ))}
                            </div>
                        )}

                        {/* No click data hint */}
                        {showOverlay && iframeLoaded && displayDots.length === 0 && !loading && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs flex items-center gap-2">
                                <Info className="w-3.5 h-3.5" />
                                No click data for this page yet — visit it with tracking active
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ─── Click Distribution table ─────────────────────── */}
            {filteredData.length > 0 && (
                <div className="card">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <h3 className="text-sm font-semibold">Click Distribution</h3>
                        <span className="text-xs text-text-muted dark:text-text-muted-dark">
                            {sortedDots.length} elements · {totalClicks.toLocaleString()} total clicks
                        </span>
                    </div>
                    <div className="space-y-2">
                        {tableRows.map((dot, i) => {
                            const rank = (safeTablePage - 1) * CLICK_PAGE_SIZE + i + 1;
                            return (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-xs text-text-muted dark:text-text-muted-dark w-5 text-right shrink-0">{rank}</span>
                                    <div
                                        className="w-3 h-3 rounded-full shrink-0"
                                        style={{ background: getHeatColor(dot.clicks / maxClicks) }}
                                    />
                                    <span className="font-mono text-xs text-text-primary dark:text-text-primary-dark flex-1 truncate" title={dot.selector}>
                                        {dot.selector || '(unknown)'}
                                    </span>
                                    <div className="w-24 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden shrink-0">
                                        <div
                                            className="h-full rounded-full bg-accent"
                                            style={{ width: `${Math.min(100, (dot.clicks / maxClicks) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-medium text-text-primary dark:text-text-primary-dark w-10 text-right shrink-0">
                                        {dot.clicks.toLocaleString()}
                                    </span>
                                    <span className="text-xs text-text-muted dark:text-text-muted-dark w-10 text-right shrink-0">
                                        {totalClicks > 0 ? `${((dot.clicks / totalClicks) * 100).toFixed(1)}%` : '—'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Table pagination */}
                    {totalTablePages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border dark:border-border-dark">
                            <span className="text-xs text-text-muted dark:text-text-muted-dark">
                                {(safeTablePage - 1) * CLICK_PAGE_SIZE + 1}–{Math.min(safeTablePage * CLICK_PAGE_SIZE, sortedDots.length)} of {sortedDots.length}
                            </span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setTablePage(p => Math.max(1, p - 1))} disabled={safeTablePage === 1}
                                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-xs text-text-muted dark:text-text-muted-dark tabular-nums px-1">
                                    {safeTablePage} / {totalTablePages}
                                </span>
                                <button onClick={() => setTablePage(p => Math.min(totalTablePages, p + 1))} disabled={safeTablePage === totalTablePages}
                                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
