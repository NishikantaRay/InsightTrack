import { useState, useEffect, useRef, useCallback } from 'react';
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
    ZoomIn,
    ZoomOut,
    Layers,
    AlertCircle,
} from 'lucide-react';

// Heat colours: blue → green → yellow → red
function getHeatColor(weight) {
    if (weight > 0.8) return 'rgba(239,68,68,0.85)';      // red
    if (weight > 0.6) return 'rgba(249,115,22,0.80)';     // orange
    if (weight > 0.4) return 'rgba(234,179,8,0.75)';      // yellow
    if (weight > 0.2) return 'rgba(34,197,94,0.70)';      // green
    return 'rgba(99,102,241,0.65)';                        // indigo
}

function HeatDot({ relX, relY, clicks, maxClicks }) {
    const weight = maxClicks > 0 ? clicks / maxClicks : 0;
    const size = Math.max(18, Math.min(56, 18 + weight * 38));
    const color = getHeatColor(weight);

    return (
        <div
            title={`${clicks} click${clicks !== 1 ? 's' : ''}`}
            style={{
                position: 'absolute',
                left: `${relX}%`,
                top: `${relY}%`,
                width: size,
                height: size,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 ${size * 0.6}px ${color}`,
                pointerEvents: 'none',
                mixBlendMode: 'multiply',
            }}
        />
    );
}

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
    const iframeRef = useRef(null);

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
    };

    const maxClicks = heatmapData.length > 0 ? Math.max(...heatmapData.map(d => d.clicks)) : 1;
    const totalClicks = heatmapData.reduce((s, d) => s + d.clicks, 0);

    const iframeUrl = siteUrl ? siteUrl.replace(/\/$/, '') + path : null;

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
                    summary="Visual Heatmap shows where visitors click on any page of your site. Coloured dots are overlaid on a live preview of the page — red means heavily clicked, indigo means rarely clicked."
                    details={[
                        { label: 'Click recording', text: 'Every click on your tracked site fires a heatmap_click event that records the element selector, text, tag, and the relative X/Y position (as % of viewport). This means dots stay in the right place even on different screen sizes.' },
                        { label: 'Dot colours', text: 'Indigo to green to yellow to orange to red. The colour reflects each element share of the maximum click count on that page. Red = the most-clicked spot.' },
                        { label: 'Live page preview', text: 'The page is loaded in an iframe so you see real layout. If the site blocks iframes (X-Frame-Options), a dark overlay is shown instead — the dots are still accurate.' },
                        { label: 'Click Distribution table', text: 'Below the heatmap, each unique element is listed with its click count and a bar showing its share of total clicks. Sort by clicks or unique users.' },
                    ]}
                    businessTip="If your most important CTA button is not showing a red/orange dot, visitors aren't seeing it — move it higher or make it more prominent. If unexpected elements have red dots, those are things your visitors actually care about."
                    devTip="Heatmap data is served from GET /api/analytics/:siteId/engagement/heatmap with relX/relY stored in the events table properties JSON. The tracking script captures all clicks, not just links. Dots are absolutely positioned SVG-free divs over a position:relative container."
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
                        <input
                            type="text"
                            value={pathInput}
                            onChange={e => setPathInput(e.target.value)}
                            placeholder="/about"
                            className="w-full px-3 py-1.5 rounded-lg border border-border dark:border-border-dark bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                        />
                    </div>
                    <button
                        type="submit"
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Apply
                    </button>
                </form>

                {/* Stats row */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border dark:border-border-dark">
                    <span className="text-xs text-text-muted dark:text-text-muted-dark">
                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">{heatmapData.length}</span> hotspots
                    </span>
                    <span className="text-xs text-text-muted dark:text-text-muted-dark">
                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">{totalClicks.toLocaleString()}</span> total clicks
                    </span>
                    <span className="text-xs text-text-muted dark:text-text-muted-dark">
                        page: <span className="font-mono font-medium text-text-primary dark:text-text-primary-dark">{path}</span>
                    </span>
                    <div className="ml-auto flex items-center gap-2">
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

            {/* ─── Heat legend ────────────────────────────────────── */}
            {heatmapData.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-text-muted dark:text-text-muted-dark px-1">
                    <span>Low</span>
                    {[
                        'rgba(99,102,241,0.65)',
                        'rgba(34,197,94,0.70)',
                        'rgba(234,179,8,0.75)',
                        'rgba(249,115,22,0.80)',
                        'rgba(239,68,68,0.85)',
                    ].map((c, i) => (
                        <div key={i} className="w-5 h-3 rounded-sm" style={{ background: c }} />
                    ))}
                    <span>High</span>
                </div>
            )}

            {/* ─── Heatmap viewport ───────────────────────────────── */}
            <div className="card overflow-hidden p-0">
                {!iframeUrl ? (
                    /* No URL entered */
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
                                    The site may have X-Frame-Options restrictions. Open it in a new tab and use the dots overlay on the right.
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

                        {/* Heat dots overlay */}
                        {showOverlay && iframeLoaded && !iframeError && heatmapData.length > 0 && (
                            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
                                {heatmapData.map((dot, i) => (
                                    <HeatDot
                                        key={i}
                                        relX={dot.relX}
                                        relY={dot.relY}
                                        clicks={dot.clicks}
                                        maxClicks={maxClicks}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Overlay-only mode when iframe not available */}
                        {showOverlay && iframeError && heatmapData.length > 0 && (
                            <div
                                className="absolute inset-0 pointer-events-none"
                                style={{ background: 'rgba(15,17,30,0.85)', zIndex: 20 }}
                            >
                                <p className="absolute top-3 left-3 text-xs text-white/60 font-mono">
                                    Click position overlay — site URL blocked by X-Frame-Options
                                </p>
                                {heatmapData.map((dot, i) => (
                                    <HeatDot
                                        key={i}
                                        relX={dot.relX}
                                        relY={dot.relY}
                                        clicks={dot.clicks}
                                        maxClicks={maxClicks}
                                    />
                                ))}
                            </div>
                        )}

                        {/* No click data hint */}
                        {showOverlay && iframeLoaded && heatmapData.length === 0 && !loading && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs flex items-center gap-2">
                                <Info className="w-3.5 h-3.5" />
                                No click data for this page yet — visit it with tracking active
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ─── Selector table ─────────────────────────────────── */}
            {heatmapData.length > 0 && (
                <div className="card">
                    <h3 className="text-sm font-semibold mb-3">Click Distribution</h3>
                    <div className="space-y-2">
                        {heatmapData.slice(0, 15).map((dot, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="text-xs text-text-muted dark:text-text-muted-dark w-5 text-right shrink-0">{i + 1}</span>
                                <div
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ background: getHeatColor(dot.clicks / maxClicks) }}
                                />
                                <span className="font-mono text-xs text-text-primary dark:text-text-primary-dark flex-1 truncate" title={dot.selector}>
                                    {dot.selector || '(unknown)'}
                                </span>
                                <div className="w-24 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-accent"
                                        style={{ width: `${(dot.clicks / maxClicks) * 100}%` }}
                                    />
                                </div>
                                <span className="text-xs font-medium text-text-primary dark:text-text-primary-dark w-8 text-right">
                                    {dot.clicks}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
