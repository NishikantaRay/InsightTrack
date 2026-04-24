# Demo Website for Analytics Testing

This demo website is designed to generate test traffic for the current InsightTrack stack.

## Pages Included

| Page | Events Tracked |
|------|----------------|
| `index.html` | pageview, button_click, signup_start, video_play |
| `products.html` | pageview, add_to_cart |
| `pricing.html` | pageview, plan_selected, checkout |
| `about.html` | pageview |
| `contact.html` | pageview, form_submit, lead |

## Configuration

Each page includes an embedded analytics script with:
- **Site ID**: `site_123`
- **Server URL**: `http://localhost:3001`

To change these, edit the script section at the bottom of each HTML file:
```javascript
var siteId = 'your_site_id';
var serverUrl = 'http://your-server-url';
```

## Testing Steps

### 1. Start the Backend Server

```bash
cd apps/analytics-api
npm install
cp .env.example .env
npm run migrate
npm run seed
npm run init
npm run sync
npm start
```

### 2. Serve the Demo Website

**Option A: Using npx serve**
```bash
npx serve examples/demo-website -p 8080
```

**Option B: Using Python**
```bash
cd examples/demo-website
python3 -m http.server 8080
```

**Option C: Using VS Code Live Server extension**
- Install "Live Server" extension
- Right-click on `index.html`
- Select "Open with Live Server"

### 3. Start the Dashboard

```bash
cd apps/dashboard-web
npm install
npm run dev
```

### 4. Test the Flow

1. Open demo website at `http://localhost:8080`
2. Click around different pages
3. Click buttons to trigger events
4. Fill out the contact form
5. Open dashboard at `http://localhost:5173`
6. View tracked events in the dashboard!

## Tracked Events

### Automatic Events
- `pageview` - Tracked on every page load

### Custom Events by Page

**Home Page (index.html)**
- `button_click` - Any button click
- `signup_start` - Sign up button
- `video_play` - Watch demo button

**Products Page (products.html)**
- `add_to_cart` - Product card buttons with product ID

**Pricing Page (pricing.html)**
- `plan_selected` - Plan card buttons with plan name
- `checkout` - Start Trial button

**Contact Page (contact.html)**
- `form_submit` - Contact form submission
- `lead` - Lead capture event

## Debugging

All analytics events are logged to the browser console with the 📊 emoji.

Open DevTools (F12) → Console to see:
```
📊 Analytics Event: pageview { siteId: 'site_123', ... }
📊 Analytics Event: add_to_cart { props: { productId: 1 }, ... }
```

## Event Data Structure

Each event includes:
```javascript
{
  siteId: 'site_123',
  userId: 'u_abc123',      // Persisted in localStorage
  sessionId: 's_xyz789',   // Persisted in sessionStorage
  type: 'pageview',
  url: 'http://localhost:8080/products.html',
  path: '/products.html',
  referrer: 'http://localhost:8080/index.html',
  device: 'Desktop',       // Desktop/Mobile/Tablet
  timestamp: '2024-01-15T10:30:00.000Z',
  props: {}                // Custom properties
}
```

## Architecture Overview

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Demo Website   │      │  Unified API     │      │ PostgreSQL + │
│  (Port 8080)    │─────▶│  (Port 3001)     │─────▶│   DuckDB     │
│                 │      │                  │      │              │
└─────────────────┘      └──────────────────┘      └──────────────┘
            │
            │
          ┌──────▼──────┐
          │  Dashboard  │
          │ (Port 5173) │
          └─────────────┘
```

## Troubleshooting

### Events not being tracked
1. Check browser console for errors
2. Verify backend is running on port 3001
3. Check CORS is enabled on backend
4. Ensure ClickHouse is accessible

### Dashboard shows no data
1. Verify site ID matches (`site_123`)
2. Check backend logs for errors
3. Run seed script to add sample data
4. Check ClickHouse connection settings

### ClickHouse connection failed
1. Verify ClickHouse is running: `docker ps`
2. Check connection URL in `.env`
3. Test connection: `curl http://localhost:8123/ping`
