/**
 * Search alert rules — which rank / AI-answer transitions deserve a human's
 * attention.
 *
 * PURE: (previous observation, current observation) → alerts. No DB, no
 * network, so every rule is unit-testable without PostgreSQL or SerpApi.
 * Persistence lives in searchAlertsService.js.
 *
 * Alerts are in-app only. They are shown on /search and counted in the sidebar;
 * nothing is emailed or posted anywhere.
 *
 * The rank threshold is the correlation's own, so an alert and an explanation
 * never disagree about what counts as a real move rather than SERP jitter.
 */
import { RANK_MOVE_THRESHOLD, DISPLACING_FEATURES } from './correlationService.js';

const PAGE_ONE = 10;

export const SEVERITY = Object.freeze({ CRITICAL: 'critical', WARNING: 'warning', POSITIVE: 'positive' });

const onPageOne = (p) => p != null && p <= PAGE_ONE;
const pos = (p) => (p == null ? 'not ranking' : `#${p}`);

/**
 * @param {{position:?number, isCited:boolean, hasAiOverview:boolean}|null} prev
 * @param {{position:?number, isCited:boolean, hasAiOverview:boolean}} cur
 * @param {{keyword:string}} ctx
 * @returns {Array<{type:string, severity:string, previousPosition:?number, position:?number, message:string}>}
 */
export function detectAlerts(prev, cur, { keyword } = {}) {
    // No earlier observation → nothing to compare against. The first check of a
    // keyword is a baseline, not news.
    if (!prev || !cur) return [];

    const alerts = [];
    const was = prev.position ?? null;
    const now = cur.position ?? null;
    const q = `“${keyword}”`;
    const add = (type, severity, message) =>
        alerts.push({ type, severity, previousPosition: was, position: now, message });
    // Name who passed you on a loss — "lost to whom?" is the next question.
    const above = (cur.overtakenBy || []).slice(0, 2).map((o) => o.domain);
    const passedBy = above.length ? ` Now above you: ${above.join(', ')}.` : '';

    // ── rank: one alert per observation, most serious first ───────────────
    if (onPageOne(was) && !onPageOne(now)) {
        add('page_one_exit', SEVERITY.CRITICAL, `${q} fell off page one: ${pos(was)} → ${pos(now)}.${passedBy}`);
    } else if (was != null && now == null) {
        add('ranking_lost', SEVERITY.CRITICAL, `${q} no longer ranks (was ${pos(was)}).${passedBy}`);
    } else if (was != null && now != null && now - was >= RANK_MOVE_THRESHOLD) {
        add('rank_drop', SEVERITY.WARNING, `${q} dropped ${now - was} places: ${pos(was)} → ${pos(now)}.${passedBy}`);
    } else if (!onPageOne(was) && onPageOne(now)) {
        add('page_one_entry', SEVERITY.POSITIVE, `${q} reached page one: ${pos(was)} → ${pos(now)}.`);
    } else if (was == null && now != null) {
        add('ranking_found', SEVERITY.POSITIVE, `${q} now ranks at ${pos(now)}.`);
    } else if (was != null && now != null && was - now >= RANK_MOVE_THRESHOLD) {
        add('rank_gain', SEVERITY.POSITIVE, `${q} climbed ${was - now} places: ${pos(was)} → ${pos(now)}.`);
    }

    // ── AI answer ─────────────────────────────────────────────────────────
    if (prev.isCited && !cur.isCited) {
        add('ai_citation_lost', SEVERITY.WARNING, `Google's AI answer for ${q} no longer quotes you.`);
    } else if (!prev.isCited && cur.isCited) {
        add('ai_citation_gained', SEVERITY.POSITIVE, `Google's AI answer for ${q} now quotes you.`);
    } else if (!prev.hasAiOverview && cur.hasAiOverview && !cur.isCited) {
        // Rank can hold steady while clicks fall — the AI answer sits above you.
        add('ai_overview_appeared', SEVERITY.WARNING, `Google now shows an AI answer for ${q}, and it doesn't quote you.`);
    }

    // ── results page got busier ───────────────────────────────────────────
    // Only while on page one: a new carousel does not cost a page-four result.
    if (onPageOne(now) && cur.featuresAdded?.length) {
        const names = cur.featuresAdded.map((f) => DISPLACING_FEATURES[f]).filter(Boolean);
        if (names.length) {
            add('serp_feature_added', SEVERITY.WARNING,
                `Google added ${names.join(' and ')} to the results for ${q} — expect fewer clicks at the same rank.`);
        }
    }

    return alerts;
}

export default { detectAlerts, SEVERITY };
