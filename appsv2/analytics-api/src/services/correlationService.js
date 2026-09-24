/**
 * Correlation engine — the reason this feature exists.
 *
 * InsightTrack knows WHAT happened to a page. SerpApi knows what happened in
 * the SERP that feeds it. Neither answers "why did traffic change?" alone. This
 * module performs the join and emits one plain-English explanation with its
 * evidence attached.
 *
 * PURE BY DESIGN: `(trafficWeeks, keywordFindings) → Finding`. No I/O, no DB, no
 * network. Every rule below is unit-testable from fixtures, and the demo runs
 * without a SerpApi key.
 *
 * RULES, NOT AN LLM. Attribution is a deterministic, auditable rule cascade and
 * the sentence is template-composed, so identical inputs always produce an
 * identical explanation. That matters for trust: a correlation tool that always
 * finds a SERP cause is a tool that is guessing. Rule 7 exists precisely so the
 * engine can say "this was not search".
 */

import { domainMatches } from './serpapi/normalize.js';

// ── significance thresholds ───────────────────────────────────────────────────
// BOTH must clear, deliberately. A relative-only threshold reports "3 views → 6
// views, traffic doubled!" as a finding — the fastest way for a correlation demo
// to embarrass itself. The absolute floor filters out low-traffic noise.
const MIN_CHANGE_PCT = parseFloat(process.env.CORRELATION_MIN_PCT) || 15;
const MIN_CHANGE_ABS = parseInt(process.env.CORRELATION_MIN_ABS) || 20;

// A rank move of this many positions counts as a cause, not normal SERP jitter.
export const RANK_MOVE_THRESHOLD = 3;

// A prior snapshot older than this makes a delta untrustworthy → confidence drops.
const STALE_SNAPSHOT_DAYS = 14;

/** ISO week start (Monday) for a date, as YYYY-MM-DD. */
export function weekStart(date) {
    const d = new Date(date);
    const day = (d.getUTCDay() + 6) % 7;           // Mon=0 … Sun=6
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
}

/**
 * Bucket a daily series into ISO weeks, oldest first.
 * @param {Array<{date:string, views:number}>} daily
 */
