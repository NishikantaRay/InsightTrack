/**
 * Correlation engine tests — the core of the search-visibility feature.
 *
 * correlationService is pure (no DB, no network), so every attribution rule and
 * confidence level is exercised here from plain fixtures, with no SerpApi
 * credits spent and no PostgreSQL required.
 */
import { describe, it, expect } from 'vitest';
import {
    weekStart, bucketByWeek, detectChange, attributeKeyword, explain, serpDiff, pickRival, nextStep,
} from '../src/services/correlationService.js';

/** Build a daily series from consecutive weekly totals, spread evenly. */
function daily(...weeklyTotals) {
    const days = [];
    let cursor = new Date('2026-06-01T00:00:00Z');   // a Monday
    for (const total of weeklyTotals) {
        for (let i = 0; i < 7; i++) {
            const d = new Date(cursor);
            d.setUTCDate(d.getUTCDate() + i);
            days.push({ date: d.toISOString().slice(0, 10), views: Math.round(total / 7) });
        }
        cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    return days;
}

const recent = () => new Date(Date.now() - 5 * 86_400_000).toISOString();
const stale = () => new Date(Date.now() - 40 * 86_400_000).toISOString();

const drop = detectChange(bucketByWeek(daily(590, 616, 413)), { excludePartial: false });
const spike = detectChange(bucketByWeek(daily(200, 210, 420)), { excludePartial: false });

describe('week bucketing', () => {
    it('snaps any day to its ISO week Monday', () => {
        expect(weekStart('2026-09-16')).toBe('2026-09-14');   // Wed → Mon
        expect(weekStart('2026-09-14')).toBe('2026-09-14');   // Mon → itself
        expect(weekStart('2026-09-20')).toBe('2026-09-14');   // Sun → that Mon
    });

    it('sums daily views into weeks, oldest first', () => {
        const weeks = bucketByWeek(daily(700, 140));
        expect(weeks).toHaveLength(2);
        expect(weeks[0].weekStart < weeks[1].weekStart).toBe(true);
        expect(weeks[0].views).toBe(700);
    });

    it('ignores rows without a date', () => {
        expect(bucketByWeek([{ views: 5 }, null, undefined])).toEqual([]);
    });
});

describe('change detection', () => {
    it('flags a significant week-over-week drop', () => {
        expect(drop.significant).toBe(true);
        expect(drop.direction).toBe('drop');
        expect(drop.changePct).toBeCloseTo(-33, 0);
    });

    // The guard that keeps the demo honest: a relative-only threshold would
    // report "3 → 6 views" as traffic doubling.
    it('rejects a large percentage swing on tiny absolute numbers', () => {
        const noise = detectChange([
            { weekStart: '2026-09-07', views: 3 },
            { weekStart: '2026-09-14', views: 6 },
        ], { excludePartial: false });
        expect(noise.significant).toBe(false);
        expect(noise.reason).toMatch(/below the .* significance floor/);
    });

    it('rejects a large absolute swing on a tiny percentage', () => {
        const flat = detectChange([
            { weekStart: '2026-09-07', views: 10_000 },
            { weekStart: '2026-09-14', views: 10_050 },
        ], { excludePartial: false });
        expect(flat.significant).toBe(false);
    });

    // Comparing 2 days against 7 manufactures a drop every Tuesday.
    it('excludes the in-progress week by default', () => {
        const weeks = bucketByWeek(daily(600, 600, 600, 100));
        const d = detectChange(weeks);
        expect(d.weeks).toHaveLength(3);              // the 100-view week is dropped
        expect(d.currentWeek).toBeCloseTo(600, -1);   // even daily spread rounds per-day
        expect(d.significant).toBe(false);            // 600 vs 600, not 600 vs 100
    });

    it('reports honestly when there is not enough history', () => {
        const d = detectChange([{ weekStart: '2026-09-14', views: 50 }], { excludePartial: false });
        expect(d.significant).toBe(false);
        expect(d.previousWeek).toBeNull();
        expect(d.direction).toBe('unknown');
    });
});

describe('attribution rules', () => {
    it('rule 1 — a material rank slide', () => {
        const causes = attributeKeyword({ keyword: 'kw', position: 6, previousPosition: 3 }, 'drop');
        expect(causes.map((c) => c.code)).toContain('rank_drop');
        expect(causes[0].phrase).toBe("rank slipped #3 → #6 on 'kw'");
    });

    it('rule 1 — ignores normal SERP jitter of 1–2 positions', () => {
        const causes = attributeKeyword({ keyword: 'kw', position: 4, previousPosition: 3 }, 'drop');
        expect(causes.map((c) => c.code)).not.toContain('rank_drop');
    });

    it('rule 2 — a new AI Overview that cites competitors instead of you', () => {
        const causes = attributeKeyword({
            keyword: 'kw', position: 3, previousPosition: 3,
            citationChange: 'new_overview', domainIsCited: false,
            newCitedDomains: ['competitorx.com', 'competitory.com'],
        }, 'drop');
        expect(causes.map((c) => c.code)).toEqual(['ai_overview_displacement']);
        expect(causes[0].phrase).toBe("Google's new AI answer box now quotes competitorx.com and competitory.com instead of you");
    });

    it('rule 3 — losing an existing citation', () => {
        const causes = attributeKeyword({ keyword: 'kw', position: 3, previousPosition: 3, citationChange: 'lost' }, 'drop');
        expect(causes.map((c) => c.code)).toEqual(['ai_citation_lost']);
    });

    it('rules 4 & 5 — upside causes only count when explaining a spike', () => {
        const f = { keyword: 'kw', position: 2, previousPosition: 8, citationChange: 'gained', domainIsCited: true };
        expect(attributeKeyword(f, 'spike').map((c) => c.code)).toEqual(['rank_gain', 'ai_citation_gained']);
        expect(attributeKeyword(f, 'drop').map((c) => c.code)).toEqual([]);
    });

    it('rule 6 — falling off page one entirely', () => {
        const causes = attributeKeyword({ keyword: 'kw', position: null, previousPosition: 8 }, 'drop');
        expect(causes.map((c) => c.code)).toContain('page_one_exit');
        expect(causes.find((c) => c.code === 'page_one_exit').phrase).toContain("off page one for 'kw'");
    });
});

describe('explanations', () => {
    const cited = {
        keyword: 'free email templates', position: 6, previousPosition: 3,
        hasAiOverview: true, domainIsCited: false, citationChange: 'new_overview',
        newCitedDomains: ['competitorx.com', 'competitory.com'], changeObservedAt: recent(),
    };

    // The sentence the whole project exists to produce.
    it('joins traffic and SERP evidence into one plain-English sentence', () => {
        const r = explain({ path: '/guides/email-templates', traffic: drop, keywordFindings: [cited] });
        expect(r.explanation).toBe(
            "Traffic to /guides/email-templates dropped 33% this week (616 → 413 views). " +
            "Likely cause: rank slipped #3 → #6 on 'free email templates' and Google's new AI answer box now quotes competitorx.com and competitory.com instead of you.",
        );
        expect(r.confidence).toBe('high');
    });

    it('explains a spike from upside causes', () => {
        const r = explain({
            path: '/pricing', traffic: spike,
            keywordFindings: [{ keyword: 'pricing', position: 2, previousPosition: 9, citationChange: 'gained', domainIsCited: true, changeObservedAt: recent() }],
        });
        expect(r.explanation).toContain('rose 100%');
        expect(r.causes.map((c) => c.code)).toEqual(['rank_gain', 'ai_citation_gained']);
    });

    // Rule 7 — the honest answer. A tool that always finds a SERP cause is guessing.
    it('says the cause is NOT search when the SERP is unchanged', () => {
        const r = explain({
            path: '/guides/email-templates', traffic: drop,
            keywordFindings: [{ keyword: 'kw', position: 3, previousPosition: 3, citationChange: 'unchanged', changeObservedAt: recent() }],
        });
        expect(r.causes.map((c) => c.code)).toEqual(['unexplained_by_serp']);
        expect(r.explanation).toContain('probably not search');
        expect(r.confidence).toBe('low');
    });

    it('reports no change rather than hunting for a cause', () => {
        const steady = detectChange(bucketByWeek(daily(600, 610)), { excludePartial: false });
        const r = explain({ path: '/x', traffic: steady, keywordFindings: [cited] });
        expect(r.explanation).toContain('held roughly steady');
        expect(r.causes).toEqual([]);
    });

    it('drops confidence to medium when the prior snapshot is stale', () => {
        const r = explain({ path: '/x', traffic: drop, keywordFindings: [{ ...cited, changeObservedAt: stale() }] });
        expect(r.confidence).toBe('medium');
        expect(r.caveats.join(' ')).toMatch(/more than \d+ days old/);
    });

    // First run: no history to compare against. Say so; don't invent a delta.
    it('admits when it has no prior snapshot to compare against', () => {
        const r = explain({
            path: '/x', traffic: drop,
            keywordFindings: [{ keyword: 'kw', position: 6, previousPosition: null, citationChange: 'unknown', changeObservedAt: null }],
        });
        expect(r.caveats.join(' ')).toContain('first rank snapshot');
    });

    it('degrades to traffic-only when SerpApi failed, without inventing a cause', () => {
        const r = explain({
            path: '/x', traffic: drop,
            keywordFindings: [{ keyword: 'kw', error: 'SerpApi unavailable' }],
            caveats: ['SERP data unavailable — explanation is traffic-only.'],
        });
        expect(r.causes.map((c) => c.code)).toEqual(['unexplained_by_serp']);
        expect(r.caveats.join(' ')).toContain('traffic-only');
    });

    it('warns when no keywords are mapped to the page', () => {
        const r = explain({ path: '/x', traffic: drop, keywordFindings: [], caveats: ['No target keywords are mapped to /x.'] });
        expect(r.caveats.join(' ')).toContain('No target keywords');
    });
});

describe('SERP diff — features and overtakes', () => {
    const org = (...domains) => domains.map((d, i) => ({ domain: d, url: `https://${d}/`, position: i + 1 }));

    it('reports nothing without a previous snapshot', () => {
        expect(serpDiff({ previous: null, organic: org('a.com'), features: ['videos'], domain: 'me.com', previousPosition: 3, position: 5 }))
            .toEqual({ featuresAdded: [], featuresRemoved: [], overtakenBy: [] });
    });

    it('finds displacing features added and removed, ignoring the AI Overview', () => {
        const d = serpDiff({
            previous: { organic: [], features: ['shopping', 'ai_overview'] },
            features: ['videos', 'people_also_ask', 'ai_overview'],
            domain: 'me.com',
        });
        expect(d.featuresAdded).toEqual(['videos', 'people_also_ask']);
        expect(d.featuresRemoved).toEqual(['shopping']);
    });

    it('names domains that moved from below (or nowhere) to above the site', () => {
        const d = serpDiff({
            previous: { organic: org('a.com', 'me.com', 'b.com'), features: [] },
            organic: org('a.com', 'b.com', 'new.com', 'me.com'),
            domain: 'me.com', previousPosition: 2, position: 4,
        });
        expect(d.overtakenBy.map((o) => o.domain)).toEqual(['b.com', 'new.com']);
        expect(d.overtakenBy[0]).toMatchObject({ previousPosition: 3, position: 2 });
    });

    it('never lists the site itself (or a subdomain) as an overtaker', () => {
        const d = serpDiff({
            previous: { organic: org('x.com', 'me.com'), features: [] },
            organic: org('blog.me.com', 'x.com', 'me.com'),
            domain: 'me.com', previousPosition: 2, position: 3,
        });
        expect(d.overtakenBy).toEqual([]);
    });
});

describe('rules 8 & 9 — SERP features, overtakers', () => {
    it('rule 8 — a new feature on page one explains a rank-stable drop', () => {
        const causes = attributeKeyword({ keyword: 'kw', position: 3, previousPosition: 3, featuresAdded: ['videos'] }, 'drop');
        expect(causes.map((c) => c.code)).toEqual(['serp_feature_added']);
        expect(causes[0].phrase).toBe("Google added a video carousel to the results for 'kw', pushing organic listings down");
    });

    it('rule 8 — ignored below page one', () => {
        expect(attributeKeyword({ keyword: 'kw', position: 30, previousPosition: 30, featuresAdded: ['videos'] }, 'drop')).toEqual([]);
    });

    it('rule 9 — a removed feature counts only when explaining a spike', () => {
        const f = { keyword: 'kw', position: 3, previousPosition: 3, featuresRemoved: ['shopping'] };
        expect(attributeKeyword(f, 'spike').map((c) => c.code)).toEqual(['serp_feature_removed']);
        expect(attributeKeyword(f, 'drop')).toEqual([]);
    });

    it('names who overtook the site, once, on the first rank cause', () => {
        const causes = attributeKeyword({
            keyword: 'kw', position: 12, previousPosition: 4,
            overtakenBy: [{ domain: 'b.com', position: 2 }, { domain: 'c.com', position: 3 }],
        }, 'drop');
        expect(causes.map((c) => c.code)).toEqual(['rank_drop', 'page_one_exit']);
        expect(causes[0].phrase).toBe("rank slipped #4 → #12 on 'kw', with b.com and c.com moving above you");
        expect(causes[1].phrase).toBe("you dropped off page one for 'kw'");
    });

    it('pickRival prefers the domain that just overtook the site', () => {
        const rival = pickRival({
            position: 6,
            competitors: [{ domain: 'old.com', position: 1 }, { domain: 'b.com', position: 2 }],
            overtakenBy: [{ domain: 'b.com', position: 2 }],
        });
        expect(rival).toMatchObject({ domain: 'b.com', overtookYou: true });
    });

    it('suggests answering the question when a snippet or PAA box appears and rank held', () => {
        const causes = [{ code: 'serp_feature_added', features: ['people_also_ask'] }];
        const step = nextStep(causes, [{ keyword: 'kw', positionChange: 0 }], 'drop');
        expect(step.action).toBe('target_feature');
    });
});
