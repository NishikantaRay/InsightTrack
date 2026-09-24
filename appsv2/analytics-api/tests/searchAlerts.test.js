/**
 * In-app search alerts.
 *
 * The rules are pure, so most of this runs with no PostgreSQL. The service
 * tests mock the driver and assert the guardrails: idempotent inserts, ids
 * sanitised before they reach SQL, and fixtures never raising an alert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls = vi.hoisted(() => []);
vi.mock('../src/db/postgres.js', () => ({
    query: vi.fn(async (sql, params = []) => {
        calls.push({ sql, params });
        return { rows: [], rowCount: 0 };
    }),
}));

const { detectAlerts } = await import('../src/services/searchAlertRules.js');
const { recordAlerts, markRead } = await import('../src/services/searchAlertsService.js');

const obs = (position, extra = {}) => ({ position, isCited: false, hasAiOverview: false, ...extra });
const types = (prev, cur) => detectAlerts(prev, cur, { keyword: 'kw' }).map((a) => a.type);

beforeEach(() => { calls.length = 0; });

describe('detectAlerts', () => {
    it('raises nothing without a previous observation', () => {
        expect(types(null, obs(40))).toEqual([]);
    });

    it('treats small moves as jitter', () => {
        expect(types(obs(5), obs(7))).toEqual([]);
        expect(types(obs(30), obs(28))).toEqual([]);
    });

    it('flags leaving page one as critical, even for a one-place move', () => {
        const [a] = detectAlerts(obs(10), obs(11), { keyword: 'kw' });
        expect(a).toMatchObject({ type: 'page_one_exit', severity: 'critical', previousPosition: 10, position: 11 });
    });

    it('flags dropping out of the results entirely', () => {
        expect(types(obs(4), obs(null))).toEqual(['page_one_exit']);
        expect(types(obs(40), obs(null))).toEqual(['ranking_lost']);
    });

    it('flags a real drop below page one as a warning', () => {
        const [a] = detectAlerts(obs(20), obs(26), { keyword: 'kw' });
        expect(a).toMatchObject({ type: 'rank_drop', severity: 'warning' });
        expect(a.message).toContain('#20 → #26');
    });

    it('reports good news too', () => {
        expect(types(obs(14), obs(9))).toEqual(['page_one_entry']);
        expect(types(obs(null), obs(35))).toEqual(['ranking_found']);
        expect(types(obs(9), obs(2))).toEqual(['rank_gain']);
    });

    it('tracks AI-answer citation changes alongside rank', () => {
        expect(types(obs(3, { hasAiOverview: true, isCited: true }), obs(3, { hasAiOverview: true })))
            .toEqual(['ai_citation_lost']);
        expect(types(obs(3, { hasAiOverview: true }), obs(3, { hasAiOverview: true, isCited: true })))
            .toEqual(['ai_citation_gained']);
    });

    it('warns when an AI answer appears that does not quote the site', () => {
        expect(types(obs(3), obs(3, { hasAiOverview: true }))).toEqual(['ai_overview_appeared']);
        expect(types(obs(3), obs(3, { hasAiOverview: true, isCited: true }))).toEqual(['ai_citation_gained']);
    });

    it('can raise a rank and an AI alert from one observation', () => {
        expect(types(obs(2, { hasAiOverview: true, isCited: true }), obs(15, { hasAiOverview: true })))
            .toEqual(['page_one_exit', 'ai_citation_lost']);
    });
});

describe('searchAlertsService', () => {
    it('inserts idempotently and parameterised', async () => {
        await recordAlerts('s1', {
            rankHistoryId: 7, keyword: 'kw', location: 'India', device: 'desktop',
            prev: obs(3), cur: obs(12),
        });
        const insert = calls.find((c) => /INSERT INTO search_alerts/.test(c.sql));
        expect(insert.sql).toMatch(/ON CONFLICT \(rank_history_id, type\) DO NOTHING/);
        expect(insert.sql).not.toContain('kw');
        expect(insert.params.slice(0, 7)).toEqual(['s1', 7, 'kw', 'India', 'desktop', 'page_one_exit', 'critical']);
    });

    it('writes nothing when there is nothing to report', async () => {
        await recordAlerts('s1', { rankHistoryId: 8, keyword: 'kw', location: 'India', device: 'desktop', prev: obs(3), cur: obs(3) });
        expect(calls).toHaveLength(0);
    });

    it('sanitises ids before marking read, and scopes to the site', async () => {
        await markRead('s1', [1, '2', 'x; DROP TABLE', -4, 3.7]);
        expect(calls[0].sql).toMatch(/id = ANY\(\$2::int\[\]\)/);
        expect(calls[0].params).toEqual(['s1', [1, 2, 3]]);
    });

    it('marks everything read when no ids are given', async () => {
        await markRead('s1');
        expect(calls[0].sql).not.toMatch(/ANY/);
        expect(calls[0].params).toEqual(['s1']);
    });
});
