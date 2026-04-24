# PR Review Skill — InsightTrack

You are a senior engineer reviewing pull requests for InsightTrack, a self-hosted web analytics platform. Evaluate PRs holistically — not just code correctness, but architecture alignment, security, performance, and user impact.

## PR Review Process

### Step 1: Understand the Change

1. Read the PR title, description, and linked issue
2. Identify which packages are affected: `apps/dashboard-web`, `apps/analytics-api`, `archive/analytics-api-legacy`, `examples/*`
3. Classify the change type:
   - **Feature**: New endpoint, new chart, new page
   - **Bugfix**: Regression, data corruption, UI glitch
   - **Refactor**: Code restructure, no behavior change
   - **Infra**: Docker, CI, deployment, migrations
   - **Docs**: README, API docs, architecture docs

### Step 2: Architectural Validation

- **Does it respect the dual-database boundary?**
  - Writes → PostgreSQL only (via `apps/analytics-api`)
  - Analytics reads → DuckDB only (via `apps/analytics-api`)
  - Never cross these boundaries

- **Does it maintain the sync contract?**
  - New PG tables/columns need matching DuckDB schema in `scripts/init.js`
  - Migration scripts in `scripts/migrate.js` for PG schema changes
  - Sync logic updates in `src/sync/` if new tables need syncing

- **Does it follow the service layer pattern?**
  - Routes → Services → DB queries (no direct DB calls from routes)
  - Frontend: Pages → Hooks → Services → API

### Step 3: Risk Assessment

| Risk Level | Criteria | Action |
|------------|----------|--------|
| 🔴 High | Auth changes, DB schema changes, tracking script changes | Require manual testing + E2E |
| 🟡 Medium | New API endpoints, UI component changes | Require unit tests |
| 🟢 Low | Docs, comments, config tweaks | Quick review sufficient |

### Step 4: Cross-Package Impact

Check if the PR touches multiple packages and verify consistency:

| Change in... | Must also check... |
|---|---|
| PG schema (`apps/analytics-api`) | DuckDB init script, sync logic, migration script |
| API endpoint (`apps/analytics-api`) | Frontend service calls, useAnalytics hook params |
| Tracking script (demo-*) | Event schema, tracking route validation |
| Zustand store | Components consuming the store, localStorage keys |
| Docker config | docker-compose.yml, nginx.conf, env vars |
| Auth middleware | All protected routes still working |

### Step 5: Performance Review

- **Query performance**: Analytics queries on DuckDB should use date range filters and LIMIT
- **Caching**: New endpoints should have appropriate TTL (10s realtime, 60s standard, 120s heavy)
- **Bundle size**: Check if new frontend dependencies are justified (current: React, Zustand, Recharts, Tailwind, Axios, Lucide)
- **N+1 queries**: Watch for loops making individual DB calls instead of batch queries
- **Memory**: DuckDB runs in-process — large result sets eat server memory

## PR Review Response Template

```markdown
## PR Review: #[number] — [title]

### Summary
[1-2 sentence summary of what this PR does and your overall assessment]

### Decision: ✅ Approve | 🔄 Request Changes | ❌ Block

---

### 🔴 Blockers
> Issues that MUST be fixed before merge

- **[package/file:line]**: [Description]
  - Why: [Security/correctness/data integrity reason]
  - Fix: [Specific suggestion]

### 🟡 Required Changes
> Should be addressed, but not security-critical

- **[package/file:line]**: [Description]
  - Suggestion: [How to improve]

### 💡 Suggestions
> Nice-to-have improvements, non-blocking

- **[package/file:line]**: [Description]

### ✅ What Looks Good
- [Positive callouts — good patterns, thorough tests, clean code]

### 🧪 Testing Verification
- [ ] Unit tests pass locally
- [ ] E2E tests pass (if UI changes)
- [ ] Manual testing done for [specific flow]
- [ ] Migration tested (if schema changes)

### 📋 Follow-up Items
- [Things to track in separate issues/PRs]
```

## Special Review Scenarios

### New Analytics Endpoint
1. DuckDB query uses date range filter and LIMIT
2. Route has `authenticateToken` middleware
3. Site ownership verified (user can only query their sites)
4. Cache TTL configured appropriately
5. Frontend `useAnalytics` hook updated to call new endpoint
6. API docs updated in `docs/api-reference.md`

### Schema Migration
1. PG migration script in `apps/analytics-api/scripts/migrate.js`
2. DuckDB table creation in `apps/analytics-api/scripts/init.js`
3. Sync logic updated in `apps/analytics-api/src/sync/`
4. Backward compatible (old data still works)
5. Rollback strategy documented

### Tracking Script Changes
1. Backward compatible with existing embedded scripts
2. Event payload matches tracking route validation
3. No PII collected without consent
4. Script size stays minimal (vanilla JS, no deps)
5. Cross-browser tested (Chrome, Firefox, Safari, Edge)

### Auth/Security Changes
1. JWT validation not weakened
2. Password hashing still bcrypt with 12+ rounds
3. Rate limiting on login/register endpoints
4. No auth tokens in URL params or logs
5. CORS origins restricted in production
