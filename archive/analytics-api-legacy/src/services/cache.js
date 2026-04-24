// In-memory cache with TTL support
class AnalyticsCache {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = parseInt(process.env.CACHE_DEFAULT_TTL_MS) || 60 * 1000;
        // Cleanup expired entries periodically
        this.cleanupInterval = setInterval(() => this.cleanup(), parseInt(process.env.CACHE_CLEANUP_INTERVAL_MS) || 5 * 60 * 1000);
    }

    // Generate cache key from endpoint + params
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
        this.cache.set(cacheKey, {
            data,
            expiresAt: Date.now() + ttlMs,
        });
    }

    invalidate(pattern) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    clear() {
        this.cache.clear();
    }

    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    get size() {
        return this.cache.size;
    }

    destroy() {
        clearInterval(this.cleanupInterval);
        this.cache.clear();
    }
}

export const analyticsCache = new AnalyticsCache();

// TTL presets for different query types
export const CACHE_TTL = {
    REALTIME: parseInt(process.env.CACHE_TTL_REALTIME_MS) || 10 * 1000,
    KPI: parseInt(process.env.CACHE_TTL_KPI_MS) || 30 * 1000,
    TRAFFIC: parseInt(process.env.CACHE_TTL_TRAFFIC_MS) || 60 * 1000,
    PAGES: parseInt(process.env.CACHE_TTL_PAGES_MS) || 60 * 1000,
    GENERAL: parseInt(process.env.CACHE_TTL_GENERAL_MS) || 2 * 60 * 1000,
};

export default analyticsCache;
