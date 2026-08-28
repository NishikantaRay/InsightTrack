# Security Practices

Key security measures in InsightTrack.

---

## Authentication
- JWT tokens for all API routes (except tracking and auth)
- Passwords hashed with bcrypt
- JWT secret stored in `.env` (never commit secrets)

## API Security
- CORS restricted to allowed origins (`CORS_ORIGINS`); tracking and webhook
  endpoints use a separate public CORS policy
- Rate limiting: a global limiter defaults to **1000 requests/minute**
  (`RATE_LIMIT_MAX_REQUESTS`), skipping health checks and the tracking pixel.
  Pulse applies stricter per-user limits (10/min on a server key, 30/min on a
  user's own key). The SQL Editor has **no dedicated per-user limit** — it is
  bounded only by the global limiter.
- Helmet for HTTP headers (note: CSP is currently disabled)
- Input validation is implemented per route rather than by a shared schema layer.
  Tracking input is type-allowlisted and length-clamped; SQL Editor input goes
  through the validation described in
  [SQL_EDITOR_SECURITY.md](./SQL_EDITOR_SECURITY.md).

## Database
- Parameterized SQL queries on the normal read and write paths. Two documented
  exceptions exist in the SQL Editor — template-variable substitution and the
  per-site scoped-view DDL (DuckDB cannot bind parameters in DDL). Both are
  covered by validation; see
  [SQL_EDITOR_SECURITY.md](./SQL_EDITOR_SECURITY.md).
- PostgreSQL access uses a configured database role. DuckDB is **embedded and
  in-process** and provides no equivalent user/role boundary — queries run with
  the API process's privileges, so access is controlled at the application layer.

## SQL Editor
The SQL Editor accepts arbitrary user SQL and is the most security-sensitive
surface in the product. Its boundary — read-only enforcement, filesystem
protection, tenant scoping — and the verification evidence for it are documented
separately in [SQL_EDITOR_SECURITY.md](./SQL_EDITOR_SECURITY.md).

## Frontend
- No secrets in client code
- XSS protection via React escaping

## Privacy & Data Protection
- **Do Not Track (DNT)**: the tracking script exits before any storage or network
  access when `navigator.doNotTrack === '1'`. No visitor id, session id, or
  request is created. Other values (`'0'`, unset) are not treated as opt-out.
- **Global Privacy Control (GPC)**: same early exit when
  `navigator.globalPrivacyControl === true`.
- **Server-side opt-out backstop**: the tracking API also declines to persist
  anything when a request carries `DNT: 1` or `Sec-GPC: 1`. This covers visitors
  running a cached copy of an older script and direct calls to `/api/track/*`.
- **No cookies**: a pseudonymous random identifier is stored in `localStorage`
  only. No cookies are set by the tracking script.
- **No IP storage**: IP addresses are used transiently for country lookup and are
  never persisted.
- **Data retention policies**: configurable per-site retention period. Cleanup is
  **manually triggered** (via the API or the dashboard) — there is no scheduler,
  so a policy does not enforce itself.
- **Retention cleanup scope**: a cleanup removes matching rows from **both**
  PostgreSQL and the DuckDB read replica, so deleted data stops appearing in
  dashboards, the SQL Editor, Pulse, and MCP. It operates per-site on a time
  cutoff — it is **not** a per-visitor (data-subject) erasure mechanism.
- **Self-hosted**: the tracking pipeline sends visitor data only to your own
  server. Optional integrations you enable — Pulse AI providers, Sentry, and
  S3/R2 cold storage — do send data to those external services by design.
- **Privacy-focused design**: minimal collection, pseudonymous identifiers, and
  data lifecycle controls. These are technical properties; they are not by
  themselves a statement of legal compliance. Requirements vary by jurisdiction
  and deployment — consult applicable privacy/ePrivacy requirements for your
  situation.

---

## See Also
- [deployment.md](./deployment.md)
- [backend-architecture.md](./backend-architecture.md)
