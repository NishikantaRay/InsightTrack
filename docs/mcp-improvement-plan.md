# MCP / AI Analyst — Improvement Plan

> Status of record as of **2026-07-04**, produced from a code-level audit of the
> MCP integration (registry, routes, provider layer, mcp-server, toolkit-core,
> assistant UI) across all three layouts. Continues where
> [mcp-toolkit.md](mcp-toolkit.md) Phase 8 left off. Check items off as they
> land; every change ports to all three copies (`traffic/`, `traffic2/apps`,
> `traffic2/appsv2`).
>
> **Wave 1 landed 2026-07-05** — P0.1, P0.2, P0.3, P0.4, and P1.3 are done and
> mirrored across all three copies (38 new security-path tests; full backend
> suite 104/104 in traffic & apps; connect flow verified live). See per-item
> notes below.
>
> **Wave 3 landed 2026-07-05** — P2.1 (6 new tools incl. siteless `list_sites`),
> P2.2 (thread-history UI), P2.4 (MCP server lazy site refresh). 9 more tests
> (113/113 backend); all three frontends build; `list_sites`, new-tool
> isolation, and thread-delete verified live.
>
> **Wave 4 landed 2026-07-05** — P2.3 (token streaming: both provider adapters
> stream, assistant loop emits per-token SSE) and N1 (remote Streamable-HTTP
> MCP endpoint `POST /api/mcp/http`). 12 more tests (125/125 backend); full
> MCP handshake, isolation, and revocation verified live over HTTP.
>
> **Wave 5 landed 2026-07-05** — the architectural-debt batch: P1.1 (vendoring
> drift-check test), P1.2 (demo endpoints gated behind `MCP_TOOLKIT_DEMOS`),
> P1.4 (OpenAPI spec brought to all 17 tools + a registry↔spec sync test),
> P1.5 (bounded chat history). 13 more tests (138/138 backend); gating + spec +
> HTTP verified live. **All of P0, P1, and P2 + N1 are now complete.**
>
> **Wave 6 landed 2026-07-05** — observability, guardrails & structured output:
> N6 (`assistant_usage` metering table), P3.1 (providers surface token usage;
> the chat loop records tokens/latency/request-id + per-tool latency logs),
> N7 (`capToolData` size guardrails on data fed back to the LLM and to MCP),
> N2 (`structuredContent` on MCP `tools/call`), P3.2 (env-configurable model
> defaults). 9 more tests (147/147 backend); usage table, structuredContent
> verified live.
>
> **Wave 7 landed 2026-07-06** — N10 (third provider: Google **Gemini**, via its
> OpenAI-compatible endpoint — the OpenAI adapter parametrized and reused). 8
> more tests (155/155 backend); Gemini settings + the provider CHECK migration
> verified live.

## Current state (verified against code)

Phases 1–7 of the build plan are **built and working**: shared tool registry
(11 read-only tools with result envelopes), `/api/mcp/run` with per-user site
scoping, SSE assistant loop with threads/memory, BYO keys encrypted via
secretBox, revocable `jti` connect tokens, and a stdio MCP server that proxies
over HTTP (never opens DuckDB). No drift between the three copies.

Audit found one product-breaking bug, an untested security surface, and the
debts/gaps below.

---

## P0 — Broken or unprotected (do first)

- [x] **P0.1 Fix the Claude Desktop connect flow.** *(done 2026-07-05)*
  `POST /api/mcp/connect` no longer emits the unpublished `npx -y
  @insighttrack/mcp-server` config. `routes/mcp.js#mcpClientCommand()` now
  defaults to a local `node <path>/mcp-server/src/index.js` command with a
  placeholder path + UI `note`; deploy overrides `MCP_SERVER_PACKAGE` (→ npx,
  once published) or `MCP_SERVER_PATH` (→ real local path). The panel
  (`MCPConnect.jsx`) surfaces the note. Verified live: config uses `node`, no
  `npx` leak.

- [x] **P0.2 Test the security-critical paths.** *(done 2026-07-05 — 38 tests)*
  - `tests/routes/mcp.test.js` — 401 unauth, `/run` 403 on foreign site,
    catalogue shape, connect-token mint (config is `node`), token authenticates,
    `scope:'mcp'` cannot mint, list hides token, revoke → immediate 401,
    404 on foreign/nonexistent jti.
  - `tests/routes/assistant.test.js` — chat loop with a **mock provider**
    (thread→text→done, persisted), 403 foreign site, 429 past the per-user
    limit, thread-ownership 404, BYO key write-only (encrypted at rest, masked
    hint, `key:''` clears), unknown-provider 400, prefs round-trip.
  - `tests/secretBox.test.js` — round-trip, random IV, no plaintext in blob,
    tampered/garbage → null, mask hint.
  - `tests/mcpRegistry.test.js` — catalogue contract, `toolCatalogue()` strips
    `run()`, `runTool` rejects unknown tool / missing siteId, envelope shape
    for all 11 tools, and the P1.3 cache behavior.

