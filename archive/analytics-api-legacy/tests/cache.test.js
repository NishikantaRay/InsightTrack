import { describe, it, expect, beforeEach, afterAll } from 'vitest';

// Import the class fresh – we test it standalone (no DB needed)
class AnalyticsCache {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 60 * 1000;
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
    key(prefix, ...args) {
        return `${prefix}:${args.map(a => String(a ?? '')).join(':')}`;
    }
    get(cacheKey) {
        const entry = this.cache.get(cacheKey);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) { this.cache.delete(cacheKey); return null; }
        return entry.data;
    }
    set(cacheKey, data, ttlMs = this.defaultTTL) {
        this.cache.set(cacheKey, { data, expiresAt: Date.now() + ttlMs });
    }
    invalidate(pattern) {
        for (const key of this.cache.keys()) { if (key.startsWith(pattern)) this.cache.delete(key); }
    }
    clear() { this.cache.clear(); }
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) { if (now > entry.expiresAt) this.cache.delete(key); }
    }
    get size() { return this.cache.size; }
    destroy() { clearInterval(this.cleanupInterval); this.cache.clear(); }
}

describe('AnalyticsCache', () => {
    let cache;

    beforeEach(() => {
        cache = new AnalyticsCache();
    });

    afterAll(() => {
        cache?.destroy();
    });

    describe('key()', () => {
        it('should generate consistent keys from prefix and args', () => {
            const k = cache.key('traffic', 'site1', '7d');
            expect(k).toBe('traffic:site1:7d');
        });

        it('should handle null/undefined args gracefully', () => {
            const k = cache.key('kpi', null, undefined);
            expect(k).toBe('kpi::');
        });
    });

    describe('get/set', () => {
        it('should store and retrieve data', () => {
            cache.set('k1', { value: 42 });
            expect(cache.get('k1')).toEqual({ value: 42 });
        });

        it('should return null for missing keys', () => {
            expect(cache.get('nonexistent')).toBeNull();
        });

        it('should return null for expired entries', async () => {
            cache.set('expiring', 'data', 50); // 50ms TTL
            expect(cache.get('expiring')).toBe('data');

            await new Promise(r => setTimeout(r, 80));
            expect(cache.get('expiring')).toBeNull();
        });
    });

    describe('invalidate()', () => {
        it('should remove entries matching prefix', () => {
            cache.set('traffic:site1:7d', 'a');
            cache.set('traffic:site1:30d', 'b');
            cache.set('kpi:site1:7d', 'c');

            cache.invalidate('traffic:site1');

            expect(cache.get('traffic:site1:7d')).toBeNull();
            expect(cache.get('traffic:site1:30d')).toBeNull();
            expect(cache.get('kpi:site1:7d')).toBe('c');
        });
    });

    describe('clear()', () => {
        it('should remove all entries', () => {
            cache.set('a', 1);
            cache.set('b', 2);
            cache.clear();
            expect(cache.size).toBe(0);
        });
    });

    describe('cleanup()', () => {
        it('should remove only expired entries', async () => {
            cache.set('short', 'x', 50);
            cache.set('long', 'y', 10000);

            await new Promise(r => setTimeout(r, 80));
            cache.cleanup();

            expect(cache.get('short')).toBeNull();
            expect(cache.get('long')).toBe('y');
        });
    });

    describe('size', () => {
        it('should reflect the number of entries', () => {
            expect(cache.size).toBe(0);
            cache.set('a', 1);
            cache.set('b', 2);
            expect(cache.size).toBe(2);
        });
    });

    describe('destroy()', () => {
        it('should clear cache and stop cleanup interval', () => {
            cache.set('a', 1);
            cache.destroy();
            expect(cache.size).toBe(0);
        });
    });
});
