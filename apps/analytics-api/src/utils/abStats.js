/**
 * Statistical significance for A/B conversion tests.
 *
 * Variant results previously reported raw conversion rates only, which invites
 * the most common testing mistake: calling a winner on a difference that is
 * indistinguishable from noise. These helpers add a two-proportion z-test so a
 * result can say whether the difference is significant, and at what confidence.
 *
 * Scope, stated honestly:
 *   - This is a fixed-horizon frequentist test. It assumes you decided the
 *     sample size in advance. Repeatedly checking and stopping the moment
 *     p < 0.05 ("peeking") inflates the false-positive rate well beyond 5%.
 *   - It compares each variant against the first (control) variant only.
 *   - With more than two variants the per-comparison error compounds; treat a
 *     multi-variant result as directional, not decisive.
 *   - No Bayesian posterior, no sequential testing, no minimum-detectable-effect
 *     calculator. Those are deliberate omissions, not oversights.
 */

/**
 * Standard normal cumulative distribution function.
 * Abramowitz & Stegun 7.1.26 approximation of erf; accurate to ~1e-7, which is
 * far beyond what a conversion test needs.
 */
function normalCdf(z) {
    const sign = z < 0 ? -1 : 1;
    const x = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
}

/**
 * Two-proportion z-test comparing a variant against a control.
 *
 * @param {number} controlConversions
 * @param {number} controlVisitors
 * @param {number} variantConversions
 * @param {number} variantVisitors
 * @returns {{zScore:number|null, pValue:number|null, confidence:number|null,
 *            significant:boolean, uplift:number|null, reliable:boolean}}
 */
export function twoProportionZTest(controlConversions, controlVisitors, variantConversions, variantVisitors) {
    const empty = { zScore: null, pValue: null, confidence: null, significant: false, uplift: null, reliable: false };

    if (!Number.isFinite(controlVisitors) || !Number.isFinite(variantVisitors)) return empty;
    if (controlVisitors <= 0 || variantVisitors <= 0) return empty;

    const p1 = controlConversions / controlVisitors;
    const p2 = variantConversions / variantVisitors;

    // Pooled proportion under the null hypothesis that both rates are equal.
    const pooled = (controlConversions + variantConversions) / (controlVisitors + variantVisitors);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / controlVisitors + 1 / variantVisitors));

    // Zero variance: either nobody converted, or everybody did.
    if (se === 0) return { ...empty, uplift: p1 > 0 ? Math.round(((p2 - p1) / p1) * 1000) / 10 : null };

    const z = (p2 - p1) / se;
    const pValue = 2 * (1 - normalCdf(Math.abs(z)));   // two-tailed

    // The normal approximation needs a reasonable expected count in each cell.
    // Below this the p-value is not trustworthy and is reported as unreliable.
    const reliable =
        controlVisitors * pooled >= 5 && controlVisitors * (1 - pooled) >= 5 &&
        variantVisitors * pooled >= 5 && variantVisitors * (1 - pooled) >= 5;

    return {
        zScore: Math.round(z * 1000) / 1000,
        pValue: Math.round(pValue * 10000) / 10000,
        confidence: Math.round((1 - pValue) * 1000) / 10,
        significant: reliable && pValue < 0.05,
        uplift: p1 > 0 ? Math.round(((p2 - p1) / p1) * 1000) / 10 : null,
        reliable,
    };
}

/**
 * Annotate variant results with significance against the first variant.
 * The control itself gets `isControl: true` and no test statistics.
 *
 * @param {Array<{visitors:number, conversions:number}>} variants
 * @returns {Array<object>} same array shape with stats merged in
 */
export function addSignificance(variants) {
    if (!Array.isArray(variants) || variants.length < 2) return variants || [];

    const [control, ...rest] = variants;
    const annotated = [{ ...control, isControl: true }];

    for (const v of rest) {
        annotated.push({
            ...v,
            isControl: false,
            ...twoProportionZTest(control.conversions, control.visitors, v.conversions, v.visitors),
        });
    }
    return annotated;
}
