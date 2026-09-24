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

    // 1. rank dropped materially
    if (moved != null && moved <= -RANK_MOVE_THRESHOLD) {
        causes.push({
            code: 'rank_drop',
            phrase: `rank slipped ${fmtPos(prev)} → ${fmtPos(curr)} on '${f.keyword}'`,
        });
    }

    // 6. fell off page one entirely (distinct from a small slide)
    if (prev != null && prev <= 10 && (curr == null || curr > 10)) {
        causes.push({
            code: 'page_one_exit',
            phrase: `you dropped off page one for '${f.keyword}'`,
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

    // 4 & 5 — upside causes, only meaningful when explaining a spike
    if (direction === 'spike') {
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
    const cited = competitors.find((c) => citedDomains.has(String(c.domain).toLowerCase()));
    const rival = cited || competitors[0];

    return {
        domain: rival.domain,
        url: rival.url,
        title: rival.title,
        position: rival.position,
        // Why this one was chosen — shown to the user, not just inferred.
        alsoCitedInAiOverview: citedDomains.has(String(rival.domain).toLowerCase()),
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
    if (!loser) return null;

    const rival = pickRival(loser);
    if (!rival) return null;

    return {
        action: 'study_rival',
        text: codes.has('ai_overview_displacement') || codes.has('ai_citation_lost')
            ? `Compare your page against ${rival.domain}, which now ranks #${rival.position}${rival.alsoCitedInAiOverview ? " and is quoted in Google's AI answer" : ''} — AI answers tend to quote pages that address the question directly and early.`
            : `Compare your page against ${rival.domain}, which now ranks #${rival.position} for this term.`,
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

export default { weekStart, bucketByWeek, detectChange, attributeKeyword, explain, pickRival, nextStep };
