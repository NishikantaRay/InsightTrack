/**
 * LLM provider abstraction for the AI Analyst.
 *
 * Dependency-free: talks to the Anthropic and OpenAI HTTP APIs directly via
 * native fetch (Node 20+), so no SDK install is needed in the container.
 *
 * A provider exposes ONE method:
 *   async run({ system, messages, tools, apiKey, model, signal, onText }) -> {
 *     stop: "end" | "tool_use",
 *     text: string,               // assistant text produced this turn
 *     toolCalls: [{ id, name, input }],  // tool calls the model requested
 *     usage: { tokensIn, tokensOut },    // token counts for this turn (P3.1/N6)
 *     assistantMessage: <provider-native message to append for the next turn>,
 *   }
 *
 * The caller (assistant service) runs the tools and calls run() again with the
 * tool results appended, until stop === "end".
 *
 * STREAMING (P2.3): both adapters call the provider with stream:true and fire
 * `onText(delta)` per token as text arrives, then still return the SAME
 * accumulated result object once the turn completes. This keeps tool-use
 * correct (the full tool_use block is assembled before we run tools) while the
 * browser gets token-by-token text. If `onText` is omitted, run() simply
 * accumulates silently — behaviour is identical to the old non-streaming path.
 *
 * `messages` is a neutral array: { role: 'user'|'assistant'|'tool', content, ... }.
 * Each adapter converts it to the provider's native shape.
 */

// Base URLs are overridable via env (for proxies / self-hosted gateways / tests).
const ANTHROPIC_URL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com') + '/v1/messages';
const OPENAI_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com') + '/v1/chat/completions';
// Google Gemini ships an OpenAI-compatible Chat Completions endpoint, so we
// reuse the exact same streaming adapter (openaiRun) pointed at this URL.
const GEMINI_URL = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai') + '/chat/completions';

// Default model per provider — env-overridable (P3.2), so self-hosters can pick
// a cheaper/faster tier without a code change. A per-user model override in
// assistant_settings still wins over these.
export const DEFAULT_MODELS = {
    anthropic: process.env.ASSISTANT_DEFAULT_MODEL_ANTHROPIC || 'claude-sonnet-5',
    openai: process.env.ASSISTANT_DEFAULT_MODEL_OPENAI || 'gpt-4o-mini',
    gemini: process.env.ASSISTANT_DEFAULT_MODEL_GEMINI || 'gemini-2.5-flash',
};

// Per-turn output cap (cost fence). Overridable per deployment.
const MAX_TOKENS = parseInt(process.env.ASSISTANT_MAX_TOKENS) || 1500;

// ── neutral tool shape → provider shapes ────────────────────────────────────────

function toAnthropicTools(tools) {
    return tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
    }));
}
// True if `s` is a self-contained JSON value (so a streaming provider that
// sends complete tool-call arguments per delta doesn't get double-concatenated).
function isCompleteJson(s) {
    const t = (s || '').trim();
    if (!t) return false;
    try { JSON.parse(t); return true; } catch { return false; }
}
function toOpenAITools(tools) {
    return tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }));
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }

/**
 * Read a fetch Response's SSE body line-by-line, yielding each parsed `data:`
 * JSON object. Dependency-free; handles multi-line buffering. `[DONE]`
 * sentinels (OpenAI) are skipped.
 */
async function* sseEvents(resp) {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try { yield JSON.parse(payload); } catch { /* ignore partial/keepalive */ }
        }
    }
}

// ── Anthropic adapter (streaming) ────────────────────────────────────────────────

