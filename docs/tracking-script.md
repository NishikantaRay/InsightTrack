# Tracking Script Guide

InsightTrack provides an auto-generated tracking script for each website you add. The script handles pageviews, sessions, clicks, browser/device detection, and country identification.

## Installation

### Option 1: External Script Tag (Recommended)

Add this to the `<head>` of every page on your site:

```html
<script src="http://YOUR_SERVER:3001/api/sites/YOUR_SITE_ID/script"></script>
```

Replace `YOUR_SITE_ID` with the site ID shown in Settings after creating a site.

### Option 2: HTML Snippet

Copy the inline snippet from **Settings → Tracking Snippet** and paste it before the closing `</body>` tag.

## What Gets Tracked

| Data Point        | How It's Collected                                |
|-------------------|---------------------------------------------------|
| Page URL & path   | `window.location.href` / `pathname`               |
| Referrer          | `document.referrer`                                |
| Browser & OS      | `navigator.userAgent` (parsed)                     |
| Device type       | Screen width heuristics (mobile/tablet/desktop)    |
| Country           | Timezone-based (`Intl.DateTimeFormat`)             |
| Session           | Auto-created, stored in `sessionStorage`           |
| User ID           | Anonymous UUID in `localStorage`                   |
| Click events      | Outbound link clicks (automatic)                   |
| Scroll depth      | Milestones at 25/50/75/100% of page scrolled       |
| Time on page      | Seconds spent per page (sent on unload)            |
| Heatmap clicks    | x/y coordinates + CSS selector of every click      |
| Rage clicks       | 3+ rapid clicks on same element within 1 second    |
| Web Vitals        | LCP, FID, CLS, INP, TTFB via PerformanceObserver   |
| JS errors         | `window.onerror` + `unhandledrejection` capture     |
| Site search       | Form submit interception for search queries         |

## How Sessions Work

- A new session is created when `sessionStorage` doesn't have a session ID
- If a user navigates away and comes back in the same tab, the session continues
- Closing the tab/browser ends the session
- Session duration is calculated as `last_event_time - first_event_time`

## SPA Support

The tracking script detects Single Page Applications automatically by listening for:
- `popstate` events (browser back/forward)
- `pushState` / `replaceState` calls (programmatic navigation)

Each SPA page change sends a new pageview event.

## Custom Event Tracking

After the script loads, a global `analytics` object is available:

```javascript
// Track a custom event
window.analytics.track('signup', { plan: 'pro' });

// Track a button click
document.getElementById('cta').addEventListener('click', () => {
    window.analytics.track('cta_click', { location: 'hero' });
});
```

## Privacy Considerations

- **No cookies**: User identification uses `localStorage` (first-party only)
- **No PII collected**: The user ID is a random anonymous UUID
- **Country detection**: Uses timezone, not IP geolocation
- **Self-hosted**: All data stays on your server
- **DNT respect**: The script exits before any storage or network access when
  `navigator.doNotTrack === '1'` — no visitor id, no session id, no requests.
  Other values (`'0'`, unset, unrelated strings) are not treated as opt-out.
- **GPC respect**: Same early exit when `navigator.globalPrivacyControl === true`.
  `false`/unset are not treated as opt-out.
  Under opt-out, `window.analytics` is an inert stub (`track`/`identify` are no-ops,
  `optedOut === true`) so existing call sites do not break.
  These are technical controls that honour the browser signal; they are not by
  themselves a statement of legal compliance.
- **Server-side backstop**: the tracking API also rejects collection when the
  request carries `DNT: 1` or `Sec-GPC: 1` (browsers send these headers
  themselves). This covers visitors still running a cached copy of an older
  script, and direct calls to `/api/track/*` that bypass the script entirely.
  Such requests are acknowledged with a normal 2xx and `optedOut: true`; nothing
  is persisted. The tracking pixel still returns a valid GIF so the image never
  appears broken.

---

## Web Vitals Tracking

