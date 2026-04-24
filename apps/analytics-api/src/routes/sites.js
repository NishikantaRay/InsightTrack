import express from 'express';
import sitesService from '../services/sitesService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// GET /api/sites — list sites for the authenticated user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const sites = await sitesService.getAllSites(req.user.id);
        res.json({ success: true, data: sites });
    } catch (error) {
        console.error('Error fetching sites:', error);
        res.status(500).json({ error: error.message });
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
        res.status(status).json({ error: error.message });
    } finally {
        _createLock = false;
    }
});

// GET /api/sites/:siteId
router.get('/:siteId', authMiddleware, async (req, res) => {
    try {
        const site = await sitesService.getSiteById(req.params.siteId);
        if (!site || site.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Site not found' });
        }
        res.json({ success: true, data: site });
    } catch (error) {
        console.error('Error fetching site:', error);
        res.status(500).json({ error: error.message });
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
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/sites/:siteId
router.delete('/:siteId', authMiddleware, async (req, res) => {
    try {
        await sitesService.deleteSite(req.params.siteId, req.user.id);
        res.json({ success: true, message: 'Site deleted' });
    } catch (error) {
        console.error('Error deleting site:', error);
        res.status(500).json({ error: error.message });
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
        res.set('Cache-Control', 'public, max-age=3600');
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
        res.status(500).json({ error: error.message });
    }
});

export default router;
