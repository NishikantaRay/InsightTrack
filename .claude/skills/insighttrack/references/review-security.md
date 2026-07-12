# InsightTrack — Code Review, PR Review & Security Audit

Consolidated from the former flat checklist files, corrected against the
current codebase. Names below match the real code (`authMiddleware`,
`analyticsCache.getOrFetch`, `{ success, data }` envelopes).

## 1. Threat model

Attack surface, in order of exposure:

1. **Tracking endpoints** (public, any origin): `POST /api/track/*` — rate
   limited, validated in `trackingService`.
2. **Auth endpoints** (public): `/api/auth/login`, `/api/auth/register`.
3. **Dashboard API** (JWT): `/api/analytics/*`, `/api/sites/*`, `/api/team/*`,
   `/api/sql-editor/*`, `/api/reporting/*`.
4. **AI surface**: `/api/assistant` (SSE), `/api/mcp` (connect tokens,
   signed requests) — tools run with the *user's* token; scoping is enforced
   server-side, never by the LLM.
5. **Tracking script** embedded on third-party sites.
6. **Public share/invite tokens**: shared dashboards, `/api/invite/:token`.

Data sensitivity: passwords (bcrypt), JWT/encryption secrets, BYO AI keys
(secretBox-encrypted) = high; emails, domains, raw events = medium;
aggregated stats = low.

## 2. Code review checklist

Blockers (reject on sight):

- [ ] SQL built with template literals/concatenation → must be `$1…` (PG) / `?` (DuckDB).
- [ ] New route without `authMiddleware` — exceptions only: track, auth
      login/register, health, openapi.json, share/invite-by-token.
- [ ] Site-scoped route missing `validateSiteId` + `authorizeSiteAccess`
      (IDOR: users must never reach another user's `siteId`).
- [ ] Mutation without a role check where roles matter (`req.userRole` must
      be `owner`/`admin` for team/site management writes).
- [ ] Direct DuckDB write outside `sync/` or `storage/s3.js`.
- [ ] Analytics read hitting PostgreSQL.
- [ ] Error responses leaking internals — must go through `safeMsg`/`sendError`.
- [ ] Hardcoded secrets; secrets in logs; tokens in URLs.
- [ ] `dangerouslySetInnerHTML` with any user-influenced content.

Should-fix:

- [ ] New analytics endpoint without `analyticsCache.getOrFetch` + a
      `CACHE_TTL` constant; queries without date filter and LIMIT.
- [ ] Response not using the `{ success: true, data }` envelope.
- [ ] UI without `dark:` twins on every color class; raw hex instead of theme
      tokens / `CHART_COLORS`.
- [ ] Raw `useEffect`+axios instead of `useAnalytics`; component-local state
      pushed into Zustand (use `useState` for local state).
- [ ] Missing loading/empty/error handling (use `ChartCard` props /
      `LoadingSkeleton` / `EmptyState`).
- [ ] Dead code, unused imports, new npm deps for stack-achievable things.
- [ ] PG schema change without matching DuckDB DDL (`schema/schema.js`) +
      `SYNCABLE_TABLES` entry when the table must sync.
- [ ] Feature landed without a `docs/` update or without the three-copy port.

Response format:

```markdown
## Code Review: [scope]
### 🔴 Blockers        — [file:line] issue → why → fix
### 🟡 Should fix      — [file:line] issue → suggestion
### 🟢 Looks good      — patterns followed correctly
### 📝 Notes           — follow-ups, architecture considerations
```

## 3. PR review additions

Risk classification:

| Risk | Criteria | Action |
|------|----------|--------|
| 🔴 High | Auth, schema, tracking-script, sync-engine changes | Manual testing + e2e before merge |
| 🟡 Medium | New endpoints, UI components, store changes | Unit tests required |
| 🟢 Low | Docs, comments, config tweaks | Quick review |

Cross-package impact — if the PR touches X, also verify Y:

| Change in… | Must also check… |
|---|---|
| PG schema (`db/postgres.js`) | DuckDB DDL (`schema/schema.js`), `SYNCABLE_TABLES`, sync logic |
| Backend endpoint | Frontend `services/api.js` entry, `useAnalytics` callers, `docs/api-reference.md` |
| Tracking script | `trackingService` validation, event schema in both DBs |
| Zustand store | Consuming components, `analytics-*` localStorage keys |
| Auth middleware / roles | Every protected route, MCP connect-token flow |
| Docker/nginx/env | `docker-compose.yml`, `nginx.conf`, `.env.production.example` |
| Anything at all | The other two copies (three-copy sync) |

## 4. Security audit (OWASP-mapped, project-specific)

- **A01 Access control**: site scoping via `site_members` on every
  `/:siteId` route; no horizontal escalation; role checks on mutations;
  share tokens read-only and unguessable.
- **A02 Crypto**: bcrypt ≥ 12 rounds; `JWT_SECRET` random ≥ 256 bits; BYO AI
  keys only via `secretBox` (AES-256-GCM); HTTPS at the proxy; no secrets in
  JWT payload or logs.
- **A03 Injection**: parameterized SQL everywhere (grep for template
  literals containing `SELECT|INSERT|UPDATE|DELETE`); JSX auto-escape intact;
  no `eval`/`Function`/`exec` with user input; no user-controlled file paths
  (watch the SQL Editor and Parquet-glob code paths).
- **A04 Design**: rate limiting active on `/api/` (login brute force,
  tracking abuse); JWT expiry 7 d; SQL Editor restricted to read-only DuckDB
  access (see `docs/sql-editor.md` security model).
- **A05 Misconfig**: helmet on; CORS allowlist (`CORS_ORIGINS`, production
  guard warns if localhost-only); PG not exposed publicly; errors masked
  outside development (`safeMsg`); 404 handler does not echo the URL.
- **A07 AuthN**: same error for wrong email vs wrong password; JWT signature
  + `exp` verified; no tokens in query strings.
- **A08 Integrity**: `package-lock.json` committed; pinned Docker tags;
  tracking payload validated before insert.
- **A09 Logging**: auth failures and rate-limit hits logged; no
  passwords/tokens/full SQL in logs; request logger skips `/api/track`.
- **A10 SSRF**: no user-controlled URLs fetched server-side (audit any new
  webhook/integration feature for this).

Report format: executive summary → findings table per severity
(`# | OWASP | file:line | description | remediation`) → verified-secure
patterns → prioritized recommendations.
