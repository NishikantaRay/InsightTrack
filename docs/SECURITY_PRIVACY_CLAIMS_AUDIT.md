# Security & Privacy Claims Audit

**Audit date:** 2026-08-28
**Repository:** `InsightTrack` (public-facing)
**Scope:** documentation, README, in-product marketing copy, and user-facing UI text — **claims only**
**Type:** Audit. No application behaviour, documentation wording, or marketing copy was changed.

---

## 1. Scope

### In scope

Every user-facing assertion about privacy, security, GDPR, DNT/GPC, IP handling, cookies, fingerprinting, retention, deletion, encryption, authentication, authorization, tenant isolation, SQL read-only guarantees, filesystem isolation, data ownership, and anonymity, appearing in:

- `README.md`
- `docs/*.md` (37 files)
- `apps/dashboard-web/src/pages/*.jsx` — Landing, Privacy, PrivacyPolicy, Documentation, Settings, SqlEditor
- `apps/dashboard-web/src/data/blogPosts.js` — published blog content
- `marketing/landing-page/`

### Out of scope

- Performance claims (covered by `REPOSITORY_AUDIT.md` §14)
- The SQL Editor's internal boundary (covered by `SQL_EDITOR_SECURITY.md`)
- Any remediation — this document recommends, it does not change
- `appsv2/` and the private working repo, except where a claim is duplicated there

### Note on a referenced document

The task brief asked that `docs/SQL_SECURITY_AUDIT.md` be read first. **That file does not exist** — it was deleted at the user's request in an earlier session and was never committed, so it is not recoverable from git. Its findings survive in `docs/SQL_EDITOR_SECURITY.md` and in the test suite, both of which were used instead. This audit does not depend on it.

---

## 2. Methodology

1. **Keyword sweep** across all in-scope surfaces for privacy/security vocabulary and absolute-claim phrasing (`GDPR`, `anonymous`, `never leaves`, `no tracking`, `read-only`, `fully`, `100%`, …), yielding 169 raw hits for triage.
2. **Claim extraction** — hits collapsed into distinct assertions; identical claims repeated across files are recorded once, with every location listed.
3. **Independent code tracing** for each claim. Documentation was never used as evidence for implementation behaviour. Where a claim was measurable, it was **measured** (script size, tool counts) rather than estimated.
4. **Classification** as VERIFIED / PARTIALLY VERIFIED / UNVERIFIED / FALSE-OUTDATED, with the tracing evidence recorded.
5. **Severity** assigned P0 / P1 / P2.

**Claims audited: 24.**

### Severity definitions

| Level | Meaning |
|---|---|
| **P0** | Materially misleading or security-critical. A user could make a compliance or security decision that is wrong. |
| **P1** | Significant privacy/security overclaim. True in spirit, materially overstated. |
| **P2** | Wording, precision, or staleness issue. Not misleading about a security property. |

---

## 3. Summary

| Classification | Count |
|---|---|
| VERIFIED | 8 |
| PARTIALLY VERIFIED | 7 |
| UNVERIFIED | 3 |
| FALSE / OUTDATED | 6 |
| **Total** | **24** |

| Severity | Count |
|---|---|
| **P0** | 3 |
| **P1** | 6 |
| **P2** | 6 |
| (no severity — VERIFIED) | 9 |

**Headline finding.** Two claim families are asserted **23 times across 10 files** and are contradicted by the implementation: DNT/GPC support, and automated retention deletion. Both are privacy-control claims a self-hoster could reasonably rely on for a compliance decision. They are the audit's only P0 items alongside the "GDPR-compliant" assertion that partly rests on them.

---

## 4. Verified claims

Claims where the implementation supports the exact wording.

### V-01 — "No cookies" · VERIFIED

**Files:** `README.md:13,30`; `docs/features.md:414,658`; `docs/security.md:35`; `Privacy.jsx:120-121,180`; `Landing.jsx:1148,1613`; `blogPosts.js:27,40`
**Evidence:** `grep -c "document.cookie"` against the tracking-script generator in `apps/analytics-api/src/services/sitesService.js` returns **0**. The script uses `localStorage` (`_analytics_uid`) and `sessionStorage` (`_analytics_sid`) only. No `Set-Cookie` is issued on the tracking path.
**Note:** the *legal* inference sometimes drawn from this ("no consent banner needed") is classified separately — see PV-03.

