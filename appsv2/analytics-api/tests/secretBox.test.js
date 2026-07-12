import { describe, it, expect } from 'vitest';

// secretBox reads ENCRYPTION_KEY/JWT_SECRET at import time — set the env
// BEFORE the dynamic import so key derivation has a secret to work with.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
const { encrypt, decrypt, maskSecret } = await import('../src/utils/secretBox.js');

describe('secretBox', () => {
    it('round-trips a secret', () => {
        const blob = encrypt('sk-ant-api03-verysecret');
        expect(blob).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // iv.tag.ciphertext
        expect(decrypt(blob)).toBe('sk-ant-api03-verysecret');
    });

    it('produces a different ciphertext each call (random IV)', () => {
        expect(encrypt('same')).not.toBe(encrypt('same'));
    });

    it('never stores plaintext in the blob', () => {
        const blob = encrypt('super-secret-value');
        expect(blob).not.toContain('super-secret-value');
    });

    it('treats a tampered blob as absent (null), not an error', () => {
        const blob = encrypt('secret');
        const [iv, tag, ct] = blob.split('.');
        const tampered = [iv, tag, ct.slice(0, -2) + 'xx'].join('.');
        expect(decrypt(tampered)).toBeNull();
    });

    it('treats garbage input as absent (null)', () => {
        expect(decrypt('not-a-blob')).toBeNull();
        expect(decrypt('')).toBeNull();
        expect(decrypt(null)).toBeNull();
        expect(decrypt(undefined)).toBeNull();
    });

    it('maskSecret shows only a hint, never the key', () => {
        const hint = maskSecret('sk-ant-api03-abcd1234wxyz');
        expect(hint).toBe('sk-…wxyz');
        expect(hint.length).toBeLessThan(12);
    });

    it('maskSecret fully masks short values', () => {
        expect(maskSecret('short')).toBe('••••');
        expect(maskSecret('')).toBe('••••');
    });
});
