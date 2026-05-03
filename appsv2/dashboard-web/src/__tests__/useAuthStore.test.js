import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../store/useAuthStore';

describe('useAuthStore', () => {
    beforeEach(() => {
        localStorage.clear();
        useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
    });

    it('should default to not authenticated', () => {
        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
        expect(state.token).toBeNull();
    });

    it('should set auth and persist', () => {
        const user = { id: '1', name: 'Test User', email: 'test@example.com' };
        const token = 'jwt-token-123';

        useAuthStore.getState().setAuth(user, token);
        const state = useAuthStore.getState();

        expect(state.isAuthenticated).toBe(true);
        expect(state.user).toEqual(user);
        expect(state.token).toBe(token);
        expect(localStorage.getItem('analytics-token')).toBe(token);
    });

    it('should logout and clear storage', () => {
        useAuthStore.getState().setAuth({ id: '1' }, 'token');
        useAuthStore.getState().logout();

        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
        expect(state.token).toBeNull();
        expect(localStorage.getItem('analytics-token')).toBeNull();
    });

    it('should update user profile', () => {
        useAuthStore.getState().setAuth({ id: '1', name: 'Old' }, 'token');
        useAuthStore.getState().updateUser({ id: '1', name: 'New Name' });

        expect(useAuthStore.getState().user.name).toBe('New Name');
    });
});