### V-02 — "No IP addresses are stored" · VERIFIED

**Files:** `docs/security.md:36`; `docs/features.md:415`; `Privacy.jsx:180`; `Landing.jsx:389,1148`; `Settings.jsx:180`
**Evidence:** No IP column exists in `src/schema/schema.js` (DuckDB) or in `initializeDatabase()` (PostgreSQL DDL) — `events` and `sessions` have no IP field. `geoipService.getClientIp()` reads `X-Forwarded-For` / `X-Real-IP` / `req.ip` in memory, passes it to `geoip.lookup()`, and returns only `{country, city, region, latitude, longitude}`; the address is never persisted.
**Precision note:** the IP *is* processed transiently server-side. "No IP storage" is accurate; "we never see your IP" would not be. No surface currently makes the stronger claim.

### V-03 — "No fingerprinting" · VERIFIED

**Files:** `README.md:30`; `Privacy.jsx:180`; `Landing.jsx:389`; `PrivacyPolicy.jsx:16`
**Evidence:** The generated script derives only User-Agent-based device/browser/OS strings, IANA timezone, and `navigator.language`. No canvas, WebGL, audio, font-enumeration, or hardware-entropy fingerprinting appears anywhere in the generator.

### V-04 — "Self-hosted / you own the database" · VERIFIED

**Files:** `docs/features.md:416,660`; `docs/security.md:39`; `docs/tracking-script.md:75`; `Privacy.jsx:137`
**Evidence:** `docker-compose.yml` provisions PostgreSQL, the API, and the dashboard locally; DuckDB is an embedded file under `apps/analytics-api/duckdb/`. No hosted control plane, licence check, or phone-home exists in the codebase.

### V-05 — "Passwords hashed with bcrypt" · VERIFIED

**File:** `docs/security.md:9`
**Evidence:** `authService.register` → `bcrypt.hash(password, 12)`; `login` → `bcrypt.compare`. Cost factor 12 is above the common baseline of 10.

### V-06 — "BYO AI keys stored encrypted at rest (AES-256-GCM)" · VERIFIED

**Files:** `README.md:146`; `docs/ai-analyst.md:52`
**Evidence:** `src/utils/secretBox.js` uses `crypto.createCipheriv('aes-256-gcm', …)` with a random 12-byte IV per secret and an auth tag; `assistant.js:456` stores `encrypt(key)` into `assistant_settings.key_cipher` and only a masked `key_hint` is ever returned to the client.
**Caveat recorded, not a defect:** the derivation key falls back to `JWT_SECRET` when `ENCRYPTION_KEY` is unset, so rotating `JWT_SECRET` silently invalidates stored keys. This is documented in-code and does not contradict the claim.

### V-07 — "SQL Editor enforces read-only at the server, not just the UI" · VERIFIED

**File:** `docs/sql-editor.md:303`
**Evidence:** `SqlEditor.jsx` contains no validation; enforcement is `validateQuery()` in `src/routes/sqlGuard.js`, called from four points in `sqlEditor.js`. Verified by 98 automated tests plus 52 manual read-only vectors (see `SQL_EDITOR_SECURITY.md` §6).
**Related:** the same file's *description* of the mechanism is now stale — see FO-05.

### V-08 — "Pulse/MCP tools are read-only" · VERIFIED

**Files:** `README.md:144,313,314`
**Evidence:** All tools in `src/mcp/tools/registry.js` call analytics query functions only; there is no write, no raw-SQL tool, and every site-scoped call is gated by `getMemberRole()` before execution. Confirmed during the Task 3 alternate-path review.
**Related:** the tool *count* in the same sentence is wrong — see FO-06.

---

## 5. Partially verified claims

Broadly true, with a limitation material enough that the current wording overstates it.

### PV-01 — "Anonymous visitor IDs" · PARTIALLY VERIFIED · **P1**

