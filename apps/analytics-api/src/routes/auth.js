import express from 'express';
import authService from '../services/authService.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendError } from '../utils/safeError.js';

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
        if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
        const { user, token } = await authService.register(name, email, password);
        res.status(201).json({ success: true, data: { user, token } });
    } catch (error) {
        const status = error.message.includes('already exists') ? 409 : 500;
        sendError(res, error, status);
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
        const { user, token } = await authService.login(email, password);
        res.json({ success: true, data: { user, token } });
    } catch (error) {
        // Auth errors are always 401 with the original message (safe: "Invalid email or password")
        res.status(401).json({ error: error.message });
    }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await authService.getProfile(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ success: true, data: user });
    } catch (error) {
        sendError(res, error);
    }
});

// PUT /api/auth/me
router.put('/me', authMiddleware, async (req, res) => {
    try {
        const { name, email } = req.body;
        const user = await authService.updateProfile(req.user.id, { name, email });
        res.json({ success: true, data: user });
    } catch (error) {
        sendError(res, error);
    }
});

export default router;
