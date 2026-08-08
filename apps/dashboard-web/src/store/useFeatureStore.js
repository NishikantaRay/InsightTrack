import { create } from 'zustand';

const STORAGE_KEY = 'analytics-feature-visibility';

// All nav items that can be shown/hidden.
// 'protected' items cannot be hidden (Settings, Profile, Docs are never hidden).
export const ALL_NAV_FEATURES = [
    { key: 'dashboard',   label: 'Dashboard',    group: 'Core',        protected: true },
    { key: 'realtime',    label: 'Realtime',      group: 'Core',        protected: false },
    { key: 'pages',       label: 'Pages',         group: 'Content',     protected: false },
    { key: 'heatmap',     label: 'Heatmap',       group: 'Content',     protected: false },
    { key: 'content',     label: 'Content',       group: 'Content',     protected: false },
    { key: 'engagement',  label: 'Engagement',    group: 'Content',     protected: false },
    { key: 'audience',    label: 'Audience',      group: 'Analytics',   protected: false },
    { key: 'acquisition', label: 'Acquisition',   group: 'Analytics',   protected: false },
    { key: 'performance', label: 'Performance',   group: 'Analytics',   protected: false },
    { key: 'errors',      label: 'Errors',        group: 'Analytics',   protected: false },
    { key: 'funnels',     label: 'Funnels',       group: 'Conversions', protected: false },
    { key: 'conversions', label: 'Conversions',   group: 'Conversions', protected: false },
    { key: 'user-flow',   label: 'User Flow',     group: 'Conversions', protected: false },
    { key: 'reporting',   label: 'Reporting',     group: 'Tools',       protected: false },
    { key: 'sql-editor',  label: 'SQL Editor',    group: 'Tools',       protected: false },
    { key: 'privacy',     label: 'Privacy',       group: 'Tools',       protected: false },
    { key: 'settings',    label: 'Settings',      group: 'System',      protected: true },
    { key: 'docs',        label: 'Docs',          group: 'System',      protected: false },
];

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function buildDefaults() {
    const map = {};
    for (const f of ALL_NAV_FEATURES) map[f.key] = true;
    return map;
}

export const useFeatureStore = create((set, get) => ({
    // map of featureKey → boolean (true = visible)
    visibility: load() ?? buildDefaults(),

    isVisible: (key) => {
        const f = ALL_NAV_FEATURES.find(x => x.key === key);
        if (f?.protected) return true;
        return get().visibility[key] !== false;
    },

    setVisible: (key, value) => {
        const f = ALL_NAV_FEATURES.find(x => x.key === key);
        if (f?.protected) return; // never hide protected items
        const next = { ...get().visibility, [key]: value };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        set({ visibility: next });
    },

    toggleVisible: (key) => {
        const current = get().isVisible(key);
        get().setVisible(key, !current);
    },

    showAll: () => {
        const next = buildDefaults();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        set({ visibility: next });
    },

    // Return count of hidden (non-protected) items
    hiddenCount: () => {
        const { visibility } = get();
        return ALL_NAV_FEATURES.filter(f => !f.protected && visibility[f.key] === false).length;
    },
}));