async function anthropicRun({ system, messages, tools, apiKey, model, signal, onText }) {
    const body = {
        model: model || DEFAULT_MODELS.anthropic,
        max_tokens: MAX_TOKENS,
        system,
        tools: toAnthropicTools(tools),
        messages, // already anthropic-native (see assistant service)
        stream: true,
    };
    const resp = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal,
    });
    if (!resp.ok || !resp.body) {
        const err = resp.body ? await resp.text() : '';
        throw Object.assign(new Error(`Anthropic API error ${resp.status}: ${err.slice(0, 200)}`), { status: 502 });
    }

    // Reassemble the message from the block-delta stream. `blocks` is indexed by
    // the content_block index; tool_use inputs arrive as partial JSON strings.
    const blocks = [];         // final content blocks, in order (for assistantMessage)
    const partialJson = {};    // index → accumulated input_json_delta string
    let stopReason = 'end';
    let text = '';
    const usage = { tokensIn: 0, tokensOut: 0 }; // P3.1/N6 token metering

    for await (const ev of sseEvents(resp)) {
        // Usage: message_start carries input_tokens; message_delta carries the
        // running output_tokens (last one wins).
        if (ev.type === 'message_start' && ev.message?.usage) {
            usage.tokensIn = ev.message.usage.input_tokens || 0;
            usage.tokensOut = ev.message.usage.output_tokens || 0;
        }
        if (ev.type === 'message_delta' && ev.usage?.output_tokens != null) {
            usage.tokensOut = ev.usage.output_tokens;
        }
        switch (ev.type) {
            case 'content_block_start':
                blocks[ev.index] = ev.content_block.type === 'tool_use'
                    ? { type: 'tool_use', id: ev.content_block.id, name: ev.content_block.name, input: {} }
                    : { type: 'text', text: '' };
                if (ev.content_block.type === 'tool_use') partialJson[ev.index] = '';
                break;
            case 'content_block_delta':
                if (ev.delta.type === 'text_delta') {
                    blocks[ev.index].text += ev.delta.text;
                    text += ev.delta.text;
                    onText?.(ev.delta.text);
                } else if (ev.delta.type === 'input_json_delta') {
                    partialJson[ev.index] += ev.delta.partial_json;
                }
                break;
            case 'content_block_stop':
                if (blocks[ev.index]?.type === 'tool_use') {
                    blocks[ev.index].input = safeJson(partialJson[ev.index] || '{}');
                }
                break;
            case 'message_delta':
                if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
                break;
            case 'error':
                throw Object.assign(new Error(`Anthropic stream error: ${ev.error?.message || 'unknown'}`), { status: 502 });
        }
    }

    const content = blocks.filter(Boolean);
    const toolCalls = content
        .filter((b) => b.type === 'tool_use')
        .map((b) => ({ id: b.id, name: b.name, input: b.input || {} }));
    return {
        stop: stopReason === 'tool_use' ? 'tool_use' : 'end',
        text,
        toolCalls,
        usage,
        assistantMessage: { role: 'assistant', content },
    };
}

// ── OpenAI-compatible adapter (streaming) ───────────────────────────────────────
// Serves both OpenAI and Google Gemini — Gemini exposes the same Chat
// Completions wire protocol. `url`/`defaultModel`/`label` are bound per provider
// (see openaiRun / geminiRun below).

