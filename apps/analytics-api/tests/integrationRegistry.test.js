import { describe, it, expect } from 'vitest';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
const { registerAdapter, getAdapter, allAdapters } = await import('../src/integrations/registry.js');

describe('integration registry (P3.1)', () => {
    it('ships a Sentry adapter with the required contract', () => {
        const a = getAdapter('sentry');
        expect(a.provider).toBe('sentry');
        expect(a.label).toBe('Sentry');
        expect(typeof a.pollAll).toBe('function');
        expect(typeof a.handleWebhook).toBe('function');
    });

    it('throws a 404-status error for an unknown provider', () => {
        try {
            getAdapter('rollbar');
            throw new Error('should have thrown');
        } catch (e) {
            expect(e.status).toBe(404);
            expect(e.message).toMatch(/unknown integration provider/i);
        }
    });

    it('registerAdapter adds a new provider that getAdapter/allAdapters can see', () => {
        const fake = { provider: 'test_prov', label: 'Test', pollAll: async () => 0, handleWebhook: async () => ({ handled: true }) };
        registerAdapter(fake);
        expect(getAdapter('test_prov')).toBe(fake);
        expect(allAdapters().some((a) => a.provider === 'test_prov')).toBe(true);
    });

    it('rejects an adapter with no provider key', () => {
        expect(() => registerAdapter({ label: 'x' })).toThrow(/requires a provider/i);
    });
});
