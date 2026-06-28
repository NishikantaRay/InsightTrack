/**
 * teamService — multi-user site access management
 *
 * Roles:
 *   owner  — full control, can invite/remove members, delete site
 *   admin  — can invite members, edit site settings, cannot delete or transfer
 *   viewer — read-only analytics access
 */

import crypto from 'node:crypto';
import { query } from '../db/postgres.js';

const INVITE_EXPIRE_DAYS = 7;

// ── Role helpers ───────────────────────────────────────────────────────────

const ROLE_RANK = { owner: 3, admin: 2, viewer: 1 };

export function roleAtLeast(role, minimum) {
    return (ROLE_RANK[role] || 0) >= (ROLE_RANK[minimum] || 0);
}

// ── Membership queries ──────────────────────────────────────────────────────

export async function getMemberRole(siteId, userId) {
    const r = await query(
        `SELECT role FROM site_members WHERE site_id = $1 AND user_id = $2`,
        [siteId, userId]
    );
    return r.rows[0]?.role ?? null;
}

export async function listMembers(siteId) {
    const members = await query(
        `SELECT
           m.id, m.role, m.created_at AS joined_at,
           u.id AS user_id, u.name, u.email
         FROM site_members m
         JOIN users u ON u.id = m.user_id
         WHERE m.site_id = $1
         ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.created_at`,
        [siteId]
    );

    const pending = await query(
        `SELECT i.id, i.email, i.role, i.token, i.expires_at, i.created_at,
                u.name AS invited_by_name
         FROM site_invitations i
         JOIN users u ON u.id = i.invited_by
         WHERE i.site_id = $1 AND i.accepted_at IS NULL AND i.expires_at > NOW()
         ORDER BY i.created_at DESC`,
        [siteId]
    );

    return {
        members: members.rows,
        pendingInvites: pending.rows,
    };
}

// ── Invite ──────────────────────────────────────────────────────────────────

