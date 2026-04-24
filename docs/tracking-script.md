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
- **DNT respect**: The script checks `navigator.doNotTrack` — if enabled, no data is collected
- **GPC respect**: The script checks `navigator.globalPrivacyControl` — if enabled, tracking is disabled

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
