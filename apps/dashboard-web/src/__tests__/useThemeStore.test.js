import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '../store/useThemeStore';

describe('useThemeStore', () => {
    beforeEach(() => {
        localStorage.clear();
        useThemeStore.setState({ theme: 'light' });
    });

    it('should default to light theme', () => {
        expect(useThemeStore.getState().theme).toBe('light');
    });

    it('should toggle theme from light to dark', () => {
        useThemeStore.getState().toggleTheme();
        expect(useThemeStore.getState().theme).toBe('dark');
        expect(localStorage.getItem('analytics-theme')).toBe('dark');
    });

    it('should toggle theme from dark to light', () => {
        useThemeStore.setState({ theme: 'dark' });
        useThemeStore.getState().toggleTheme();
        expect(useThemeStore.getState().theme).toBe('light');
    });

    it('should set theme directly', () => {
        useThemeStore.getState().setTheme('dark');
        expect(useThemeStore.getState().theme).toBe('dark');
        expect(localStorage.getItem('analytics-theme')).toBe('dark');
    });
});