export async function inviteMember(siteId, email, role, invitedById, appBaseUrl) {
    // Only owner/admin can invite
    const inviterRole = await getMemberRole(siteId, invitedById);
    if (!roleAtLeast(inviterRole, 'admin')) {
        throw Object.assign(new Error('Only owners and admins can invite members'), { status: 403 });
    }
    if (!['admin', 'viewer'].includes(role)) {
        throw Object.assign(new Error('Role must be admin or viewer'), { status: 400 });
    }

    const normalEmail = email.trim().toLowerCase();

    // If user already exists, add them directly to site_members (no token needed)
    const existingUser = await query(`SELECT id FROM users WHERE email = $1`, [normalEmail]);
    if (existingUser.rows.length > 0) {
        const targetId = existingUser.rows[0].id;

        // Already a member?
        const alreadyMember = await getMemberRole(siteId, targetId);
        if (alreadyMember) {
            throw Object.assign(
                new Error(`${normalEmail} is already a ${alreadyMember} of this site`),
                { status: 409 }
            );
        }

        await query(
            `INSERT INTO site_members (site_id, user_id, role, invited_by)
             VALUES ($1, $2, $3, $4)`,
            [siteId, targetId, role, invitedById]
        );
        return { type: 'direct', email: normalEmail, role, message: `${normalEmail} added directly (they already have an account)` };
    }

    // No account — create a pending invite token
    // Cancel any existing unexpired invite for the same email+site
    await query(
        `DELETE FROM site_invitations WHERE site_id = $1 AND email = $2 AND accepted_at IS NULL`,
        [siteId, normalEmail]
    );

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_EXPIRE_DAYS * 86400 * 1000);

    await query(
        `INSERT INTO site_invitations (site_id, email, role, token, invited_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [siteId, normalEmail, role, token, invitedById, expiresAt]
    );

    // appBaseUrl comes from the browser Origin header (always set by browsers).
    // APP_BASE_URL env var overrides this — should be set in production.
    // Never hardcode localhost in generated invite URLs.
    const base = (process.env.APP_BASE_URL || appBaseUrl || '').replace(/\/$/, '');
    if (!base) throw Object.assign(new Error('Cannot generate invite link: set the APP_BASE_URL environment variable'), { status: 500 });
    const inviteUrl = `${base}/join?token=${token}`;

    return { type: 'invite', email: normalEmail, role, token, inviteUrl, expiresAt };
}

// ── Accept invite ───────────────────────────────────────────────────────────

export async function getInviteByToken(token) {
    const r = await query(
        `SELECT i.*, s.name AS site_name, s.domain, u.name AS inviter_name
         FROM site_invitations i
         JOIN sites s ON s.id = i.site_id
         JOIN users u ON u.id = i.invited_by
         WHERE i.token = $1`,
        [token]
    );
    return r.rows[0] ?? null;
}

export async function acceptInvite(token, userId) {
    const invite = await getInviteByToken(token);

    if (!invite)              throw Object.assign(new Error('Invite not found'),    { status: 404 });
    if (invite.accepted_at)   throw Object.assign(new Error('Invite already used'), { status: 409 });
    if (new Date(invite.expires_at) < new Date())
                              throw Object.assign(new Error('Invite has expired'),  { status: 410 });

    // Already a member?
    const existing = await getMemberRole(invite.site_id, userId);
    if (existing) {
        throw Object.assign(
            new Error(`You are already a ${existing} of this site`),
            { status: 409 }
        );
    }

    await query(
        `INSERT INTO site_members (site_id, user_id, role, invited_by)
         VALUES ($1, $2, $3, $4)`,
        [invite.site_id, userId, invite.role, invite.invited_by]
    );
    await query(
        `UPDATE site_invitations SET accepted_at = NOW() WHERE token = $1`,
        [token]
    );

    return {
        siteId:   invite.site_id,
        siteName: invite.site_name,
        domain:   invite.domain,
        role:     invite.role,
    };
}

// ── Remove member ───────────────────────────────────────────────────────────

export async function removeMember(siteId, targetUserId, requesterId) {
    const requesterRole = await getMemberRole(siteId, requesterId);
    if (!roleAtLeast(requesterRole, 'owner')) {
        throw Object.assign(new Error('Only the owner can remove members'), { status: 403 });
    }

    const targetRole = await getMemberRole(siteId, targetUserId);
    if (!targetRole) throw Object.assign(new Error('User is not a member of this site'), { status: 404 });

    if (targetRole === 'owner') {
        throw Object.assign(new Error('Cannot remove the site owner'), { status: 400 });
    }

    await query(
        `DELETE FROM site_members WHERE site_id = $1 AND user_id = $2`,
        [siteId, targetUserId]
    );
    return { success: true };
}

// ── Change role ─────────────────────────────────────────────────────────────

export async function changeMemberRole(siteId, targetUserId, newRole, requesterId) {
    if (!['admin', 'viewer'].includes(newRole)) {
        throw Object.assign(new Error('Role must be admin or viewer'), { status: 400 });
    }

    const requesterRole = await getMemberRole(siteId, requesterId);
    if (!roleAtLeast(requesterRole, 'owner')) {
        throw Object.assign(new Error('Only the owner can change member roles'), { status: 403 });
    }

    const targetRole = await getMemberRole(siteId, targetUserId);
    if (!targetRole) throw Object.assign(new Error('User is not a member of this site'), { status: 404 });
    if (targetRole === 'owner') throw Object.assign(new Error('Cannot change the owner role'), { status: 400 });

    await query(
        `UPDATE site_members SET role = $1 WHERE site_id = $2 AND user_id = $3`,
        [newRole, siteId, targetUserId]
    );
    return { success: true };
}

// ── Cancel invite ───────────────────────────────────────────────────────────

export async function cancelInvite(token, requesterId) {
    const invite = await getInviteByToken(token);
    if (!invite)            throw Object.assign(new Error('Invite not found'), { status: 404 });
    if (invite.accepted_at) throw Object.assign(new Error('Invite already accepted'), { status: 409 });

    const requesterRole = await getMemberRole(invite.site_id, requesterId);
    if (!roleAtLeast(requesterRole, 'admin')) {
        throw Object.assign(new Error('Only owners and admins can cancel invites'), { status: 403 });
    }

    await query(`DELETE FROM site_invitations WHERE token = $1`, [token]);
    return { success: true };
}

// ── Get all sites a user is a member of ────────────────────────────────────

export async function getSitesForUser(userId) {
    const r = await query(
        `SELECT s.*, m.role AS user_role
         FROM site_members m
         JOIN sites s ON s.id = m.site_id
         WHERE m.user_id = $1
         ORDER BY m.role = 'owner' DESC, s.created_at DESC`,
        [userId]
    );
    return r.rows;
}

// ── Custom roles ────────────────────────────────────────────────────────────

export async function listCustomRoles(siteId) {
    const r = await query(
        `SELECT cr.*, u.name AS created_by_name,
                (SELECT COUNT(*) FROM site_members m WHERE m.custom_role_id = cr.id) AS member_count
         FROM site_custom_roles cr
         JOIN users u ON u.id = cr.created_by
         WHERE cr.site_id = $1
         ORDER BY cr.created_at ASC`,
        [siteId]
    );
    return r.rows;
}

export async function createCustomRole(siteId, { name, color, description, permissions }, requesterId) {
    const requesterRole = await getMemberRole(siteId, requesterId);
    if (!roleAtLeast(requesterRole, 'admin')) {
        throw Object.assign(new Error('Only owners and admins can create custom roles'), { status: 403 });
    }
    if (!name?.trim()) throw Object.assign(new Error('Role name is required'), { status: 400 });

    const r = await query(
        `INSERT INTO site_custom_roles (site_id, name, color, description, permissions, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [siteId, name.trim(), color || '#6366f1', description || '', JSON.stringify(permissions || {}), requesterId]
    );
    return r.rows[0];
}

