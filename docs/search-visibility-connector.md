# Search Visibility Connector — Plan (SerpApi × InsightTrack)

> **Status:** IMPLEMENTED in `apps/`, `appsv2/` and `traffic/`. This document is
> both the design rationale and the current-state guide; §13 records what shipped.
> **Thesis:** neither a web-analytics tool nor a SERP API can answer *"why did
> traffic to this page change?"* on its own. InsightTrack knows **what** happened
> to a page; SerpApi knows **what happened in the SERP** that feeds it. The
> product is the **join**, expressed as one plain-English explanation and
> reachable from both the dashboard and the MCP agent.
>
> Explicit non-goal: "SerpApi wrapped in MCP." SerpApi already ships that. The
> new surface here is `explain_traffic_change` — a correlation tool that consumes
> both sides.

---

## Table of contents
0. [Repo topology (confirmed)](#0-repo-topology-confirmed)
1. [Decisions taken (and why)](#1-decisions-taken-and-why)
2. [File & folder structure](#2-file--folder-structure)
3. [MCP tool schemas (exact JSON)](#3-mcp-tool-schemas-exact-json)
4. [Correlation engine](#4-correlation-engine)
5. [Data model](#5-data-model)
6. [Caching & credit conservation](#6-caching--credit-conservation)
7. [Dashboard view](#7-dashboard-view)
8. [Demo path](#8-demo-path)
9. [Known-quirk handling](#9-known-quirk-handling)
10. [Security](#10-security)
11. [Build phases](#11-build-phases)
12. [Open questions for you](#12-open-questions-for-you)

---

## 0. Repo topology (confirmed)

Three copies of one product. Verified identical: `registry.js` is byte-identical
across all three today.

| Copy | Path | Repo | Visibility | Role |
|---|---|---|---|---|
| `apps/` | `InsightTrack/apps/` | `NishikantaRay/InsightTrack` | **PUBLIC** | **The hackathon deliverable** |
| `appsv2/` | `InsightTrack/appsv2/` | `NishikantaRay/InsightTrack` | **PUBLIC** | Second layout, same repo |
| `traffic/` | sibling `traffic/` | `NishikantaRay/traffic` | **PRIVATE** | **Live production** |

Directory-name mapping across the boundary:

```
InsightTrack/apps/dashboard-web    ⇄  traffic/analytics-dashboard
InsightTrack/apps/analytics-api    ⇄  traffic/analytics-db
InsightTrack/apps/mcp-server       ⇄  traffic/mcp-server
InsightTrack/apps/mcp-toolkit-core ⇄  traffic/mcp-toolkit-core
```

**What this means for the plan** (this is open question #1, now closed):

1. **`InsightTrack` is already public — it IS the judge-facing repo.** No
   extraction into a new standalone repo. The clone URL judges get is
   `https://github.com/NishikantaRay/InsightTrack`, and the correlation ships
   with the analytics half it depends on, which was the whole argument against
   extracting.
2. **`traffic` is private AND live.** That flips its role in the sync. It is not
   just a third copy to keep tidy — it is production. So the SerpApi work lands
   in the public repo first, is demoed from there, and reaches `traffic` **last**,
   deliberately, after the demo is done.
3. **Nothing secret may cross into the public repo.** `traffic` being private has
   presumably let production values sit in places that were never public-facing.
   Before the first public push, §10.1 gate runs.

### 0.1 Sync order (revises rule 9 for this feature)

`CLAUDE.md` rule 9 says keep all three byte-identical after every feature. That
still holds — but the *order* matters now that we know which copy is live:

```
P0…P5   apps/          ← build + demo here (public, judge-facing)
P6a     appsv2/        ← port (same repo, no deploy risk)
P6b     traffic/       ← port LAST, after the hackathon demo is done
```

Rationale: `traffic` is live production. Pushing an unproven feature that makes
outbound third-party API calls into production mid-hackathon risks the live site
for zero demo benefit — judges never see `traffic`. Porting after the demo keeps
rule 9 satisfied without putting production in the blast radius.

---

## 1. Decisions taken (and why)

**Not greenfield — this extends InsightTrack in place.** The brief allowed
Python + uv *if greenfield*; it isn't. Everything the correlation needs already
exists here: a shared tool registry, a coalescing TTL cache, a per-user site
authorization chain, an MCP server that proxies the registry, and DuckDB
analytics queries. A separate Python service would have to re-implement auth and
re-fetch traffic over HTTP to do worse work. So: **ES modules, Express 4,
React 18 + Vite + Tailwind, PostgreSQL for writes, DuckDB for reads** — the
existing conventions in `CLAUDE.md`.

| Decision | Choice | Why |
|---|---|---|
| Where SerpApi is called | `apps/analytics-api` (server-side only) | API key never reaches the browser |
| SerpApi transport | **REST** (`https://serpapi.com/search.json`) via `fetch` | No extra dependency; hosted MCP would mean an MCP client inside our server just to call HTTP |
| Tool surface | New tools in the **existing** `src/mcp/tools/registry.js` | One registry ⇒ tools appear in the AI panel *and* the external MCP server with zero extra wiring (`apps/mcp-server` proxies `/api/mcp/tools`) |
| Cache | Existing `analyticsCache.getOrFetch` + a **PostgreSQL rank-history table** | In-memory kills duplicate calls within a run; PG gives rank *deltas* across days, which is what the explanation needs |
| Default window | 90 days | Documented `get_top_pages` unreliability at short windows |
| Keyword→page mapping | New `page_keywords` table, seeded + editable | The join needs to know which keyword a page targets |

---

## 2. File & folder structure

New files marked **`+`**; touched files marked **`~`**. Per rule 9 in `CLAUDE.md`,
every path below is ported to `appsv2/` and the sibling `traffic/` repo
(`dashboard-web ⇄ analytics-dashboard`, `analytics-api ⇄ analytics-db`).

```
apps/analytics-api/
  src/
    services/
   +  serpapi/
   +    client.js              SerpApi REST client: fetch + retry + timeout +
   +                           credit accounting. The ONLY file that knows the key.
   +    normalize.js           raw SerpApi JSON → our stable shapes
   +                           (organic_results → RankRow, ai_overview → Citation)
   +    serpCache.js           two-tier cache: analyticsCache (minutes) over
   +                           serp_snapshots (days). Cache-key + TTL policy.
   +  searchVisibilityService.js   rank history read/write, keyword↔page mapping,
   +                           snapshot persistence. No HTTP, no SQL interpolation.
   +  correlationService.js    THE CORE. Joins traffic deltas with rank deltas and
   +                           AI-Overview citation changes → structured Finding +
   +                           plain-English sentence.
    queries/
   ~  queries.js               + getPageTrafficTrend(siteId, path, dateRange)
   ~                           + getPageTrafficWoW(siteId, path, weeks)
   ~                             (DuckDB, parameterized `?`, reads only)
    routes/
   +  searchVisibility.js      REST for the dashboard:
   +                             GET  /api/search/:siteId/overview
   +                             GET  /api/search/:siteId/rankings
   +                             GET  /api/search/:siteId/explain?path=
   +                             GET/POST/DELETE /api/search/:siteId/keywords
   +                           All behind authenticateToken + authorizeSiteAccess.
    mcp/tools/
   ~  registry.js              + get_rankings, get_ai_overview_citations,
   ~                           + get_related_queries, + explain_traffic_change
    schema/
   ~  schema.js                + DuckDB mirrors (read side) for serp_snapshots,
   ~                             rank_history if we want them queryable in SQL Editor
    sync/
   ~  (sync config)            + the two new tables in the PG→DuckDB sync list
  scripts/
   ~  migrate.js               + page_keywords, serp_snapshots, rank_history
   +  seedKeywords.js          demo seeding: map demo pages → target keywords
   ~  .env.example             + SERPAPI_KEY, SERPAPI_* tuning vars

apps/dashboard-web/src/
  pages/
   +  SearchVisibility.jsx     the one dashboard view
  components/search/
   +  RankTrafficPanel.jsx     per-page row: traffic sparkline + rank + AI-O badge
   +  ExplanationCard.jsx      the plain-English finding, with its evidence
   +  AiOverviewBadge.jsx      cited / not-cited / no-AI-Overview (dark-mode aware)
   +  KeywordManager.jsx       map a page → its target keyword(s)
  hooks/
   ~  useAnalytics.js          + useSearchVisibility, useExplanation
                               (rule 7: components never call axios directly)

docs/
   +  search-visibility-connector.md   ← this file, kept current (rule 8)
   ~  mcp-toolkit.md                   + the four new tools in the catalogue

.claude/skills/insighttrack/
   ~  SKILL.md + references/architecture.md   + the correlation layer
```

**Why the service split is three files, not one:** `client.js` is the only
module holding the API key and the only one doing network I/O — it is trivially
mockable, which makes the whole correlation layer unit-testable without spending
credits. `searchVisibilityService.js` owns persistence. `correlationService.js`
is pure logic over two inputs (traffic rows, rank rows) and therefore fully
testable with fixtures. That separation is what lets the demo run offline.

---

## 3. MCP tool schemas (exact JSON)

These slot into `TOOLS` in `src/mcp/tools/registry.js` and follow the existing
contract there: `{ name, description, inputSchema, run(args, ctx) }` returning
the **result envelope** `{ summary, data, render, download, deepLink }`.

`additionalProperties: false` throughout, matching the existing `schema()`
helper. Note these tools take a `domain` implicitly from `ctx.siteId`'s site
record where possible — an explicit `domain` arg is an override, so the agent
does not have to know it.

### 3.1 `get_rankings`

```json
{
  "name": "get_rankings",
  "description": "Get the current Google organic search position for a domain on a given keyword, plus the top ~10 competing URLs ranked above/around it. Live SERP data from SerpApi, cached. Use for 'where do I rank for X', 'who outranks me', 'did my position change'. If `domain` is omitted it defaults to the current site's domain.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "keyword": {
        "type": "string",
        "minLength": 1,
        "maxLength": 200,
        "description": "The search query to check, e.g. 'free email templates'."
      },
      "domain": {
        "type": "string",
        "maxLength": 253,
        "description": "Domain to locate in the results, e.g. 'example.com'. Defaults to the current site's domain."
      },
      "location": {
        "type": "string",
        "maxLength": 100,
        "description": "Geographic location for the search, e.g. 'United States'. Defaults to 'United States'."
      },
      "device": {
        "type": "string",
        "enum": ["desktop", "mobile"],
        "description": "Which SERP to fetch. Defaults to 'desktop'."
      },
      "maxAgeHours": {
        "type": "integer",
        "minimum": 0,
        "maximum": 168,
        "description": "Accept a cached snapshot up to this many hours old before spending a SerpApi credit. Defaults to 24."
      }
    },
    "required": ["keyword"],
    "additionalProperties": false
  }
}
```

**Returns** (`data`):
```json
{
  "keyword": "free email templates",
  "domain": "example.com",
  "position": 6,
  "previousPosition": 3,
  "positionChange": -3,
  "changeObservedAt": "2026-09-09T00:00:00Z",
  "url": "https://example.com/guides/email-templates",
  "found": true,
  "totalResults": 48200000,
  "competitors": [
    { "position": 1, "domain": "competitorx.com", "url": "https://…", "title": "…" }
  ],
  "serpFeatures": ["ai_overview", "people_also_ask", "featured_snippet"],
  "fetchedAt": "2026-09-16T09:12:00Z",
  "cached": true
}
```
`render: { type: "table", columns: ["position","domain","title"] }`,
`deepLink: { label: "Open Search Visibility", to: "/search?keyword=…" }`.
`found: false` with `position: null` when the domain is outside the top 100 —
an explicit "not ranking", never a silent zero.

### 3.2 `get_ai_overview_citations`

```json
{
  "name": "get_ai_overview_citations",
  "description": "Check whether Google shows an AI Overview for a keyword and, if so, which domains and URLs it cites. Use for 'does an AI Overview appear for X', 'am I cited in the AI answer', 'who does Google's AI cite instead of me'. An AI Overview that cites competitors but not you is a common cause of clicks falling while rank holds steady.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "keyword": {
        "type": "string",
        "minLength": 1,
        "maxLength": 200,
        "description": "The search query to check."
      },
      "domain": {
        "type": "string",
        "maxLength": 253,
        "description": "Domain to check for citation. Defaults to the current site's domain."
      },
      "location": {
        "type": "string",
        "maxLength": 100,
        "description": "Geographic location for the search. Defaults to 'United States'."
      },
      "maxAgeHours": {
        "type": "integer",
        "minimum": 0,
        "maximum": 168,
        "description": "Accept a cached snapshot up to this many hours old. Defaults to 24."
      }
    },
    "required": ["keyword"],
    "additionalProperties": false
  }
}
```

**Returns** (`data`):
```json
{
  "keyword": "free email templates",
  "hasAiOverview": true,
  "domainIsCited": false,
  "previouslyCited": true,
  "citationChange": "lost",
  "citations": [
    { "position": 1, "domain": "competitorx.com", "url": "https://…", "title": "…" },
    { "position": 2, "domain": "competitory.com", "url": "https://…", "title": "…" }
  ],
  "appearedAt": "2026-09-10T00:00:00Z",
  "fetchedAt": "2026-09-16T09:12:00Z",
  "cached": true
}
```
`citationChange` ∈ `"gained" | "lost" | "unchanged" | "new_overview" | "unknown"`.
`"new_overview"` — no AI Overview in the prior snapshot, one now — is the single
highest-signal cause of a rank-stable traffic drop, so it is a first-class value
rather than something the model has to infer.

### 3.3 `get_related_queries`

```json
{
  "name": "get_related_queries",
  "description": "Get keyword-expansion ideas for a search term: Google's 'People also ask' questions and its related searches. Use for 'what else are people searching', 'keyword ideas for X', 'what questions should this page answer'. Useful after a traffic drop to find the queries a competitor may now be capturing.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "keyword": {
        "type": "string",
        "minLength": 1,
        "maxLength": 200,
        "description": "The seed search query to expand."
      },
      "location": {
        "type": "string",
        "maxLength": 100,
        "description": "Geographic location for the search. Defaults to 'United States'."
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 50,
        "description": "Maximum items per group (questions, related searches). Defaults to 10."
      },
      "maxAgeHours": {
        "type": "integer",
        "minimum": 0,
        "maximum": 168,
        "description": "Accept a cached snapshot up to this many hours old. Defaults to 72."
      }
    },
    "required": ["keyword"],
    "additionalProperties": false
  }
}
```

**Returns** (`data`):
```json
{
  "keyword": "free email templates",
  "peopleAlsoAsk": [
    { "question": "Are there free email templates in Gmail?", "snippet": "…", "sourceDomain": "…" }
  ],
  "relatedSearches": [
    { "query": "free html email templates", "link": "https://…" }
  ],
  "fetchedAt": "2026-09-16T09:12:00Z",
  "cached": true
}
```
Longer default TTL (72h) than the ranking tools — PAA and related searches drift
far more slowly than positions, so this should almost never cost a credit twice.

### 3.4 `explain_traffic_change` — the reason the project exists

The three tools above are inputs. This is the deliverable: one call, one
sentence, evidence attached.

```json
{
  "name": "explain_traffic_change",
  "description": "Explain WHY traffic to a specific page went up or down, by joining InsightTrack's first-party traffic trend with live Google SERP data. Detects the week-over-week change, then checks that page's target keywords for rank movement and AI Overview citation changes, and returns a plain-English explanation with the supporting evidence. Use for 'why did traffic to /page drop', 'what happened to this page', 'explain the drop last week'. This is the tool to reach for whenever the user asks WHY traffic changed — get_top_pages alone cannot answer that.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "minLength": 1,
        "maxLength": 2048,
        "description": "The page path to explain, e.g. '/guides/email-templates'."
      },
      "keywords": {
        "type": "array",
        "items": { "type": "string", "minLength": 1, "maxLength": 200 },
        "maxItems": 5,
        "description": "Target keywords for this page. If omitted, uses the keywords mapped to this page in InsightTrack; if none are mapped, infers from the page's top search terms."
      },
      "dateRange": {
        "type": "string",
        "description": "Traffic window to analyse. Defaults to '90d' — short windows give unreliable page-level data, so prefer the default."
      },
      "location": {
        "type": "string",
        "maxLength": 100,
        "description": "Geographic location for the SERP checks. Defaults to 'United States'."
      }
    },
    "required": ["path"],
    "additionalProperties": false
  }
}
```

**Returns** (`data`):
```json
{
  "path": "/guides/email-templates",
  "traffic": {
    "currentWeek": 412,
    "previousWeek": 615,
    "changePct": -33.0,
    "direction": "drop",
    "significant": true,
    "windowUsed": "90d",
    "weeks": [{ "weekStart": "2026-06-22", "views": 590 }]
  },
  "keywordFindings": [
    {
      "keyword": "free email templates",
      "position": 6,
      "previousPosition": 3,
      "positionChange": -3,
      "hasAiOverview": true,
      "domainIsCited": false,
      "citationChange": "new_overview",
      "newCitedDomains": ["competitorx.com", "competitory.com"],
      "contribution": "primary"
    }
  ],
  "explanation": "Traffic to /guides/email-templates dropped 33% this week (615 → 412 views). Likely cause: rank slipped #3 → #6 on 'free email templates', and a new AI Overview now cites competitorx.com and competitory.com instead of you.",
  "confidence": "high",
  "caveats": [],
  "evidence": { "trafficSource": "InsightTrack / DuckDB", "serpSource": "SerpApi", "serpFetchedAt": "2026-09-16T09:12:00Z" }
}
```
`render: { type: "chart", chart: "line" }` — the weekly series, with the
explanation as the `summary` the model speaks aloud.
`confidence` ∈ `"high" | "medium" | "low"`, derived in §4.4 — the tool states
when it *cannot* explain a change rather than inventing a cause.

---

## 4. Correlation engine

`correlationService.js` is pure: `(trafficWeeks, keywordFindings) → Finding`.
No I/O, so it is fully unit-testable against fixtures, and the demo can run
without a live SerpApi key.

### 4.1 Detect the change
Bucket the 90-day daily series into ISO weeks. Compare the last complete week to
the one before it. A change is **significant** when it clears **both** a relative
and an absolute floor: `|changePct| ≥ 15%` **and** `|Δviews| ≥ 20`. The absolute
floor is what stops "3 views → 6 views, traffic doubled!" from being reported as
a finding — the single most common way a correlation demo embarrasses itself.

### 4.2 Gather SERP evidence
For each mapped keyword (max 5), fetch rank + AI-Overview status, and read the
previous snapshot from `rank_history` to compute deltas. All of it flows through
the cache in §6.

### 4.3 Attribute a cause
Rules, evaluated in order; the first match sets the primary cause and the rest
attach as contributing factors. Rules — not an LLM — because the judge should see
a deterministic, auditable join, and because it makes the tool honest when the
evidence is thin.

| # | Condition | Cause | Sentence fragment |
|---|---|---|---|
| 1 | rank worsened ≥ 3 positions | `rank_drop` | "rank slipped #A → #B on 'kw'" |
| 2 | AI Overview is new and you are not cited | `ai_overview_displacement` | "a new AI Overview now cites X and Y instead of you" |
| 3 | you were cited, now are not | `ai_citation_lost` | "you were dropped from the AI Overview for 'kw'" |
| 4 | rank improved ≥ 3 positions (on a spike) | `rank_gain` | "rank improved #B → #A on 'kw'" |
| 5 | you gained an AI Overview citation (on a spike) | `ai_citation_gained` | "the AI Overview for 'kw' now cites you" |
| 6 | fell out of the top 10 entirely | `page_one_exit` | "you dropped off page one for 'kw'" |
| 7 | traffic moved, SERP is flat | `unexplained_by_serp` | "search position and AI Overview status are unchanged, so the cause is probably not search — check referrers, campaigns, or a deploy" |

Rule 7 matters as much as the other six. A correlation tool that always finds a
SERP cause is a tool that is guessing.

### 4.4 Confidence
- **high** — significant traffic change **and** a rank or AI-Overview change in
  the same direction, with a prior snapshot ≤ 14 days old to compare against.
- **medium** — direction matches but the prior snapshot is stale, or only one of
  several keywords moved.
- **low** — no prior snapshot (first run for this keyword), or rule 7 fired.
  Caveats are emitted verbatim into `caveats[]` and into the spoken summary.

First-run honesty: with no `rank_history` row, there is no delta. The tool says
so — *"this is the first rank snapshot for 'kw', so I can't compare against last
week yet"* — and reports current standing only. The seed script backfills demo
history so the demo shows the full path.

### 4.5 Sentence assembly
Template-composed from the matched rules, not free-form generation, so the same
inputs always produce the same sentence:

```
Traffic to {path} {direction} {pct}% this week ({prev} → {curr} views).
{"Likely cause: " + causes.join(", and ") + "." | "No search-side cause found — " + hint}
```

---

## 5. Data model

Three new PostgreSQL tables (writes are PG-only, per rule 2). Added to
`scripts/migrate.js`; the read-side mirrors go into the DuckDB sync list so the
SQL Editor can query them too.

```sql
-- Which keyword(s) a page targets. The join key of the whole feature.
CREATE TABLE IF NOT EXISTS page_keywords (
    id          SERIAL PRIMARY KEY,
    site_id     TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    path        TEXT NOT NULL,
    keyword     TEXT NOT NULL,
    location    TEXT NOT NULL DEFAULT 'United States',
    is_primary  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (site_id, path, keyword, location)
);
CREATE INDEX IF NOT EXISTS idx_page_keywords_site_path ON page_keywords (site_id, path);

-- Raw-ish SerpApi response, normalized. The credit-conserving cache of record.
CREATE TABLE IF NOT EXISTS serp_snapshots (
    id            SERIAL PRIMARY KEY,
    keyword       TEXT NOT NULL,
    location      TEXT NOT NULL DEFAULT 'United States',
    device        TEXT NOT NULL DEFAULT 'desktop',
    engine        TEXT NOT NULL DEFAULT 'google',
    organic       JSONB NOT NULL,      -- [{position, domain, url, title}]
    ai_overview   JSONB,               -- {present, citations:[…]} | null
    related       JSONB,               -- {peopleAlsoAsk:[…], relatedSearches:[…]}
    features      TEXT[],
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_serp_snapshots_lookup
    ON serp_snapshots (keyword, location, device, fetched_at DESC);

-- Per-site, per-keyword position over time. What makes "#3 → #6" possible.
CREATE TABLE IF NOT EXISTS rank_history (
    id            SERIAL PRIMARY KEY,
    site_id       TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    keyword       TEXT NOT NULL,
    location      TEXT NOT NULL DEFAULT 'United States',
    device        TEXT NOT NULL DEFAULT 'desktop',
    position      INTEGER,             -- NULL = not in the top 100
    url           TEXT,
    ai_overview   BOOLEAN NOT NULL DEFAULT false,
    is_cited      BOOLEAN NOT NULL DEFAULT false,
    checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    snapshot_id   INTEGER REFERENCES serp_snapshots(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_rank_history_lookup
    ON rank_history (site_id, keyword, location, checked_at DESC);
```

Every query parameterized — `$1` for PG, `?` for DuckDB (rule 1). `serp_snapshots`
is deliberately *not* site-scoped: two sites tracking the same keyword share one
snapshot and one credit. `rank_history` *is* site-scoped, because position is a
property of the site.

---

## 6. Caching & credit conservation

Four layers, cheapest first. A repeated demo question costs **zero** credits.

| Layer | Lifetime | Purpose |
|---|---|---|
| `analyticsCache.getOrFetch` | `SERP` TTL, default 15 min | Kills duplicate calls inside one run; the existing coalescing means 10 concurrent asks fire **one** SerpApi request |
| `serp_snapshots` lookup | `maxAgeHours`, default 24h | The real credit saver — survives restarts |
| `rank_history` | forever | Deltas; never re-fetched |
| Fixture mode | `SERPAPI_KEY` unset | Serves `fixtures/serp/*.json`; the repo runs with **no key at all** |

New TTL entry alongside the existing ones in `services/cache.js`:
```js
SERP: parseInt(process.env.CACHE_TTL_SERP_MS) || 15 * 60_000,
```

Fixture mode is the deliberate answer to "judges weight a repo that runs." A
judge who clones the repo with no SerpApi key still gets the full correlation
demo end to end, with a clear `"source": "fixture"` marker on every response so
it is never mistaken for live data. With a key set, the identical code path goes
live.

**Guardrails:** a hard per-request cap of 5 keywords, a `SERPAPI_MAX_CALLS_PER_RUN`
ceiling, a 10s timeout, one retry on 5xx/429 with backoff, and a counter logged
per call so credit burn is visible during the demo.

---

## 7. Dashboard view

One new page — `/search` → `SearchVisibility.jsx`. Dark-mode via Tailwind `dark:`
variants (rule 6); all data through `useAnalytics.js` hooks (rule 7).

```
┌─ Search Visibility ──────────────────── [90d ▾] [United States ▾] ─┐
│                                                                    │
│  ⚠ 2 pages changed significantly this week                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ /guides/email-templates            ▼ 33%   615 → 412 views   │  │
│  │ ╭─ sparkline (12 weeks) ─────────────────────────────╮       │  │
│  │ │  ▁▂▃▅▆▇▇▆▅▃▂▁                                      │       │  │
│  │ ╰────────────────────────────────────────────────────╯       │  │
│  │ "free email templates"    #3 → #6  ▼3   [AI Overview: NOT   │  │
│  │                                          CITED · new]        │  │
│  │ ┌──────────────────────────────────────────────────────────┐ │  │
│  │ │ 💡 Traffic dropped 33% this week. Likely cause: rank      │ │  │
│  │ │    slipped #3 → #6 on 'free email templates', and a new  │ │  │
│  │ │    AI Overview now cites competitorx.com and             │ │  │
│  │ │    competitory.com instead of you.        confidence: high│ │  │
│  │ └──────────────────────────────────────────────────────────┘ │  │
│  │                                   [Ask Pulse about this →]   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  … one card per tracked page, biggest change first …               │
│                                          [Manage keywords ⚙]       │
└────────────────────────────────────────────────────────────────────┘
```

The layout puts traffic and SERP evidence on the **same card** — the point of the
project made visible. "Ask Pulse about this" hands the same question to the
existing AI panel, demonstrating both surfaces from one screen.

AI Overview badge states: **Cited** (green) · **Not cited** (amber) ·
**No AI Overview** (neutral) · **Lost citation** (red) — each with a text label,
never colour alone.

---

## 8. Demo path

One command, one question.

```bash
git clone … && cd InsightTrack
cp apps/analytics-api/.env.example apps/analytics-api/.env   # SERPAPI_KEY optional
docker-compose up --build                                    # ← the one command
```
Bootstrap runs migrations, seeds demo traffic, seeds keyword mappings, and
backfills `rank_history` so deltas exist on first load.

**The one question**, asked in the Pulse panel or Claude Desktop:

> *"Why did traffic to /guides/email-templates drop last week?"*

The agent calls `explain_traffic_change`, which internally joins
`get_page_traffic_trend` (InsightTrack/DuckDB) with `get_rankings` and
`get_ai_overview_citations` (SerpApi), and answers with the joined sentence plus
the weekly chart. Then `/search` in the dashboard shows the same finding
visually. Total judge time: about 90 seconds.

---

## 9. Known-quirk handling

| Quirk | Handling |
|---|---|
| `get_top_pages` unreliable at short windows | The new `dateRange` default is **90d** everywhere in this feature; the schema description says so, so the model does not choose `7d`. Weekly buckets are derived from the 90-day series rather than fetched as a short window. |
| `get_performance` CLS at thousands-scale | `normalizeCls()` in the shared util: values > 10 are treated as unscaled and divided by 1000, and **flagged** `clsSuspect: true` rather than silently corrected. Where this feature surfaces performance as a possible non-SERP cause (rule 7), it says "CLS reading looks anomalous — verify before acting" instead of asserting a cause from a bad number. |
| Domain not in top 100 | `position: null`, `found: false` — never a sentinel like `0` or `101` that a model would happily average. |
| SerpApi down / rate-limited | The tool returns the traffic half with `caveats: ["SERP data unavailable — explanation is traffic-only"]`. Degraded, never fabricated. |

---

## 10. Security

- `SERPAPI_KEY` from env only; read exclusively in `services/serpapi/client.js`;
  never returned in any API response and never sent to the browser.
- `.env.example` documents the key with a placeholder; `.env` stays gitignored.
- All new REST routes carry `authenticateToken` + `authorizeSiteAccess` (rule 4);
  none of them is in the tracking/auth exemption list.
- MCP tools inherit `ctx.siteId` scoping — a tool cannot widen to a site the
  user lacks access to, exactly as the existing tools behave.
- Keyword input is bounded (`maxLength: 200`) and passed as a query **parameter**
  to SerpApi, and as a parameterized value to PG/DuckDB (rule 1).
- Outbound host is pinned to `serpapi.com`; no user-controlled URL fetching.
- Tool results flow through the existing `capToolData` cap, so a wide SERP
  payload cannot blow the context budget.

### 10.1 Public-repo gate (new — because `InsightTrack` is public and `traffic` is private)

`traffic` has been private and live; `InsightTrack` is public and is what judges
clone. Anything that was safe to leave in a private production repo is *not*
safe to port outward. Before the first public push of this feature, and again at
P6, run:

```bash
# No SerpApi key, no production hostname, no credential-shaped string
git grep -nE 'serpapi[_-]?key\s*[:=]\s*["'\'']?[A-Za-z0-9]{20,}' -- apps appsv2
git grep -nEi '(api[_-]?key|secret|password|token)\s*[:=]\s*["'\''][^"'\''$]{12,}' -- apps appsv2
git check-ignore apps/analytics-api/.env appsv2/analytics-api/.env   # must print both
```

Rules for this feature:
- `SERPAPI_KEY` appears **only** as a placeholder in `.env.example` and as
  `process.env.SERPAPI_KEY` in `client.js`. Never a default value, never a
  fallback string, never in a test fixture.
- Fixtures in `fixtures/serp/*.json` are **scrubbed SerpApi responses** — check
  them for `search_metadata.id`, `search_metadata.json_endpoint` and any
  account-identifying field before committing; those embed your account.
- The demo seed uses a public demo domain, never a production hostname from
  `traffic`.

The direction of the port matters: code flows `apps/ → appsv2/ → traffic/`.
Never copy config or env files back from `traffic` into `apps/` — that is the
path by which a production secret would land in a public repo.

---

## 11. Build phases

| Phase | Deliverable | Verifiable by |
|---|---|---|
| **P0** | Migrations, `.env.example`, fixtures, SerpApi client + normalizer | `npm run migrate`; unit tests green against fixtures, zero credits spent |
| **P1** | `get_rankings`, `get_ai_overview_citations`, `get_related_queries` in the registry | `GET /api/mcp/tools` lists them; callable from the Pulse panel |
| **P2** | `getPageTrafficTrend` + `getPageTrafficWoW` DuckDB queries | Unit tests on seeded demo data |
| **P3** | `correlationService.js` + `explain_traffic_change` | Fixture-driven tests for all 7 rules and all 3 confidence levels |
| **P4** | REST routes + `SearchVisibility.jsx` + hooks | `/search` renders; dark mode verified |
| **P5** | Seed script, README quickstart, docker one-command path | Clean clone → `docker-compose up` → demo question answers |
| **P6a** | Port to `appsv2/` (same public repo); update `docs/` + skill (rules 8, 9) | `diff -r` clean between `apps/` and `appsv2/` |
| **P6b** | Port to `traffic/` (private, **live**) — **after the demo** | Secret gate §10.1 passes; three copies byte-identical |

Phases P0–P3 are the project; P4–P5 make it demonstrable; P6a–P6b satisfy rule 9.
P6b is scheduled **after** the hackathon demo on purpose — see §0.1. The
judge-facing clone only ever needs `apps/`.

---

## 12. Open questions for you

~~1. **Public repo**~~ — **CLOSED.** `NishikantaRay/InsightTrack` is already
   PUBLIC and `NishikantaRay/traffic` is PRIVATE + live (verified via `gh`). So
   no extraction: `apps/` in the existing public repo is the deliverable, and
   the secret gate in §10.1 guards the public boundary. See §0.

~~4. **Rule 9 sync timing**~~ — **CLOSED.** Split into P6a (`appsv2/`, same
   public repo, low risk) and P6b (`traffic/`, private + live, **after the
   demo**). See §0.1.

Still open:

1. **Demo domain** — which domain should the demo track? Two sub-questions now
   that I know `traffic` is the live one:
   - Is the live site behind `traffic` the one that actually has Google
     rankings? If so it's the most convincing demo — but its hostname would
     then appear in the public repo's seed data. Fine if the site is public
     anyway; confirm that's OK.
   - Otherwise I'll seed a neutral public domain and lean on fixtures.
2. **Scheduled rank checks** — a daily cron to populate `rank_history`? Not
   needed for the demo (the seed backfills it) and it burns credits
   continuously. Recommendation: **skip for the hackathon**, note as roadmap.
3. **Does `traffic` need this feature at all?** Rule 9 says keep three copies
   identical, so P6b ports it. But it's a hackathon feature that makes outbound
   paid API calls, and production may not want it enabled. Options: port the
   code but leave it dark behind an unset `SERPAPI_KEY` (my recommendation — the
   fixture-mode fallback means it degrades safely), or skip `traffic` entirely
   and accept a documented rule-9 exception.

---

---

## 13. What shipped

All phases P0–P6 are complete. Files as built (paths relative to `apps/`; the
same files exist in `appsv2/` and in `traffic/` under its directory names):

| Area | File | Notes |
|---|---|---|
| Schema | `analytics-api/src/db/postgres.js` | `page_keywords`, `serp_snapshots`, `rank_history` |
| SerpApi | `analytics-api/src/services/serpapi/client.js` | Only file holding the key or doing network I/O; fixture mode |
| SerpApi | `analytics-api/src/services/serpapi/normalize.js` | Pure; raw JSON → stable shapes |
| Fixtures | `analytics-api/fixtures/serp/*.json` | Scrubbed; no account-identifying fields |
| Persistence | `analytics-api/src/services/searchVisibilityService.js` | Keyword mapping, snapshot cache, rank history |
| **Correlation** | `analytics-api/src/services/correlationService.js` | **Pure. The 7 rules + confidence.** |
| Queries | `analytics-api/src/queries/queries.js` | `getPageTrafficTrend`, `getPageTrafficWoW` |
| MCP tools | `analytics-api/src/mcp/tools/registry.js` | 4 tools; auto-exposed over MCP |
| OpenAPI | `analytics-api/src/mcp/openapi/insighttrack-spec.js` | 4 operations (drift test enforces parity) |
| REST | `analytics-api/src/routes/searchVisibility.js` | Mounted at `/api/search` |
| Seed | `analytics-api/scripts/seedSearchVisibility.js` | `npm run seed:search` |
| Dashboard | `dashboard-web/src/pages/SearchVisibility.jsx` | Route `/search` |
| Components | `dashboard-web/src/components/search/*.jsx` | Panel, explanation, badge, keyword manager |
| Hooks | `dashboard-web/src/hooks/useAnalytics.js` | `useSearchVisibility`, `useSearchExplanation`, … |

### Tests

| Suite | Tests | Covers |
|---|---|---|
| `tests/correlationService.test.js` | 22 | All 7 attribution rules, 3 confidence levels, both significance floors, the partial-week guard |
| `tests/serpapi.test.js` | 14 | Fixture mode, normalizer, domain matching, no-sentinel contract |
| `tests/mcpRegistry.test.js` | +7 | The 4 new tools, the joined sentence, required-arg rejection |

All run with no PostgreSQL, no network and no SerpApi key.

### Deviations from the plan

1. **A fourth MCP tool.** The brief asked for three; `explain_traffic_change` was
   added because the other three are only inputs — without it the correlation
   exists only in a prompt rather than as a callable surface.
2. **`requireArg` guard.** Not in the plan. The repo's envelope test calls every
   tool with no arguments, which exposed that a model omitting a required field
   would get an opaque `TypeError` from inside a template literal instead of a
   message naming what it forgot.
3. **OpenAPI operations added.** The repo enforces a registry↔spec drift test, so
   the four tools needed matching spec entries. Not anticipated in §2.
4. **`traffic/` ported immediately** rather than after the demo (§0.1), at the
   user's instruction. Mitigated by shipping it dark: with no `SERPAPI_KEY` set
   the feature makes no outbound calls.

### Judge-facing quickstart

```bash
git clone https://github.com/NishikantaRay/InsightTrack
cd InsightTrack && docker-compose up --build
```
Then ask, in the Pulse panel or Claude Desktop:
> *"Why did traffic to /guides/email-templates drop last week?"*

No SerpApi key required — fixture mode serves sample SERPs and labels them as
such in the UI.
