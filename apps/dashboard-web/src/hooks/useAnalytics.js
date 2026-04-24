import { useState, useEffect, useCallback, useRef } from 'react';
import { analyticsAPI } from '../services/api';
import { useDateFilterStore } from '../store/useDateFilterStore';
import { useSiteStore } from '../store/useSiteStore';

export function useAnalytics(endpoint, options = {}) {
    const { params = {}, enabled = true } = options;
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

            const effectiveDateRange = dateRange === 'custom' && customStart && customEnd
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
    }, [endpoint, siteId, dateRange, customStart, customEnd, enabled, JSON.stringify(params)]);

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
        const interval = setInterval(fetchEvents, 10000);
        return () => clearInterval(interval);
    }, [siteId]);

    return { data, loading };
}
