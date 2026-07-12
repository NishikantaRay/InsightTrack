# InsightTrack vs PostHog — Feature Gap Analysis

> A code-verified comparison of what InsightTrack ships today against PostHog's
> product surface, plus a prioritized view of what's missing. Produced
> 2026-07-07 from the actual codebase (pages, routes, query layer, tracker
> script, DB schema) — not marketing copy.
>
> **The headline:** InsightTrack and PostHog are different *classes* of product.
> InsightTrack is a **privacy-first web-analytics** tool (the Plausible / Fathom
> / Simple Analytics category) with an unusually deep dashboard set, an AI
> Analyst, and an MCP integration. PostHog is a **product-analytics platform**
> (the Amplitude / Mixpanel + LaunchDarkly + FullStory + Optimizely category).
> Most of the "gaps" below are things InsightTrack deliberately isn't — but a
> few are natural, high-value extensions of what it already has.

---

## 1. What InsightTrack already does (verified in code)

A genuinely broad web-analytics surface. Every item here maps to a real page,
route, and query function.

### Core traffic & audience
- **KPIs** — visitors, pageviews, bounce rate, avg session, trends vs. prior period (`getKPISummary`)
- **Traffic over time** — visitors/sessions/pageviews time-series (`getTrafficOverTime`, `getPageViewsOverTime`)
- **Top / entry / exit pages** (`getTopPages`, `getEntryPages`, `getExitPages`)
- **Traffic sources & channels** — direct/search/social/referral/email (`getTrafficSources`, `getSocialMediaTraffic`, `getSearchKeywords`)
- **Devices, browsers, OS** (`getDeviceBreakdown`, `getVisitorSegments`)
- **Geography** — countries, cities, a geo map (`getCountries`, `getTrafficByCity`, `getGeoMap`, `getSessionsByCity`)
- **New vs returning, retention, cohort heatmap** (`getNewVsReturning`, `getUserRetention`, `getCohortAnalysis`)
- **Daily active users, hourly traffic, session-duration buckets** (`getDailyActiveUsers`, `getHourlyTraffic`, `getSessionBuckets`)

### Acquisition & campaigns
- **UTM campaign performance** + a campaign dashboard (`getUTMCampaigns`, `getCampaignDashboard`)
- **UTM link builder** with per-link stats (`utm_links` table, `getUTMLinkStats`)

### Engagement & behavior
- **Heatmaps** — click heatmap + per-page action detail (`getHeatmapData`, `getHeatmapSummary`, `getPageActions`)
- **Scroll depth, rage clicks, time-on-page** (`getScrollDepth`, `getRageClicks`, `getTimeOnPage`, `getEngagementSummary`)
- **User flow** — page-to-page transitions, entry/exit (`getUserFlow`)
- **Site search** analytics (`getSiteSearchQueries`)

### Conversions
- **Goals** — `page_visit` and `event` goal types, conversion rate, over-time (`getGoalConversions`, `getGoalConversionsOverTime`)
- **Funnels** — multi-step with per-step drop-off, configurable steps (`getFunnelData`, `getAvailableFunnelSteps`)
- **A/B test results** — variant reporting against a goal (`ab_tests` table, `getABTestResults`)
- **Revenue attribution** by channel (`getRevenueAttribution`)

### Performance & quality
- **Core Web Vitals** — LCP, CLS, INP, FCP, TTFB with avg + p75 (`getWebVitals`, `getWebVitalsOverview`)
- **JavaScript error tracking** — message, source, occurrences, affected users, over-time (`getJSErrors`, `getJSErrorsOverTime`)

### Realtime
- **Live visitors** + a **realtime event stream** (`getRealTimeVisitors`, `getRealtimeEventStream`)

