# Team Access & Multi-User Support — Feature Guide

> Invite teammates to access your analytics. Control what each person sees with per-member navigation visibility.

---

## Overview

InsightTrack supports multiple users per site. The owner can invite teammates by email and assign them a role. Each member logs in with their own credentials and only sees the sites they have been granted access to.

The feature lives entirely in **Profile → Team tab**.

---

## Roles

| Role | Analytics | Invite | Edit site | Change roles | Remove members | Delete site |
|---|---|---|---|---|---|---|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Viewer** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

- Every site has exactly **one owner** (the user who created it).
- Owners can change any member's role except their own.
- Viewers have full read-only access to all analytics pages.

---

## Inviting a Teammate

1. Go to **Profile → Team tab**.
2. Enter their email address and choose a role (**Viewer** or **Admin**).
3. Click **Send Invite**.

**Two outcomes:**

- **They already have an account** → added directly, no link needed. They appear in the member list immediately and the site shows up in their site switcher on next load.
- **They don't have an account** → an invite link is generated (valid for 7 days). Copy and send it via Slack, email, or any channel.

```
Invite link format:
https://your-app.com/join?token=<64-char-hex-token>
```

---

## Accepting an Invite

1. Open the invite link in any browser.
2. The `/join` page shows: site name, domain, role, and who sent the invite.
3. If not logged in → **Sign in** or **Create account** buttons appear (login redirects back to `/join` automatically after auth).
4. Click **Accept invite** → membership is created → redirected to the dashboard.
5. The site immediately appears in the site switcher.

---

## Managing Members

From **Profile → Team tab → Members list**:

| Action | Who can do it | How |
|---|---|---|
| Change role (Admin ↔ Viewer) | Owner only | Dropdown next to member |
| Remove member | Owner only | Trash icon next to member |
| Copy invite link again | Owner/Admin | "Copy link" on pending invite row |
| Cancel pending invite | Owner/Admin | × on pending invite row |

---

## Per-Member Feature Manager

Every member row in the Team tab has a **Features** button (slider icon). Clicking it expands an inline panel where you can control which sidebar navigation items that member sees.

This is powered by the same Feature Manager as **Profile → Feature Manager tab** — it controls the `analytics-feature-visibility` key in the browser's `localStorage`.

**Important:** Feature visibility is stored **per-browser**, not per-user-account. If you configure visibility on one device and the member opens a different browser, they will see the defaults. This is by design — no server round-trip needed for instant UI changes.

**Common use cases:**