**Files:** `README.md:30`; `docs/features.md:42,90,414,658`; `Landing.jsx:389,518`; `PrivacyPolicy.jsx:16`
**Current claim:** visitor IDs are "anonymous".
**Evidence:** `getUserId()` generates `'u_' + Math.random().toString(36).substr(2,9)` and persists it in `localStorage` **indefinitely**, across sessions and tabs, until the visitor clears site data.
**Why partial:**
- A persistent unique identifier tied to a device is generally treated as **personal data** under GDPR even without a name attached (Recital 30; Article 29 WP guidance on device identifiers). The correct term is **pseudonymous**, not anonymous.
- `Math.random()` is not a CSPRNG. Collision risk at realistic scale is low, but the value should not be described as cryptographically random. `crypto.randomUUID()` is available in all target browsers.
- `docs/features.md:90` calls these "Random UUIDs" — they are not UUIDs; they are 9 base-36 characters.
**Recommended action:** replace "anonymous" with "pseudonymous" (or "anonymous-by-design, not legally anonymous") across all listed surfaces; correct "UUID" to "random identifier". Consider `crypto.randomUUID()` separately as implementation work.
**Severity: P1** — the term drives an incorrect legal conclusion about personal-data status.

### PV-02 — "GDPR-compliant" · PARTIALLY VERIFIED · **P0**

**Files:** `README.md:30`; `Landing.jsx:389,518,1148,1613`; `Privacy.jsx:187-199`; `Documentation.jsx:396`
**Current claim:** unqualified "GDPR-compliant" / "GDPR compliant".
**Evidence:** Several ingredients are real (V-01, V-02, V-03, V-04). But:
- **Compliance is a property of a deployment, not of software.** A self-hoster's lawful basis, DPA, notices, and DSR process determine compliance; the tool cannot confer it.
- Two of the controls cited on those same pages as compliance evidence **do not exist** — DNT/GPC (FO-01) and working retention deletion (FO-02).
- There is **no data-subject access endpoint** (Art. 15) and **no erasure endpoint** (Art. 17). Retention is per-site, not per-subject.
- Persistent pseudonymous IDs (PV-01) are still personal data.
**Recommended action:** replace with "GDPR-friendly by design" or "helps you meet GDPR obligations", and remove the "GDPR compliant ✓" checklist row in `Landing.jsx:1148` — a green tick against a compliance term is the strongest form of this claim. `Privacy.jsx:194` already carries a good hedge ("Always confirm with your own legal counsel"); apply that consistently.
**Severity: P0** — a self-hoster could rely on this for a regulatory decision, and part of the supporting evidence is false.

### PV-03 — "No consent banner needed" · PARTIALLY VERIFIED · **P1**

**Files:** `Privacy.jsx:120-121`; `Landing.jsx:518`; `blogPosts.js:20,27,40,55,139,153,248,298`
**Evidence:** The "no cookies" premise is true (V-01). The legal conclusion is contestable: ePrivacy/PECR Article 5(3) is technology-neutral about "storing information on the terminal equipment of a subscriber", and several regulators hold that `localStorage` writes fall within it regardless of the cookie label.
**Why partial:** `Privacy.jsx:121` and `blogPosts.js:153` do hedge ("in most jurisdictions", "confirm with your own legal counsel"). `Landing.jsx:518` states it more flatly.
**Recommended action:** apply the existing hedge consistently; avoid presenting the conclusion as settled.
**Severity: P1.**

### PV-04 — "Zero data sent to external services" / "no third-party sharing" · PARTIALLY VERIFIED · **P1**

**Files:** `docs/features.md:661`; `docs/security.md:39`; `Privacy.jsx:137,180,202`
**Current claim:** "Zero data sent to external services", "zero third-party data sharing".
**Evidence:** True of the **tracking pipeline** — the script posts only to its origin. **Not true of the product as a whole**, which makes outbound calls in three places:
- `src/mcp/llm/provider.js` — Pulse sends analytics **tool results** to Anthropic / OpenAI / Google. `assistant.js:333` serialises `envelopeForModel(envelope)` — real analytics rows — into the request body.
- `src/services/sentryService.js` — polls the Sentry API when a site connects an integration.
- `src/storage/s3.js` — uploads Parquet partitions when S3/R2 cold storage is configured.
All three are **opt-in** and disabled by default, which is why this is PARTIALLY VERIFIED rather than FALSE.
**Recommended action:** scope the claim — "No visitor data is sent to third parties by the tracking pipeline. Optional integrations (Pulse AI, Sentry, S3 cold storage) send data to services you configure." This matters most for Pulse, where analytics content leaves the server by design.
**Severity: P1** — "zero" is absolute and a privacy-motivated operator enabling Pulse would be surprised.

