/**
 * SerpApi client + normalizer tests.
 *
 * These run entirely in FIXTURE MODE (no SERPAPI_KEY), which is the same path a
 * judge cloning the repo takes. No network, no credits.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { search, isFixtureMode, creditsUsed, resetCredits } from '../src/services/serpapi/client.js';
import {
    extractDomain, domainMatches, normalizeOrganic, normalizeAiOverview,
    normalizeRelated, normalizeFeatures, findDomainPosition, normalizeSnapshot,
} from '../src/services/serpapi/normalize.js';

const KEY = process.env.SERPAPI_KEY;
beforeEach(() => { delete process.env.SERPAPI_KEY; resetCredits(); });
afterEach(() => { if (KEY) process.env.SERPAPI_KEY = KEY; });

describe('client — fixture mode', () => {
    it('reports fixture mode when no key is configured', () => {
        expect(isFixtureMode()).toBe(true);
    });

    // The repo must run for a judge with no SerpApi account at all.
    it('serves a fixture and marks it as such, spending no credits', async () => {
        const raw = await search({ keyword: 'free email templates' });
        expect(raw._source).toBe('fixture');
        expect(raw.organic_results.length).toBeGreaterThan(0);
        expect(creditsUsed()).toBe(0);
    });

    it('falls back to default.json for an un-fixtured keyword', async () => {
        const raw = await search({ keyword: 'some keyword with no fixture' });
        expect(raw._source).toBe('fixture');
        expect(raw.organic_results.length).toBeGreaterThan(0);
    });

    it('rejects an empty keyword', async () => {
        await expect(search({ keyword: '' })).rejects.toThrow(/keyword is required/);
        await expect(search({})).rejects.toThrow(/keyword is required/);
    });

    it('never performs network I/O in fixture mode', async () => {
        const spy = vi.spyOn(globalThis, 'fetch');
        await search({ keyword: 'free email templates' });
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});

describe('normalizer', () => {
    it('extracts a bare host from any URL shape', () => {
        expect(extractDomain('https://www.example.com/a/b?c=1')).toBe('example.com');
        expect(extractDomain('http://example.com:8080/x')).toBe('example.com');
        expect(extractDomain('example.com/x')).toBe('example.com');
        expect(extractDomain(null)).toBeNull();
    });

    it('matches a domain and its subdomains, but not a lookalike', () => {
        expect(domainMatches('example.com', 'example.com')).toBe(true);
        expect(domainMatches('blog.example.com', 'example.com')).toBe(true);
        expect(domainMatches('www.example.com', 'example.com')).toBe(true);
        expect(domainMatches('notexample.com', 'example.com')).toBe(false);
        expect(domainMatches('example.com.evil.com', 'example.com')).toBe(false);
    });

    it('normalizes organic results and drops entries with no URL', () => {
        const rows = normalizeOrganic({
            organic_results: [
                { position: 1, title: 'A', link: 'https://www.a.com/x' },
                { position: 2, title: 'No link' },
            ],
        });
        expect(rows).toEqual([{ position: 1, domain: 'a.com', url: 'https://www.a.com/x', title: 'A' }]);
    });

    it('reads AI Overview citations from `references` or `sources`', () => {
        const fromRefs = normalizeAiOverview({ ai_overview: { references: [{ index: 1, title: 'T', link: 'https://c.com/x' }] } });
        expect(fromRefs).toEqual({ present: true, citations: [{ position: 1, domain: 'c.com', url: 'https://c.com/x', title: 'T' }] });

        const fromSources = normalizeAiOverview({ ai_overview: { sources: [{ title: 'S', link: 'https://d.com/y' }] } });
        expect(fromSources.present).toBe(true);
        expect(fromSources.citations[0].domain).toBe('d.com');
    });

    it('reports no AI Overview when the box is absent', () => {
        expect(normalizeAiOverview({})).toEqual({ present: false, citations: [] });
    });

    it('detects SERP features present in the response', () => {
        const f = normalizeFeatures({ ai_overview: {}, answer_box: {}, related_questions: [{ question: 'q' }] });
        expect(f).toEqual(expect.arrayContaining(['ai_overview', 'featured_snippet', 'people_also_ask']));
        expect(normalizeFeatures({})).toEqual([]);
    });

    it('caps related queries at the requested limit', () => {
        const raw = {
            related_questions: Array.from({ length: 20 }, (_, i) => ({ question: `q${i}`, link: 'https://x.com' })),
            related_searches: Array.from({ length: 20 }, (_, i) => ({ query: `s${i}`, link: 'https://x.com' })),
        };
        const r = normalizeRelated(raw, 5);
        expect(r.peopleAlsoAsk).toHaveLength(5);
        expect(r.relatedSearches).toHaveLength(5);
    });

    // A sentinel like 0 or 101 is a number a model will happily average.
    // "Does not rank" must be distinguishable from "ranks 101st".
    it('returns null — not a sentinel — when the domain does not rank', () => {
        const organic = [{ position: 1, domain: 'other.com', url: 'https://other.com', title: 'x' }];
        expect(findDomainPosition(organic, 'example.com')).toEqual({ found: false, position: null, url: null });
        expect(findDomainPosition(organic, null)).toEqual({ found: false, position: null, url: null });
    });
});

describe('end-to-end through the fixture', () => {
    it('produces the demo scenario: #6, AI Overview present, not cited', async () => {
        const raw = await search({ keyword: 'free email templates' });
        const snap = normalizeSnapshot(raw, { keyword: 'free email templates' });

        expect(snap.source).toBe('fixture');
        expect(findDomainPosition(snap.organic, 'example.com')).toMatchObject({ found: true, position: 6 });
        expect(snap.aiOverview.present).toBe(true);
        expect(snap.aiOverview.citations.some((c) => domainMatches(c.domain, 'example.com'))).toBe(false);
        expect(snap.aiOverview.citations.map((c) => c.domain)).toEqual(['competitorx.com', 'competitory.com']);
        expect(snap.features).toContain('ai_overview');
    });
});
