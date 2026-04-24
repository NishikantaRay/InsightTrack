import { describe, it, expect, beforeEach } from 'vitest';
import { useDateFilterStore } from '../store/useDateFilterStore';

describe('useDateFilterStore', () => {
    beforeEach(() => {
        // Reset store to defaults
        useDateFilterStore.setState({
            dateRange: '30d',
            customStart: null,
            customEnd: null,
            compareMode: false,
        });
    });

    it('should have default dateRange of 30d', () => {
        const state = useDateFilterStore.getState();
        expect(state.dateRange).toBe('30d');
    });

    it('should set dateRange and clear custom dates', () => {
        const { setDateRange } = useDateFilterStore.getState();
        setDateRange('7d');
        const state = useDateFilterStore.getState();
        expect(state.dateRange).toBe('7d');
        expect(state.customStart).toBeNull();
        expect(state.customEnd).toBeNull();
    });

    it('should set custom range', () => {
        const { setCustomRange } = useDateFilterStore.getState();
        setCustomRange('2026-01-01', '2026-01-31');
        const state = useDateFilterStore.getState();
        expect(state.dateRange).toBe('custom');
        expect(state.customStart).toBe('2026-01-01');
        expect(state.customEnd).toBe('2026-01-31');
    });

    it('should toggle compare mode', () => {
        const { toggleCompareMode } = useDateFilterStore.getState();
        expect(useDateFilterStore.getState().compareMode).toBe(false);
        toggleCompareMode();
        expect(useDateFilterStore.getState().compareMode).toBe(true);
        toggleCompareMode();
        expect(useDateFilterStore.getState().compareMode).toBe(false);
    });
});
