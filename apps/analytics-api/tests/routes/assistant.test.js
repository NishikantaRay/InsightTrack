import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupTestDB, cleanTestDB, closeTestDB, insertTestSite, TEST_SITE_ID } from '../testHelper.js';

// Env BEFORE dynamic imports: secretBox derives its key at import time, and
// the assistant's rate-limit constants are read at module load.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.ASSISTANT_RATE_LIMIT_SERVER_KEY = '3';   // small so the test can hit it
process.env.ASSISTANT_RATE_LIMIT_OWN_KEY = '30';

// Mock the LLM provider — the loop runs for real, the model is scripted.
vi.mock('../../src/mcp/llm/provider.js', () => ({
    DEFAULT_MODELS: { anthropic: 'claude-sonnet-5', openai: 'gpt-4o-mini' },
    resolveProvider: vi.fn(() => ({
        name: 'anthropic',
        apiKey: 'mock',
        model: 'claude-sonnet-5',
        run: async () => ({
            stop: 'end',
            text: 'Mocked answer: traffic looks great.',
            toolCalls: [],
            usage: { tokensIn: 100, tokensOut: 25 },
            assistantMessage: { role: 'assistant', content: 'Mocked answer: traffic looks great.' },
        }),
    })),
}));

const { default: assistantRoutes } = await import('../../src/routes/assistant.js');
const { default: authService } = await import('../../src/services/authService.js');
const { query } = await import('../../src/db/postgres.js');

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/assistant', assistantRoutes);
    return app;
}

const chat = (app, token, body) =>
    request(app).post('/api/assistant/chat').set('Authorization', `Bearer ${token}`).send(body);

describe('Assistant routes — scoping, memory, key hygiene, cost fences', () => {
    let app, user, token;

    beforeAll(async () => {
        await setupTestDB();
        await cleanTestDB();
        app = createApp();
        ({ user, token } = await authService.register(
            'Assistant Tester', 'assistant-routes@test.example.com', 'password-123'
        ));
        await insertTestSite();
        await query(
            `INSERT INTO site_members (site_id, user_id, role) VALUES ($1, $2, 'owner')
             ON CONFLICT (site_id, user_id) DO NOTHING`,
            [TEST_SITE_ID, user.id]
        );
    });

    afterAll(async () => {
        await cleanTestDB(); // cascades: threads, messages, settings, memory
        await closeTestDB();
    });

    describe('POST /chat', () => {
        it('403s on a site the caller has no membership in', async () => {
            const res = await chat(app, token, {
                siteId: 'site_someone_elses',
                messages: [{ role: 'user', content: 'hi' }],
            });
            expect(res.status).toBe(403);
        });

        it('runs the loop and streams thread → text → done, persisting the thread', async () => {
            const res = await chat(app, token, {
                siteId: TEST_SITE_ID,
                messages: [{ role: 'user', content: 'How is traffic?' }],
            });
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('text/event-stream');
            expect(res.text).toContain('event: thread');
            expect(res.text).toContain('Mocked answer');
            expect(res.text).toContain('event: done');

            const threads = await query(`SELECT * FROM assistant_threads WHERE user_id = $1`, [user.id]);
            expect(threads.rows.length).toBeGreaterThan(0);
            const msgs = await query(
                `SELECT role, text FROM assistant_messages WHERE thread_id = $1 ORDER BY created_at`,
                [threads.rows[0].id]
            );
            expect(msgs.rows.map((m) => m.role)).toEqual(['user', 'assistant']);
        });

        it('records a usage row with tokens, provider, and latency (N6/P3.1)', async () => {
            await chat(app, token, {
                siteId: TEST_SITE_ID,
                messages: [{ role: 'user', content: 'usage check' }],
            });
            // The insert is fire-and-forget; give it a beat to land.
            await new Promise((r) => setTimeout(r, 100));
            const usage = await query(
                `SELECT * FROM assistant_usage WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [user.id]
            );
            expect(usage.rows.length).toBe(1);
            const row = usage.rows[0];
            expect(row.tokens_in).toBe(100);
            expect(row.tokens_out).toBe(25);
            expect(row.provider).toBe('anthropic');
            expect(row.site_id).toBe(TEST_SITE_ID);
            expect(row.latency_ms).toBeGreaterThanOrEqual(0);
            expect(row.request_id).toBeTruthy();
        });

        it('429s past the per-user limit when running on the server key (P0.3)', async () => {
            // Limit is 3/min; the previous test used 1. Burn the remainder, then overflow.
            const body = { siteId: TEST_SITE_ID, messages: [{ role: 'user', content: 'again' }] };
            let last;
            for (let i = 0; i < 3; i++) last = await chat(app, token, body);
            expect(last.status).toBe(429);
            expect(last.body.error).toContain('rate limit');
        });
    });

    describe('thread ownership', () => {
        it("404s on threads that aren't the caller's", async () => {
            const res = await request(app)
                .get('/api/assistant/threads/999999')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });

    describe('AI settings — BYO key is write-only (P0.2)', () => {
        it('stores a key encrypted and returns only a masked hint', async () => {
            const res = await request(app)
                .put('/api/assistant/settings')
                .set('Authorization', `Bearer ${token}`)
                .send({ provider: 'anthropic', key: 'sk-ant-api03-supersecret-abcd' });
            expect(res.status).toBe(200);
            expect(res.body.data.hasKey).toBe(true);
            expect(res.body.data.keyHint).not.toContain('supersecret');
            expect(JSON.stringify(res.body)).not.toContain('supersecret');

            // At rest: ciphertext only.
            const row = await query(`SELECT key_cipher FROM assistant_settings WHERE user_id = $1`, [user.id]);
            expect(row.rows[0].key_cipher).not.toContain('supersecret');
        });

        it('GET never returns the key', async () => {
            const res = await request(app)
                .get('/api/assistant/settings')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.hasKey).toBe(true);
            expect(JSON.stringify(res.body)).not.toContain('supersecret');
        });

        it("key: '' clears the stored key", async () => {
            const res = await request(app)
                .put('/api/assistant/settings')
                .set('Authorization', `Bearer ${token}`)
                .send({ provider: 'anthropic', key: '' });
            expect(res.status).toBe(200);
            expect(res.body.data.hasKey).toBe(false);
        });

        it('rejects unknown providers', async () => {
            const res = await request(app)
                .put('/api/assistant/settings')
                .set('Authorization', `Bearer ${token}`)
                .send({ provider: 'skynet' });
            expect(res.status).toBe(400);
        });

        it('accepts gemini as a provider and stores its key (N10)', async () => {
            const res = await request(app)
                .put('/api/assistant/settings')
                .set('Authorization', `Bearer ${token}`)
                .send({ provider: 'gemini', key: 'AIza-gemini-secret-key', model: 'gemini-2.5-flash' });
            expect(res.status).toBe(200);
            expect(res.body.data.provider).toBe('gemini');
            expect(res.body.data.hasKey).toBe(true);
            expect(JSON.stringify(res.body)).not.toContain('gemini-secret-key');
        });
    });

    describe('preference memory', () => {
        it('round-trips prefs', async () => {
            const put = await request(app)
                .put('/api/assistant/memory')
                .set('Authorization', `Bearer ${token}`)
                .send({ prefs: { defaultRange: '7d' } });
            expect(put.status).toBe(200);

            const get = await request(app)
                .get('/api/assistant/memory')
                .set('Authorization', `Bearer ${token}`);
            expect(get.body.data).toEqual({ defaultRange: '7d' });
        });
    });
});
