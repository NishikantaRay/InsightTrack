/**
 * Statistical summary helpers for benchmark timings.
 *
 * Reporting a bare mean hides exactly what matters for latency: the tail and the
 * spread. Every measurement set is therefore summarised with median, mean, p95,
 * p99, min, max and standard deviation, and the raw samples are retained in the
 * machine-readable output so the numbers can be re-analysed independently.
 *
 * Percentiles use the nearest-rank method on the sorted sample, which is exact
 * for a given sample set and needs no interpolation assumptions.
 */

/** Nearest-rank percentile. `p` in [0, 1]. `sorted` must be ascending. */
export function percentile(sorted, p) {
    if (sorted.length === 0) return null;
    if (sorted.length === 1) return sorted[0];
    const rank = Math.ceil(p * sorted.length);
    const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
    return sorted[idx];
}

/** Sample standard deviation (n-1 denominator). */
export function stddev(values, meanValue) {
    if (values.length < 2) return 0;
    const m = meanValue ?? values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
}

/**
 * Summarise a set of timing samples (milliseconds).
 * @param {number[]} samples
 * @returns {object} summary with n, min, max, mean, median, p95, p99, stddev
 */
export function summarise(samples) {
    if (!Array.isArray(samples) || samples.length === 0) {
        return { n: 0, min: null, max: null, mean: null, median: null, p95: null, p99: null, stddev: null };
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    return {
        n: samples.length,
        min: round(sorted[0]),
        max: round(sorted[sorted.length - 1]),
        mean: round(mean),
        median: round(percentile(sorted, 0.5)),
        p95: round(percentile(sorted, 0.95)),
        p99: round(percentile(sorted, 0.99)),
        stddev: round(stddev(samples, mean)),
    };
}

function round(v) {
    return v === null || v === undefined ? null : Math.round(v * 1000) / 1000;
}