### Platform & workflow
- **Custom dashboards** (drag/drop widgets — `custom_dashboards`)
- **Reporting studio** with **scheduled email reports** (`report_schedules`, `reportingService`)
- **SQL editor** — read-only DuckDB with saved queries + audit log (`sql_saved_queries`, `sql_query_audits`)
- **AI Analyst** — 17-tool NL assistant with streaming, BYO keys (Anthropic/OpenAI/Gemini), thread history
- **MCP integration** — stdio + remote Streamable-HTTP transports (Claude Desktop / Cursor / web)
- **Alerts** (`getAlerts`), **annotations** (`annotations`)
- **Multi-user teams** — sites, roles (owner/admin/viewer), custom roles, invitations, shared dashboards
- **Data retention policies** (`data_retention_policies`)
- **Exports** — CSV / JSON / PNG / print (`exportUtils`)

### Tracker (autocapture, verified in the generated script)
Captures out of the box: pageviews (SPA-aware via `popstate`), clicks (+ heatmap
coordinates), scroll depth, rage clicks, form submits, site search, time-on-page
(on `visibilitychange`/`beforeunload`), Web Vitals (`PerformanceObserver`), and
JS errors (`error` + `unhandledrejection`). Uses `sendBeacon`, a `localStorage`
visitor id, dependency-free.

---

## 2. The architectural fault line

One design fact explains most of the gap:

> **InsightTrack has no person/identity model.** A visitor is a
> `localStorage`-generated `user_id` scoped to one browser on one site. There is
> no `identify()`, no cross-device stitching, no server-side person merge, no
> user properties, and no group (account/company) analytics.

PostHog is built around the opposite: an **event stream keyed to a Person**
(with `distinct_id` merging, person + group properties, and a full activity
timeline). Nearly every PostHog feature that InsightTrack lacks — session replay
tied to a person, feature-flag targeting by property, cohorts as reusable
segments, experiment assignment — depends on that person graph.

InsightTrack is **session/pageview-first**; PostHog is **person/event-first**.
Neither is wrong; they serve different jobs.

---

## 3. What PostHog has that InsightTrack is missing

Grouped by product area. **Impact** = how much it would change what InsightTrack
*is*. **Fit** = how naturally it extends the current architecture.

### A. Product-analytics primitives

| PostHog feature | InsightTrack today | Gap | Fit |
|---|---|---|---|
| **Persons & identity** (`identify`, distinct-id merge, person properties) | Anonymous per-browser `user_id` only | ✱✱✱ core primitive | Hard — needs a persons table + merge logic + tracker `identify()` |
| **Custom events with arbitrary properties** | `properties` JSONB column exists but the tracker only emits fixed autocapture types; no `capture(name, props)` API | ✱✱✱ | **Good** — column + ingestion exist; add a public `capture()` in the tracker |
| **Trends / insight builder** (ad-hoc event graphs, breakdowns, formulas) | Fixed prebuilt dashboards only; SQL editor is the escape hatch | ✱✱ | Medium — a query builder UI over the event stream |
| **Cohorts as reusable segments** (define once, use in funnels/trends/flags) | A cohort *retention heatmap* only — not saved, reusable segments | ✱✱ | Medium — a `cohorts` table + segment engine |
| **Lifecycle / stickiness / retention insights** | Retention + cohort exist; no lifecycle (new/returning/resurrecting/dormant) or stickiness | ✱ | **Good** — same event data |
| **Group analytics** (company/account-level, B2B) | None | ✱✱ | Hard — needs the group model |

### B. Session replay & debugging

| PostHog feature | InsightTrack today | Gap | Fit |
|---|---|---|---|
| **Session replay** (rrweb DOM recording, playback, console/network) | None — has heatmaps + rage clicks but no replay | ✱✱✱ flagship | Hard — rrweb capture, blob storage, player, privacy masking |
| **Error tracking with stack traces, grouping, alerts** | JS errors captured + listed, but no grouping/fingerprinting, source maps, or issue workflow | ✱✱ | **Good** — errors already ingested; add grouping + source maps |
| **Web/console/network capture in replays** | None | ✱✱ | Depends on replay |

