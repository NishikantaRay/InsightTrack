/**
 * Pulse (AI analyst) — the in-dashboard assistant service (Phase 3).
 *
 * POST /api/assistant/chat  (Server-Sent Events)
 *   Body: { siteId, messages: [{ role:'user'|'assistant', content }], userKey?, userProvider? }
 *   Streams SSE events to the browser:
 *     event: text        data: { delta }          — assistant text (per turn)
 *     event: tool        data: { name, envelope } — a tool ran; render its card
 *     event: done        data: { }                — turn finished
 *     event: error       data: { message }
 *
 * The loop: call the LLM with our tools attached → if it requests tool calls,
 * run them via the registry (scoped to the caller's site) → feed results back →
 * repeat until the model produces a final answer. Read-only + per-user scoped.
 */

import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { safeMsg } from '../utils/safeError.js';
import { getMemberRole } from '../services/teamService.js';
import { toolCatalogue, runTool, envelopeForModel } from '../mcp/tools/registry.js';
import { resolveProvider } from '../mcp/llm/provider.js';
import { query } from '../db/postgres.js';
import { encrypt, decrypt, maskSecret } from '../utils/secretBox.js';
import crypto from 'node:crypto';

const router = express.Router();
router.use(authMiddleware);

// ── memory helpers ──────────────────────────────────────────────────────────────

async function getUserPrefs(userId) {
    const r = await query(`SELECT prefs FROM assistant_memory WHERE user_id = $1`, [userId]);
    return r.rows[0]?.prefs || {};
}
// verify a thread belongs to the user; returns the row or null
async function ownedThread(threadId, userId) {
    const r = await query(`SELECT * FROM assistant_threads WHERE id = $1 AND user_id = $2`, [threadId, userId]);
    return r.rows[0] || null;
}
// Per-user AI settings (Phase 6). Returns { provider, model, key } where `key`
// is the decrypted BYO key or null (→ fall back to the server env key).
async function getUserAISettings(userId) {
    const r = await query(
        `SELECT provider, key_cipher, model FROM assistant_settings WHERE user_id = $1`,
        [userId]
    );
    const row = r.rows[0];
    if (!row) return { provider: null, model: null, key: null };
    return {
        provider: row.provider || null,
        model: row.model || null,
        key: row.key_cipher ? decrypt(row.key_cipher) : null,
    };
}
async function saveMessage(threadId, role, text, cards) {
    await query(
        `INSERT INTO assistant_messages (thread_id, role, text, cards) VALUES ($1, $2, $3, $4)`,
        [threadId, role, text, JSON.stringify(cards || [])]
    );
    await query(`UPDATE assistant_threads SET updated_at = NOW() WHERE id = $1`, [threadId]);
}

const MAX_TOOL_ROUNDS = 5; // safety cap on tool-call loops per message

// ── Per-user rate limit (cost fence) ─────────────────────────────────────────
// The global /api limiter is far too generous for LLM calls: with a server
// key configured, any authenticated user could otherwise burn unbounded
// spend. Sliding one-minute window per user; stricter when the request runs
// on the SERVER's key than on the user's own (BYO) key.
const RATE_LIMIT_SERVER_KEY = parseInt(process.env.ASSISTANT_RATE_LIMIT_SERVER_KEY) || 10;
const RATE_LIMIT_OWN_KEY = parseInt(process.env.ASSISTANT_RATE_LIMIT_OWN_KEY) || 30;
const _chatHits = new Map(); // userId → [timestamps within the last minute]

function assistantRateLimited(userId, usingOwnKey) {
    const limit = usingOwnKey ? RATE_LIMIT_OWN_KEY : RATE_LIMIT_SERVER_KEY;
    const now = Date.now();
    const hits = (_chatHits.get(userId) || []).filter((t) => now - t < 60_000);
    if (hits.length >= limit) {
        _chatHits.set(userId, hits);
        return true;
    }
    hits.push(now);
    _chatHits.set(userId, hits);
    return false;
}

