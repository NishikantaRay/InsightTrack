import { Fragment, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import AiOverviewBadge, { aiOverviewState } from './AiOverviewBadge';
import RankTrafficPanel from './RankTrafficPanel';
import { formatNumber } from '../../utils/formatters';

/**
 * Pages whose traffic did not move enough to explain — one row each.
 *
 * On a small site nearly every page lands here (a week of 6 → 12 views is below
 * the significance floor), and a full card per page buried the few things worth
 * acting on. So the table leads with search standing, not traffic %, and sorts
 * actionable rows first: not quoted in the AI answer, a rank loss, or a rival
 * that just moved above. Clicking a row opens the full card.
 */

/** Higher = more worth a look. Traffic is steady, so this is search-side only. */
function actionScore(finding) {
    if (!finding) return 0;
    let score = 0;
    const ai = aiOverviewState(finding);
    if (ai === 'lost') score += 4;
    if (ai === 'not_cited') score += 3;
    if ((finding.positionChange ?? 0) < 0) score += 2;
    if (finding.overtakenBy?.length) score += 1;
    return score;
}

function Position({ finding }) {
    if (!finding) return <span className="text-gray-400 dark:text-gray-500">—</span>;
    const { position, previousPosition, positionChange } = finding;
    if (position == null) return <span className="text-gray-500 dark:text-gray-400">Not ranking</span>;
    if (!positionChange) {
        return <span className="font-semibold text-gray-900 dark:text-gray-100">#{position}</span>;
    }
    const worse = positionChange < 0;
    return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <span className="text-gray-400 dark:text-gray-500">#{previousPosition}</span>
            <span className="text-gray-400" aria-hidden="true">→</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">#{position}</span>
            <span className={`text-[11px] font-semibold ${worse
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'}`}>
                {worse ? '↓' : '↑'}{Math.abs(positionChange)}
            </span>
        </span>
    );
}

export default function SteadyPagesTable({ pages }) {
    const [open, setOpen] = useState(null);

    const rows = pages
        .map((page) => {
            const findings = page.keywordFindings?.filter((f) => !f.error) ?? [];
            // The most actionable keyword represents the page.
            const lead = [...findings].sort((a, b) => actionScore(b) - actionScore(a))[0] ?? null;
            return { page, lead, extra: Math.max(0, findings.length - 1), score: actionScore(lead) };
        })
        .sort((a, b) => b.score - a.score
            || (b.page.traffic?.currentWeek ?? 0) - (a.page.traffic?.currentWeek ?? 0));

    const actionable = rows.filter((r) => r.score > 0).length;
    const th = pages.find((p) => p.traffic?.thresholds)?.traffic.thresholds;

    return (
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Steady pages <span className="font-normal text-gray-500 dark:text-gray-400">({rows.length})</span>
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Traffic didn't change enough to explain{th ? ` — a move needs at least ${th.minPct}% and ${th.minViews} views` : ''}.
                    {actionable > 0 && ` ${actionable} still ${actionable === 1 ? 'has' : 'have'} something to fix in search, listed first.`}
                </p>
            </header>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            <th scope="col" className="px-4 py-2 font-medium">Page</th>
                            <th scope="col" className="px-3 py-2 font-medium hidden md:table-cell">Keyword</th>
                            <th scope="col" className="px-3 py-2 font-medium">Google</th>
                            <th scope="col" className="px-3 py-2 font-medium">AI answer</th>
                            <th scope="col" className="px-3 py-2 font-medium text-right hidden sm:table-cell">Views / wk</th>
                            <th scope="col" className="w-8"><span className="sr-only">Details</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {rows.map(({ page, lead, extra, score }) => {
                            const isOpen = open === page.path;
                            const t = page.traffic || {};
                            return (
                                <Fragment key={page.path}>
                                    <tr onClick={() => setOpen(isOpen ? null : page.path)}
                                        className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                                            score > 0 ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}`}>
                                        <td className="px-4 py-2.5 max-w-[16rem]">
                                            <button type="button" aria-expanded={isOpen}
                                                onClick={(e) => { e.stopPropagation(); setOpen(isOpen ? null : page.path); }}
                                                className="block w-full text-left truncate font-medium text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400"
                                                title={page.path}>
                                                {page.path}
                                            </button>
                                        </td>
                                        <td className="px-3 py-2.5 hidden md:table-cell max-w-[14rem] text-gray-600 dark:text-gray-400">
                                            <span className="block truncate" title={lead?.keyword}>
                                                {lead?.keyword ?? '—'}
                                                {extra > 0 && <span className="text-gray-400 dark:text-gray-500"> +{extra}</span>}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 tabular-nums"><Position finding={lead} /></td>
                                        <td className="px-3 py-2.5">
                                            {lead ? <AiOverviewBadge finding={lead} /> : <span className="text-gray-400">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap hidden sm:table-cell">
                                            {formatNumber(t.previousWeek ?? 0)} → {formatNumber(t.currentWeek ?? 0)}
                                        </td>
                                        <td className="pr-3 text-gray-400">
                                            <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
                                        </td>
                                    </tr>
                                    {isOpen && (
                                        <tr>
                                            <td colSpan={6} className="p-3 bg-gray-50 dark:bg-gray-950/40">
                                                <RankTrafficPanel page={page} />
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
