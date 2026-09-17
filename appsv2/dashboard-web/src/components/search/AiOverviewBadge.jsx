import { Sparkles, Check, AlertTriangle, Minus } from 'lucide-react';

/**
 * AI Overview citation status for one keyword.
 *
 * Every state carries a text label as well as a colour — colour alone is not an
 * accessible signal, and "not cited" is the finding people most need to read.
 * Wording avoids jargon: most users have never heard the phrase "AI Overview",
 * but they recognise "AI answer".
 */
const STATES = {
    cited: {
        label: 'Your page is quoted in Google’s AI answer',
        short: 'In AI answer',
        Icon: Check,
        className: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40',
    },
    lost: {
        label: 'You were quoted in the AI answer, and no longer are',
        short: 'Dropped from AI answer',
        Icon: AlertTriangle,
        className: 'text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-900/40',
    },
    not_cited: {
        label: 'Google shows an AI answer for this search, and it does not quote you',
        short: 'Not in AI answer',
        Icon: AlertTriangle,
        className: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40',
    },
    none: {
        label: 'Google shows no AI answer for this search',
        short: 'No AI answer',
        Icon: Minus,
        className: 'text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-800',
    },
};

/** Map the finding's fields onto one of the four display states. */
export function aiOverviewState({ hasAiOverview, domainIsCited, citationChange }) {
    if (!hasAiOverview) return 'none';
    if (domainIsCited) return 'cited';
    if (citationChange === 'lost') return 'lost';
    return 'not_cited';
}

export default function AiOverviewBadge({ finding, showNew = true }) {
    if (!finding) return null;
    const state = aiOverviewState(finding);
    const { label, short, Icon, className } = STATES[state];
    // A brand-new AI answer is the highest-signal cause of a rank-stable drop,
    // so it is called out rather than blending into "not cited".
    const isNew = showNew && finding.citationChange === 'new_overview';

    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap ${className}`}
            title={isNew ? `${label} (this is new since last check)` : label}
        >
            <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>{short}</span>
            {isNew && (
                <span className="ml-0.5 inline-flex items-center gap-0.5 px-1 rounded bg-white/60 dark:bg-black/30 text-[10px] font-semibold uppercase tracking-wide">
                    <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
                    new
                </span>
            )}
        </span>
    );
}
