import { create } from 'zustand';

const TOKEN_KEY = 'analytics-token';
const USER_KEY = 'analytics-user-profile';

export const useAuthStore = create((set) => {
    const store = {
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
    };

    // Listen for 401 responses from the API interceptor and auto-logout.
    // This runs once when the store is created (module load time).
    if (typeof window !== 'undefined') {
        window.addEventListener('auth:logout', () => {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            set({ user: null, token: null, isAuthenticated: false });
        });
    }

    return store;
});