The tracking script automatically collects [Core Web Vitals](https://web.dev/vitals/) using the browser's `PerformanceObserver` API:

| Metric | What It Measures | Good Threshold |
|--------|-----------------|----------------|
| **LCP** | Largest Contentful Paint — loading performance | ≤ 2.5s |
| **FID** | First Input Delay — interactivity | ≤ 100ms |
| **CLS** | Cumulative Layout Shift — visual stability | ≤ 0.1 |
| **INP** | Interaction to Next Paint — responsiveness | ≤ 200ms |
| **TTFB** | Time to First Byte — server response time | ≤ 800ms |

Each metric is sent as a `web_vital` event:

```json
{
  "type": "web_vital",
  "props": { "metric": "LCP", "value": 2.4 }
}
```

View results on the **Performance** page in the dashboard.

---

## JavaScript Error Tracking

Client-side errors are captured automatically:

- **Runtime errors** via `window.onerror` — captures message, source file, line, column, and stack trace
- **Unhandled promise rejections** via `unhandledrejection` — captures the rejection reason

Each error is sent as a `js_error` event:

```json
{
  "type": "js_error",
  "props": {
    "message": "Cannot read property 'x' of undefined",
    "source": "app.js",
    "line": 42,
    "column": 15,
    "stack": "TypeError: Cannot read..."
  }
}
```

View errors on the **Performance → JS Errors** tab.

---

## Site Search Tracking

The tracking script intercepts form submissions that contain search inputs and sends a `site_search` event:

```json
{
  "type": "site_search",
  "props": { "query": "pricing plans" }
}
```

Detection works by finding `<input>` elements with `type="search"` or `name="q"` / `name="s"` / `name="search"` / `name="query"` inside submitted forms.

View search data on the **Content → Site Search** tab.

---

## Click Heatmap Tracking

Every click anywhere on the page fires a `heatmap_click` event. The tracking script captures:

- **CSS selector** — `tag#id` or `tag.class1.class2` of the clicked element
- **Text** — visible label / `aria-label` (truncated to 100 chars)
- **relX / relY** — click position as percentage of viewport width/height (makes dots resolution-independent)
- **x / y** — raw pixel coordinates

```json
{
  "type": "heatmap_click",
  "props": {
    "selector": "button.btn-primary",
    "text": "Get Started",
    "tag": "button",
    "relX": 52,
    "relY": 34,
    "x": 668,
    "y": 246
  }
}
```

View on the **Visual Heatmap** page. Dots are overlaid on a live iframe of the page, coloured indigo → green → yellow → orange → red by relative click density.

---

## Rage Click Detection

A rage click is 3 or more rapid clicks on the same element within 1 second — a strong signal of user frustration (element looks interactive but isn't responding).

```json
{
  "type": "rage_click",
  "props": {
    "selector": "div.submit-btn",
    "count": 4
  }
}
```

Each element has a 5-second cooldown after a rage click is fired, preventing duplicate events. View on the **Engagement → Rage Clicks** tab.

---

## Scroll Depth Tracking

The tracking script fires a `scroll_depth` event when the user reaches the 25%, 50%, 75%, and 100% scroll milestones on any page. Each milestone fires only once per page load. Pages that fit entirely in the viewport (no scroll needed) are skipped.

```json
{
  "type": "scroll_depth",
  "props": {
    "depth": 75,
    "milestone": "true"
  }
}
```

View on the **Engagement → Scroll Depth** tab. The bar chart shows what percentage of visitors reached each milestone per page — content below a low-engagement milestone is likely never seen.

---

## Time on Page Tracking

The tracking script records how long a visitor spent on each page. A `time_on_page` event fires when the page becomes hidden (`visibilitychange` → hidden state) — this covers tab switching, navigating away, and closing the browser.

```json
{
  "type": "time_on_page",
  "props": {
    "seconds": 47
  }
}
```

**How it works:**

- `_pageStart = Date.now()` is recorded when the script initialises
- On `visibilitychange` (hidden), elapsed time is calculated as `Math.round((Date.now() - _pageStart) / 1000)`
- The event is only sent if `seconds > 0`
- The backend filters out values ≥ 3600 s (1 hour) as outliers

**Limitations:** If the user closes the browser without triggering `visibilitychange` (rare on mobile), the event may not fire. The `beforeunload` event does not send `time_on_page` to avoid duplicate counts since `visibilitychange` fires first in all modern browsers.

View on the **Engagement → Time on Page** tab, which shows average, median, min, and max time per page along with sample count.