### PV-05 — "Data retention policies (configurable per-site)" · PARTIALLY VERIFIED · **P1**

**Files:** `docs/security.md:37`; `docs/features.md:419`
**Evidence:** The policy layer exists — `data_retention_policies` table, `GET/PUT /api/reporting/:siteId/retention`. Storing and reading a policy works.
**Why partial:** the policy has almost no effect. Enforcement is neither automatic (FO-02) nor complete (FO-03).
**Recommended action:** describe as "configurable retention policy with a manually triggered cleanup", pending implementation work.
**Severity: P1.**

### PV-06 — "Encryption" positioning in `docs/security.md` · PARTIALLY VERIFIED · **P2**

**File:** `docs/security.md` — "Database" section
**Evidence:** "Parameterized SQL queries (no string interpolation)" is accurate for the write path and analytics reads, and 83 of 90 `duckAll` call sites in `queries.js` bind `siteId`. But the SQL Editor's `applyTemplateVariables`/`toSqlLiteral` performs **hand-rolled literal interpolation** (`sqlEditor.js:29-47`), and `scopeQueryToSite` embeds an escaped site-id literal because DuckDB cannot bind parameters in DDL.
**Why partial:** both cases are mitigated (post-substitution re-validation; site id sourced from the verified record) and no bypass was demonstrated, but the blanket "no string interpolation" is not literally accurate.
**Recommended action:** note the two documented exceptions.
**Severity: P2.**

### PV-07 — "Separate users/roles for DB access" · PARTIALLY VERIFIED · **P2**

**File:** `docs/security.md:20`
**Evidence:** PostgreSQL uses a configured role (`POSTGRES_USER`). **DuckDB has no user or role system at all** — it is embedded and in-process, executing with the Node process's privileges (which is root in the shipped Dockerfile, as no `USER` directive is present).
**Recommended action:** clarify that this applies to PostgreSQL only, and that DuckDB access is process-level.
**Severity: P2.**

---

## 6. Unverified claims

Insufficient evidence to classify either way.

### UV-01 — "Tracking script is ~2 KB gzipped" · UNVERIFIED (measured: contradicted) · **P2**

**Files:** `README.md:34,43`; `docs/features.md:417,666`; `Documentation.jsx:1384` ("<2KB gzipped"); `Landing.jsx:440` ("Script under 2 KB"); `Settings.jsx:180` ("Script size < 5 KB")
**Evidence — measured during this audit** by generating the script and compressing it:

```
raw  : 24 836 bytes (24.3 KB)
gzip :  7 074 bytes ( 6.9 KB)
```

The generator embeds a ~250-entry IANA-timezone→country map and a ~100-entry ISO-3166 map, which dominate the size.
**Why "unverified" rather than "false":** the served size depends on the deployment's transfer encoding (Brotli would be smaller than gzip), so the exact number varies. But **6.9 KB gzipped is ~3.5× the claimed ~2 KB**, and `Landing.jsx:440` presents "Script under 2 KB" as a competitive differentiator against named alternatives. `Settings.jsx:180`'s "< 5 KB" is also exceeded.
**Recommended action:** re-measure per deployment and state the real figure (~7 KB gzipped), or reduce the script by moving the lookup maps server-side.
**Severity: P2** — not a security claim, but it is a measurable, currently-incorrect factual assertion used in comparison marketing.

### UV-02 — "Rate limiting on API endpoints" · UNVERIFIED · **P2**

**File:** `docs/security.md:15`
**Evidence:** `express-rate-limit` is configured in `index.js` at **1000 requests/minute** by default, skipping `/api/health` and the tracking pixel. The mechanism exists; whether 1000/min constitutes meaningful protection for any given endpoint is not established. Notably, `/api/sql-editor/:siteId/run` has **no dedicated limit**, so expensive queries are bounded only by that global figure. Pulse has its own stricter per-user limiter (10/min server key, 30/min BYO key).
**Recommended action:** state the actual default and note that the SQL Editor has no separate limit.
**Severity: P2.**

### UV-03 — "Input validation on all POST/PUT" · UNVERIFIED · **P2**

