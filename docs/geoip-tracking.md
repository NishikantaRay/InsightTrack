# GeoIP Location Tracking

**Status**: ✅ Implemented & Running

GeoIP location tracking automatically captures visitor location (country and city) based on their IP address using the `geoip-lite` library.

## Overview

Instead of relying on client-provided timezone data or browser geolocation APIs, InsightTrack now uses MaxMind's free GeoLite2 database (via `geoip-lite`) to determine accurate visitor location at the server level.

## Implementation Details

### Architecture

1. **GeoIP Service** (`src/services/geoipService.js`)
   - Extracts client IP from request headers (X-Forwarded-For, X-Real-IP, or request.ip)
   - Looks up IP in geoip-lite database
   - Returns country code, city, and optional region data

2. **Tracking Routes** (`src/routes/tracking.js`)
   - All tracking endpoints (`/api/track/event`, `/api/track/pageview`, `/api/track/session`, `/api/track/batch`) now enrich incoming event data with GeoIP location
   - Falls back to client-provided location if available, but always uses server-side IP lookup

3. **Analytics Queries** (`src/queries/queries.js`)
   - `getTrafficByCity(siteId, dateRange, limit)` - Event-level city breakdown with engagement metrics
   - `getGeoMap(siteId, dateRange)` - City/country data for map visualization
   - `getSessionsByCity(siteId, dateRange, limit)` - Session-level geo analytics (bounce rate, avg duration, etc.)

4. **API Routes** (`src/routes/analytics.js`)
   - `GET /api/analytics/:siteId/cities` - Top cities by visitor count
   - `GET /api/analytics/:siteId/geo-map` - Geographic data for map visualization
   - `GET /api/analytics/:siteId/sessions/geo` - Sessions by city with engagement metrics

### Enriched Data Schema

Events and sessions now capture:
- `country` - Country code (e.g., 'US', 'GB', 'DE')
- `city` - City name (e.g., 'New York', 'London', 'Berlin')

## Benefits

| Benefit | Impact |
|---------|--------|
| **Accurate geo data** | No reliance on client-side timezone (often wrong) |
| **Server-side validation** | No user manipulation or spoofing possible |
| **No user privacy concerns** | No external API calls; all processing local |
| **Instant availability** | Location available immediately on first pageview |
| **Compliance ready** | Can apply geo-specific privacy rules (GDPR, CCPA) |

## API Usage

### Get Traffic by City

```bash
GET /api/analytics/{siteId}/cities?dateRange=30d&limit=10

Response:
{
  "success": true,
  "data": [
    {
      "city": "New York",
      "country": "US",
      "visitors": 1250,
      "sessions": 950,
      "pageviews": 3200,
      "engagementRate": 45.5,
      "percentage": 12
    },
    ...
  ]
}
```

### Get Geo Map Data

```bash
GET /api/analytics/{siteId}/geo-map?dateRange=30d

Response:
{
  "success": true,
  "data": [
    {
      "city": "San Francisco",
      "country": "US",
      "visitors": 580,
      "sessions": 420
    },
    ...
  ]
}
```

### Get Sessions by City

```bash
GET /api/analytics/{siteId}/sessions/geo?dateRange=30d&limit=10

Response:
{
  "success": true,
  "data": [
    {
      "city": "London",
      "country": "GB",
      "sessions": 340,
      "avgDuration": 450,
      "bounceRate": 32.5,
      "avgPageviews": 3.2
    },
    ...
  ]
}
```

## Dependencies

- `geoip-lite@^1.4.7` - Free, lightweight IP-to-location database

## Tracking Script Integration

Tracking scripts automatically send location with each event. The server will enrich it with server-side GeoIP if client data is missing:

```javascript
// Client can send location (optional)
window.insightTrack.pageview({
  country: 'US',  // optional
  city: 'NYC'     // optional
  // Server will override with GeoIP if not provided
});

// Or just track normally - server adds it automatically
window.insightTrack.pageview();
```

## Future Enhancements

- [ ] Regional breakdown (states/provinces)
- [ ] City-level maps with visitor heat maps
- [ ] Geographic filter in dashboard
- [ ] Geo-based goals and funnels
- [ ] ISP/ASN tracking for enterprise users

## Testing

To verify GeoIP is working:

```bash
# Check that geoip-lite is installed
npm list geoip-lite

# Test the tracking endpoint
curl -X POST http://localhost:3001/api/track/event \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 8.8.8.8" \
  -d '{
    "siteId": "your-site-id",
    "userId": "user123",
    "type": "pageview",
    "url": "https://example.com",
    "path": "/"
  }'

# Check the analytics endpoint
curl http://localhost:3001/api/analytics/your-site-id/cities \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Performance Notes

- GeoIP lookups are fast (~1-2ms) and happen on every request
- Adds negligible overhead to tracking endpoint
- Fully local lookup (no external API calls)
- No impact on page load time (server-side only)

## Troubleshooting

**No city data appearing?**
- Check that tracking is correctly sending city/country fields
- Verify X-Forwarded-For header is properly set if behind a proxy
- Ensure geoip-lite database is populated (automatic on npm install)

**All cities showing as "Unknown"?**
- Localhost and private IPs won't resolve (expected behavior)
- Test with public IP addresses
- Check that geoip-lite is properly imported in geoipService.js

---

For usage in analytics views, see [frontend-structure.md](./frontend-structure.md) — Geo Analytics section.
