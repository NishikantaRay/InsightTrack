import { useState, useEffect, useCallback } from 'react';
import { Gauge, Loader2, AlertCircle, Check, Clock } from 'lucide-react';
import { serpapiKeyAPI } from '../../services/api';

/**
 * Rank-check budget.
 *
 * A SerpApi plan is a monthly credit allowance, and what spends it is
 * keywords × how often each is checked. That cadence used to be reachable only
 * through RANK_CHECK_MIN_HOURS on the server, which put the single setting that
 * governs cost out of reach of the person holding the bill.
 *
 * So this shows the arithmetic rather than just the inputs: change the cadence
 * and the projected monthly spend moves with it, against the plan size you
 * enter. Nobody should have to work out 14 × 30 in their head to discover they
 * are 170 credits over.
 */

/** Plan sizes offered as a quick reference, not an exhaustive price list. */
const PLANS = [100, 250, 5000];

export default function RankBudgetSettings({ siteId, canEdit = true, connected = true, onChanged }) {
    const [budget, setBudget] = useState(null);
    const [minHours, setMinHours] = useState(24);
    const [maxPerRun, setMaxPerRun] = useState(10);
    const [plan, setPlan] = useState(() => {
        const stored = parseInt(localStorage.getItem('serpapi:planCredits'));
        return Number.isFinite(stored) ? stored : 250;
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);

    const load = useCallback(async () => {
        if (!siteId) return;
        try {
            const res = await serpapiKeyAPI.getBudget(siteId);
            const data = res?.data?.data ?? res?.data ?? null;
            if (!data) return;
            setBudget(data);
            setMinHours(data.minHours);
            setMaxPerRun(data.maxPerRun);
        } catch (err) {
            setError(err?.response?.data?.error || err.message);
        }
    }, [siteId]);

    useEffect(() => { load(); }, [load]);

    // Projected spend, recomputed locally so the number tracks the slider
    // rather than waiting for a round trip.
    const keywords = budget?.keywords ?? 0;
    const perMonth = minHours > 0 ? Math.round(keywords * (24 / minHours) * 30) : 0;
    const overBudget = perMonth > plan;

    /** Cadence in words — "every 2 days" reads better than "48 hours". */
    const cadence = minHours < 24
        ? `every ${minHours} hour${minHours === 1 ? '' : 's'}`
        : `every ${Math.round(minHours / 24)} day${Math.round(minHours / 24) === 1 ? '' : 's'}`;

    /** The slowest cadence that still fits the plan, for the one-click fix. */
    const suggestHours = keywords > 0 && plan > 0
        ? Math.min(720, Math.max(1, Math.ceil((keywords * 30 * 24) / plan)))
        : null;

    const save = async (e) => {
        e?.preventDefault();
        setBusy(true); setError(null); setSaved(false);
        try {
            await serpapiKeyAPI.saveBudget(siteId, { minHours, maxPerRun });
            setSaved(true);
            await load();
            onChanged?.();
        } catch (err) {
            setError(err?.response?.data?.error || err.message);
        } finally {
            setBusy(false);
        }
    };

    if (!budget) return null;

    const dirty = minHours !== budget.minHours || maxPerRun !== budget.maxPerRun;
    // Without a key the sweep skips this site, so there is nothing to persist —
    // but the projection is still worth showing, since it is what tells someone
    // which plan to buy.
    const canSave = canEdit && connected;

    return (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-4">
            <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Rank-check budget
                </h3>
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                    {!connected ? 'preview' : budget.source === 'default' ? 'using server defaults' : null}
                </span>
            </div>

            {/* The arithmetic, stated plainly. */}
            <div className={`rounded-lg border p-3 text-sm ${overBudget
                ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200'
                : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300'}`}>
                <p>
                    <strong>{keywords}</strong> keyword{keywords === 1 ? '' : 's'}, checked {cadence} ≈{' '}
                    <strong>{perMonth.toLocaleString()}</strong> credits/month
                </p>
                {overBudget && (
                    <p className="mt-1 flex items-start gap-1.5 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                        <span>
                            That is over your {plan.toLocaleString()}-credit plan.
                            {suggestHours && suggestHours !== minHours && (
                                <>
                                    {' '}
                                    <button type="button" onClick={() => setMinHours(suggestHours)}
                                        className="underline font-medium hover:no-underline">
                                        Check every {Math.max(1, Math.round(suggestHours / 24))} day
                                        {Math.round(suggestHours / 24) === 1 ? '' : 's'} instead
                                    </button>
                                    {' '}to fit.
                                </>
                            )}
                        </span>
                    </p>
                )}
                {!overBudget && plan > 0 && (
                    <p className="mt-1 text-xs opacity-80">
                        {(plan - perMonth).toLocaleString()} credits left over for manual lookups.
                    </p>
                )}
            </div>

            <form onSubmit={save} className="space-y-4">
                <div>
                    <label htmlFor="rank-cadence" className="flex items-baseline justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                        <span>Check each keyword</span>
                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{cadence}</span>
                    </label>
                    <input
                        id="rank-cadence"
                        type="range"
                        min="6" max="168" step="6"
                        value={Math.min(168, minHours)}
                        disabled={!canEdit && connected}
                        onChange={(e) => { setMinHours(parseInt(e.target.value)); setSaved(false); }}
                        className="w-full mt-2 accent-indigo-600 disabled:opacity-50"
                    />
                    <div className="flex justify-between text-[11px] text-gray-400 dark:text-gray-500">
                        <span>6 hours</span><span>1 day</span><span>7 days</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="rank-max" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Max checks per sweep
                        </label>
                        <input
                            id="rank-max"
                            type="number" min="1" max="100"
                            value={maxPerRun}
                            disabled={!canEdit && connected}
                            onChange={(e) => { setMaxPerRun(parseInt(e.target.value) || 1); setSaved(false); }}
                            className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        />
                        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            A ceiling per run, so a long keyword list cannot spend the month in one pass.
                        </p>
                    </div>
                    <div>
                        <label htmlFor="rank-plan" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Your monthly credits
                        </label>
                        <input
                            id="rank-plan"
                            type="number" min="1" step="50"
                            value={plan}
                            list="serpapi-plans"
                            onChange={(e) => {
                                const n = parseInt(e.target.value) || 0;
                                setPlan(n);
                                localStorage.setItem('serpapi:planCredits', String(n));
                            }}
                            className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <datalist id="serpapi-plans">
                            {PLANS.map((p) => <option key={p} value={p} />)}
                        </datalist>
                        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            Used only to check the maths above. Not sent anywhere.
                        </p>
                    </div>
                </div>

                {error && (
                    <p className="flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                        <span>{error}</span>
                    </p>
                )}
                {saved && !error && (
                    <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                        <Check className="w-4 h-4" aria-hidden="true" />
                        Budget saved. It applies from the next sweep.
                    </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" disabled={!canSave || busy || !dirty}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gauge className="w-4 h-4" />}
                        Save budget
                    </button>
                    {typeof budget.pending === 'number' && budget.pending > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                            {budget.pending} keyword{budget.pending === 1 ? '' : 's'} due on the next sweep
                        </span>
                    )}
                </div>
                {!connected && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Save a SerpApi key above to keep these settings. Until then this is a
                        cost preview — nothing is scheduled and no credits are spent.
                    </p>
                )}
                {connected && !canEdit && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Admin role required to change the budget.
                    </p>
                )}
            </form>
        </div>
    );
}