### C. Experimentation & feature management

| PostHog feature | InsightTrack today | Gap | Fit |
|---|---|---|---|
| **Feature flags** (targeting, rollout %, kill switch, SDK) | None | ✱✱✱ | Medium — a flags table + evaluation endpoint + tracker/SDK read; no person model strictly required for % rollouts |
| **Experiments / A-B testing engine** (assignment, significance, guardrails) | `ab_tests` *reporting* only — no assignment engine or stats significance | ✱✱ | Medium — pairs with feature flags |
| **Multivariate & holdouts** | None | ✱ | Depends on the experiment engine |

### D. Surveys & feedback

| PostHog feature | InsightTrack today | Gap | Fit |
|---|---|---|---|
| **Surveys** (NPS, in-app popups, targeting, results) | None | ✱✱ | Medium — a surveys table + tracker widget + targeting |

### E. Data platform & integrations

| PostHog feature | InsightTrack today | Gap | Fit |
|---|---|---|---|
| **Data warehouse / external sources** (import Stripe, Postgres, etc. as queryable tables) | DuckDB is internal-only; no external-source import | ✱✱ | Medium — DuckDB *can* attach external Parquet/Postgres; the SQL editor is a foothold |
| **Reverse ETL / destinations / webhooks** (send events to Slack, warehouses, CDPs) | None — no outbound webhooks or destinations | ✱✱ | **Good** — a destinations/webhook worker off the event stream |
| **Ingestion pipeline / transformations** (filter, mask, enrich at ingest) | Fixed ingestion in `trackingService`; no user-defined transforms | ✱ | Medium |
| **Public query / export API** (programmatic access, API keys) | Dashboards + AI + MCP, but no REST **query** API with API keys for BI tools | ✱✱ | **Good** — the query layer + OpenAPI spec already exist; add key-scoped read endpoints |
| **CDP / person profiles enrichment** | None | ✱ | Hard |

### F. SDKs & platform coverage

| PostHog feature | InsightTrack today | Gap | Fit |
|---|---|---|---|
| **Client SDKs** (React, iOS/Android, Node, Python, Go, Flutter, RN…) | One dependency-free JS snippet | ✱✱ | Medium — a `capture()` API first, then thin SDKs |
| **Server-side capture** | None (browser-only) | ✱✱ | **Good** — the ingest endpoint exists; document server usage + a Node helper |
| **Reverse proxy / first-party ingestion guidance** | Same-origin only | ✱ | Docs |

### G. Governance, scale & ops

| PostHog feature | InsightTrack today | Gap | Fit |
|---|---|---|---|
| **Autocapture toggle & event definitions/taxonomy** (manage event & property schemas) | Fixed autocapture; no taxonomy management | ✱ | Medium |
| **Data management** (property definitions, ingestion warnings) | Retention policies only | ✱ | Medium |
| **Column-level access / advanced RBAC** | owner/admin/viewer + custom roles per site | partial | Already decent |
| **Billing / usage limits / quotas** | Usage *metering* table exists (`assistant_usage` for AI); no product-wide event quotas | ✱ | **Good** — extend metering |
| **ClickHouse-scale ingestion** | PostgreSQL writes → DuckDB reads (single-node) | ✱✱ at very high volume | Hard — a different storage tier |

---

## 4. Where InsightTrack is actually *ahead* of PostHog

Worth stating — this isn't a one-way comparison:

- **AI Analyst** — a native, in-dashboard NL assistant with 17 analytics tools,
  token streaming, BYO keys across three providers, and thread memory. PostHog
  has "Max AI" but InsightTrack's is unusually deep and self-hostable on your
  own key.
- **MCP integration** — first-class stdio **and** remote Streamable-HTTP MCP so
  Claude/Cursor query your analytics directly. PostHog has an MCP server too,
  but this is a genuine peer feature, not a gap.
