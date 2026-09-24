import { useState } from 'react';
import { TrendingDown, TrendingUp, Minus, ArrowRight, Sparkles, ChevronDown, ExternalLink, Target, Users, LayoutList } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import AiOverviewBadge from './AiOverviewBadge';
import { useAssistantStore } from '../../store/useAssistantStore';
import { formatNumber } from '../../utils/formatters';

// Plain-language names for the SERP features the backend reports as changed.
const FEATURE_LABELS = {
    featured_snippet: 'Featured snippet',
    people_also_ask: 'People also ask',
    videos: 'Videos',
    shopping: 'Shopping',
    knowledge_graph: 'Knowledge panel',
};

/**
 * One tracked page: traffic change, the reason, and the SERP evidence.
 *
 * Layout notes — the previous version had the headline number pinned far right
 * while the explanation sat left, so the eye had to cross the whole card to
 * connect them. Now the change number and the sentence share the top band, and
 * the "what to do" step is a distinct row rather than a box nested inside a box.
 */

const TONE = {
    drop: {
        text: 'text-rose-600 dark:text-rose-400',
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        ring: 'border-rose-200 dark:border-rose-900/60',
        Icon: TrendingDown,
    },
    spike: {
        text: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        ring: 'border-emerald-200 dark:border-emerald-900/60',
        Icon: TrendingUp,
    },
    flat: {
        text: 'text-gray-500 dark:text-gray-400',
        bg: 'bg-gray-50 dark:bg-gray-800/40',
        ring: 'border-gray-200 dark:border-gray-800',
        Icon: Minus,
    },
};

const CONFIDENCE = {
    high: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40',
    medium: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40',
    low: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800',
};

/** What to ask Pulse depends on what this card already settled. */
function pulsePrompt(finding) {
    const unexplained = finding.causes?.some((c) => c.code === 'unexplained_by_serp');
    if (unexplained) {
        return `Traffic to ${finding.path} changed ${finding.traffic?.changePct}% week over week, but its search rankings and AI Overview status are unchanged. Check the other possible causes — referrers, UTM campaigns, device split, Core Web Vitals and JavaScript errors — and tell me what actually moved.`;
    }
    const kw = finding.keywordFindings?.find((f) => !f.error)?.keyword;
    return `Traffic to ${finding.path} changed ${finding.traffic?.changePct}% week over week and its rank moved on "${kw}". Confirm the cause, check whether other pages or keywords are affected too, and suggest what to do about it.`;
}

/** One keyword row. The keyword that caused the drop is visually weighted. */
function KeywordRow({ finding, blamed }) {
    const { position, previousPosition, positionChange, keyword } = finding;
    const moved = positionChange != null && positionChange !== 0;
    const worse = positionChange != null && positionChange < 0;
    const cited = finding.citations || [];
    const showCitations = finding.hasAiOverview && !finding.domainIsCited && cited.length > 0;
    const overtakers = finding.overtakenBy ?? [];
    const featuresAdded = finding.featuresAdded ?? [];
    const featuresRemoved = finding.featuresRemoved ?? [];

    return (
        <div className={`rounded-lg border px-3 py-2.5 ${
            blamed
                ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20'
                : 'border-gray-200 dark:border-gray-800'
        }`}>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <span className={`text-sm truncate ${blamed
                    ? 'font-medium text-gray-900 dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-400'}`} title={keyword}>
                    {keyword}
                </span>

                <div className="flex items-center gap-2.5 shrink-0">
                    {position == null ? (
                        <span className="text-sm text-gray-500 dark:text-gray-400">Not ranking</span>
                    ) : moved ? (
                        <span className="inline-flex items-center gap-1.5 text-sm tabular-nums">
                            <span className="text-gray-400 dark:text-gray-500">#{previousPosition}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                            <span className="font-semibold text-gray-900 dark:text-gray-100">#{position}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                                worse
                                    ? 'text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-900/40'
                                    : 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40'
                            }`}>
                                {worse ? '↓' : '↑'}{Math.abs(positionChange)}
                            </span>
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm tabular-nums">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">#{position}</span>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500">no change</span>
                        </span>
                    )}
                    <AiOverviewBadge finding={finding} />
                </div>
            </div>

            {showCitations && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <Sparkles className="w-3.5 h-3.5 mt-px shrink-0 text-amber-500" aria-hidden="true" />
                    <span>
                        The AI answer box quotes{' '}
                        {cited.slice(0, 3).map((c, i) => (
                            <span key={c.url || i}>
                                {i > 0 && ', '}
                                <a href={c.url} target="_blank" rel="noopener noreferrer"
                                    className="font-medium text-gray-800 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline">
                                    {c.domain}
                                </a>
                            </span>
                        ))}
                        {' '}— not you.
                    </span>
                </div>
            )}

            {/* What changed on the results page since the last check. */}
            {overtakers.length > 0 && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <Users className="w-3.5 h-3.5 mt-px shrink-0 text-rose-500" aria-hidden="true" />
                    <span>
                        Moved above you:{' '}
                        {overtakers.map((o, i) => (
                            <span key={o.domain}>
                                {i > 0 && ', '}
                                <a href={o.url || undefined} target="_blank" rel="noopener noreferrer"
                                    className="font-medium text-gray-800 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline">
                                    {o.domain}
                                </a>
                                <span className="tabular-nums"> ({o.previousPosition == null ? 'new' : `#${o.previousPosition}`} → #{o.position})</span>
                            </span>
                        ))}
                    </span>
                </div>
            )}
            {(featuresAdded.length > 0 || featuresRemoved.length > 0) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <LayoutList className="w-3.5 h-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                    {featuresAdded.map((f) => (
                        <span key={`+${f}`} className="px-1.5 py-0.5 rounded text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40">
                            + {FEATURE_LABELS[f] || f}
                        </span>
                    ))}
                    {featuresRemoved.map((f) => (
                        <span key={`-${f}`} className="px-1.5 py-0.5 rounded text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40">
                            − {FEATURE_LABELS[f] || f}
                        </span>
                    ))}
                    <span className="text-gray-400 dark:text-gray-500">on the results page since last check</span>
                </div>
            )}
        </div>
    );
}

