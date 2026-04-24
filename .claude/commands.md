# Claude Commands — InsightTrack

Quick-reference commands you can ask Claude to perform.

## Code Review

> "Review this file/PR for security, correctness, and conventions"

Claude will use `.claude/skills/code-review.md` checklist:
- SQL injection checks (parameterized queries)
- Auth middleware verification
- Database boundary compliance (PG writes, DuckDB reads)
- Frontend patterns (hooks, dark mode, state management)
- Error handling and input validation

## PR Review

> "Review PR #X" or "Review these changes as a PR"

Claude will use `.claude/skills/pr-review.md`:
- Cross-package impact analysis
- Risk assessment (high/medium/low)
- Architecture alignment check
- Performance review
- Structured review report

## Security Audit

> "Run a security audit on [file/package/endpoint]"

Claude will use `.claude/skills/security-audit.md`:
- OWASP Top 10 checks specific to InsightTrack
- SQL injection, XSS, auth bypass, IDOR checks
- Docker security, secrets management
- Structured audit report with severity levels

## Debug Help

> "Help me debug [issue description]"

Claude will use `.claude/skills/debugging.md`:
- Systematic decision tree for common issues
- Useful debug commands for each layer
- Log analysis patterns

## Build a Feature

> "Add a new [chart/endpoint/page/metric]"

Claude will use `.claude/skills/feature-development.md`:
- Step-by-step workflow for the feature type
- File placement guide
- Code templates matching project conventions

## Write Tests

> "Write tests for [component/service/feature]"

Claude will use `.claude/skills/testing.md`:
- Vitest for backend services and frontend components
- Playwright for E2E flows
- Test patterns matching project conventions
