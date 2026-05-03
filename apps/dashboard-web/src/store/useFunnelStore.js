import { create } from 'zustand';

const STORAGE_KEY = 'insighttrack-saved-funnel';

function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export const useFunnelStore = create((set) => ({
    savedSteps: loadFromStorage(),

    saveFunnel: (steps) => {
        const clean = steps.map(({ label, type, path }) => ({
            label,
            type,
            ...(path ? { path } : {}),
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
        set({ savedSteps: clean });
    },

    clearSavedFunnel: () => {
        localStorage.removeItem(STORAGE_KEY);
        set({ savedSteps: null });
    },
}));
