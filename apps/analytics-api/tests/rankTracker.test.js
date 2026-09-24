/**
 * Scheduled rank tracking.
 *
 * The behaviours that matter are the guardrails, not the happy path: this loop
 * spends paid API credits on a timer, so it must not run away, and it must not
 * record fixture data as if it were a real observation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let pageKeywords = [];
let rankHistory = [];

vi.mock('../src/db/postgres.js', () => ({
    query: vi.fn(async (sql) => {
        if (/FROM page_keywords pk/i.test(sql)) {
            return {
                rows: pageKeywords.map((k) => ({
                    ...k,
                    last_checked: rankHistory
                        .filter((h) => h.keyword === k.keyword && h.site_id === k.site_id)
                        .map((h) => h.checked_at)
                        .sort()
                        .pop() || null,
                })),
            };
        }
        return { rows: [], rowCount: 0 };
    }),
}));

const checkKeyword = vi.fn(async () => ({ position: 6 }));
vi.mock('../src/services/searchVisibilityService.js', () => ({
    default: { checkKeyword: (...a) => checkKeyword(...a) },
}));

const resolveKey = vi.fn(async () => ({ key: 'k'.repeat(64), source: 'site' }));
vi.mock('../src/services/serpapiKeyService.js', () => ({
    default: {
        resolveKey: (...a) => resolveKey(...a),
        getBudget: async () => ({ minHours: 24, maxPerRun: 10 }),
    },
}));

const { sweepRanks, pendingCount } = await import('../src/services/rankTrackerService.js');

const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();

beforeEach(() => {
    pageKeywords = [
        { site_id: 's1', keyword: '18EC1T12', location: 'India', path: '/a', domain: 'studytub.netlify.app' },
        { site_id: 's1', keyword: 'btech notes', location: 'India', path: '/b', domain: 'studytub.netlify.app' },
    ];
    rankHistory = [];
    checkKeyword.mockClear();
    resolveKey.mockClear();
    resolveKey.mockResolvedValue({ key: 'k'.repeat(64), source: 'site' });
});

describe('what gets checked', () => {
    it('checks a keyword that has never been checked', async () => {
        const r = await sweepRanks();
        expect(r.checked).toBe(2);
        expect(checkKeyword).toHaveBeenCalledTimes(2);
    });

    // Re-checking hourly would burn a free tier in a day for no new information.
    it('skips a keyword checked within the last day', async () => {
        rankHistory = [
            { site_id: 's1', keyword: '18EC1T12', checked_at: hoursAgo(2) },
            { site_id: 's1', keyword: 'btech notes', checked_at: hoursAgo(2) },
        ];
        expect((await sweepRanks()).checked).toBe(0);
    });

    it('re-checks once the window has passed', async () => {
        rankHistory = [{ site_id: 's1', keyword: '18EC1T12', checked_at: hoursAgo(30) }];
        expect((await sweepRanks()).checked).toBe(2);
    });

    it('caps how many it checks in one sweep', async () => {
        pageKeywords = Array.from({ length: 50 }, (_, i) => ({
            site_id: 's1', keyword: `kw${i}`, location: 'India', path: '/p', domain: 'studytub.netlify.app',
        }));
        expect((await sweepRanks({ limit: 10 })).checked).toBe(10);
    });

    // Oldest-first, so a long keyword list cannot starve the tail.
    it('checks the least recently seen keyword first', async () => {
        rankHistory = [
            { site_id: 's1', keyword: 'btech notes', checked_at: hoursAgo(100) },
            { site_id: 's1', keyword: '18EC1T12', checked_at: hoursAgo(40) },
        ];
        await sweepRanks({ limit: 1 });
        expect(checkKeyword.mock.calls[0][2].keyword).toBe('btech notes');
    });
});

describe('credit discipline', () => {
    // Fixture positions recorded as history would make every later delta a lie.
    it('records nothing for a site with no SerpApi key', async () => {
        resolveKey.mockResolvedValue({ key: null, source: null });
        const r = await sweepRanks();
        expect(r.checked).toBe(0);
        expect(r.skipped).toBe(2);
        expect(checkKeyword).not.toHaveBeenCalled();
    });

    // A scheduled check exists to produce a NEW datapoint, not re-read a cached one.
    it('forces a fresh lookup rather than reusing a cached snapshot', async () => {
        await sweepRanks();
        expect(checkKeyword.mock.calls[0][2].maxAgeHours).toBe(0);
    });

    it('skips a site with no usable domain', async () => {
        pageKeywords = [{ site_id: 's1', keyword: 'x', location: 'India', path: '/a', domain: '' }];
        expect((await sweepRanks()).skipped).toBe(1);
    });
});

describe('resilience', () => {
    it('one failing keyword does not stop the sweep', async () => {
        checkKeyword
            .mockRejectedValueOnce(new Error('SerpApi timeout'))
            .mockResolvedValueOnce({ position: 4 });
        const r = await sweepRanks({ silent: true });
        expect(r.failed).toBe(1);
        expect(r.checked).toBe(1);
    });

    it('reports how many keywords are waiting', async () => {
        expect(await pendingCount()).toBe(2);
        rankHistory = [{ site_id: 's1', keyword: '18EC1T12', checked_at: hoursAgo(1) }];
        expect(await pendingCount()).toBe(1);
    });
});
