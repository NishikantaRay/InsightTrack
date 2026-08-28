# `appsv2/` — secondary working copy

**`apps/` is canonical. Develop there.**

This directory is a second working copy of the same product, kept in sync with
`apps/` so changes can be validated against a parallel tree. It is not a
different version, a next-generation rewrite, or a place to start new work —
despite the "v2" name.

If you are reading this repository to understand, run, or contribute to
InsightTrack, use `apps/`:

| Component | Canonical path |
|---|---|
| Frontend | [`apps/dashboard-web`](../apps/dashboard-web) |
| Backend  | [`apps/analytics-api`](../apps/analytics-api) |

Everything documented in the top-level [README](../README.md), the
[docs/](../docs) directory and `docker-compose.yml` refers to `apps/`.

## What differs from `apps/`

The application source is kept identical. These extras exist only here:

- `analytics-api/src/routes/sync.js` — an additional sync route
- `analytics-api/scripts/seed-hotcold.js` — hot/cold storage seed helper
- `passmark-tests/` — a separate performance-test workspace

Any change to shared code must be applied to both copies. The sync procedure is
in `.claude/skills/insighttrack/references/workflows.md`.
