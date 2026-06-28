/**
 * Team & invitation routes
 *
 * All /api/team/:siteId/* require auth + site membership.
 * /api/invite/* routes are partially public (GET is public, POST requires auth).
 */

import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as teamService from '../services/teamService.js';
import { getMemberRole, roleAtLeast } from '../services/teamService.js';
import sitesService from '../services/sitesService.js';
import { sendError } from '../utils/safeError.js';

const router = express.Router();

// ── Middleware: require site membership ─────────────────────────────────────
async function requireMember(req, res, next) {
    try {
        const site = await sitesService.getSiteById(req.params.siteId);
        if (!site) return res.status(404).json({ error: 'Site not found' });
        const role = await getMemberRole(req.params.siteId, req.user.id);
        if (!role) return res.status(403).json({ error: 'You are not a member of this site' });
        req.site     = site;
        req.userRole = role;
        next();
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

function handleError(res, err) {
    sendError(res, err, err.status || 500);
}

// ══════════════════════════════════════════════════════════════════════
// Team management  (/api/team/:siteId/...)
// ══════════════════════════════════════════════════════════════════════

// GET /api/team/:siteId/members — list members + pending invites + custom roles
router.get('/:siteId/members', authMiddleware, requireMember, async (req, res) => {
    try {
        const data = await teamService.listMembersWithRoles(req.params.siteId);
        res.json({ success: true, data });
    } catch (e) { handleError(res, e); }
});

// ── Custom roles ──────────────────────────────────────────────────────────────

// GET /api/team/:siteId/roles — list custom roles
router.get('/:siteId/roles', authMiddleware, requireMember, async (req, res) => {
    try {
        const roles = await teamService.listCustomRoles(req.params.siteId);
        res.json({ success: true, data: roles });
    } catch (e) { handleError(res, e); }
});

// POST /api/team/:siteId/roles — create custom role (owner/admin)
router.post('/:siteId/roles', authMiddleware, requireMember, async (req, res) => {
    try {
        const { name, color, description, permissions } = req.body;
        const role = await teamService.createCustomRole(req.params.siteId, { name, color, description, permissions }, req.user.id);
        res.status(201).json({ success: true, data: role });
    } catch (e) { handleError(res, e); }
});

// PUT /api/team/:siteId/roles/:roleId — update custom role (owner/admin)
router.put('/:siteId/roles/:roleId', authMiddleware, requireMember, async (req, res) => {
    try {
        const { name, color, description, permissions } = req.body;
        const role = await teamService.updateCustomRole(req.params.siteId, parseInt(req.params.roleId), { name, color, description, permissions }, req.user.id);
        res.json({ success: true, data: role });
    } catch (e) { handleError(res, e); }
});

// DELETE /api/team/:siteId/roles/:roleId — delete custom role (owner only)
router.delete('/:siteId/roles/:roleId', authMiddleware, requireMember, async (req, res) => {
    try {
        const result = await teamService.deleteCustomRole(req.params.siteId, parseInt(req.params.roleId), req.user.id);
        res.json({ success: true, data: result });
    } catch (e) { handleError(res, e); }
});

// PUT /api/team/:siteId/members/:userId/custom-role — assign custom role to member
router.put('/:siteId/members/:userId/custom-role', authMiddleware, requireMember, async (req, res) => {
    try {
        const { customRoleId } = req.body;
        const result = await teamService.assignCustomRole(req.params.siteId, parseInt(req.params.userId), customRoleId, req.user.id);
        res.json({ success: true, data: result });
    } catch (e) { handleError(res, e); }
});

// POST /api/team/:siteId/invite — send invite (owner/admin only)
router.post('/:siteId/invite', authMiddleware, requireMember, async (req, res) => {
    try {
        const { email, role = 'viewer' } = req.body;
        if (!email) return res.status(400).json({ error: 'email is required' });

        const appBase = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/') || '';
        const result = await teamService.inviteMember(
            req.params.siteId, email, role, req.user.id, appBase
        );
        res.status(201).json({ success: true, data: result });
    } catch (e) { handleError(res, e); }
});

// PUT /api/team/:siteId/members/:userId — change role (owner only)
router.put('/:siteId/members/:userId', authMiddleware, requireMember, async (req, res) => {
    try {
        const { role } = req.body;
        if (!role) return res.status(400).json({ error: 'role is required' });
        const result = await teamService.changeMemberRole(
            req.params.siteId, parseInt(req.params.userId), role, req.user.id
        );
        res.json({ success: true, data: result });
    } catch (e) { handleError(res, e); }
});

// DELETE /api/team/:siteId/members/:userId — remove member (owner only)
router.delete('/:siteId/members/:userId', authMiddleware, requireMember, async (req, res) => {
    try {
        const result = await teamService.removeMember(
            req.params.siteId, parseInt(req.params.userId), req.user.id
        );
        res.json({ success: true, data: result });
    } catch (e) { handleError(res, e); }
});

// ══════════════════════════════════════════════════════════════════════
// Invite token routes  (/api/invite/...)
// ══════════════════════════════════════════════════════════════════════

// GET /api/invite/:token — public: returns invite details so the /join page can show site info
router.get('/invite/:token', async (req, res) => {
    try {
        const invite = await teamService.getInviteByToken(req.params.token);
        if (!invite) return res.status(404).json({ error: 'Invite not found or expired' });
        if (invite.accepted_at) return res.status(409).json({ error: 'Invite already accepted' });
        if (new Date(invite.expires_at) < new Date()) return res.status(410).json({ error: 'Invite has expired' });

        // Return only safe fields (no invited_by user_id etc.)
        res.json({
            success: true,
            data: {
                siteId:      invite.site_id,
                siteName:    invite.site_name,
                domain:      invite.domain,
                role:        invite.role,
                email:       invite.email,
                inviterName: invite.inviter_name,
                expiresAt:   invite.expires_at,
            },
        });
    } catch (e) { handleError(res, e); }
});

// POST /api/invite/:token/accept — auth required: accept the invite
router.post('/invite/:token/accept', authMiddleware, async (req, res) => {
    try {
        const result = await teamService.acceptInvite(req.params.token, req.user.id);
        res.json({ success: true, data: result });
    } catch (e) { handleError(res, e); }
});

// DELETE /api/invite/:token — cancel pending invite (owner/admin only)
router.delete('/invite/:token', authMiddleware, async (req, res) => {
    try {
        const result = await teamService.cancelInvite(req.params.token, req.user.id);
        res.json({ success: true, data: result });
    } catch (e) { handleError(res, e); }
});

export default router;