**File:** `docs/security.md:16`
**Evidence:** Validation is present but ad-hoc and per-route (e.g. `trackingService.trackEvent` clamps string lengths and checks a type allowlist; `sqlEditor` validates SQL). There is no schema-validation layer, and "all" was not exhaustively verified across every POST/PUT handler in the codebase.
**Recommended action:** soften "all" or enumerate what is validated.
**Severity: P2.**

---

## 7. False / outdated claims

Contradicted by the implementation as it stands.

### FO-01 — "Do Not Track (DNT) and Global Privacy Control (GPC) are honored" · **FALSE** · **P0**

**This is the most serious finding in the audit.**

**Files and lines — 12 distinct assertions:**

| File | Line | Claim |
|---|---|---|
| `README.md` | 30 | "DNT/GPC honored" |
| `docs/security.md` | 33-34 | "Tracking script checks `navigator.doNotTrack` and disables collection"; "Respects `navigator.globalPrivacyControl`" |
| `docs/features.md` | 412-413, 663 | Same, in two feature tables |
| `docs/tracking-script.md` | 76-77 | "if enabled, no data is collected" |
| `Landing.jsx` | 389, 518, 1148 | "DNT and GPC respected automatically"; "DNT respected ✓", "GPC signal honored ✓" |
| `Documentation.jsx` | 1384, 1510-1511 | "Respects DNT and GPC signals automatically" |
| `PrivacyPolicy.jsx` | 70-72 | "InsightsTrack respects the browser DNT and GPC signals" |
| `Privacy.jsx` | 128-130, 204 | "the script exits immediately — no events or sessions are created" |
| `Settings.jsx` | 180 | "Respects DNT & GPC signals" |
| `blogPosts.js` | 153 | "honor … DNT and GPC signals automatically" |

**Evidence — independently verified for this audit:**

```
grep -c "doNotTrack|globalPrivacyControl" src/services/sitesService.js
  apps/analytics-api          → 0
  appsv2/analytics-api        → 0
  traffic/analytics-db        → 0

grep -rn "doNotTrack|globalPrivacyControl" apps/analytics-api/src/
  → 0 matches anywhere in the backend
```

The generated script's initialisation was also read in full. It proceeds directly:

```js
var userId    = getUserId();      // writes localStorage
var sessionId = getSessionId();   // writes sessionStorage
…
function trackPageview() { … send('/api/track/event', {…}); startSession(); }
```

There is **no opt-out gate of any kind** — not DNT, not GPC, not a cookie-consent hook, not a `window` flag.

`Privacy.jsx:130` is the most specific and most wrong: it tells a developer exactly which properties are checked and states that the script "exits immediately". No such code exists.

**Recommended action — one of:**
1. **Implement it.** The check is a few lines at the top of `getRawTrackingScript`. This is the option that preserves every claim, and it must land in all three copies.
2. **Remove all 12 assertions** until implemented.

Whichever is chosen, **the claims and the code must be reconciled before public release.** Shipping a privacy-focused product whose own privacy page describes an unimplemented control is a research-integrity and trust problem, not merely a bug.

**Severity: P0** — a visitor who has enabled DNT/GPC is tracked anyway, and an operator who read this page believes otherwise.

### FO-02 — "Automated deletion of expired events and sessions" · **FALSE** · **P0**

**Files:** `docs/security.md:38` ("Manual or **automated** deletion"); `Documentation.jsx:207` ("data retention policy config, manual cleanup trigger" — this one is accurate)
**Evidence:** `runRetentionCleanup()` exists in `reportingService.js:136` and is exposed at `POST /api/reporting/:siteId/retention/cleanup`, but **nothing calls it on a schedule**. Every `setInterval` in the backend was enumerated:

| Location | Purpose |
|---|---|
| `index.js:218` | PG→DuckDB sync |
| `index.js:243` | Integration (Sentry) poll |
| `cache.js:14` | Cache expiry sweep |

There is no scheduler, cron entry, or job runner for retention. The word "automated" is unsupported.
**Recommended action:** remove "automated" from `docs/security.md:38` until a scheduler exists. (`Documentation.jsx:207` already describes it correctly as a manual trigger.)
**Severity: P0** — an operator who configures a 90-day policy and believes it self-enforces retains data indefinitely, which is precisely the failure mode a retention policy is meant to prevent.

