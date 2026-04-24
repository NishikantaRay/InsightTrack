import { describe, it, expect } from 'vitest';
import { serialise } from '../src/sync/sync.js';

describe('Sync Utilities', () => {
    describe('serialise()', () => {
        it('should return null for null/undefined', () => {
            expect(serialise(null)).toBeNull();
            expect(serialise(undefined)).toBeNull();
        });

        it('should convert Date to ISO string', () => {
            const d = new Date('2026-01-15T10:00:00.000Z');
            expect(serialise(d)).toBe('2026-01-15T10:00:00.000Z');
        });

        it('should JSON.stringify objects', () => {
            const obj = { foo: 'bar' };
            expect(serialise(obj)).toBe('{"foo":"bar"}');
        });

        it('should JSON.stringify arrays', () => {
            const arr = [1, 2, 3];
            expect(serialise(arr)).toBe('[1,2,3]');
        });

        it('should return strings as-is', () => {
            expect(serialise('hello')).toBe('hello');
        });

        it('should return numbers as-is', () => {
            expect(serialise(42)).toBe(42);
        });

        it('should return booleans as-is', () => {
            expect(serialise(true)).toBe(true);
            expect(serialise(false)).toBe(false);
        });
    });
});

describe('Sync Module Exports', () => {
    it('should export runSync function', async () => {
        const mod = await import('../src/sync/sync.js');
        expect(typeof mod.runSync).toBe('function');
    });

    it('should export runFullSync function', async () => {
        const mod = await import('../src/sync/sync.js');
        expect(typeof mod.runFullSync).toBe('function');
    });
});
