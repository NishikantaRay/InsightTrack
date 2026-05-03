import { describe, it, expect, beforeEach } from 'vitest';
import { useSiteStore } from '../store/useSiteStore';

describe('useSiteStore', () => {
    beforeEach(() => {
        localStorage.clear();
        useSiteStore.setState({ siteId: null, sites: [] });
    });

    it('should default to null siteId', () => {
        expect(useSiteStore.getState().siteId).toBeNull();
    });

    it('should set siteId and persist to localStorage', () => {
        useSiteStore.getState().setSiteId('site_abc');
        expect(useSiteStore.getState().siteId).toBe('site_abc');
        expect(localStorage.getItem('analytics-site-id')).toBe('site_abc');
    });

    it('should set sites array', () => {
        const sites = [
            { id: 'site_1', name: 'Site A' },
            { id: 'site_2', name: 'Site B' },
        ];
        useSiteStore.getState().setSites(sites);
        expect(useSiteStore.getState().sites).toEqual(sites);
    });
});
