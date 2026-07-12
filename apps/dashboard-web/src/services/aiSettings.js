/**
 * AI Analyst provider settings (Phase 6 — bring-your-own key).
 * Talks to /api/assistant/settings. The key is write-only: the server never
 * returns it, only a masked hint + whether one is on file.
 */
function apiBase() {
    let url = import.meta.env.VITE_API_URL;
    if (!url) return '/api';
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    return `${url}/api`;
}
function authHeaders() {
    const token = localStorage.getItem('analytics-token');
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/** { provider, model, keyHint, hasKey, effectiveProvider, serverProvider, usingOwnKey } */
export async function getAISettings() {
    const resp = await fetch(`${apiBase()}/assistant/settings`, { headers: authHeaders() });
    if (!resp.ok) throw new Error(`Failed to load AI settings (${resp.status})`);
    return (await resp.json()).data;
}

/**
 * Save settings. Pass `key` as a new key string to store it, '' to clear it,
 * or omit it to keep the existing key.
 */
export async function saveAISettings({ provider, model, key }) {
    const body = { provider, model };
    if (key !== undefined) body.key = key;
    const resp = await fetch(`${apiBase()}/assistant/settings`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) throw new Error(json.error || `Save failed (${resp.status})`);
    return json.data;
}

// ── External MCP connect tokens (Phase 7) ────────────────────────────────────────

/** List the user's MCP connections (no tokens). */
export async function listConnections() {
    const resp = await fetch(`${apiBase()}/mcp/connect`, { headers: authHeaders() });
    if (!resp.ok) throw new Error(`Failed to load connections (${resp.status})`);
    return (await resp.json()).data;
}

/** Issue a new connect token. Returns { token, jti, apiUrl, config } — token shown once. */
export async function createConnection(label) {
    const resp = await fetch(`${apiBase()}/mcp/connect`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ label }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) throw new Error(json.error || `Failed to connect (${resp.status})`);
    return json.data;
}

/** Revoke a connection by jti. */
export async function revokeConnection(jti) {
    const resp = await fetch(`${apiBase()}/mcp/connect/${jti}`, { method: 'DELETE', headers: authHeaders() });
    const json = await resp.json();
    if (!resp.ok || !json.success) throw new Error(json.error || `Revoke failed (${resp.status})`);
    return true;
}