export async function updateCustomRole(siteId, roleId, { name, color, description, permissions }, requesterId) {
    const requesterRole = await getMemberRole(siteId, requesterId);
    if (!roleAtLeast(requesterRole, 'admin')) {
        throw Object.assign(new Error('Only owners and admins can edit custom roles'), { status: 403 });
    }
    const r = await query(
        `UPDATE site_custom_roles
         SET name=$1, color=$2, description=$3, permissions=$4, updated_at=NOW()
         WHERE id=$5 AND site_id=$6 RETURNING *`,
        [name.trim(), color || '#6366f1', description || '', JSON.stringify(permissions || {}), roleId, siteId]
    );
    if (!r.rows[0]) throw Object.assign(new Error('Custom role not found'), { status: 404 });
    return r.rows[0];
}

export async function deleteCustomRole(siteId, roleId, requesterId) {
    const requesterRole = await getMemberRole(siteId, requesterId);
    if (!roleAtLeast(requesterRole, 'owner')) {
        throw Object.assign(new Error('Only the owner can delete custom roles'), { status: 403 });
    }
    // Unassign from members first
    await query(`UPDATE site_members SET custom_role_id = NULL WHERE custom_role_id = $1`, [roleId]);
    await query(`DELETE FROM site_custom_roles WHERE id = $1 AND site_id = $2`, [roleId, siteId]);
    return { success: true };
}

export async function assignCustomRole(siteId, targetUserId, customRoleId, requesterId) {
    const requesterRole = await getMemberRole(siteId, requesterId);
    if (!roleAtLeast(requesterRole, 'admin')) {
        throw Object.assign(new Error('Only owners and admins can assign custom roles'), { status: 403 });
    }
    // Verify custom role belongs to this site
    if (customRoleId !== null) {
        const check = await query(`SELECT id FROM site_custom_roles WHERE id=$1 AND site_id=$2`, [customRoleId, siteId]);
        if (!check.rows[0]) throw Object.assign(new Error('Custom role not found on this site'), { status: 404 });
    }
    await query(
        `UPDATE site_members SET custom_role_id=$1 WHERE site_id=$2 AND user_id=$3`,
        [customRoleId, siteId, targetUserId]
    );
    return { success: true };
}

// Enhanced listMembers that includes custom role info
export async function listMembersWithRoles(siteId) {
    const members = await query(
        `SELECT
           m.id, m.role, m.custom_role_id, m.created_at AS joined_at,
           u.id AS user_id, u.name, u.email,
           cr.name AS custom_role_name, cr.color AS custom_role_color,
           cr.permissions AS custom_role_permissions
         FROM site_members m
         JOIN users u ON u.id = m.user_id
         LEFT JOIN site_custom_roles cr ON cr.id = m.custom_role_id
         WHERE m.site_id = $1
         ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.created_at`,
        [siteId]
    );

    const pending = await query(
        `SELECT i.id, i.email, i.role, i.token, i.expires_at, i.created_at,
                u.name AS invited_by_name
         FROM site_invitations i
         JOIN users u ON u.id = i.invited_by
         WHERE i.site_id = $1 AND i.accepted_at IS NULL AND i.expires_at > NOW()
         ORDER BY i.created_at DESC`,
        [siteId]
    );

    const customRoles = await listCustomRoles(siteId);

    return {
        members: members.rows,
        pendingInvites: pending.rows,
        customRoles,
    };
}

// ── Demo site access ──────────────────────────────────────────────────────────

/**
 * Grant the authenticated user read-only (viewer) access to the public demo
 * site, so the "Open live dashboard" CTA on the landing page works for anyone
 * who logs in or signs up. The demo site is identified by domain via the
 * DEMO_SITE_DOMAIN env var (default: hello.com) — it must already exist
 * (created by scripts/seed-live-demo.js).
 *
 * Idempotent: if the user is already a member (or owns it), returns the
 * existing membership instead of erroring.
 *
 * @param {number} userId  authenticated user id
 * @returns {Promise<{siteId:string, domain:string, name:string, role:string}>}
 */
export async function joinDemoSite(userId) {
    const demoDomain = process.env.DEMO_SITE_DOMAIN || 'hello.com';

    const siteRes = await query(
        `SELECT id, name, domain FROM sites WHERE domain = $1 LIMIT 1`,
        [demoDomain]
    );
    const site = siteRes.rows[0];
    if (!site) {
        throw Object.assign(
            new Error('Demo site is not set up on this instance yet'),
            { status: 404 }
        );
    }

    const existing = await getMemberRole(site.id, userId);
    if (!existing) {
        // ON CONFLICT guards against a race where two requests land together.
        await query(
            `INSERT INTO site_members (site_id, user_id, role, invited_by)
             VALUES ($1, $2, 'viewer', NULL)
             ON CONFLICT (site_id, user_id) DO NOTHING`,
            [site.id, userId]
        );
    }

    return {
        siteId: site.id,
        domain: site.domain,
        name:   site.name,
        role:   existing || 'viewer',
    };
}
