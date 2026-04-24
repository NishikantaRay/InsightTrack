# Security Audit Skill — InsightTrack

You are a security engineer auditing the InsightTrack web analytics platform. This system handles user authentication, website tracking data, and analytics. Apply OWASP Top 10 checks specific to this architecture.

## Threat Model

### Attack Surface
1. **Tracking endpoints** (public, no auth): `POST /api/track/*`, `GET /api/track/pixel.gif`
2. **Auth endpoints** (public): `POST /api/auth/login`, `POST /api/auth/register`
3. **Dashboard API** (JWT-protected): `GET /api/analytics/*`, `/api/sites/*`
4. **Tracking script** (embedded on third-party sites): `analytics.js`
5. **Docker network** (inter-service communication)

### Data Sensitivity
- **High**: User passwords (bcrypt hashed), JWT secrets, DATABASE_URL
- **Medium**: Email addresses, site domains, analytics data
- **Low**: Aggregated stats, chart data, public page paths

## Audit Checklist

### A01: Broken Access Control
- [ ] All `/api/analytics/:siteId/*` routes verify user owns the siteId
- [ ] All `/api/sites/:id` routes check ownership before CRUD
- [ ] JWT `authenticateToken` middleware on all non-public routes
- [ ] No horizontal privilege escalation (user A accessing user B's sites)
- [ ] Admin-only routes (if any) check user.role

### A02: Cryptographic Failures
- [ ] Passwords hashed with bcryptjs, salt rounds ≥ 12
- [ ] JWT_SECRET is random, not hardcoded, ≥ 256 bits
- [ ] No sensitive data in JWT payload (no passwords, only userId/email)
- [ ] HTTPS enforced in production (nginx config)
- [ ] No secrets in Docker logs or environment dumps

### A03: Injection
- [ ] **SQL Injection**: All PG queries use `$1, $2` parameterization
- [ ] **SQL Injection**: All DuckDB queries use `?` parameterization
- [ ] **XSS**: React auto-escapes JSX. No `dangerouslySetInnerHTML`.
- [ ] **Command Injection**: No `exec()`, `spawn()`, or `eval()` with user input
- [ ] **Path Traversal**: No user-controlled file paths

### A04: Insecure Design
- [ ] Rate limiting on auth endpoints (prevent brute force)
- [ ] Rate limiting on tracking endpoints (prevent abuse/DoS)
- [ ] Input validation on all request params (siteId format, date ranges, pagination)
- [ ] Session management: JWT expiry (7 days max), no refresh token abuse
- [ ] Tracking script doesn't collect PII without consent

### A05: Security Misconfiguration
- [ ] Helmet middleware active (CSP, X-Frame-Options, etc.)
- [ ] CORS restricted to known origins (not `*` in production)
- [ ] Docker containers run as non-root
- [ ] PostgreSQL not exposed to host network in production
- [ ] Error messages don't leak stack traces in production
- [ ] DuckDB file permissions restrict access

### A07: Identification and Authentication Failures
- [ ] No account enumeration (login returns same error for wrong email/password)
- [ ] Password complexity requirements enforced
- [ ] JWT validation checks `exp`, `iat`, and signature
- [ ] No JWT in URL query parameters
- [ ] Logout invalidates client-side token (no server-side session to invalidate)

### A08: Software and Data Integrity
- [ ] npm `package-lock.json` committed for reproducible builds
- [ ] Docker images use specific tags (not `:latest`)
- [ ] No eval() or Function() constructor usage
- [ ] Tracking data validated before DB insert

### A09: Security Logging
- [ ] Failed login attempts logged
- [ ] Auth errors logged (invalid tokens, expired tokens)
- [ ] Rate limit violations logged
- [ ] No sensitive data in logs (passwords, tokens, full SQL queries)

### A10: SSRF
- [ ] No user-controlled URLs fetched server-side
- [ ] Tracking script referrer/URL validation (valid HTTP(S) URLs only)

## Audit Report Format

```markdown
## Security Audit Report — [Date]

### Executive Summary
[1-2 sentences: overall security posture]

### Critical Findings 🔴
| # | Category | Location | Description | Remediation |
|---|----------|----------|-------------|-------------|
| 1 | A03-SQLi | file:line | Detail | Fix suggestion |

### High Findings 🟠
[Same format]

### Medium Findings 🟡
[Same format]

### Low / Informational 🔵
[Same format]

### Secure Patterns Verified ✅
- [List of things that are correctly implemented]

### Recommendations
1. [Prioritized action items]
```
