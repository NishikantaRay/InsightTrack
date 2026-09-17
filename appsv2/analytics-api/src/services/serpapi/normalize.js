/**
 * SerpApi response → our stable shapes. Pure functions, no I/O.
 *
 * Isolating this means a provider response-format change touches one file, and
 * every downstream consumer (persistence, correlation, tools) is testable from
 * plain fixtures.
 *
 * A deliberate choice throughout: when the domain is NOT found we return
 * `position: null` with `found: false` — never a sentinel like 0 or 101. A
 * sentinel is a number a model will happily average, and "ranks 101st" is a
 * different claim from "does not rank".
 */

/** Strip protocol, www., path and port → bare registrable-ish host. */
export function extractDomain(url) {
    if (!url) return null;
    try {
        return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
        return String(url).replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].split(':')[0].toLowerCase() || null;
    }
}

/** Do two hosts refer to the same site? Matches the host or any subdomain of it. */
export function domainMatches(candidate, target) {
    if (!candidate || !target) return false;
    const c = String(candidate).replace(/^www\./i, '').toLowerCase();
    const t = String(target).replace(/^www\./i, '').toLowerCase();
    return c === t || c.endsWith(`.${t}`);
}

/** organic_results[] → [{ position, domain, url, title }] */
export function normalizeOrganic(raw) {
    const results = Array.isArray(raw?.organic_results) ? raw.organic_results : [];
    return results
        .map((r) => ({
            position: Number.isFinite(r?.position) ? r.position : null,
            domain: extractDomain(r?.link),
            url: r?.link ?? null,
            title: r?.title ?? null,
        }))
        .filter((r) => r.url);
}

/**
 * AI Overview box → { present, citations }.
 * SerpApi exposes it as `ai_overview`; cited sources appear under `references`
 * or `sources` depending on the response, so we accept either.
 */
export function normalizeAiOverview(raw) {
    const ao = raw?.ai_overview;
    if (!ao) return { present: false, citations: [] };

    const refs = Array.isArray(ao.references) ? ao.references
        : Array.isArray(ao.sources) ? ao.sources
        : [];

    const citations = refs
        .map((r, i) => ({
            position: Number.isFinite(r?.index) ? r.index : i + 1,
            domain: extractDomain(r?.link),
            url: r?.link ?? null,
            title: r?.title ?? r?.snippet ?? null,
        }))
        .filter((c) => c.url);

    return { present: true, citations };
}

/** related_questions[] + related_searches[] → keyword-expansion shape. */
export function normalizeRelated(raw, limit = 10) {
    const paa = (Array.isArray(raw?.related_questions) ? raw.related_questions : [])
        .slice(0, limit)
        .map((q) => ({
            question: q?.question ?? null,
            snippet: q?.snippet ?? null,
            sourceDomain: extractDomain(q?.link),
        }))
        .filter((q) => q.question);

    const related = (Array.isArray(raw?.related_searches) ? raw.related_searches : [])
        .slice(0, limit)
        .map((r) => ({ query: r?.query ?? null, link: r?.link ?? null }))
        .filter((r) => r.query);

    return { peopleAlsoAsk: paa, relatedSearches: related };
}

/** Which SERP features were present — useful context for an explanation. */
export function normalizeFeatures(raw) {
    const features = [];
    if (raw?.ai_overview) features.push('ai_overview');
    if (raw?.answer_box) features.push('featured_snippet');
    if (Array.isArray(raw?.related_questions) && raw.related_questions.length) features.push('people_also_ask');
    if (Array.isArray(raw?.knowledge_graph) || raw?.knowledge_graph) features.push('knowledge_graph');
    if (Array.isArray(raw?.inline_videos) && raw.inline_videos.length) features.push('videos');
    if (Array.isArray(raw?.shopping_results) && raw.shopping_results.length) features.push('shopping');
    return features;
}

/** Locate a domain within normalized organic results. */
export function findDomainPosition(organic, domain) {
    if (!domain) return { found: false, position: null, url: null };
    const hit = organic.find((r) => domainMatches(r.domain, domain));
    return hit
        ? { found: true, position: hit.position, url: hit.url }
        : { found: false, position: null, url: null };
}

/**
 * Full normalization of one raw response into the row we persist.
 * `source` is carried through so a fixture-backed result is never mistaken for
 * live data anywhere downstream.
 */
export function normalizeSnapshot(raw, { keyword, location = 'United States', device = 'desktop' } = {}) {
    return {
        keyword,
        location,
        device,
        engine: 'google',
        organic: normalizeOrganic(raw),
        aiOverview: normalizeAiOverview(raw),
        related: normalizeRelated(raw),
        features: normalizeFeatures(raw),
        source: raw?._source === 'fixture' ? 'fixture' : 'serpapi',
        totalResults: raw?.search_information?.total_results ?? null,
        fetchedAt: new Date().toISOString(),
    };
}

export default {
    extractDomain, domainMatches, normalizeOrganic, normalizeAiOverview,
    normalizeRelated, normalizeFeatures, findDomainPosition, normalizeSnapshot,
};
