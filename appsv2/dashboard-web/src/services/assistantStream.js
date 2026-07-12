/**
 * Streams POST /api/assistant/chat (Server-Sent Events) using fetch.
 * axios can't stream, so we read the ReadableStream and parse SSE frames.
 *
 * onEvent(event, data) is called for each frame:
 *   'thread' → { threadId }
 *   'text'   → { delta }
 *   'tool'   → { name, envelope }
 *   'done'   → {}
 *   'error'  → { message }
 *
 * Returns an AbortController so the caller can cancel.
 */
function apiBase() {
    let url = import.meta.env.VITE_API_URL;
    if (!url) return '/api';
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    return `${url}/api`;
}

function authHeaders() {
    const token = localStorage.getItem('analytics-token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Fetch one saved thread's messages: resolves to { thread, messages } or null. */
export async function loadThreadFromServer(id) {
    const resp = await fetch(`${apiBase()}/assistant/threads/${id}`, { headers: authHeaders() });
    if (!resp.ok) return null;
    const json = await resp.json();
    return json?.success ? json.data : null;
}

/** List recent conversations: resolves to an array (possibly empty). */
export async function listThreads() {
    const resp = await fetch(`${apiBase()}/assistant/threads`, { headers: authHeaders() });
    if (!resp.ok) return [];
    const json = await resp.json();
    return json?.success ? json.data : [];
}

/** Delete a saved conversation. Resolves true on success. */
export async function deleteThread(id) {
    const resp = await fetch(`${apiBase()}/assistant/threads/${id}`, {
        method: 'DELETE', headers: authHeaders(),
    });
    return resp.ok;
}

/** Is an AI provider configured? → { available, serverProvider, toolCount }. */
export async function getAssistantStatus() {
    try {
        const resp = await fetch(`${apiBase()}/assistant/status`, { headers: authHeaders() });
        if (!resp.ok) return { available: false };
        return (await resp.json()).data || { available: false };
    } catch {
        return { available: false };
    }
}

export function streamChat({ siteId, messages, threadId, userKey, userProvider }, onEvent) {
    const controller = new AbortController();
    const token = localStorage.getItem('analytics-token');

    (async () => {
        try {
            const resp = await fetch(`${apiBase()}/assistant/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ siteId, messages, threadId, userKey, userProvider }),
                signal: controller.signal,
            });

            if (!resp.ok || !resp.body) {
                let msg = `Request failed (${resp.status})`;
                try { msg = (await resp.json()).error || msg; } catch { /* non-JSON */ }
                onEvent('error', { message: msg });
                return;
            }

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                // SSE frames are separated by a blank line.
                let idx;
                while ((idx = buffer.indexOf('\n\n')) !== -1) {
                    const frame = buffer.slice(0, idx);
                    buffer = buffer.slice(idx + 2);
                    let event = 'message';
                    let dataLine = '';
                    for (const line of frame.split('\n')) {
                        if (line.startsWith('event:')) event = line.slice(6).trim();
                        else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
                    }
                    if (dataLine) {
                        try { onEvent(event, JSON.parse(dataLine)); } catch { /* ignore malformed */ }
                    }
                }
            }
            onEvent('done', {});
        } catch (err) {
            if (err.name !== 'AbortError') onEvent('error', { message: err.message || 'Stream error' });
        }
    })();

    return controller;
}