### FO-03 — "Retention cleanup deletes expired data" · **FALSE (in effect)** · **P0**

**Files:** `docs/security.md:37-38`; `docs/features.md:419`; `Privacy.jsx:137` ("You can delete everything at any time")
**Evidence:** `runRetentionCleanup()` issues:

```js
import { query } from '../db/postgres.js';   // ← PostgreSQL helper
await query(`DELETE FROM events   WHERE site_id = $1 AND timestamp  < $2`, …);
await query(`DELETE FROM sessions WHERE site_id = $1 AND started_at < $2`, …);
```

These run against **PostgreSQL only**. The PG→DuckDB sync has **no deletion detection** — `sync.js` deletes from DuckDB only when truncating for a full resync or when upserting a row by id. There is no tombstone mechanism and no reconciliation pass.

Because **every dashboard read, SQL Editor query, and AI tool call goes to DuckDB**, expired data remains fully visible after a "successful" cleanup that reports a non-zero `deletedEvents` count.
**Recommended action:** treat as implementation work (propagate deletions to DuckDB, or trigger a full resync after cleanup). Until then, the deletion claims must not be presented as effective.
**Severity: P0** — for a GDPR erasure request this is the worst failure mode: the operator is told the data is deleted while it remains queryable in the system of record for all reads.

### FO-04 — "Users can delete everything at any time" · **FALSE / UNSUPPORTED** · **P1**

**File:** `Privacy.jsx:137`
**Evidence:** Follows from FO-03. There is additionally **no data-subject erasure endpoint** — retention operates per-site on a time cutoff, not per-visitor. A GDPR Art. 17 request for one individual cannot be satisfied by any mechanism in the codebase.
**Recommended action:** remove or qualify; treat per-subject erasure as implementation work.
**Severity: P1.**

### FO-05 — `docs/sql-editor.md` §10 security model is outdated · **OUTDATED** · **P1**

**File:** `docs/sql-editor.md:300-330`
**Evidence:** The section still describes the pre-hardening implementation. It documents only the keyword denylist and comment stripping, and **omits every control added since**:
- the **function allowlist** (201 permitted functions) that blocks `read_csv` / `read_parquet` / `read_json` / `read_text` / `glob` / `duckdb_settings`
- the **table allowlist** (12 tables) that blocks `users` and the assistant/MCP tables
- the **AST validation layer**
- **post-substitution re-validation**
- **per-site scoped views** (tenant isolation)

Its **row-limit description is now wrong**: it says "appends `LIMIT 1000` to any query that does not already contain a `LIMIT`", but `applyRowCap()` wraps the query so the cap binds *regardless* of a user-supplied `LIMIT`.

Its ownership description (`site.user_id === req.user.id`) is accurate but incomplete without the scoping layer.
**Recommended action:** replace §10 with a summary plus a link to `docs/SQL_EDITOR_SECURITY.md`.
**Severity: P1** — it understates the current protections and misdescribes an enforced limit, so a reader could reach a wrong conclusion about the boundary in either direction.

### FO-06 — "Pulse calls 17 read-only analytics tools" · **OUTDATED** · **P2**

**File:** `README.md:144`
**Evidence:** `grep -c "name: '"` against `src/mcp/tools/registry.js` returns **19**.
**Recommended action:** update to 19, or phrase without a count so it does not drift again.
**Severity: P2** — factual staleness; the read-only property itself is verified (V-08).

---

## 8. Recommended corrections

Grouped by the action each requires.

