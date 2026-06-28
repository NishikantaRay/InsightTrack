/**
 * safeError — strips internal detail before sending error responses to clients.
 *
 * In development (NODE_ENV=development) the full message is returned so developers
 * can debug locally. In all other environments only a generic message is sent.
 *
 * Rules:
 *  - Validation / auth errors (status 4xx) always pass the message through —
 *    they are intentional user-facing messages, not internal stack info.
 *  - Internal server errors (status 5xx) are masked in production.
 *  - Never forward stack traces, file paths, PG error codes, or env var names.
 */

const IS_DEV = process.env.NODE_ENV === 'development';

// Safe messages for known 4xx situations (pass through as-is)
const SAFE_4XX_PATTERNS = [
    /already exists/i,
    /is required/i,
    /invalid/i,
    /not found/i,
    /forbidden/i,
    /only .+ can/i,
    /must be/i,
    /email or password/i,
    /token/i,
    /expired/i,
    /access/i,
    /permission/i,
    /cannot/i,
];

/**
 * Returns a safe error message string suitable for API responses.
 * @param {Error} err
 * @param {number} [statusHint] — HTTP status code (4xx messages are safer to forward)
 * @returns {string}
 */
export function safeMsg(err, statusHint) {
    if (IS_DEV) return err?.message || 'Unknown error';

    const msg    = err?.message || '';
    const status = statusHint || err?.status || 500;

    // 4xx: pass if the message matches a known-safe pattern
    if (status >= 400 && status < 500) {
        if (SAFE_4XX_PATTERNS.some(p => p.test(msg))) return msg;
    }

    // 5xx or unrecognised: generic message
    return 'An internal error occurred. Please try again.';
}

/**
 * Express error-handler helper: logs + responds safely.
 * @param {Response} res
 * @param {Error} err
 * @param {number} [statusHint]
 */
export function sendError(res, err, statusHint) {
    const status = statusHint || err?.status || 500;
    if (status >= 500) console.error('[error]', err?.message, err?.stack?.split('\n')[1]?.trim());
    res.status(status).json({ error: safeMsg(err, status) });
}
