# Technical Privacy Audit

A code-level inventory of what InsightTrack collects, transmits, and stores.

This is a **technical** audit, not a legal assessment. It describes observable
implementation behaviour and deliberately avoids compliance conclusions —
whether any deployment satisfies a given regulation depends on how it is
configured, what a site operator instruments, and jurisdiction.

**Method.** Every finding was read from source. The tracking script is generated
by `apps/analytics-api/src/services/sitesService.js`; storage schemas are in
`apps/analytics-api/src/db/postgres.js`; ingest handling is in
`src/services/trackingService.js` and `src/routes/tracking.js`. Script size was
measured against a running instance.

**Scope.** Default behaviour of the shipped tracking script and API. Site
operators can send arbitrary data through the custom-event API, which no audit of
this repository can bound — see [Custom events](#custom-events).

---

## Summary

| | Finding |
|---|---|
| Cookies | **None.** No `document.cookie` access anywhere in the script; no `Set-Cookie` from ingest. |
| Fingerprinting | **None.** No canvas, WebGL, audio, font enumeration, `hardwareConcurrency`, or `deviceMemory` access. |
| IP addresses | **Not stored.** Used transiently for geo lookup; no IP column exists in any table. |
| Raw User-Agent | **Not stored.** Parsed client-side into device/browser/OS; the string is never transmitted. |
| Identifiers | Two random client-generated pseudonymous IDs in `localStorage` / `sessionStorage`. |
| Third-party calls from the script | **None.** It contacts only its configured `serverUrl`. |

The items most worth attention were the **unbounded visitor-ID lifetime**, the
**capture of clicked element text and input values** by heatmap tracking, **full
URLs including query strings**, and **retention having no scheduler** — detailed
below. All four have since been addressed; see
[Status: findings addressed](#status-findings-addressed). The findings are kept
in their original form as the record of what was found.

---

## Data inventory

### Visitor ID

| | |
|---|---|
| **Purpose** | Distinguish returning from new visitors |
| **Collected?** | Yes — generated client-side |
| **Stored?** | Yes |
| **Where?** | `localStorage._analytics_uid`; `events.user_id`, `sessions.user_id` (VARCHAR 64) |
| **Retention** | **Browser: indefinite** — no expiry is set. Server: until a retention policy deletes it (off by default). |
| **Concern** | Generated as `'u_' + Math.random().toString(36).substr(2, 9)` (`sitesService.js:121`) — not a UUID, and `Math.random()` is not cryptographically random. More significantly, **it never expires**, so a visitor is linkable across sessions indefinitely until they clear site data. It is also client-controlled: any caller can send an arbitrary `user_id`. |

### Session ID

| | |
|---|---|
| **Purpose** | Group events within one visit |
| **Collected?** | Yes |
| **Stored?** | Yes |
| **Where?** | `sessionStorage._analytics_sid`; `events.session_id`, `sessions.id` |
| **Retention** | Browser: cleared when the tab closes. Server: same as visitor ID. |
| **Concern** | Low. Same `Math.random()` construction, but the short lifetime limits linkage. A server-side `uuidv4()` is substituted when absent (`trackingService.js`). |

### `window.analytics.identify()` — operator-supplied ID

| | |
|---|---|
| **Purpose** | Let a site operator replace the random ID with their own |
| **Collected?** | Only if the operator calls it |
| **Stored?** | Yes — overwrites `_analytics_uid` and flows to `events.user_id` |
| **Where?** | `sitesService.js:594` |
| **Retention** | Same as visitor ID |
| **Concern** | **Highest-impact item in this audit.** `identify: function(uid) { localStorage.setItem('_analytics_uid', uid); }` performs no validation. An operator can pass an email address, account ID, or any direct identifier, at which point every stored event becomes directly identifying and the "pseudonymous" property no longer holds. This is a documented feature, but nothing in the code or the UI warns about it. |

### IP address

| | |
|---|---|
| **Purpose** | Server-side country/city lookup |
| **Collected?** | Yes — unavoidably, as request metadata |
| **Stored?** | **No** |
| **Where?** | In memory only. `geoipService.getLocationFromRequest()` reads `X-Forwarded-For`, `X-Real-IP`, or `req.ip`, passes it to `geoip-lite`, and returns only country/city/region/lat/lon. No table has an IP column (verified against `postgres.js` and `schema.js`). |
| **Retention** | Not retained by the application |
| **Concern** | Two residual paths. (1) On lookup failure, `geoipService.js:77` logs `GeoIP lookup failed for IP ${ip}` — the IP reaches **application logs**, which are outside the retention system. (2) A reverse proxy in front of the API will typically log IPs independently. The "no IP storage" claim is accurate for the database, not necessarily for the whole deployment. |

### Geographic information

| | |
|---|---|
| **Purpose** | Country/city breakdowns |
| **Collected?** | Yes, from two independent sources |
| **Stored?** | Yes |
| **Where?** | `events.country` (VARCHAR 100), `events.city` (VARCHAR 255), `sessions.country` |
| **Retention** | Until retention deletion |
| **Concern** | The script guesses country from the IANA timezone and browser locale (`sitesService.js:166`, `305`); the server fills gaps via IP lookup, but **only where the client did not supply a value** (`enrichGeo`). City is stored when the IP lookup resolves one, which is finer-grained than the "country-level analytics" framing elsewhere in the docs. Latitude/longitude are computed by `geoipService` but not persisted to `events`. |

### Device, browser, OS

| | |
|---|---|
| **Purpose** | Device-type breakdowns |
| **Collected?** | Yes — derived client-side |
| **Stored?** | Yes, as coarse labels |
| **Where?** | `events.device` / `browser` / `os`; same on `sessions` |
| **Retention** | Until retention deletion |
| **Concern** | Low, and better than the alternative. The **raw User-Agent string is never transmitted or stored** — the script reduces it to one of three device types, ~6 browser names, and ~6 OS names (`sitesService.js:137-160`). These coarse buckets carry far less entropy than a full UA string. |

### URLs

| | |
|---|---|
| **Purpose** | Page-level analytics |
| **Collected?** | Yes |
| **Stored?** | Yes |
| **Where?** | `events.url` (TEXT, truncated at 2048), `events.path` (VARCHAR 512) |
| **Retention** | Until retention deletion |
| **Concern** | **`url` is `window.location.href` — the full URL including the query string, stored verbatim with no sanitisation.** No parameter stripping or allowlisting exists anywhere in the path from script to database. If a site places sensitive values in URLs — password-reset tokens, session tokens, invitation links, prefilled email addresses, order identifiers — those are captured and stored. `path` is the safer field, and most dashboard queries use it, but `url` retains everything. |

### Query parameters

| | |
|---|---|
| **Purpose** | UTM attribution; site-search analysis |
| **Collected?** | Yes, in three distinct ways |
| **Stored?** | Yes |
| **Where?** | Dedicated `utm_*` columns; `properties` JSONB; and inside `events.url` |
| **Retention** | Until retention deletion |
| **Concern** | Beyond the full-URL issue above, **site-search capture records the visitor's actual search terms**: `detectSiteSearch()` scans for nine parameter names (`q`, `query`, `search`, `s`, `keyword`, `keywords`, `term`, `text`, `find`) and stores the value verbatim in `properties.query` (`sitesService.js:545-565`). Site-search strings are free text typed by visitors and can contain anything, including personal information. |

### Referrer

| | |
|---|---|
| **Purpose** | Traffic-source attribution |
| **Collected?** | Yes — `document.referrer` |
| **Stored?** | Yes |
| **Where?** | `events.referrer` (TEXT, truncated at 2048), `sessions.referrer` |
| **Retention** | Until retention deletion |
| **Concern** | Stored as the full referrer URL including its query string, with no stripping. A referrer from a search engine or an authenticated third-party page can itself carry parameters. |

### Timestamps

| | |
|---|---|
| **Purpose** | Time-series analytics |
| **Collected?** | Yes — **server-side** |
| **Stored?** | Yes |
| **Where?** | `events.timestamp` (TIMESTAMPTZ), `sessions.started_at` / `ended_at` / `duration` |
| **Retention** | Until retention deletion |
| **Concern** | Full-precision timestamps, not bucketed. Combined with a never-expiring visitor ID, this supports detailed per-visitor activity timelines. Note the server stamps arrival time (`new Date().toISOString()`), ignoring any client value — so a queued beacon is misattributed in time, though this is an accuracy issue rather than a privacy one. |

### Custom events

| | |
|---|---|
| **Purpose** | Operator-defined instrumentation |
| **Collected?** | Only what the operator sends |
| **Stored?** | Yes |
| **Where?** | `events.properties` (JSONB, unbounded shape) |
| **Retention** | Until retention deletion |
| **Concern** | **Unbounded by design and the largest uncertainty in this audit.** `properties` is free-form JSONB. `type` is checked against a 20-value allowlist and coerced to `'custom'` otherwise, but the payload is never validated, filtered, or size-capped beyond `JSON.stringify`. Whether a deployment holds personal data depends entirely on what its operator instruments — this repository cannot bound it. |

### Automatically captured interaction events

These fire without any operator instrumentation:

| Event | Captured | Concern |
|---|---|---|
| `js_error` | Error message (200 chars), source file, line, column (`sitesService.js:517-530`) | **Error messages can embed arbitrary application data** — a failed request's URL, a serialised object, a token. Truncation limits volume, not sensitivity. |
| `rage_click` | CSS selector (`tag#id.class`), click count | Low — selectors only, no text or coordinates. |
| `heatmap_click` | Selector, **element text or input value (100 chars)**, tag, absolute `x`/`y`, relative `relX`/`relY`, link `href`, `data-track` (`sitesService.js:398-420`) | **Second-highest concern in this audit.** `var text = (el.innerText \|\| el.value \|\| el.getAttribute('aria-label') \|\| '')` reads **`el.value`**, so clicking a populated input transmits **what the visitor typed into it** — a search box, an email field, a form entry. Combined with absolute coordinates and viewport-relative position, this is the most granular interaction data the script produces. |
| `scroll_depth` | 25/50/75/100% milestones | Low. |
| `web_vital` | CLS/INP/LCP values | Low — performance metrics only. |
| `site_search` | **Verbatim search query** | See [Query parameters](#query-parameters). |
| `time_on_page` | Seconds on page | Low. |

### Data explicitly **not** collected

Verified absent from the script and the schema:

- Cookies of any kind
- Canvas, WebGL, audio, or font fingerprinting
- Screen resolution (`screen.width` / `screen.height` are never read)
- `navigator.plugins`, `hardwareConcurrency`, `deviceMemory`
- Raw User-Agent strings
- Keystroke-level capture (no `keydown` / `keypress` listeners)
- Session replay

**Two qualifications to the above:**

- **Viewport dimensions** (`window.innerWidth` / `innerHeight`) *are* read, to
  normalise click coordinates and compute scroll depth. The dimensions
  themselves are not transmitted, but the derived `relX`/`relY` percentages are.
- **Form input values are not captured by keystroke listeners, but can still be
  transmitted** via `heatmap_click`'s `el.value` read — see the interaction
  events table above.
- Cross-site or cross-domain tracking
- Any request to a third party from the tracking script

---

## Opt-out behaviour

Do Not Track and Global Privacy Control are honoured at two independent layers:

- **Client:** the script checks `navigator.doNotTrack === '1'` and
  `navigator.globalPrivacyControl === true` **before touching storage or the
  network**, installs an inert `window.analytics` stub, and returns. No
  identifier is created for an opted-out visitor.
- **Server:** `honourOptOut` rejects `DNT: 1` / `Sec-GPC: 1` on all six POST
  ingest routes, returning a normal-looking success shape so a stale cached
  script behaves as if it succeeded. `GET /pixel.gif` honours the same signal
  while still returning a valid GIF.

**Gap:** if `navigator` is unavailable the script falls through to normal
tracking rather than failing closed. This is a deliberate, commented choice — a
non-browser host has no opt-out signal — but it is a fail-open default.

---

## Retention behaviour

Configured per site in `data_retention_policies`.

**Three properties materially affect how long data persists:**

1. **Disabled by default.** `enabled BOOLEAN DEFAULT FALSE` (`postgres.js:270`).
   Unless an operator explicitly turns it on, **nothing is ever deleted**.
2. **Default window is 365 days** when enabled (`retention_days INTEGER DEFAULT 365`).
3. **No scheduler existed** *(since fixed)*. `runRetentionCleanup` was reachable
   only via `POST /api/reporting/:siteId/retention/cleanup`, and nothing called
   it on a timer — so an operator who enabled a policy but never called the
   endpoint still retained data forever. A scheduler now sweeps every site with
   an enabled policy every `RETENTION_INTERVAL_MS` (default 6h).

   Point 1 still stands: retention remains **off by default**, so a deployment
   that never configures a policy still retains data indefinitely. That is a
   deployment decision, not a defect.

When it does run, deletion is consistent across both stores: rows are removed
from PostgreSQL, then mirrored into DuckDB via `applyRetentionDeletionToDuck`,
with the DuckDB step running only after the PostgreSQL deletes succeed.

**Not covered by retention:** application logs (including the GeoIP failure log
containing an IP), reverse-proxy logs, and database backups.

---

## Claims that cannot be directly verified

Listed for accuracy, not as accusations. Several are correct in a narrow sense
but stated more broadly than the code supports.

| Claim | Location | Status |
|---|---|---|
| "No cookies" | `README.md:9,14,30`, Privacy page, blog | **Verified.** No cookie API use anywhere. |
| "No fingerprinting" | `README.md:30`, Privacy page | **Verified** for the standard techniques enumerated above. |
| "No stored IP addresses" | `README.md:30`, `features.md:415,669` | **Verified for the database.** Not verifiable for a deployment as a whole: an IP is written to application logs on GeoIP failure, and proxy logs are outside this codebase. |
| "Pseudonymous visitor IDs" | `README.md:30` | **Conditionally true.** Holds by default; `identify()` lets an operator substitute a direct identifier with no warning or validation. |
| "No third-party data sharing" | Privacy page (`Privacy.jsx:180`) | **True of the tracking script.** Not unconditional: Pulse transmits analytics data to Anthropic/OpenAI/Google when an API key is configured, and the Sentry integration calls Sentry. Both are opt-in and off by default, but the claim is stated absolutely. |
| "GDPR-friendly by design" | `README.md:30`, blog | **Not technically verifiable.** The README's qualifier ("compliance depends on your deployment") is appropriate; the blog's "GDPR compliance without legal gymnastics" is stronger than the code can support. |
| "GDPR compliance summary", "GDPR (Europe), CCPA (California) and PECR (UK)" | `Privacy.jsx:187,194` | **Outside technical scope.** These present regulatory conclusions in the product UI. |
| "Country detected from timezone, not IP address" | `features.md:666` | **Incomplete.** Timezone is the primary source, but the server falls back to IP-based lookup via `enrichGeo` whenever the client sends no country — and that path can also yield **city**. |
| "IP addresses are used transiently for country lookup" | `features.md:415` | **Accurate but understated** — the same lookup also resolves city, which is stored. |
| "GeoIP … captures visitor location (country and city) based on their IP" | `geoip-tracking.md:5` | **Verified**, and notably more precise than the summary claims elsewhere. |
| "~2 KB script" | *(removed)* | Previously flagged; no longer present. **Measured actual: 26.4 KB raw, 7.6 KB gzipped.** |

**Internal inconsistency worth noting:** `features.md:666` says country comes
from timezone "not IP address", while `geoip-tracking.md:5` documents IP-based
country *and city* capture. Both describe real code paths; neither alone
describes the whole behaviour.

---

## Status: findings addressed

The audit above records the state at the time of review. The following changes
have since been made; the "Concern" entries above are retained as the record of
what was found.

| Finding | Change | Cover |
|---|---|---|
| Heatmap captured input values | The click handler no longer reads a form control's entered value. Inputs/textareas/selects now use the accessible label or field `name` — both authored by the site, not typed by the visitor. Other elements still use their text. | `trackingScriptPrivacy.test.js` |
| Visitor ID never expired | IDs now carry a sliding expiry (`VISITOR_ID_TTL_DAYS`, default 180). The window refreshes on each visit, so regular visitors are not re-counted; it elapses only after that long without one. Pre-existing bare-string IDs are adopted rather than reset, and `crypto.randomUUID` is used where available. `0` disables rotation. | `trackingScriptPrivacy.test.js` |
| Full URLs/referrers stored verbatim | Sensitive query parameters (token, password, secret, api_key, session, otp, code, email, signature, …) are redacted at the ingest boundary, and fragments are dropped. UTM and ordinary parameters are preserved. Applied server-side, so sites serving an older cached script are covered too. | `urlPrivacy.test.js`, `trackingUrlSanitisation.test.js` |
| Retention had no scheduler | `runAllRetentionCleanups()` sweeps every site with an enabled policy on a timer (`RETENTION_INTERVAL_MS`, default 6h). Sites without a policy are untouched; one site failing does not stop the others. | `retentionCleanup.test.js` |
| `identify()` gave no warning | Documented inline that passing a direct identifier makes events attributable to a named person, with a recommendation to use an opaque internal ID. Empty input is now ignored. | `trackingScriptPrivacy.test.js` |

Each fix was verified to fail without the change: restoring the input-value read
fails 2 tests, neutralising the sanitiser fails 20, and unwiring it from the
ingest path fails 5 more. 443 API tests pass in both `apps/` and `appsv2/`.

**Deliberately unchanged:**

- **Site-search capture** still records the visitor's query verbatim. Unlike the
  heatmap case, this is the feature's entire purpose rather than incidental
  collection — removing it would delete working functionality. It remains a real
  consideration for any site whose search box receives personal data.
- **JS error messages** are still captured (200 chars). They are the point of
  error tracking; the truncation limits volume but not sensitivity.
- **IPs in application logs** on GeoIP failure. Changing log output was outside
  the scope of these fixes.
- **Parameter redaction is a denylist, not an allowlist.** It closes the common
  accidental leak. It is not a guarantee that no secret can reach storage — a
  site using an unusual parameter name is not covered.

---

## Observations

Ordered by how much they affect what is stored about a visitor. These are
observations from this audit, not changes — no code was modified.

1. **The visitor ID never expires.** Nothing bounds `_analytics_uid`'s lifetime,
   making a visitor linkable indefinitely. A rotation window would materially
   change the profile of what the system retains.
2. **Heatmap clicks capture element text and input values.** `el.value` means a
   click on a populated field can transmit what the visitor typed. This is the
   one automatic behaviour most likely to collect personal data without the
   operator realising it.
3. **Full URLs and referrers are stored unsanitised.** Any secret a site places
   in a query string is captured verbatim. Parameter stripping or an allowlist
   would bound this; `path` already exists as the safer field.
4. **Retention is off by default, and has no scheduler even when on.** The
   combination means the realistic default is indefinite retention.
5. **`identify()` silently converts pseudonymous data to identified data.** No
   validation, no warning in code or UI.
6. **Site-search terms and JS error messages are free text** that can carry
   personal data by accident.
7. **IPs reach application logs** on GeoIP failure, outside the retention system.
8. **Several claims are stated absolutely where the code supports them only
   conditionally** — see the table above.

## Related documentation

- [`DATA_FLOW.md`](DATA_FLOW.md) — full event lifecycle
- [`SECURITY_PRIVACY_CLAIMS_AUDIT.md`](SECURITY_PRIVACY_CLAIMS_AUDIT.md) — earlier claims audit
- [`../SECURITY.md`](../SECURITY.md) — vulnerability reporting and stated limitations
