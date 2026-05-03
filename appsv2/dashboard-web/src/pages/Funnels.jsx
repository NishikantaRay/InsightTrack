import { useState, useCallback, useEffect, useRef } from 'react';
import { GitMerge, Plus, Trash2, Play, RotateCcw, ChevronDown, Sparkles, BookmarkCheck } from 'lucide-react';
import FunnelChart from '../components/charts/FunnelChart';
import { useAnalytics } from '../hooks/useAnalytics';
import { CHART_COLORS } from '../utils/formatters';
import { useFunnelStore } from '../store/useFunnelStore';
import PageNote from '../components/ui/PageNote';

// ─── Fallback used before real data arrives ───────────────────────────────────
const FALLBACK_STEPS = [
    { label: 'Visit Homepage', type: 'pageview', path: '/' },
    { label: 'View Product', type: 'pageview', path: '/products' },
    { label: 'Add to Cart', type: 'add_to_cart', path: '' },
    { label: 'Checkout', type: 'checkout', path: '' },
    { label: 'Purchase', type: 'purchase', path: '' },
];

// ─── Build a smart funnel from live data ─────────────────────────────────────
function buildSmartSteps(eventTypes, topPaths) {
    const steps = [];

    topPaths.slice(0, 4).forEach((p) => {
        const label = p.path === '/'
            ? 'Homepage'
            : p.path.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        steps.push({ label, type: 'pageview', path: p.path });
    });

    const CONVERSION_TYPES = ['add_to_cart', 'add_to_wishlist', 'checkout', 'purchase', 'signup', 'subscribe', 'submit'];
    const existingTypes = new Set(eventTypes.map((e) => e.type));
    CONVERSION_TYPES.forEach((t) => {
        if (existingTypes.has(t)) {
            const label = t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            steps.push({ label, type: t, path: '' });
        }
    });

    if (steps.length < 2 && topPaths.length >= 2) {
        topPaths.slice(0, 4).forEach((p) => {
            if (!steps.some((s) => s.path === p.path)) {
                steps.push({ label: p.path, type: 'pageview', path: p.path });
            }
        });
    }

    return steps.length >= 2 ? steps : FALLBACK_STEPS;
}

function uid() {
    return Math.random().toString(36).slice(2, 9);
}

function withIds(steps) {
    return steps.map((s) => ({ ...s, _id: uid() }));
}

function StepRow({ step, idx, eventTypes, topPaths, onChange, onRemove, canRemove }) {
    const needsPath = step.type === 'pageview';

    return (
        <div className="flex items-start gap-3 p-4 bg-bg dark:bg-bg-dark rounded-xl border border-border dark:border-border-dark transition-all hover:border-accent/40">
            <span
                className="mt-1 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
            >
                {idx + 1}
            </span>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                    value={step.label}
                    onChange={(e) => onChange({ ...step, label: e.target.value })}
                    placeholder="Step label"
                    className="px-3 py-2 rounded-lg border border-border dark:border-border-dark bg-card dark:bg-card-dark text-text-primary dark:text-text-primary-dark text-sm focus:outline-none focus:border-accent"
                />
                <div className="relative">
                    <select
                        value={step.type}
                        onChange={(e) => onChange({
                            ...step,
                            type: e.target.value,
                            path: e.target.value === 'pageview' ? (step.path || '/') : '',
                        })}
                        className="w-full px-3 py-2 rounded-lg border border-border dark:border-border-dark bg-card dark:bg-card-dark text-text-primary dark:text-text-primary-dark text-sm focus:outline-none focus:border-accent appearance-none pr-8"
                    >
                        {eventTypes.length > 0
                            ? eventTypes.map((et) => (
                                <option key={et.type} value={et.type}>
                                    {et.type} ({et.count.toLocaleString()})
                                </option>
                            ))
                            : ['pageview', 'click', 'add_to_cart', 'checkout', 'purchase'].map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))
                        }
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                </div>
                {needsPath ? (
                    <div className="relative">
                        <input
                            list={`paths-${step._id}`}
                            value={step.path}
                            onChange={(e) => onChange({ ...step, path: e.target.value })}
                            placeholder="e.g. /products"
                            className="w-full px-3 py-2 rounded-lg border border-border dark:border-border-dark bg-card dark:bg-card-dark text-text-primary dark:text-text-primary-dark text-sm focus:outline-none focus:border-accent"
                        />
                        <datalist id={`paths-${step._id}`}>
                            {topPaths.map((p) => (
                                <option key={p.path} value={p.path}>
                                    {p.path} — {p.count.toLocaleString()} views
                                </option>
                            ))}
                        </datalist>
                    </div>
                ) : (
                    <div className="px-3 py-2 rounded-lg border border-dashed border-border dark:border-border-dark text-sm text-text-muted dark:text-text-muted-dark italic">
                        any path
                    </div>
                )}
            </div>

            <button
                onClick={onRemove}
                disabled={!canRemove}
                className="mt-1 p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Remove step"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
}