- **Privacy-first by default** — no cross-site identity, `localStorage` id,
  cookieless-friendly. This is a deliberate positioning advantage over PostHog's
  heavier footprint for the "just web analytics, GDPR-simple" buyer.
- **Simplicity & self-host footprint** — Postgres + DuckDB, no ClickHouse/Kafka
  to operate.
- **Built-in Web Vitals + heatmaps + rage clicks** in the core product without a
  separate replay product.

---

## 5. Recommended roadmap (if closing the gap is the goal)

Ordered by **value ÷ effort**, favoring things that fit the current architecture.
These would move InsightTrack from "great web analytics" toward "lightweight
product analytics" without becoming PostHog.

**Tier 1 — high value, strong fit (the event stream is already there):**
1. **Public `capture(event, properties)` API in the tracker** + a documented
   ingest contract. Unlocks custom events, which everything else builds on. The
   `properties` JSONB column and ingestion already exist.
2. **Server-side capture** + a tiny Node helper. The ingest endpoint already
   accepts events; just document and wrap it.
3. **Ad-hoc trends / insight builder** — a query-builder UI over events with
   breakdowns. The SQL editor proves the data supports it.
4. **Error grouping + source maps** — fingerprint the JS errors already
   captured, add an issues view. Small step from today's error list.
5. **Outbound webhooks / destinations** — a worker that forwards events to
   Slack/HTTP. Pairs with the existing alerts.
6. **Key-scoped read/query API** — expose the query layer (already OpenAPI-spec'd)
   for BI tools with API keys.

**Tier 2 — high value, medium effort:**
7. **Persons/identity** (`identify`, distinct-id merge, person properties) — the
   keystone for real product analytics; unblocks cohorts-as-segments, group
   analytics, and per-person timelines.
8. **Feature flags** — a flags table + evaluation endpoint + tracker read; %
   rollouts don't strictly need the person model.
9. **Reusable cohorts/segments** — promote the existing cohort work into saved,
   reusable segments usable in funnels/trends.
10. **Surveys** — a surveys table + a small tracker widget + targeting.

**Tier 3 — flagship but heavy (a different product bet):**
11. **Session replay** (rrweb capture + storage + player + masking) — the single
    biggest PostHog draw and the biggest build; needs blob storage and careful
    privacy work.
12. **Experiments engine** (assignment + significance) — pairs with feature flags.
13. **Data-warehouse sources** — attach external Postgres/Parquet in DuckDB and
    surface them in the SQL editor / trends.
14. **Group (B2B) analytics** — depends on the person/group model.

**Explicitly consider NOT building** (they fight the positioning): full CDP,
ClickHouse-scale ingestion, and a sprawling SDK matrix. InsightTrack's edge is
being the simple, private, AI-native alternative — chasing PostHog feature-for-
feature would erase that.

---

## 6. One-line summary per category

| Category | Verdict |
|---|---|
| Web analytics (traffic/audience/acquisition/geo) | **At parity or ahead** of PostHog's web-analytics module |
| Engagement (heatmaps, scroll, rage, flow) | **Ahead** — bundled, no separate product |
| Conversions (goals, funnels, A/B reporting) | **Solid**, but experiments lack an assignment/stats engine |
| Performance & error tracking | **Present**; errors lack grouping/source-maps/issue workflow |
| Product analytics (persons, custom events, trends, cohorts) | **Major gap** — pageview-first, no identity model |
| Session replay | **Missing** — PostHog flagship |
| Feature flags / experiments | **Missing** |
| Surveys | **Missing** |
| Data platform (warehouse, reverse ETL, query API, SDKs) | **Mostly missing**; a read API + webhooks are quick wins |
| AI & MCP | **Ahead** — native AI Analyst + dual-transport MCP |
| Privacy & self-host simplicity | **Ahead** — deliberate positioning advantage |
