/**
 * Scheduled rank tracking.
 *
 * The correlation can only explain a change when it has a PREVIOUS observation
 * to compare against. Checking a keyword on demand records one snapshot; the
 * delta ("#3 → #6") needs a second one from an earlier day. Without a scheduler
 * the first visit of every week reports "this is the first rank snapshot",
 * which is honest but useless.
 *
 * So this walks every mapped keyword on a slow cadence and records where the
 * site stands — including "not ranking", which is a real and useful datapoint
 * for a new page that has not been indexed yet.
 *
 * CREDIT DISCIPLINE. A SerpApi plan is a fixed monthly search allowance, so an
 * unbounded loop would exhaust it in a day:
 *   - one check per keyword per the site's minHours (default RANK_CHECK_MIN_HOURS,
 *     or 24) — set per site in the UI, since the cadence IS the budget
 *   - a hard ceiling per sweep (the site's maxPerRun, default
 *     RANK_CHECK_MAX_PER_RUN or 10)
 *   - snapshots are shared, so two sites tracking one keyword cost one credit
 *   - sites with no key are skipped entirely rather than served fixtures, since
 *     recording fixture positions as history would poison the deltas
 */
import { query } from '../db/postgres.js';
import searchVisibility from './searchVisibilityService.js';
import serpapiKeys from './serpapiKeyService.js';

/**
 * Keywords due a check: mapped to a page, and either never checked or last
 * checked longer ago than that SITE's minHours.
 *
 * The cutoff is per site rather than global because each site has its own
 * SerpApi plan, so "how often is too often" is a different number for each.
 */
async function dueKeywords(limit) {
    const { rows } = await query(
        `SELECT DISTINCT ON (pk.site_id, pk.keyword, pk.location)
                pk.site_id, pk.keyword, pk.location, pk.path,
                s.domain,
                (SELECT MAX(checked_at) FROM rank_history rh
                  WHERE rh.site_id = pk.site_id AND rh.keyword = pk.keyword
                    AND rh.location = pk.location) AS last_checked
           FROM page_keywords pk
           JOIN sites s ON s.id = pk.site_id
          ORDER BY pk.site_id, pk.keyword, pk.location`,
        [],
    );

    // One budget lookup per site, not per keyword.
    const budgets = new Map();
    const due = [];
    for (const r of rows) {
        if (!budgets.has(r.site_id)) {
            budgets.set(r.site_id, await serpapiKeys.getBudget(r.site_id));
        }
        const cutoff = Date.now() - budgets.get(r.site_id).minHours * 3600_000;
        if (!r.last_checked || new Date(r.last_checked).getTime() < cutoff) due.push(r);
    }

    due
        // Oldest first, so nothing is starved by a long keyword list.
        .sort((a, b) => new Date(a.last_checked || 0) - new Date(b.last_checked || 0));

    // A per-sweep ceiling still applies. When the caller did not name one, use
    // the largest any participating site allows — each site's own cap is then
    // enforced during the sweep, so a generous site cannot spend a frugal
    // site's credits.
    const cap = limit ?? Math.max(1, ...[...budgets.values()].map((b) => b.maxPerRun));
    return { due: due.slice(0, cap), budgets };
}

/**
 * Check every due keyword once. Returns a summary rather than throwing, so one
 * bad keyword cannot stop the sweep.
 */
export async function sweepRanks({ silent = true, limit = null } = {}) {
    const { due, budgets } = await dueKeywords(limit);
    if (due.length === 0) return { checked: 0, skipped: 0, failed: 0 };

    let checked = 0, skipped = 0, failed = 0;
    // Per-site spend this sweep, so one site cannot exceed its own maxPerRun
    // just because another site's larger cap set the overall ceiling.
    const spent = new Map();

    for (const row of due) {
        const cap = budgets.get(row.site_id)?.maxPerRun ?? 0;
        if ((spent.get(row.site_id) || 0) >= cap) continue;

        // No key for this site → skip. Recording a fixture position as history
        // would make every later delta meaningless.
        const { key } = await serpapiKeys.resolveKey(row.site_id);
        if (!key) { skipped++; continue; }

        const domain = String(row.domain || '')
            .replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
        if (!domain) { skipped++; continue; }

        try {
            // maxAgeHours 0 forces a fresh look: the point of a scheduled check
            // is a NEW datapoint, not a re-read of yesterday's snapshot.
            await searchVisibility.checkKeyword(row.site_id, domain, {
                keyword: row.keyword,
                location: row.location,
                maxAgeHours: 0,
            });
            checked++;
            spent.set(row.site_id, (spent.get(row.site_id) || 0) + 1);
        } catch (err) {
            failed++;
            if (!silent) console.warn(`⚠  rank check failed for "${row.keyword}":`, err.message);
        }
    }

    if (!silent) {
        console.log(`  ✓ rank sweep: ${checked} checked, ${skipped} skipped (no key), ${failed} failed`);
    }
    return { checked, skipped, failed };
}

/** How many keywords are waiting, for the settings UI. */
export async function pendingCount() {
    return (await dueKeywords(1000)).due.length;
}

export default { sweepRanks, pendingCount };
