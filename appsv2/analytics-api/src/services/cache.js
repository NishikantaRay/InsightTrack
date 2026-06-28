// ── In-memory cache with TTL + request coalescing ────────────────────────────
//
// Request coalescing (thundering herd protection):
// When a cache key expires and multiple concurrent requests miss at the same
// moment, only ONE upstream query is fired. All other waiters subscribe to the
// same in-flight promise and receive the result when it resolves.
// This prevents N simultaneous DuckDB scans for the same data.

class AnalyticsCache {
    constructor() {
        this.cache = new Map();
        this.inFlight = new Map();   // key → Promise (coalescing map)
        this.defaultTTL = parseInt(process.env.CACHE_DEFAULT_TTL_MS) || 60_000;
        this.cleanupInterval = setInterval(
            () => this.cleanup(),
            parseInt(process.env.CACHE_CLEANUP_INTERVAL_MS) || 5 * 60_000,
        );
    }

    key(prefix, ...args) {
        return `${prefix}:${args.map(a => String(a ?? '')).join(':')}`;
    }

    get(cacheKey) {
        const entry = this.cache.get(cacheKey);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(cacheKey);
            return null;
        }
        return entry.data;
    }

    set(cacheKey, data, ttlMs = this.defaultTTL) {
        this.cache.set(cacheKey, { data, expiresAt: Date.now() + ttlMs });
    }

    /**
     * Coalesced get-or-fetch.
     * If the key is cached → return immediately.
     * If a fetch is already in-flight for this key → await the same promise.
     * Otherwise → call fetchFn(), cache the result, resolve all waiters.
     */
    async getOrFetch(cacheKey, ttlMs, fetchFn) {
        const cached = this.get(cacheKey);
        if (cached !== null) return cached;

        // Another request is already fetching this key — join it
        if (this.inFlight.has(cacheKey)) {
            return this.inFlight.get(cacheKey);
        }

        // We are the first — start the fetch and register it
        const promise = fetchFn().then((data) => {
            this.set(cacheKey, data, ttlMs);
            this.inFlight.delete(cacheKey);
            return data;
        }).catch((err) => {
            this.inFlight.delete(cacheKey);
            throw err;
        });

        this.inFlight.set(cacheKey, promise);
        return promise;
    }

    invalidate(pattern) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(pattern)) this.cache.delete(key);
        }
        // Also cancel coalesced in-flight entries matching the pattern
        for (const key of this.inFlight.keys()) {
            if (key.startsWith(pattern)) this.inFlight.delete(key);
        }
    }

    clear() {
        this.cache.clear();
        this.inFlight.clear();
    }

    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) this.cache.delete(key);
        }
    }

    get size() { return this.cache.size; }

    destroy() {
        clearInterval(this.cleanupInterval);
        this.cache.clear();
        this.inFlight.clear();
    }
}

export const analyticsCache = new AnalyticsCache();

export const CACHE_TTL = {
    REALTIME: parseInt(process.env.CACHE_TTL_REALTIME_MS) || 10_000,
    KPI:      parseInt(process.env.CACHE_TTL_KPI_MS)      || 30_000,
    TRAFFIC:  parseInt(process.env.CACHE_TTL_TRAFFIC_MS)  || 60_000,
    PAGES:    parseInt(process.env.CACHE_TTL_PAGES_MS)    || 60_000,
    GENERAL:  parseInt(process.env.CACHE_TTL_GENERAL_MS)  || 120_000,
};

export default analyticsCache;