| ID | Claim | Correction |
|---|---|---|
| FO-01 | DNT/GPC honored | Implement the check, **or** remove all 12 assertions |
| FO-02 | Automated retention | Remove "automated" until a scheduler exists |
| FO-03 | Retention deletes data | Propagate deletions to DuckDB; do not claim effective deletion until then |
| FO-04 | "Delete everything at any time" | Remove or qualify; no per-subject erasure exists |
| FO-05 | sql-editor.md §10 | Replace with a link to `SQL_EDITOR_SECURITY.md` |
| FO-06 | "17 tools" | Update to 19 |
| PV-01 | "Anonymous" IDs | Use "pseudonymous"; correct "UUID" → "random identifier" |
| PV-02 | "GDPR-compliant" | "GDPR-friendly by design"; drop the compliance checkmark row |
| PV-03 | "No consent banner" | Apply the existing legal hedge consistently |
| PV-04 | "Zero data to third parties" | Scope to the tracking pipeline; name the opt-in integrations |
| PV-05 | Retention policies | "configurable policy with a manually triggered cleanup" |
| PV-06 | "No string interpolation" | Note the two documented SQL Editor exceptions |
| PV-07 | "Separate users/roles" | Clarify PostgreSQL-only; DuckDB is process-level |
| UV-01 | "~2 KB gzipped" | State the measured ~7 KB, or shrink the script |
| UV-02 | Rate limiting | State the 1000/min default; note no SQL Editor limit |
| UV-03 | "Validation on all POST/PUT" | Soften "all" or enumerate |

---

## 9. Items requiring implementation work

These cannot be resolved by editing text.

| ID | Work | Priority |
|---|---|---|
| FO-01 | Add DNT/GPC early-exit to the tracking script generator (all three copies) — *if the claims are to be kept* | **P0** |
| FO-03 | Propagate PostgreSQL deletions to DuckDB, or force a resync after cleanup | **P0** |
| FO-02 | Add a scheduler for retention cleanup — *if "automated" is to be kept* | **P0** |
| FO-04 | Data-subject export (Art. 15) and erasure (Art. 17) endpoints | **P1** |
| PV-01 | Switch visitor IDs to `crypto.randomUUID()` | **P2** |
| UV-01 | Move the timezone/ISO lookup maps server-side to reduce script size | **P2** |
| UV-02 | Per-user rate limit on `/api/sql-editor/:siteId/run` | **P2** |

**Note:** FO-01 and FO-02 have a documentation-only alternative (delete the claim). FO-03 does not — deletion that does not delete from the read path is a defect regardless of how it is described.

---

## 10. Items fixable by documentation alone

Text-only changes, no code:

- **FO-05** — rewrite `docs/sql-editor.md` §10
- **FO-06** — "17" → "19"
- **PV-01** — "anonymous" → "pseudonymous"; "UUID" → "random identifier"
- **PV-02** — soften "GDPR-compliant"; remove the compliance checkmark
- **PV-03** — apply the existing legal hedge consistently
- **PV-04** — scope the third-party claim to the tracking pipeline
- **PV-05** — describe retention as manually triggered
- **PV-06** — note the interpolation exceptions
- **PV-07** — clarify PostgreSQL-only
- **UV-01** — state the measured script size
- **UV-02**, **UV-03** — state actual limits; soften "all"
- **FO-01, FO-02** — *if* the decision is to drop the claims rather than implement

---

## Appendix — verification commands

Reproducible checks behind the findings above:

```bash
# FO-01 — DNT/GPC absent from the tracking script generator (all three copies)
grep -c "doNotTrack\|globalPrivacyControl" apps/analytics-api/src/services/sitesService.js
grep -rn "doNotTrack\|globalPrivacyControl" apps/analytics-api/src/

# FO-02 — every scheduler in the backend (none is retention)
grep -rn "setInterval" apps/analytics-api/src/

# FO-03 — cleanup targets PostgreSQL only
head -5 apps/analytics-api/src/services/reportingService.js   # imports db/postgres.js
grep -n -A14 "runRetentionCleanup" apps/analytics-api/src/services/reportingService.js

# V-01 / V-02 — no cookies, no IP column
grep -c "document.cookie" apps/analytics-api/src/services/sitesService.js
grep -n "ip\b\|ip_address\|remote_addr" apps/analytics-api/src/schema/schema.js

# FO-06 — actual tool count
grep -c "name: '" apps/analytics-api/src/mcp/tools/registry.js

# UV-01 — measured script size
node -e "const m=await import('./apps/analytics-api/src/services/sitesService.js');
const s=m.default.getRawTrackingScript('site_test','http://localhost:3001');
const z=await import('node:zlib');
console.log('raw',s.length,'gzip',z.gzipSync(s).length);"
```

---

*Audit only. No application behaviour, documentation wording, or marketing copy was modified. Every classification above was traced to code or measured directly; documentation was never accepted as evidence of implementation behaviour.*
