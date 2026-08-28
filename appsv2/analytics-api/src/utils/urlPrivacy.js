/**
 * URL sanitisation for stored analytics data.
 *
 * `events.url` and `events.referrer` hold whatever the page's address bar and
 * `document.referrer` contained, including the full query string. Sites routinely
 * put sensitive values there — password-reset tokens, magic-link tokens, session
 * identifiers, prefilled email addresses, one-time codes — and without stripping
 * they are persisted verbatim and become readable through the dashboard, the SQL
 * Editor, exports, and Pulse.
 *
 * This runs SERVER-SIDE, at the ingest boundary, so it also protects visitors of
 * sites still serving an older cached copy of the tracking script.
 *
 * Design notes:
 *   - Allowlisting parameters would be safer still, but would silently break
 *     operators who legitimately analyse their own query parameters. A
 *     denylist of well-known credential-ish names is the smaller change that
 *     closes the common accidental leak; it is not a guarantee that no secret
 *     can ever reach storage.
 *   - UTM parameters are deliberately preserved — attribution depends on them.
 *   - The fragment (#...) is dropped entirely. It is never sent to servers in a
 *     normal request, is not used by any query in this codebase, and is a common
 *     place for tokens in SPA auth flows.
 *   - Parsing failures fall back to returning the path portion only, never the
 *     raw input: a URL we cannot parse is one we cannot be sure is safe.
 */

/**
 * Query-parameter names whose values are redacted.
 * Matched case-insensitively against the whole parameter name.
 */
const SENSITIVE_PARAM = /^(?:token|access_?token|refresh_?token|id_?token|auth|authorization|password|passwd|pwd|secret|client_?secret|api_?key|apikey|key|session|session_?id|sid|sso|otp|code|verification_?code|confirm(?:ation)?_?token|reset_?token|invite|invitation|email|e_?mail|phone|signature|sig|hash)$/i;

/** Replacement written in place of a redacted value. */
const REDACTED = 'REDACTED';

/**
 * Strip sensitive query parameters and the fragment from a URL.
 *
 * Accepts absolute URLs and path-relative values (`/search?q=x`), which is what
 * `path`-style fields and some referrers contain.
 *
 * @param {string} raw
 * @returns {string} the sanitised URL, or '' when there is nothing usable
 */
export function sanitiseUrl(raw) {
    if (typeof raw !== 'string' || raw === '') return '';

    // A base is required for relative inputs; it is discarded before returning.
    const RELATIVE_BASE = 'http://_';
    let parsed;
    try {
        parsed = new URL(raw, RELATIVE_BASE);
    } catch {
        // Unparseable: keep only what precedes the first '?' or '#', so we never
        // return an untouched string that might carry a token.
        return raw.split(/[?#]/)[0].slice(0, 2048);
    }

    let redacted = false;
    for (const name of [...parsed.searchParams.keys()]) {
        if (SENSITIVE_PARAM.test(name)) {
            parsed.searchParams.set(name, REDACTED);
            redacted = true;
        }
    }

    // Fragments are dropped unconditionally.
    parsed.hash = '';

    const wasRelative = parsed.origin === RELATIVE_BASE || parsed.href.startsWith(RELATIVE_BASE);
    const out = wasRelative
        ? parsed.pathname + parsed.search
        : parsed.href;

    void redacted; // retained for readability; no caller needs the flag today
    return out.slice(0, 2048);
}

/**
 * Same treatment for referrers. Kept as a named export so call sites read
 * clearly and so the two can diverge later without touching callers.
 */
export function sanitiseReferrer(raw) {
    if (raw == null || raw === '') return null;
    const cleaned = sanitiseUrl(String(raw));
    return cleaned === '' ? null : cleaned;
}

export const _internals = { SENSITIVE_PARAM, REDACTED };
