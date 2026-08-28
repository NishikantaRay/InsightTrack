/**
 * Fixed benchmark query workload.
 *
 * Each entry carries a PostgreSQL statement and a DuckDB statement that are
 * LOGICALLY EQUIVALENT: same filters, same grouping, same ordering, same row
 * limit, same semantics. Where dialects differ the difference is syntactic only
 * (e.g. `CAST(timestamp AS DATE)` is spelled identically, but interval literals
 * and placeholder syntax are not).
 *
 * Rules applied when writing these:
 *   - No engine-specific hints, no materialised views, no pre-aggregation on
 *     either side. Both read the same `events` table.
 *   - No query is included unless both engines return the same result set
 *     (verified by the runner before any timing is recorded).
 *   - Ordering is fully deterministic (ties broken explicitly) so result
 *     comparison is not sensitive to non-deterministic sort order.
 *   - Queries deliberately span cheap point-ish reads and genuinely expensive
 *     wide aggregations, so the workload is not stacked toward either engine.
 *
 * QUERY-FORM NOTE (Q05, Q06, Q07, Q10): these avoid `COUNT(DISTINCT ...)` inside a
 * GROUP BY, expressing the same result as a pre-distinct subquery or a pair of
 * aggregates joined together. EXPLAIN showed the original form forced PostgreSQL
 * into a serial `GroupAggregate` that sorted all 1M rows; the rewrite lets it use
 * a hash aggregate instead (Q05 283ms -> 142ms at 1M).
 *
 * Q10 uses a CTE plus per-column DISTINCT subqueries instead of three
 * COUNT(DISTINCT) in one pass (213ms -> 103ms on PostgreSQL at 1M). Q07 groups
 * by (source, session_id) once and rolls up, avoiding the double table scan an
 * earlier CTE-join form caused (Buffers 30041 -> 15083).
 *
 * Measured on DuckDB these rewrites are NEUTRAL to slightly WORSE
 * (Q06 16.2ms -> 19.1ms; Q10 6.3ms -> 9.2ms). They are applied to BOTH engines anyway: a fair benchmark
 * runs the same logical SQL on both sides, and giving each engine its own
 * preferred phrasing would measure the tuner rather than the engines. The cost is
 * borne by DuckDB, not PostgreSQL.
 *
 * DIALECT NOTE: the PostgreSQL column is TIMESTAMPTZ while the DuckDB column is
 * TIMESTAMP (no zone), mirroring the production schemas. Date-bucketing queries
 * therefore pin PostgreSQL to UTC with `AT TIME ZONE 'UTC'` so both engines cut
 * days at the same boundary. This is a correctness adjustment to make the two
 * queries semantically identical, not a performance optimisation for either side.
 *
 * `params` are positional values; the runner adapts them to `$n` (PostgreSQL)
 * or `?` (DuckDB).
 */

/** The single-tenant filter used by selective queries (dominant site). */
export const BENCH_SITE = 'bench_site_a';

/** A 30-day window inside the generated range, as fixed ISO instants. */
export const WINDOW_START = '2025-12-02T00:00:00.000Z';
export const WINDOW_END = '2026-01-01T00:00:00.000Z';

