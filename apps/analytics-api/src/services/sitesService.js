import { query } from '../db/postgres.js';
import { v4 as uuidv4 } from 'uuid';

export const sitesService = {
  async createSite(name, domain, userId) {
    // Check for existing site with same domain for this user
    const existing = await query(
      `SELECT id FROM sites WHERE domain = $1 AND user_id = $2 LIMIT 1`,
      [domain, userId]
    );
    if (existing.rows.length > 0) {
      throw new Error(`A site with domain "${domain}" already exists (${existing.rows[0].id})`);
    }

    const id = `site_${uuidv4().slice(0, 8)}`;
    const result = await query(
      `INSERT INTO sites (id, user_id, name, domain, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, userId, name, domain, new Date().toISOString()]
    );
    return result.rows[0];
  },

  async getSiteById(siteId) {
    const result = await query(`SELECT * FROM sites WHERE id = $1 LIMIT 1`, [siteId]);
    return result.rows[0] || null;
  },

  async getAllSites(userId) {
    if (!userId) {
      const result = await query(`SELECT * FROM sites ORDER BY created_at DESC`);
      return result.rows;
    }
    const result = await query(`SELECT * FROM sites WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
    return result.rows;
  },

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

  async deleteSite(siteId, userId) {
    const existing = await this.getSiteById(siteId);
    if (!existing) return { success: false };
    if (userId && existing.user_id !== userId) {
      throw new Error('You do not own this site');
    }
    await query(`DELETE FROM events WHERE site_id = $1`, [siteId]);
    await query(`DELETE FROM sessions WHERE site_id = $1`, [siteId]);
    await query(`DELETE FROM sites WHERE id = $1`, [siteId]);
    return { success: true };
  },

  getTrackingScript(siteId, serverUrl = process.env.SERVER_URL || 'http://localhost:3001') {
    return `<script src="${serverUrl}/api/sites/${siteId}/script"></script>`;
  },

  getRawTrackingScript(siteId, serverUrl = process.env.SERVER_URL || 'http://localhost:3001') {
    return `(function() {
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
        'America/Indiana/Indianapolis': 'United States',
        'Pacific/Honolulu': 'United States',
        'America/Toronto': 'Canada', 'America/Vancouver': 'Canada',
        'America/Edmonton': 'Canada', 'America/Winnipeg': 'Canada',
        'America/Halifax': 'Canada', 'America/St_Johns': 'Canada',
        'America/Mexico_City': 'Mexico', 'America/Tijuana': 'Mexico',
        'America/Cancun': 'Mexico',
        'America/Sao_Paulo': 'Brazil', 'America/Fortaleza': 'Brazil',
        'America/Manaus': 'Brazil', 'America/Recife': 'Brazil',
        'America/Argentina/Buenos_Aires': 'Argentina',
        'America/Santiago': 'Chile', 'America/Bogota': 'Colombia',
        'America/Lima': 'Peru', 'America/Caracas': 'Venezuela',
        'America/Guayaquil': 'Ecuador', 'America/La_Paz': 'Bolivia',
        'America/Montevideo': 'Uruguay', 'America/Asuncion': 'Paraguay',
        'America/Costa_Rica': 'Costa Rica', 'America/Panama': 'Panama',
        'America/Guatemala': 'Guatemala', 'America/Havana': 'Cuba',
        'America/Port-au-Prince': 'Haiti', 'America/Santo_Domingo': 'Dominican Republic',
        'America/Jamaica': 'Jamaica',
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
        'Europe/Copenhagen': 'Denmark', 'Europe/Tallinn': 'Estonia',
        'Europe/Riga': 'Latvia', 'Europe/Vilnius': 'Lithuania',
        'Europe/Kiev': 'Ukraine', 'Europe/Kyiv': 'Ukraine',
        'Europe/Moscow': 'Russia', 'Europe/Minsk': 'Belarus',
        'Europe/Belgrade': 'Serbia', 'Europe/Zagreb': 'Croatia',
        'Europe/Ljubljana': 'Slovenia', 'Europe/Bratislava': 'Slovakia',
        'Europe/Luxembourg': 'Luxembourg', 'Europe/Malta': 'Malta',
        'Europe/Sarajevo': 'Bosnia and Herzegovina',
        'Europe/Tirane': 'Albania', 'Europe/Skopje': 'North Macedonia',
        'Europe/Istanbul': 'Turkey',
        'Asia/Kolkata': 'India', 'Asia/Calcutta': 'India',
        'Asia/Colombo': 'Sri Lanka',
        'Asia/Tokyo': 'Japan', 'Asia/Shanghai': 'China',
        'Asia/Chongqing': 'China', 'Asia/Hong_Kong': 'Hong Kong',
        'Asia/Taipei': 'Taiwan', 'Asia/Seoul': 'South Korea',
        'Asia/Singapore': 'Singapore', 'Asia/Kuala_Lumpur': 'Malaysia',
        'Asia/Bangkok': 'Thailand', 'Asia/Ho_Chi_Minh': 'Vietnam',
        'Asia/Jakarta': 'Indonesia', 'Asia/Makassar': 'Indonesia',
        'Asia/Manila': 'Philippines', 'Asia/Yangon': 'Myanmar',
        'Asia/Dhaka': 'Bangladesh', 'Asia/Karachi': 'Pakistan',
        'Asia/Kathmandu': 'Nepal', 'Asia/Tashkent': 'Uzbekistan',
        'Asia/Almaty': 'Kazakhstan', 'Asia/Tbilisi': 'Georgia',
        'Asia/Yerevan': 'Armenia', 'Asia/Baku': 'Azerbaijan',
        'Asia/Dubai': 'United Arab Emirates', 'Asia/Riyadh': 'Saudi Arabia',
        'Asia/Qatar': 'Qatar', 'Asia/Bahrain': 'Bahrain',
        'Asia/Kuwait': 'Kuwait', 'Asia/Muscat': 'Oman',
        'Asia/Baghdad': 'Iraq', 'Asia/Tehran': 'Iran',
        'Asia/Jerusalem': 'Israel', 'Asia/Amman': 'Jordan',
        'Asia/Beirut': 'Lebanon', 'Asia/Damascus': 'Syria',
        'Asia/Nicosia': 'Cyprus',
        'Africa/Cairo': 'Egypt', 'Africa/Lagos': 'Nigeria',
        'Africa/Nairobi': 'Kenya', 'Africa/Johannesburg': 'South Africa',
        'Africa/Casablanca': 'Morocco', 'Africa/Algiers': 'Algeria',
        'Africa/Tunis': 'Tunisia', 'Africa/Accra': 'Ghana',
        'Africa/Addis_Ababa': 'Ethiopia', 'Africa/Dar_es_Salaam': 'Tanzania',
        'Africa/Kampala': 'Uganda', 'Africa/Khartoum': 'Sudan',
        'Africa/Maputo': 'Mozambique', 'Africa/Lusaka': 'Zambia',
        'Africa/Harare': 'Zimbabwe', 'Africa/Abidjan': 'Ivory Coast',
        'Africa/Dakar': 'Senegal',
        'Australia/Sydney': 'Australia', 'Australia/Melbourne': 'Australia',
        'Australia/Brisbane': 'Australia', 'Australia/Perth': 'Australia',
        'Australia/Adelaide': 'Australia', 'Australia/Hobart': 'Australia',
        'Pacific/Auckland': 'New Zealand', 'Pacific/Fiji': 'Fiji',
        'Pacific/Guam': 'Guam', 'Pacific/Port_Moresby': 'Papua New Guinea',
        'Atlantic/Reykjavik': 'Iceland'
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

  function endSession() {
    var duration = Math.round((Date.now() - sessionStart) / 1000);
    send('/api/track/session/end', { sessionId: sessionId, duration: duration, exitPage: window.location.pathname }, true);
  }
  
  trackPageview();
  
  window.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') endSession();
  });
  window.addEventListener('beforeunload', endSession);

  document.addEventListener('click', function(e) {
    var el = e.target.closest('a, [data-track]');
    if (!el) return;
    var props = {};
    if (el.tagName === 'A') { props.href = el.href; props.text = (el.textContent || '').trim().substring(0, 100); }
    if (el.dataset && el.dataset.track) props.trackId = el.dataset.track;
    send('/api/track/event', {
      siteId: siteId, userId: userId, sessionId: sessionId, type: 'click',
      url: window.location.href, path: window.location.pathname, properties: props
    });
  });
  
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
        url: window.location.href, path: window.location.pathname, properties: props || {}
      });
    },
    identify: function(uid) { localStorage.setItem('_analytics_uid', uid); }
  };
})();`;
  },
};

export default sitesService;
