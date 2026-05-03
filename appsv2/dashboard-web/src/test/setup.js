import '@testing-library/jest-dom';

// Mock localStorage and sessionStorage for tests
const createStorage = () => {
    let store = {};
    return {
        getItem: (key) => store[key] ?? null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; },
        get length() { return Object.keys(store).length; },
        key: (i) => Object.keys(store)[i] ?? null,
    };
};

Object.defineProperty(globalThis, 'localStorage', { value: createStorage() });
Object.defineProperty(globalThis, 'sessionStorage', { value: createStorage() });

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    value: (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => { },
        removeListener: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => false,
    }),
});
