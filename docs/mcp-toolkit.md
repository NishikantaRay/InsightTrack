# InsightsTrack AI Analyst (MCP) — Complete Plan & Architecture

> The vision: a **built-in AI analyst** users chat with **inside the dashboard**.
> They ask questions in plain English; the AI queries our real analytics APIs and
> answers **right in a sidebar/chat panel** — rendering charts, offering CSV/data
> downloads, and giving one-click deep-links to the matching dashboard page. It
> remembers the conversation. The same tools are also exposed as a standard **MCP
> server** so power users can use Claude Desktop / Cursor. Goal: the user should
> rarely need to leave the panel — it's enough on its own.
>
> Applies to all three layouts (`traffic2/apps`, `traffic2/appsv2`, `traffic`).

---

## Table of contents
1. [What we're building](#1-what-were-building)
2. [How MCP fits in](#2-how-mcp-fits-in)
3. [Product experience (what the user sees)](#3-product-experience-what-the-user-sees)
4. [Architecture](#4-architecture)
5. [The tool layer (our readable APIs → AI tools)](#5-the-tool-layer-our-readable-apis--ai-tools)
6. [Rich results: charts, CSV, deep-links](#6-rich-results-charts-csv-deep-links)
7. [Memory](#7-memory)
8. [AI provider strategy (server key + BYO key)](#8-ai-provider-strategy-server-key--byo-key)
9. [Current state (what's already built)](#9-current-state-whats-already-built)
10. [The full build plan (phases)](#10-the-full-build-plan-phases)
11. [Security model](#11-security-model)
12. [Future roadmap](#12-future-roadmap)
13. [What you need to learn](#13-what-you-need-to-learn)
14. [Glossary](#14-glossary)

---

## 1. What we're building

Two connected things, sharing one tool layer:

1. **AI Analyst panel (primary, build first).** A chat/sidebar panel in our own
   dashboard. The user asks *"what were my top pages last week and how did
   conversions trend?"*; our backend runs an LLM with our analytics **tools**
   attached; the AI calls the tools, gets real data from DuckDB, and the panel
   renders the answer + a chart + a "Download CSV" button + a "→ Open Acquisition"
   deep-link. Conversation is remembered.

2. **MCP server (parallel).** The exact same tools exposed over the **Model
   Context Protocol**, so a user can instead connect **Claude Desktop / Cursor**
   and ask the same questions there.

Both are powered by **one shared tool registry** — write a tool once, it works in
the panel and over MCP.

---

## 2. How MCP fits in

**MCP (Model Context Protocol)** is the open standard for exposing "tools" (actions
an AI can call) to AI clients. We use it two ways:

- **Internally** — the in-dashboard panel calls the same tool definitions through
  our LLM. (You don't strictly need MCP for the in-app panel, but defining tools
  in an MCP-compatible shape means zero extra work to also serve them externally.)
- **Externally** — an MCP **server** advertises those tools so Claude Desktop,
  Cursor, or any MCP client can use them.

The engine we already have (`mcp-toolkit-core`) does the reusable heavy lifting:
**OpenAPI → tool definitions** and a **signed connect handshake**. We build the
tool registry on top of it and wire it into both surfaces.

---

## 3. Product experience (what the user sees)

- A **chat panel** — a collapsible right-side drawer (and/or a dedicated
  `/assistant` page) available from every dashboard page. A floating "Ask AI"
  button opens it.
- The user types a question. The panel streams the AI's reply.
- Inline in the reply, the AI can render **result cards**:
  - a **chart** (traffic line, sources donut, funnel, etc.),
  - a **data table** with a **Download CSV / JSON** button,
  - a **KPI stat**,
  - a **deep-link chip** ("→ Open Acquisition · last 7 days") that navigates the
    dashboard to the right page, pre-filtered.
- **Suggested prompts** on first open ("Top pages this week", "Where are visitors
  dropping off?", "How fast is my site?").
- **Memory**: previous turns stay in the thread; the thread persists per user, so
  reopening later resumes the conversation. Follow-ups work ("now break that down
  by country").
- A **Settings → AI** area: choose provider (our key or paste your own), see the
  tool catalogue, and copy the **Claude Desktop / Cursor** config if they'd rather
  use an external client.

Design: dark-mode first, matches existing panels, mobile-friendly (full-screen
sheet on phones).

---

## 4. Architecture

```
┌───────────────────────────── Dashboard (React) ─────────────────────────────┐
│  AI Analyst Panel (chat)                                                     │
│   • sends the conversation to  POST /api/assistant/chat  (SSE stream)        │
│   • renders text + result cards (chart / table+CSV / deep-link)              │
│   • reads/writes thread via  /api/assistant/threads                          │
└───────────────┬─────────────────────────────────────────────────────────────┘
                │  (streamed tokens + tool-result payloads)
                ▼
┌───────────── Backend: Assistant service (Express) ──────────────────────────┐
│  1. Loads the TOOL REGISTRY (shared)                                         │
│  2. Calls the LLM (Claude API / user's key) with tools attached             │
│  3. On a tool call → executes it against the ANALYTICS API (per-user token) │
│  4. Streams text back; returns structured tool results for rich cards        │
│  5. Persists the thread (memory) in PostgreSQL                               │
└───────────────┬───────────────────────────────┬─────────────────────────────┘
                │                                │
                ▼                                ▼
        Analytics API ──▶ DuckDB          MCP server (same registry)
        (readable endpoints)              stdio + streamable-HTTP → Claude Desktop
```

- **Tool registry** (`src/mcp/tools/registry.js`) — the single source of truth:
  each tool has `{ name, description, inputSchema, run(args, ctx) }` where `run`
  calls the analytics API. Both the assistant service and the MCP server load it.
- **Assistant service** (`src/routes/assistant.js`) — the LLM loop + streaming +
  memory. This is the in-app brain.
- **MCP server** (`apps/mcp-server/`) — thin bridge exposing the same registry
  over MCP.

---

## 5. The tool layer (our readable APIs → AI tools)

We already have a rich set of **read-only** analytics endpoints. Each becomes a
tool the AI can call:

| Tool | Backs onto | Returns |
|---|---|---|
| `get_kpi` | `/analytics/:site/kpi` | visitors, pageviews, bounce, avg session |
| `get_traffic` | `/analytics/:site/traffic` | visitors/sessions over time |
| `get_top_pages` | `/analytics/:site/top-pages` | most-visited pages |
| `get_sources` | `/analytics/:site/sources` | traffic source breakdown |
| `get_devices` | `/analytics/:site/devices` | device split |
| `get_countries` | `/analytics/:site/countries` | geo breakdown |
| `get_funnel` | `/analytics/:site/funnel` | conversion funnel + drop-off |
| `get_realtime` | `/analytics/:site/realtime` | live visitors now |
| `get_acquisition_utm` | `/analytics/:site/utm` | UTM campaign performance |
| `get_web_vitals` | `/analytics/:site/performance/*` | LCP/CLS/INP scores |
| `get_engagement` | `/analytics/:site/engagement/*` | scroll depth, rage clicks |
| `compare_ranges` | `/analytics/:site/comparison` | period-over-period |

Two ways to build the registry:
- **Fast path:** author an **OpenAPI spec** of these endpoints and run it through
  the existing `mapper.js` → tools auto-generated (reuses what's built).
- **Rich path:** hand-write registry entries so we control descriptions, the
  `dateRange` normalisation, and which **result card** each tool renders.

We'll do the OpenAPI spec (Phase 2) *and* enrich key tools with card metadata.

Every tool is **read-only** and **scoped to the authenticated user's sites** — the
AI cannot mutate data or see other users' sites.

---

## 6. Rich results: charts, CSV, deep-links

A tool doesn't just return raw JSON — it returns a **result envelope** the panel
knows how to render:

```jsonc
{
  "summary": "Top page last 7 days was /pricing with 4.2K views.",
  "render": {
    "type": "chart",          // "chart" | "table" | "kpi" | "none"
    "chart": "bar",           // reuse existing Recharts components
    "data": [ ... ]
  },
  "download": { "csv": true, "filename": "top-pages-7d.csv" },
  "deepLink": { "label": "Open Pages", "to": "/pages?dateRange=7d" }
}
```

- **Charts** — reuse the existing chart components (`TopPagesChart`,
  `TrafficChart`, etc.) so cards look native.
- **CSV / JSON** — reuse `exportUtils.js` (`exportToCSV`) so a "Download" button in
  the card produces the same files the dashboard already does.
- **Deep-links** — a chip that calls `navigate(to)` and sets the date filter, so
  "Open Acquisition · last 7 days" lands the user on the right, pre-filtered page.
  This satisfies "they can go to that page from the panel."

The LLM chooses which tool to call; the tool decides which card to render.

---

## 7. Memory

Two layers:

1. **Conversation memory** — each chat is a **thread** of messages, persisted in
   PostgreSQL (`assistant_threads`, `assistant_messages`). Reopening the panel
   resumes the last thread; follow-up questions have full context. The backend
   sends recent turns to the LLM each request (with a token budget / summarisation
   of older turns).
2. **User memory / preferences** — durable facts the assistant should remember
   ("default to the last 30 days", "my main site is hello.com", "I care about
   signups"). Stored per user and injected into the system prompt.

Client-side, the active thread id + open/closed state live in a Zustand store
(`useAssistantStore`) so the panel survives navigation.

---

## 8. AI provider strategy (server key + BYO key)

Configurable, both supported:

- **Server key (default).** Set `ANTHROPIC_API_KEY` (and/or `OPENAI_API_KEY`) on
  the backend. Works out-of-the-box; you bear the AI cost. Good for the hosted
  demo and small teams.
- **Bring-your-own key.** A user pastes their own Claude/OpenAI key in
  **Settings → AI**. It's stored **encrypted at rest** (or kept only in the
  browser and sent per-request), used only for that user's calls, never logged.
  Zero AI cost to you; good for self-hosters.
- **Provider abstraction.** A small `llmProvider` interface (`chat(messages,
  tools) → stream`) with adapters for Anthropic and OpenAI, so the assistant
  service is provider-agnostic. Default to the latest Claude model.

Precedence: user's key if present → else server key → else the panel shows a
friendly "add an AI key to enable the assistant" state.

---

## 9. Current state (what's already built)

Consistent across all three backends.

> **Status note (2026-07-05):** the section below captures the *original*
> build state. Everything under "still to build" has since shipped, plus five
> waves of hardening/capability work. For the current, authoritative status —
> including the 17-tool registry, token streaming, the remote Streamable-HTTP
> transport, cost fences, and the full test coverage — see
> **[mcp-improvement-plan.md](mcp-improvement-plan.md)**. Phases 1–7 below are
> all ✅; the "❌ still to build" list is fully done.

### ✅ Engine (`mcp-toolkit-core`, vendored into each backend `src/mcp/`)
- `openapi/mapper.js` — OpenAPI 3.x → tool definitions (cycle-safe `$ref`). **10 tests.**
- `connect/signing.js` — HMAC sign/verify + `ReplayGuard`. **11 tests.**
- `connect/keystore.js` — key store (customer keys never persisted).
- **21/21 tests pass.** The vendoring is now a checked contract — a drift test
  (`tests/vendoring.test.js`) fails if the vendored copy diverges from the
  package (P1.1).

### ✅ HTTP helpers (`routes/mcp.js`, mounted at `/api/mcp`)
- `POST /api/mcp/tools` (map an OpenAPI doc), `/sign`, `/verify` — engine
  **demos**, now gated behind `MCP_TOOLKIT_DEMOS=1` (404 by default, P1.2).

### ✅ Everything for the AI Analyst is now built
- Tool registry backed by real endpoints (17 read-only tools)
- OpenAPI spec of our API (`/api/openapi.json`, kept in sync via a test, P1.4)
- Assistant service (LLM loop, **token streaming**, tool execution, memory)
- Provider abstraction + BYO key + per-user cost fences
- Chat panel UI with result cards, deep-links, and thread history
- Thread/memory tables
- The standalone stdio MCP server **and** a remote Streamable-HTTP endpoint
  (`POST /api/mcp/http`)

---

## 10. The full build plan (phases)

Ordered so each phase ships something usable.

### Phase 1 — Wire the engine ✅ DONE
Vendored + mounted; `/api/mcp/{tools,sign,verify}` verified live in all 3 layouts.

### Phase 2 — Tool registry + our OpenAPI spec  ✅ DONE
1. ✅ `src/mcp/openapi/insighttrack-spec.js` — OpenAPI 3.1 for 12 readable
   analytics endpoints, served at `GET /api/openapi.json` (public). Verified it
   maps cleanly through the mapper → 12 tools, 0 warnings.
2. ✅ `src/mcp/tools/registry.js` — 11 hand-written tools `{ name, description,
   inputSchema, run(args, ctx) }`. `run` calls the DuckDB query functions
   **directly** (no extra HTTP hop) and returns the **result envelope**
   (`summary`, `data`, `render`, `download`, `deepLink`). Tools: `get_kpi`,
   `get_traffic`, `get_top_pages`, `get_sources`, `get_devices`, `get_countries`,
   `get_funnel`, `get_realtime`, `get_acquisition_utm`, `get_engagement`,
   `compare_ranges`.
3. ✅ `GET /api/mcp/tools` returns our catalogue; `POST /api/mcp/run`
   `{ name, siteId, args }` executes one tool **scoped to a site the caller can
   access** (403 otherwise) and returns the envelope.

**Verified live:** `get_kpi` → "10,002 visitors, 89,373 pageviews…"; `get_top_pages`
→ real rows + CSV filename + deep-link; access control blocks foreign sites.

**Deliverable:** a callable, self-describing, access-scoped tool layer over our
real data — the foundation both the panel and the MCP server build on.

### Phase 3 — Assistant service (the brain)  ✅ DONE
1. ✅ `src/mcp/llm/provider.js` — dependency-free provider abstraction using
   native `fetch` (no SDK). **Anthropic + OpenAI** adapters (tool-use), with
   `resolveProvider()` precedence: **BYO user key → server env key → none**.
   Base URLs overridable via `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL`. Default
   model: `claude-sonnet-5`.
2. ✅ `src/routes/assistant.js` — `POST /api/assistant/chat` (SSE). The loop:
   call the LLM with the tool catalogue → run requested tools via `runTool`
   (scoped to the caller's site) → feed results back → repeat (cap 5 rounds) →
   final answer. Streams `event: text` (deltas), `event: tool` (result envelope
   for the panel to render), `event: done` / `event: error`. Plus
   `GET /api/assistant/status` for the UI (is a provider available?).
3. ✅ Guardrails: read-only tools only; per-user site scoping (403 on foreign
   sites); `MAX_TOOL_ROUNDS` cap; abort on client disconnect; `safeError`.
4. ✅ Env: `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` in `.env.example` + compose.

**Verified end-to-end** with a mock LLM: a "top pages last week?" question →
streamed `text` → **ran `get_top_pages` on real data** (651 views, /about) →
streamed the `tool` card (table + CSV + deep-link) → streamed the final answer →
`done`. The whole brain (LLM ↔ tool-use ↔ real data ↔ SSE) works.

**To enable in production:** set `ANTHROPIC_API_KEY` on the backend (or users add
their own key — Phase 6).

**Deliverable:** ask a question → get an answer that used real data. ✅

### Phase 4 — Memory  ✅ DONE
1. ✅ Postgres tables `assistant_threads`, `assistant_messages` (with a `cards`
   JSONB column that stores each rendered tool envelope), plus `assistant_memory`
   (per-user preferences, free-form JSONB). All created in `initializeDatabase()`;
   `ON DELETE CASCADE` from thread → messages.
2. ✅ `/api/assistant/chat` now accepts a `threadId`: it resolves/creates the
   thread, persists the user turn, then accumulates and persists the assistant's
   final text + cards at the end of the SSE loop. It emits a new
   **`event: thread`** frame first so the client learns/keeps the thread id.
3. ✅ Thread CRUD: `GET /api/assistant/threads` (recent 30),
   `GET /api/assistant/threads/:id` (full message history),
   `DELETE /api/assistant/threads/:id`. All **ownership-guarded** (a thread that
   isn't the caller's → 404).
4. ✅ Preference memory: `GET/PUT /api/assistant/memory`. Stored prefs are folded
   into the system prompt each turn (`User preferences to respect: …`).
5. ✅ Frontend wiring: `useAssistantStore` tracks `threadId` (persisted to
   localStorage), `loadThread`/`newThread`/`setThreadId`; `AssistantPanel`
   hydrates the last conversation from the server on first open and sends
   `threadId` with each message; `assistantStream` gained `loadThreadFromServer`
   and `listThreads` helpers and handles the `thread` event.

**Verified end-to-end** (mock LLM, Dockerised PG): first turn created thread #1
and saved the user message + assistant reply (both text deltas concatenated) with
the tool-result card in `cards`; a follow-up with `threadId:1` appended to the
same thread (4 messages total); `PUT/GET /memory` round-tripped prefs;
`DELETE /threads/1` cascade-removed its messages (0 orphans); a non-owned
`/threads/9999` returned 404.

**Deliverable:** conversations persist and follow-ups have context. ✅

> Not yet done: older-turn **summarisation** to stay within the token budget —
> deferred to Phase 8 (polish). Today the client sends full history each turn.

### Phase 5 — Chat panel UI (the product)  ✅ DONE
1. ✅ `store/useAssistantStore.js` (Zustand) — open state, session messages,
   busy flag, and a **flexible/resizable width** (drag handle, persisted to
   localStorage, clamped 320–720px).
2. ✅ `services/assistantStream.js` — `fetch`-based **SSE reader** (axios can't
   stream) that parses `text`/`tool`/`done`/`error` frames.
3. ✅ `components/assistant/AssistantPanel.jsx` — a **flexible right-side drawer**
   (drag the left edge to resize; full-screen sheet on mobile) with a floating
   **"Ask AI"** trigger on every dashboard page. Streaming message list, stop
   button, clear, suggested prompts, empty + error states. Dark-mode.
4. ✅ `components/assistant/ResultCard.jsx` — renders each tool envelope as a
   **chart** (reuses Recharts), **table**, or **KPI** card with a **CSV download**
   (reuses `exportUtils`) and a **deep-link chip** that navigates to the matching
   dashboard page. Mounted in `DashboardLayout`.

**Verified end-to-end in the browser** (mock LLM): clicked a suggestion →
streamed the AI text → rendered a **table card** with real data (/about 645
views) → **CSV** button + **"Open pages"** deep-link, all inside the panel.

**Deliverable:** users chat with their analytics — charts, CSV, deep-links —
without leaving the dashboard. ✅

### Phase 6 — BYO key + Settings → AI  ✅ DONE
1. ✅ `utils/secretBox.js` — AES-256-GCM encrypt/decrypt (key derived via scrypt
   from `ENCRYPTION_KEY` or `JWT_SECRET`) + `maskSecret()` for display hints.
2. ✅ `assistant_settings` table (per-user `provider`, encrypted `key_cipher`,
   `key_hint`, `model`). `GET/PUT /api/assistant/settings` — the key is
   **write-only** (never returned; only a `sk-…1234` hint + `hasKey`).
3. ✅ Precedence extended in `resolveProvider` to accept a `userModel`; `/chat`
   now resolves **request key → stored BYO key → server env key** and folds a
   model override in.
4. ✅ Settings → **AI Analyst** tab (`components/settings/AISettings.jsx`):
   provider picker, key field (password), model override, status banner showing
   the *effective* provider + whether it's the user's key or the server's, and a
   clear-key action.

**Verified end-to-end:** stored a BYO key (encrypted at rest — no plaintext in
PG), masked hint returned, partial update preserves the key, `key:""` clears it,
and `/chat` ran the full loop using the **stored** key with no `userKey` in the
request body.

**Deliverable:** self-hosters run it on their own key. ✅

### Phase 7 — External MCP access (Claude Desktop / Cursor / web)  ✅ DONE

Two transports, both driven by the same connect token and the same registry:

1. ✅ **Local stdio bridge** — `mcp-server/`, a standalone
   `@insighttrack/mcp-server` npm package using `@modelcontextprotocol/sdk` over
   **stdio**. It's a **thin HTTP bridge**, not a DB client: it fetches the
   catalogue from `/api/mcp/tools` and proxies every `tools/call` to
   `/api/mcp/run`. This is deliberate — the API process holds the
   **single-writer DuckDB lock**, so a separate process must never open the DB.
   It auto-discovers the user's sites, injects a `siteId` arg into site-scoped
   tools (siteless tools like `list_sites` pass through), and **lazily
   re-fetches sites** when a call names one it hasn't seen (P2.4).
1b. ✅ **Remote Streamable-HTTP endpoint** (N1) — `POST /api/mcp/http` speaks the
   MCP JSON-RPC 2.0 protocol (`initialize` · `tools/list` · `tools/call`)
   directly on the API, so a client connects with just a **URL + bearer connect
   token** — no local install. Protocol logic is shared in `src/mcp/protocol.js`;
   auth, revocation, and site scoping are identical to `/api/mcp/run`. This is
   now the recommended path for hosted deployments.
2. ✅ Connect handshake: `POST /api/mcp/connect` mints a **long-lived, revocable
   JWT** (`scope:'mcp'` + a `jti` tracked in `mcp_connect_tokens`) and returns a
   ready-to-paste client config **once**. `GET /api/mcp/connect` lists,
   `DELETE /api/mcp/connect/:jti` revokes. A guard on the MCP router rejects
   revoked tokens immediately and stamps `last_used_at`. MCP tokens **cannot mint
   more tokens**.
3. ✅ Settings → **Connect a client** (`components/settings/MCPConnect.jsx`):
   create labelled connections, copy the config block / token (shown once), see
   last-used, and revoke.

**Verified end-to-end:** a real MCP stdio handshake (`initialize` →
`tools/list` → `tools/call`) against a running API returned all 11 tools and
executed `get_top_pages` through the proxy; the connect token ran tools but was
**403** for minting and **401 immediately after revoke**.

**Deliverable:** the same tools work in Claude Desktop. ✅

### Phase 8+ — Hardening, capability & polish

Tracked in **[mcp-improvement-plan.md](mcp-improvement-plan.md)** (2026-07-04
code audit), now delivered across five waves (2026-07-05):

- **Wave 1** — fixed the connect flow (local `node`/URL config, not the
  unpublished npx package); 38 security-path tests; per-user cost fences
  (rate limit + env `max_tokens`); registry shares the analytics cache.
- **Wave 3** — 6 new tools (**17 total**), incl. the account-scoped
  `list_sites`; thread-history UI; MCP-server lazy site refresh.
- **Wave 4** — **token streaming** (both provider adapters stream per-token to
  the panel) and a **remote Streamable-HTTP MCP endpoint** `POST /api/mcp/http`
  (connect with just a URL + token — no local install).
- **Wave 5** — architectural debt: vendoring drift test, gated demo endpoints,
  OpenAPI↔registry sync test, bounded chat history.
- **Wave 6** — observability & guardrails: per-chat **usage metering** table
  (tokens, latency, request id) with providers surfacing token counts;
  **tool-result size guardrails** (large ranges sampled before hitting the LLM
  and MCP clients); **structured MCP output** (`structuredContent` on
  `tools/call`); env-configurable model defaults.

All P0/P1/P2 items and N1/N2/N6/N7 are complete. Remaining roadmap (N3
proactive digests, N4 NL→SQL, N5 evals, N8 multi-site compare, N9 thread
export, N10 third provider, publish `mcp-toolkit-core`, per-page suggestion
chips) is in the plan.

### Cross-cutting (every phase)
Keep all 3 layouts in sync; parameterised SQL; `authenticateToken` on non-public
routes; ES modules; `safeError`; dark-mode UI; never store customer AI keys in
plaintext.

---

## 11. Security model

- **Read-only tools** — no write/delete tools initially; the AI cannot mutate data.
- **Per-user scoping** — every tool call carries the user's token; the analytics
  API already enforces site membership, so the AI only sees that user's sites.
- **BYO keys** — encrypted at rest or browser-only; never logged.
- **Platform Connect (F-09)** for external MCP — HMAC signed-token handshake with
  timestamp freshness + nonce replay guard.
- **Rate limiting + audit log** on assistant + MCP endpoints (cost + abuse
  control, since LLM calls aren't free).
- **Prompt-injection awareness** — tool outputs are data, not instructions; the
  system prompt constrains the model to analytics tasks.
- **safeError** so failures never leak internals to the model or client.

---

## 12. Future roadmap

- **Guarded write-tools** — create goals/annotations behind explicit confirmation.
- **Scheduled AI reports** — "email me a weekly AI summary."
- **Anomaly narration** — the AI proactively explains traffic spikes/drops.
- **Voice / natural-language dashboards** — build a custom dashboard by asking.
- **Hosted multi-tenant MCP** — one streamable-HTTP endpoint routing per signed token.
- **Sell `mcp-toolkit-core`** — the OpenAPI→MCP + signed-connect engine is generic.
- **Observability dashboard** — tool-call volume, latency, cost per user.

---

## 13. What you need to learn

Ordered path; each builds on the last.

### 13.1 LLM tool-use (the core skill)
- **Function/tool calling** with the Claude API (and OpenAI) — how you attach
  tools, how the model returns a tool call, how you run it and feed the result
  back. This is the heart of the assistant service.
- **Streaming** responses (SSE) so the panel feels live.
- **JSON Schema** for tool inputs — types, `required`, enums, and writing
  **descriptions** that make the model call tools correctly.

### 13.2 MCP itself
- MCP's **client / server / transport** model; **tools, resources, prompts**.
- **stdio vs streamable-HTTP** transports; when to use each.
- Build a "hello world" **stdio server** with `@modelcontextprotocol/sdk` and
  connect **Claude Desktop** to it — teaches the whole loop.
- Docs: https://modelcontextprotocol.io · https://spec.modelcontextprotocol.io

### 13.3 Retrieval / memory
- Conversation memory patterns: keeping a thread, **token budgets**, and
  **summarising** older turns.
- Per-user preference memory injected into the system prompt.

### 13.4 Security for AI features
- **Prompt injection** and why tool outputs must be treated as data.
- **BYO-key handling** — encryption at rest, never logging keys.
- HMAC signing (our `signing.js`) for external MCP connections.

### 13.5 Our codebase
- Read `src/mcp/openapi/mapper.js` + `src/mcp/connect/signing.js` (small, pure,
  commented) and run their tests.
- The readable analytics endpoints in `routes/analytics.js` — these become tools.
- `hooks/useAnalytics.js`, the Recharts chart components, and `utils/exportUtils.js`
  — the panel reuses these to render cards.

### Milestones
- [ ] Do a Claude tool-call round-trip from a Node script.
- [ ] Stream a response over SSE into a React component.
- [ ] Turn one analytics endpoint into a registry tool with a chart card.
- [ ] Ship a stdio MCP echo server connected to Claude Desktop.
- [ ] Explain the assistant data-flow diagram from memory.

---

## 14. Glossary

| Term | Meaning |
|---|---|
| **AI Analyst panel** | The in-dashboard chat sidebar users talk to. |
| **MCP** | Model Context Protocol — open standard for exposing tools to AI clients. |
| **MCP server** | Program exposing our tools to external clients (Claude Desktop). |
| **Transport** | stdio (subprocess) or streamable-HTTP (web) MCP connection. |
| **Tool** | An action the AI can call (name + JSON input schema + `run`). |
| **Tool registry** | Single shared list of tools used by both the panel and MCP server. |
| **Result envelope** | A tool's structured output telling the panel how to render (chart/table/CSV/deep-link). |
| **Deep-link chip** | A clickable chip in a reply that navigates to a pre-filtered dashboard page. |
| **Thread** | A persisted conversation (memory). |
| **BYO key** | User-provided AI API key; never stored in plaintext. |
| **llmProvider** | Backend abstraction with Anthropic/OpenAI adapters. |
| **Platform Connect (F-09)** | HMAC signed-token handshake for external MCP auth. |
| **F-02 / F-09** | Internal feature IDs: F-02 = OpenAPI→MCP mapping, F-09 = signed connect. |
