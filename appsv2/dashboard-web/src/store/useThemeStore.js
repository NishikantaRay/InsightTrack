import { create } from 'zustand';

const getInitialTheme = () => {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem('analytics-theme');
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useThemeStore = create((set) => ({
    theme: getInitialTheme(),
    toggleTheme: () =>
        set((state) => {
            const next = state.theme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('analytics-theme', next);
            return { theme: next };
        }),
    setTheme: (theme) => {
        localStorage.setItem('analytics-theme', theme);
        set({ theme });
    },
}));
