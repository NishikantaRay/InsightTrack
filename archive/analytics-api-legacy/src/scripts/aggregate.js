// Data Aggregation Script - Pre-compute daily rollups
// Run via: node src/scripts/aggregate.js
// Schedule via cron: 0 1 * * * (daily at 1 AM)

import { createPool, query, closeConnection } from '../db/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function ensureAggregationTable() {
    await query(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      id SERIAL PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL,
      date DATE NOT NULL,
      visitors INTEGER DEFAULT 0,
      sessions INTEGER DEFAULT 0,
      pageviews INTEGER DEFAULT 0,
      bounces INTEGER DEFAULT 0,
      avg_duration NUMERIC DEFAULT 0,
      top_pages JSONB DEFAULT '[]',
      sources JSONB DEFAULT '[]',
      devices JSONB DEFAULT '[]',
      countries JSONB DEFAULT '[]',
      computed_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(site_id, date)
    )
  `);

    await query(`CREATE INDEX IF NOT EXISTS idx_daily_stats_site_date ON daily_stats(site_id, date)`);
    console.log('  daily_stats table ready');
}

async function aggregateDay(siteId, date) {
    const dateStr = date.toISOString().split('T')[0];
    const dayStart = `${dateStr}T00:00:00.000Z`;
    const dayEnd = `${dateStr}T23:59:59.999Z`;

    // Fetch all metrics for this day in parallel
    const [eventsResult, sessionsResult, topPagesResult, sourcesResult, devicesResult, countriesResult] = await Promise.all([
        query(
            `SELECT 
        COUNT(DISTINCT user_id) as visitors,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(*) FILTER (WHERE type = 'pageview') as pageviews
      FROM events
      WHERE site_id = $1 AND timestamp >= $2 AND timestamp <= $3`,
            [siteId, dayStart, dayEnd]
        ),
        query(
            `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_bounce = TRUE) as bounces,
        AVG(duration) as avg_duration
      FROM sessions
      WHERE site_id = $1 AND started_at >= $2 AND started_at <= $3`,
            [siteId, dayStart, dayEnd]
        ),
        query(
            `SELECT path, COUNT(*) as views
      FROM events
      WHERE site_id = $1 AND type = 'pageview' AND timestamp >= $2 AND timestamp <= $3
      GROUP BY path ORDER BY views DESC LIMIT 10`,
            [siteId, dayStart, dayEnd]
        ),
        query(
            `SELECT 
        CASE
          WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
          WHEN referrer LIKE '%google.%' OR referrer LIKE '%bing.%' OR referrer LIKE '%yahoo.%' THEN 'Search'
          WHEN referrer LIKE '%facebook.%' OR referrer LIKE '%twitter.%' OR referrer LIKE '%linkedin.%' THEN 'Social'
          ELSE 'Referral'
        END as source,
        COUNT(DISTINCT user_id) as visitors
      FROM events
      WHERE site_id = $1 AND timestamp >= $2 AND timestamp <= $3
      GROUP BY source ORDER BY visitors DESC`,
            [siteId, dayStart, dayEnd]
        ),
        query(
            `SELECT 
        CASE WHEN device = '' OR device IS NULL THEN 'Desktop' ELSE device END as device,
        COUNT(DISTINCT user_id) as visitors
      FROM events
      WHERE site_id = $1 AND timestamp >= $2 AND timestamp <= $3
      GROUP BY device ORDER BY visitors DESC`,
            [siteId, dayStart, dayEnd]
        ),
        query(
            `SELECT 
        CASE WHEN country = '' OR country IS NULL THEN 'Unknown' ELSE country END as country,
        COUNT(DISTINCT user_id) as visitors
      FROM events
      WHERE site_id = $1 AND timestamp >= $2 AND timestamp <= $3
      GROUP BY country ORDER BY visitors DESC LIMIT 10`,
            [siteId, dayStart, dayEnd]
        )
    ]);

    const e = eventsResult.rows[0] || {};
    const s = sessionsResult.rows[0] || {};

    // Upsert daily stats
    await query(
        `INSERT INTO daily_stats (site_id, date, visitors, sessions, pageviews, bounces, avg_duration, top_pages, sources, devices, countries, computed_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    ON CONFLICT (site_id, date) DO UPDATE SET
      visitors = EXCLUDED.visitors,
      sessions = EXCLUDED.sessions,
      pageviews = EXCLUDED.pageviews,
      bounces = EXCLUDED.bounces,
      avg_duration = EXCLUDED.avg_duration,
      top_pages = EXCLUDED.top_pages,
      sources = EXCLUDED.sources,
      devices = EXCLUDED.devices,
      countries = EXCLUDED.countries,
      computed_at = NOW()`,
        [
            siteId,
            dateStr,
            Number(e.visitors || 0),
            Number(e.sessions || 0),
            Number(e.pageviews || 0),
            Number(s.bounces || 0),
            Number(s.avg_duration || 0),
            JSON.stringify(topPagesResult.rows.map(r => ({ path: r.path, views: Number(r.views) }))),
            JSON.stringify(sourcesResult.rows.map(r => ({ source: r.source, visitors: Number(r.visitors) }))),
            JSON.stringify(devicesResult.rows.map(r => ({ device: r.device, visitors: Number(r.visitors) }))),
            JSON.stringify(countriesResult.rows.map(r => ({ country: r.country, visitors: Number(r.visitors) })))
        ]
    );
}

async function aggregate() {
    console.log('📊 Starting daily data aggregation...\n');

    try {
        createPool();
        await ensureAggregationTable();

        // Get all sites
        const sitesResult = await query('SELECT id FROM sites');
        const sites = sitesResult.rows;

        if (sites.length === 0) {
            console.log('  No sites found, skipping.');
            return;
        }

        // Determine date range to aggregate (last 7 days by default, or specify via CLI args)
        const daysBack = parseInt(process.argv[2]) || 7;
        const today = new Date();

        for (const site of sites) {
            console.log(`\n  Site: ${site.id}`);

            for (let d = daysBack; d >= 1; d--) {
                const date = new Date(today);
                date.setDate(date.getDate() - d);

                const dateStr = date.toISOString().split('T')[0];
                process.stdout.write(`    ${dateStr}...`);

                try {
                    await aggregateDay(site.id, date);
                    process.stdout.write(' done\n');
                } catch (err) {
                    process.stdout.write(` error: ${err.message}\n`);
                }
            }
        }

        console.log('\n✅ Aggregation completed!');
    } catch (error) {
        console.error('❌ Aggregation failed:', error);
        process.exit(1);
    } finally {
        await closeConnection();
    }
}

aggregate();
