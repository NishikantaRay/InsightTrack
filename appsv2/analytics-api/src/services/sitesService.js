import { query } from '../db/postgres.js';
import { v4 as uuidv4 } from 'uuid';
import { getMemberRole, getSitesForUser, roleAtLeast } from './teamService.js';

export const sitesService = {
  async createSite(name, domain, userId) {
    // Check for existing site with same domain (global — one domain per platform)
    const existing = await query(
      `SELECT id FROM sites WHERE domain = $1 LIMIT 1`,
      [domain]
    );
    if (existing.rows.length > 0) {
      throw new Error(`A site with domain "${domain}" already exists (${existing.rows[0].id})`);
    }

    const id = `site_${uuidv4().slice(0, 8)}`;
    const result = await query(
      `INSERT INTO sites (id, user_id, name, domain, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, userId, name, domain, new Date().toISOString()]
    );
    const site = result.rows[0];

    // Create the owner membership row (site_members.user_id is NOT NULL, so
    // skip for ownerless calls — seed scripts and legacy 2-arg callers).
    if (userId != null) {
      await query(
        `INSERT INTO site_members (site_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [id, userId]
      );
    }

    return { ...site, user_role: 'owner' };
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
    // Return all sites the user is a member of (owned + shared)
    return getSitesForUser(userId);
  },

  async updateSite(siteId, name, domain, userId) {
    const existing = await this.getSiteById(siteId);
    if (!existing) return null;
    // Require at least admin role to update
    if (userId) {
      const role = await getMemberRole(siteId, userId);
      if (!roleAtLeast(role, 'admin')) return null;
    }
    const result = await query(
      `UPDATE sites SET name = $1, domain = $2 WHERE id = $3 RETURNING *`,
      [name || existing.name, domain || existing.domain, siteId]
    );
    return result.rows[0];
  },

  async deleteSite(siteId, userId) {
    const existing = await this.getSiteById(siteId);
    if (!existing) return { success: false };
    // Only owner can delete
    if (userId) {
      const role = await getMemberRole(siteId, userId);
      if (role !== 'owner') throw new Error('Only the site owner can delete a site');
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
    // How long a visitor id survives without a return visit. Bounds how far back
    // one visitor can be correlated; set VISITOR_ID_TTL_DAYS=0 to disable
    // rotation and keep the previous unbounded behaviour.
    const uidTtlDays = Number.isFinite(Number(process.env.VISITOR_ID_TTL_DAYS))
      ? Math.max(0, Number(process.env.VISITOR_ID_TTL_DAYS))
      : 180;
    return `(function() {
  var siteId = ${JSON.stringify(siteId)};
  var serverUrl = ${JSON.stringify(serverUrl)};

  // ── Privacy opt-out: Do Not Track / Global Privacy Control ──────────────────
  // Runs BEFORE any storage access or network request. When the visitor has
  // signalled opt-out we return immediately, so no visitor id, no session id and
  // no analytics request is ever created. Everything below this point — including
  // getUserId()/getSessionId() and the window.analytics helpers — is unreachable.
  //
  // Signals are read conservatively: only the explicit opt-out values count.
  // DNT "0", false, null, undefined and unrelated values are NOT opt-out.
  // navigator.doNotTrack is a STRING in every browser that ships it.
  //
  // This is a technical control that honours the browser signal. It is not, by
  // itself, a statement about legal compliance.
  try {
    var _dnt = navigator.doNotTrack === '1';
    var _gpc = navigator.globalPrivacyControl === true;
    if (_dnt || _gpc) {
      // Expose an inert stub so callers of window.analytics.track(...) on an
      // opted-out visitor get a no-op rather than a TypeError.
      window.analytics = {
        track: function() {},
        identify: function() {},
        optedOut: true
      };
      return;
    }
  } catch (e) {
    // navigator unavailable (non-browser host). Fall through to normal behaviour
    // rather than failing closed — this matches the pre-existing contract, and an
    // environment without navigator has no opt-out signal to honour.
  }

  // Visitor ID with a rolling expiry. Without one the identifier lives in
  // localStorage forever, so a visitor stays linkable across sessions
  // indefinitely. The stored value is JSON: { id, exp }. Passing exp mints a
  // fresh ID, which caps how far back any one visitor can be correlated.
  //
  // The window refreshes on each use, so a regular visitor is not re-counted as
  // new mid-stream; it only elapses after ${uidTtlDays} days with no visits.
  // A TTL of 0 disables rotation (ids then never expire).
  var UID_TTL_MS = ${uidTtlDays} * 24 * 60 * 60 * 1000;

  function newUid() {
    // crypto.randomUUID where available (collision-resistant); the previous
    // Math.random() form remains the fallback for older browsers.
    try {
      if (window.crypto && window.crypto.randomUUID) {
        return 'u_' + window.crypto.randomUUID().replace(/-/g, '').substr(0, 16);
      }
    } catch (e) {}
    return 'u_' + Math.random().toString(36).substr(2, 9);
  }

  function getUserId() {
    var now = Date.now();
    var raw = null;
    try { raw = localStorage.getItem('_analytics_uid'); } catch (e) { return newUid(); }

    if (raw) {
      // Values written before rotation existed are bare strings, not JSON.
      // Adopt them once and attach an expiry rather than resetting the visitor.
      if (raw.charAt(0) !== '{') {
        var migrated = { id: raw, exp: now + UID_TTL_MS };
        try { localStorage.setItem('_analytics_uid', JSON.stringify(migrated)); } catch (e) {}
        return raw;
      }
      try {
        var rec = JSON.parse(raw);
        if (rec && rec.id && (UID_TTL_MS === 0 || (rec.exp && now < rec.exp))) {
          if (UID_TTL_MS > 0) {
            rec.exp = now + UID_TTL_MS;   // sliding window
            try { localStorage.setItem('_analytics_uid', JSON.stringify(rec)); } catch (e) {}
          }
          return rec.id;
        }
      } catch (e) { /* corrupt value — fall through and mint a new one */ }
    }

    var fresh = { id: newUid(), exp: now + UID_TTL_MS };
    try { localStorage.setItem('_analytics_uid', JSON.stringify(fresh)); } catch (e) {}
    return fresh.id;
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
      // Primary: timezone-based detection (most geographically accurate)
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      var tzMap = {
        'America/New_York': 'United States', 'America/Chicago': 'United States',
        'America/Los_Angeles': 'United States', 'America/Denver': 'United States',
        'America/Phoenix': 'United States', 'America/Anchorage': 'United States',
        'America/Boise': 'United States', 'America/Detroit': 'United States',
        'America/Indiana/Indianapolis': 'United States',
        'Pacific/Honolulu': 'United States',
        'America/Nome': 'United States', 'America/Sitka': 'United States',
        'America/Juneau': 'United States', 'America/Yakutat': 'United States',
        'America/Adak': 'United States', 'America/Metlakatla': 'United States',
        'America/Indiana/Knox': 'United States', 'America/Indiana/Marengo': 'United States',
        'America/Indiana/Petersburg': 'United States', 'America/Indiana/Tell_City': 'United States',
        'America/Indiana/Vevay': 'United States', 'America/Indiana/Vincennes': 'United States',
        'America/Indiana/Winamac': 'United States', 'America/Kentucky/Louisville': 'United States',
        'America/Kentucky/Monticello': 'United States', 'America/North_Dakota/Beulah': 'United States',
        'America/North_Dakota/Center': 'United States', 'America/North_Dakota/New_Salem': 'United States',
        'America/Toronto': 'Canada', 'America/Vancouver': 'Canada',
        'America/Edmonton': 'Canada', 'America/Winnipeg': 'Canada',
        'America/Halifax': 'Canada', 'America/St_Johns': 'Canada',
        'America/Mexico_City': 'Mexico', 'America/Tijuana': 'Mexico', 'America/Cancun': 'Mexico',
        'America/Monterrey': 'Mexico', 'America/Merida': 'Mexico', 'America/Hermosillo': 'Mexico',
        'America/Mazatlan': 'Mexico', 'America/Chihuahua': 'Mexico', 'America/Ojinaga': 'Mexico',
        'America/Bahia_Banderas': 'Mexico',
        'America/Sao_Paulo': 'Brazil', 'America/Fortaleza': 'Brazil', 'America/Manaus': 'Brazil',
        'America/Recife': 'Brazil', 'America/Belem': 'Brazil', 'America/Maceio': 'Brazil',
        'America/Porto_Velho': 'Brazil', 'America/Boa_Vista': 'Brazil',
        'America/Campo_Grande': 'Brazil', 'America/Cuiaba': 'Brazil',
        'America/Porto_Acre': 'Brazil', 'America/Rio_Branco': 'Brazil', 'America/Noronha': 'Brazil',
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
        'Europe/Kiev': 'Ukraine', 'Europe/Kyiv': 'Ukraine', 'Europe/Simferopol': 'Ukraine',
        'Europe/Moscow': 'Russia', 'Europe/Minsk': 'Belarus',
        'Europe/Kaliningrad': 'Russia', 'Europe/Samara': 'Russia',
        'Europe/Ulyanovsk': 'Russia', 'Europe/Volgograd': 'Russia',
        'Europe/Saratov': 'Russia', 'Europe/Astrakhan': 'Russia',
        'Europe/Ufa': 'Russia', 'Europe/Kirov': 'Russia',
        'Europe/Belgrade': 'Serbia', 'Europe/Zagreb': 'Croatia',
        'Europe/Ljubljana': 'Slovenia', 'Europe/Bratislava': 'Slovakia',
        'Europe/Luxembourg': 'Luxembourg', 'Europe/Malta': 'Malta',
        'Europe/Sarajevo': 'Bosnia and Herzegovina',
        'Europe/Tirane': 'Albania', 'Europe/Skopje': 'North Macedonia',
        'Europe/Istanbul': 'Turkey',
        'Asia/Kolkata': 'India', 'Asia/Calcutta': 'India',
        'Asia/Colombo': 'Sri Lanka', 'Asia/Kathmandu': 'Nepal', 'Asia/Dhaka': 'Bangladesh',
        'Asia/Karachi': 'Pakistan', 'Asia/Kabul': 'Afghanistan',
        'Asia/Tokyo': 'Japan', 'Asia/Seoul': 'South Korea',
        'Asia/Shanghai': 'China', 'Asia/Chongqing': 'China', 'Asia/Harbin': 'China',
        'Asia/Urumqi': 'China', 'Asia/Kashgar': 'China', 'Asia/Beijing': 'China',
        'Asia/Chungking': 'China', 'PRC': 'China',
        'Asia/Hong_Kong': 'Hong Kong', 'Asia/Macau': 'Macau', 'Asia/Macao': 'Macau',
        'Asia/Taipei': 'Taiwan', 'Asia/Singapore': 'Singapore',
        'Asia/Kuala_Lumpur': 'Malaysia', 'Asia/Bangkok': 'Thailand',
        'Asia/Ho_Chi_Minh': 'Vietnam', 'Asia/Vientiane': 'Laos',
        'Asia/Phnom_Penh': 'Cambodia', 'Asia/Yangon': 'Myanmar', 'Asia/Rangoon': 'Myanmar',
        'Asia/Jakarta': 'Indonesia', 'Asia/Makassar': 'Indonesia',
        'Asia/Jayapura': 'Indonesia', 'Asia/Pontianak': 'Indonesia', 'Asia/Ujung_Pandang': 'Indonesia',
        'Asia/Manila': 'Philippines', 'Asia/Brunei': 'Brunei', 'Asia/Dili': 'East Timor',
        'Asia/Tashkent': 'Uzbekistan', 'Asia/Samarkand': 'Uzbekistan',
        'Asia/Almaty': 'Kazakhstan', 'Asia/Tbilisi': 'Georgia',
        'Asia/Yerevan': 'Armenia', 'Asia/Baku': 'Azerbaijan',
        'Asia/Ashgabat': 'Turkmenistan', 'Asia/Bishkek': 'Kyrgyzstan',
        'Asia/Dushanbe': 'Tajikistan',
        'Asia/Dubai': 'United Arab Emirates', 'Asia/Riyadh': 'Saudi Arabia',
        'Asia/Qatar': 'Qatar', 'Asia/Bahrain': 'Bahrain', 'Asia/Kuwait': 'Kuwait',
        'Asia/Muscat': 'Oman', 'Asia/Baghdad': 'Iraq', 'Asia/Tehran': 'Iran',
        'Asia/Jerusalem': 'Israel', 'Asia/Amman': 'Jordan',
        'Asia/Beirut': 'Lebanon', 'Asia/Damascus': 'Syria', 'Asia/Nicosia': 'Cyprus',
        'Asia/Aden': 'Yemen',
        'Asia/Novokuznetsk': 'Russia', 'Asia/Novosibirsk': 'Russia',
        'Asia/Yekaterinburg': 'Russia', 'Asia/Omsk': 'Russia',
        'Asia/Krasnoyarsk': 'Russia', 'Asia/Irkutsk': 'Russia',
        'Asia/Yakutsk': 'Russia', 'Asia/Vladivostok': 'Russia',
        'Asia/Sakhalin': 'Russia', 'Asia/Magadan': 'Russia',
        'Asia/Kamchatka': 'Russia', 'Asia/Anadyr': 'Russia',
        'Africa/Cairo': 'Egypt', 'Africa/Lagos': 'Nigeria', 'Africa/Nairobi': 'Kenya',
        'Africa/Johannesburg': 'South Africa', 'Africa/Casablanca': 'Morocco',
        'Africa/Algiers': 'Algeria', 'Africa/Tunis': 'Tunisia', 'Africa/Accra': 'Ghana',
        'Africa/Addis_Ababa': 'Ethiopia', 'Africa/Dar_es_Salaam': 'Tanzania',
        'Africa/Kampala': 'Uganda', 'Africa/Khartoum': 'Sudan',
        'Africa/Maputo': 'Mozambique', 'Africa/Lusaka': 'Zambia',
        'Africa/Harare': 'Zimbabwe', 'Africa/Abidjan': 'Ivory Coast', 'Africa/Dakar': 'Senegal',
        'Australia/Sydney': 'Australia', 'Australia/Melbourne': 'Australia',
        'Australia/Brisbane': 'Australia', 'Australia/Perth': 'Australia',
        'Australia/Adelaide': 'Australia', 'Australia/Hobart': 'Australia',
        'Pacific/Auckland': 'New Zealand', 'Pacific/Fiji': 'Fiji',
        'Pacific/Guam': 'Guam', 'Pacific/Port_Moresby': 'Papua New Guinea',
        'Atlantic/Reykjavik': 'Iceland',
      };
      if (tz && tzMap[tz]) return tzMap[tz];
      // Fallback: extract region from browser locale (e.g. "en-IN" → "IN" → "India")
      // Only trust locale for non-ambiguous regional codes (not generic en-GB for non-UK users)
      var iso2map = {
        'AF':'Afghanistan','AL':'Albania','DZ':'Algeria','AR':'Argentina','AM':'Armenia',
        'AU':'Australia','AT':'Austria','AZ':'Azerbaijan','BH':'Bahrain','BD':'Bangladesh',
        'BY':'Belarus','BE':'Belgium','BO':'Bolivia','BA':'Bosnia and Herzegovina',
        'BR':'Brazil','BG':'Bulgaria','KH':'Cambodia','CA':'Canada','CL':'Chile',
        'CN':'China','CO':'Colombia','CR':'Costa Rica','HR':'Croatia','CU':'Cuba',
        'CY':'Cyprus','CZ':'Czech Republic','DK':'Denmark','DO':'Dominican Republic',
        'EC':'Ecuador','EG':'Egypt','EE':'Estonia','ET':'Ethiopia','FI':'Finland',
        'FR':'France','GE':'Georgia','DE':'Germany','GH':'Ghana','GR':'Greece',
        'GT':'Guatemala','HT':'Haiti','HN':'Honduras','HK':'Hong Kong','HU':'Hungary',
        'IS':'Iceland','IN':'India','ID':'Indonesia','IR':'Iran','IQ':'Iraq',
        'IE':'Ireland','IL':'Israel','IT':'Italy','CI':'Ivory Coast','JM':'Jamaica',
        'JP':'Japan','JO':'Jordan','KZ':'Kazakhstan','KE':'Kenya','KW':'Kuwait',
        'LV':'Latvia','LB':'Lebanon','LT':'Lithuania','LU':'Luxembourg','MO':'Macau',
        'MY':'Malaysia','MT':'Malta','MX':'Mexico','MA':'Morocco','MZ':'Mozambique',
        'MM':'Myanmar','NP':'Nepal','NL':'Netherlands','NZ':'New Zealand',
        'NG':'Nigeria','MK':'North Macedonia','NO':'Norway','OM':'Oman','PK':'Pakistan',
        'PA':'Panama','PG':'Papua New Guinea','PY':'Paraguay','PE':'Peru',
        'PH':'Philippines','PL':'Poland','PT':'Portugal','QA':'Qatar','RO':'Romania',
        'RU':'Russia','SA':'Saudi Arabia','SN':'Senegal','RS':'Serbia','SG':'Singapore',
        'SK':'Slovakia','SI':'Slovenia','ZA':'South Africa','KR':'South Korea',
        'ES':'Spain','LK':'Sri Lanka','SD':'Sudan','SE':'Sweden','CH':'Switzerland',
        'SY':'Syria','TW':'Taiwan','TZ':'Tanzania','TH':'Thailand','TN':'Tunisia',
        'TR':'Turkey','TM':'Turkmenistan','UG':'Uganda','UA':'Ukraine',
        'AE':'United Arab Emirates','GB':'United Kingdom','US':'United States',
        'UY':'Uruguay','UZ':'Uzbekistan','VE':'Venezuela','VN':'Vietnam',
        'YE':'Yemen','ZM':'Zambia','ZW':'Zimbabwe',
      };
      var lang = (navigator.language || (navigator.languages && navigator.languages[0]) || '');
      if (lang.indexOf('-') !== -1) {
        try {
          var region = new Intl.Locale(lang).region;
          if (region && iso2map[region.toUpperCase()]) return iso2map[region.toUpperCase()];
        } catch(le) {}
      }
      // Fallback: derive from locale tag directly (e.g. "zh-CN" → "CN")
      var parts = lang.split('-');
      if (parts.length >= 2) {
        var code = parts[parts.length - 1].toUpperCase();
        if (iso2map[code]) return iso2map[code];
      }
      return 'Unknown';
    } catch(e) { return 'Unknown'; }
  }

  function send(endpoint, data, useBeacon) {
    useBeacon = useBeacon || false;
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
  
  var _pageStart = Date.now();
  trackPageview();

  // ── Time on Page ───────────────────────────────────────────────
  function _sendTimeOnPage() {
    var secs = Math.round((Date.now() - _pageStart) / 1000);
    if (secs > 0) send('/api/track/event', {
      siteId: siteId, userId: userId, sessionId: sessionId, type: 'time_on_page',
      url: window.location.href, path: window.location.pathname,
      properties: { seconds: secs }
    }, true);
  }

  window.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') { endSession(); _sendTimeOnPage(); }
  });
  window.addEventListener('beforeunload', endSession);

  document.addEventListener('click', function(e) {
    var t = e.target;
    var el = t.closest('button, a, input[type="submit"], input[type="button"], [role="button"], [data-track]') || t;
    // Build a short CSS selector: tag#id or tag.class1.class2
    var sel = el.tagName.toLowerCase();
    if (el.id) {
      sel += '#' + el.id;
    } else if (el.className && typeof el.className === 'string' && el.className.trim()) {
      sel += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    }
    // Label for the clicked element. Deliberately never reads a form control's
    // entered value: on a populated input that is whatever the visitor typed
    // (search terms, an email, a form entry), which must not leave the page.
    // For form controls we use the accessible label or the field's name — both
    // authored by the site, not entered by the visitor.
    var _tag = el.tagName.toLowerCase();
    var text = (_tag === 'input' || _tag === 'textarea' || _tag === 'select')
      ? (el.getAttribute('aria-label') || el.getAttribute('name') || '')
      : (el.innerText || el.getAttribute('aria-label') || '');
    text = String(text).trim().substring(0, 100);
    var relX = Math.round((e.clientX / window.innerWidth) * 100);
    var relY = Math.round((e.clientY / window.innerHeight) * 100);
    var props = {
      selector: sel,
      text: text,
      tag: el.tagName.toLowerCase(),
      relX: relX,
      relY: relY,
      x: e.clientX,
      y: e.clientY
    };
    if (el.tagName === 'A') props.href = el.href;
    if (el.dataset && el.dataset.track) props.trackId = el.dataset.track;
    send('/api/track/event', {
      siteId: siteId, userId: userId, sessionId: sessionId, type: 'heatmap_click',
      url: window.location.href, path: window.location.pathname, properties: props
    });
  });

  // ── Rage click detection ────────────────────────────────────────
  var _rageClicks = {};
  document.addEventListener('click', function(e) {
    var t = e.target;
    var el = t.closest('button, a, input[type="submit"], [role="button"], [data-track]') || t;
    var sel = el.tagName.toLowerCase();
    if (el.id) sel += '#' + el.id;
    else if (el.className && typeof el.className === 'string' && el.className.trim()) sel += '.' + el.className.trim().split(/\s+/)[0];
    var key = window.location.pathname + '|' + sel;
    var now = Date.now();
    if (!_rageClicks[key]) _rageClicks[key] = { times: [], sent: false };
    var entry = _rageClicks[key];
    entry.times.push(now);
    entry.times = entry.times.filter(function(t) { return now - t < 1000; });
    if (entry.times.length >= 3 && !entry.sent) {
      entry.sent = true;
      send('/api/track/event', {
        siteId: siteId, userId: userId, sessionId: sessionId, type: 'rage_click',
        url: window.location.href, path: window.location.pathname,
        properties: { selector: sel, count: entry.times.length }
      });
      setTimeout(function() { if (_rageClicks[key]) _rageClicks[key].sent = false; }, 5000);
    }
  });

  // ── Scroll depth milestones ─────────────────────────────────────
  var _scrollMilestones = { 25: false, 50: false, 75: false, 100: false };
  window.addEventListener('scroll', function() {
    var el = document.documentElement;
    var scrolled = el.scrollTop + window.innerHeight;
    var total = el.scrollHeight;
    if (total <= window.innerHeight) return;
    var pct = Math.round((scrolled / total) * 100);
    [25, 50, 75, 100].forEach(function(m) {
      if (pct >= m && !_scrollMilestones[m]) {
        _scrollMilestones[m] = true;
        send('/api/track/event', {
          siteId: siteId, userId: userId, sessionId: sessionId, type: 'scroll_depth',
          url: window.location.href, path: window.location.pathname,
          properties: { depth: m, milestone: 'true' }
        });
      }
    });
  }, { passive: true });

  // ── Web Vitals ─────────────────────────────────────────────────
  try {
    var nav = performance.getEntriesByType('navigation')[0];
    if (nav) send('/api/track/event', {
      siteId: siteId, userId: userId, sessionId: sessionId, type: 'web_vital',
      url: window.location.href, path: window.location.pathname,
      properties: { name: 'TTFB', value: Math.round(nav.responseStart), rating: nav.responseStart < 800 ? 'good' : nav.responseStart < 1800 ? 'needs-improvement' : 'poor' }
    });
    var clsValue = 0, inpMax = 0;
    if (window.PerformanceObserver) {
      new PerformanceObserver(function(list) {
        var entries = list.getEntries(), last = entries[entries.length - 1];
        if (last) send('/api/track/event', {
          siteId: siteId, userId: userId, sessionId: sessionId, type: 'web_vital',
          url: window.location.href, path: window.location.pathname,
          properties: { name: 'LCP', value: Math.round(last.startTime), rating: last.startTime < 2500 ? 'good' : last.startTime < 4000 ? 'needs-improvement' : 'poor' }
        });
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(e) { if (!e.hadRecentInput) clsValue += e.value; });
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(function(list) {
        var e = list.getEntries()[0]; if (!e) return;
        var fid = e.processingStart - e.startTime;
        send('/api/track/event', {
          siteId: siteId, userId: userId, sessionId: sessionId, type: 'web_vital',
          url: window.location.href, path: window.location.pathname,
          properties: { name: 'FID', value: Math.round(fid), rating: fid < 100 ? 'good' : fid < 300 ? 'needs-improvement' : 'poor' }
        });
      }).observe({ type: 'first-input', buffered: true });
      try {
        new PerformanceObserver(function(list) {
          list.getEntries().forEach(function(e) { var d = e.processingEnd - e.startTime; if (d > inpMax) inpMax = d; });
        }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
      } catch(e) {}
      window.addEventListener('visibilitychange', function() {
        if (document.visibilityState !== 'hidden') return;
        if (clsValue > 0) send('/api/track/event', {
          siteId: siteId, userId: userId, sessionId: sessionId, type: 'web_vital',
          url: window.location.href, path: window.location.pathname,
          properties: { name: 'CLS', value: Math.round(clsValue * 1000) / 1000, rating: clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor' }
        });
        if (inpMax > 0) send('/api/track/event', {
          siteId: siteId, userId: userId, sessionId: sessionId, type: 'web_vital',
          url: window.location.href, path: window.location.pathname,
          properties: { name: 'INP', value: Math.round(inpMax), rating: inpMax < 200 ? 'good' : inpMax < 500 ? 'needs-improvement' : 'poor' }
        });
      });
    }
  } catch(e) {}
  // ── JS Error tracking ─────────────────────────────────────────
  window.addEventListener('error', function(evt) {
    send('/api/track/event', {
      siteId: siteId, userId: userId, sessionId: sessionId, type: 'js_error',
      url: window.location.href, path: window.location.pathname,
      properties: { message: (evt.message || '').substring(0, 200), source: (evt.filename || '').substring(0, 200), line: evt.lineno, col: evt.colno }
    });
  });
  window.addEventListener('unhandledrejection', function(evt) {
    var msg = evt.reason && evt.reason.message ? evt.reason.message : String(evt.reason);
    send('/api/track/event', {
      siteId: siteId, userId: userId, sessionId: sessionId, type: 'js_error',
      url: window.location.href, path: window.location.pathname,
      properties: { message: ('Unhandled: ' + msg).substring(0, 200) }
    });
  });

  var pushState = history.pushState;
  history.pushState = function() {
    pushState.apply(history, arguments);
    trackPageview();
    detectSiteSearch();
  };
  window.addEventListener('popstate', function() { trackPageview(); detectSiteSearch(); });

  // ── Site Search detection ──────────────────────────────────────────────────
  // 1) Detect search query params in the current URL on every page load/navigation
  // 2) Intercept form submissions that contain a search input
  var _searchParams = ['q', 'query', 'search', 's', 'keyword', 'keywords', 'term', 'text', 'find'];
  var _lastSearchUrl = null;

  function detectSiteSearch() {
    try {
      var params = new URLSearchParams(window.location.search);
      for (var i = 0; i < _searchParams.length; i++) {
        var val = params.get(_searchParams[i]);
        if (val && val.trim()) {
          var key = window.location.pathname + '?' + _searchParams[i] + '=' + val.trim().toLowerCase();
          if (key === _lastSearchUrl) return;
          _lastSearchUrl = key;
          send('/api/track/event', {
            siteId: siteId, userId: userId, sessionId: sessionId, type: 'site_search',
            url: window.location.href, path: window.location.pathname,
            properties: { query: val.trim(), param: _searchParams[i] }
          });
          return;
        }
      }
    } catch(e) {}
  }

  document.addEventListener('submit', function(e) {
    try {
      var form = e.target;
      if (!form || form.tagName !== 'FORM') return;
      var input = form.querySelector(
        'input[type="search"], input[name="q"], input[name="query"], input[name="search"], input[name="s"], input[name="keyword"], input[name="keywords"], input[name="term"]'
      );
      if (!input || !input.value.trim()) return;
      send('/api/track/event', {
        siteId: siteId, userId: userId, sessionId: sessionId, type: 'site_search',
        url: window.location.href, path: window.location.pathname,
        properties: { query: input.value.trim(), param: input.name || 'q' }
      });
    } catch(e) {}
  });

  detectSiteSearch();
  // ──────────────────────────────────────────────────────────────────────────
  
  window.analytics = {
    track: function(eventName, props) {
      send('/api/track/event', {
        siteId: siteId, userId: userId, sessionId: sessionId, type: eventName,
        url: window.location.href, path: window.location.pathname, properties: props || {}
      });
    },
    // Replaces the pseudonymous visitor ID with one you supply.
    //
    // NOTE: passing a direct identifier (email address, account ID, username)
    // makes every subsequent event directly attributable to a named person
    // rather than pseudonymous. Prefer an opaque internal ID that cannot be
    // resolved to a person without your own systems.
    identify: function(uid) {
      if (uid == null || uid === '') return;
      try {
        localStorage.setItem('_analytics_uid', JSON.stringify({
          id: String(uid), exp: Date.now() + UID_TTL_MS
        }));
      } catch (e) {}
    },
    // Deterministic A/B variant assignment.
    //
    //   var v = window.analytics.getVariant('checkout_copy', ['a', 'b']);
    //
    // The variant is derived by hashing the visitor id with the test id, so the
    // same visitor always sees the same variant with no server round-trip and no
    // flash of the wrong content. Assignment is reported once per session as an
    // experiment_view event carrying { test, variant }, which is what the
    // results query groups by.
    //
    // Note the visitor id rotates on its TTL, so a visitor returning after the
    // window elapses may be reassigned. For short tests this is immaterial; for
    // long-running ones it biases toward the control over time.
    getVariant: function(testId, variants) {
      if (!testId || !variants || !variants.length) return null;
      // FNV-1a over (visitorId + testId) — small, fast, well-distributed.
      var str = String(userId) + ':' + String(testId);
      var h = 2166136261;
      for (var i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
      }
      var chosen = variants[h % variants.length];

      // Report the exposure once per session, not per call.
      try {
        var seenKey = '_ab_' + testId;
        if (sessionStorage.getItem(seenKey) !== String(chosen)) {
          sessionStorage.setItem(seenKey, String(chosen));
          send('/api/track/event', {
            siteId: siteId, userId: userId, sessionId: sessionId, type: 'experiment_view',
            url: window.location.href, path: window.location.pathname,
            properties: { test: String(testId), variant: String(chosen) }
          });
        }
      } catch (e) { /* sessionStorage unavailable — assignment still works */ }

      return chosen;
    }
  };
})();`;
  },
};

export default sitesService;