- Hide **SQL Editor** for non-technical teammates (Viewers don't need raw SQL access)
- Hide **Privacy** tab for marketing team members
- Hide **Reporting** studio for stakeholders who only need the main dashboard
- Show only **Dashboard + Realtime** for executives who just want the KPI view

---

## Data Model

### `site_members` table (PostgreSQL)

```sql
CREATE TABLE site_members (
  id          SERIAL PRIMARY KEY,
  site_id     VARCHAR(64) NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id     INTEGER     NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL DEFAULT 'viewer'
                          CHECK (role IN ('owner','admin','viewer')),
  invited_by  INTEGER     REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, user_id)
);
```

### `site_invitations` table (PostgreSQL)

```sql
CREATE TABLE site_invitations (
  id          SERIAL PRIMARY KEY,
  site_id     VARCHAR(64)  NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL,
  role        VARCHAR(20)  NOT NULL DEFAULT 'viewer',
  token       VARCHAR(128) NOT NULL UNIQUE,   -- 32 random bytes hex
  invited_by  INTEGER      NOT NULL REFERENCES users(id),
  expires_at  TIMESTAMPTZ  NOT NULL,          -- 7 days from creation
  accepted_at TIMESTAMPTZ,                    -- NULL = still pending
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);
```

Backfill: when the server starts, any existing site that doesn't have an owner row in `site_members` is automatically backfilled with `role='owner'`.

---

## API Reference

All team endpoints require a valid JWT `Authorization: Bearer <token>` header.

### Team management

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/team/:siteId/members` | Member | List members + pending invites |
| `POST` | `/api/team/:siteId/invite` | Admin+ | Invite by email |
| `PUT` | `/api/team/:siteId/members/:userId` | Owner | Change member role |
| `DELETE` | `/api/team/:siteId/members/:userId` | Owner | Remove member |

### Invite tokens

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/invite/:token` | **Public** | Get invite info (site name, role, inviter) |
| `POST` | `/api/invite/:token/accept` | Any user | Accept the invite |
| `DELETE` | `/api/invite/:token` | Admin+ | Cancel pending invite |

### Example: invite a teammate

```http
POST /api/team/site_abc123/invite
Authorization: Bearer <token>
Content-Type: application/json

{ "email": "designer@company.com", "role": "viewer" }
```

**Response (new user — invite link generated):**
```json
{
  "success": true,
  "data": {
    "type": "invite",
    "email": "designer@company.com",
    "role": "viewer",
    "token": "6ae1f8ff9de38b1d...",
    "inviteUrl": "https://your-app.com/join?token=6ae1f8ff9de38b1d...",
    "expiresAt": "2026-07-04T12:00:00.000Z"
  }
}
```

**Response (existing user — added directly):**
```json
{
  "success": true,
  "data": {
    "type": "direct",
    "email": "designer@company.com",
    "role": "viewer",
    "message": "designer@company.com added directly (they already have an account)"
  }
}
```

---

## Frontend Components

| Component | Location | Purpose |
|---|---|---|
| `TeamTab` | `Profile.jsx` | Main team management UI (invite, member list, feature manager) |
| `FeatureManagerTab` | `Profile.jsx` | Personal feature visibility (your own view) |
| `FeatureToggleRow` | `Profile.jsx` | Single toggle for a nav item |
| `RoleBadge` | `Profile.jsx` | Colour-coded role chip (Owner/Admin/Viewer) |
| `JoinSite` | `pages/JoinSite.jsx` | Public invite acceptance page at `/join?token=...` |
| `teamAPI` | `services/api.js` | All 7 team API methods |

### `teamAPI` methods

```js
import { teamAPI } from '../services/api';

teamAPI.listMembers(siteId)                     // GET members + pending invites
teamAPI.invite(siteId, email, role)             // POST send invite
teamAPI.changeRole(siteId, userId, role)        // PUT change member role
teamAPI.removeMember(siteId, userId)            // DELETE remove member
teamAPI.cancelInvite(token)                     // DELETE cancel invite
teamAPI.getInviteInfo(token)                    // GET public invite info
teamAPI.acceptInvite(token)                     // POST accept invite
```

---

## Access Control in Analytics Routes

The `authorizeSiteAccess` middleware in `routes/analytics.js` now queries `site_members` instead of checking `sites.user_id === req.user.id`:

```js
const role = await getMemberRole(req.siteId, req.user.id);
if (!role) return res.status(403).json({ error: 'You do not have access to this site' });
req.userRole = role;  // 'owner' | 'admin' | 'viewer' — available to handlers
```

This means any endpoint under `/api/analytics/:siteId/` now accepts all members, not just the site owner. The `req.userRole` is attached for downstream permission checks.

---

## Phase 2 Roadmap (Not Yet Implemented)

| Feature | Description |
|---|---|
| **Email delivery** | Send invite emails automatically via SendGrid/Resend (currently: copy link manually). Add `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` env vars + Nodemailer. |
| **Team dashboard** | Separate `/team` page showing all sites + member counts across all your sites. |
| **Audit log** | Log member add/remove/role-change events to a `team_audit_log` table. |
| **Invite expiry UI** | Show "Invite expired" page for old tokens with option to request a new one. |
| **Transfer ownership** | Allow owner to transfer site ownership to another admin. |
| **SSO / OAuth** | GitHub/Google sign-in so new teammates don't need a password. |

---

## Custom Roles

Owners and admins can create **custom roles** with per-page permissions — beyond the built-in Owner/Admin/Viewer tiers.

### Creating a custom role

1. Go to **Profile → Team tab**
2. Click **New Role** in the Custom Roles section
3. Set a name, colour, optional description
4. Toggle individual pages on/off in the permission matrix
5. Click **Create role**

### Assigning a custom role to a member

In the member list, each non-owner member has a **custom role dropdown** next to their base role selector.
Custom roles are additive to the base role — a Viewer with a "Marketing" custom role sees only the pages allowed by that role.

### Custom role API endpoints

```
GET    /api/team/:siteId/roles                         — list custom roles
POST   /api/team/:siteId/roles                         — create { name, color, description, permissions }
PUT    /api/team/:siteId/roles/:roleId                 — update
DELETE /api/team/:siteId/roles/:roleId                 — delete (owner only)
PUT    /api/team/:siteId/members/:userId/custom-role   — assign { customRoleId }
```

### `site_custom_roles` table

```sql
CREATE TABLE site_custom_roles (
  id          SERIAL PRIMARY KEY,
  site_id     VARCHAR(64) NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name        VARCHAR(64) NOT NULL,
  color       VARCHAR(32) NOT NULL DEFAULT '#6366f1',
  description VARCHAR(255) DEFAULT '',
  permissions JSONB NOT NULL DEFAULT '{}',  -- { "dashboard": true, "heatmap": false, ... }
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, name)
);
```

`permissions` is a JSONB object mapping nav feature keys to booleans (e.g. `{ "heatmap": true, "sql-editor": false }`).

### Feature Manager per member

Each member row in the Team tab has a **Pages** button (slider icon). Clicking it expands an inline panel where you can toggle which sidebar navigation items that member sees. This is stored in the browser's `localStorage` under `analytics-feature-visibility` — it's per-browser, not per-account, and applies instantly with no server round-trip.

### Required env var for invite links

```bash
APP_BASE_URL=https://your-dashboard.vercel.app
```

This must be set on the backend so invite links point to the correct frontend URL.

---

## Live Demo Access

The public landing page has an **"Open live dashboard"** call-to-action so anyone
can explore InsightTrack with realistic sample data before self-hosting. Access
requires authentication — visitors log in or sign up first, then are granted
read-only access to a shared demo site.

### Flow

1. A visitor on the landing page clicks **Open live dashboard** / **Try Live Demo Free**.
   - Logged-out visitors are sent to `/login?redirect=/demo` or
     `/register?redirect=/demo`.
   - After authenticating, they land on the `/demo` route.
2. The `/demo` page (`DemoLanding.jsx`) calls `POST /api/demo/join`.
3. The backend grants the user **viewer** access to the demo site and returns its id.
4. The frontend sets that site active and forwards to the main dashboard, which
   now shows the seeded sample analytics.

The `/demo` route is wrapped in `ProtectedRoute`, so unauthenticated users can
never reach it directly — they're bounced to the landing page first. The join is
**idempotent**: existing members (including the demo-site owner) get their current
role back instead of an error or a duplicate membership row.

### Endpoint

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/demo/join` | Any user | Grant the caller viewer access to the demo site |

**Response:**
```json
{
  "success": true,
  "data": { "siteId": "site_98182e60", "domain": "hello.com", "name": "hello", "role": "viewer" }
}
```

Returns `404` if no demo site exists on the instance yet (run the seeder first).

### Setup

1. Seed the demo site + sample data:
   ```bash
   # local Docker stack
   node scripts/seed-live-demo.js

   # remote backend
   API=https://your-backend.example.com node scripts/seed-live-demo.js
   ```
   This creates the demo account and the `hello.com` site, inserts sample events,
   and runs a full PG → DuckDB sync.

2. Point the backend at that site by domain:
   ```bash
   DEMO_SITE_DOMAIN=hello.com   # default; override if you seeded a different domain
   ```

The seeder is repo-agnostic — the same `scripts/seed-live-demo.js` lives in both
`traffic` and `traffic2` and auto-detects the backend `.env` location, so it runs
unchanged against `apps`, `appsv2`, or the split `analytics-db` service.

