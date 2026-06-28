import express from 'express';
import { goalsService } from '../services/goalsService.js';
import { authMiddleware } from '../middleware/auth.js';
import { safeMsg } from '../utils/safeError.js';

const router = express.Router();

// All goal routes require authentication
router.use(authMiddleware);

// ─── Goals ─────────────────────────────────────────

// GET /api/goals/:siteId
router.get('/:siteId', async (req, res) => {
    try {
        const goals = await goalsService.listGoals(req.params.siteId);
        res.json({ success: true, data: goals });
    } catch (error) {
        console.error('Error listing goals:', error);
        res.status(500).json({ success: false, error: safeMsg(error) });
    }
});

// POST /api/goals/:siteId
router.post('/:siteId', async (req, res) => {
    try {
        const { name, type, config } = req.body;
        const goal = await goalsService.createGoal({
            siteId: req.params.siteId, name, type, config,
        });
        res.status(201).json({ success: true, data: goal });
    } catch (error) {
        console.error('Error creating goal:', error);
        res.status(400).json({ success: false, error: safeMsg(error) });
    }
});

// DELETE /api/goals/:siteId/:goalId
router.delete('/:siteId/:goalId', async (req, res) => {
    try {
        await goalsService.deleteGoal(req.params.goalId, req.params.siteId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting goal:', error);
        res.status(500).json({ success: false, error: safeMsg(error) });
    }
});

// ─── A/B Tests ─────────────────────────────────────

// GET /api/goals/:siteId/ab-tests
router.get('/:siteId/ab-tests', async (req, res) => {
    try {
        const tests = await goalsService.listABTests(req.params.siteId);
        res.json({ success: true, data: tests });
    } catch (error) {
        console.error('Error listing A/B tests:', error);
        res.status(500).json({ success: false, error: safeMsg(error) });
    }
});

// POST /api/goals/:siteId/ab-tests
router.post('/:siteId/ab-tests', async (req, res) => {
    try {
        const { name, variants, goalId } = req.body;
        const test = await goalsService.createABTest({
            siteId: req.params.siteId, name, variants, goalId,
        });
        res.status(201).json({ success: true, data: test });
    } catch (error) {
        console.error('Error creating A/B test:', error);
        res.status(400).json({ success: false, error: safeMsg(error) });
    }
});

// PUT /api/goals/:siteId/ab-tests/:testId/status
router.put('/:siteId/ab-tests/:testId/status', async (req, res) => {
    try {
        const { status } = req.body;
        await goalsService.updateABTestStatus(req.params.testId, req.params.siteId, status);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating A/B test:', error);
        res.status(400).json({ success: false, error: safeMsg(error) });
    }
});

// DELETE /api/goals/:siteId/ab-tests/:testId
router.delete('/:siteId/ab-tests/:testId', async (req, res) => {
    try {
        await goalsService.deleteABTest(req.params.testId, req.params.siteId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting A/B test:', error);
        res.status(500).json({ success: false, error: safeMsg(error) });
    }
});

export default router;