export const QUERIES = [
    {
        id: 'Q01_total_events',
        title: 'Total events',
        description: 'Full-table COUNT(*). Cheapest possible scan; a sanity floor.',
        params: [],
        pg: 'SELECT COUNT(*) AS total FROM events',
        duck: 'SELECT COUNT(*) AS total FROM events',
    },
    {
        id: 'Q02_unique_visitors',
        title: 'Unique visitors',
        description: 'COUNT(DISTINCT user_id) across the whole table - high-cardinality distinct.',
        params: [],
        pg: 'SELECT COUNT(DISTINCT user_id) AS visitors FROM events',
        duck: 'SELECT COUNT(DISTINCT user_id) AS visitors FROM events',
    },
    {
        id: 'Q03_sessions',
        title: 'Total sessions',
        description: 'COUNT(DISTINCT session_id) - second high-cardinality distinct.',
        params: [],
        pg: 'SELECT COUNT(DISTINCT session_id) AS sessions FROM events',
        duck: 'SELECT COUNT(DISTINCT session_id) AS sessions FROM events',
    },
    {
        id: 'Q04_daily_events',
        title: 'Daily event aggregation',
        description: 'GROUP BY day over the full table - classic time-series rollup.',
        params: [],
        pg: `SELECT CAST((timestamp AT TIME ZONE 'UTC') AS DATE) AS day, COUNT(*) AS events
             FROM events
             GROUP BY 1
             ORDER BY 1`,
        duck: `SELECT CAST(timestamp AS DATE) AS day, COUNT(*) AS events
               FROM events
               GROUP BY 1
               ORDER BY 1`,
    },
    {
        id: 'Q05_daily_unique_visitors',
        title: 'Daily unique visitors',
        description: 'GROUP BY day with a DISTINCT aggregate - substantially harder than Q04.',
        params: [],
        pg: `SELECT day, COUNT(*) AS visitors
             FROM (SELECT DISTINCT CAST((timestamp AT TIME ZONE 'UTC') AS DATE) AS day, user_id FROM events) t
             GROUP BY day
             ORDER BY day`,
        duck: `SELECT day, COUNT(*) AS visitors
               FROM (SELECT DISTINCT CAST(timestamp AS DATE) AS day, user_id FROM events) t
               GROUP BY day
               ORDER BY day`,
    },
    {
        id: 'Q06_top_pages',
        title: 'Page aggregation (top 20)',
        description: 'GROUP BY path with two aggregates, ordered and limited.',
        params: [],
        pg: `WITH v AS (SELECT path, COUNT(*) AS views FROM events WHERE type = 'pageview' GROUP BY path),
                  u AS (SELECT path, COUNT(*) AS visitors
                        FROM (SELECT DISTINCT path, user_id FROM events WHERE type = 'pageview') d
                        GROUP BY path)
             SELECT v.path, v.views, u.visitors
             FROM v JOIN u ON v.path = u.path
             ORDER BY v.views DESC, v.path ASC
             LIMIT 20`,
        duck: `WITH v AS (SELECT path, COUNT(*) AS views FROM events WHERE type = 'pageview' GROUP BY path),
                    u AS (SELECT path, COUNT(*) AS visitors
                          FROM (SELECT DISTINCT path, user_id FROM events WHERE type = 'pageview') d
                          GROUP BY path)
               SELECT v.path, v.views, u.visitors
               FROM v JOIN u ON v.path = u.path
               ORDER BY v.views DESC, v.path ASC
               LIMIT 20`,
    },
    {
        id: 'Q07_referrer_sources',
        title: 'Referrer / source aggregation',
        description: 'GROUP BY over a normalised expression - forces per-row work before grouping.',
        params: [],
        pg: `SELECT source, SUM(cnt) AS hits, COUNT(*) AS sessions
             FROM (SELECT CASE WHEN referrer = '' OR referrer IS NULL THEN 'direct' ELSE referrer END AS source, session_id, COUNT(*) AS cnt
                   FROM events GROUP BY 1, 2) t
             GROUP BY source
             ORDER BY hits DESC, source ASC`,
        duck: `SELECT source, SUM(cnt) AS hits, COUNT(*) AS sessions
               FROM (SELECT CASE WHEN referrer = '' OR referrer IS NULL THEN 'direct' ELSE referrer END AS source, session_id, COUNT(*) AS cnt
                     FROM events GROUP BY 1, 2) t
               GROUP BY source
               ORDER BY hits DESC, source ASC`,
    },
    {
        id: 'Q08_date_range_filter',
        title: 'Date-range filter (30 days, single site)',
        description: 'Selective filter on (site_id, timestamp) - the pattern both schemas index.',
        params: [BENCH_SITE, WINDOW_START, WINDOW_END],
        pg: `SELECT COUNT(*) AS events, COUNT(DISTINCT user_id) AS visitors
             FROM events
             WHERE site_id = $1 AND timestamp >= $2 AND timestamp < $3`,
        duck: `SELECT COUNT(*) AS events, COUNT(DISTINCT user_id) AS visitors
               FROM events
               WHERE site_id = ? AND timestamp >= ? AND timestamp < ?`,
    },
    {
        id: 'Q09_multi_dim_groupby',
        title: 'Multi-dimensional GROUP BY',
        description: 'Four grouping columns at once - wide aggregation across many columns.',
        params: [],
        pg: `SELECT country, device, browser, os, COUNT(*) AS events
             FROM events
             GROUP BY country, device, browser, os
             ORDER BY events DESC, country ASC, device ASC, browser ASC, os ASC
             LIMIT 50`,
        duck: `SELECT country, device, browser, os, COUNT(*) AS events
               FROM events
               GROUP BY country, device, browser, os
               ORDER BY events DESC, country ASC, device ASC, browser ASC, os ASC
               LIMIT 50`,
    },
    {
        id: 'Q10_dashboard_kpi',
        title: 'Dashboard-style KPI (single site, 30 days)',
        description: 'Composite KPI in one pass - mirrors what the KPI card actually needs.',
        params: [BENCH_SITE, WINDOW_START, WINDOW_END],
        pg: `WITH f AS (SELECT user_id, session_id, path, type FROM events
                        WHERE site_id = $1 AND timestamp >= $2 AND timestamp < $3)
             SELECT (SELECT COUNT(*) FROM f)                                        AS total_events,
                    (SELECT COUNT(*) FROM (SELECT DISTINCT user_id FROM f) a)       AS visitors,
                    (SELECT COUNT(*) FROM (SELECT DISTINCT session_id FROM f) b)    AS sessions,
                    (SELECT COUNT(*) FROM f WHERE type = 'pageview')                AS pageviews,
                    (SELECT COUNT(*) FROM (SELECT DISTINCT path FROM f) d)          AS distinct_paths`,
        duck: `WITH f AS (SELECT user_id, session_id, path, type FROM events
                          WHERE site_id = ? AND timestamp >= ? AND timestamp < ?)
               SELECT (SELECT COUNT(*) FROM f)                                      AS total_events,
                      (SELECT COUNT(*) FROM (SELECT DISTINCT user_id FROM f) a)     AS visitors,
                      (SELECT COUNT(*) FROM (SELECT DISTINCT session_id FROM f) b)  AS sessions,
                      (SELECT COUNT(*) FROM f WHERE type = 'pageview')              AS pageviews,
                      (SELECT COUNT(*) FROM (SELECT DISTINCT path FROM f) d)        AS distinct_paths`,
    },
    {
        id: 'Q11_utm_campaign_breakdown',
        title: 'UTM campaign breakdown (30 days)',
        description: 'Filtered multi-column GROUP BY - acquisition-report shape.',
        params: [WINDOW_START, WINDOW_END],
        pg: `SELECT utm_source, utm_medium, utm_campaign,
                    COUNT(*) AS events, COUNT(DISTINCT user_id) AS visitors
             FROM events
             WHERE timestamp >= $1 AND timestamp < $2 AND utm_source <> ''
             GROUP BY utm_source, utm_medium, utm_campaign
             ORDER BY events DESC, utm_source ASC, utm_medium ASC, utm_campaign ASC`,
        duck: `SELECT utm_source, utm_medium, utm_campaign,
                      COUNT(*) AS events, COUNT(DISTINCT user_id) AS visitors
               FROM events
               WHERE timestamp >= ? AND timestamp < ? AND utm_source <> ''
               GROUP BY utm_source, utm_medium, utm_campaign
               ORDER BY events DESC, utm_source ASC, utm_medium ASC, utm_campaign ASC`,
    },
    {
        id: 'Q12_hourly_pattern',
        title: 'Hourly traffic pattern',
        description: 'EXTRACT + GROUP BY - per-row function application before grouping.',
        params: [],
        pg: `SELECT EXTRACT(HOUR FROM (timestamp AT TIME ZONE 'UTC'))::INT AS hour, COUNT(*) AS events
             FROM events
             GROUP BY 1
             ORDER BY 1`,
        duck: `SELECT CAST(EXTRACT(HOUR FROM timestamp) AS INTEGER) AS hour, COUNT(*) AS events
               FROM events
               GROUP BY 1
               ORDER BY 1`,
    },
];

/** Convert a positional param list into the dialect's placeholder syntax. */
export function sqlFor(query, engine) {
    return engine === 'postgres' ? query.pg : query.duck;
}
