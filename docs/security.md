# Security Practices

Key security measures in InsightTrack.

---

## Authentication
- JWT tokens for all API routes (except tracking and auth)
- Passwords hashed with bcrypt
- JWT secret stored in `.env` (never commit secrets)

## API Security
- CORS restricted to allowed origins
- Rate limiting on API endpoints
- Helmet for HTTP headers
- Input validation on all POST/PUT

## Database
- Parameterized SQL queries (no string interpolation)
- Separate users/roles for DB access

## Frontend
- No secrets in client code
- XSS protection via React escaping

## Privacy & Data Protection
- **Do Not Track (DNT)**: Tracking script checks `navigator.doNotTrack` and disables collection if enabled
- **Global Privacy Control (GPC)**: Respects `navigator.globalPrivacyControl` signal
- **No cookies**: Anonymous UUIDs stored in `localStorage` only — no cookie consent needed
- **No IP storage**: IP addresses are never persisted in the database
- **Data retention policies**: Configurable per-site retention period (30/90/180/365 days)
- **Retention cleanup**: Manual or automated deletion of expired events and sessions
- **Self-hosted**: All data stays on your infrastructure — zero third-party data sharing
- **GDPR-friendly**: Minimal data collection, user anonymity, and data lifecycle management

---

## See Also
- [deployment.md](./deployment.md)
- [backend-architecture.md](./backend-architecture.md)