- [x] **P0.3 Per-user cost controls on `/api/assistant/chat`.** *(done 2026-07-05)*
  Sliding 1-minute per-user limit in `routes/assistant.js`
  (`ASSISTANT_RATE_LIMIT_SERVER_KEY`=10, `ASSISTANT_RATE_LIMIT_OWN_KEY`=30 —
  stricter on the server key), returning 429. `max_tokens` is now
  `ASSISTANT_MAX_TOKENS` (default 1500) in `provider.js`. All in `.env.example`.

- [x] **P0.4 Delete the dead legacy MCP route.** *(done 2026-07-05)*
  Removed `analytics-server/src/routes/mcp.js` (traffic only; traffic2 had no
  equivalent).

## P1 — Architectural debt

- [x] **P1.1 Resolve toolkit-core vendoring duplication.** *(done 2026-07-05)*
  Kept vendoring on purpose (a `file:`/workspace dep would complicate the
  single-process/single-writer DuckDB Docker build) but made it a **checked
  contract**: `tests/vendoring.test.js` asserts `src/mcp/openapi/{mapper,spec}.js`
  and `src/mcp/connect/{signing,keystore}.js` are byte-identical to
  `../mcp-toolkit-core/src/…`, failing the moment either side is edited alone.
  (`insighttrack-spec.js` is the repo's own doc, intentionally excluded.)

- [x] **P1.2 Gate the toolkit demo endpoints.** *(done 2026-07-05)*
  `POST /api/mcp/tools` (map arbitrary OpenAPI), `/sign`, `/verify` now sit
  behind a `toolkitDemos` middleware and return 404 unless
  `MCP_TOOLKIT_DEMOS=1` — so production never exposes the arbitrary-OpenAPI
  mapper or the not-fleet-safe in-memory ReplayGuard by accident. In
  `.env.example`; covered by tests (all three 404 by default) and verified
  live. Note the **product** MCP endpoints (`GET /tools` catalogue, `/run`,
  `/http`, `/connect`) are unaffected — only the engine showcases are gated.

- [x] **P1.3 Wire the registry through the analytics cache.** *(done 2026-07-05)*
  All 11 registry tools now call `analyticsCache.getOrFetch` with **the same
  cache keys and TTLs as `routes/analytics.js`**, so the AI Analyst and the
  dashboard share cache entries — a question the dashboard already answered is
  a hit, and a repeated question in a thread never re-runs the query. Covered
  by the caching tests in `tests/mcpRegistry.test.js`.

- [x] **P1.4 Stop the tool-description drift.** *(done 2026-07-05)*
  Brought `insighttrack-spec.js` up to **all 17 tools** (it had lagged at 12,
  missing the Wave-3 additions) with `operationId === tool name`, and added a
  sync-assertion test in `tests/mcpRegistry.test.js` that fails if the OpenAPI
  operationIds and registry tool names ever diverge. `specOperationIds()` is
  exported for the check. The spec is served at `/api/openapi.json` (verified
  live: 17 operations).

- [x] **P1.5 Token-budget management for chat history.** *(done 2026-07-05)*
  `normalizeInbound` now keeps only the most recent `ASSISTANT_MAX_HISTORY_TURNS`
  (default 20) user/assistant turns and, when older turns are dropped, prepends
  a one-line note ("N messages were omitted…") so the model knows earlier
  context existed. Always begins with a user turn (provider requirement).
  Covered by `tests/assistantHistory.test.js`.

## P2 — Capability gaps (the product work)

- [x] **P2.1 New tools.** *(done 2026-07-05)* Added 6 tools — `list_sites`
  (**siteless**: runs on `ctx.userId`, not a siteId; the registry now supports
  a `siteless: true` flag and `runTool`/`/api/mcp/run`/the assistant loop
  thread `userId` through `ctx`), `get_goals`, `get_user_flow`, `get_js_errors`,
  `get_performance` (Web Vitals), `get_page_detail` (per-path click drilldown).
  Catalogue is now 17 tools. All share the analytics cache (P1.3). Covered by
  9 new tests in `mcpRegistry.test.js` / `routes/mcp.test.js`; isolation
  verified live (403 foreign / 400 missing siteId for the new site-scoped
  tools; `list_sites` runs without a siteId).
- [x] **P2.2 Thread history UI.** *(done 2026-07-05)* A History dropdown in
  `AssistantPanel` lists saved conversations (via `listThreads()`), opens one
  (`loadThreadFromServer`), and deletes one (new `deleteThread()` helper →
  `DELETE /api/assistant/threads/:id`). Outside-click/Esc close; refreshes on
  open; deleting the active thread resets to a new one.
- [x] **P2.3 True token streaming.** *(done 2026-07-05)* Both provider
  adapters (`mcp/llm/provider.js`) now call the LLM with `stream:true` and fire
  an `onText(delta)` callback per token, dependency-free (a shared `sseEvents`
  reader parses the Anthropic block-delta and OpenAI chat-completion streams;
  tool_use / tool_calls are assembled from partial-JSON deltas before tools
  run, so tool-use stays correct). The assistant loop passes `onText` →
  `sse('text', {delta})`, streaming text token-by-token to the panel; it guards
  against double-emit when a provider streams. `PROVIDERS` return shape is
  unchanged, so a non-streaming mock still works. Covered by `provider.test.js`
  (mock SSE server: per-delta callbacks, tool_use assembly, no-`onText` path).
- [x] **P2.4 MCP server freshness.** *(done 2026-07-05)* `mcp-server` now
  caches sites but **re-fetches lazily** when a call names an unknown siteId
  (a site created after connect works without a client restart), and exposes
  `list_sites` (skips the injected required `siteId` for siteless tools). The
  catalogue advertises the `siteless` flag so the server knows which tools to
  treat that way.

## P3 — Polish (Phase 8 as documented)

- [x] **P3.1 Observability.** *(done 2026-07-05)* Both provider adapters now
  surface `usage: { tokensIn, tokensOut }` (Anthropic from message_start/delta;
  OpenAI via `stream_options.include_usage`). The chat loop aggregates tokens
  across rounds, times the whole turn + each tool call, tags a short
  `requestId`, and writes one `assistant_usage` row per chat (N6) plus a
  per-tool latency log line. Covered by `provider.test.js` (usage parsing) and
  `routes/assistant.test.js` (usage row asserted). Feeds cost dashboards and
  future quotas.
- [x] **P3.2 Model defaults refresh.** *(done 2026-07-05)* `DEFAULT_MODELS`
  reads `ASSISTANT_DEFAULT_MODEL_ANTHROPIC` / `_OPENAI` (in `.env.example`), so
  a self-hoster can pick a cheaper/faster tier without a code change; a per-user
  override still wins. Covered by `providerDefaults.test.js`.
- [ ] **P3.3 Suggested-questions prompt library** in the panel (starter chips
  per dashboard page). *(Note: the panel already ships static starter
  suggestions; P3.3 is the richer per-page version.)*
- [ ] **P3.4 Publish `mcp-toolkit-core`** to npm (pairs with P1.1).

## New improvements (forward roadmap — not yet planned in mcp-toolkit.md)

- [x] **N1 Remote MCP transport (Streamable HTTP).** *(done 2026-07-05)*
  `POST /api/mcp/http` speaks the MCP JSON-RPC 2.0 protocol
  (`initialize` · `tools/list` · `tools/call` · notifications) so a client
  connects with just a URL + connect token — no local Node/npx, sidesteps
  P0.1 for hosted deployments. The protocol logic lives in a shared
  `mcp/protocol.js` (siteId injection, siteless passthrough, envelope
  rendering) reused across surfaces; auth + revocation are the existing
  router middleware; tenant isolation is identical to `/api/mcp/run` (foreign
  site → `isError` result). `/connect` now returns a `remoteConfig`
  (`type:"http"`, URL, bearer header) and the Settings panel shows a
  "Remote (recommended)" block above the local stdio one. Covered by 9
  transport tests in `routes/mcp.test.js`; full handshake + isolation +
  revocation verified live over HTTP. GET is 405 (POST-only; no
  server-initiated stream — N2 could add SSE push later).
- [x] **N2 Structured tool output over MCP.** *(done 2026-07-05)* MCP
  `tools/call` now returns `structuredContent` (`{ summary, data, note? }`)
  alongside the text/JSON `content` fallback, so rich clients can render tables
  natively while every client still gets readable text. Applied in both surfaces
  (`mcp/protocol.js` for the HTTP transport, `mcp-server` for stdio). Verified
  live; covered by a transport test.
- [ ] **N3 Proactive insights & scheduled digests.** Reuse the registry +
  provider loop to generate a weekly "what changed" summary per site
  (traffic anomalies, top movers) delivered in-app; pairs with the existing
  alerts data. This turns the analyst from reactive to proactive.
- [ ] **N4 Read-only NL→SQL tool.** A `run_sql` tool constrained by the SQL
  Editor's existing security model (read-only DuckDB, per-site scoping,
  statement allowlist) would let the AI answer long-tail questions no
  prebuilt tool covers. Requires careful prompt + validation reuse — do after
  P0.2 tests exist.