export function bucketByWeek(daily = []) {
    const weeks = new Map();
    for (const row of daily) {
        if (!row?.date) continue;
        const wk = weekStart(row.date);
        weeks.set(wk, (weeks.get(wk) || 0) + Number(row.views ?? row.pageviews ?? 0));
    }
    return [...weeks.entries()]
        .map(([weekStart, views]) => ({ weekStart, views }))
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * Detect a week-over-week change, comparing the last COMPLETE week against the
 * one before it. The current partial week is excluded — comparing 2 days
 * against 7 manufactures a "drop" every single Tuesday.
 */
export function detectChange(weeks = [], { excludePartial = true } = {}) {
    const series = excludePartial && weeks.length > 2
        ? weeks.slice(0, -1)      // drop the in-progress week
        : weeks;

    if (series.length < 2) {
        return {
            currentWeek: series.at(-1)?.views ?? 0,
            previousWeek: null,
            changePct: null,
            changeAbs: null,
            direction: 'unknown',
            significant: false,
            reason: 'Not enough weekly history to compare.',
            weeks: series,
        };
    }

    const current = series.at(-1).views;
    const previous = series.at(-2).views;
    const changeAbs = current - previous;
    const changePct = previous === 0
        ? (current > 0 ? 100 : 0)
        : (changeAbs / previous) * 100;

    const significant =
        Math.abs(changePct) >= MIN_CHANGE_PCT && Math.abs(changeAbs) >= MIN_CHANGE_ABS;

    return {
        currentWeek: current,
        previousWeek: previous,
        changePct: Math.round(changePct * 10) / 10,
        changeAbs,
        direction: changeAbs < 0 ? 'drop' : changeAbs > 0 ? 'spike' : 'flat',
        significant,
        reason: significant
            ? null
            : `Change of ${Math.round(changePct)}% (${changeAbs} views) is below the ${MIN_CHANGE_PCT}% / ${MIN_CHANGE_ABS}-view significance floor.`,
        weeks: series,
    };
}

/** Days between an ISO timestamp and now; Infinity when absent. */
function daysSince(iso) {
    if (!iso) return Infinity;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return Infinity;
    return (Date.now() - then) / 86_400_000;
}

const fmtPos = (p) => (p == null ? 'unranked' : `#${p}`);

/**
 * SERP features that sit above or between organic results and take clicks from
 * them. The AI Overview is excluded on purpose: it has its own, stronger rules
 * (citation tracking) above.
 */
export const DISPLACING_FEATURES = Object.freeze({
    featured_snippet: 'a featured snippet',
    people_also_ask: "a 'People also ask' box",
    videos: 'a video carousel',
    shopping: 'shopping results',
    knowledge_graph: 'a knowledge panel',
});

/**
 * What changed on the results page between two snapshots, from the site's
 * point of view. Pure; costs no credits (both snapshots are already stored).
 *
 * - featuresAdded / featuresRemoved: displacing features that appeared/vanished
 * - overtakenBy: domains now ABOVE the site that were below it (or absent)
 *   last time — the answer to "lost to whom?"
 *
 * With no previous snapshot every list is empty: no baseline, no claim.
 */
export function serpDiff({ previous = null, organic = [], features = [], domain, previousPosition = null, position = null } = {}) {
    if (!previous) return { featuresAdded: [], featuresRemoved: [], overtakenBy: [] };

    const before = new Set(previous.features || []);
    const now = new Set(features || []);
    const featuresAdded = [...now].filter((f) => f in DISPLACING_FEATURES && !before.has(f));
    const featuresRemoved = [...before].filter((f) => f in DISPLACING_FEATURES && !now.has(f));

    const overtakenBy = [];
    if (previousPosition != null) {
        const seen = new Set();
        for (const c of organic) {
            if (!c?.domain || c.position == null || domainMatches(c.domain, domain)) continue;
            if (position != null && c.position >= position) continue;
            const d = String(c.domain).toLowerCase();
            if (seen.has(d)) continue;
            seen.add(d);
            const was = (previous.organic || []).find((p) => String(p?.domain || '').toLowerCase() === d);
            if (!was || was.position == null || was.position > previousPosition) {
                overtakenBy.push({ domain: c.domain, url: c.url ?? null, previousPosition: was?.position ?? null, position: c.position });
            }
        }
    }
    return { featuresAdded, featuresRemoved, overtakenBy: overtakenBy.slice(0, 3) };
}

const featureList = (codes) => joinPhrases(codes.map((c) => DISPLACING_FEATURES[c]).filter(Boolean));

/** Join a list of phrases into readable English ("a", "a and b", "a, b, and c"). */
function joinPhrases(list) {
    if (list.length === 0) return '';
    if (list.length === 1) return list[0];
    if (list.length === 2) return `${list[0]} and ${list[1]}`;
    return `${list.slice(0, -1).join(', ')}, and ${list.at(-1)}`;
}

/**
 * Attribute a cause to ONE keyword's SERP evidence.
 * Rules are ordered; the first match is that keyword's primary cause.
 *
 * @param {object} f keyword finding
 * @param {'drop'|'spike'|'flat'} direction the traffic direction being explained
 */
export function attributeKeyword(f, direction) {
    const causes = [];
    const prev = f.previousPosition;
    const curr = f.position;
    const moved = prev != null && curr != null ? prev - curr : null;  // +ve = improved

    // Who moved above you — attached to the first rank cause, so a loss names
    // the winner instead of leaving the user to go and look.
    const overtakers = (f.overtakenBy || []).slice(0, 2);
    let overtakeNoted = false;
    const withOvertake = (phrase) => {
        if (overtakeNoted || overtakers.length === 0) return phrase;
        overtakeNoted = true;
        return `${phrase}, with ${joinPhrases(overtakers.map((o) => o.domain))} moving above you`;
    };

    // 1. rank dropped materially
    if (moved != null && moved <= -RANK_MOVE_THRESHOLD) {
        causes.push({
            code: 'rank_drop',
            phrase: withOvertake(`rank slipped ${fmtPos(prev)} → ${fmtPos(curr)} on '${f.keyword}'`),
            ...(overtakers.length && { overtakenBy: overtakers }),
        });
    }

    // 6. fell off page one entirely (distinct from a small slide)
    if (prev != null && prev <= 10 && (curr == null || curr > 10)) {
        causes.push({
            code: 'page_one_exit',
            phrase: withOvertake(`you dropped off page one for '${f.keyword}'`),
            ...(overtakers.length && { overtakenBy: overtakers }),
        });
    }

    // 2. a NEW AI Overview appeared and does not cite you — the highest-signal
    //    cause of a rank-stable traffic drop, which is why it is its own code.
    if (f.citationChange === 'new_overview' && !f.domainIsCited) {
        const others = (f.newCitedDomains || []).slice(0, 2);
        causes.push({
            code: 'ai_overview_displacement',
            phrase: others.length
                ? `Google's new AI answer box now quotes ${joinPhrases(others)} instead of you`
                : `Google now shows an AI answer box for '${f.keyword}' and it does not quote you`,
        });
    }

    // 3. you were cited, now you are not
    if (f.citationChange === 'lost') {
        causes.push({
            code: 'ai_citation_lost',
            phrase: `you were dropped from Google's AI answer box for '${f.keyword}'`,
        });
    }

    // 8. new SERP features pushing organic results down. Only for a drop, and
    //    only while the page is on page one — a video carousel does not cost
    //    clicks to a result on page four.
    const onPageOne = curr != null && curr <= 10;
    if (direction === 'drop' && onPageOne && f.featuresAdded?.length) {
        causes.push({
            code: 'serp_feature_added',
            phrase: `Google added ${featureList(f.featuresAdded)} to the results for '${f.keyword}', pushing organic listings down`,
            features: f.featuresAdded,
        });
    }

    // 4 & 5 — upside causes, only meaningful when explaining a spike
    if (direction === 'spike') {
        if (onPageOne && f.featuresRemoved?.length) {
            causes.push({
                code: 'serp_feature_removed',
                phrase: `Google removed ${featureList(f.featuresRemoved)} from the results for '${f.keyword}', lifting organic listings`,
                features: f.featuresRemoved,
            });
        }
        if (moved != null && moved >= RANK_MOVE_THRESHOLD) {
            causes.push({
                code: 'rank_gain',
                phrase: `rank improved ${fmtPos(prev)} → ${fmtPos(curr)} on '${f.keyword}'`,
            });
        }
        if (f.citationChange === 'gained') {
            causes.push({
                code: 'ai_citation_gained',
                phrase: `Google's AI answer box for '${f.keyword}' now quotes you`,
            });
        }
    }

    return causes;
}

/**
 * The competitor page standing where you used to — the concrete thing to go read.
 *
 * Diagnosis without a next step leaves the user knowing they lost without
 * knowing to whom. This picks the highest-ranking competitor now sitting above
 * the page, preferring one that the AI Overview also cites (that domain is
 * winning on both surfaces, so it is the sharpest example to study).
 */
export function pickRival(finding) {
    const competitors = (finding.competitors || []).filter(
        (c) => c.domain && c.position != null && (finding.position == null || c.position < finding.position),
    );
    if (competitors.length === 0) return null;

    const citedDomains = new Set((finding.newCitedDomains || []).map((d) => String(d).toLowerCase()));
    const overtook = new Set((finding.overtakenBy || []).map((o) => String(o.domain).toLowerCase()));
    const isCited = (c) => citedDomains.has(String(c.domain).toLowerCase());
    const didOvertake = (c) => overtook.has(String(c.domain).toLowerCase());
    // A domain that just passed you is the sharpest example; one that did so
    // AND is quoted in the AI answer is sharper still.
    const rival = competitors.find((c) => didOvertake(c) && isCited(c))
        || competitors.find(didOvertake)
        || competitors.find(isCited)
        || competitors[0];

    return {
        domain: rival.domain,
        url: rival.url,
        title: rival.title,
        position: rival.position,
        // Why this one was chosen — shown to the user, not just inferred.
        alsoCitedInAiOverview: isCited(rival),
        overtookYou: didOvertake(rival),
    };
}

/**
 * A concrete next step, derived from the causes that actually fired.
 * Returns null when there is nothing honest to suggest.
 */
export function nextStep(causes, keywordFindings, direction) {
    const codes = new Set(causes.map((c) => c.code));

    if (codes.has('unexplained_by_serp')) {
        return {
            action: 'look_beyond_search',
            text: 'Search looks unchanged, so check referrers, campaigns, and recent deploys before spending time on SEO.',
        };
    }
    if (direction === 'spike') {
        return {
            action: 'reinforce',
            text: 'Whatever changed here is working — consider applying the same approach to similar pages.',
        };
    }

    // A rank or citation loss: point at the page that is now winning.
    const loser = keywordFindings.find((f) =>
        !f.error && (f.positionChange < 0 || f.citationChange === 'lost' || f.citationChange === 'new_overview'));

    // Rank held, but the page got crowded: advise on the feature itself.
    if (!loser && codes.has('serp_feature_added')) {
        const added = new Set(causes.filter((c) => c.code === 'serp_feature_added').flatMap((c) => c.features || []));
        if (added.has('featured_snippet') || added.has('people_also_ask')) {
            return {
                action: 'target_feature',
                text: 'Answer the searcher\'s question in a short paragraph or list near the top of the page — that is what Google lifts into snippets and \'People also ask\'.',
            };
        }
        if (added.has('videos')) {
            return { action: 'target_feature', text: 'Google is now favouring video for this search — a short video on the page can win a spot in the carousel.' };
        }
        return { action: 'target_feature', text: 'Your position held but the results page got busier, so expect fewer clicks at the same rank. Title and description are what earn the click now.' };
    }
    if (!loser) return null;

    const rival = pickRival(loser);
    if (!rival) return null;

    return {
        action: 'study_rival',
        text: codes.has('ai_overview_displacement') || codes.has('ai_citation_lost')
            ? `Compare your page against ${rival.domain}, which now ranks #${rival.position}${rival.alsoCitedInAiOverview ? " and is quoted in Google's AI answer" : ''} — AI answers tend to quote pages that address the question directly and early.`
            : `Compare your page against ${rival.domain}, which ${rival.overtookYou ? 'moved above you and ' : ''}now ranks #${rival.position} for this term.`,
        rival,
    };
}

/**
 * Build the full explanation.
 *
 * @param {object} input
 * @param {string} input.path
 * @param {object} input.traffic  result of detectChange()
 * @param {Array}  input.keywordFindings
 * @param {string} [input.windowUsed]
 * @param {Array<string>} [input.caveats] upstream caveats (e.g. SerpApi down)
 */
export function explain({ path, traffic, keywordFindings = [], windowUsed = '90d', caveats = [] } = {}) {
    const notes = [...caveats];
    const direction = traffic.direction;

    // No material traffic movement — say so plainly rather than hunting for a
    // cause that explains nothing.
    if (!traffic.significant) {
        return {
            path,
            traffic: { ...traffic, windowUsed },
            keywordFindings,
            causes: [],
            explanation: traffic.previousWeek == null
                ? `Not enough weekly history for ${path} to compare week over week yet (${windowUsed} window).`
                : `Traffic to ${path} held roughly steady this week (${traffic.previousWeek} → ${traffic.currentWeek} views, ${traffic.changePct >= 0 ? '+' : ''}${traffic.changePct}%). No significant change to explain.`,
            confidence: 'high',
            caveats: notes,
        };
    }

    // Gather causes across keywords, tagging which keyword produced each.
    const all = [];
    for (const f of keywordFindings) {
        for (const c of attributeKeyword(f, direction)) {
            all.push({ ...c, keyword: f.keyword });
        }
        if (f.error) notes.push(`Could not check '${f.keyword}': ${f.error}`);
        if (f.previousPosition == null && f.position != null && !f.error) {
            notes.push(`This is the first rank snapshot for '${f.keyword}', so there is no prior week to compare against.`);
        }
    }

    const pct = Math.abs(traffic.changePct);
    const verb = direction === 'drop' ? 'dropped' : 'rose';
    const headline = `Traffic to ${path} ${verb} ${pct}% this week (${traffic.previousWeek} → ${traffic.currentWeek} views).`;

    // Rule 7 — traffic moved, SERP did not. An honest "not search" answer.
    if (all.length === 0) {
        const checked = keywordFindings.length;
        return {
            path,
            traffic: { ...traffic, windowUsed },
            keywordFindings,
            causes: [{ code: 'unexplained_by_serp', phrase: 'no search-side change detected' }],
            explanation: `${headline} Search position and AI answer status are unchanged${checked ? ` across ${checked} tracked keyword${checked === 1 ? '' : 's'}` : ''}, so the cause is probably not search — check referrers, campaigns, or a recent deploy.`,
            confidence: 'low',
            caveats: notes,
            nextStep: nextStep([{ code: 'unexplained_by_serp' }], keywordFindings, direction),
        };
    }

    // Confidence: strong when a prior snapshot was recent enough to trust.
    const freshest = Math.min(...keywordFindings.map((f) => daysSince(f.changeObservedAt)));
    const confidence = freshest <= STALE_SNAPSHOT_DAYS ? 'high' : 'medium';
    if (confidence === 'medium') {
        notes.push(`The previous SERP snapshot is more than ${STALE_SNAPSHOT_DAYS} days old, so the rank change may not line up exactly with this week.`);
    }

    return {
        path,
        traffic: { ...traffic, windowUsed },
        keywordFindings,
        causes: all,
        explanation: `${headline} Likely cause: ${joinPhrases(all.map((c) => c.phrase))}.`,
        confidence,
        caveats: notes,
        nextStep: nextStep(all, keywordFindings, direction),
    };
}

export default { weekStart, bucketByWeek, detectChange, attributeKeyword, explain, pickRival, nextStep, serpDiff };
