import { describe, it, expect } from 'vitest';

// Small caps make the thresholds easy to hit; set BEFORE import (read at load).
process.env.ASSISTANT_TOOL_MAX_ROWS = '5';
process.env.ASSISTANT_TOOL_MAX_CHARS = '400';

const { capToolData, envelopeForModel } = await import('../src/mcp/tools/registry.js');

describe('capToolData — tool-result size guardrails (N7)', () => {
    it('passes small arrays through untouched (no note)', () => {
        const { data, note } = capToolData([1, 2, 3]);
        expect(data).toEqual([1, 2, 3]);
        expect(note).toBeNull();
    });

    it('caps arrays longer than MAX_ROWS and reports the total', () => {
        const rows = Array.from({ length: 12 }, (_, i) => ({ i }));
        const { data, note } = capToolData(rows);
        expect(data.length).toBe(5);
        expect(note).toContain('first 5 of 12 rows');
    });

    it('falls back further on the char cap for wide rows', () => {
        // 5 rows would pass the row cap, but each is big → char cap trims more.
        const rows = Array.from({ length: 5 }, (_, i) => ({ i, blob: 'x'.repeat(200) }));
        const { data, note } = capToolData(rows);
        expect(data.length).toBeLessThan(5);
        expect(JSON.stringify(data).length).toBeLessThanOrEqual(400);
        expect(note).toContain('truncated to fit');
    });

    it('replaces an over-large non-array object with a marker', () => {
        const { data, note } = capToolData({ blob: 'y'.repeat(1000) });
        expect(data).toEqual({ _truncated: true });
        expect(note).toContain('too large');
    });

    it('handles null data', () => {
        expect(capToolData(null)).toEqual({ data: null, note: null });
    });
});

describe('envelopeForModel — the LLM-facing view', () => {
    it('keeps the summary and folds the cap note into it', () => {
        const rows = Array.from({ length: 12 }, (_, i) => ({ i }));
        const env = { summary: 'Top pages.', data: rows, render: { type: 'table' }, download: {}, deepLink: {} };
        const forModel = envelopeForModel(env);
        // UI-only fields are dropped; data is capped; note appended to summary.
        expect(Object.keys(forModel).sort()).toEqual(['data', 'summary']);
        expect(forModel.data.length).toBe(5);
        expect(forModel.summary).toContain('Top pages.');
        expect(forModel.summary).toContain('first 5 of 12 rows');
    });
});
