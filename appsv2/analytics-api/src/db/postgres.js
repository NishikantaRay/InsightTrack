import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Only load .env for local development — never load .env.example in code
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

let pool = null;

export function createPool() {
    if (!pool) {
        const poolConfig = process.env.DATABASE_URL
            ? {
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            }
            : {
                host: process.env.PG_HOST || 'localhost',
                port: Number(process.env.PG_PORT) || 5432,
                user: process.env.PG_USER || 'analytics',
                password: process.env.PG_PASSWORD || 'analytics123',
                database: process.env.PG_DATABASE || 'analytics_db',
            };

        console.log(`[postgres] connecting via ${process.env.DATABASE_URL ? 'DATABASE_URL' : 'PG_HOST=' + (process.env.PG_HOST || 'localhost')}`);
        pool = new pg.Pool({
            ...poolConfig,
            max: parseInt(process.env.PG_POOL_MAX) || 10,
            idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT_MS) || 30_000,
            connectionTimeoutMillis: parseInt(process.env.PG_CONNECT_TIMEOUT_MS) || 5_000,
        });
    }
    return pool;
}

export function getPool() {
    if (!pool) createPool();
    return pool;
}

// Alias for sync.js compatibility
export const getPgPool = getPool;

export async function query(text, params) {
    return getPool().query(text, params);
}

