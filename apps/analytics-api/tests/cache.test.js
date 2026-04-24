import { describe, it, expect, beforeEach } from 'vitest';
import { analyticsCache, CACHE_TTL } from '../src/services/cache.js';

describe('AnalyticsCache', () => {
    beforeEach(() => {
        analyticsCache.clear();
    });

    describe('key()', () => {
        it('should produce a composite key', () => {
            const k = analyticsCache.key('traffic', 'site_1', '30d');
            expect(k).toBe('traffic:site_1:30d');
        });

        it('should handle null/undefined args', () => {
            const k = analyticsCache.key('kpi', null, undefined);
            expect(k).toBe('kpi::');
        });
    });

    describe('get() / set()', () => {
        it('should store and retrieve data', () => {
            analyticsCache.set('test-key', { visitors: 100 });
            const result = analyticsCache.get('test-key');
            expect(result).toEqual({ visitors: 100 });
        });

        it('should return null for missing key', () => {
            expect(analyticsCache.get('missing')).toBeNull();
        });

        it('should respect TTL expiration', async () => {
            analyticsCache.set('ttl-key', 'data', 50);
            expect(analyticsCache.get('ttl-key')).toBe('data');
            await new Promise((r) => setTimeout(r, 80));
            expect(analyticsCache.get('ttl-key')).toBeNull();
        });
    });

    describe('invalidate()', () => {
        it('should remove keys matching prefix', () => {
            analyticsCache.set('traffic:site_1:30d', [1]);
            analyticsCache.set('traffic:site_1:7d', [2]);
            analyticsCache.set('kpi:site_1:30d', [3]);

            analyticsCache.invalidate('traffic:site_1');
            expect(analyticsCache.get('traffic:site_1:30d')).toBeNull();
            expect(analyticsCache.get('traffic:site_1:7d')).toBeNull();
            expect(analyticsCache.get('kpi:site_1:30d')).toEqual([3]);
        });
    });

    describe('cleanup()', () => {
        it('should remove expired entries', async () => {
            analyticsCache.set('a', 1, 30);
            analyticsCache.set('b', 2, 5000);
            await new Promise((r) => setTimeout(r, 60));
            analyticsCache.cleanup();
            expect(analyticsCache.get('a')).toBeNull();
            expect(analyticsCache.get('b')).toBe(2);
        });
    });

    describe('size', () => {
        it('should track number of entries', () => {
            expect(analyticsCache.size).toBe(0);
            analyticsCache.set('a', 1);
            analyticsCache.set('b', 2);
            expect(analyticsCache.size).toBe(2);
        });
    });

    describe('clear()', () => {
        it('should remove all entries', () => {
            analyticsCache.set('a', 1);
            analyticsCache.set('b', 2);
            analyticsCache.clear();
            expect(analyticsCache.size).toBe(0);
        });
    });

    describe('CACHE_TTL presets', () => {
        it('should have expected TTL values', () => {
            expect(CACHE_TTL.REALTIME).toBe(10_000);
            expect(CACHE_TTL.KPI).toBe(30_000);
            expect(CACHE_TTL.TRAFFIC).toBe(60_000);
            expect(CACHE_TTL.GENERAL).toBe(120_000);
        });
    });
});
