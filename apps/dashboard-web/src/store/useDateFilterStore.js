import { create } from 'zustand';

export const useDateFilterStore = create((set) => ({
    dateRange: '30d',
    customStart: null,
    customEnd: null,
    compareMode: false,
    setDateRange: (dateRange) => set({ dateRange, customStart: null, customEnd: null }),
    setCustomRange: (start, end) => set({ dateRange: 'custom', customStart: start, customEnd: end }),
    toggleCompareMode: () => set((state) => ({ compareMode: !state.compareMode })),
}));
