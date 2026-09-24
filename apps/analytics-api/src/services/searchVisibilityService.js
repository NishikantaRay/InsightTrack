/**
 * Search-visibility persistence + orchestration.
 *
 * Sits between the pure layers (serpapi/client, serpapi/normalize,
 * correlationService) and PostgreSQL. Owns:
 *   • keyword ↔ page mapping        (page_keywords)
 *   • the durable SERP cache        (serp_snapshots)
 *   • per-site rank history         (rank_history)  ← what makes "#3 → #6" real
 *
 * WRITES GO TO POSTGRESQL ONLY (invariant 2). Analytics reads still come from
 * DuckDB via queries.js — this module never writes there.
 *
 * Every statement is parameterized with $1/$2 (invariant 1). Keyword strings
 * come from user input and are never concatenated into SQL.
 */
import { query } from '../db/postgres.js';
import { analyticsCache, CACHE_TTL } from './cache.js';
import { search, isFixtureMode } from './serpapi/client.js';
import serpapiKeys from './serpapiKeyService.js';
import searchAlerts from './searchAlertsService.js';
import { serpDiff } from './correlationService.js';
import {
    normalizeSnapshot, findDomainPosition, domainMatches,
} from './serpapi/normalize.js';

const DEFAULT_LOCATION = 'United States';
const DEFAULT_DEVICE = 'desktop';
const DEFAULT_MAX_AGE_HOURS = 24;

// ── keyword ↔ page mapping ───────────────────────────────────────────────────

/** Keywords mapped to one page, primary first. */
export async function getKeywordsForPage(siteId, path) {
    const { rows } = await query(
        `SELECT keyword, location, is_primary
           FROM page_keywords
          WHERE site_id = $1 AND path = $2
          ORDER BY is_primary DESC, keyword ASC`,
        [siteId, path],
    );
    return rows.map((r) => ({ keyword: r.keyword, location: r.location, isPrimary: r.is_primary }));
}

/** Every mapped page/keyword pair for a site. Drives the dashboard list. */
export async function getSiteKeywords(siteId) {
    const { rows } = await query(
        `SELECT path, keyword, location, is_primary
           FROM page_keywords
          WHERE site_id = $1
          ORDER BY path ASC, is_primary DESC, keyword ASC`,
        [siteId],
    );
    return rows.map((r) => ({ path: r.path, keyword: r.keyword, location: r.location, isPrimary: r.is_primary }));
}

export async function addPageKeyword(siteId, { path, keyword, location = DEFAULT_LOCATION, isPrimary = false }) {
    const { rows } = await query(
        `INSERT INTO page_keywords (site_id, path, keyword, location, is_primary)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (site_id, path, keyword, location)
         DO UPDATE SET is_primary = EXCLUDED.is_primary
         RETURNING path, keyword, location, is_primary`,
        [siteId, path, keyword, location, isPrimary],
    );
    return rows[0];
}

export async function removePageKeyword(siteId, { path, keyword, location = DEFAULT_LOCATION }) {
    const { rowCount } = await query(
        `DELETE FROM page_keywords
          WHERE site_id = $1 AND path = $2 AND keyword = $3 AND location = $4`,
        [siteId, path, keyword, location],
    );
    return rowCount > 0;
}

// ── SERP snapshots (the credit-conserving cache of record) ───────────────────

/** Most recent snapshot within maxAgeHours, or null. */
export async function getRecentSnapshot(keyword, location, device, maxAgeHours) {
    const { rows } = await query(
        `SELECT id, keyword, location, device, organic, ai_overview, related,
                features, source, fetched_at
           FROM serp_snapshots
          WHERE keyword = $1 AND location = $2 AND device = $3
            AND fetched_at > NOW() - ($4 || ' hours')::interval
          ORDER BY fetched_at DESC
          LIMIT 1`,
        [keyword, location, device, String(maxAgeHours)],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
        id: r.id,
        keyword: r.keyword,
        location: r.location,
        device: r.device,
        organic: r.organic || [],
        aiOverview: r.ai_overview || { present: false, citations: [] },
        related: r.related || { peopleAlsoAsk: [], relatedSearches: [] },
        features: r.features || [],
        source: r.source,
        fetchedAt: r.fetched_at,
    };
}

