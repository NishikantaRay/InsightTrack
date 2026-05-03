import { create } from 'zustand';

export const useSiteStore = create((set) => ({
    siteId: localStorage.getItem('analytics-site-id') || null,
    sites: [],
    setSiteId: (siteId) => {
        localStorage.setItem('analytics-site-id', siteId);
        set({ siteId });
    },
    setSites: (sites) => set({ sites }),
}));
