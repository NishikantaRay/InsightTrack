// Analytics Service using PostgreSQL
import { query } from '../db/database.js';

// Get date range based on filter
function getDateRange(range) {
  // Support custom range format: "custom:YYYY-MM-DD:YYYY-MM-DD"
  if (typeof range === 'string' && range.startsWith('custom:')) {
    const parts = range.split(':');
    if (parts.length === 3) {
      const start = new Date(parts[1]);
      const end = new Date(parts[2]);
      // Validate parsed dates
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return {
          start: start.toISOString(),
          end: end.toISOString()
        };
      }
    }
  }

  const end = new Date();
  const start = new Date();

  switch (range) {
    case 'today':
    case '1d':
      start.setHours(0, 0, 0, 0);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    default:
      start.setDate(start.getDate() - 30);
  }

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

export const analyticsService = {
  // Traffic Over Time - unique visitors per day
  async getTrafficOverTime(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const result = await query(
      `SELECT 
        DATE(timestamp) as date,
        COUNT(DISTINCT user_id) as visitors,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(*) FILTER (WHERE type = 'pageview') as pageviews
      FROM events
      WHERE site_id = $1
        AND timestamp >= $2
        AND timestamp <= $3
      GROUP BY DATE(timestamp)
      ORDER BY date ASC`,
      [siteId, start, end]
    );

    return result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      visitors: Number(row.visitors),
      sessions: Number(row.sessions),
      pageviews: Number(row.pageviews)
    }));
  },

  // Bounce Rate Over Time - daily bounce rate trend
  async getBounceRateOverTime(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const result = await query(
      `SELECT 
        DATE(started_at) as date,
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE is_bounce = TRUE) as bounced
      FROM sessions
      WHERE site_id = $1
        AND started_at >= $2
        AND started_at <= $3
      GROUP BY DATE(started_at)
      ORDER BY date ASC`,
      [siteId, start, end]
    );

    return result.rows.map(row => {
      const total = Number(row.total_sessions);
      const bounced = Number(row.bounced);
      return {
        date: row.date.toISOString().split('T')[0],
        bounceRate: total > 0 ? Math.round((bounced / total) * 1000) / 10 : 0
      };
    });
  },

  // Average Session Duration Over Time - daily avg duration trend
  async getAvgSessionOverTime(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const result = await query(
      `SELECT 
        DATE(started_at) as date,
        AVG(duration) as avg_duration
      FROM sessions
      WHERE site_id = $1
        AND started_at >= $2
        AND started_at <= $3
      GROUP BY DATE(started_at)
      ORDER BY date ASC`,
      [siteId, start, end]
    );

    return result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      avgDuration: Math.round(Number(row.avg_duration || 0))
    }));
  },

  // Page Views Over Time
  async getPageViewsOverTime(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const result = await query(
      `SELECT 
        DATE(timestamp) as date,
        COUNT(*) as pageviews
      FROM events
      WHERE site_id = $1
        AND type = 'pageview'
        AND timestamp >= $2
        AND timestamp <= $3
      GROUP BY DATE(timestamp)
      ORDER BY date ASC`,
      [siteId, start, end]
    );

    return result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      pageviews: Number(row.pageviews)
    }));
  },

  // Top Pages
  async getTopPages(siteId, dateRange = '30d', limit = 10) {
    const { start, end } = getDateRange(dateRange);

    const result = await query(
      `SELECT 
        path,
        path as title,
        COUNT(*) as views,
        COUNT(DISTINCT user_id) as "uniqueVisitors"
      FROM events
      WHERE site_id = $1
        AND type = 'pageview'
        AND timestamp >= $2
        AND timestamp <= $3
      GROUP BY path
      ORDER BY views DESC
      LIMIT $4`,
      [siteId, start, end, limit]
    );

    return result.rows.map(row => ({
      path: row.path,
      title: row.title,
      views: Number(row.views),
      uniqueVisitors: Number(row.uniqueVisitors)
    }));
  },

  // Traffic Sources (with improved referrer classification)
  async getTrafficSources(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const result = await query(
      `SELECT 
        CASE
          WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
          WHEN referrer LIKE '%google.%' OR referrer LIKE '%bing.%' OR referrer LIKE '%yahoo.%' 
               OR referrer LIKE '%duckduckgo.%' OR referrer LIKE '%baidu.%' OR referrer LIKE '%yandex.%' THEN 'Search'
          WHEN referrer LIKE '%facebook.%' OR referrer LIKE '%twitter.%' OR referrer LIKE '%linkedin.%' 
               OR referrer LIKE '%instagram.%' OR referrer LIKE '%youtube.%' OR referrer LIKE '%reddit.%'
               OR referrer LIKE '%pinterest.%' OR referrer LIKE '%tiktok.%' THEN 'Social'
          WHEN referrer LIKE '%mail.%' OR referrer LIKE '%email.%' OR referrer LIKE '%outlook.%' THEN 'Email'
          ELSE 'Referral'
        END as source,
        COUNT(DISTINCT user_id) as visitors
      FROM events
      WHERE site_id = $1
        AND timestamp >= $2
        AND timestamp <= $3
      GROUP BY source
      ORDER BY visitors DESC`,
      [siteId, start, end]
    );

    const data = result.rows;
    const total = data.reduce((sum, r) => sum + Number(r.visitors), 0);

    return data.map(row => ({
      source: row.source,
      visitors: Number(row.visitors),
      percentage: Math.round((Number(row.visitors) / total) * 100)
    }));
  },

  // Device Breakdown
  async getDeviceBreakdown(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const result = await query(
      `SELECT 
        CASE WHEN device = '' OR device IS NULL THEN 'Desktop' ELSE device END as device,
        COUNT(DISTINCT user_id) as visitors
      FROM events
      WHERE site_id = $1
        AND timestamp >= $2
        AND timestamp <= $3
      GROUP BY device
      ORDER BY visitors DESC`,
      [siteId, start, end]
    );

    const data = result.rows;
    const total = data.reduce((sum, r) => sum + Number(r.visitors), 0);

    return data.map(row => ({
      device: row.device,
      visitors: Number(row.visitors),
      percentage: Math.round((Number(row.visitors) / total) * 100)
    }));
  },

  // Countries
  async getCountries(siteId, dateRange = '30d', limit = 10) {
    const { start, end } = getDateRange(dateRange);

    const countryCodeMap = {
      'United States': 'US', 'United Kingdom': 'GB', 'Germany': 'DE',
      'France': 'FR', 'Canada': 'CA', 'India': 'IN', 'Australia': 'AU',
      'Japan': 'JP', 'Brazil': 'BR', 'Spain': 'ES'
    };

    const result = await query(
      `SELECT 
        CASE WHEN country = '' OR country IS NULL THEN 'Unknown' ELSE country END as country,
        COUNT(DISTINCT user_id) as visitors
      FROM events
      WHERE site_id = $1
        AND timestamp >= $2
        AND timestamp <= $3
      GROUP BY country
      ORDER BY visitors DESC
      LIMIT $4`,
      [siteId, start, end, limit]
    );

    const data = result.rows;
    const total = data.reduce((sum, r) => sum + Number(r.visitors), 0);

    return data.map(row => ({
      country: row.country,
      code: countryCodeMap[row.country] || 'OTHER',
      visitors: Number(row.visitors),
      percentage: Math.round((Number(row.visitors) / total) * 100)
    }));
  },

  // Session Duration Distribution
  async getSessionDuration(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const result = await query(
      `SELECT bucket, sessions FROM (
        SELECT 
          CASE
            WHEN duration < 10 THEN '0-10s'
            WHEN duration < 30 THEN '10-30s'
            WHEN duration < 60 THEN '30s-1m'
            WHEN duration < 180 THEN '1-3m'
            WHEN duration < 600 THEN '3-10m'
            ELSE '10m+'
          END as bucket,
          COUNT(*) as sessions
        FROM sessions
        WHERE site_id = $1
          AND started_at >= $2
          AND started_at <= $3
        GROUP BY 1
      ) sub
      ORDER BY 
        CASE bucket
          WHEN '0-10s' THEN 1
          WHEN '10-30s' THEN 2
          WHEN '30s-1m' THEN 3
          WHEN '1-3m' THEN 4
          WHEN '3-10m' THEN 5
          WHEN '10m+' THEN 6
        END`,
      [siteId, start, end]
    );

    const data = result.rows;
    const total = data.reduce((sum, r) => sum + Number(r.sessions), 0) || 1;

    return data.map(row => ({
      bucket: row.bucket,
      sessions: Number(row.sessions),
      percentage: Math.round((Number(row.sessions) / total) * 100)
    }));
  },

  // KPI Summary with trend comparisons
  async getKPISummary(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    // Calculate previous period for trend comparison
    const currentStart = new Date(start);
    const currentEnd = new Date(end);
    const periodMs = currentEnd.getTime() - currentStart.getTime();
    const prevEnd = new Date(currentStart.getTime());
    const prevStart = new Date(currentStart.getTime() - periodMs);

    // Run current + previous period stats in parallel
    const [eventResult, sessionResult, prevEventResult, prevSessionResult] = await Promise.all([
      query(
        `SELECT 
          COUNT(DISTINCT user_id) as "totalVisitors",
          COUNT(*) FILTER (WHERE type = 'pageview') as "totalPageviews"
        FROM events
        WHERE site_id = $1
          AND timestamp >= $2
          AND timestamp <= $3`,
        [siteId, start, end]
      ),
      query(
        `SELECT 
          COUNT(*) as "totalSessions",
          AVG(duration) as "avgDuration",
          COUNT(*) FILTER (WHERE is_bounce = TRUE) as bounces
        FROM sessions
        WHERE site_id = $1
          AND started_at >= $2
          AND started_at <= $3`,
        [siteId, start, end]
      ),
      query(
        `SELECT 
          COUNT(DISTINCT user_id) as "totalVisitors",
          COUNT(*) FILTER (WHERE type = 'pageview') as "totalPageviews"
        FROM events
        WHERE site_id = $1
          AND timestamp >= $2
          AND timestamp < $3`,
        [siteId, prevStart.toISOString(), prevEnd.toISOString()]
      ),
      query(
        `SELECT 
          COUNT(*) as "totalSessions",
          AVG(duration) as "avgDuration",
          COUNT(*) FILTER (WHERE is_bounce = TRUE) as bounces
        FROM sessions
        WHERE site_id = $1
          AND started_at >= $2
          AND started_at < $3`,
        [siteId, prevStart.toISOString(), prevEnd.toISOString()]
      )
    ]);

    const eventData = eventResult.rows;
    const sessionData = sessionResult.rows;
    const prevEventData = prevEventResult.rows;
    const prevSessionData = prevSessionResult.rows;

    const totalVisitors = Number(eventData[0]?.totalVisitors || 0);
    const totalPageviews = Number(eventData[0]?.totalPageviews || 0);
    const totalSessions = Number(sessionData[0]?.totalSessions || 0);
    const avgDuration = Number(sessionData[0]?.avgDuration || 0);
    const bounces = Number(sessionData[0]?.bounces || 0);
    const bounceRate = totalSessions > 0 ? (bounces / totalSessions) * 100 : 0;

    const prevVisitors = Number(prevEventData[0]?.totalVisitors || 0);
    const prevPageviews = Number(prevEventData[0]?.totalPageviews || 0);
    const prevSessions = Number(prevSessionData[0]?.totalSessions || 0);
    const prevAvgDuration = Number(prevSessionData[0]?.avgDuration || 0);
    const prevBounces = Number(prevSessionData[0]?.bounces || 0);
    const prevBounceRate = prevSessions > 0 ? (prevBounces / prevSessions) * 100 : 0;

    // Calculate percentage change
    function calcTrend(current, previous) {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 1000) / 10;
    }

    const minutes = Math.floor(avgDuration / 60);
    const seconds = Math.round(avgDuration % 60);

    return {
      totalVisitors,
      totalPageviews,
      totalSessions,
      bounceRate: Math.round(bounceRate * 10) / 10,
      avgSessionDuration: `${minutes}m ${seconds}s`,
      pagesPerSession: totalSessions > 0 ? (totalPageviews / totalSessions).toFixed(2) : '0.00',
      visitorsTrend: calcTrend(totalVisitors, prevVisitors),
      pageviewsTrend: calcTrend(totalPageviews, prevPageviews),
      bounceRateTrend: calcTrend(bounceRate, prevBounceRate),
      sessionTrend: calcTrend(avgDuration, prevAvgDuration)
    };
  },

  // Funnel Data
  async getFunnelData(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    // Get total visitors
    const totalResult = await query(
      `SELECT COUNT(DISTINCT user_id) as total
      FROM events
      WHERE site_id = $1
        AND timestamp >= $2
        AND timestamp <= $3`,
      [siteId, start, end]
    );

    const totalVisitors = Number(totalResult.rows[0]?.total || 0);

    // Get funnel step counts
    const funnelResult = await query(
      `SELECT 
        COUNT(DISTINCT user_id) FILTER (WHERE type = 'pageview') as step1,
        COUNT(DISTINCT user_id) FILTER (WHERE type = 'pageview' AND path = '/products') as step2,
        COUNT(DISTINCT user_id) FILTER (WHERE type = 'add_to_cart') as step3,
        COUNT(DISTINCT user_id) FILTER (WHERE type = 'checkout') as step4,
        COUNT(DISTINCT user_id) FILTER (WHERE type = 'purchase') as step5
      FROM events
      WHERE site_id = $1
        AND timestamp >= $2
        AND timestamp <= $3`,
      [siteId, start, end]
    );

    const data = funnelResult.rows[0] || {};

    const steps = [
      { name: 'Visit Homepage', visitors: Number(data.step1 || 0) },
      { name: 'View Product', visitors: Number(data.step2 || 0) },
      { name: 'Add to Cart', visitors: Number(data.step3 || 0) },
      { name: 'Checkout', visitors: Number(data.step4 || 0) },
      { name: 'Purchase', visitors: Number(data.step5 || 0) }
    ];

    return steps.map(step => ({
      step: step.name,
      visitors: step.visitors,
      percentage: totalVisitors > 0 ? Math.round((step.visitors / totalVisitors) * 1000) / 10 : 0
    }));
  },

  // UTM Campaign Analytics
  async getUTMCampaigns(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const result = await query(
      `SELECT 
        CASE WHEN utm_source = '' OR utm_source IS NULL THEN '(none)' ELSE utm_source END as source,
        CASE WHEN utm_medium = '' OR utm_medium IS NULL THEN '(none)' ELSE utm_medium END as medium,
        CASE WHEN utm_campaign = '' OR utm_campaign IS NULL THEN '(none)' ELSE utm_campaign END as campaign,
        COUNT(DISTINCT user_id) as visitors,
        COUNT(*) FILTER (WHERE type = 'pageview') as pageviews
      FROM events
      WHERE site_id = $1
        AND timestamp >= $2
        AND timestamp <= $3
        AND (utm_source != '' OR utm_medium != '' OR utm_campaign != '')
      GROUP BY source, medium, campaign
      ORDER BY visitors DESC
      LIMIT 20`,
      [siteId, start, end]
    );

    const total = result.rows.reduce((sum, r) => sum + Number(r.visitors), 0) || 1;

    return result.rows.map(row => ({
      source: row.source,
      medium: row.medium,
      campaign: row.campaign,
      visitors: Number(row.visitors),
      pageviews: Number(row.pageviews),
      percentage: Math.round((Number(row.visitors) / total) * 100)
    }));
  },

  // Real-time visitors (last 5 minutes) with top pages, devices, countries
  async getRealTimeVisitors(siteId) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const [activeResult, pagesResult, devicesResult, countriesResult] = await Promise.all([
      query(
        `SELECT COUNT(DISTINCT user_id) as "activeVisitors"
        FROM events
        WHERE site_id = $1 AND timestamp >= $2`,
        [siteId, fiveMinutesAgo]
      ),
      query(
        `SELECT path, COUNT(DISTINCT user_id) as visitors
        FROM events
        WHERE site_id = $1 AND timestamp >= $2 AND type = 'pageview'
        GROUP BY path ORDER BY visitors DESC LIMIT 10`,
        [siteId, fiveMinutesAgo]
      ),
      query(
        `SELECT 
          CASE WHEN device = '' OR device IS NULL THEN 'Desktop' ELSE device END as device,
          COUNT(DISTINCT user_id) as count
        FROM events
        WHERE site_id = $1 AND timestamp >= $2
        GROUP BY device ORDER BY count DESC`,
        [siteId, fiveMinutesAgo]
      ),
      query(
        `SELECT 
          CASE WHEN country = '' OR country IS NULL THEN 'Unknown' ELSE country END as country,
          COUNT(DISTINCT user_id) as visitors
        FROM events
        WHERE site_id = $1 AND timestamp >= $2
        GROUP BY country ORDER BY visitors DESC LIMIT 10`,
        [siteId, fiveMinutesAgo]
      )
    ]);

    const activeVisitors = Number(activeResult.rows[0]?.activeVisitors || 0);

    const topPages = pagesResult.rows.map(r => ({
      path: r.path,
      visitors: Number(r.visitors)
    }));

    const devices = {};
    devicesResult.rows.forEach(r => {
      devices[r.device] = Number(r.count);
    });

    const countries = countriesResult.rows.map(r => ({
      country: r.country,
      visitors: Number(r.visitors)
    }));

    return { activeVisitors, topPages, devices, countries };
  },

  // Real-time event stream (last 5 minutes)
  async getRealtimeEventStream(siteId, limit = 50) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const safeLimit = Math.min(Math.max(1, limit), 100);

    const result = await query(
      `SELECT id, type, path, url, referrer, device, browser, os,
              country, city, user_id, session_id, timestamp,
              utm_source, utm_medium, utm_campaign
       FROM events
       WHERE site_id = $1 AND timestamp >= $2
       ORDER BY timestamp DESC
       LIMIT $3`,
      [siteId, fiveMinutesAgo, safeLimit]
    );

    return result.rows.map(r => ({
      id: r.id,
      type: r.type,
      path: r.path,
      url: r.url,
      referrer: r.referrer || null,
      device: r.device || 'Desktop',
      browser: r.browser || 'Unknown',
      os: r.os || 'Unknown',
      country: r.country || 'Unknown',
      city: r.city || null,
      userId: r.user_id,
      sessionId: r.session_id,
      timestamp: r.timestamp,
      utmSource: r.utm_source || null,
      utmMedium: r.utm_medium || null,
      utmCampaign: r.utm_campaign || null,
    }));
  },

  // Comparison Traffic - current period vs previous period overlay
  async getComparisonTraffic(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    // Calculate previous period
    const currentStart = new Date(start);
    const currentEnd = new Date(end);
    const periodMs = currentEnd.getTime() - currentStart.getTime();
    const prevEnd = new Date(currentStart.getTime());
    const prevStart = new Date(currentStart.getTime() - periodMs);

    const [currentResult, previousResult] = await Promise.all([
      query(
        `SELECT 
          DATE(timestamp) as date,
          COUNT(DISTINCT user_id) as visitors,
          COUNT(DISTINCT session_id) as sessions,
          COUNT(*) FILTER (WHERE type = 'pageview') as pageviews
        FROM events
        WHERE site_id = $1
          AND timestamp >= $2
          AND timestamp <= $3
        GROUP BY DATE(timestamp)
        ORDER BY date ASC`,
        [siteId, start, end]
      ),
      query(
        `SELECT 
          DATE(timestamp) as date,
          COUNT(DISTINCT user_id) as visitors,
          COUNT(DISTINCT session_id) as sessions,
          COUNT(*) FILTER (WHERE type = 'pageview') as pageviews
        FROM events
        WHERE site_id = $1
          AND timestamp >= $2
          AND timestamp < $3
        GROUP BY DATE(timestamp)
        ORDER BY date ASC`,
        [siteId, prevStart.toISOString(), prevEnd.toISOString()]
      )
    ]);

    const current = currentResult.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      visitors: Number(row.visitors),
      sessions: Number(row.sessions),
      pageviews: Number(row.pageviews)
    }));

    const previous = previousResult.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      visitors: Number(row.visitors),
      sessions: Number(row.sessions),
      pageviews: Number(row.pageviews)
    }));

    // Merge by aligning day index (day 0, day 1, etc.)
    const merged = current.map((c, i) => ({
      date: c.date,
      visitors: c.visitors,
      sessions: c.sessions,
      pageviews: c.pageviews,
      prevVisitors: previous[i]?.visitors ?? 0,
      prevSessions: previous[i]?.sessions ?? 0,
      prevPageviews: previous[i]?.pageviews ?? 0,
      prevDate: previous[i]?.date ?? null
    }));

    return {
      current,
      previous,
      merged,
      period: {
        current: { start: start.split('T')?.[0] || start, end: end.split('T')?.[0] || end },
        previous: { start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] }
      }
    };
  },

  // User Flow / Path Analysis - page-to-page transitions
  async getUserFlow(siteId, dateRange = '30d', limit = 20) {
    const { start, end } = getDateRange(dateRange);

    // Get sequential page visits per session to find transitions
    const result = await query(
      `WITH ordered_pages AS (
        SELECT 
          session_id,
          path,
          timestamp,
          LEAD(path) OVER (PARTITION BY session_id ORDER BY timestamp) as next_path
        FROM events
        WHERE site_id = $1
          AND type = 'pageview'
          AND timestamp >= $2
          AND timestamp <= $3
      )
      SELECT 
        path as from_page,
        next_path as to_page,
        COUNT(*) as transitions
      FROM ordered_pages
      WHERE next_path IS NOT NULL
      GROUP BY path, next_path
      ORDER BY transitions DESC
      LIMIT $4`,
      [siteId, start, end, limit]
    );

    // Also get entry and exit pages
    const [entryResult, exitResult] = await Promise.all([
      query(
        `SELECT entry_page as page, COUNT(*) as count
        FROM sessions
        WHERE site_id = $1
          AND started_at >= $2
          AND started_at <= $3
          AND entry_page IS NOT NULL
        GROUP BY entry_page
        ORDER BY count DESC
        LIMIT 10`,
        [siteId, start, end]
      ),
      query(
        `SELECT exit_page as page, COUNT(*) as count
        FROM sessions
        WHERE site_id = $1
          AND started_at >= $2
          AND started_at <= $3
          AND exit_page IS NOT NULL
        GROUP BY exit_page
        ORDER BY count DESC
        LIMIT 10`,
        [siteId, start, end]
      )
    ]);

    return {
      transitions: result.rows.map(r => ({
        from: r.from_page,
        to: r.to_page,
        count: Number(r.transitions)
      })),
      entryPages: entryResult.rows.map(r => ({
        page: r.page,
        count: Number(r.count)
      })),
      exitPages: exitResult.rows.map(r => ({
        page: r.page,
        count: Number(r.count)
      }))
    };
  },

  // Alerts data - traffic anomalies
  async getAlerts(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    // Compare daily traffic to detect spikes and drops
    const result = await query(
      `SELECT 
        DATE(timestamp) as date,
        COUNT(DISTINCT user_id) as visitors,
        COUNT(*) FILTER (WHERE type = 'pageview') as pageviews
      FROM events
      WHERE site_id = $1
        AND timestamp >= $2
        AND timestamp <= $3
      GROUP BY DATE(timestamp)
      ORDER BY date ASC`,
      [siteId, start, end]
    );

    const daily = result.rows.map(r => ({
      date: r.date.toISOString().split('T')[0],
      visitors: Number(r.visitors),
      pageviews: Number(r.pageviews)
    }));

    if (daily.length < 3) return [];

    // Calculate rolling average and standard deviation
    const alerts = [];
    for (let i = 3; i < daily.length; i++) {
      const window = daily.slice(Math.max(0, i - 7), i);
      const avgVisitors = window.reduce((s, d) => s + d.visitors, 0) / window.length;
      const stdDev = Math.sqrt(
        window.reduce((s, d) => s + Math.pow(d.visitors - avgVisitors, 2), 0) / window.length
      );

      const current = daily[i];
      const threshold = 2; // 2 standard deviations

      if (stdDev > 0 && current.visitors > avgVisitors + threshold * stdDev) {
        alerts.push({
          type: 'spike',
          severity: 'warning',
          date: current.date,
          message: `Traffic spike: ${current.visitors} visitors (avg: ${Math.round(avgVisitors)})`,
          value: current.visitors,
          average: Math.round(avgVisitors),
          change: Math.round(((current.visitors - avgVisitors) / avgVisitors) * 100)
        });
      } else if (stdDev > 0 && current.visitors < avgVisitors - threshold * stdDev) {
        alerts.push({
          type: 'drop',
          severity: 'error',
          date: current.date,
          message: `Traffic drop: ${current.visitors} visitors (avg: ${Math.round(avgVisitors)})`,
          value: current.visitors,
          average: Math.round(avgVisitors),
          change: Math.round(((current.visitors - avgVisitors) / avgVisitors) * 100)
        });
      }
    }

    return alerts.reverse(); // Most recent first
  },

  // ═══════════════════════════════════════════════════════════════
  // Engagement Queries (scroll depth, heatmaps, rage clicks, time on page)
  // ═══════════════════════════════════════════════════════════════

  // Scroll Depth per page — milestone breakdown
  async getScrollDepth(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const result = await query(
      `SELECT
        path,
        COUNT(*) FILTER (WHERE (properties->>'depth')::int >= 25)  AS reached_25,
        COUNT(*) FILTER (WHERE (properties->>'depth')::int >= 50)  AS reached_50,
        COUNT(*) FILTER (WHERE (properties->>'depth')::int >= 75)  AS reached_75,
        COUNT(*) FILTER (WHERE (properties->>'depth')::int >= 100) AS reached_100,
        COUNT(*) AS total_events,
        ROUND(AVG((properties->>'depth')::numeric), 1) AS avg_depth
      FROM events
      WHERE site_id = $1 AND type = 'scroll_depth'
        AND timestamp >= $2 AND timestamp <= $3
        AND properties->>'milestone' = 'true'
      GROUP BY path
      ORDER BY total_events DESC
      LIMIT 20`,
      [siteId, start, end]
    );

    return result.rows.map(r => ({
      path: r.path,
      reached25: Number(r.reached_25),
      reached50: Number(r.reached_50),
      reached75: Number(r.reached_75),
      reached100: Number(r.reached_100),
      totalEvents: Number(r.total_events),
      avgDepth: Number(r.avg_depth || 0),
    }));
  },

  // Heatmap click data for a specific page
  async getHeatmapData(siteId, dateRange = '30d', path = '/') {
    const { start, end } = getDateRange(dateRange);

    const result = await query(
      `SELECT
        (properties->>'relX')::numeric AS rel_x,
        (properties->>'relY')::numeric AS rel_y,
        (properties->>'x')::int AS abs_x,
        (properties->>'y')::int AS abs_y,
        properties->>'selector' AS selector,
        COUNT(*) AS clicks
      FROM events
      WHERE site_id = $1 AND type = 'heatmap_click'
        AND timestamp >= $2 AND timestamp <= $3
        AND path = $4
      GROUP BY rel_x, rel_y, abs_x, abs_y, selector
      ORDER BY clicks DESC
      LIMIT 500`,
      [siteId, start, end, path]
    );

    return result.rows.map(r => ({
      relX: Number(r.rel_x || 0),
      relY: Number(r.rel_y || 0),
      absX: Number(r.abs_x || 0),
      absY: Number(r.abs_y || 0),
      selector: r.selector || '',
      clicks: Number(r.clicks),
    }));
  },

  // Heatmap summary — top clicked elements across all pages
  async getHeatmapSummary(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const result = await query(
      `SELECT
        path,
        properties->>'selector' AS selector,
        COUNT(*) AS clicks
      FROM events
      WHERE site_id = $1 AND type = 'heatmap_click'
        AND timestamp >= $2 AND timestamp <= $3
      GROUP BY path, selector
      ORDER BY clicks DESC
      LIMIT 50`,
      [siteId, start, end]
    );

    return result.rows.map(r => ({
      path: r.path,
      selector: r.selector || '',
      clicks: Number(r.clicks),
    }));
  },

  // Rage click incidents
  async getRageClicks(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const result = await query(
      `SELECT
        path,
        properties->>'selector' AS selector,
        COUNT(*) AS incidents,
        SUM((properties->>'count')::int) AS total_clicks,
        MIN(timestamp) AS first_seen,
        MAX(timestamp) AS last_seen
      FROM events
      WHERE site_id = $1 AND type = 'rage_click'
        AND timestamp >= $2 AND timestamp <= $3
      GROUP BY path, selector
      ORDER BY incidents DESC
      LIMIT 30`,
      [siteId, start, end]
    );

    return result.rows.map(r => ({
      path: r.path,
      selector: r.selector || '',
      incidents: Number(r.incidents),
      totalClicks: Number(r.total_clicks || 0),
      firstSeen: r.first_seen,
      lastSeen: r.last_seen,
    }));
  },

  // Time on page — per-page average read time
  async getTimeOnPage(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const result = await query(
      `SELECT
        path,
        ROUND(AVG((properties->>'seconds')::numeric), 1) AS avg_time,
        ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (properties->>'seconds')::numeric))::numeric, 1) AS median_time,
        MIN((properties->>'seconds')::int) AS min_time,
        MAX((properties->>'seconds')::int) AS max_time,
        COUNT(*) AS samples
      FROM events
      WHERE site_id = $1 AND type = 'time_on_page'
        AND timestamp >= $2 AND timestamp <= $3
        AND (properties->>'seconds')::int > 0
        AND (properties->>'seconds')::int < 3600
      GROUP BY path
      ORDER BY samples DESC
      LIMIT 20`,
      [siteId, start, end]
    );

    return result.rows.map(r => ({
      path: r.path,
      avgTime: Number(r.avg_time || 0),
      medianTime: Number(r.median_time || 0),
      minTime: Number(r.min_time || 0),
      maxTime: Number(r.max_time || 0),
      samples: Number(r.samples),
    }));
  },

  // Engagement summary KPIs
  async getEngagementSummary(siteId, dateRange = '30d') {
    const { start, end } = getDateRange(dateRange);

    const [scrollResult, timeResult, rageResult, heatmapResult] = await Promise.all([
      query(
        `SELECT ROUND(AVG((properties->>'depth')::numeric), 1) AS avg_scroll
        FROM events WHERE site_id = $1 AND type = 'scroll_depth'
          AND timestamp >= $2 AND timestamp <= $3`,
        [siteId, start, end]
      ),
      query(
        `SELECT ROUND(AVG((properties->>'seconds')::numeric), 1) AS avg_time
        FROM events WHERE site_id = $1 AND type = 'time_on_page'
          AND timestamp >= $2 AND timestamp <= $3
          AND (properties->>'seconds')::int > 0
          AND (properties->>'seconds')::int < 3600`,
        [siteId, start, end]
      ),
      query(
        `SELECT COUNT(*) AS total_rage_clicks
        FROM events WHERE site_id = $1 AND type = 'rage_click'
          AND timestamp >= $2 AND timestamp <= $3`,
        [siteId, start, end]
      ),
      query(
        `SELECT COUNT(*) AS total_clicks
        FROM events WHERE site_id = $1 AND type = 'heatmap_click'
          AND timestamp >= $2 AND timestamp <= $3`,
        [siteId, start, end]
      ),
    ]);

    return {
      avgScrollDepth: Number(scrollResult.rows[0]?.avg_scroll || 0),
      avgTimeOnPage: Number(timeResult.rows[0]?.avg_time || 0),
      totalRageClicks: Number(rageResult.rows[0]?.total_rage_clicks || 0),
      totalClicks: Number(heatmapResult.rows[0]?.total_clicks || 0),
    };
  }
};

export default analyticsService;
