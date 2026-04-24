// Sites Service using PostgreSQL
import { query } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

export const sitesService = {
  // Create a new site
  async createSite(name, domain, userId) {
    const id = `site_${uuidv4().slice(0, 8)}`;

    const result = await query(
      `INSERT INTO sites (id, user_id, name, domain, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, userId, name, domain, new Date().toISOString()]
    );

    return result.rows[0];
  },

  // Get site by ID
  async getSiteById(siteId) {
    const result = await query(
      `SELECT * FROM sites WHERE id = $1 LIMIT 1`,
      [siteId]
    );

    return result.rows[0] || null;
  },

  // Get all sites
  async getAllSites(userId) {
    if (!userId) {
      const result = await query(
        `SELECT * FROM sites ORDER BY created_at DESC`
      );
      return result.rows;
    }
    const result = await query(
      `SELECT * FROM sites WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  // Update site
  async updateSite(siteId, name, domain, userId) {
    const existing = await this.getSiteById(siteId);
    if (!existing) return null;
    if (userId && existing.user_id !== userId) return null;

    const result = await query(
      `UPDATE sites SET name = $1, domain = $2 WHERE id = $3 RETURNING *`,
      [name || existing.name, domain || existing.domain, siteId]
    );

    return result.rows[0];
  },

  // Delete site
  async deleteSite(siteId, userId) {
    const existing = await this.getSiteById(siteId);
    if (!existing) return { success: false };
    if (userId && existing.user_id !== userId) {
      throw new Error('You do not own this site');
    }

    // Delete related events
    await query(`DELETE FROM events WHERE site_id = $1`, [siteId]);

    // Delete related sessions
    await query(`DELETE FROM sessions WHERE site_id = $1`, [siteId]);

    // Delete site
    await query(`DELETE FROM sites WHERE id = $1`, [siteId]);

    return { success: true };
  },

  // Get site tracking script (inline HTML snippet for copy/paste)
  getTrackingScript(siteId, serverUrl = process.env.SERVER_URL || 'http://localhost:3001') {
    return `<script src="${serverUrl}/api/sites/${siteId}/script"></script>`;
  },

  // Get raw JavaScript tracking code (served by the script endpoint)
  getRawTrackingScript(siteId, serverUrl = process.env.SERVER_URL || 'http://localhost:3001') {
    return `(function() {
  // Respect Do Not Track / Global Privacy Control
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
  
  var siteId = ${JSON.stringify(siteId)};
  var serverUrl = ${JSON.stringify(serverUrl)};
  
  function getUserId() {
    var userId = localStorage.getItem('_analytics_uid');
    if (!userId) {
      userId = 'u_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('_analytics_uid', userId);
    }
    return userId;
  }
  
  function getSessionId() {
    var sessionId = sessionStorage.getItem('_analytics_sid');
    if (!sessionId) {
      sessionId = 's_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('_analytics_sid', sessionId);
    }
    return sessionId;
  }
  
  function getDeviceType() {
    var ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'Tablet';
    if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'Mobile';
    return 'Desktop';
  }

  function getBrowser() {
    var ua = navigator.userAgent;
    if (/Edg\\//i.test(ua)) return 'Edge';
    if (/OPR|Opera/i.test(ua)) return 'Opera';
    if (/Chrome/i.test(ua)) return 'Chrome';
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
    if (/Firefox/i.test(ua)) return 'Firefox';
    return 'Other';
  }

  function getOS() {
    var ua = navigator.userAgent;
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Mac OS/i.test(ua)) return 'macOS';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Other';
  }

  function getCountry() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      var map = {
        'America/New_York': 'United States', 'America/Chicago': 'United States',
        'America/Los_Angeles': 'United States', 'America/Denver': 'United States',
        'America/Phoenix': 'United States', 'America/Anchorage': 'United States',
        'America/Boise': 'United States', 'America/Detroit': 'United States',
        'America/Indiana/Indianapolis': 'United States', 'Pacific/Honolulu': 'United States',
        'America/Toronto': 'Canada', 'America/Vancouver': 'Canada',
        'America/Edmonton': 'Canada', 'America/Winnipeg': 'Canada',
        'America/Halifax': 'Canada', 'America/St_Johns': 'Canada', 'America/Regina': 'Canada',
        'America/Mexico_City': 'Mexico', 'America/Cancun': 'Mexico', 'America/Tijuana': 'Mexico',
        'America/Sao_Paulo': 'Brazil', 'America/Argentina/Buenos_Aires': 'Argentina',
        'America/Bogota': 'Colombia', 'America/Lima': 'Peru',
        'America/Santiago': 'Chile', 'America/Caracas': 'Venezuela',
        'America/Costa_Rica': 'Costa Rica', 'America/Panama': 'Panama',
        'Europe/London': 'United Kingdom', 'Europe/Dublin': 'Ireland',
        'Europe/Berlin': 'Germany', 'Europe/Paris': 'France',
        'Europe/Madrid': 'Spain', 'Europe/Rome': 'Italy',
        'Europe/Amsterdam': 'Netherlands', 'Europe/Brussels': 'Belgium',
        'Europe/Zurich': 'Switzerland', 'Europe/Vienna': 'Austria',
        'Europe/Lisbon': 'Portugal', 'Europe/Warsaw': 'Poland',
        'Europe/Prague': 'Czech Republic', 'Europe/Budapest': 'Hungary',
        'Europe/Bucharest': 'Romania', 'Europe/Sofia': 'Bulgaria',
        'Europe/Athens': 'Greece', 'Europe/Helsinki': 'Finland',
        'Europe/Stockholm': 'Sweden', 'Europe/Oslo': 'Norway',
        'Europe/Copenhagen': 'Denmark', 'Europe/Kiev': 'Ukraine',
        'Europe/Moscow': 'Russia', 'Europe/Istanbul': 'Turkey',
        'Europe/Belgrade': 'Serbia',
        'Asia/Kolkata': 'India', 'Asia/Calcutta': 'India',
        'Asia/Tokyo': 'Japan', 'Asia/Shanghai': 'China', 'Asia/Hong_Kong': 'Hong Kong',
        'Asia/Singapore': 'Singapore', 'Asia/Seoul': 'South Korea',
        'Asia/Taipei': 'Taiwan', 'Asia/Bangkok': 'Thailand',
        'Asia/Jakarta': 'Indonesia', 'Asia/Manila': 'Philippines',
        'Asia/Kuala_Lumpur': 'Malaysia', 'Asia/Ho_Chi_Minh': 'Vietnam',
        'Asia/Karachi': 'Pakistan', 'Asia/Dhaka': 'Bangladesh',
        'Asia/Dubai': 'United Arab Emirates', 'Asia/Riyadh': 'Saudi Arabia',
        'Asia/Tehran': 'Iran', 'Asia/Jerusalem': 'Israel',
        'Asia/Almaty': 'Kazakhstan', 'Asia/Colombo': 'Sri Lanka',
        'Australia/Sydney': 'Australia', 'Australia/Melbourne': 'Australia',
        'Australia/Brisbane': 'Australia', 'Australia/Perth': 'Australia',
        'Pacific/Auckland': 'New Zealand',
        'Africa/Cairo': 'Egypt', 'Africa/Lagos': 'Nigeria',
        'Africa/Johannesburg': 'South Africa', 'Africa/Nairobi': 'Kenya',
        'Africa/Casablanca': 'Morocco'
      };
      return map[tz] || 'Unknown';
    } catch(e) { return 'Unknown'; }
  }

  function send(endpoint, data, useBeacon) {
    try {
      var body = JSON.stringify(data);
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(serverUrl + endpoint, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(serverUrl + endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: body, keepalive: true
        }).catch(function(){});
      }
    } catch(e) {}
  }
  
  var userId = getUserId();
  var sessionId = getSessionId();
  var sessionStart = Date.now();
  var sessionStarted = !!sessionStorage.getItem('_analytics_session_active');
  var pvCount = parseInt(sessionStorage.getItem('_analytics_pageviews') || '0');
  var pageEntryTime = Date.now();
  var maxScrollDepth = 0;
  var scrollMilestones = { 25: false, 50: false, 75: false, 100: false };

  // Rage click detection state
  var clickLog = [];
  var lastClickTarget = null;
  var RAGE_CLICK_THRESHOLD = 3;
  var RAGE_CLICK_WINDOW = 1000;

  function getSelector(el) {
    if (!el || el === document.body || el === document.documentElement) return 'body';
    try {
      if (el.id) return '#' + el.id;
      var tag = el.tagName.toLowerCase();
      var cls = (el.className || '').toString().trim().split(/\\s+/).filter(Boolean).slice(0, 2).join('.');
      var parent = el.parentElement;
      var idx = '';
      if (parent) {
        var siblings = Array.from(parent.children).filter(function(c) { return c.tagName === el.tagName; });
        if (siblings.length > 1) idx = ':nth-child(' + (Array.from(parent.children).indexOf(el) + 1) + ')';
      }
      return tag + (cls ? '.' + cls : '') + idx;
    } catch(e) { return 'unknown'; }
  }

  function startSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    sessionStorage.setItem('_analytics_session_active', '1');
    sessionStorage.setItem('_analytics_entry_page', window.location.pathname);
    send('/api/track/session', {
      sessionId: sessionId, siteId: siteId, userId: userId,
      entryPage: window.location.pathname, exitPage: window.location.pathname,
      referrer: document.referrer || null,
      device: getDeviceType(), browser: getBrowser(), os: getOS(), country: getCountry(),
      duration: 0, pageviews: 1
    });
  }

  function trackPageview() {
    pvCount++;
    sessionStorage.setItem('_analytics_pageviews', pvCount.toString());
    send('/api/track/event', {
      siteId: siteId, userId: userId, sessionId: sessionId, type: 'pageview',
      url: window.location.href, path: window.location.pathname,
      referrer: document.referrer || '', device: getDeviceType(),
      browser: getBrowser(), os: getOS(), country: getCountry()
    });
    startSession();
  }

  function handleUnload() {
    var timeOnPage = Math.round((Date.now() - pageEntryTime) / 1000);
    // Send final scroll depth
    send('/api/track/event', {
      siteId: siteId, userId: userId, sessionId: sessionId, type: 'scroll_depth',
      url: window.location.href, path: window.location.pathname,
      properties: { depth: maxScrollDepth }
    }, true);
    // Send time on page
    send('/api/track/event', {
      siteId: siteId, userId: userId, sessionId: sessionId, type: 'time_on_page',
      url: window.location.href, path: window.location.pathname,
      properties: { seconds: timeOnPage }
    }, true);
    // End session
    var duration = Math.round((Date.now() - sessionStart) / 1000);
    send('/api/track/session', {
      sessionId: sessionId, siteId: siteId, userId: userId,
      entryPage: sessionStorage.getItem('_analytics_entry_page') || window.location.pathname,
      exitPage: window.location.pathname, referrer: document.referrer || null,
      device: getDeviceType(), browser: getBrowser(), os: getOS(), country: getCountry(),
      duration: duration, pageviews: pvCount
    }, true);
  }

  trackPageview();

  // Scroll tracking with milestones
  document.addEventListener('scroll', function() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight > 0) {
      var depth = Math.round((scrollTop / docHeight) * 100);
      maxScrollDepth = Math.max(maxScrollDepth, depth);
      [25, 50, 75, 100].forEach(function(milestone) {
        if (!scrollMilestones[milestone] && depth >= milestone) {
          scrollMilestones[milestone] = true;
          send('/api/track/event', {
            siteId: siteId, userId: userId, sessionId: sessionId, type: 'scroll_depth',
            url: window.location.href, path: window.location.pathname,
            properties: { depth: milestone, milestone: true }
          });
        }
      });
    }
  }, { passive: true });

  // Heatmap click tracking + rage click detection
  document.addEventListener('click', function(e) {
    var x = e.pageX;
    var y = e.pageY;
    var vpW = window.innerWidth;
    var docH = document.documentElement.scrollHeight;
    var selector = getSelector(e.target);

    // Heatmap click
    send('/api/track/event', {
      siteId: siteId, userId: userId, sessionId: sessionId, type: 'heatmap_click',
      url: window.location.href, path: window.location.pathname,
      properties: {
        x: x, y: y,
        relX: Math.round((x / vpW) * 1000) / 1000,
        relY: Math.round((y / docH) * 1000) / 1000,
        vpW: vpW, vpH: window.innerHeight, docH: docH,
        selector: selector
      }
    });

    // Rage click detection
    var now = Date.now();
    var target = e.target;
    if (target === lastClickTarget) {
      clickLog.push(now);
      clickLog = clickLog.filter(function(t) { return now - t < RAGE_CLICK_WINDOW; });
      if (clickLog.length >= RAGE_CLICK_THRESHOLD) {
        send('/api/track/event', {
          siteId: siteId, userId: userId, sessionId: sessionId, type: 'rage_click',
          url: window.location.href, path: window.location.pathname,
          properties: { selector: selector, count: clickLog.length, x: x, y: y }
        });
        clickLog = [];
      }
    } else {
      lastClickTarget = target;
      clickLog = [now];
    }
  });

  // Link/button click tracking
  document.addEventListener('click', function(e) {
    var el = e.target.closest('a, [data-track]');
    if (!el) return;
    var props = {};
    if (el.tagName === 'A') { props.href = el.href; props.text = (el.textContent || '').trim().substring(0, 100); }
    if (el.dataset && el.dataset.track) props.trackId = el.dataset.track;
    send('/api/track/event', {
      siteId: siteId, userId: userId, sessionId: sessionId, type: 'click',
      url: window.location.href, path: window.location.pathname, properties: props,
      device: getDeviceType(), browser: getBrowser(), os: getOS(), country: getCountry()
    });
  });
  
  window.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') handleUnload();
  });
  window.addEventListener('beforeunload', handleUnload);

  var pushState = history.pushState;
  history.pushState = function() {
    pushState.apply(history, arguments);
    trackPageview();
  };
  window.addEventListener('popstate', function() { trackPageview(); });
  
  window.analytics = {
    track: function(eventName, props) {
      send('/api/track/event', {
        siteId: siteId, userId: userId, sessionId: sessionId, type: eventName,
        url: window.location.href, path: window.location.pathname, properties: props || {},
        device: getDeviceType(), browser: getBrowser(), os: getOS(), country: getCountry()
      });
    },
    identify: function(uid) { localStorage.setItem('_analytics_uid', uid); }
  };

  // ─── Web Vitals (Performance Observer) ────────────────────────
  if (typeof PerformanceObserver !== 'undefined') {
    function reportVital(metric, value) {
      send('/api/track/event', {
        siteId: siteId, userId: userId, sessionId: sessionId, type: 'web_vital',
        url: window.location.href, path: window.location.pathname,
        properties: { metric: metric, value: value },
        device: getDeviceType(), browser: getBrowser(), os: getOS(), country: getCountry()
      });
    }

    try {
      new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(entry) {
          reportVital('LCP', Math.round(entry.startTime));
        });
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch(e) {}

    try {
      new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(entry) {
          reportVital('FID', Math.round(entry.processingStart - entry.startTime));
        });
      }).observe({ type: 'first-input', buffered: true });
    } catch(e) {}

    try {
      var clsValue = 0;
      new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(entry) {
          if (!entry.hadRecentInput) clsValue += entry.value;
        });
      }).observe({ type: 'layout-shift', buffered: true });
      window.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden' && clsValue > 0) {
          reportVital('CLS', Math.round(clsValue * 1000) / 1000);
        }
      });
    } catch(e) {}

    try {
      new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(entry) {
          reportVital('INP', Math.round(entry.duration));
        });
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    } catch(e) {}

    try {
      new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(entry) {
          reportVital('TTFB', Math.round(entry.responseStart));
        });
      }).observe({ type: 'navigation', buffered: true });
    } catch(e) {}
  }

  // ─── JS Error Tracking ────────────────────────────────────────
  window.addEventListener('error', function(e) {
    send('/api/track/event', {
      siteId: siteId, userId: userId, sessionId: sessionId, type: 'js_error',
      url: window.location.href, path: window.location.pathname,
      properties: {
        message: (e.message || '').substring(0, 500),
        source: (e.filename || '').substring(0, 200),
        line: e.lineno, col: e.colno
      },
      device: getDeviceType(), browser: getBrowser(), os: getOS(), country: getCountry()
    });
  });
  window.addEventListener('unhandledrejection', function(e) {
    var msg = e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled Promise Rejection';
    send('/api/track/event', {
      siteId: siteId, userId: userId, sessionId: sessionId, type: 'js_error',
      url: window.location.href, path: window.location.pathname,
      properties: { message: msg.substring(0, 500), source: 'promise' },
      device: getDeviceType(), browser: getBrowser(), os: getOS(), country: getCountry()
    });
  });

  // ─── Site Search Tracking ─────────────────────────────────────
  var searchDebounce = null;
  document.addEventListener('submit', function(e) {
    var form = e.target;
    var input = form.querySelector('input[type="search"], input[name="q"], input[name="query"], input[name="search"]');
    if (input && input.value.trim()) {
      send('/api/track/event', {
        siteId: siteId, userId: userId, sessionId: sessionId, type: 'site_search',
        url: window.location.href, path: window.location.pathname,
        properties: { query: input.value.trim().substring(0, 200) },
        device: getDeviceType(), browser: getBrowser(), os: getOS(), country: getCountry()
      });
    }
  });
})();`;
  }
};

export default sitesService;
