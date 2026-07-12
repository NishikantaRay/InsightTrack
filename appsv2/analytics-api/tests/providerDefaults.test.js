import { describe, it, expect } from 'vitest';

// P3.2 — DEFAULT_MODELS reads env at module load; set BEFORE importing.
process.env.ASSISTANT_DEFAULT_MODEL_ANTHROPIC = 'claude-haiku-4-5';
process.env.ASSISTANT_DEFAULT_MODEL_OPENAI = 'gpt-4o';
process.env.ASSISTANT_DEFAULT_MODEL_GEMINI = 'gemini-2.5-pro';
// Ensure no server keys leak in from the environment for resolveProvider tests.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;

const { DEFAULT_MODELS, resolveProvider, PROVIDERS } = await import('../src/mcp/llm/provider.js');

describe('DEFAULT_MODELS env overrides (P3.2)', () => {
    it('uses the configured Anthropic default', () => {
        expect(DEFAULT_MODELS.anthropic).toBe('claude-haiku-4-5');
    });
    it('uses the configured OpenAI default', () => {
        expect(DEFAULT_MODELS.openai).toBe('gpt-4o');
    });
    it('uses the configured Gemini default (N10)', () => {
        expect(DEFAULT_MODELS.gemini).toBe('gemini-2.5-pro');
    });
});

describe('resolveProvider — Gemini support (N10)', () => {
    it('exposes a gemini runner', () => {
        expect(typeof PROVIDERS.gemini).toBe('function');
    });

    it('routes a BYO gemini key to the gemini runner', () => {
        const p = resolveProvider({ userKey: 'AIza-x', userProvider: 'gemini' });
        expect(p.name).toBe('gemini');
        expect(p.run).toBe(PROVIDERS.gemini);
        expect(p.apiKey).toBe('AIza-x');
    });

    it('an unknown provider with a BYO key falls back to anthropic', () => {
        const p = resolveProvider({ userKey: 'k', userProvider: 'nope' });
        expect(p.name).toBe('anthropic');
    });

    it('falls back to a server GEMINI_API_KEY when no other key is set', () => {
        process.env.GEMINI_API_KEY = 'server-gemini';
        try {
            const p = resolveProvider({});
            expect(p.name).toBe('gemini');
            expect(p.apiKey).toBe('server-gemini');
        } finally {
            delete process.env.GEMINI_API_KEY;
        }
    });

    it('returns null when no key is available anywhere', () => {
        expect(resolveProvider({})).toBeNull();
    });
});
