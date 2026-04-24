// PostgreSQL Database Connection and Setup
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';

const { Pool } = pg;

// PostgreSQL pool instance
let pool = null;

// Create PostgreSQL pool
export function createPool() {
  if (pool) return pool;

  pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    database: process.env.PG_DATABASE || 'analytics',
    max: parseInt(process.env.PG_POOL_MAX) || 20,
    idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT_MS) || 30000,
    connectionTimeoutMillis: parseInt(process.env.PG_CONNECT_TIMEOUT_MS) || 5000,
  });

  return pool;
}

// Get PostgreSQL pool
export function getPool() {
  if (!pool) {
    return createPool();
  }
  return pool;
}

// Helper: run a query
export async function query(text, params) {
  const p = getPool();
  return p.query(text, params);
}

// Create tables
export async function initializeDatabase() {
  const p = getPool();

  console.log('🔧 Initializing PostgreSQL database...');

  // Enable uuid-ossp extension
  await p.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  // Create sites table
  await p.query(`
    CREATE TABLE IF NOT EXISTS sites (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      name VARCHAR(255) NOT NULL,
      domain VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Migration: add user_id to existing sites table if missing
  await p.query(`
    DO $$ BEGIN
      ALTER TABLE sites ADD COLUMN user_id VARCHAR(64);
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id)`);

  // Create events table - optimized for analytics queries
  await p.query(`
    CREATE TABLE IF NOT EXISTS events (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      session_id VARCHAR(64) NOT NULL,
      type VARCHAR(50) NOT NULL,
      url TEXT,
      path VARCHAR(512),
      referrer TEXT,
      device VARCHAR(50),
      browser VARCHAR(255) DEFAULT '',
      os VARCHAR(100) DEFAULT '',
      country VARCHAR(100),
      city VARCHAR(255) DEFAULT '',
      timestamp TIMESTAMPTZ NOT NULL,
      properties JSONB DEFAULT '{}',
      utm_source VARCHAR(255) DEFAULT '',
      utm_medium VARCHAR(255) DEFAULT '',
      utm_campaign VARCHAR(255) DEFAULT '',
      utm_term VARCHAR(255) DEFAULT '',
      utm_content VARCHAR(255) DEFAULT ''
    )
  `);

  // Create indexes on events table
  await p.query(`CREATE INDEX IF NOT EXISTS idx_events_site_id ON events(site_id)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_events_site_ts ON events(site_id, timestamp)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_events_site_type_ts ON events(site_id, type, timestamp)`);

  // Create sessions table
  await p.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(64) PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      ended_at TIMESTAMPTZ NOT NULL,
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

  // Create indexes on sessions table
  await p.query(`CREATE INDEX IF NOT EXISTS idx_sessions_site_id ON sessions(site_id)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_sessions_site_started ON sessions(site_id, started_at)`);

  // Add UTM columns to existing tables (safe migration - IF NOT EXISTS via DO block)
  await p.query(`
    DO $$ BEGIN
      ALTER TABLE events ADD COLUMN IF NOT EXISTS utm_source VARCHAR(255) DEFAULT '';
      ALTER TABLE events ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(255) DEFAULT '';
      ALTER TABLE events ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(255) DEFAULT '';
      ALTER TABLE events ADD COLUMN IF NOT EXISTS utm_term VARCHAR(255) DEFAULT '';
      ALTER TABLE events ADD COLUMN IF NOT EXISTS utm_content VARCHAR(255) DEFAULT '';
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS utm_source VARCHAR(255) DEFAULT '';
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(255) DEFAULT '';
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(255) DEFAULT '';
    END $$
  `);

  // Create funnels table
  await p.query(`
    CREATE TABLE IF NOT EXISTS funnels (
      id VARCHAR(64) PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      steps TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Create goals table — conversion goal definitions
  await p.query(`
    CREATE TABLE IF NOT EXISTS goals (
      id VARCHAR(64) PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      config JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_goals_site_id ON goals(site_id)`);

  // Create ab_tests table — A/B test definitions
  await p.query(`
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
  await p.query(`CREATE INDEX IF NOT EXISTS idx_ab_tests_site_id ON ab_tests(site_id)`);

  // Add is_returning column to sessions (for new vs returning visitors)
  await p.query(`
    DO $$ BEGIN
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_returning BOOLEAN DEFAULT FALSE;
    END $$
  `);

  // Create annotations table — mark events on traffic charts
  await p.query(`
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
  await p.query(`CREATE INDEX IF NOT EXISTS idx_annotations_site_date ON annotations(site_id, date)`);

  // Create report_schedules table — scheduled email reports
  await p.query(`
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
  await p.query(`CREATE INDEX IF NOT EXISTS idx_report_schedules_site ON report_schedules(site_id)`);

  // Create custom_dashboards table — user-defined widget layouts
  await p.query(`
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
  await p.query(`CREATE INDEX IF NOT EXISTS idx_custom_dashboards_user ON custom_dashboards(user_id, site_id)`);

  // Create data_retention_policies table
  await p.query(`
    CREATE TABLE IF NOT EXISTS data_retention_policies (
      id VARCHAR(64) PRIMARY KEY,
      site_id VARCHAR(64) NOT NULL UNIQUE,
      retention_days INTEGER DEFAULT 365,
      enabled BOOLEAN DEFAULT FALSE,
      last_cleanup_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Create daily_stats aggregation table
  await p.query(`
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
  await p.query(`CREATE INDEX IF NOT EXISTS idx_daily_stats_site_date ON daily_stats(site_id, date)`);

  // Create users table for authentication
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'viewer',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await p.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

  console.log('✅ PostgreSQL tables created successfully');

  return p;
}

// Check if sample data exists
export async function hasSampleData() {
  try {
    const result = await query(
      `SELECT COUNT(*) as count FROM events WHERE site_id = $1`,
      ['site_123']
    );
    return parseInt(result.rows[0]?.count || '0') > 0;
  } catch (error) {
    return false;
  }
}

// Generate and insert sample data
export async function generateSampleData() {
  const p = getPool();

  const siteId = 'site_123';

  // Check if demo site exists
  const siteResult = await query(
    `SELECT COUNT(*) as count FROM sites WHERE id = $1`,
    [siteId]
  );

  if (parseInt(siteResult.rows[0]?.count || '0') === 0) {
    await query(
      `INSERT INTO sites (id, name, domain, created_at) VALUES ($1, $2, $3, $4)`,
      [siteId, 'Demo Website', 'demo.example.com', new Date().toISOString()]
    );
    console.log('✅ Demo site created');
  }

  // Ensure blog demo site exists
  const blogSiteResult = await query(
    `SELECT COUNT(*) as count FROM sites WHERE id = $1`,
    ['site_blog']
  );
  if (parseInt(blogSiteResult.rows[0]?.count || '0') === 0) {
    await query(
      `INSERT INTO sites (id, name, domain, created_at) VALUES ($1, $2, $3, $4)`,
      ['site_blog', 'TechPulse Blog', 'blog.example.com', new Date().toISOString()]
    );
    console.log('✅ Blog demo site created');
  }

  // Check if data already exists to avoid duplicates
  const existingDemo = await query(`SELECT COUNT(*) as count FROM events WHERE site_id = $1`, [siteId]);
  const demoHasData = parseInt(existingDemo.rows[0]?.count || '0') > 0;
  const existingBlog = await query(`SELECT COUNT(*) as count FROM events WHERE site_id = $1`, ['site_blog']);
  const blogHasData = parseInt(existingBlog.rows[0]?.count || '0') > 0;

  if (demoHasData && blogHasData) {
    console.log('ℹ️  Sample data already exists for both sites, skipping generation.');
    return { totalEvents: 0, totalSessions: 0 };
  }

  const devices = ['Desktop', 'Mobile', 'Tablet'];
  const deviceWeights = [56, 35, 9];

  const countries = [
    'United States', 'United Kingdom', 'Germany', 'France', 'Canada',
    'India', 'Australia', 'Japan', 'Brazil', 'Spain'
  ];
  const countryWeights = [35, 15, 10, 8, 7, 6, 5, 4, 3, 7];

  const referrers = [
    null, 'https://google.com', 'https://facebook.com',
    'https://twitter.com', 'https://linkedin.com', 'https://mail.google.com'
  ];
  const referrerWeights = [35, 30, 15, 8, 7, 5];

  const utmSources = [null, 'google', 'facebook', 'twitter', 'newsletter', 'linkedin'];
  const utmSourceWeights = [40, 25, 15, 8, 7, 5];
  const utmMediums = [null, 'cpc', 'social', 'email', 'organic', 'referral'];
  const utmMediumWeights = [40, 20, 15, 10, 10, 5];
  const utmCampaigns = [null, 'spring_sale', 'brand_awareness', 'product_launch', 'retargeting', 'welcome_series'];
  const utmCampaignWeights = [45, 15, 12, 12, 10, 6];

  const pages = [
    { path: '/', title: 'Home' },
    { path: '/products', title: 'Products' },
    { path: '/pricing', title: 'Pricing' },
    { path: '/about', title: 'About Us' },
    { path: '/blog', title: 'Blog' },
    { path: '/contact', title: 'Contact' },
    { path: '/docs', title: 'Documentation' },
    { path: '/features', title: 'Features' },
    { path: '/signup', title: 'Sign Up' },
    { path: '/login', title: 'Login' },
    { path: '/checkout', title: 'Checkout' }
  ];
  const pageWeights = [25, 15, 10, 8, 8, 5, 5, 5, 7, 7, 5];

  // Weighted random selection
  function weightedRandom(items, weights) {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  console.log('🌱 Generating sample analytics data for PostgreSQL...');

  const now = new Date();
  const userPool = Array.from({ length: 3000 }, () => `u_${uuidv4().slice(0, 8)}`);

  let totalEvents = 0;
  let totalSessions = 0;

  // Process in batches per day (Demo Website)
  if (!demoHasData) {
    for (let daysAgo = 90; daysAgo >= 0; daysAgo--) {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);

      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const baseVisitors = isWeekend ? 150 : 280;
      const dailyVisitors = baseVisitors + Math.floor(Math.random() * 120);

      const seasonalMultiplier = 1 + (90 - daysAgo) / 180;
      const adjustedVisitors = Math.floor(dailyVisitors * seasonalMultiplier);

      const dayEvents = [];
      const daySessions = [];

      for (let v = 0; v < adjustedVisitors; v++) {
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

        const pageviewCount = Math.floor(Math.random() * Math.random() * 6) + 1;
        const duration = pageviewCount === 1
          ? Math.floor(Math.random() * 30)
          : Math.floor(Math.random() * 480) + 30;

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
            utmSource || '', utmMedium || '', utmCampaign || ''
          ]);

          // Random click events
          if (Math.random() < 0.25) {
            dayEvents.push([
              siteId, userId, sessionId, 'click',
              `https://demo.example.com${page.path}`, page.path,
              referrer, device, country,
              new Date(eventTime.getTime() + 3000).toISOString(), '{}',
              utmSource || '', utmMedium || '', utmCampaign || ''
            ]);
          }
        }

        // Add funnel events
        if (Math.random() < 0.12) {
          const funnelTime = new Date(sessionStart.getTime() + duration * 400);
          dayEvents.push([
            siteId, userId, sessionId, 'add_to_cart',
            'https://demo.example.com/products', '/products',
            referrer, device, country, funnelTime.toISOString(), '{}',
            utmSource || '', utmMedium || '', utmCampaign || ''
          ]);

          if (Math.random() < 0.45) {
            dayEvents.push([
              siteId, userId, sessionId, 'checkout',
              'https://demo.example.com/checkout', '/checkout',
              referrer, device, country,
              new Date(funnelTime.getTime() + 60000).toISOString(), '{}',
              utmSource || '', utmMedium || '', utmCampaign || ''
            ]);

            if (Math.random() < 0.55) {
              dayEvents.push([
                siteId, userId, sessionId, 'purchase',
                'https://demo.example.com/checkout', '/checkout',
                referrer, device, country,
                new Date(funnelTime.getTime() + 120000).toISOString(), '{}',
                utmSource || '', utmMedium || '', utmCampaign || ''
              ]);
            }
          }
        }

        // Store session
        daySessions.push([
          sessionId, siteId, userId,
          sessionStart.toISOString(),
          new Date(sessionStart.getTime() + duration * 1000).toISOString(),
          duration, pageviewCount, entryPage, exitPage,
          referrer, device, country,
          pageviewCount === 1,
          utmSource || '', utmMedium || '', utmCampaign || ''
        ]);
      }

      // Batch insert events using a transaction
      if (dayEvents.length > 0) {
        const client = await p.connect();
        try {
          await client.query('BEGIN');
          const eventQuery = `
          INSERT INTO events (site_id, user_id, session_id, type, url, path, referrer, device, country, timestamp, properties, utm_source, utm_medium, utm_campaign)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `;
          for (const ev of dayEvents) {
            await client.query(eventQuery, ev);
          }
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
        totalEvents += dayEvents.length;
      }

      if (daySessions.length > 0) {
        const client = await p.connect();
        try {
          await client.query('BEGIN');
          const sessionQuery = `
          INSERT INTO sessions (id, site_id, user_id, started_at, ended_at, duration, pageviews, entry_page, exit_page, referrer, device, country, is_bounce, utm_source, utm_medium, utm_campaign)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `;
          for (const sess of daySessions) {
            await client.query(sessionQuery, sess);
          }
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
        totalSessions += daySessions.length;
      }

      // Progress indicator every 10 days
      if (daysAgo % 10 === 0) {
        process.stdout.write(`\r📊 Processing day ${90 - daysAgo + 1}/91...`);
      }
    }

    console.log(`\n✅ Generated ${totalEvents.toLocaleString()} events (Demo Website)`);
    console.log(`✅ Generated ${totalSessions.toLocaleString()} sessions (Demo Website)`);
  } else {
    console.log('ℹ️  Demo Website data already exists, skipping.');
  }

  // Generate sample data for blog site
  if (!blogHasData) {
    console.log('\n🌱 Generating sample data for TechPulse Blog...');

    const blogSiteId = 'site_blog';
    const blogPages = [
      { path: '/', title: 'Home' },
      { path: '/tutorials', title: 'Tutorials' },
      { path: '/reviews', title: 'Reviews' },
      { path: '/about', title: 'About' },
      { path: '/tutorials/react-hooks', title: 'React Hooks Guide' },
      { path: '/tutorials/nextjs-setup', title: 'Next.js Setup' },
      { path: '/reviews/macbook-pro', title: 'MacBook Pro Review' },
      { path: '/reviews/iphone-15', title: 'iPhone 15 Review' },
    ];
    const blogPageWeights = [25, 18, 15, 8, 10, 8, 8, 8];

    const blogReferrers = [
      null, 'https://google.com', 'https://reddit.com',
      'https://twitter.com', 'https://dev.to', 'https://hackernews.com'
    ];
    const blogReferrerWeights = [30, 30, 15, 10, 10, 5];

    const blogUserPool = Array.from({ length: 1500 }, () => `u_${uuidv4().slice(0, 8)}`);
    let blogEvents = 0;
    let blogSessions = 0;

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
            '', '', ''
          ]);
        }

        blogDaySessions.push([
          sessionId, blogSiteId, userId,
          sessionStart.toISOString(),
          new Date(sessionStart.getTime() + duration * 1000).toISOString(),
          duration, pageviewCount, entryPage, exitPage,
          referrer, device, country,
          pageviewCount === 1,
          '', '', ''
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

// Initialize data (create tables only — users add their own sites via the dashboard)
export async function initializeData() {
  await initializeDatabase();
  return getPool();
}

// Close connection
export async function closeConnection() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('🔌 PostgreSQL connection closed');
  }
}

export default {
  getPool,
  query,
  createPool,
  initializeDatabase,
  initializeData,
  generateSampleData,
  hasSampleData,
  closeConnection
};
