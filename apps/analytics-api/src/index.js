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
import sqlEditorRoutes from './routes/sqlEditor.js';
import teamRoutes from './routes/team.js';
import mcpRoutes from './routes/mcp.js';
import assistantRoutes from './routes/assistant.js';
import integrationsRoutes from './routes/integrations.js';
import { safeMsg } from './utils/safeError.js';
import { closeDuck, initDuckDB } from './db/duckdb.js';
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

// Production guard: a missing or localhost-only CORS allowlist in production is
// almost always a misconfiguration. Warn loudly so it's caught before launch.
if (process.env.NODE_ENV === 'production') {
    const onlyLocal = [...allowedOrigins].every((o) => /localhost|127\.0\.0\.1/.test(o));
    if (!process.env.CORS_ORIGINS || onlyLocal) {
        console.warn(
            '⚠️  [security] CORS_ORIGINS is unset or localhost-only in production. ' +
            'Set it to your real dashboard origin(s), e.g. CORS_ORIGINS=https://analytics.yourdomain.com'
        );
    }
}

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

// Public integration webhooks — mounted BEFORE the global json parser so the
// route can capture the raw body for HMAC signature verification. Public CORS
// (called by Sentry, not the browser app); authenticated by per-integration HMAC.
app.use('/api/integrations', publicCors, integrationsRoutes);

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
app.use('/api/sql-editor', privateCors, sqlEditorRoutes);
// Team management + invite acceptance
app.use('/api/team', privateCors, teamRoutes);
app.use('/api', privateCors, teamRoutes);   // mounts /api/invite/:token routes

// MCP Toolkit — OpenAPI→MCP tool mapping + Platform Connect signing (see docs/mcp-toolkit.md)
app.use('/api/mcp', privateCors, mcpRoutes);

// AI Analyst — in-dashboard assistant (LLM + analytics tools, SSE streaming)
app.use('/api/assistant', privateCors, assistantRoutes);

// Public OpenAPI 3.1 spec of the readable analytics API (docs + MCP tool generation)
app.get('/api/openapi.json', async (req, res) => {
    const { OPENAPI_SPEC } = await import('./mcp/openapi/insighttrack-spec.js');
    res.json(OPENAPI_SPEC);
});

// Health check — minimal, no internal info
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Demo access — grant the logged-in user viewer access to the public demo site
// so the landing page "Open live dashboard" CTA works after login/signup.
app.post('/api/demo/join', privateCors, authMiddleware, async (req, res) => {
    try {
        const { joinDemoSite } = await import('./services/teamService.js');
        const result = await joinDemoSite(req.user.id);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(err.status || 500).json({
            error: err.status === 404
                ? 'Demo site is not available on this instance'
                : 'Failed to join demo site',
        });
    }
});

// Manual sync trigger
app.post('/api/sync', privateCors, authMiddleware, async (req, res) => {
    try {
        const full = req.query.full === 'true';
        const totalRows = await runSync({ fullSync: full, silent: true });
        res.json({ success: true, totalRows, mode: full ? 'full' : 'incremental' });
    } catch (err) {
        console.error('Manual sync failed:', err.message);
        res.status(500).json({ error: 'Sync failed' });
    }
});

// S3/R2 cold storage status
app.get('/api/storage/status', privateCors, authMiddleware, async (req, res) => {
    try {
        const { s3Status } = await import('./storage/s3.js');
        res.json({ success: true, storage: s3Status() });
    } catch (err) {
        console.error('Storage status error:', err.message);
        res.status(500).json({ error: 'Failed to get storage status' });
    }
});

// Manual archive trigger
app.post('/api/storage/archive', privateCors, authMiddleware, async (req, res) => {
    try {
        const { s3Enabled, archiveAllToS3, refreshUnifiedViews } = await import('./storage/s3.js');
        if (!s3Enabled()) return res.status(400).json({ error: 'S3 cold storage is not configured' });
        const archived = await archiveAllToS3({ silent: true });
        await refreshUnifiedViews({ silent: true });
        res.json({ success: true, partitionsArchived: archived });
    } catch (err) {
        console.error('Archive error:', err.message);
        res.status(500).json({ error: 'Archive operation failed' });
    }
});

// 404 handler — don't echo back the requested URL (prevents reflected path disclosure)
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Error handler — never leak stack traces or internal messages in production
app.use((err, req, res, _next) => {
    console.error('[unhandled]', err?.message, err?.stack?.split('\n')[1]?.trim());
    res.status(500).json({ error: safeMsg(err, 500) });
});

// Start server
async function start() {
    try {
        createPool();
        await initializeDatabase();
        console.log('✅ PostgreSQL initialized');

        // Init DuckDB + S3/R2 httpfs (no-op when S3 env vars are not set)
        await initDuckDB();

        // Auto-sync PG → DuckDB on startup (+ S3 archive if configured)
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

        // Periodic retention cleanup. A configured policy previously only took
        // effect when someone called the cleanup endpoint by hand, so data was
        // retained indefinitely unless an operator remembered to trigger it.
        // This sweeps every site whose policy is enabled; sites without one are
        // untouched. Set RETENTION_INTERVAL_MS=0 to disable the scheduler.
        const RETENTION_INTERVAL = parseInt(process.env.RETENTION_INTERVAL_MS ?? '') || 6 * 60 * 60_000;
        if (RETENTION_INTERVAL > 0) {
            const { reportingService } = await import('./services/reportingService.js');
            const sweepRetention = async () => {
                try {
                    const { sites } = await reportingService.runAllRetentionCleanups();
                    if (sites > 0) console.log(`🧹 Retention cleanup ran for ${sites} site(s)`);
                } catch (err) {
                    console.warn('⚠  Retention cleanup failed:', err.message);
                }
            };
            // Delayed first run so startup isn't competing with the initial sync.
            setTimeout(sweepRetention, 60_000);
            setInterval(sweepRetention, RETENTION_INTERVAL);
        }

        // Periodic integration poll: pull each connected provider's issues into
        // PostgreSQL (from where the sync loop above carries them to DuckDB).
        // Provider-generic via the integration registry (P3.1) — each adapter's
        // pollAll is a no-op when that provider has no integrations. Defaults to
        // every 5 minutes.
        const SENTRY_POLL_INTERVAL = parseInt(process.env.SENTRY_POLL_INTERVAL_MS) || 300_000;
        const { allAdapters } = await import('./integrations/registry.js');
        const pollAllProviders = async ({ silent }) => {
            for (const adapter of allAdapters()) {
                try {
                    await adapter.pollAll({ silent });
                } catch (err) {
                    console.warn(`⚠  ${adapter.label} poll failed:`, err.message);
                }
            }
        };
        pollAllProviders({ silent: false }).catch(() => {});
        setInterval(() => { pollAllProviders({ silent: true }).catch(() => {}); }, SENTRY_POLL_INTERVAL);

        app.listen(PORT, () => {
            console.log(`\n🚀 InsightsTrack server running on http://localhost:${PORT}`);
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
