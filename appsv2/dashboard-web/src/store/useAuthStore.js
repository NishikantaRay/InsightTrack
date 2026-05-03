import { create } from 'zustand';

const TOKEN_KEY = 'analytics-token';
const USER_KEY = 'analytics-user-profile';

export const useAuthStore = create((set) => ({
    user: (() => {
        try {
            const u = localStorage.getItem(USER_KEY);
            return u ? JSON.parse(u) : null;
        } catch { return null; }
    })(),
    token: localStorage.getItem(TOKEN_KEY) || null,
    isAuthenticated: !!localStorage.getItem(TOKEN_KEY),

    setAuth: (user, token) => {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        set({ user, token, isAuthenticated: true });
    },

    logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        set({ user: null, token: null, isAuthenticated: false });
    },

    updateUser: (user) => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        set({ user });
    },
}));