export default function Funnels() {
    const { data: availableSteps, loading: stepsLoading } = useAnalytics('getFunnelSteps');

    const eventTypes = availableSteps?.eventTypes || [];
    const topPaths = availableSteps?.topPaths || [];

    const { saveFunnel } = useFunnelStore();
    const [builderSteps, setBuilderSteps] = useState(withIds(FALLBACK_STEPS));
    const autoPopulatedRef = useRef(false);
    const [appliedSteps, setAppliedSteps] = useState(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (autoPopulatedRef.current) return;
        if (eventTypes.length === 0 && topPaths.length === 0) return;
        autoPopulatedRef.current = true;
        const smart = buildSmartSteps(eventTypes, topPaths);
        setBuilderSteps(withIds(smart));
        setAppliedSteps(smart.map(({ label, type, path }) => ({ label, type, ...(path ? { path } : {}) })));
    }, [eventTypes.length, topPaths.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleStepChange = useCallback((idx, updated) => {
        setBuilderSteps((prev) => prev.map((s, i) => (i === idx ? { ...updated, _id: s._id } : s)));
    }, []);

    const handleAddStep = useCallback(() => {
        const firstType = eventTypes[0]?.type || 'pageview';
        setBuilderSteps((prev) => [
            ...prev,
            { _id: uid(), label: `Step ${prev.length + 1}`, type: firstType, path: firstType === 'pageview' ? '/' : '' },
        ]);
    }, [eventTypes]);

    const handleRemoveStep = useCallback((idx) => {
        setBuilderSteps((prev) => prev.filter((_, i) => i !== idx));
    }, []);

    const handleRun = useCallback(() => {
        const cleanSteps = builderSteps.map(({ label, type, path }) => ({
            label, type, ...(path ? { path } : {}),
        }));
        setAppliedSteps(cleanSteps);
    }, [builderSteps]);

    const handleReset = useCallback(() => {
        autoPopulatedRef.current = false;
        setBuilderSteps(withIds(FALLBACK_STEPS));
        setAppliedSteps(null);
    }, []);

    const handleAutoDetect = useCallback(() => {
        if (eventTypes.length === 0 && topPaths.length === 0) return;
        const smart = buildSmartSteps(eventTypes, topPaths);
        setBuilderSteps(withIds(smart));
        setAppliedSteps(smart.map(({ label, type, path }) => ({ label, type, ...(path ? { path } : {}) })));
    }, [eventTypes, topPaths]);

    const handleSave = useCallback(() => {
        if (!appliedSteps) return;
        saveFunnel(appliedSteps);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    }, [appliedSteps, saveFunnel]);

    return (
        <div className="space-y-8">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Funnels</h1>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                        Visualise conversion through your actual user journeys
                    </p>
                </div>
                <button
                    onClick={handleAutoDetect}
                    disabled={stepsLoading || (eventTypes.length === 0 && topPaths.length === 0)}
                    title="Auto-detect steps from your real tracked data"
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Sparkles className="w-4 h-4" />
                    {stepsLoading ? 'Detecting…' : 'Auto-detect'}
                </button>
            </div>

            <PageNote
                title="What is Funnel Analysis?"
                summary="A funnel shows how many visitors complete each step in a multi-step process — like visiting a product page, adding to cart, and then purchasing. Drop-offs between steps reveal where you lose people."
                details={[
                    { label: 'Steps', text: 'Each step is either a pageview (visitor loaded a specific URL) or an event (visitor triggered a tracked action like add_to_cart or purchase).' },
                    { label: 'Drop-off Rate', text: 'The percentage of visitors who did not proceed to the next step. High drop-off at the checkout step usually means friction (confusing form, unexpected shipping costs, etc.).' },
                    { label: 'Auto-detect', text: 'InsightTrack can automatically suggest funnel steps based on your most visited pages and most common tracked events. Edit the steps to match your exact customer journey.' },
                    { label: 'Save & Share', text: 'Saved funnels appear on your main Dashboard for quick access without needing to rebuild them each time.' },
                ]}
                businessTip="Build a funnel for your most important customer journey first (e.g. Homepage → Pricing → Sign-up). Even a 5% improvement in the worst drop-off step can significantly increase your conversion rate."
                devTip="Funnel data is queried from DuckDB using CTEs that join ordered session events. Each step checks for a matching pageview or event type in the session. Served from GET /api/analytics/:siteId/funnel with steps[] in the query params."
            />

            <div className="bg-card dark:bg-card-dark rounded-2xl border border-border dark:border-border-dark p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10">
                        <GitMerge className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
                            Funnel Builder
                        </h2>
                        <p className="text-xs text-text-muted dark:text-text-muted-dark">
                            Steps auto-populated from your real tracked events and top pages
                        </p>
                    </div>
                </div>

                <div className="hidden sm:grid sm:grid-cols-3 gap-3 px-10 text-xs font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-wider">
                    <span>Label</span>
                    <span>Event Type</span>
                    <span>Path filter</span>
                </div>

                <div className="space-y-2">
                    {builderSteps.map((step, idx) => (
                        <StepRow
                            key={step._id}
                            step={step}
                            idx={idx}
                            eventTypes={eventTypes}
                            topPaths={topPaths}
                            onChange={(updated) => handleStepChange(idx, updated)}
                            onRemove={() => handleRemoveStep(idx)}
                            canRemove={builderSteps.length > 2}
                        />
                    ))}
                </div>

                <div className="flex items-center gap-3 pt-2 flex-wrap">
                    <button
                        onClick={handleAddStep}
                        disabled={builderSteps.length >= 10}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border dark:border-border-dark text-sm text-text-secondary dark:text-text-secondary-dark hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4" /> Add Step
                    </button>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border dark:border-border-dark text-sm text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" /> Reset
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            disabled={!appliedSteps}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed ${saved
                                    ? 'bg-green-500 text-white'
                                    : 'bg-accent/10 text-accent hover:bg-accent/20'
                                }`}
                            title="Pin this funnel to the Dashboard"
                        >
                            <BookmarkCheck className="w-4 h-4" />
                            {saved ? 'Saved!' : 'Save to Dashboard'}
                        </button>
                        <button
                            onClick={handleRun}
                            className="flex items-center gap-2 px-5 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium shadow-sm"
                        >
                            <Play className="w-4 h-4" /> Run Funnel
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl">
                <FunnelChart steps={appliedSteps} />
            </div>
        </div>
    );
}

