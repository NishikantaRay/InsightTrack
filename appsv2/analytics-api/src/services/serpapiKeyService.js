/**
 * Per-site SerpApi key storage.
 *
 * Follows the same contract as the Sentry integration (services/sentryService.js):
 * the key is AES-256-GCM encrypted into site_integrations.token_cipher via
 * utils/secretBox.js, and is NEVER returned to a client — reads give back only a
 * masked hint ("abc…7f21") plus connection status.
 *
 * Resolution order when a SERP lookup needs a key:
 *   1. the site's own stored key   (set in the UI, encrypted at rest)
 *   2. process.env.SERPAPI_KEY     (server-wide fallback for self-hosters)
 *   3. neither → fixture mode, and the UI says so
 *
 * Per-site beats env so one deployment can serve several sites on separate
 * SerpApi accounts, while a solo self-hoster can still just set the env var.
 */
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/postgres.js';
import { encrypt, decrypt, maskSecret } from '../utils/secretBox.js';

const PROVIDER = 'serpapi';

/** Public shape — deliberately contains no secret material. */
function toPublic(row) {
    if (!row) return { connected: false, keyHint: null, source: null, enabled: false };
    const config = row.config || {};
    return {
        id: row.id,
        connected: !!row.token_cipher,
        keyHint: config.keyHint || null,
        enabled: row.enabled !== false,
        status: row.status || 'pending',
        lastError: row.last_error || null,
        lastCheckedAt: row.last_synced_at || null,
        source: 'site',
    };
}

async function getRow(siteId) {
    const { rows } = await query(
        `SELECT * FROM site_integrations WHERE site_id = $1 AND provider = $2 LIMIT 1`,
        [siteId, PROVIDER],
    );
    return rows[0] || null;
}

/**
 * Connection status for the settings UI. Reports the env fallback too, so the
 * user understands why lookups work even with nothing saved here.
 */
export async function getStatus(siteId) {
    const row = await getRow(siteId);
    if (row?.token_cipher) return toPublic(row);

    const envKey = (process.env.SERPAPI_KEY || '').trim();
    if (envKey) {
        return {
            connected: true,
            keyHint: maskSecret(envKey),
            enabled: true,
            status: 'ok',
            lastError: null,
            // Tells the UI this came from the server env and is not editable here.
            source: 'env',
        };
    }
    return { connected: false, keyHint: null, enabled: false, status: 'absent', lastError: null, source: null };
}

/** Save (or replace) a site's SerpApi key. Returns the public, masked shape. */
export async function saveKey(siteId, rawKey) {
    const key = String(rawKey || '').trim();
    if (!key) {
        throw Object.assign(new Error('A SerpApi key is required'), { status: 400 });
    }
    // SerpApi keys are 64-char lowercase hex. Validate the shape so an obvious
    // paste error is caught here rather than surfacing as a failed search later.
    if (!/^[a-f0-9]{40,80}$/i.test(key)) {
        throw Object.assign(
            new Error('That does not look like a SerpApi key — expected a long hexadecimal string from serpapi.com/manage-api-key'),
            { status: 400 },
        );
    }

    const existing = await getRow(siteId);
    const config = { ...(existing?.config || {}), keyHint: maskSecret(key) };

    if (existing) {
        const { rows } = await query(
            `UPDATE site_integrations
                SET token_cipher = $1, config = $2, enabled = TRUE,
                    status = 'pending', last_error = NULL, updated_at = NOW()
              WHERE id = $3 RETURNING *`,
            [encrypt(key), JSON.stringify(config), existing.id],
        );
        return toPublic(rows[0]);
    }

    const id = `int_${uuidv4().slice(0, 12)}`;
    const { rows } = await query(
        `INSERT INTO site_integrations (id, site_id, provider, token_cipher, config, enabled, status)
         VALUES ($1, $2, $3, $4, $5, TRUE, 'pending') RETURNING *`,
        [id, siteId, PROVIDER, encrypt(key), JSON.stringify(config)],
    );
    return toPublic(rows[0]);
}

/** Forget a site's key. Falls back to the env key (or fixture mode) afterwards. */
export async function removeKey(siteId) {
    const { rowCount } = await query(
        `DELETE FROM site_integrations WHERE site_id = $1 AND provider = $2`,
        [siteId, PROVIDER],
    );
    return rowCount > 0;
}

/** Record the outcome of a live call so the UI can show a real status. */
export async function recordResult(siteId, { ok, error = null }) {
    await query(
        `UPDATE site_integrations
            SET status = $1, last_error = $2, last_synced_at = NOW(), updated_at = NOW()
          WHERE site_id = $3 AND provider = $4`,
        [ok ? 'ok' : 'error', ok ? null : String(error || '').slice(0, 500), siteId, PROVIDER],
    );
}

/**
 * The decrypted key for a site, or null.
 *
 * The ONLY function that returns secret material, and it is called exclusively
 * by the SERP client — never by a route handler. An undecryptable blob (e.g.
 * after rotating JWT_SECRET) is treated as absent, matching secretBox's contract.
 */
export async function resolveKey(siteId) {
    if (siteId) {
        const row = await getRow(siteId);
        if (row?.token_cipher && row.enabled !== false) {
            const key = decrypt(row.token_cipher);
            if (key) return { key, source: 'site' };
        }
    }
    const envKey = (process.env.SERPAPI_KEY || '').trim();
    if (envKey) return { key: envKey, source: 'env' };
    return { key: null, source: null };
}

export default { getStatus, saveKey, removeKey, recordResult, resolveKey };