async function saveSnapshot(snap) {
    const { rows } = await query(
        `INSERT INTO serp_snapshots
           (keyword, location, device, engine, organic, ai_overview, related, features, source)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)
         RETURNING id, fetched_at`,
        [
            snap.keyword, snap.location, snap.device, snap.engine,
            JSON.stringify(snap.organic), JSON.stringify(snap.aiOverview),
            JSON.stringify(snap.related), snap.features, snap.source,
        ],
    );
    return { ...snap, id: rows[0].id, fetchedAt: rows[0].fetched_at };
}

/**
 * Get a SERP for a keyword, spending a credit only when necessary.
 *
 * Cache layers, cheapest first:
 *   1. analyticsCache (in-memory, coalescing) — concurrent asks share ONE fetch
 *   2. serp_snapshots (PostgreSQL, maxAgeHours) — survives restarts
 *   3. live SerpApi call (or a fixture when no key is set)
 */
export async function getSerp({
    keyword,
    location = DEFAULT_LOCATION,
    device = DEFAULT_DEVICE,
    maxAgeHours = DEFAULT_MAX_AGE_HOURS,
    siteId = null,
} = {}) {
    const cacheKey = analyticsCache.key('serp', keyword, location, device, maxAgeHours);

    return analyticsCache.getOrFetch(cacheKey, CACHE_TTL.SERP, async () => {
        const recent = await getRecentSnapshot(keyword, location, device, maxAgeHours);
        if (recent) return { ...recent, cached: true };

        // The site's own key (decrypted here, never logged or returned) takes
        // precedence over the server-wide env var; neither → fixture mode.
        const { key } = await serpapiKeys.resolveKey(siteId);
        const raw = await search({ keyword, location, device, apiKey: key });
        const normalized = normalizeSnapshot(raw, { keyword, location, device });
        const saved = await saveSnapshot(normalized);

        // Record the outcome so Settings can show a real connection status.
        if (siteId && key) {
            await serpapiKeys.recordResult(siteId, { ok: true }).catch(() => {});
        }
        return { ...saved, cached: false };
    });
}

// ── rank history (what makes "#3 → #6" expressible) ──────────────────────────

/** The most recent rank row BEFORE `before` — i.e. the previous observation. */
export async function getPreviousRank(siteId, keyword, location, device, before) {
    const { rows } = await query(
        `SELECT position, url, ai_overview, is_cited, checked_at, snapshot_id
           FROM rank_history
          WHERE site_id = $1 AND keyword = $2 AND location = $3 AND device = $4
            AND checked_at < $5
          ORDER BY checked_at DESC
          LIMIT 1`,
        [siteId, keyword, location, device, before],
    );
    if (!rows[0]) return null;
    return {
        position: rows[0].position,
        url: rows[0].url,
        hasAiOverview: rows[0].ai_overview,
        isCited: rows[0].is_cited,
        checkedAt: rows[0].checked_at,
        snapshotId: rows[0].snapshot_id ?? null,
    };
}

/** The organic list + features of a stored snapshot — the "before" of a diff. */
export async function getSnapshotById(id) {
    if (!id) return null;
    const { rows } = await query(
        `SELECT organic, features FROM serp_snapshots WHERE id = $1`,
        [id],
    );
    if (!rows[0]) return null;
    return { organic: rows[0].organic || [], features: rows[0].features || [] };
}

export async function recordRank(siteId, { keyword, location, device, position, url, hasAiOverview, isCited, snapshotId, checkedAt }) {
    const { rows } = await query(
        `INSERT INTO rank_history
           (site_id, keyword, location, device, position, url, ai_overview, is_cited, snapshot_id, checked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, NOW()))
         RETURNING id, checked_at`,
        [siteId, keyword, location, device, position, url, !!hasAiOverview, !!isCited, snapshotId ?? null, checkedAt ?? null],
    );
    return rows[0];
}

/** Rank observations over time — powers the dashboard trend. */
export async function getRankHistory(siteId, keyword, location = DEFAULT_LOCATION, device = DEFAULT_DEVICE, limit = 90) {
    const { rows } = await query(
        `SELECT position, url, ai_overview, is_cited, checked_at
           FROM rank_history
          WHERE site_id = $1 AND keyword = $2 AND location = $3 AND device = $4
          ORDER BY checked_at DESC
          LIMIT $5`,
        [siteId, keyword, location, device, limit],
    );
    return rows
        .map((r) => ({
            position: r.position,
            url: r.url,
            hasAiOverview: r.ai_overview,
            isCited: r.is_cited,
            checkedAt: r.checked_at,
        }))
        .reverse();
}

