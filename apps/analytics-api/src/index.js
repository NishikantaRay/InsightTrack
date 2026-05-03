import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { createPool, initializeDatabase } from './db/postgres.js';
import analyticsRoutes from './routes/analytics.js';
import sitesRoutes from './routes/sites.js';
import trackingRoutes from './routes/tracking.js';
import authRoutes from './routes/auth.js';
import goalsRoutes from './routes/goals.js';
import reportingRoutes from './routes/reporting.js';
import { closeDuck } from './db/duckdb.js';
import { closeConnection } from './db/postgres.js';
import { authMiddleware } from './middleware/auth.js';
import { runSync } from './sync/sync.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS || 'http://localhost:4173,http://localhost:5173,http://localhost:3000,http://127.0.0.1:8080')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
);

const publicCors = cors({
    origin: (origin, callback) => callback(null, origin || true),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
});

const privateCors = cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        return callback(null, allowedOrigins.has(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
});

// Trust proxy (needed when running behind nginx/Docker)
app.set('trust proxy', 1);

// Public CORS for tracking endpoints; authenticated app endpoints are restricted below.
app.use('/api/track', publicCors);

// Security middleware (after CORS so preflight isn't blocked)
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for health checks and tracking pixel
    skip: (req) => req.path === '/api/health' || req.path.endsWith('/pixel.gif'),
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    if (!req.path.startsWith('/api/track')) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    }
    next();
});

// Routes
app.use('/api/analytics', privateCors, analyticsRoutes);
app.use('/api/sites', privateCors, sitesRoutes);
app.use('/api/track', trackingRoutes);
app.use('/api/auth', privateCors, authRoutes);
app.use('/api/goals', privateCors, goalsRoutes);
app.use('/api/reporting', privateCors, reportingRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// Manual sync trigger endpoint (POST only, no body needed)
app.post('/api/sync', privateCors, authMiddleware, async (req, res) => {
    try {
        const full = req.query.full === 'true';
        const totalRows = await runSync({ fullSync: full, silent: true });
        res.json({ success: true, totalRows, mode: full ? 'full' : 'incremental' });
    } catch (err) {
        console.error('Manual sync failed:', err.message);
        res.status(500).json({ error: 'Sync failed', details: err.message });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.originalUrl} not found` });
});

// Error handler
app.use((err, req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' });
});

// Start server
async function start() {
    try {
        createPool();
        await initializeDatabase();
        console.log('✅ PostgreSQL initialized');

        // Auto-sync PG → DuckDB on startup
        try {
            await runSync({ silent: false });
            console.log('✅ DuckDB synced from PostgreSQL');
        } catch (syncErr) {
            console.warn('⚠  Initial DuckDB sync failed (analytics may be stale):', syncErr.message);
        }

        // Periodic sync every 60 seconds (silent — only logs errors)
        const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL_MS) || 60_000;
        setInterval(async () => {
            try {
                await runSync({ silent: true });
            } catch (err) {
                console.warn('⚠  Periodic sync failed:', err.message);
            }
        }, SYNC_INTERVAL);

        app.listen(PORT, () => {
            console.log(`\n🚀 InsightTrack server running on http://localhost:${PORT}`);
            console.log(`   Analytics queries powered by DuckDB`);
            console.log(`   Writes (tracking, auth, sites) → PostgreSQL`);
            console.log(`   Auto-sync: PG → DuckDB every ${SYNC_INTERVAL / 1000}s\n`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
async function shutdown(signal) {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    try {
        await closeDuck();
        await closeConnection();
        console.log('✅ All connections closed');
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
