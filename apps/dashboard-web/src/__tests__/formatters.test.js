import { describe, it, expect } from 'vitest';
import {
    formatNumber,
    formatDuration,
    formatPercent,
    formatDate,
    formatDateFull,
    CHART_COLORS,
    DATE_RANGES,
} from '../utils/formatters';

describe('formatNumber', () => {
    it('should format millions with M suffix', () => {
        expect(formatNumber(1_500_000)).toBe('1.5M');
        expect(formatNumber(2_000_000)).toBe('2.0M');
    });

    it('should format thousands with K suffix', () => {
        expect(formatNumber(1_500)).toBe('1.5K');
        expect(formatNumber(10_000)).toBe('10.0K');
    });

    it('should format small numbers with locale string', () => {
        expect(formatNumber(42)).toBe('42');
        expect(formatNumber(999)).toBe('999');
    });

    it('should return dash for null/undefined', () => {
        expect(formatNumber(null)).toBe('—');
        expect(formatNumber(undefined)).toBe('—');
    });

    it('should handle zero', () => {
        expect(formatNumber(0)).toBe('0');
    });
});

describe('formatDuration', () => {
    it('should format seconds only', () => {
        expect(formatDuration(45)).toBe('45s');
    });

    it('should format minutes and seconds', () => {
        expect(formatDuration(125)).toBe('2m 5s');
    });

    it('should format hours and minutes', () => {
        expect(formatDuration(3665)).toBe('1h 1m');
    });

    it('should return dash for null', () => {
        expect(formatDuration(null)).toBe('—');
        expect(formatDuration(undefined)).toBe('—');
    });

    it('should handle zero', () => {
        expect(formatDuration(0)).toBe('0s');
    });
});

describe('formatPercent', () => {
    it('should format percentage with 1 decimal', () => {
        expect(formatPercent(45.678)).toBe('45.7%');
    });

    it('should format whole numbers', () => {
        expect(formatPercent(100)).toBe('100.0%');
    });

    it('should return dash for null', () => {
        expect(formatPercent(null)).toBe('—');
    });
});

describe('formatDate', () => {
    it('should format date as short month and day', () => {
        const result = formatDate('2026-03-11');
        expect(result).toContain('Mar');
        expect(result).toContain('11');
    });

    it('should return empty for falsy input', () => {
        expect(formatDate('')).toBe('');
        expect(formatDate(null)).toBe('');
    });
});

describe('formatDateFull', () => {
    it('should format date with year', () => {
        const result = formatDateFull('2026-03-11');
        expect(result).toContain('2026');
        expect(result).toContain('Mar');
    });

    it('should return empty for falsy input', () => {
        expect(formatDateFull('')).toBe('');
    });
});

describe('CHART_COLORS', () => {
    it('should have at least 5 colors', () => {
        expect(CHART_COLORS.length).toBeGreaterThanOrEqual(5);
    });

    it('should contain valid hex colors', () => {
        CHART_COLORS.forEach((c) => {
            expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
        });
    });
});

describe('DATE_RANGES', () => {
    it('should have expected presets', () => {
        const values = DATE_RANGES.map((r) => r.value);
        expect(values).toContain('1d');
        expect(values).toContain('7d');
        expect(values).toContain('30d');
        expect(values).toContain('90d');
        expect(values).toContain('custom');
    });

    it('should have labels for each range', () => {
        DATE_RANGES.forEach((r) => {
            expect(r.label).toBeTruthy();
            expect(r.value).toBeTruthy();
        });
    });
});
