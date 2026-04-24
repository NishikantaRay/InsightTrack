import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initializeData, closeConnection } from './db/database.js';
import analyticsRoutes from './routes/analytics.js';
import trackingRoutes from './routes/tracking.js';
import sitesRoutes from './routes/sites.js';
import authRoutes from './routes/auth.js';
import goalsRoutes from './routes/goals.js';
import reportingRoutes from './routes/reporting.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const dashboardOrigins = new Set(
  (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173,http://localhost:8080')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

const publicCors = cors({
  origin: true,
  credentials: false,
});

const privateCors = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    callback(null, dashboardOrigins.has(origin));
  },
  credentials: true,
});

// Trust proxy (needed when running behind nginx/Docker)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Public CORS only for tracking; app APIs are restricted below.
app.use('/api/track', publicCors);

// Body parser with size limit
app.use(express.json({ limit: '100kb' }));

// Rate limiting for tracking endpoints
const trackingLimiter = rateLimit({
  windowMs: parseInt(process.env.TRACKING_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: parseInt(process.env.TRACKING_RATE_LIMIT_MAX) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later' },
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: parseInt(process.env.API_RATE_LIMIT_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Initialize PostgreSQL and data
async function startServer() {
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await initializeData();
    console.log('✅ PostgreSQL connected and data initialized');
  } catch (error) {
    console.error('❌ PostgreSQL initialization failed:', error);
    console.log('⚠️  Make sure PostgreSQL is running on localhost:5432');
    console.log('   Create the database with: createdb analytics');
    process.exit(1);
  }

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      database: 'postgresql',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // API Routes
  app.use('/api/auth', privateCors, apiLimiter, authRoutes);
  app.use('/api/analytics', privateCors, apiLimiter, analyticsRoutes);
  app.use('/api/track', trackingLimiter, trackingRoutes);
  app.use('/api/sites', privateCors, apiLimiter, sitesRoutes);
  app.use('/api/goals', privateCors, apiLimiter, goalsRoutes);
  app.use('/api/reporting', privateCors, apiLimiter, reportingRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`
    });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  });

  // Start server
  const server = app.listen(PORT, () => {
    console.log(`
  🚀 Analytics Server running with PostgreSQL!
  
  📍 Local:    http://localhost:${PORT}
  📊 API:      http://localhost:${PORT}/api/analytics
  📡 Tracking: http://localhost:${PORT}/api/track
  🗄️  Database: PostgreSQL (${process.env.PG_HOST || 'localhost'}:${process.env.PG_PORT || '5432'})
  
  Environment: ${process.env.NODE_ENV || 'development'}
    `);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    server.close();
    await closeConnection();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down...');
    server.close();
    await closeConnection();
    process.exit(0);
  });
}

startServer();

export default app;
