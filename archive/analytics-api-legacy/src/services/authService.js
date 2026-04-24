import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret' : null);
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

export const authService = {
    async register(name, email, password) {
        // Check if user exists
        const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            throw new Error('An account with this email already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const result = await query(
            `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at`,
            [name, email.toLowerCase(), hashedPassword, 'owner']
        );

        const user = result.rows[0];
        const token = generateToken(user);

        return { user, token };
    },

    async login(email, password) {
        const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
        if (result.rows.length === 0) {
            throw new Error('Invalid email or password');
        }

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            throw new Error('Invalid email or password');
        }

        const token = generateToken(user);
        const { password: _, ...safeUser } = user;

        return { user: safeUser, token };
    },

    async getProfile(userId) {
        const result = await query(
            'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
            [userId]
        );
        return result.rows[0] || null;
    },

    async updateProfile(userId, updates) {
        const fields = [];
        const values = [];
        let idx = 1;

        if (updates.name) { fields.push(`name = $${idx++}`); values.push(updates.name); }
        if (updates.email) { fields.push(`email = $${idx++}`); values.push(updates.email.toLowerCase()); }

        if (fields.length === 0) return this.getProfile(userId);

        values.push(userId);
        const result = await query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role, created_at`,
            values
        );
        return result.rows[0];
    },

    verifyToken,
};

export default authService;
