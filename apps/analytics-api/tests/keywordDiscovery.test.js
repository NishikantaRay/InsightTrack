/**
 * Keyword auto-discovery + the "what to do about it" next step.
 *
 * Both close gaps that made the feature harder to use than it needed to be:
 * a blank keyword form nobody knew how to fill, and a diagnosis with no action.
 */
import { describe, it, expect, vi } from 'vitest';

const pgRows = { page_keywords: [] };
vi.mock('../src/db/postgres.js', () => ({
    query: vi.fn(async (sql) => {
        if (/FROM page_keywords/i.test(sql)) return { rows: pgRows.page_keywords, rowCount: pgRows.page_keywords.length };
        return { rows: [], rowCount: 0 };
    }),
}));
vi.mock('../src/queries/queries.js', () => ({
    getPageSearchTerms: vi.fn(async () => []),
    getTopPages: vi.fn(async () => [
        { path: '/', views: 900 },
        { path: '/guides/email-templates', views: 500 },
        { path: '/pricing', views: 300 },
    ]),
}));
vi.mock('../src/services/searchVisibilityService.js', () => ({
    default: {
        getSerp: vi.fn(async () => ({
            related: {
                relatedSearches: [{ query: 'free html email templates' }, { query: 'responsive email templates' }],
                peopleAlsoAsk: [{ question: 'Are there free email templates in Gmail?' }],
            },
        })),
    },
}));

const { phraseFromPath, suggestForPage, suggestForSite } = await import('../src/services/keywordDiscoveryService.js');
const { pickRival, nextStep } = await import('../src/services/correlationService.js');
const queries = await import('../src/queries/queries.js');

describe('deriving a keyword from a URL path', () => {
    it('reads the topic from the last meaningful segment', () => {
        expect(phraseFromPath('/guides/email-templates')).toBe('email templates');
        expect(phraseFromPath('/blog/best-crm-tools')).toBe('best crm tools');
        expect(phraseFromPath('/products/running_shoes')).toBe('running shoes');
    });

    it('strips dates, numeric ids and file extensions', () => {
        expect(phraseFromPath('/blog/2026/03/email-marketing')).toBe('email marketing');
        expect(phraseFromPath('/p/1234/wireless-headphones')).toBe('wireless headphones');
        expect(phraseFromPath('/guides/email-templates.html')).toBe('email templates');
    });

    // A homepage covers everything, so it has no single topic to guess.
    it('returns null where there is no topic to derive', () => {
        expect(phraseFromPath('/')).toBeNull();
        expect(phraseFromPath('')).toBeNull();
        expect(phraseFromPath(null)).toBeNull();
        expect(phraseFromPath('/blog/')).toBeNull();     // taxonomy word only
    });
});

describe('suggestions for one page', () => {
    it('suggests from the path with zero SerpApi calls', async () => {
        pgRows.page_keywords = [];
        const { suggestions, expanded } = await suggestForPage('s1', '/guides/email-templates');
        expect(expanded).toBe(false);
        expect(suggestions.map((s) => s.keyword)).toContain('email templates');
        expect(suggestions.every((s) => s.source !== 'serp')).toBe(true);
    });

    // A term someone actually searched beats anything guessed from the URL.
    it('ranks a real search term above the path guess', async () => {
        pgRows.page_keywords = [];
        queries.getPageSearchTerms.mockResolvedValueOnce([{ keyword: 'free email templates', visitors: 42 }]);
        const { suggestions } = await suggestForPage('s1', '/guides/email-templates');
        expect(suggestions[0]).toMatchObject({ keyword: 'free email templates', source: 'traffic', confidence: 'high' });
        expect(suggestions[0].reason).toContain('42 visitors');
    });

    it('adds real related searches only when expansion is opted into', async () => {
        pgRows.page_keywords = [];
        const { suggestions, expanded } = await suggestForPage('s1', '/guides/email-templates', { expand: true });
        expect(expanded).toBe(true);
        expect(suggestions.map((s) => s.keyword)).toContain('free html email templates');
    });

    it('never re-suggests a keyword already mapped', async () => {
        pgRows.page_keywords = [{ keyword: 'email templates' }];
        const { suggestions } = await suggestForPage('s1', '/guides/email-templates');
        expect(suggestions.map((s) => s.keyword)).not.toContain('email templates');
    });

    it('survives SerpApi being unavailable, keeping the free suggestions', async () => {
        pgRows.page_keywords = [];
        const sv = (await import('../src/services/searchVisibilityService.js')).default;
        sv.getSerp.mockRejectedValueOnce(new Error('SerpApi down'));
        const { suggestions } = await suggestForPage('s1', '/guides/email-templates', { expand: true });
        expect(suggestions.map((s) => s.keyword)).toContain('email templates');
    });
});

describe('suggestions across a site', () => {
    it('skips the homepage and pages already mapped', async () => {
        pgRows.page_keywords = [];
        const { pages } = await suggestForSite('s1');
        const paths = pages.map((p) => p.path);
        expect(paths).not.toContain('/');
        expect(paths).toContain('/guides/email-templates');
    });
});

describe('what to do about it', () => {
    const finding = {
        keyword: 'free email templates',
        position: 6,
        previousPosition: 3,
        positionChange: -3,
        citationChange: 'new_overview',
        newCitedDomains: ['competitorx.com'],
        competitors: [
            { position: 1, domain: 'competitorx.com', url: 'https://competitorx.com/x', title: 'X guide' },
            { position: 2, domain: 'other.com', url: 'https://other.com/y', title: 'Y guide' },
        ],
    };

    it('picks the competitor that is also cited in the AI Overview', () => {
        const rival = pickRival(finding);
        expect(rival).toMatchObject({ domain: 'competitorx.com', position: 1, alsoCitedInAiOverview: true });
    });

    it('ignores competitors ranked below you', () => {
        expect(pickRival({ position: 1, competitors: [{ position: 5, domain: 'below.com', url: 'https://below.com' }] })).toBeNull();
    });

    it('names the rival page to study after a rank loss', () => {
        const step = nextStep([{ code: 'rank_drop' }, { code: 'ai_overview_displacement' }], [finding], 'drop');
        expect(step.action).toBe('study_rival');
        expect(step.text).toContain('competitorx.com');
        expect(step.rival.url).toBe('https://competitorx.com/x');
    });

    // When search isn't the cause, pointing at a competitor would mislead.
    it('sends the user elsewhere when search is unchanged', () => {
        const step = nextStep([{ code: 'unexplained_by_serp' }], [], 'drop');
        expect(step.action).toBe('look_beyond_search');
        expect(step.text).toMatch(/referrers|campaigns|deploys/);
    });

    it('suggests reinforcing a win on a spike', () => {
        expect(nextStep([{ code: 'rank_gain' }], [finding], 'spike').action).toBe('reinforce');
    });
});
