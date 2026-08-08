/**
 * sentryService — per-site Sentry integration.
 *
 * Each site can connect one Sentry project. We store the Sentry auth token
 * AES-256-GCM-encrypted (secretBox) plus the org/project slugs and instance
 * base URL as non-secret config. A background poll (pollAllSentry, driven from
 * index.js alongside the DuckDB sync loop) calls Sentry's REST API for every
 * enabled integration and upserts the returned issues into the sentry_issues
 * PostgreSQL table, which then syncs to DuckDB for the Errors page reads.
 *
 * Writes → PostgreSQL only (golden rule 2). Reads for the dashboard come from
 * DuckDB via queries.js. This service never touches DuckDB.
 *
 * Sentry API used (works for SaaS sentry.io and self-hosted):
 *   GET {baseUrl}/api/0/projects/{org}/{project}/issues/?query=&statsPeriod=14d
 *   Authorization: Bearer <token>
 * Auth tokens: Sentry → Settings → Auth Tokens (needs project:read / event:read).
 */
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/postgres.js';
import { encrypt, decrypt, maskSecret } from '../utils/secretBox.js';

const PROVIDER = 'sentry';
const DEFAULT_BASE_URL = 'https://sentry.io';
const ISSUES_PER_POLL = Number(process.env.SENTRY_ISSUES_PER_POLL) || 100;   // page size
const MAX_ISSUES = Number(process.env.SENTRY_MAX_ISSUES) || 1_000;           // per-project cap
const MAX_PAGES = Math.max(1, Math.ceil(MAX_ISSUES / ISSUES_PER_POLL) + 1);  // safety stop
const SENTRY_TIMEOUT_MS = Number(process.env.SENTRY_TIMEOUT_MS) || 15_000;
const POLL_CONCURRENCY = Math.max(1, Number(process.env.SENTRY_POLL_CONCURRENCY) || 4);
const STATS_PERIOD = process.env.SENTRY_STATS_PERIOD || '30d';   // trend window fetched from Sentry
// Adaptive cadence (seconds). Active projects poll at BASE; quiet ones back off
// one step per idle poll up to MAX; auth failures back off to AUTH_FAIL so we
// don't hammer Sentry with a known-bad token until the user re-tests.
const CADENCE_BASE_S = Number(process.env.SENTRY_CADENCE_BASE_S) || 300;       // 5 min
const CADENCE_MAX_S = Number(process.env.SENTRY_CADENCE_MAX_S) || 3_600;       // 1 h
const CADENCE_AUTH_FAIL_S = Number(process.env.SENTRY_CADENCE_AUTH_FAIL_S) || 21_600; // 6 h

/** True when a poll error means the credentials/target are wrong (not transient). */
function isAuthError(err) {
    return err?.status === 401 || err?.status === 404;
}

/**
 * True when a stored last_error message indicates the token/target is wrong and
 * the user must act (re-paste the token / fix the org/project) — surfaced as an
 * `authError` flag so the UI can show a "reconnect required" prompt (P3.3).
 */
function isAuthErrorMessage(msg) {
    return /rejected the auth token|org or project not found|token could not be read/i.test(String(msg || ''));
}

