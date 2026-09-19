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
 * CREDIT DISCIPLINE. A SerpApi free tier is 100 searches/month, so an unbounded
 * loop would exhaust it in a day:
 *   - one check per keyword per RANK_CHECK_MIN_HOURS (default 24)
 *   - a hard ceiling per sweep (RANK_CHECK_MAX_PER_RUN, default 10)
 *   - snapshots are shared, so two sites tracking one keyword cost one credit
 *   - sites with no key are skipped entirely rather than served fixtures, since
 *     recording fixture positions as history would poison the deltas
 */
import { query } from '../db/postgres.js';
import searchVisibility from './searchVisibilityService.js';
import serpapiKeys from './serpapiKeyService.js';

const MIN_HOURS = parseInt(process.env.RANK_CHECK_MIN_HOURS) || 24;
const MAX_PER_RUN = parseInt(process.env.RANK_CHECK_MAX_PER_RUN) || 10;

/**
 * Keywords due a check: mapped to a page, and either never checked or last
 * checked longer ago than MIN_HOURS.
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

    const cutoff = Date.now() - MIN_HOURS * 3600_000;
    return rows
        .filter((r) => !r.last_checked || new Date(r.last_checked).getTime() < cutoff)
        // Oldest first, so nothing is starved by a long keyword list.
        .sort((a, b) => new Date(a.last_checked || 0) - new Date(b.last_checked || 0))
        .slice(0, limit);
}

/**
 * Check every due keyword once. Returns a summary rather than throwing, so one
 * bad keyword cannot stop the sweep.
 */
export async function sweepRanks({ silent = true, limit = MAX_PER_RUN } = {}) {
    const due = await dueKeywords(limit);
    if (due.length === 0) return { checked: 0, skipped: 0, failed: 0 };

    let checked = 0, skipped = 0, failed = 0;

    for (const row of due) {
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
    return (await dueKeywords(1000)).length;
}

export default { sweepRanks, pendingCount };