const SYSTEM_PROMPT = `You are Pulse — InsightTrack's AI analyst, a helpful web-analytics assistant embedded in the user's own dashboard.

You answer questions about the user's website traffic by calling the provided read-only analytics tools. Rules:
- ALWAYS use a tool to get real numbers; never invent data.
- Pick the smallest set of tools that answers the question.
- The "dateRange" argument accepts 'today', '7d', '30d', '90d'. If the user doesn't specify, use '30d'.
- After tools return, give a concise, plain-English answer citing the key numbers.
- You are read-only: you cannot change settings or delete data.
- Keep answers short and skimmable. The dashboard renders charts and download buttons from the tool results automatically, so don't describe the chart — just interpret it.
- Every data card has a view switcher (table / bar / line / donut icons) and a CSV button. If the user asks to see the same data as a graph or table, tell them to click the view icons on the card — do NOT re-fetch the data.`;

// SSE helper
function sse(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

router.post('/chat', async (req, res) => {
    const { siteId, messages = [], userKey, userProvider, threadId } = req.body || {};

    // ── validate ──
    if (!siteId) return res.status(400).json({ success: false, error: '"siteId" is required.' });
    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ success: false, error: '"messages" must be a non-empty array.' });
    }
    const role = await getMemberRole(siteId, req.user.id);
    if (!role) return res.status(403).json({ success: false, error: 'You do not have access to this site.' });

    // Provider precedence: request-supplied key → user's stored BYO key → server env.
    const stored = await getUserAISettings(req.user.id);
    const provider = resolveProvider({
        userKey: userKey || stored.key,
        userProvider: userProvider || stored.provider,
        userModel: stored.model,
    });
    if (!provider) {
        return res.status(400).json({
            success: false,
            error: 'No AI provider configured. Set ANTHROPIC_API_KEY on the server or add your own key in Settings → AI.',
        });
    }

    // Cost fence — per-user, stricter when spending the server's key.
    const usingOwnKey = !!(userKey || stored.key);
    if (assistantRateLimited(req.user.id, usingOwnKey)) {
        return res.status(429).json({
            success: false,
            error: 'Assistant rate limit reached — please wait a minute and try again.',
        });
    }

    // ── memory: resolve/create the thread, persist the new user message ──
    let thread = null;
    let threadIsNew = false;
    if (threadId) thread = await ownedThread(threadId, req.user.id);
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!thread) {
        const title = (lastUser?.content || 'Conversation').slice(0, 80);
        const created = await query(
            `INSERT INTO assistant_threads (user_id, site_id, title) VALUES ($1, $2, $3) RETURNING *`,
            [req.user.id, siteId, title]
        );
        thread = created.rows[0];
        threadIsNew = true;
    }
    if (lastUser?.content) await saveMessage(thread.id, 'user', lastUser.content, []);

    const prefs = await getUserPrefs(req.user.id);

    // ── open SSE stream ──
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Tell the client which thread this is (so it can keep using it).
    sse(res, 'thread', { threadId: thread.id });

    const tools = toolCatalogue();
    const ctx = { siteId, userId: req.user.id };

    // System prompt + any durable user preferences (memory).
    const prefLines = Object.entries(prefs).map(([k, v]) => `- ${k}: ${v}`).join('\n');
    const systemPrompt = prefLines
        ? `${SYSTEM_PROMPT}\n\nUser preferences to respect:\n${prefLines}`
        : SYSTEM_PROMPT;

    // Anthropic uses a specific message shape; OpenAI accepts role/content.
    // We keep a running native-message list per provider.
    let convo = normalizeInbound(messages, provider.name);

    const abort = new AbortController();
    req.on('close', () => abort.abort());

    // Accumulate the assistant's reply so we can persist it (memory).
    let finalText = '';
    const finalCards = [];
    const persist = () => saveMessage(thread.id, 'assistant', finalText, finalCards).catch(() => {});

    // ── Usage metering + observability (P3.1 / N6) ──
    const startedAt = Date.now();
    const requestId = crypto.randomUUID().slice(0, 8);
    const meter = { tokensIn: 0, tokensOut: 0, toolCalls: 0, rounds: 0 };
    const recordUsage = () => query(
        `INSERT INTO assistant_usage
           (user_id, site_id, thread_id, provider, model, tokens_in, tokens_out,
            tool_calls, rounds, latency_ms, own_key, request_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [req.user.id, siteId, thread.id, provider.name, provider.model || null,
         meter.tokensIn, meter.tokensOut, meter.toolCalls, meter.rounds,
         Date.now() - startedAt, usingOwnKey, requestId]
    ).catch((e) => console.warn(`[assistant ${requestId}] usage record failed:`, e.message));

    try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            meter.rounds = round + 1;
            // Stream text token-by-token to the browser as the model produces it
            // (P2.3). `streamed` guards against double-emitting the final text.
            let streamed = false;
            const result = await provider.run({
                system: systemPrompt,
                messages: convo,
                tools,
                apiKey: provider.apiKey,
                model: provider.model,
                signal: abort.signal,
                onText: (delta) => { streamed = true; finalText += delta; sse(res, 'text', { delta }); },
            });

            // Aggregate token usage for this turn (P3.1/N6).
            meter.tokensIn += result.usage?.tokensIn || 0;
            meter.tokensOut += result.usage?.tokensOut || 0;

            // If the provider didn't stream (e.g. a non-streaming mock), emit the
            // whole turn's text once. When it did stream, tokens already went out.
            if (!streamed && result.text) { sse(res, 'text', { delta: result.text }); finalText += result.text; }

            if (result.stop !== 'tool_use' || result.toolCalls.length === 0) {
                await persist();
                recordUsage();
                sse(res, 'done', {});
                return res.end();
            }

            // Append the assistant's tool-request turn, then run each tool.
            convo.push(result.assistantMessage);
            const toolResults = [];
            for (const call of result.toolCalls) {
                meter.toolCalls += 1;
                const toolStart = Date.now();
                let envelope, isError = false;
                try {
                    envelope = await runTool(call.name, call.input, ctx);
                } catch (e) {
                    envelope = { summary: `Tool ${call.name} failed: ${safeMsg(e)}`, data: null, render: { type: 'none' }, download: null, deepLink: null };
                    isError = true;
                }
                // Per-tool latency line for observability (P3.1).
                console.log(`[assistant ${requestId}] tool ${call.name} ${isError ? 'ERR' : 'ok'} ${Date.now() - toolStart}ms`);
                // Stream the card to the browser (unless it errored).
                if (!isError) { sse(res, 'tool', { name: call.name, envelope }); finalCards.push(envelope); }
                toolResults.push({ call, envelope });
            }

            // Feed the tool results back for the model's next turn.
            convo = appendToolResults(convo, toolResults, provider.name);
        }

        // Hit the round cap — wrap up.
        const capMsg = '\n\n(Stopped after several tool calls. Ask a more specific question if needed.)';
        finalText += capMsg;
        sse(res, 'text', { delta: capMsg });
        await persist();
        recordUsage();
        sse(res, 'done', {});
        res.end();
    } catch (err) {
        console.error(`[assistant ${requestId}] error:`, err.message);
        recordUsage();
        // Don't leave an orphan session in history: if this request created a
        // brand-new thread and never produced any assistant text, delete it.
        // (A reused thread, or one that already streamed a partial reply, is kept.)
        if (threadIsNew && !finalText) {
            await query(`DELETE FROM assistant_threads WHERE id = $1 AND user_id = $2`, [thread.id, req.user.id])
                .catch(() => {});
        }
        sse(res, 'error', { message: safeMsg(err) });
        res.end();
    }
});

// ── message shaping ─────────────────────────────────────────────────────────────

// P1.5 — token-budget management. The client sends the FULL thread history each
// turn; unbounded, a long conversation eventually blows the context window (and
// cost). We keep the most recent MAX_HISTORY_TURNS user/assistant turns and, if
// anything was dropped, prepend a one-line note so the model knows earlier
// context existed. Configurable; the trailing turn (the new question) is always
// kept because we count from the end.
const MAX_HISTORY_TURNS = parseInt(process.env.ASSISTANT_MAX_HISTORY_TURNS) || 20;

export function normalizeInbound(messages, providerName) {
    // Only pass user/assistant text turns; strip anything unexpected, and drop
    // empty-content turns. Empty assistant turns happen when an earlier reply
    // errored mid-stream (e.g. a provider 400) and got persisted with no text —
    // Gemini rejects empty/blank message content with INVALID_ARGUMENT.
    const typed = messages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: m.content }))
        .filter((m) => m.content.trim() !== '');

    // Collapse consecutive same-role turns into one. Back-to-back user messages
    // (e.g. the user re-asked while a reply was failing) break Gemini's strict
    // user/assistant alternation; merging keeps every provider happy.
    const clean = [];
    for (const m of typed) {
        const last = clean[clean.length - 1];
        if (last && last.role === m.role) last.content += `\n\n${m.content}`;
        else clean.push({ ...m });
    }
    // The history must begin with a user turn (all providers).
    while (clean.length && clean[0].role !== 'user') clean.shift();

    if (clean.length <= MAX_HISTORY_TURNS) return clean;

    // Truncate to the most recent N turns, behind a one-line summary of the drop.
    const dropped = clean.length - MAX_HISTORY_TURNS;
    const recent = clean.slice(-MAX_HISTORY_TURNS);
    const note = {
        role: 'user',
        content: `[Earlier in this conversation, ${dropped} message${dropped === 1 ? ' was' : 's were'} omitted to stay within the context budget. Ask me to repeat anything you need from before.]`,
    };
    // A conversation must start with a user turn for both providers — the note
    // being a user message also satisfies that.
    return [note, ...recent];
}

function appendToolResults(convo, toolResults, providerName) {
    // Feed the model a SIZE-CAPPED view of each envelope (N7) — the browser
    // already got the full one via the SSE 'tool' event.
    if (providerName === 'anthropic') {
        // Anthropic expects a single user message with tool_result blocks.
        const content = toolResults.map(({ call, envelope }) => ({
            type: 'tool_result',
            tool_use_id: call.id,
            content: JSON.stringify(envelopeForModel(envelope)),
        }));
        return [...convo, { role: 'user', content }];
    }
    // OpenAI expects one message per tool call with role 'tool'.
    const toolMsgs = toolResults.map(({ call, envelope }) => ({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(envelopeForModel(envelope)),
    }));
    return [...convo, ...toolMsgs];
}

// ── Thread management (memory) ──────────────────────────────────────────────────

// GET /api/assistant/threads — recent conversations for this user.
router.get('/threads', async (req, res) => {
    try {
        // Enrich each session with a message count and a preview of the first
        // user question, so the UI can render a rich "sessions" list. Only
        // surface sessions that actually got at least one assistant reply —
        // this hides orphans left by a reply that errored before producing text.
        const r = await query(
            `SELECT t.id, t.site_id, t.title, t.created_at, t.updated_at,
                    COUNT(m.id)::int AS message_count,
                    (SELECT text FROM assistant_messages
                       WHERE thread_id = t.id AND role = 'user' AND text <> ''
                       ORDER BY created_at ASC LIMIT 1) AS first_prompt
             FROM assistant_threads t
             JOIN assistant_messages m ON m.thread_id = t.id
             WHERE t.user_id = $1
             GROUP BY t.id
             HAVING COUNT(m.id) FILTER (WHERE m.role = 'assistant' AND m.text <> '') > 0
             ORDER BY t.updated_at DESC LIMIT 30`,
            [req.user.id]
        );
        res.json({ success: true, data: r.rows });
    } catch (e) { res.status(500).json({ success: false, error: safeMsg(e) }); }
});

// GET /api/assistant/threads/:id — full message history for one thread.
router.get('/threads/:id', async (req, res) => {
    try {
        const thread = await ownedThread(req.params.id, req.user.id);
        if (!thread) return res.status(404).json({ success: false, error: 'Thread not found.' });
        const msgs = await query(
            `SELECT role, text, cards, created_at FROM assistant_messages
             WHERE thread_id = $1 ORDER BY created_at ASC`,
            [thread.id]
        );
        res.json({ success: true, data: { thread, messages: msgs.rows } });
    } catch (e) { res.status(500).json({ success: false, error: safeMsg(e) }); }
});

// DELETE /api/assistant/threads/:id — remove a conversation.
router.delete('/threads/:id', async (req, res) => {
    try {
        const thread = await ownedThread(req.params.id, req.user.id);
        if (!thread) return res.status(404).json({ success: false, error: 'Thread not found.' });
        await query(`DELETE FROM assistant_threads WHERE id = $1`, [thread.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: safeMsg(e) }); }
});

// GET/PUT /api/assistant/memory — durable per-user preferences the AI remembers.
router.get('/memory', async (req, res) => {
    try {
        res.json({ success: true, data: await getUserPrefs(req.user.id) });
    } catch (e) { res.status(500).json({ success: false, error: safeMsg(e) }); }
});
router.put('/memory', async (req, res) => {
    try {
        const prefs = req.body?.prefs && typeof req.body.prefs === 'object' ? req.body.prefs : {};
        await query(
            `INSERT INTO assistant_memory (user_id, prefs, updated_at) VALUES ($1, $2, NOW())
             ON CONFLICT (user_id) DO UPDATE SET prefs = $2, updated_at = NOW()`,
            [req.user.id, JSON.stringify(prefs)]
        );
        res.json({ success: true, data: prefs });
    } catch (e) { res.status(500).json({ success: false, error: safeMsg(e) }); }
});

// ── AI provider settings (Phase 6 — BYO key) ─────────────────────────────────────

// GET /api/assistant/settings — the user's AI config (never returns the key).
router.get('/settings', async (req, res) => {
    try {
        const r = await query(
            `SELECT provider, key_hint, model, (key_cipher IS NOT NULL) AS has_key, updated_at
             FROM assistant_settings WHERE user_id = $1`,
            [req.user.id]
        );
        const row = r.rows[0] || {};
        const serverProvider = resolveProvider({})?.name || null;
        res.json({
            success: true,
            data: {
                provider: row.provider || null,
                model: row.model || null,
                keyHint: row.key_hint || null,
                hasKey: !!row.has_key,
                // What actually runs today, given precedence.
                effectiveProvider: (row.has_key ? row.provider : null) || serverProvider,
                serverProvider,
                usingOwnKey: !!row.has_key,
            },
        });
    } catch (e) { res.status(500).json({ success: false, error: safeMsg(e) }); }
});

// PUT /api/assistant/settings — set provider / model / BYO key.
//   { provider, model?, key? }  — key: a new key to store, '' to clear, omit to keep.
router.put('/settings', async (req, res) => {
    try {
        const { provider, model, key } = req.body || {};
        if (provider && !['anthropic', 'openai', 'gemini'].includes(provider)) {
            return res.status(400).json({ success: false, error: 'provider must be "anthropic", "openai", or "gemini".' });
        }

        // Key field semantics: a non-empty string → store it; '' → clear;
        // undefined → leave the stored key untouched.
        let keyParams = [];
        if (typeof key === 'string' && key.trim()) {
            keyParams = [encrypt(key.trim()), maskSecret(key.trim())];
        }

        // Upsert. We build the param list dynamically but keep everything parameterized.
        const cols = ['user_id', 'provider', 'model'];
        const vals = [req.user.id, provider || 'anthropic', model || null];
        if (keyParams.length) { cols.push('key_cipher', 'key_hint'); vals.push(...keyParams); }
        const placeholders = vals.map((_, i) => `$${i + 1}`);

        // ON CONFLICT update set — only touch key columns when the caller sent a key.
        const updates = ['provider = EXCLUDED.provider', 'model = EXCLUDED.model', 'updated_at = NOW()'];
        if (key === '') updates.push('key_cipher = NULL', 'key_hint = NULL');
        else if (keyParams.length) updates.push('key_cipher = EXCLUDED.key_cipher', 'key_hint = EXCLUDED.key_hint');

        await query(
            `INSERT INTO assistant_settings (${cols.join(', ')}) VALUES (${placeholders.join(', ')})
             ON CONFLICT (user_id) DO UPDATE SET ${updates.join(', ')}`,
            vals
        );

        // Return the sanitized view.
        const r = await query(
            `SELECT provider, key_hint, model, (key_cipher IS NOT NULL) AS has_key
             FROM assistant_settings WHERE user_id = $1`,
            [req.user.id]
        );
        const row = r.rows[0];
        res.json({
            success: true,
            data: { provider: row.provider, model: row.model, keyHint: row.key_hint, hasKey: !!row.has_key },
        });
    } catch (e) { res.status(500).json({ success: false, error: safeMsg(e) }); }
});

// GET /api/assistant/status — is an AI provider available? (for the UI)
// Available if EITHER the caller has saved their own key OR a server key exists.
router.get('/status', async (req, res) => {
    const server = resolveProvider({});
    let ownKey = false;
    let effectiveProvider = server?.name || null;
    try {
        const { rows } = await query(
            `SELECT provider, (key_cipher IS NOT NULL) AS has_key
             FROM assistant_settings WHERE user_id = $1`,
            [req.user.id]
        );
        if (rows[0]?.has_key) {
            ownKey = true;
            effectiveProvider = rows[0].provider || effectiveProvider;
        }
    } catch { /* status is best-effort; fall back to server-key availability */ }
    res.json({
        success: true,
        data: {
            available: ownKey || !!server,
            serverProvider: server?.name || null,
            effectiveProvider,
            usingOwnKey: ownKey,
            toolCount: toolCatalogue().length,
        },
    });
});

export default router;
