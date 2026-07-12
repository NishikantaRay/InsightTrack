/**
 * Test helper for apps/analytics-api tests.
 *
 * Uses the SAME PostgreSQL database (analytics_db on port 5432)
 * but cleans up test data before/after each suite.
 */
import pg from 'pg';
import { createPool, getPool, initializeDatabase, closeConnection } from '../src/db/postgres.js';

const TEST_SITE_ID = 'site_test1';
let initialized = false;

export { TEST_SITE_ID };

export async function setupTestDB() {
    if (!initialized) {
        createPool();
        await initializeDatabase();
        initialized = true;
    }
}

export async function cleanTestDB() {
    const pool = getPool();
    await pool.query('DELETE FROM events WHERE site_id LIKE $1', ['site_test%']);
    await pool.query('DELETE FROM sessions WHERE site_id LIKE $1', ['site_test%']);
    await pool.query('DELETE FROM funnels WHERE site_id LIKE $1', ['site_test%']);
    await pool.query('DELETE FROM daily_stats WHERE site_id LIKE $1', ['site_test%']);
    await pool.query('DELETE FROM sites WHERE id LIKE $1', ['site_test%']);
    // Sites created THROUGH the API in tests get random ids — catch them by
    // their test-scoped domain so runs never leak rows into the shared dev DB.
    await pool.query('DELETE FROM sites WHERE domain LIKE $1', ['%.test.example.com']);
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['%@test.example.com']);
}

export async function closeTestDB() {
    await closeConnection();
    initialized = false;
}

export async function insertTestSite(id = TEST_SITE_ID, name = 'Test Site', domain = 'test.example.com', userId = null) {
    const pool = getPool();
    await pool.query(
        `INSERT INTO sites (id, name, domain, user_id, created_at) VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [id, name, domain, userId]
    );
}

export async function insertTestEvents(siteId = TEST_SITE_ID) {
    const pool = getPool();
    const now = new Date();
    let count = 0;

    for (let d = 0; d < 7; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() - d);

        for (let u = 0; u < 3; u++) {
            const userId = `u_test_${d}_${u}`;
            const sessionId = `s_test_${d}_${u}`;
            const eventTime = new Date(date);
            eventTime.setHours(10 + u, 0, 0, 0);

            const referrers = [null, 'https://google.com/search', 'https://facebook.com/post'];
            const devices = ['Desktop', 'Mobile', 'Tablet'];
            const countries = ['United States', 'India', 'Germany'];
            const utmSources = ['', 'google', 'facebook'];
            const utmMediums = ['', 'cpc', 'social'];
            const utmCampaigns = ['', 'spring_sale', 'brand_awareness'];

            // Pageview on homepage
            await pool.query(
                `INSERT INTO events (site_id, user_id, session_id, type, url, path, referrer, device, country, timestamp, properties, utm_source, utm_medium, utm_campaign)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [siteId, userId, sessionId, 'pageview', 'https://test.example.com/', '/',
                    referrers[u % 3], devices[u % 3], countries[u % 3],
                    eventTime.toISOString(), '{}',
                    utmSources[u % 3], utmMediums[u % 3], utmCampaigns[u % 3]]
            );
            count++;

            // Pageview on /products
            await pool.query(
                `INSERT INTO events (site_id, user_id, session_id, type, url, path, referrer, device, country, timestamp, properties, utm_source, utm_medium, utm_campaign)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [siteId, userId, sessionId, 'pageview', 'https://test.example.com/products', '/products',
                    referrers[u % 3], devices[u % 3], countries[u % 3],
                    new Date(eventTime.getTime() + 30000).toISOString(), '{}',
                    utmSources[u % 3], utmMediums[u % 3], utmCampaigns[u % 3]]
            );
            count++;

            // Add to cart for user index 1
            if (u === 1) {
                await pool.query(
                    `INSERT INTO events (site_id, user_id, session_id, type, url, path, referrer, device, country, timestamp, properties, utm_source, utm_medium, utm_campaign)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                    [siteId, userId, sessionId, 'add_to_cart', 'https://test.example.com/products', '/products',
                        referrers[u % 3], devices[u % 3], countries[u % 3],
                        new Date(eventTime.getTime() + 60000).toISOString(), '{}',
                        utmSources[u % 3], utmMediums[u % 3], utmCampaigns[u % 3]]
                );
                count++;
            }
        }
    }

    return count;
}

export async function insertTestSessions(siteId = TEST_SITE_ID) {
    const pool = getPool();
    const now = new Date();
    let count = 0;

    for (let d = 0; d < 7; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() - d);

        for (let u = 0; u < 3; u++) {
            const sessionId = `s_test_${d}_${u}`;
            const userId = `u_test_${d}_${u}`;
            const startTime = new Date(date);
            startTime.setHours(10 + u, 0, 0, 0);
            const duration = u === 0 ? 5 : 120 + u * 30;
            const pageviews = u === 0 ? 1 : 2 + u;
            const isBounce = pageviews === 1;

            await pool.query(
                `INSERT INTO sessions (id, site_id, user_id, started_at, ended_at, duration, pageviews, entry_page, exit_page, referrer, device, country, is_bounce, utm_source, utm_medium, utm_campaign)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                 ON CONFLICT (id) DO NOTHING`,
                [sessionId, siteId, userId,
                    startTime.toISOString(),
                    new Date(startTime.getTime() + duration * 1000).toISOString(),
                    duration, pageviews, '/', '/products',
                    u === 1 ? 'https://google.com/search' : null,
                    ['Desktop', 'Mobile', 'Tablet'][u % 3],
                    ['United States', 'India', 'Germany'][u % 3],
                    isBounce, '', '', '']
            );
            count++;
        }
    }

    return count;
}
