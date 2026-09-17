/**
 * SerpApi key storage — encryption-at-rest contract.
 *
 * The key is user-supplied paid-API credential material, so the invariants that
 * matter are: it is never stored in plaintext, never returned to a client, and
 * an undecryptable blob degrades to "absent" rather than throwing.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encrypt, decrypt, maskSecret } from '../src/utils/secretBox.js';

const rows = new Map();
vi.mock('../src/db/postgres.js', () => ({
    query: vi.fn(async (sql, params = []) => {
        if (/^SELECT \* FROM site_integrations/i.test(sql)) {
            const row = rows.get(`${params[0]}:${params[1]}`);
            return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }
        if (/^INSERT INTO site_integrations/i.test(sql)) {
            const [id, site_id, provider, token_cipher, config, ] = params;
            const row = { id, site_id, provider, token_cipher, config: JSON.parse(config), enabled: true, status: 'pending' };
            rows.set(`${site_id}:${provider}`, row);
            return { rows: [row], rowCount: 1 };
        }
        if (/^UPDATE site_integrations\s+SET token_cipher/i.test(sql)) {
            const [token_cipher, config, id] = params;
            for (const [k, r] of rows) {
                if (r.id === id) {
                    const row = { ...r, token_cipher, config: JSON.parse(config), status: 'pending' };
                    rows.set(k, row);
                    return { rows: [row], rowCount: 1 };
                }
            }
            return { rows: [], rowCount: 0 };
        }
        if (/^DELETE FROM site_integrations/i.test(sql)) {
            const existed = rows.delete(`${params[0]}:${params[1]}`);
            return { rows: [], rowCount: existed ? 1 : 0 };
        }
        return { rows: [], rowCount: 0 };
    }),
}));

const svc = await import('../src/services/serpapiKeyService.js');
const { query } = await import('../src/db/postgres.js');

// A realistically-shaped SerpApi key (64 lowercase hex chars).
const KEY = 'a'.repeat(32) + 'b'.repeat(32);
const SITE = 'site_key_test';

beforeEach(() => { rows.clear(); query.mockClear(); delete process.env.SERPAPI_KEY; });
afterEach(() => { delete process.env.SERPAPI_KEY; });

describe('encryption at rest', () => {
    it('never writes the key in plaintext', async () => {
        await svc.saveKey(SITE, KEY);
        const stored = rows.get(`${SITE}:serpapi`).token_cipher;
        expect(stored).not.toContain(KEY);
        expect(stored).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);   // iv.tag.ciphertext
        expect(decrypt(stored)).toBe(KEY);                     // and it round-trips
    });

    it('produces a different ciphertext each time (unique IV)', () => {
        expect(encrypt(KEY)).not.toBe(encrypt(KEY));
        expect(decrypt(encrypt(KEY))).toBe(KEY);
    });

    it('returns only a masked hint, never the key itself', async () => {
        const saved = await svc.saveKey(SITE, KEY);
        expect(saved.keyHint).toBe(maskSecret(KEY));
        expect(JSON.stringify(saved)).not.toContain(KEY);

        const status = await svc.getStatus(SITE);
        expect(JSON.stringify(status)).not.toContain(KEY);
        expect(status.connected).toBe(true);
    });

    it('treats an undecryptable blob as absent rather than throwing', async () => {
        await svc.saveKey(SITE, KEY);
        rows.get(`${SITE}:serpapi`).token_cipher = 'garbage.not.valid';
        await expect(svc.resolveKey(SITE)).resolves.toEqual({ key: null, source: null });
    });
});

describe('validation', () => {
    it('rejects an empty key', async () => {
        await expect(svc.saveKey(SITE, '')).rejects.toThrow(/required/i);
        await expect(svc.saveKey(SITE, '   ')).rejects.toThrow(/required/i);
    });

    // A pasted placeholder or a truncated copy should fail here, not silently
    // become a failing Google search later.
    it('rejects something that is clearly not a SerpApi key', async () => {
        await expect(svc.saveKey(SITE, 'my-api-key')).rejects.toThrow(/does not look like/i);
        await expect(svc.saveKey(SITE, 'sk-proj-abc123')).rejects.toThrow(/does not look like/i);
    });
});

describe('key resolution order', () => {
    it("prefers the site's own key over the server env var", async () => {
        process.env.SERPAPI_KEY = 'e'.repeat(64);
        await svc.saveKey(SITE, KEY);
        await expect(svc.resolveKey(SITE)).resolves.toEqual({ key: KEY, source: 'site' });
    });

    it('falls back to the env var when the site has no key', async () => {
        const envKey = 'e'.repeat(64);
        process.env.SERPAPI_KEY = envKey;
        await expect(svc.resolveKey(SITE)).resolves.toEqual({ key: envKey, source: 'env' });
    });

    it('resolves to null when neither exists — fixture mode', async () => {
        await expect(svc.resolveKey(SITE)).resolves.toEqual({ key: null, source: null });
    });

    it('reports the env fallback in status, marked as not site-owned', async () => {
        process.env.SERPAPI_KEY = 'e'.repeat(64);
        const status = await svc.getStatus(SITE);
        expect(status).toMatchObject({ connected: true, source: 'env' });
        expect(status.keyHint).toBe(maskSecret('e'.repeat(64)));
    });
});

describe('removal', () => {
    it('forgets the key and falls back to fixture mode', async () => {
        await svc.saveKey(SITE, KEY);
        expect(await svc.removeKey(SITE)).toBe(true);
        await expect(svc.resolveKey(SITE)).resolves.toEqual({ key: null, source: null });
        expect((await svc.getStatus(SITE)).connected).toBe(false);
    });

    it('is a no-op when nothing is stored', async () => {
        expect(await svc.removeKey(SITE)).toBe(false);
    });
});
