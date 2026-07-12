import { describe, it, expect } from 'vitest';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
// Default is 20; keep it explicit and small isn't needed — we test with 20.
const { normalizeInbound } = await import('../src/routes/assistant.js');

const mkTurns = (n) =>
    Array.from({ length: n }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: `m${i}` }));

describe('normalizeInbound — history budget (P1.5)', () => {
    it('passes short histories through untouched (only user/assistant text)', () => {
        const msgs = [
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'hello' },
            { role: 'system', content: 'nope' },      // stripped
            { role: 'user', content: [{ type: 'x' }] }, // non-string stripped
        ];
        expect(normalizeInbound(msgs)).toEqual([
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'hello' },
        ]);
    });

    it('keeps exactly the last 20 turns when at the limit (no note added)', () => {
        const out = normalizeInbound(mkTurns(20));
        expect(out.length).toBe(20);
        expect(out[0].content).toBe('m0'); // nothing dropped
    });

    it('truncates to the most recent 20 turns and prepends a drop note', () => {
        const out = normalizeInbound(mkTurns(25));
        expect(out.length).toBe(21); // 1 note + 20 recent
        expect(out[0].role).toBe('user');
        expect(out[0].content).toContain('5 messages were omitted');
        // The 20 most recent turns are m5..m24.
        expect(out[1].content).toBe('m5');
        expect(out.at(-1).content).toBe('m24'); // the newest turn (the question) is always kept
    });

    it('always begins with a user turn (provider requirement)', () => {
        const out = normalizeInbound(mkTurns(40));
        expect(out[0].role).toBe('user');
    });

    it('singular grammar when exactly one message is dropped', () => {
        const out = normalizeInbound(mkTurns(21));
        expect(out[0].content).toContain('1 message was omitted');
    });

    it('drops empty/blank turns (errored replies persist with no text)', () => {
        const out = normalizeInbound([
            { role: 'user', content: 'q1' },
            { role: 'assistant', content: '' },       // errored reply — dropped
            { role: 'assistant', content: '   ' },    // blank — dropped
            { role: 'user', content: 'q2' },
        ]);
        // q1 and q2 collapse (both user, now adjacent) into one turn
        expect(out).toEqual([{ role: 'user', content: 'q1\n\nq2' }]);
    });

    it('merges consecutive same-role turns (Gemini alternation)', () => {
        const out = normalizeInbound([
            { role: 'user', content: 'a' },
            { role: 'user', content: 'b' },
            { role: 'assistant', content: 'x' },
            { role: 'assistant', content: 'y' },
            { role: 'user', content: 'c' },
        ]);
        expect(out).toEqual([
            { role: 'user', content: 'a\n\nb' },
            { role: 'assistant', content: 'x\n\ny' },
            { role: 'user', content: 'c' },
        ]);
    });
});
