// Test helper: connect to test DB and provide setup/teardown
import pg from 'pg';
import { initializeDatabase, closeConnection } from '../src/db/database.js';

const { Pool } = pg;

let testPool = null;

export function getTestPool() {
    if (!testPool) {
        testPool = new Pool({
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5432'),
            user: process.env.PG_USER || 'analytics',
            password: process.env.PG_PASSWORD || 'analytics123',
            database: process.env.PG_TEST_DATABASE || 'analytics_test',
            max: 5,
        });
    }
    return testPool;
}

// Override the pool used by database.js so all queries go to test DB
export async function setupTestDB() {
    // Set env vars so that database.js createPool() picks them up
    process.env.PG_HOST = process.env.PG_HOST || 'localhost';
    process.env.PG_PORT = process.env.PG_PORT || '5432';
    process.env.PG_USER = process.env.PG_USER || 'analytics';
    process.env.PG_PASSWORD = process.env.PG_PASSWORD || 'analytics123';
    process.env.PG_DATABASE = process.env.PG_TEST_DATABASE || 'analytics_test';

    // Close any existing pool so a fresh one is created with test env vars
    await closeConnection();

    await initializeDatabase();
}

export async function cleanTestDB() {
    const pool = getTestPool();
    await pool.query('DELETE FROM events');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM funnels');
    await pool.query('DELETE FROM sites');
}

export async function closeTestDB() {
    await closeConnection();
    if (testPool) {
        await testPool.end();
        testPool = null;
    }
}

// Insert a test site
export async function insertTestSite(pool, id = 'site_test1', name = 'Test Site', domain = 'test.example.com') {
    await pool.query(
        `INSERT INTO sites (id, name, domain, created_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id) DO NOTHING`,
        [id, name, domain]
    );
}

// Insert test events for analytics
export async function insertTestEvents(pool, siteId = 'site_test1') {
    const now = new Date();
    const events = [];

    // Generate events over 7 days
    for (let d = 0; d < 7; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() - d);

        // 3 users per day
        for (let u = 0; u < 3; u++) {
            const userId = `u_test_${d}_${u}`;
            const sessionId = `s_test_${d}_${u}`;
            const eventTime = new Date(date);
            eventTime.setHours(10 + u, 0, 0, 0);

            const referrers = [null, 'https://google.com/search', 'https://facebook.com/post', 'https://mail.google.com'];
            const devices = ['Desktop', 'Mobile', 'Tablet'];
            const countries = ['United States', 'India', 'Germany'];
            const utmSources = ['', 'google', 'facebook'];
            const utmMediums = ['', 'cpc', 'social'];
            const utmCampaigns = ['', 'spring_sale', 'brand_awareness'];

            // Pageview event
            events.push([
                siteId, userId, sessionId, 'pageview',
                'https://test.example.com/', '/',
                referrers[u % referrers.length],
                devices[u % devices.length],
                countries[u % countries.length],
                eventTime.toISOString(), '{}',
                utmSources[u % utmSources.length],
                utmMediums[u % utmMediums.length],
                utmCampaigns[u % utmCampaigns.length]
            ]);

            // Another pageview on /products
            events.push([
                siteId, userId, sessionId, 'pageview',
                'https://test.example.com/products', '/products',
                referrers[u % referrers.length],
                devices[u % devices.length],
                countries[u % countries.length],
                new Date(eventTime.getTime() + 30000).toISOString(), '{}',
                utmSources[u % utmSources.length],
                utmMediums[u % utmMediums.length],
                utmCampaigns[u % utmCampaigns.length]
            ]);

            // Add to cart event for some users
            if (u === 1) {
                events.push([
                    siteId, userId, sessionId, 'add_to_cart',
                    'https://test.example.com/products', '/products',
                    referrers[u % referrers.length],
                    devices[u % devices.length],
                    countries[u % countries.length],
                    new Date(eventTime.getTime() + 60000).toISOString(), '{}',
                    utmSources[u % utmSources.length],
                    utmMediums[u % utmMediums.length],
                    utmCampaigns[u % utmCampaigns.length]
                ]);
            }
        }
    }

    const insertSQL = `
    INSERT INTO events (site_id, user_id, session_id, type, url, path, referrer, device, country, timestamp, properties, utm_source, utm_medium, utm_campaign)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
  `;
    for (const ev of events) {
        await pool.query(insertSQL, ev);
    }

    return events.length;
}

// Insert test sessions
export async function insertTestSessions(pool, siteId = 'site_test1') {
    const now = new Date();
    const sessions = [];

    for (let d = 0; d < 7; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() - d);

        for (let u = 0; u < 3; u++) {
            const sessionId = `s_test_${d}_${u}`;
            const userId = `u_test_${d}_${u}`;
            const startTime = new Date(date);
            startTime.setHours(10 + u, 0, 0, 0);
            const duration = u === 0 ? 5 : 120 + u * 30; // First user bounces
            const pageviews = u === 0 ? 1 : 2 + u;
            const isBounce = pageviews === 1;
            const utmSources = ['', 'google', 'facebook'];
            const utmMediums = ['', 'cpc', 'social'];
            const utmCampaigns = ['', 'spring_sale', 'brand_awareness'];

            sessions.push([
                sessionId, siteId, userId,
                startTime.toISOString(),
                new Date(startTime.getTime() + duration * 1000).toISOString(),
                duration, pageviews, '/', '/products',
                u === 1 ? 'https://google.com/search' : null,
                ['Desktop', 'Mobile', 'Tablet'][u % 3],
                ['United States', 'India', 'Germany'][u % 3],
                isBounce,
                utmSources[u % utmSources.length],
                utmMediums[u % utmMediums.length],
                utmCampaigns[u % utmCampaigns.length]
            ]);
        }
    }

    const insertSQL = `
    INSERT INTO sessions (id, site_id, user_id, started_at, ended_at, duration, pageviews, entry_page, exit_page, referrer, device, country, is_bounce, utm_source, utm_medium, utm_campaign)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
  `;
    for (const sess of sessions) {
        await pool.query(insertSQL, sess);
    }

    return sessions.length;
}