// Strip a trailing slash and force https:// so a bare host still works.
function normalizeBaseUrl(raw) {
    let u = String(raw || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    return u;
}

/**
 * Parse Sentry's RFC-5988 Link header and return the next-page URL, or null.
 * Sentry marks the terminal page with results="false" on the next rel.
 * Example: <https://…?cursor=X>; rel="next"; results="true"; cursor="X"
 */
function nextCursorUrl(linkHeader) {
    if (!linkHeader) return null;
    for (const part of linkHeader.split(',')) {
        const seg = part.trim();
        if (!/rel="next"/.test(seg)) continue;
        if (/results="false"/.test(seg)) return null;
        const m = seg.match(/^<([^>]+)>/);
        if (m) return m[1];
    }
    return null;
}

/** Shape an integration DB row for API responses — never leaks the token. */
function toPublic(row) {
    if (!row) return null;
    const config = row.config || {};
    return {
        id: row.id,
        siteId: row.site_id,
        provider: row.provider,
        connected: !!row.token_cipher,
        tokenHint: config.tokenHint || null,
        org: config.org || null,
        project: config.project || null,
        baseUrl: config.baseUrl || DEFAULT_BASE_URL,
        enabled: row.enabled,
        status: row.status,
        lastError: row.last_error || null,
        // authError = the failure is a bad token / wrong org-project the user must
        // fix (vs. a transient network blip). Drives the "reconnect" prompt (P3.3).
        authError: row.status === 'error' && isAuthErrorMessage(row.last_error),
        lastSyncedAt: row.last_synced_at || null,
        updatedAt: row.updated_at || null,
        // Webhook secret is shown so the user can paste it into Sentry's webhook
        // config. It's a shared HMAC secret (not the auth token), safe to display
        // to a site admin — the same person who can already see the connection.
        webhookConfigured: !!config.webhookSecret,
        webhookSecret: config.webhookSecret || null,
    };
}

export const sentryService = {
    /**
     * Fetch the "primary" raw integration row for a site (internal — includes
     * cipher). A site may now have several Sentry projects; internal callers that
     * only need any-connected-project (webhook fallback, latest-event token) use
     * the oldest one.
     */
    async _getRow(siteId) {
        const { rows } = await query(
            `SELECT * FROM site_integrations WHERE site_id = $1 AND provider = $2
             ORDER BY created_at ASC LIMIT 1`,
            [siteId, PROVIDER],
        );
        return rows[0] || null;
    },

    /** Fetch one raw integration row by id, scoped to a site (or null). */
    async _getRowById(integrationId, siteId) {
        const { rows } = await query(
            `SELECT * FROM site_integrations
             WHERE id = $1 AND site_id = $2 AND provider = $3 LIMIT 1`,
            [integrationId, siteId, PROVIDER],
        );
        return rows[0] || null;
    },

    /** Find an existing integration for a site by (org, project) — for dedup. */
    async _getRowByProject(siteId, org, project) {
        const { rows } = await query(
            `SELECT * FROM site_integrations
             WHERE site_id = $1 AND provider = $2
               AND config->>'org' = $3 AND config->>'project' = $4
             LIMIT 1`,
            [siteId, PROVIDER, org, project],
        );
        return rows[0] || null;
    },

    /** All of a site's Sentry integrations, public shape (no secrets). */
    async getIntegrations(siteId) {
        const { rows } = await query(
            `SELECT * FROM site_integrations WHERE site_id = $1 AND provider = $2
             ORDER BY created_at ASC`,
            [siteId, PROVIDER],
        );
        return rows.map(toPublic);
    },

    /** The primary integration (first project) — public shape, or null. */
    async getIntegration(siteId) {
        return toPublic(await this._getRow(siteId));
    },

    /**
     * Create or update a Sentry integration for a site. A site may connect
     * multiple projects, so:
     *  - if input.id is given, update that row (scoped to the site);
     *  - else if the site already has a row for this (org, project), update it;
     *  - else create a new integration.
     * @param {string} siteId
     * @param {{ id?: string, token?: string, org: string, project: string, baseUrl?: string, enabled?: boolean }} input
     */
    async upsertIntegration(siteId, input) {
        const org = String(input.org || '').trim();
        const project = String(input.project || '').trim();
        if (!org || !project) {
            const e = new Error('Sentry org and project are required');
            e.status = 400;
            throw e;
        }
        const baseUrl = normalizeBaseUrl(input.baseUrl);

        // Resolve which existing row (if any) this save targets.
        let existing = null;
        if (input.id) {
            existing = await this._getRowById(input.id, siteId);
            if (!existing) {
                const e = new Error('Integration not found');
                e.status = 404;
                throw e;
            }
        } else {
            existing = await this._getRowByProject(siteId, org, project);
        }

        // Only re-encrypt when a new token is supplied; otherwise keep the old
        // cipher so editing org/project doesn't require re-pasting the token.
        let tokenCipher = existing?.token_cipher || null;
        let tokenHint = existing?.config?.tokenHint || null;
        const newToken = input.token && String(input.token).trim();
        if (newToken) {
            tokenCipher = encrypt(newToken);
            tokenHint = maskSecret(newToken);
        }
        if (!tokenCipher) {
            const e = new Error('A Sentry auth token is required to connect');
            e.status = 400;
            throw e;
        }

        // Preserve an existing webhook secret across edits; mint one on first connect
        // so the user can wire up Sentry's webhook for near-real-time updates.
        const webhookSecret = existing?.config?.webhookSecret || crypto.randomBytes(24).toString('hex');
        const config = { org, project, baseUrl, tokenHint, webhookSecret };
        const enabled = input.enabled !== undefined ? !!input.enabled : (existing?.enabled ?? true);

        if (existing) {
            const { rows } = await query(
                `UPDATE site_integrations
                 SET token_cipher = $1, config = $2, enabled = $3,
                     status = 'pending', last_error = NULL,
                     idle_polls = 0, next_poll_at = NULL, updated_at = NOW()
                 WHERE id = $4 RETURNING *`,
                [tokenCipher, JSON.stringify(config), enabled, existing.id],
            );
            return toPublic(rows[0]);
        }

        const id = `int_${uuidv4().slice(0, 12)}`;
        const { rows } = await query(
            `INSERT INTO site_integrations (id, site_id, provider, token_cipher, config, enabled, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
            [id, siteId, PROVIDER, tokenCipher, JSON.stringify(config), enabled],
        );
        return toPublic(rows[0]);
    },

    /**
     * Remove one Sentry integration by id (scoped to the site). Already-synced
     * issues remain. Returns { success } — 404 if it doesn't belong to the site.
     */
    async deleteIntegration(integrationId, siteId) {
        const res = await query(
            `DELETE FROM site_integrations WHERE id = $1 AND site_id = $2 AND provider = $3`,
            [integrationId, siteId, PROVIDER],
        );
        if ((res.rowCount || 0) === 0) {
            const e = new Error('Integration not found');
            e.status = 404;
            throw e;
        }
        return { success: true };
    },

    // ── Webhook (near-real-time push) ──────────────────────────────────────────

    /**
     * Verify a Sentry webhook HMAC signature against an integration's stored
     * secret. Sentry signs the raw body with HMAC-SHA256 in the
     * `sentry-hook-signature` header. Uses a constant-time compare.
     */
    _verifySignature(secret, rawBody, signature) {
        if (!secret || !signature) return false;
        const expected = crypto.createHmac('sha256', secret)
            .update(rawBody, 'utf8').digest('hex');
        const a = Buffer.from(expected);
        const b = Buffer.from(String(signature));
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    },

    /** Pull the project slug out of a Sentry webhook payload (several shapes). */
    _projectFromPayload(payload) {
        const issue = payload?.data?.issue || payload?.data?.event || {};
        return (
            issue.project?.slug || issue.project ||
            payload?.project?.slug || payload?.project ||
            payload?.data?.project_slug || null
        );
    },

    /**
     * Handle an incoming Sentry webhook. Finds the integration whose project
     * matches the payload, verifies the signature against its stored secret, and
     * upserts the issue. Returns { handled, siteId } or throws with a status.
     * The periodic poll remains the reconciling backstop (counts, stale, stats).
     */
    async handleWebhook(payload, rawBody, signature) {
        const projectSlug = this._projectFromPayload(payload);
        const issue = payload?.data?.issue;
        if (!projectSlug || !issue?.id) {
            const e = new Error('Unrecognized Sentry webhook payload');
            e.status = 400;
            throw e;
        }
        // Match candidate integrations by project slug (config JSONB).
        const { rows } = await query(
            `SELECT * FROM site_integrations
             WHERE provider = $1 AND enabled = TRUE AND config->>'project' = $2`,
            [PROVIDER, String(projectSlug)],
        );
        // Verify against each candidate's secret; the first match wins.
        const match = rows.find((r) =>
            this._verifySignature(r.config?.webhookSecret, rawBody, signature));
        if (!match) {
            const e = new Error('Webhook signature verification failed');
            e.status = 401;
            throw e;
        }
        await this._upsertIssue(this._normalize(match.site_id, projectSlug, issue));
        return { handled: true, siteId: match.site_id };
    },

    /**
     * Call Sentry's issues API for a single integration row.
     * Returns { issues } on success or throws with a user-safe message.
     */
    async _fetchIssues(row) {
        const token = decrypt(row.token_cipher);
        if (!token) {
            const e = new Error('Stored Sentry token could not be read (was the encryption key rotated?)');
            e.status = 400;
            throw e;
        }
        const { org, project, baseUrl } = row.config || {};
        const base = normalizeBaseUrl(baseUrl);
        let url = `${base}/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/?limit=${ISSUES_PER_POLL}&statsPeriod=14d&query=`;

        // Page through Sentry's cursor-paginated issues endpoint (Link header)
        // up to MAX_ISSUES so busy projects aren't silently truncated at 100.
        const all = [];
        let pages = 0;
        while (url && all.length < MAX_ISSUES && pages < MAX_PAGES) {
            const res = await this._fetchPage(url, token);
            const batch = await res.json();
            if (Array.isArray(batch)) all.push(...batch);
            url = nextCursorUrl(res.headers.get('link'));
            pages += 1;
        }
        return all.slice(0, MAX_ISSUES);
    },

    /** One HTTP GET to Sentry with timeout + status→safe-error mapping. */
    async _fetchPage(url, token) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), SENTRY_TIMEOUT_MS);
        let res;
        try {
            res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
                signal: controller.signal,
            });
        } catch (err) {
            const e = new Error(err.name === 'AbortError' ? 'Sentry request timed out' : 'Could not reach Sentry');
            e.status = 502;
            throw e;
        } finally {
            clearTimeout(timer);
        }

        if (res.status === 401 || res.status === 403) {
            const e = new Error('Sentry rejected the auth token (check token scopes)');
            e.status = 401;
            throw e;
        }
        if (res.status === 404) {
            const e = new Error('Sentry org or project not found');
            e.status = 404;
            throw e;
        }
        if (!res.ok) {
            const e = new Error(`Sentry API error (${res.status})`);
            e.status = 502;
            throw e;
        }
        return res;
    },

    /** Map a Sentry issue object to a sentry_issues row shape. */
    _normalize(siteId, projectSlug, issue) {
        const meta = issue.metadata || {};
        return {
            issue_id: `${siteId}:${issue.id}`,
            site_id: siteId,
            sentry_id: String(issue.id),
            short_id: issue.shortId || null,
            title: (issue.title || meta.value || meta.type || 'Unknown error').slice(0, 1000),
            culprit: (issue.culprit || '').slice(0, 500),
            level: (issue.level || 'error').slice(0, 16),
            status: (issue.status || 'unresolved').slice(0, 16),
            is_unhandled: !!(issue.isUnhandled ?? meta.isUnhandled ?? false),
            count: Number(issue.count) || 0,
            user_count: Number(issue.userCount) || 0,
            permalink: issue.permalink || null,
            project_slug: projectSlug || null,
            // Regression = Sentry re-opened a previously-resolved issue. Newer API
            // exposes substatus='regressed'; fall back to any truthy isRegression.
            is_regression: issue.substatus === 'regressed' || !!issue.isRegression,
            // Release the issue was last seen in (version string), if reported.
            last_release: (issue.lastRelease?.version || issue.lastRelease || null)
                ? String(issue.lastRelease?.version || issue.lastRelease).slice(0, 255)
                : null,
            first_seen: issue.firstSeen || null,
            last_seen: issue.lastSeen || null,
        };
    },

    /**
     * Upsert one normalized issue row by (issue_id). Returns true when the row
     * was inserted or its meaningful fields changed (used to drive adaptive
     * cadence — an all-no-op poll lets the project back off).
     */
    async _upsertIssue(r) {
        const before = await query(
            `SELECT count, status, is_regression, last_seen FROM sentry_issues WHERE issue_id = $1`,
            [r.issue_id],
        );
        await query(
            `INSERT INTO sentry_issues
               (issue_id, site_id, sentry_id, short_id, title, culprit, level, status,
                is_unhandled, count, user_count, permalink, project_slug,
                is_regression, last_release, first_seen, last_seen, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, NOW())
             ON CONFLICT (issue_id) DO UPDATE SET
               short_id = EXCLUDED.short_id, title = EXCLUDED.title,
               culprit = EXCLUDED.culprit, level = EXCLUDED.level,
               status = EXCLUDED.status, is_unhandled = EXCLUDED.is_unhandled,
               count = EXCLUDED.count, user_count = EXCLUDED.user_count,
               permalink = EXCLUDED.permalink, project_slug = EXCLUDED.project_slug,
               is_regression = EXCLUDED.is_regression, last_release = EXCLUDED.last_release,
               first_seen = EXCLUDED.first_seen, last_seen = EXCLUDED.last_seen,
               updated_at = NOW()`,
            [r.issue_id, r.site_id, r.sentry_id, r.short_id, r.title, r.culprit,
             r.level, r.status, r.is_unhandled, r.count, r.user_count, r.permalink,
             r.project_slug, r.is_regression, r.last_release, r.first_seen, r.last_seen],
        );
        const prev = before.rows[0];
        if (!prev) return true; // newly inserted
        // Compare last_seen as epoch millis so a PG Date vs an ISO string (which
        // may differ only in fractional-second formatting) doesn't read as a change.
        const ms = (v) => { const t = v ? new Date(v).getTime() : 0; return Number.isNaN(t) ? 0 : t; };
        return (
            Number(prev.count) !== r.count ||
            prev.status !== r.status ||
            !!prev.is_regression !== r.is_regression ||
            ms(prev.last_seen) !== ms(r.last_seen)
        );
    },

    /**
     * Reconcile which of a site's stored issues are still live. Issues Sentry
     * returned this cycle are marked fresh (stale=FALSE); issues we have on file
     * but Sentry no longer returns (resolved/deleted/aged out) are marked stale.
     * Soft-delete so the Errors page can filter them without losing history.
     * A poll that returns zero issues is treated as "nothing changed" (guards
     * against a transient empty response wiping the board). Returns true when any
     * row's stale flag flipped (feeds adaptive cadence).
     */
    async _reconcileStale(siteId, projectSlug, seenSentryIds) {
        if (!seenSentryIds.length) return false;
        // Scope reconciliation to THIS project so one project's poll never marks
        // another project's issues stale. Rows with a NULL/empty project_slug
        // (older single-project data) are reconciled by the primary project only
        // to preserve prior behavior.
        const res = await query(
            `UPDATE sentry_issues
             SET stale = (sentry_id <> ALL($3::text[])), updated_at = NOW()
             WHERE site_id = $1
               AND COALESCE(project_slug, '') = COALESCE($2, '')
               AND stale IS DISTINCT FROM (sentry_id <> ALL($3::text[]))`,
            [siteId, projectSlug || '', seenSentryIds],
        );
        return (res.rowCount || 0) > 0;
    },

    /**
     * Fetch daily event counts from Sentry's project stats API. Returns an array
     * of { date: 'YYYY-MM-DD', events } buckets (UTC). Sentry returns pairs of
     * [unixSeconds, count]; we roll the (hourly) buckets up per day.
     */
    async _fetchStats(row) {
        const token = decrypt(row.token_cipher);
        if (!token) return [];
        const { org, project, baseUrl } = row.config || {};
        const url = `${normalizeBaseUrl(baseUrl)}/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/stats/?stat=received&resolution=1d&statsPeriod=${encodeURIComponent(STATS_PERIOD)}`;
        const res = await this._fetchPage(url, token);
        const raw = await res.json();
        if (!Array.isArray(raw)) return [];
        const byDay = new Map();
        for (const pair of raw) {
            if (!Array.isArray(pair) || pair.length < 2) continue;
            const date = new Date(Number(pair[0]) * 1000).toISOString().slice(0, 10);
            byDay.set(date, (byDay.get(date) || 0) + (Number(pair[1]) || 0));
        }
        return [...byDay.entries()].map(([date, events]) => ({ date, events }));
    },

    /**
     * Upsert one day's stat row per project (stat_id = "{site}:{project}:{date}")
     * so multiple projects on a site each keep their own daily counts (the trend
     * read SUMs them). projectSlug '' is tolerated for older single-project data.
     */
    async _upsertStat(siteId, projectSlug, { date, events }) {
        const proj = projectSlug || '';
        await query(
            `INSERT INTO sentry_stats (stat_id, site_id, project_slug, date, events, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (stat_id) DO UPDATE SET
               events = EXCLUDED.events, project_slug = EXCLUDED.project_slug, updated_at = NOW()`,
            [`${siteId}:${proj}:${date}`, siteId, proj || null, date, events],
        );
    },

    /**
     * Poll one integration row: fetch issues, upsert them, update status.
     * Returns the number of issues upserted. Never throws — records last_error.
     */
    async pollIntegration(row) {
        try {
            const issues = await this._fetchIssues(row);
            const projectSlug = row.config?.project || null;
            const seen = [];
            let changed = 0;
            for (const issue of issues) {
                const wrote = await this._upsertIssue(this._normalize(row.site_id, projectSlug, issue));
                if (wrote) changed += 1;
                seen.push(String(issue.id));
            }
            const staleChanged = await this._reconcileStale(row.site_id, projectSlug, seen);
            // Trend stats are best-effort: a stats API failure must not fail the
            // whole poll (issues already upserted above are the primary payload).
            try {
                const stats = await this._fetchStats(row);
                for (const s of stats) await this._upsertStat(row.site_id, projectSlug, s);
            } catch { /* non-fatal — trend chart just won't refresh this cycle */ }

            // Adaptive cadence: reset backoff when something changed, else step it
            // up one level per consecutive idle poll (capped at CADENCE_MAX_S).
            const activity = changed > 0 || staleChanged;
            const idle = activity ? 0 : Math.min((row.idle_polls || 0) + 1, 12);
            const nextS = activity ? CADENCE_BASE_S : Math.min(CADENCE_BASE_S * (idle + 1), CADENCE_MAX_S);
            await query(
                `UPDATE site_integrations
                 SET status = 'ok', last_error = NULL, last_synced_at = NOW(),
                     idle_polls = $2, next_poll_at = NOW() + ($3 || ' seconds')::interval,
                     updated_at = NOW()
                 WHERE id = $1`,
                [row.id, idle, String(nextS)],
            );
            return issues.length;
        } catch (err) {
            // Auth/target errors back off hard until the user re-tests; transient
            // errors retry at the base cadence.
            const nextS = isAuthError(err) ? CADENCE_AUTH_FAIL_S : CADENCE_BASE_S;
            await query(
                `UPDATE site_integrations
                 SET status = 'error', last_error = $2,
                     next_poll_at = NOW() + ($3 || ' seconds')::interval, updated_at = NOW()
                 WHERE id = $1`,
                [row.id, String(err.message || 'poll failed').slice(0, 500), String(nextS)],
            );
            return 0;
        }
    },

    /**
     * Verify one integration's credentials by making a live call. Keyed by
     * integration id (scoped to the site). Throws with a safe message on failure.
     */
    async testIntegration(integrationId, siteId) {
        const row = await this._getRowById(integrationId, siteId);
        if (!row || !row.token_cipher) {
            const e = new Error('Integration not found');
            e.status = 404;
            throw e;
        }
        const issues = await this._fetchIssues(row);
        // A successful test clears any backoff/auth-fail state so the next poll
        // cycle picks the integration up immediately.
        await query(
            `UPDATE site_integrations
             SET status = 'ok', last_error = NULL, idle_polls = 0,
                 next_poll_at = NULL, updated_at = NOW()
             WHERE id = $1`,
            [row.id],
        );
        return { ok: true, sampleCount: issues.length };
    },

    /**
     * Fetch the latest event for one issue live from Sentry (never stored) and
     * return a trimmed, UI-friendly shape: exception frames, breadcrumbs, tags,
     * request/user context. Used by the Errors page drill-down. Throws with a
     * safe message on failure.
     */
    async getLatestEvent(siteId, sentryId) {
        // Confirm the issue belongs to this site before calling Sentry (defence
        // in depth — the route is already site-scoped/authorized). Capture its
        // project so we can pick the integration that owns that project's token.
        const owned = await query(
            `SELECT project_slug FROM sentry_issues WHERE site_id = $1 AND sentry_id = $2 LIMIT 1`,
            [siteId, String(sentryId)],
        );
        if (owned.rows.length === 0) {
            const e = new Error('Issue not found for this site');
            e.status = 404;
            throw e;
        }
        const projectSlug = owned.rows[0].project_slug;
        // Prefer the integration whose project matches the issue; fall back to
        // the site's primary integration (older issues may predate project_slug).
        let row = null;
        if (projectSlug) {
            const m = await query(
                `SELECT * FROM site_integrations
                 WHERE site_id = $1 AND provider = $2 AND config->>'project' = $3
                 ORDER BY created_at ASC LIMIT 1`,
                [siteId, PROVIDER, projectSlug],
            );
            row = m.rows[0] || null;
        }
        if (!row) row = await this._getRow(siteId);
        if (!row || !row.token_cipher) {
            const e = new Error('No Sentry integration is connected for this site');
            e.status = 404;
            throw e;
        }
        const token = decrypt(row.token_cipher);
        if (!token) {
            const e = new Error('Stored Sentry token could not be read');
            e.status = 400;
            throw e;
        }
        const url = `${normalizeBaseUrl(row.config?.baseUrl)}/api/0/issues/${encodeURIComponent(sentryId)}/events/latest/`;
        const res = await this._fetchPage(url, token);
        const ev = await res.json();
        return this._normalizeEvent(ev);
    },

    /** Trim a raw Sentry event to the fields the drill-down panel needs. */
    _normalizeEvent(ev) {
        if (!ev || typeof ev !== 'object') return null;
        const entries = Array.isArray(ev.entries) ? ev.entries : [];
        const byType = (t) => entries.find((e) => e.type === t)?.data;

        // Exception frames: newest exception's stack frames (most relevant last).
        const exc = byType('exception');
        const excValues = exc?.values || [];
        const frames = [];
        for (const v of excValues) {
            for (const f of v.stacktrace?.frames || []) {
                frames.push({
                    filename: f.filename || f.absPath || '',
                    function: f.function || '',
                    lineNo: f.lineNo ?? null,
                    inApp: !!f.inApp,
                });
            }
        }

        const crumbs = byType('breadcrumbs');
        const breadcrumbs = (crumbs?.values || []).slice(-20).map((b) => ({
            timestamp: b.timestamp || null,
            category: b.category || '',
            level: b.level || '',
            message: (b.message || '').slice(0, 300),
        }));

        return {
            eventId: ev.eventID || ev.id || null,
            message: ev.message || ev.title || '',
            dateCreated: ev.dateCreated || null,
            platform: ev.platform || null,
            tags: Array.isArray(ev.tags)
                ? ev.tags.map((t) => ({ key: t.key, value: t.value })).slice(0, 30)
                : [],
            exceptionType: excValues[0]?.type || null,
            exceptionValue: excValues[0]?.value || null,
            frames: frames.slice(0, 100),
            breadcrumbs,
        };
    },

    /**
     * Poll every enabled Sentry integration across all sites. Driven by the
     * background loop in index.js. Returns total issues upserted. Integrations
     * are polled with bounded concurrency so one slow/hung project can't stall
     * the rest, and a re-entrancy guard prevents overlapping runs from a slow
     * poll spilling past its interval (mirrors sync.js's _syncRunning).
     */
    async pollAllSentry({ silent = true } = {}) {
        if (this._pollRunning) {
            if (!silent) console.log('⏳ Sentry poll already in progress — skipping');
            return 0;
        }
        this._pollRunning = true;
        try {
            // Only poll integrations that are due (adaptive cadence): unset
            // next_poll_at (never polled / just edited) or a time in the past.
            const { rows } = await query(
                `SELECT * FROM site_integrations
                 WHERE provider = $1 AND enabled = TRUE
                   AND (next_poll_at IS NULL OR next_poll_at <= NOW())`,
                [PROVIDER],
            );
            let total = 0;
            // Simple bounded worker pool: POLL_CONCURRENCY integrations in flight.
            let cursor = 0;
            const worker = async () => {
                while (cursor < rows.length) {
                    const row = rows[cursor++];
                    total += await this.pollIntegration(row);
                }
            };
            await Promise.all(
                Array.from({ length: Math.min(POLL_CONCURRENCY, rows.length) }, worker),
            );
            if (!silent && rows.length) {
                console.log(`  ✓ Sentry poll: ${total} issue(s) across ${rows.length} integration(s)`);
            }
            return total;
        } finally {
            this._pollRunning = false;
        }
    },

    _pollRunning: false,
};

export default sentryService;
