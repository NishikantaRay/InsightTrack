import { create } from 'zustand';

const getInitialFocus = () => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('analytics-focus-mode') === 'true';
};

export const useFocusModeStore = create((set) => ({
    focusMode: getInitialFocus(),
    toggleFocusMode: () =>
        set((state) => {
            const next = !state.focusMode;
            localStorage.setItem('analytics-focus-mode', next);
            return { focusMode: next };
        }),
}));
