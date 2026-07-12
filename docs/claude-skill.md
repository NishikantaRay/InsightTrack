# The `insighttrack` Claude Skill

InsightTrack ships a project-specific **Claude Code agent skill** so any
Claude session can work on this codebase without rediscovering the
architecture, conventions, or the three-copy repo layout.

## What it is

An agent skill in the standard Claude Code format:

```
.claude/skills/insighttrack/
├── SKILL.md                     # entry point — always what Claude reads first
└── references/
    ├── architecture.md          # request lifecycle, sync engine, hot/cold storage, AI/MCP, deploy
    ├── patterns.md              # copy-paste implementation examples for every layer + testing
    ├── workflows.md             # feature workflow, debugging, three-copy sync procedure
    └── review-security.md       # code/PR review checklists, threat model, OWASP audit
```

The skill is the **only** Claude configuration besides `CLAUDE.md`. Earlier
flat checklist files in `.claude/` (`commands.md`, `settings.md`, seven
`skills/*.md`) had drifted from the code — they referenced middleware, cache
APIs, and store rules that no longer existed — and were consolidated,
corrected, into `references/` (July 2026). A model following stale
instructions writes stale code; keeping one verified source prevents that.

`SKILL.md` carries YAML frontmatter (`name`, `description`). Claude Code
scans `.claude/skills/*/SKILL.md` automatically — the description tells the
model *when* to activate it, and the references are loaded on demand
(progressive disclosure keeps the always-loaded context small).

## What it encodes

- **The three synced copies** and their path mapping
  (`traffic/analytics-dashboard ⇄ traffic2/{apps,appsv2}/dashboard-web`,
  `traffic/analytics-db ⇄ traffic2/{apps,appsv2}/analytics-api`) plus the
  mandatory sync-after-every-feature procedure.
- **Golden rules**: parameterized SQL only; PG for writes / DuckDB for reads;
  auth middleware chain; ES modules; dark-mode variants; `useAnalytics` for
  data fetching; `safeMsg` error envelopes; docs updated per feature.
- **Architecture**: tracking → PG → sync engine → DuckDB (hot tables +
  Parquet cold partitions behind union views) → cached analytics routes →
  React dashboard; AI Analyst + MCP tool registry.
- **Folder & naming conventions**, canonical code patterns per layer,
  shared utilities, test conventions, commands, and things to avoid.

## Installation

Nothing to install — the skill is checked into the repo and versioned with
the code. Any Claude Code session opened in `traffic/` or `traffic2/` picks
it up automatically. For use *outside* the repo (e.g. a personal skill),
copy the folder to `~/.claude/skills/insighttrack/`.

## Activation

- **Automatic**: Claude Code matches the task against the skill description —
  any feature/bug/review/test work in this repo qualifies.
- **Explicit**: mention it ("use the insighttrack skill") or invoke it via
  the Skill tool / `/insighttrack` if your client exposes skills as commands.
- `CLAUDE.md` (always loaded) points to the skill, so even sessions that
  don't auto-trigger skills are directed to read it.

### Example prompts that leverage it

- "Add a `/api/analytics/:siteId/exit-pages` endpoint and show it on the
  Content page." → skill supplies the query/route/api.js/ChartCard pattern
  and reminds about cache TTLs, dark mode, docs, and the three-copy sync.
- "Why is the dashboard showing zero visitors since yesterday?" → skill's
  debugging tree starts at the PG→DuckDB sync loop.
- "Review this diff." → skill's invariants + `references/review-security.md`
  checklists and report format.
- "Write tests for teamService." → testHelper pattern with `site_test%`
  cleanup and real-PG setup.
- "Port yesterday's funnel change to the other copies." → workflows.md sync
  procedure with the path mapping and known intentional differences.

## Updating the skill

Treat the skill like code — update it **in the same change** that alters what
it describes:

| Change | Update |
|--------|--------|
| New invariant / hard rule | `SKILL.md` §2 (and `CLAUDE.md` Critical Rules) |
| New package or moved folder | `SKILL.md` §1 layout table + §4 |
| New reusable pattern/utility | `references/patterns.md` |
| Architecture change (sync, storage, auth, AI) | `references/architecture.md` |
| Workflow/command change | `references/workflows.md` (+ `SKILL.md` §6) |
| Review/security policy change | `references/review-security.md` |

Then mirror `.claude/` to the other repo (`traffic` ⇄ `traffic2`) — the skill
itself is part of the three-copy sync contract.

### Keeping it healthy

- Keep `SKILL.md` under ~350 lines; push detail into `references/`.
- Don't duplicate whole docs — link to `docs/*.md` instead.
- Delete stale claims immediately; a wrong skill is worse than no skill.
- Periodic check: `diff -rq traffic/.claude traffic2/.claude` should be clean.

## Optional: permission allowlist

To cut permission prompts for safe commands, add `.claude/settings.json`
yourself (Claude intentionally does not self-grant permissions):

```json
{
  "permissions": {
    "allow": [
      "Bash(npm test:*)",
      "Bash(npm run test:*)",
      "Bash(npm run build:*)",
      "Bash(npx vitest run:*)",
      "Bash(npx playwright test:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(diff:*)"
    ],
    "deny": [
      "Read(**/.env)",
      "Read(**/.env.local)",
      "Read(**/.env.production)"
    ]
  }
}
```

## Related

- `.claude/README.md` — layout of the whole `.claude/` directory
- `CLAUDE.md` — always-loaded critical rules (subset of the skill)
- `docs/architecture.md`, `docs/backend-architecture.md`,
  `docs/frontend-structure.md` — human-oriented deep dives the skill links to
