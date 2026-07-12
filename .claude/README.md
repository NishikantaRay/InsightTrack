# .claude/ — Claude Code configuration for InsightTrack

This directory makes Claude Code sessions productive on this repo without
re-discovering the architecture each time. One skill, nothing else.

## Layout

```
.claude/
├── README.md                    ← this file
└── skills/
    └── insighttrack/            ← THE project skill (auto-discovered by Claude Code)
        ├── SKILL.md             ← entry point: layout map, invariants, patterns, commands
        └── references/
            ├── architecture.md      ← request lifecycle, sync engine, hot/cold, AI/MCP, deploy
            ├── patterns.md          ← copy-paste implementation examples per layer + testing
            ├── workflows.md         ← feature workflow, debugging, three-copy sync procedure
            └── review-security.md   ← code/PR review checklists, threat model, OWASP audit
```

## How it works

- **`CLAUDE.md` (repo root)** is loaded automatically at session start — it
  holds only the always-relevant rules and points at the skill for depth.
- **`skills/insighttrack/`** is a Claude Code *agent skill* (`SKILL.md` with
  YAML frontmatter). Claude Code discovers it automatically and activates it
  when work matches its description; the `references/` files are loaded on
  demand.
- **`settings.json`** (optional, not checked in): a suggested permission
  allowlist for tests/builds/read-only git lives in `docs/claude-skill.md` —
  add it deliberately if you want fewer permission prompts.

Historical note: this directory previously held flat checklist files
(`commands.md`, `settings.md`, `skills/*.md`). They had drifted from the
code (wrong middleware/cache/store names) and were consolidated — corrected —
into the skill's `references/` in July 2026. Recover via git history if ever
needed.

## Maintenance

- Architecture/convention changes → update `skills/insighttrack/` in the same
  change. When the skill and the code disagree, the code wins — fix the skill.
- This directory must stay **byte-identical** between the `traffic` and
  `traffic2` repositories (the skill is layout-aware and covers both).
- Full guide: `docs/claude-skill.md`.