- [ ] **N5 Assistant eval suite.** A golden-question set (mock provider +
  seeded data) asserting the model picks the right tool and the envelope
  renders — run in CI so registry/prompt changes can't silently regress
  tool choice.
- [x] **N6 Usage metering table.** *(done 2026-07-05)* `assistant_usage`
  (user_id, site_id, thread_id, provider, model, tokens_in, tokens_out,
  tool_calls, rounds, latency_ms, own_key, request_id, created_at), indexed by
  (user_id, created_at). One row per chat turn — foundation for quotas, cost
  dashboards, and billing. Populated by the loop (P3.1).
- [x] **N7 Tool-result size guardrails.** *(done 2026-07-05)* `capToolData`
  caps rows (`ASSISTANT_TOOL_MAX_ROWS`, default 100) and total serialized size
  (`ASSISTANT_TOOL_MAX_CHARS`, default 20k), appending a "showing first N of M"
  note. The **dashboard still renders/downloads the full envelope**; only the
  copy fed back to the LLM (`envelopeForModel`) and to MCP clients is bounded.
  Covered by `toolGuardrails.test.js`.
- [ ] **N8 Multi-site comparison tools.** `compare_sites` across the user's
  accessible sites (needs `list_sites` + explicit scoping checks per site).
- [ ] **N9 Conversation export.** Download a thread (text + tool cards) as
  Markdown/CSV from the panel — trivial, reuses `exportUtils`.