export async function initializeDatabase() {
    console.log('🔧 Initializing PostgreSQL database tables...');

    await query(`
    CREATE TABLE IF NOT EXISTS sites (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      name VARCHAR(255) NOT NULL,
      domain VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    // Migration: add user_id to existing sites table if missing
    await query(`
      DO $$ BEGIN
        ALTER TABLE sites ADD COLUMN user_id VARCHAR(64);
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id)`);
    console.log('  ✓ sites');

    await query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      session_id VARCHAR(64) NOT NULL,
      type VARCHAR(50) DEFAULT 'pageview',
      url TEXT,
      path VARCHAR(512),
      referrer TEXT,
      device VARCHAR(50),
      browser VARCHAR(255) DEFAULT '',
      os VARCHAR(100) DEFAULT '',
      country VARCHAR(100),
      city VARCHAR(255) DEFAULT '',
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      properties JSONB DEFAULT '{}',
      utm_source VARCHAR(255) DEFAULT '',
      utm_medium VARCHAR(255) DEFAULT '',
      utm_campaign VARCHAR(255) DEFAULT '',
      utm_term VARCHAR(255) DEFAULT '',
      utm_content VARCHAR(255) DEFAULT ''
    )
  `);

    await query(`CREATE INDEX IF NOT EXISTS idx_events_site_id ON events(site_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_events_path ON events(path)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_events_site_ts ON events(site_id, timestamp)`);
    console.log('  ✓ events (7 indexes)');

    await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(64) PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at TIMESTAMPTZ DEFAULT NOW(),
      duration INTEGER DEFAULT 0,
      pageviews SMALLINT DEFAULT 1,
      entry_page VARCHAR(512),
      exit_page VARCHAR(512),
      referrer TEXT,
      device VARCHAR(50),
      browser VARCHAR(255) DEFAULT '',
      os VARCHAR(100) DEFAULT '',
      country VARCHAR(100),
      is_bounce BOOLEAN DEFAULT FALSE,
      utm_source VARCHAR(255) DEFAULT '',
      utm_medium VARCHAR(255) DEFAULT '',
      utm_campaign VARCHAR(255) DEFAULT ''
    )
  `);

    await query(`CREATE INDEX IF NOT EXISTS idx_sessions_site_id ON sessions(site_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_sessions_site_started ON sessions(site_id, started_at)`);
    console.log('  ✓ sessions (3 indexes)');

    await query(`
    CREATE TABLE IF NOT EXISTS funnels (
      id VARCHAR(64) PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      steps JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    console.log('  ✓ funnels');

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
    console.log('  ✓ daily_stats');

    await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'viewer',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    console.log('  ✓ users');

    // Goals table
    await query(`
    CREATE TABLE IF NOT EXISTS goals (
      id VARCHAR(64) PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      config JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_goals_site_id ON goals(site_id)`);
    console.log('  ✓ goals');

    // A/B tests table
    await query(`
    CREATE TABLE IF NOT EXISTS ab_tests (
      id VARCHAR(64) PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      variants JSONB DEFAULT '[]',
      goal_id VARCHAR(64),
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_ab_tests_site_id ON ab_tests(site_id)`);
    console.log('  ✓ ab_tests');

    // Add is_returning column to sessions
    await query(`
    DO $$ BEGIN
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_returning BOOLEAN DEFAULT FALSE;
    END $$
  `);

    // Annotations table
    await query(`
    CREATE TABLE IF NOT EXISTS annotations (
      id VARCHAR(64) PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL,
      date DATE NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT DEFAULT '',
      category VARCHAR(50) DEFAULT 'general',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_annotations_site_date ON annotations(site_id, date)`);
    console.log('  ✓ annotations');

    // Report schedules table
    await query(`
    CREATE TABLE IF NOT EXISTS report_schedules (
      id VARCHAR(64) PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      frequency VARCHAR(20) NOT NULL,
      email VARCHAR(255) NOT NULL,
      metrics JSONB DEFAULT '[]',
      last_sent_at TIMESTAMPTZ,
      next_send_at TIMESTAMPTZ,
      enabled BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_report_schedules_site ON report_schedules(site_id)`);
    console.log('  ✓ report_schedules');

    // Custom dashboards table
    await query(`
    CREATE TABLE IF NOT EXISTS custom_dashboards (
      id VARCHAR(64) PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      widgets JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_custom_dashboards_user ON custom_dashboards(user_id, site_id)`);
    console.log('  ✓ custom_dashboards');

    // Data retention policies table
    await query(`
    CREATE TABLE IF NOT EXISTS data_retention_policies (
      id VARCHAR(64) PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL UNIQUE,
      retention_days INTEGER DEFAULT 365,
      enabled BOOLEAN DEFAULT FALSE,
      last_cleanup_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    console.log('  ✓ data_retention_policies');

    // Saved UTM links table
    await query(`
    CREATE TABLE IF NOT EXISTS utm_links (
      id VARCHAR(64) PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL,
      label VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      utm_source VARCHAR(255) DEFAULT '',
      utm_medium VARCHAR(255) DEFAULT '',
      utm_campaign VARCHAR(255) DEFAULT '',
      utm_term VARCHAR(255) DEFAULT '',
      utm_content VARCHAR(255) DEFAULT '',
      built_url TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_utm_links_site ON utm_links(site_id)`);
    console.log('  ✓ utm_links');

    // SQL editor saved queries table
    await query(`
    CREATE TABLE IF NOT EXISTS sql_saved_queries (
      id UUID PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      name VARCHAR(120) NOT NULL,
      query TEXT NOT NULL,
      tags TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_sql_saved_queries_user_site ON sql_saved_queries(user_id, site_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_sql_saved_queries_updated_at ON sql_saved_queries(updated_at DESC)`);
    console.log('  ✓ sql_saved_queries');

    // SQL editor query audit table
    await query(`
    CREATE TABLE IF NOT EXISTS sql_query_audits (
      id UUID PRIMARY KEY,
      request_id UUID NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      site_id VARCHAR(64) NOT NULL,
      query_text TEXT NOT NULL,
      duration_ms INTEGER,
      row_count INTEGER,
      status VARCHAR(20) NOT NULL,
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_sql_query_audits_site_created ON sql_query_audits(site_id, created_at DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_sql_query_audits_user_created ON sql_query_audits(user_id, created_at DESC)`);
    console.log('  ✓ sql_query_audits');

    console.log('✅ All PostgreSQL tables initialized');
}

function weightedRandom(items, weights) {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
    }
    return items[items.length - 1];
}

export async function hasSampleData() {
    const demoResult = await query(`SELECT COUNT(*) AS cnt FROM events WHERE site_id = 'site_demo'`);
    const blogResult = await query(`SELECT COUNT(*) AS cnt FROM events WHERE site_id = 'site_blog'`);
    return {
        demo: Number(demoResult.rows[0].cnt) > 0,
        blog: Number(blogResult.rows[0].cnt) > 0,
    };
}

export async function generateSampleData() {
    const { demo: demoHasData, blog: blogHasData } = await hasSampleData();

    const devices = ['Desktop', 'Mobile', 'Tablet'];
    const deviceWeights = [55, 35, 10];
    const countries = ['United States', 'United Kingdom', 'Germany', 'France', 'Canada', 'India', 'Australia', 'Japan', 'Brazil', 'Spain'];
    const countryWeights = [30, 12, 10, 8, 8, 7, 6, 5, 4, 3];

    const now = new Date();
    let totalEvents = 0;
    let totalSessions = 0;
    let blogEvents = 0;
    let blogSessions = 0;

    const p = getPool();

    if (!demoHasData) {
        console.log('\n🌱 Generating sample data for Demo Website...');

        // Ensure demo site exists
        await query(
            `INSERT INTO sites (id, name, domain, created_at)
       VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
            ['site_demo', 'Demo Website', 'demo.example.com', new Date().toISOString()]
        );

        const siteId = 'site_demo';
        const pages = [
            { path: '/', title: 'Home' }, { path: '/products', title: 'Products' },
            { path: '/about', title: 'About' }, { path: '/contact', title: 'Contact' },
            { path: '/pricing', title: 'Pricing' }, { path: '/blog', title: 'Blog' },
            { path: '/docs', title: 'Documentation' }, { path: '/signup', title: 'Sign Up' },
        ];
        const pageWeights = [25, 20, 10, 8, 15, 10, 7, 5];

        const referrers = [
            null, 'https://google.com', 'https://facebook.com',
            'https://twitter.com', 'https://linkedin.com', 'https://github.com',
            'https://reddit.com', 'https://youtube.com',
        ];
        const referrerWeights = [30, 25, 10, 8, 7, 8, 7, 5];

        const utmSources = [null, 'google', 'facebook', 'twitter', 'newsletter', 'linkedin'];
        const utmSourceWeights = [50, 15, 10, 8, 10, 7];
        const utmMediums = [null, 'cpc', 'social', 'email', 'organic', 'referral'];
        const utmMediumWeights = [50, 15, 12, 10, 8, 5];
        const utmCampaigns = [null, 'summer_sale', 'product_launch', 'brand_awareness', 'retargeting', 'newsletter_weekly'];
        const utmCampaignWeights = [50, 12, 10, 10, 10, 8];

        const userPool = Array.from({ length: 3000 }, () => `u_${uuidv4().slice(0, 8)}`);

        for (let daysAgo = 90; daysAgo >= 0; daysAgo--) {
            const date = new Date(now);
            date.setDate(date.getDate() - daysAgo);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const baseVisitors = isWeekend ? 120 : 250;
            const dailyVisitors = baseVisitors + Math.floor(Math.random() * 150);

            const dayEvents = [];
            const daySessions = [];

            for (let v = 0; v < dailyVisitors; v++) {
                const userId = userPool[Math.floor(Math.random() * userPool.length)];
                const sessionId = `s_${uuidv4().slice(0, 8)}`;
                const device = weightedRandom(devices, deviceWeights);
                const country = weightedRandom(countries, countryWeights);
                const referrer = weightedRandom(referrers, referrerWeights);
                const utmSource = weightedRandom(utmSources, utmSourceWeights);
                const utmMedium = weightedRandom(utmMediums, utmMediumWeights);
                const utmCampaign = weightedRandom(utmCampaigns, utmCampaignWeights);

                const sessionStart = new Date(date);
                sessionStart.setHours(Math.floor(Math.random() * 24));
                sessionStart.setMinutes(Math.floor(Math.random() * 60));

                const pageviewCount = Math.floor(Math.random() * Math.random() * 8) + 1;
                const duration = pageviewCount === 1
                    ? Math.floor(Math.random() * 15)
                    : Math.floor(Math.random() * 600) + 30;

                let entryPage = null;
                let exitPage = null;

                for (let pp = 0; pp < pageviewCount; pp++) {
                    const page = weightedRandom(pages, pageWeights);
                    const eventTime = new Date(sessionStart.getTime() + (pp * (duration / pageviewCount) * 1000));
                    if (pp === 0) entryPage = page.path;
                    if (pp === pageviewCount - 1) exitPage = page.path;

                    dayEvents.push([
                        siteId, userId, sessionId, 'pageview',
                        `https://demo.example.com${page.path}`, page.path,
                        referrer, device, country, eventTime.toISOString(), '{}',
                        utmSource || '', utmMedium || '', utmCampaign || '',
                    ]);
                }

                // Funnel events
                if (Math.random() < 0.15) {
                    const cartTime = new Date(sessionStart.getTime() + duration * 500);
                    dayEvents.push([siteId, userId, sessionId, 'add_to_cart', `https://demo.example.com/products`, '/products', referrer, device, country, cartTime.toISOString(), '{}', '', '', '']);
                    if (Math.random() < 0.6) {
                        const checkoutTime = new Date(cartTime.getTime() + 30000);
                        dayEvents.push([siteId, userId, sessionId, 'checkout', `https://demo.example.com/checkout`, '/checkout', referrer, device, country, checkoutTime.toISOString(), '{}', '', '', '']);
                        if (Math.random() < 0.5) {
                            const purchaseTime = new Date(checkoutTime.getTime() + 60000);
                            dayEvents.push([siteId, userId, sessionId, 'purchase', `https://demo.example.com/thank-you`, '/thank-you', referrer, device, country, purchaseTime.toISOString(), '{}', '', '', '']);
                        }
                    }
                }

                daySessions.push([
                    sessionId, siteId, userId,
                    sessionStart.toISOString(),
                    new Date(sessionStart.getTime() + duration * 1000).toISOString(),
                    duration, pageviewCount, entryPage, exitPage,
                    referrer, device, country, pageviewCount === 1,
                    utmSource || '', utmMedium || '', utmCampaign || '',
                ]);
            }

            if (dayEvents.length > 0) {
                const client = await p.connect();
                try {
                    await client.query('BEGIN');
                    const eq = `INSERT INTO events (site_id, user_id, session_id, type, url, path, referrer, device, country, timestamp, properties, utm_source, utm_medium, utm_campaign) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`;
                    for (const ev of dayEvents) await client.query(eq, ev);
                    await client.query('COMMIT');
                } catch (err) { await client.query('ROLLBACK'); throw err; }
                finally { client.release(); }
                totalEvents += dayEvents.length;
            }

            if (daySessions.length > 0) {
                const client = await p.connect();
                try {
                    await client.query('BEGIN');
                    const sq = `INSERT INTO sessions (id, site_id, user_id, started_at, ended_at, duration, pageviews, entry_page, exit_page, referrer, device, country, is_bounce, utm_source, utm_medium, utm_campaign) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`;
                    for (const sess of daySessions) await client.query(sq, sess);
                    await client.query('COMMIT');
                } catch (err) { await client.query('ROLLBACK'); throw err; }
                finally { client.release(); }
                totalSessions += daySessions.length;
            }

            if (daysAgo % 10 === 0) {
                process.stdout.write(`\r📊 Processing day ${90 - daysAgo + 1}/91...`);
            }
        }

        console.log(`\n✅ Generated ${totalEvents.toLocaleString()} events (Demo Website)`);
        console.log(`✅ Generated ${totalSessions.toLocaleString()} sessions (Demo Website)`);
    } else {
        console.log('ℹ️  Demo Website data already exists, skipping.');
    }

    if (!blogHasData) {
        console.log('\n🌱 Generating sample data for TechPulse Blog...');

        await query(
            `INSERT INTO sites (id, name, domain, created_at)
       VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
            ['site_blog', 'TechPulse Blog', 'blog.example.com', new Date().toISOString()]
        );

        const blogSiteId = 'site_blog';
        const blogPages = [
            { path: '/', title: 'Home' }, { path: '/tutorials', title: 'Tutorials' },
            { path: '/reviews', title: 'Reviews' }, { path: '/about', title: 'About' },
            { path: '/tutorials/react-hooks', title: 'React Hooks Guide' },
            { path: '/tutorials/nextjs-setup', title: 'Next.js Setup' },
            { path: '/reviews/macbook-pro', title: 'MacBook Pro Review' },
            { path: '/reviews/iphone-15', title: 'iPhone 15 Review' },
        ];
        const blogPageWeights = [25, 18, 15, 8, 10, 8, 8, 8];

        const blogReferrers = [null, 'https://google.com', 'https://reddit.com', 'https://twitter.com', 'https://dev.to', 'https://hackernews.com'];
        const blogReferrerWeights = [30, 30, 15, 10, 10, 5];

        const blogUserPool = Array.from({ length: 1500 }, () => `u_${uuidv4().slice(0, 8)}`);

        for (let daysAgo = 60; daysAgo >= 0; daysAgo--) {
            const date = new Date(now);
            date.setDate(date.getDate() - daysAgo);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const baseVisitors = isWeekend ? 80 : 160;
            const dailyVisitors = baseVisitors + Math.floor(Math.random() * 80);

            const blogDayEvents = [];
            const blogDaySessions = [];

            for (let v = 0; v < dailyVisitors; v++) {
                const userId = blogUserPool[Math.floor(Math.random() * blogUserPool.length)];
                const sessionId = `s_${uuidv4().slice(0, 8)}`;
                const device = weightedRandom(devices, deviceWeights);
                const country = weightedRandom(countries, countryWeights);
                const referrer = weightedRandom(blogReferrers, blogReferrerWeights);

                const sessionStart = new Date(date);
                sessionStart.setHours(Math.floor(Math.random() * 24));
                sessionStart.setMinutes(Math.floor(Math.random() * 60));

                const pageviewCount = Math.floor(Math.random() * Math.random() * 5) + 1;
                const duration = pageviewCount === 1
                    ? Math.floor(Math.random() * 20)
                    : Math.floor(Math.random() * 300) + 30;

                let entryPage = null;
                let exitPage = null;

                for (let pp = 0; pp < pageviewCount; pp++) {
                    const page = weightedRandom(blogPages, blogPageWeights);
                    const eventTime = new Date(sessionStart.getTime() + (pp * (duration / pageviewCount) * 1000));
                    if (pp === 0) entryPage = page.path;
                    if (pp === pageviewCount - 1) exitPage = page.path;

                    blogDayEvents.push([
                        blogSiteId, userId, sessionId, 'pageview',
                        `https://blog.example.com${page.path}`, page.path,
                        referrer, device, country, eventTime.toISOString(), '{}',
                        '', '', '',
                    ]);
                }

                blogDaySessions.push([
                    sessionId, blogSiteId, userId,
                    sessionStart.toISOString(),
                    new Date(sessionStart.getTime() + duration * 1000).toISOString(),
                    duration, pageviewCount, entryPage, exitPage,
                    referrer, device, country, pageviewCount === 1,
                    '', '', '',
                ]);
            }

            if (blogDayEvents.length > 0) {
                const client = await p.connect();
                try {
                    await client.query('BEGIN');
                    const eq = `INSERT INTO events (site_id, user_id, session_id, type, url, path, referrer, device, country, timestamp, properties, utm_source, utm_medium, utm_campaign) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`;
                    for (const ev of blogDayEvents) await client.query(eq, ev);
                    await client.query('COMMIT');
                } catch (err) { await client.query('ROLLBACK'); throw err; }
                finally { client.release(); }
                blogEvents += blogDayEvents.length;
            }

            if (blogDaySessions.length > 0) {
                const client = await p.connect();
                try {
                    await client.query('BEGIN');
                    const sq = `INSERT INTO sessions (id, site_id, user_id, started_at, ended_at, duration, pageviews, entry_page, exit_page, referrer, device, country, is_bounce, utm_source, utm_medium, utm_campaign) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`;
                    for (const sess of blogDaySessions) await client.query(sq, sess);
                    await client.query('COMMIT');
                } catch (err) { await client.query('ROLLBACK'); throw err; }
                finally { client.release(); }
                blogSessions += blogDaySessions.length;
            }

            if (daysAgo % 10 === 0) process.stdout.write(`\r📊 Blog: Processing day ${60 - daysAgo + 1}/61...`);
        }

        console.log(`\n✅ Generated ${blogEvents.toLocaleString()} events (TechPulse Blog)`);
        console.log(`✅ Generated ${blogSessions.toLocaleString()} sessions (TechPulse Blog)`);
    } else {
        console.log('ℹ️  TechPulse Blog data already exists, skipping.');
    }

    return { totalEvents: totalEvents + blogEvents, totalSessions: totalSessions + blogSessions };
}

export async function initializeData() {
    await initializeDatabase();
    return getPool();
}

export async function closeConnection() {
    if (pool) {
        await pool.end();
        pool = null;
        console.log('🔌 PostgreSQL connection closed');
    }
}

// Alias
export const closePg = closeConnection;

export default {
    getPool,
    getPgPool,
    createPool,
    query,
    initializeDatabase,
    initializeData,
    generateSampleData,
    hasSampleData,
    closeConnection,
    closePg,
};
