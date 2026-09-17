import { useState } from 'react';
import { Search, Settings2, KeyRound, FlaskConical } from 'lucide-react';
import { useSearchVisibility } from '../hooks/useAnalytics';
import { useSiteStore } from '../store/useSiteStore';
import RankTrafficPanel from '../components/search/RankTrafficPanel';
import KeywordManager from '../components/search/KeywordManager';
import SerpApiKeyDialog from '../components/search/SerpApiKeyDialog';
import PageNote from '../components/ui/PageNote';

/**
 * Search Visibility — first-party traffic joined with live Google SERP data.
 *
 * The one view where a page's traffic trend, its ranking, and its AI Overview
 * citation status sit together with a plain-English explanation of why they
 * moved. Neither a web-analytics tool nor a rank tracker shows this alone.
 */
export default function SearchVisibility() {
    const siteId = useSiteStore((s) => s.siteId);
    const [keywordsOpen, setKeywordsOpen] = useState(false);
    const [keyOpen, setKeyOpen] = useState(false);
    const { data, loading, error, refetch } = useSearchVisibility(10);

    const pages = data?.pages ?? [];
    const significant = data?.significantCount ?? 0;
    const fixtureMode = data?.fixtureMode;

    // Tile figures, derived from what's already loaded.
    const allFindings = pages.flatMap((p) => p.keywordFindings?.filter((f) => !f.error) ?? []);
    const keywordCount = allFindings.length;
    const uncitedCount = allFindings.filter((f) => f.hasAiOverview && !f.domainIsCited).length;

    // Movers first — a steady page is not why anyone opens this screen.
    const flagged = pages.filter((p) => p.traffic?.significant);
    const steady = pages.filter((p) => !p.traffic?.significant);

    return (
        <div className="space-y-5 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Search className="w-6 h-6 text-indigo-500" aria-hidden="true" />
                        Search Visibility
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Why your traffic changed — your analytics joined with live Google results.
                    </p>
                    {/* This view pins its own window, so the toolbar's date filter
                        does not apply. Saying so prevents a silent mismatch. */}
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                        Always compares the last two complete weeks over a 90-day window.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setKeywordsOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <Settings2 className="w-4 h-4" aria-hidden="true" />
                        Keywords
                    </button>
                    <button type="button" onClick={() => setKeyOpen(true)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border ${
                            fixtureMode
                                ? 'border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
                                : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}>
                        <KeyRound className="w-4 h-4" aria-hidden="true" />
                        {fixtureMode ? 'Connect SerpApi' : 'SerpApi'}
                    </button>
                </div>
            </div>

            <PageNote
                title="How this works"
                summary="Your traffic data answers what happened. Live Google results answer why. This page joins them."
                details={[
                    { label: 'Traffic', text: 'Pageviews over a 90-day window, compared week over week. The current partial week is excluded, so a week in progress never looks like a drop.' },
                    { label: 'Rankings', text: 'Your Google position for each mapped keyword. Fetched from SerpApi and cached for 24 hours, so repeat views cost no API credits.' },
                    { label: 'AI Overview', text: "Whether Google shows an AI Overview and whether it cites you. One that cites competitors instead can cut clicks even when your rank hasn't moved." },
                    { label: 'Confidence', text: 'High when a rank or AI Overview change lines up with the traffic move. Low when search looks unchanged — then the cause is probably elsewhere, and the card says so.' },
                ]}
                businessTip="Start with the pages flagged as changed significantly — those are real moves, not noise."
                devTip="The same correlation is available to Pulse and any MCP client as the explain_traffic_change tool."
            />

            {/* Summary tiles — a thin one-line strip made the page feel empty and
                gave the key numbers no weight. */}
            {!loading && pages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className={`rounded-xl border p-3 ${
                        significant > 0
                            ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30'
                            : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
                    }`}>
                        <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Need attention</div>
                        <div className={`mt-1 text-2xl font-bold tabular-nums ${
                            significant > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'
                        }`}>{significant}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Pages tracked</div>
                        <div className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{pages.length}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Keywords</div>
                        <div className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{keywordCount}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Not in AI answer</div>
                        <div className={`mt-1 text-2xl font-bold tabular-nums ${
                            uncitedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'
                        }`}>{uncitedCount}</div>
                    </div>
                </div>
            )}

            {/* Sample-data notice, only when it applies. */}
            {!loading && fixtureMode && (
                <button type="button" onClick={() => setKeyOpen(true)}
                    className="w-full flex items-center gap-2 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-2.5 text-left hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                    <FlaskConical className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                    <span className="text-sm text-indigo-900 dark:text-indigo-200">
                        <strong>Sample data.</strong> Rankings come from bundled examples — connect SerpApi for live Google results.
                    </span>
                </button>
            )}

            {error && (
                <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3">
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
            )}

            {loading && (
                <div className="space-y-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="animate-pulse h-44 bg-gray-100 dark:bg-gray-800 rounded-xl" />
                    ))}
                </div>
            )}

            {!loading && !error && pages.length === 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center">
                    <Search className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" aria-hidden="true" />
                    <h2 className="mt-3 font-semibold text-gray-900 dark:text-gray-100">Track your first page</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                        Tell us which keyword a page is trying to rank for. We'll watch its position and
                        Google's AI Overview, and explain any traffic change we find.
                    </p>
                    <button type="button" onClick={() => setKeywordsOpen(true)}
                        className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                        Map a keyword
                    </button>
                </div>
            )}

            {!loading && pages.length > 0 && (
                <div className="space-y-4">
                    {flagged.map((p) => <RankTrafficPanel key={p.path} page={p} />)}

                    {flagged.length > 0 && steady.length > 0 && (
                        <div className="flex items-center gap-3 pt-2">
                            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                            <span className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                Steady
                            </span>
                            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                        </div>
                    )}

                    {steady.map((p) => <RankTrafficPanel key={p.path} page={p} />)}
                </div>
            )}

            <KeywordManager siteId={siteId} open={keywordsOpen}
                onClose={() => setKeywordsOpen(false)} onChanged={refetch} />
            <SerpApiKeyDialog siteId={siteId} open={keyOpen}
                onClose={() => setKeyOpen(false)} onChanged={refetch} />
        </div>
    );
}
