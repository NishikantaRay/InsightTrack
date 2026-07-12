import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { once } from 'node:events';

// A tiny local server that replays canned SSE bodies, so we exercise the real
// streaming parser in provider.js without hitting a paid API. We route
// Anthropic and OpenAI to the same server via the *_BASE_URL env overrides and
// branch on the request path.
//
// The base URL must be set BEFORE provider.js is imported (it reads the env at
// module load), and top-level `await import` in ESM runs before beforeAll —
// so we start the server and set the env HERE at module scope.
const server = http.createServer((req, res) => {
    const body = req.url.includes('/v1/messages') ? ANTHROPIC_SSE : OPENAI_SSE;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end(body);
});
server.listen(0);
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
process.env.ANTHROPIC_BASE_URL = base;
process.env.OPENAI_BASE_URL = base;
// Gemini reuses the OpenAI-compatible adapter; its path isn't /v1/messages, so
// the mock server serves it the OpenAI SSE body — exactly the real wire format.
process.env.GEMINI_BASE_URL = base;

// Anthropic message stream: text deltas + a tool_use block whose input arrives
// as partial JSON, ending in stop_reason:"tool_use".
const ANTHROPIC_SSE = [
    'event: message_start',
    'data: {"type":"message_start","message":{"id":"m1","usage":{"input_tokens":42,"output_tokens":1}}}',
    '',
    'event: content_block_start',
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
    '',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello "}}',
    '',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"world"}}',
    '',
    'data: {"type":"content_block_stop","index":0}',
    '',
    'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"tu_1","name":"get_kpi","input":{}}}',
    '',
    'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"dateRange\\":"}}',
    '',
    'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"\\"7d\\"}"}}',
    '',
    'data: {"type":"content_block_stop","index":1}',
    '',
    'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":17}}',
    '',
    'data: {"type":"message_stop"}',
    '',
].join('\n');

// OpenAI chat.completions stream: content deltas, finish_reason, then a final
// usage-only chunk (from stream_options.include_usage).
const OPENAI_SSE = [
    'data: {"choices":[{"delta":{"role":"assistant","content":"Hi "}}]}',
    '',
    'data: {"choices":[{"delta":{"content":"there"}}]}',
    '',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
    '',
    'data: {"choices":[],"usage":{"prompt_tokens":30,"completion_tokens":5}}',
    '',
    'data: [DONE]',
    '',
].join('\n');

afterAll(() => new Promise((r) => server.close(r)));

// Import AFTER the base URLs are set (module reads them at load).
const { PROVIDERS } = await import('../src/mcp/llm/provider.js');

describe('provider streaming (P2.3)', () => {
    it('Anthropic: fires onText per delta and assembles text + tool_use', async () => {
        const chunks = [];
        const result = await PROVIDERS.anthropic({
            system: 's', messages: [{ role: 'user', content: 'hi' }],
            tools: [{ name: 'get_kpi', description: 'd', inputSchema: { type: 'object', properties: {} } }],
            apiKey: 'k', onText: (t) => chunks.push(t),
        });

        expect(chunks).toEqual(['Hello ', 'world']);      // streamed token-by-token
        expect(result.text).toBe('Hello world');           // accumulated
        expect(result.stop).toBe('tool_use');
        expect(result.toolCalls).toEqual([{ id: 'tu_1', name: 'get_kpi', input: { dateRange: '7d' } }]);
        // assistantMessage preserves both blocks for the next turn.
        expect(result.assistantMessage.content.map((b) => b.type)).toEqual(['text', 'tool_use']);
        // Token usage surfaced for metering (P3.1/N6).
        expect(result.usage).toEqual({ tokensIn: 42, tokensOut: 17 });
    });

    it('Anthropic: works with no onText (silent accumulation)', async () => {
        const result = await PROVIDERS.anthropic({
            system: 's', messages: [{ role: 'user', content: 'hi' }], tools: [], apiKey: 'k',
        });
        expect(result.text).toBe('Hello world');
    });

    it('OpenAI: streams content deltas and ends cleanly', async () => {
        const chunks = [];
        const result = await PROVIDERS.openai({
            system: 's', messages: [{ role: 'user', content: 'hi' }], tools: [],
            apiKey: 'k', onText: (t) => chunks.push(t),
        });
        expect(chunks).toEqual(['Hi ', 'there']);
        expect(result.text).toBe('Hi there');
        expect(result.stop).toBe('end');
        expect(result.toolCalls).toEqual([]);
        // Usage from the include_usage final chunk (P3.1/N6).
        expect(result.usage).toEqual({ tokensIn: 30, tokensOut: 5 });
    });

    it('Gemini: reuses the OpenAI-compatible adapter (streams + usage)', async () => {
        const chunks = [];
        const result = await PROVIDERS.gemini({
            system: 's', messages: [{ role: 'user', content: 'hi' }], tools: [],
            apiKey: 'AIza-mock', onText: (t) => chunks.push(t),
        });
        expect(chunks).toEqual(['Hi ', 'there']);
        expect(result.text).toBe('Hi there');
        expect(result.stop).toBe('end');
        expect(result.usage).toEqual({ tokensIn: 30, tokensOut: 5 });
    });
});
