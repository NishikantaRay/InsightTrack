// Goals & A/B Tests Service — PostgreSQL writes
import { query } from '../db/postgres.js';
import { v4 as uuidv4 } from 'uuid';

export const goalsService = {
    // Create a conversion goal
    async createGoal({ siteId, name, type, config }) {
        if (!siteId || !name || !type) {
            throw new Error('siteId, name, and type are required');
        }

        const ALLOWED_TYPES = ['page_visit', 'event', 'click'];
        if (!ALLOWED_TYPES.includes(type)) {
            throw new Error(`Invalid goal type. Must be one of: ${ALLOWED_TYPES.join(', ')}`);
        }

        const id = `goal_${uuidv4().split('-')[0]}`;
        await query(
            `INSERT INTO goals (id, site_id, name, type, config, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
            [id, siteId, name.slice(0, 255), type, JSON.stringify(config || {})]
        );
        return { id, siteId, name, type, config };
    },

    // List goals for a site
    async listGoals(siteId) {
        const result = await query(
            `SELECT id, site_id, name, type, config, created_at FROM goals WHERE site_id = $1 ORDER BY created_at DESC`,
            [siteId]
        );
        return result.rows;
    },

    // Delete a goal
    async deleteGoal(goalId, siteId) {
        await query(`DELETE FROM goals WHERE id = $1 AND site_id = $2`, [goalId, siteId]);
        return { success: true };
    },

    // Create an A/B test
    async createABTest({ siteId, name, variants, goalId }) {
        if (!siteId || !name || !variants || variants.length < 2) {
            throw new Error('siteId, name, and at least 2 variants are required');
        }

        const id = `ab_${uuidv4().split('-')[0]}`;
        await query(
            `INSERT INTO ab_tests (id, site_id, name, variants, goal_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [id, siteId, name.slice(0, 255), JSON.stringify(variants), goalId || null, 'active']
        );
        return { id, siteId, name, variants, goalId, status: 'active' };
    },

    // List A/B tests for a site
    async listABTests(siteId) {
        const result = await query(
            `SELECT id, site_id, name, variants, goal_id, status, created_at FROM ab_tests WHERE site_id = $1 ORDER BY created_at DESC`,
            [siteId]
        );
        return result.rows;
    },

    // Update A/B test status
    async updateABTestStatus(testId, siteId, status) {
        const ALLOWED_STATUSES = ['active', 'paused', 'completed'];
        if (!ALLOWED_STATUSES.includes(status)) {
            throw new Error(`Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}`);
        }
        await query(
            `UPDATE ab_tests SET status = $1 WHERE id = $2 AND site_id = $3`,
            [status, testId, siteId]
        );
        return { success: true };
    },

    // Delete an A/B test
    async deleteABTest(testId, siteId) {
        await query(`DELETE FROM ab_tests WHERE id = $1 AND site_id = $2`, [testId, siteId]);
        return { success: true };
    },
};

export default goalsService;
