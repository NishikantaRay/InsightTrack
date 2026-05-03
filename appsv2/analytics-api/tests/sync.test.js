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

import { describe as hotColdDescribe, it as hotColdIt, expect as hotColdExpect } from 'vitest';
import { serialise } from '../src/sync/sync.js';
import { HOT_DAYS } from '../src/schema/schema.js';

describe('Hot+Cold Architecture', () => {
    it('HOT_DAYS should be a positive integer', () => {
        expect(typeof HOT_DAYS).toBe('number');
        expect(HOT_DAYS).toBeGreaterThan(0);
    });

    it('default HOT_DAYS should be 30', () => {
        // Only true if HOT_DAYS env var is not set
        if (!process.env.HOT_DAYS) {
            expect(HOT_DAYS).toBe(30);
        }
    });

    it('SYNCABLE_TABLES should have hotCold flag on events and sessions', async () => {
        const { SYNCABLE_TABLES } = await import('../src/schema/schema.js');
        const events = SYNCABLE_TABLES.find((t) => t.table === 'events');
        const sessions = SYNCABLE_TABLES.find((t) => t.table === 'sessions');
        expect(events?.hotCold).toBe(true);
        expect(sessions?.hotCold).toBe(true);
    });

    it('SYNCABLE_TABLES events should map to events_hot duck table', async () => {
        const { SYNCABLE_TABLES } = await import('../src/schema/schema.js');
        const events = SYNCABLE_TABLES.find((t) => t.table === 'events');
        expect(events?.duckTable).toBe('events_hot');
    });

    it('SYNCABLE_TABLES sessions should map to sessions_hot duck table', async () => {
        const { SYNCABLE_TABLES } = await import('../src/schema/schema.js');
        const sessions = SYNCABLE_TABLES.find((t) => t.table === 'sessions');
        expect(sessions?.duckTable).toBe('sessions_hot');
    });

    it('serialise should handle edge case: empty string', () => {
        expect(serialise('')).toBe('');
    });

    it('serialise should handle nested objects', () => {
        const nested = { a: { b: [1, 2, 3] } };
        const result = JSON.parse(serialise(nested));
        expect(result.a.b).toEqual([1, 2, 3]);
    });
});

