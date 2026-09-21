/**
 * Deriving a search phrase from a URL path.
 *
 * Split out of keywordDiscoveryService so it can be imported on its own. That
 * service pulls in the DuckDB query layer at module load, and DuckDB is
 * single-writer — so any setup script importing it blocks forever against a
 * running API server holding the lock. This half needs no I/O at all.
 */

/** Words that carry no topical meaning in a URL path. */
export const STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'at', 'by', 'with',
    'blog', 'post', 'posts', 'article', 'articles', 'page', 'pages', 'guide', 'guides',
    'docs', 'doc', 'tutorial', 'tutorials', 'how', 'what', 'why', 'index', 'html', 'php',
    'en', 'us', 'www', 'v1', 'v2', 'amp',
    // File types. A path ending .pdf described the file, not the topic — and
    // "… pdf" as a tracked keyword spends a credit searching for the wrong thing.
    'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip', 'txt', 'csv',
]);

/**
 * Paths that are application routes, not content. Nobody reaches /login from a
 * Google search for "login", so tracking it buys a confident explanation of a
 * change that search never caused.
 */
export const NON_CONTENT = new Set([
    'login', 'logout', 'signin', 'sign-in', 'signup', 'sign-up', 'register',
    'dashboard', 'account', 'settings', 'profile', 'admin', 'search', 'cart',
    'checkout', 'privacy', 'terms', 'reset-password', 'forgot-password', '404',
]);

/**
 * Derive a human search phrase from a URL path.
 *   /guides/email-templates        → "email templates"
 *   /blog/2026/03/best-crm-tools   → "best crm tools"
 *   /0:/7th%20Sem/                 → "7th sem"   (percent-decoded)
 *   /login                         → null  (an app route, not a topic)
 *   /                              → null  (a homepage has no topic)
 *
 * Percent-decoding matters more than it looks: a path with %20 in it produced
 * "7th%20sem", which then went to Google as a literal search and spent a real
 * credit on a query no human would ever type.
 */
export function phraseFromPath(path) {
    if (!path || path === '/') return null;

    let raw = String(path).split('?')[0].split('#')[0];

    // Percent-decode before splitting, so %2F cannot forge a segment boundary.
    // Malformed escapes (a lone %) throw rather than decode — keep the original.
    try {
        raw = decodeURIComponent(raw.replace(/\+/g, ' '));
    } catch {
        /* leave raw as-is */
    }

    const segments = raw
        .split('/')
        .filter(Boolean)
        // Drop date-like and purely numeric segments (/2026/03/, /p/1234), and
        // storage-driver prefixes like the "0:" of a Google Drive mount.
        .filter((s) => !/^\d+$/.test(s) && !/^\d+:$/.test(s));

    if (segments.length === 0) return null;

    // The last meaningful segment is usually the topic; earlier ones are taxonomy.
    const last = segments[segments.length - 1].replace(/\.[a-z0-9]{1,5}$/i, '');
    if (NON_CONTENT.has(last.toLowerCase().trim())) return null;

    const words = last
        // Split on separators AND whitespace, which decoding can now introduce.
        .split(/[-_+.\s]+/)
        .map((w) => w.toLowerCase().trim())
        // Drop bracketed asides — "(Derivation)" is a note about the file.
        .map((w) => w.replace(/^[([{]+|[)\]}]+$/g, ''))
        .filter((w) => w && !STOPWORDS.has(w) && !/^\d+$/.test(w));

    if (words.length === 0) return null;
    return words.join(' ');
}

export default { phraseFromPath, STOPWORDS, NON_CONTENT };
