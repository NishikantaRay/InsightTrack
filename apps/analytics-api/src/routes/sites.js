import express from 'express';
import sitesService from '../services/sitesService.js';
import sentryService from '../services/sentryService.js';
import { authMiddleware } from '../middleware/auth.js';
import { getMemberRole, roleAtLeast } from '../services/teamService.js';
import { sendError, safeMsg } from '../utils/safeError.js';

const router = express.Router();

// Site-scoped integration guard: verifies the caller is a member and (for
// mutating verbs) has at least `minRole`. Attaches req.userRole. Mirrors the
// authorizeSiteAccess pattern in routes/analytics.js.
function requireSiteRole(minRole = 'viewer') {
    return async (req, res, next) => {
        try {
            const site = await sitesService.getSiteById(req.params.siteId);
            if (!site) return res.status(404).json({ error: 'Site not found' });
            const role = await getMemberRole(site.id, req.user.id);
            if (!role) return res.status(403).json({ error: 'You do not have access to this site' });
            if (!roleAtLeast(role, minRole)) {
                return res.status(403).json({ error: `This action requires ${minRole} access` });
            }
            req.userRole = role;
            next();
        } catch (error) {
            sendError(res, error);
        }
    };
}

// GET /api/sites — list sites for the authenticated user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const sites = await sitesService.getAllSites(req.user.id);
        res.json({ success: true, data: sites });
    } catch (error) {
        console.error('Error fetching sites:', error);
        sendError(res, error);
    }
});

// POST /api/sites
let _createLock = false;
router.post('/', authMiddleware, async (req, res) => {
    if (_createLock) {
        return res.status(409).json({ error: 'A site is already being created, please wait' });
    }
    _createLock = true;
    try {
        const { name, domain } = req.body;
        if (!name || !domain) {
            return res.status(400).json({ error: 'name and domain are required' });
        }
        const site = await sitesService.createSite(name, domain, req.user.id);
        res.status(201).json({ success: true, data: site });
    } catch (error) {
        const status = error.message.includes('already exists') ? 409 : 500;
        console.error('Error creating site:', error);
        sendError(res, error, status);
    } finally {
        _createLock = false;
    }
});

// GET /api/sites/:siteId
router.get('/:siteId', authMiddleware, async (req, res) => {
    try {
        const site = await sitesService.getSiteById(req.params.siteId);
        // Access = membership (owner/admin/viewer), same model as every other
        // site-scoped route. The old strict user_id compare also broke on
        // types: sites.user_id is VARCHAR, the JWT id is a number.
        const role = site ? await getMemberRole(site.id, req.user.id) : null;
        if (!site || (!role && String(site.user_id) !== String(req.user.id))) {
            return res.status(404).json({ error: 'Site not found' });
        }
        res.json({ success: true, data: site });
    } catch (error) {
        console.error('Error fetching site:', error);
        sendError(res, error);
    }
});

// PUT /api/sites/:siteId
router.put('/:siteId', authMiddleware, async (req, res) => {
    try {
        const { name, domain } = req.body;
        const site = await sitesService.updateSite(req.params.siteId, name, domain, req.user.id);
        if (!site) {
            return res.status(404).json({ error: 'Site not found' });
        }
        res.json({ success: true, data: site });
    } catch (error) {
        console.error('Error updating site:', error);
        sendError(res, error);
    }
});

// DELETE /api/sites/:siteId
router.delete('/:siteId', authMiddleware, async (req, res) => {
    try {
        await sitesService.deleteSite(req.params.siteId, req.user.id);
        res.json({ success: true, message: 'Site deleted' });
    } catch (error) {
        console.error('Error deleting site:', error);
        sendError(res, error);
    }
});

// GET /api/sites/:siteId/script
router.get('/:siteId/script', async (req, res) => {
    try {
        const site = await sitesService.getSiteById(req.params.siteId);
        if (!site) {
            return res.status(404).send('/* Site not found */');
        }

        const serverUrl = `${req.protocol}://${req.get('host')}`;
        const script = sitesService.getRawTrackingScript(req.params.siteId, serverUrl);

        res.set('Content-Type', 'application/javascript');
        // Short TTL + revalidation. The script embeds privacy behaviour (the
        // DNT/GPC opt-out), so a long cache means a visitor can keep running an
        // outdated copy after a fix ships. 5 minutes with must-revalidate keeps
        // the CDN/browser benefit while bounding that window; the server-side
        // opt-out check in routes/tracking.js covers the interval regardless.
        res.set('Cache-Control', 'public, max-age=300, must-revalidate');
        res.send(script);
    } catch (error) {
        console.error('Error fetching script:', error);
        res.status(500).send('/* Error loading tracking script */');
    }
});

// GET /api/sites/:siteId/snippet
router.get('/:siteId/snippet', async (req, res) => {
    try {
        const site = await sitesService.getSiteById(req.params.siteId);
        if (!site) {
            return res.status(404).json({ error: 'Site not found' });
        }
        const serverUrl = `${req.protocol}://${req.get('host')}`;
        const snippet = `<script src="${serverUrl}/api/sites/${req.params.siteId}/script"></script>`;
        res.json({ success: true, data: { snippet, siteId: req.params.siteId, site } });
    } catch (error) {
        console.error('Error fetching snippet:', error);
        sendError(res, error);
    }
});

// ─── Sentry integration (per-site) ─────────────────────────────────────────
// Connect a site's Sentry project(s) so the poll loop pulls their issues into
// the Errors page. A site may connect MULTIPLE projects (P2.3). Tokens are stored
// AES-256-GCM-encrypted (secretBox); never returned to the client — only a masked
// hint and connection status are. Each integration is addressed by its id.

// GET /api/sites/:siteId/integrations/sentry — list all connected projects
router.get('/:siteId/integrations/sentry', authMiddleware, requireSiteRole('viewer'), async (req, res) => {
    try {
        const integrations = await sentryService.getIntegrations(req.params.siteId);
        res.json({ success: true, data: integrations });
    } catch (error) {
        console.error('Error fetching Sentry integrations:', error);
        sendError(res, error);
    }
});

// PUT /api/sites/:siteId/integrations/sentry — connect a new project or update
// an existing one (pass body.id to target a specific integration) (admin+)
router.put('/:siteId/integrations/sentry', authMiddleware, requireSiteRole('admin'), async (req, res) => {
    try {
        const { id, token, org, project, baseUrl, enabled } = req.body || {};
        const integration = await sentryService.upsertIntegration(req.params.siteId, {
            id, token, org, project, baseUrl, enabled,
        });
        res.json({ success: true, data: integration });
    } catch (error) {
        console.error('Error saving Sentry integration:', error);
        sendError(res, error, error.status || 500);
    }
});

// POST /api/sites/:siteId/integrations/sentry/:integrationId/test — live check (admin+)
router.post('/:siteId/integrations/sentry/:integrationId/test', authMiddleware, requireSiteRole('admin'), async (req, res) => {
    try {
        const result = await sentryService.testIntegration(req.params.integrationId, req.params.siteId);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error testing Sentry integration:', error);
        sendError(res, error, error.status || 502);
    }
});

// DELETE /api/sites/:siteId/integrations/sentry/:integrationId — disconnect (admin+)
router.delete('/:siteId/integrations/sentry/:integrationId', authMiddleware, requireSiteRole('admin'), async (req, res) => {
    try {
        await sentryService.deleteIntegration(req.params.integrationId, req.params.siteId);
        res.json({ success: true, message: 'Sentry integration removed' });
    } catch (error) {
        console.error('Error deleting Sentry integration:', error);
        sendError(res, error, error.status || 500);
    }
});

export default router;
