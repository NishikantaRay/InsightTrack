/**
 * Per-site rank-check budget.
 *
 * The cadence governs spend against a monthly SerpApi allowance, so the rules
 * that matter are: a stored value beats the env default, a nonsense value is
 * clamped rather than obeyed, and one site's generous cap cannot spend another
 * site's credits.
 *
 * PostgreSQL is mocked — these assert the budget logic, not the driver.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const rows = vi.hoisted(() => ({ integrations: [], keywords: [] }));

vi.mock('../src/db/postgres.js', () => ({
    query: vi.fn(async (sql, params = []) => {
        if (/FROM site_integrations/i.test(sql)) {
            return { rows: rows.integrations.filter((r) => r.site_id === params[0]) };
        }
        if (/UPDATE site_integrations/i.test(sql)) {
            const row = rows.integrations.find((r) => r.id === params[params.length - 1]);
            if (row) row.config = JSON.parse(params[0]);
            return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }
        if (/FROM page_keywords/i.test(sql)) return { rows: rows.keywords };
        return { rows: [], rowCount: 0 };
    }),
}));

const { getBudget, saveBudget } = await import('../src/services/serpapiKeyService.js');

const integration = (siteId, config = {}) => ({
    id: `int_${siteId}`, site_id: siteId, provider: 'serpapi',
    token_cipher: 'x', config, enabled: true, status: 'ok',
});

beforeEach(() => {
    rows.integrations = [];
    rows.keywords = [];
    delete process.env.RANK_CHECK_MIN_HOURS;
    delete process.env.RANK_CHECK_MAX_PER_RUN;
});

describe('getBudget — defaults and overrides', () => {
    it('falls back to the built-in defaults for a site with no stored budget', async () => {
        rows.integrations = [integration('site_a')];
        const b = await getBudget('site_a');
        expect(b.minHours).toBe(24);
        expect(b.maxPerRun).toBe(10);
        expect(b.source).toBe('default');
    });

    // A site with no integration row at all must not throw — the sweep asks
    // about every site it finds keywords for, including keyless ones.
    it('returns defaults rather than throwing when the site has no key', async () => {
        const b = await getBudget('site_missing');
        expect(b.minHours).toBe(24);
        expect(b.source).toBe('default');
    });

    it('prefers a stored per-site budget over the default', async () => {
        rows.integrations = [integration('site_a', { rankBudget: { minHours: 48, maxPerRun: 14 } })];
        const b = await getBudget('site_a');
        expect(b.minHours).toBe(48);
        expect(b.maxPerRun).toBe(14);
        expect(b.source).toBe('site');
    });
});

describe('saveBudget — clamping', () => {
    it('stores a valid budget', async () => {
        rows.integrations = [integration('site_a')];
        const b = await saveBudget('site_a', { minHours: 48, maxPerRun: 14 });
        expect(b.minHours).toBe(48);
        expect(b.maxPerRun).toBe(14);
        expect(await getBudget('site_a')).toMatchObject({ minHours: 48, maxPerRun: 14 });
    });

    // A 0-hour cadence would re-check every keyword on every sweep — the exact
    // runaway the caps exist to prevent.
    it('clamps a zero or negative cadence up to the 1-hour floor', async () => {
        rows.integrations = [integration('site_a')];
        expect((await saveBudget('site_a', { minHours: 0 })).minHours).toBe(1);
        expect((await saveBudget('site_a', { minHours: -5 })).minHours).toBe(1);
    });

    it('clamps an absurd per-run cap down to the ceiling', async () => {
        rows.integrations = [integration('site_a')];
        expect((await saveBudget('site_a', { maxPerRun: 100000 })).maxPerRun).toBe(100);
    });

    it('rejects a budget for a site with no key, since the sweep would skip it', async () => {
        await expect(saveBudget('site_none', { minHours: 48 })).rejects.toThrow(/Connect a SerpApi key/);
    });

    it('leaves the other field alone when only one is supplied', async () => {
        rows.integrations = [integration('site_a', { rankBudget: { minHours: 48, maxPerRun: 14 } })];
        const b = await saveBudget('site_a', { minHours: 72 });
        expect(b.minHours).toBe(72);
        expect(b.maxPerRun).toBe(14);
    });

    it('preserves the key hint already in config', async () => {
        rows.integrations = [integration('site_a', { keyHint: 'abc…7f21' })];
        await saveBudget('site_a', { minHours: 48 });
        expect(rows.integrations[0].config.keyHint).toBe('abc…7f21');
    });
});

describe('env fallback', () => {
    it('uses RANK_CHECK_MIN_HOURS as the default when set', async () => {
        process.env.RANK_CHECK_MIN_HOURS = '72';
        vi.resetModules();
        const svc = await import('../src/services/serpapiKeyService.js?env=1');
        rows.integrations = [integration('site_a')];
        expect((await svc.getBudget('site_a')).minHours).toBe(72);
    });
});
