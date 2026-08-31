/**
 * Tests for A/B significance testing.
 *
 * These exist because variant results previously reported raw conversion rates
 * only, which invites calling a winner on a difference that is noise.
 */
import { describe, it, expect } from 'vitest';
import { twoProportionZTest, addSignificance } from '../src/utils/abStats.js';

describe('twoProportionZTest', () => {
    it('detects a clear winner', () => {
        // 10% vs 15% at n=1000 each is a large, unambiguous difference
        const r = twoProportionZTest(100, 1000, 150, 1000);
        expect(r.significant).toBe(true);
        expect(r.reliable).toBe(true);
        expect(r.pValue).toBeLessThan(0.01);
        expect(r.uplift).toBe(50);
        expect(r.confidence).toBeGreaterThan(99);
    });

    it('does not call a winner on noise', () => {
        const r = twoProportionZTest(100, 1000, 102, 1000);
        expect(r.significant).toBe(false);
        expect(r.pValue).toBeGreaterThan(0.05);
    });

    it('flags small samples as unreliable and never significant', () => {
        const r = twoProportionZTest(1, 10, 3, 10);
        expect(r.reliable).toBe(false);
        expect(r.significant).toBe(false);
    });

    it('returns nulls rather than NaN for degenerate input', () => {
        for (const r of [
            twoProportionZTest(0, 0, 0, 0),
            twoProportionZTest(0, 500, 0, 500),   // zero variance
            twoProportionZTest(5, 0, 5, 100),
        ]) {
            expect(r.zScore === null || Number.isFinite(r.zScore)).toBe(true);
            expect(Number.isNaN(r.pValue)).toBe(false);
            expect(r.significant).toBe(false);
        }
    });

    it('reports negative uplift when the variant is worse', () => {
        const r = twoProportionZTest(150, 1000, 100, 1000);
        expect(r.uplift).toBeLessThan(0);
    });

    it('is symmetric in magnitude', () => {
        const a = twoProportionZTest(100, 1000, 150, 1000);
        const b = twoProportionZTest(150, 1000, 100, 1000);
        expect(Math.abs(a.zScore)).toBeCloseTo(Math.abs(b.zScore), 3);
        expect(a.pValue).toBeCloseTo(b.pValue, 4);
    });
});

describe('addSignificance', () => {
    it('marks the first variant as control and annotates the rest', () => {
        const out = addSignificance([
            { name: 'A', visitors: 1000, conversions: 100 },
            { name: 'B', visitors: 1000, conversions: 150 },
        ]);
        expect(out[0].isControl).toBe(true);
        expect(out[0].pValue).toBeUndefined();
        expect(out[1].isControl).toBe(false);
        expect(out[1].significant).toBe(true);
    });

    it('passes through when there is nothing to compare', () => {
        expect(addSignificance([])).toEqual([]);
        expect(addSignificance([{ name: 'A', visitors: 10, conversions: 1 }]).length).toBe(1);
        expect(addSignificance(null)).toEqual([]);
    });

    it('handles more than two variants', () => {
        const out = addSignificance([
            { name: 'A', visitors: 1000, conversions: 100 },
            { name: 'B', visitors: 1000, conversions: 150 },
            { name: 'C', visitors: 1000, conversions: 90 },
        ]);
        expect(out).toHaveLength(3);
        expect(out[1].uplift).toBe(50);
        expect(out[2].uplift).toBeLessThan(0);
    });
});