// ── the composed per-keyword finding ─────────────────────────────────────────

/**
 * Check one keyword for a site: current standing, the delta vs. the previous
 * observation, and AI-Overview citation status. Records the observation so the
 * NEXT call has a delta to compare against.
 *
 * Returns the shape correlationService.attributeKeyword() consumes.
 */
export async function checkKeyword(siteId, domain, { keyword, location = DEFAULT_LOCATION, device = DEFAULT_DEVICE, maxAgeHours = DEFAULT_MAX_AGE_HOURS } = {}) {
    const serp = await getSerp({ keyword, location, device, maxAgeHours, siteId });

    const { found, position, url } = findDomainPosition(serp.organic, domain);
    const hasAiOverview = !!serp.aiOverview?.present;
    const citations = serp.aiOverview?.citations || [];
    const domainIsCited = citations.some((c) => domainMatches(c.domain, domain));

    const prev = await getPreviousRank(siteId, keyword, location, device, serp.fetchedAt || new Date());

    // Compare against the previous observation's SERP: which features appeared
    // and who moved above the site. Both snapshots are stored — no credits.
    const diff = serpDiff({
        previous: await getSnapshotById(prev?.snapshotId).catch(() => null),
        organic: serp.organic,
        features: serp.features,
        domain,
        previousPosition: prev?.position ?? null,
        position,
    });

    // Citation transition — 'new_overview' is called out separately because an
    // AI Overview appearing where there was none is the single highest-signal
    // explanation for a traffic drop with a stable rank.
    let citationChange = 'unknown';
    if (prev) {
        if (!prev.hasAiOverview && hasAiOverview) citationChange = 'new_overview';
        else if (prev.isCited && !domainIsCited) citationChange = 'lost';
        else if (!prev.isCited && domainIsCited) citationChange = 'gained';
        else citationChange = 'unchanged';
    }

    // Record this observation (skipped for a cached SERP we already logged today).
    if (!serp.cached) {
        const recorded = await recordRank(siteId, {
            keyword, location, device, position, url,
            hasAiOverview, isCited: domainIsCited,
            snapshotId: serp.id, checkedAt: serp.fetchedAt,
        });

        // Raise in-app alerts for a real move. Never from fixtures — a sample
        // SERP "dropping" the site would be an alert about nothing. A failure
        // here must not fail the rank check that has already been recorded.
        if (prev && serp.source !== 'fixture') {
            await searchAlerts.recordAlerts(siteId, {
                rankHistoryId: recorded?.id, keyword, location, device, prev,
                cur: { position, isCited: domainIsCited, hasAiOverview, ...diff },
            }).catch((err) => console.warn(`⚠  search alert failed for "${keyword}":`, err.message));
        }
    }

    return {
        keyword,
        location,
        device,
        found,
        position,
        previousPosition: prev?.position ?? null,
        positionChange: prev?.position != null && position != null ? prev.position - position : null,
        url,
        hasAiOverview,
        domainIsCited,
        previouslyCited: prev?.isCited ?? null,
        citationChange,
        citations,
        newCitedDomains: citations.map((c) => c.domain).filter((d) => d && !domainMatches(d, domain)),
        competitors: serp.organic.slice(0, 10),
        features: serp.features,
        featuresAdded: diff.featuresAdded,
        featuresRemoved: diff.featuresRemoved,
        overtakenBy: diff.overtakenBy,
        changeObservedAt: prev?.checkedAt ?? null,
        source: serp.source,
        cached: !!serp.cached,
        fetchedAt: serp.fetchedAt,
    };
}

export { isFixtureMode };

/** True when this SITE has no key (stored or env) — i.e. results are fixtures. */
export async function isFixtureModeForSite(siteId) {
    const { key } = await serpapiKeys.resolveKey(siteId);
    return !key;
}

export default {
    getKeywordsForPage, getSiteKeywords, addPageKeyword, removePageKeyword,
    getSerp, getRecentSnapshot, getPreviousRank, getSnapshotById, recordRank, getRankHistory,
    checkKeyword, isFixtureMode, isFixtureModeForSite,
};