async function openaiCompatibleRun({ url, defaultModel, label }, { system, messages, tools, apiKey, model, signal, onText }) {
    const oaMessages = [{ role: 'system', content: system }, ...messages];
    const body = {
        model: model || defaultModel,
        max_tokens: MAX_TOKENS,
        tools: toOpenAITools(tools),
        messages: oaMessages,
        stream: true,
        stream_options: { include_usage: true }, // emit a final usage chunk (P3.1/N6)
    };
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal,
    });
    if (!resp.ok || !resp.body) {
        const err = resp.body ? await resp.text() : '';
        throw Object.assign(new Error(`${label} API error ${resp.status}: ${err.slice(0, 200)}`), { status: 502 });
    }

    // Chat-completions streaming: choices[0].delta carries either content or a
    // tool_calls[] array whose entries accumulate by index (id/name arrive
    // first, arguments stream as partial strings).
    let text = '';
    let finishReason = null;
    const toolAcc = []; // index → { id, name, args }
    const usage = { tokensIn: 0, tokensOut: 0 }; // P3.1/N6 token metering

    for await (const ev of sseEvents(resp)) {
        // The include_usage final chunk carries totals and has an empty choices[].
        if (ev.usage) {
            usage.tokensIn = ev.usage.prompt_tokens || 0;
            usage.tokensOut = ev.usage.completion_tokens || 0;
        }
        const choice = ev.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta || {};
        if (delta.content) { text += delta.content; onText?.(delta.content); }
        for (const tc of delta.tool_calls || []) {
            const i = tc.index ?? 0;
            const acc = (toolAcc[i] ||= { id: '', name: '', args: '' });
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments != null) {
                const frag = tc.function.arguments;
                // OpenAI streams arguments as fragments to concatenate; Gemini
                // sends the COMPLETE arguments object per delta (and may repeat
                // it). Concatenating those yields invalid JSON like "{}{}".
                // If a fragment is itself a complete JSON object, treat it as the
                // whole value rather than appending.
                if (isCompleteJson(frag)) acc.args = frag;
                else acc.args += frag;
            }
        }
        if (choice.finish_reason) finishReason = choice.finish_reason;
    }

    // Gemini's OpenAI-compat streaming can omit tool_calls[].id — but the id
    // must round-trip (assistant.tool_calls[].id ↔ the tool message's
    // tool_call_id) or the next request is rejected with INVALID_ARGUMENT.
    // Synthesize stable ids for any that didn't arrive.
    const finalized = toolAcc.filter(Boolean).map((t, i) => ({
        ...t,
        id: t.id || `call_${i}_${Math.random().toString(36).slice(2, 10)}`,
    }));
    const toolCalls = finalized.map((t) => ({ id: t.id, name: t.name, input: safeJson(t.args || '{}') }));
    // Rebuild the assistant message OpenAI expects appended for the next turn.
    const assistantMessage = { role: 'assistant' };
    if (toolCalls.length) {
        // Gemini's OpenAI-compat layer 400s on an empty/null `content` field when
        // tool_calls is present — the field must be OMITTED entirely (OpenAI is
        // fine either way). Only include content when there's actual text.
        if (text) assistantMessage.content = text;
        assistantMessage.tool_calls = finalized.map((t) => ({
            id: t.id, type: 'function', function: { name: t.name, arguments: t.args || '{}' },
        }));
    } else {
        assistantMessage.content = text || '';
    }
    return {
        stop: toolCalls.length || finishReason === 'tool_calls' ? 'tool_use' : 'end',
        text,
        toolCalls,
        usage,
        assistantMessage,
    };
}

// Provider-bound wrappers over the shared OpenAI-compatible adapter.
const openaiRun = (args) => openaiCompatibleRun(
    { url: OPENAI_URL, defaultModel: DEFAULT_MODELS.openai, label: 'OpenAI' }, args);
const geminiRun = (args) => openaiCompatibleRun(
    { url: GEMINI_URL, defaultModel: DEFAULT_MODELS.gemini, label: 'Gemini' }, args);

// ── provider selection ──────────────────────────────────────────────────────────

const RUNNERS = { anthropic: anthropicRun, openai: openaiRun, gemini: geminiRun };

/**
 * Resolve which provider + key to use.
 * Precedence: caller-supplied (BYO) key → server env key.
 * @param {object} opts
 * @param {string} [opts.userKey]      bring-your-own API key
 * @param {string} [opts.userProvider] 'anthropic' | 'openai' | 'gemini' (BYO key)
 * @param {string} [opts.userModel]    optional model override
 * @returns { name, run, apiKey, model } or null if no key is available.
 */
export function resolveProvider({ userKey, userProvider, userModel } = {}) {
    const withModel = (p) => (userModel ? { ...p, model: userModel } : p);

    // 1. Bring-your-own key wins. Default to Anthropic if the provider is unset.
    if (userKey) {
        const name = RUNNERS[userProvider] ? userProvider : 'anthropic';
        return withModel({ name, run: RUNNERS[name], apiKey: userKey });
    }

    // 2. Server keys, in precedence order.
    if (process.env.ANTHROPIC_API_KEY) return withModel({ name: 'anthropic', run: anthropicRun, apiKey: process.env.ANTHROPIC_API_KEY });
    if (process.env.OPENAI_API_KEY) return withModel({ name: 'openai', run: openaiRun, apiKey: process.env.OPENAI_API_KEY });
    if (process.env.GEMINI_API_KEY) return withModel({ name: 'gemini', run: geminiRun, apiKey: process.env.GEMINI_API_KEY });

    return null;
}

export const PROVIDERS = { anthropic: anthropicRun, openai: openaiRun, gemini: geminiRun };