- [x] **N10 Third provider — Google Gemini.** *(done 2026-07-06)* Added a
  first-class `gemini` provider. Since Gemini ships an **OpenAI-compatible**
  Chat Completions endpoint, the streaming adapter is reused verbatim — the
  OpenAI adapter was parametrized into `openaiCompatibleRun({ url, defaultModel,
  label })`, and `openaiRun`/`geminiRun` bind it to their endpoints. Wired
  through every layer: `resolveProvider` (BYO key + server `GEMINI_API_KEY`,
  precedence Anthropic→OpenAI→Gemini), `DEFAULT_MODELS.gemini` (env-overridable,
  `gemini-2.5-flash`), the settings validation, the `assistant_settings`
  provider CHECK (with a swap migration for existing DBs), the Settings → AI
  picker, and `.env.example` (`GEMINI_API_KEY`, `GEMINI_BASE_URL`). Streaming,
  usage metering (N6/P3.1), and all the cost fences apply unchanged. 8 new
  tests; settings + constraint migration verified live.

## Suggested execution order

1. ~~**P0.1 → P0.4 → P1.3** — unbreak the advertised feature, delete dead code,
   free cache win.~~ ✅ **done (Wave 1, 2026-07-05)**
2. ~~**P0.2 + P0.3** — tests and cost caps before promoting the feature.~~
   ✅ **done (Wave 1)** — N6 usage metering still open.
3. ~~**P2.1 + P2.2 + P2.4** — capability work users feel immediately.~~
   ✅ **done (Wave 3, 2026-07-05)**
4. ~~**P2.3 (streaming) and N1 (remote MCP)** — the two big UX/reach upgrades.~~
   ✅ **done (Wave 4, 2026-07-05)**
5. ~~**P1.1/P1.2/P1.4/P1.5** — architectural debt.~~ ✅ **done (Wave 5, 2026-07-05)**
6. ~~**P3.1 + P3.2 + N2 + N6 + N7** — observability, guardrails, structured
   output.~~ ✅ **done (Wave 6, 2026-07-05)**
7. ~~**N10** — third provider (Gemini).~~ ✅ **done (Wave 7, 2026-07-06)**
8. **Remaining:** N5 (eval suite), N3 (proactive digests), N4 (NL→SQL tool),
   N8 (multi-site compare), N9 (thread export), P3.3 (per-page suggestion
   chips), P3.4 (publish `mcp-toolkit-core`). ← **next**

## Maintenance

Update this file as items land (check the box, add the commit/PR reference).
When the architecture changes, also update
`.claude/skills/insighttrack/references/architecture.md` §6 and
[mcp-toolkit.md](mcp-toolkit.md) / [ai-analyst.md](ai-analyst.md).