export default function RankTrafficPanel({ page }) {
    const [showChart, setShowChart] = useState(false);
    const askQuestion = useAssistantStore((s) => s.askQuestion);

    if (page?.error) {
        return (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                <div className="font-medium text-gray-900 dark:text-gray-100">{page.path}</div>
                <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{page.error}</p>
            </div>
        );
    }

    const t = page.traffic || {};
    const tone = TONE[t.significant ? t.direction : 'flat'] || TONE.flat;
    const weeks = t.weeks ?? [];
    const findings = page.keywordFindings?.filter((f) => !f.error) ?? [];
    const blamedKeywords = new Set((page.causes || []).map((c) => c.keyword).filter(Boolean));
    const unexplained = page.causes?.some((c) => c.code === 'unexplained_by_serp');
    const conf = CONFIDENCE[page.confidence] || CONFIDENCE.low;

    return (
        <div className={`bg-white dark:bg-gray-900 rounded-xl border overflow-hidden ${
            t.significant ? tone.ring : 'border-gray-200 dark:border-gray-800'
        }`}>
            {/* Headline band — the number and the reason share one row, so the
                eye doesn't have to cross the card to connect them. */}
            <div className={`flex items-start gap-4 p-4 ${tone.bg}`}>
                <div className={`flex flex-col items-center justify-center shrink-0 w-[92px] ${tone.text}`}>
                    <tone.Icon className="w-5 h-5 mb-0.5" aria-hidden="true" />
                    <div className="text-[28px] leading-none font-bold tabular-nums">
                        {t.changePct > 0 ? '+' : ''}{t.changePct ?? '—'}%
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
                        {formatNumber(t.previousWeek ?? 0)} → {formatNumber(t.currentWeek ?? 0)}
                    </div>
                </div>

                <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate" title={page.path}>
                        {page.path}
                    </h3>
                    <p className="mt-1.5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-w-4xl">
                        {page.explanation}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${conf}`}>
                            {page.confidence} confidence
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            last complete week vs. the one before
                        </span>
                    </div>
                </div>
            </div>

            {/* What to do — its own row, not a box inside a box. */}
            {page.nextStep && (
                <div className="flex items-start gap-2.5 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                    <Target className="w-4 h-4 mt-0.5 shrink-0 text-indigo-500" aria-hidden="true" />
                    <div className="min-w-0 text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-w-4xl">
                        {page.nextStep.text}
                        {page.nextStep.rival?.url && (
                            <a href={page.nextStep.rival.url} target="_blank" rel="noopener noreferrer"
                                className="mt-1.5 flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                                <span className="truncate">{page.nextStep.rival.title || page.nextStep.rival.domain}</span>
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* Evidence — each keyword gets its own row; the blamed one is weighted. */}
            {findings.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        Keywords ({findings.length})
                    </div>
                    {findings.map((f) => (
                        <KeywordRow key={`${f.keyword}-${f.location}`} finding={f}
                            blamed={blamedKeywords.has(f.keyword)} />
                    ))}
                </div>
            )}

            {page.caveats?.length > 0 && (
                <ul className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 space-y-1">
                    {page.caveats.map((c, i) => (
                        <li key={i} className="text-xs text-gray-500 dark:text-gray-400">· {c}</li>
                    ))}
                </ul>
            )}

            {/* Actions + the optional chart share one footer bar, so nothing is
                left stranded at the bottom of the card. */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60">
                <button type="button" onClick={() => askQuestion(pulsePrompt(page))}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                               bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800
                               text-indigo-700 dark:text-indigo-300
                               hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors">
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    {unexplained ? 'Ask Pulse what else changed' : 'Dig deeper with Pulse'}
                </button>

                {weeks.length > 1 && (
                    <button type="button" onClick={() => setShowChart((v) => !v)} aria-expanded={showChart}
                        className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                        {showChart ? 'Hide' : 'Show'} weekly traffic
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showChart ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                )}
            </div>

            {showChart && weeks.length > 1 && (
                <div className="h-32 px-2 pb-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={weeks} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                            {/* Zero-based so a small dip isn't exaggerated by autoscaling. */}
                            <YAxis hide domain={[0, 'dataMax']} />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                labelFormatter={(v) => `Week of ${v}`}
                                formatter={(v) => [formatNumber(v), 'views']} />
                            <Area type="monotone" dataKey="views" stroke="#6366f1" fill="#6366f1"
                                fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
