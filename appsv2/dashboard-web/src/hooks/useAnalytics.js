import { useState, useEffect, useCallback, useRef } from 'react';
import { analyticsAPI } from '../services/api';
import { useDateFilterStore } from '../store/useDateFilterStore';
import { useSiteStore } from '../store/useSiteStore';

export function useAnalytics(endpoint, options = {}) {
    // `dateRange` pins a hook to a fixed window, overriding the global filter.
    // Used where a shorter range would silently produce a wrong answer rather
    // than just less data (see useSearchVisibility).
    const { params = {}, enabled = true, dateRange: fixedRange = null } = options;
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const dateRange = useDateFilterStore((s) => s.dateRange);
    const customStart = useDateFilterStore((s) => s.customStart);
    const customEnd = useDateFilterStore((s) => s.customEnd);
    const siteId = useSiteStore((s) => s.siteId);
    const abortRef = useRef(null);

    const fetchData = useCallback(async () => {
        if (!enabled || !siteId) return;

        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const fetcher = analyticsAPI[endpoint];
            if (!fetcher) throw new Error(`Unknown endpoint: ${endpoint}`);

            const effectiveDateRange = fixedRange
                ? fixedRange
                : dateRange === 'custom' && customStart && customEnd
                    ? `custom:${customStart}:${customEnd}`
                    : dateRange;

            const result = await fetcher(siteId, effectiveDateRange, ...Object.values(params));
            if (!controller.signal.aborted) {
                setData(result?.data ?? result);
                setLoading(false);
            }
        } catch (err) {
            if (!controller.signal.aborted) {
                setError(err.message);
                setLoading(false);
            }
        }
    }, [endpoint, siteId, dateRange, customStart, customEnd, enabled, fixedRange, JSON.stringify(params)]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => {
            clearInterval(interval);
            if (abortRef.current) abortRef.current.abort();
        };
    }, [fetchData]);

    return { data, loading, error, refetch: fetchData };
}

export function useRealtime() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const siteId = useSiteStore((s) => s.siteId);

    useEffect(() => {
        if (!siteId) return;

        const fetch = async () => {
            try {
                const result = await analyticsAPI.getRealtime(siteId);
                setData(result?.data ?? result);
                setLoading(false);
            } catch {
                setLoading(false);
            }
        };

        fetch();
        // 15s, deliberately faster than the 60s used elsewhere. An earlier
        // change raised this to 60s on the grounds that the route caches for
        // 10s, but the real floor is the PG -> DuckDB sync (SYNC_INTERVAL_MS,
        // default 60s): tracking writes land in Postgres and realtime reads
        // come from DuckDB, so a visit is invisible until a sync copies it.
        // Against a 5-minute realtime window, a 60s poll made a single visit
        // easy to miss entirely on a low-traffic site. Polling faster does not
        // beat the sync, but it picks events up promptly once they land.
        const interval = setInterval(fetch, 15000);
        return () => clearInterval(interval);
    }, [siteId]);

    return { data, loading };
}

export function useRealtimeEventStream() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const siteId = useSiteStore((s) => s.siteId);

    useEffect(() => {
        if (!siteId) return;

        const fetchEvents = async () => {
            try {
                const result = await analyticsAPI.getRealtimeEventStream(siteId, 50);
                setData(result?.data ?? result);
                setLoading(false);
            } catch {
                setLoading(false);
            }
        };

        fetchEvents();
        // 10s — same reasoning as useRealtime above.
        const interval = setInterval(fetchEvents, 10000);
        return () => clearInterval(interval);
    }, [siteId]);

    return { data, loading };
}


// ── Search visibility (SerpApi × first-party traffic) ────────────────────────
// Per project convention, components fetch through these hooks rather than
// calling axios in a useEffect.

/**
 * Every tracked page with its traffic change, rank and AI answer status.
 *
 * Deliberately IGNORES the global date filter. The correlation buckets traffic
 * into ISO weeks and compares the last two complete ones, which needs a long
 * window to be reliable — page-level data is noisy at short ranges. Letting the
 * toolbar set "Last 7 days" here would silently produce a comparison with one
 * week of history and no prior week to compare against.
 */
export function useSearchVisibility(limit = 10) {
    return useAnalytics('getSearchOverview', { params: { limit }, dateRange: '90d' });
}

/** The joined traffic×SERP explanation for ONE page. */
export function useSearchExplanation(path) {
    return useAnalytics('getSearchExplain', { params: { path }, enabled: !!path });
}

/** Current ranking detail for one keyword. */
export function useRankings(keyword) {
    return useAnalytics('getSearchRankings', { params: { keyword }, enabled: !!keyword });
}

/** Rank observations over time for one keyword. */
export function useRankHistory(keyword) {
    return useAnalytics('getSearchRankHistory', { params: { keyword }, enabled: !!keyword });
}

/** 'People also ask' + related searches for one keyword. */
export function useRelatedQueries(keyword, limit = 10) {
    return useAnalytics('getSearchRelated', { params: { keyword, limit }, enabled: !!keyword });
}

/**
 * In-app rank / AI-answer alerts, newest first, plus the unread count.
 * `status` is 'all' or 'unread'. Refreshes on the usual 60s cadence.
 */
export function useSearchAlerts(status = 'all', limit = 50) {
    return useAnalytics('getSearchAlerts', { params: { status, limit } });
}
