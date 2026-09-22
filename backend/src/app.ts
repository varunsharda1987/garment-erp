// Main Express application setup
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import helmet from 'helmet';
import connectTimeout from 'connect-timeout';

// Load environment variables from backend/.env (local takes priority — dotenv never overwrites an
// already-set key, so the first call wins). `quiet` suppresses the "injected env" banner dotenv 17+
// prints on every load; this daemon's PM2 log is shared with three other businesses.
dotenv.config({ path: path.join(__dirname, '../.env.local'), quiet: true });
dotenv.config({ path: path.join(__dirname, '../.env'), quiet: true });

// Import logger
import { logInfo, logWarn } from './utils/logger';

// Import all middleware
import { generalLimiter } from './middleware/security.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { fileAccessMiddleware, createFileAccessMiddleware } from './middleware/file-access.middleware';
import { httpLogger } from './middleware/logging.middleware';
import { transformResponse } from './middleware/transform.middleware';

// Import Sentry for error tracking
import { initializeSentry } from './config/sentry';
import * as Sentry from '@sentry/node';

// Import route handlers
import healthRoutes from './routes/health.routes';
import { createApiRouter } from './routes/index';

// Initialize AI Provider (if configured)
import { AIProviderFactory, AIProviderType } from './services/ai/providers/AIProviderFactory';

if (process.env.AI_PROVIDER && process.env.AI_ENABLED === 'true') {
  try {
    AIProviderFactory.initialize({
      type: process.env.AI_PROVIDER as AIProviderType,
      apiKey: process.env.AI_API_KEY,
      model: process.env.AI_MODEL,
      baseUrl: process.env.AI_BASE_URL,
    });

    logInfo(`AI Provider initialized: ${AIProviderFactory.getProviderInfo()?.name}`);
  } catch (error: unknown) {
    logWarn(`AI Provider initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    logWarn('AI features will be disabled. Check your AI configuration.');
  }
} else {
  logInfo('AI features disabled (AI_ENABLED=false or AI_PROVIDER not set)');
}

// Create Express app
const app: Application = express();

// Initialize Sentry for error tracking (must be called early)
initializeSentry(app);

// CORS Configuration - MUST come before helmet and other middleware
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:5177',
      'http://localhost:5178',
      'http://192.168.1.24:5173',
      'http://192.168.1.24:5174',
      process.env.FRONTEND_URL || 'http://localhost:5173',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // X-Page-Route: the screen a request came from (empty-search attribution in AI Insights)
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Page-Route'],
    exposedHeaders: ['Content-Disposition'],
  })
);

// Security: Helmet - secure HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:', 'http://localhost:*'],
        connectSrc: ["'self'", 'http://localhost:*', 'https:'],
        fontSrc: ["'self'", 'https:', 'data:'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: false,
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  })
);

// Response compression
app.use(
  compression({
    threshold: 1024,
    level: 6,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  })
);

// Security: Rate limiting (general)
app.use(generalLimiter);

// Request timeout middleware
app.use(connectTimeout('120s'));

// Handle timeout errors
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.timedout) next();
});

// HTTP Request logger
app.use(httpLogger);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Express 5 / body-parser 2 leave `req.body === undefined` when a request carries no body at all
// (body-parser 1.x set `{}`). Plenty of action endpoints legitimately POST with no payload — Confirm,
// Approve, Reject, Retry — and on an absent body BOTH consumers break: `validateBody(z.object({…}))`
// answers 400 "Invalid request data" even when every field is optional, and any controller doing
// `const { x } = req.body` throws a TypeError 500. That is how `POST /sale-orders/:id/confirm` 400'd
// on every click and no sale order was ever confirmed.
//
// Restore the body-parser 1.x contract once, here, rather than per-schema — the per-schema workaround
// (see `cancelOrderSchema` in schemas/order.schema.ts) has to be remembered at every new route, and
// six others were still missing it. A schema with REQUIRED fields still rejects `{}`, and does so
// with useful field-level errors instead of a bare "expected object, received undefined".
app.use((req, _res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

// Response transformation middleware
app.use(transformResponse);

// Serve static files (uploaded images) with CORS headers
app.use('/uploads', (req, res, next) => {
  const origin = req.get('origin') || '*';
  res.set({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Cross-Origin-Opener-Policy': 'unsafe-none',
  });
  next();
});

// Buyer PO documents are the customer's own commercial paperwork — prices, terms, destinations —
// so they need a login. This is the ONLY upload prefix that is not world-readable; style images,
// CAD files, lace images and issue screenshots keep exactly today's public behaviour.
//
// Mounted BEFORE the global guard below, because that one runs in 'public' mode by default and
// calls next() unconditionally — ordering this first means the PO path's protection never depends
// on FILE_ACCESS_MODE. It sits AFTER the CORS block above so a 401 still carries the CORS headers
// and the browser reports the real status instead of an opaque failure.
//
// Do NOT "simplify" this by setting FILE_ACCESS_MODE=authenticated globally: that would 401 every
// image the app opens in a new tab.
app.use('/uploads/po-documents', createFileAccessMiddleware('authenticated'));

// File access control middleware
app.use('/uploads', fileAccessMiddleware);

app.use(
  '/uploads',
  express.static(path.join(__dirname, '../uploads'), {
    maxAge: '7d',
    etag: true,
    lastModified: true,
  })
);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Kashaya Fabs ERP API',
    version: '1.0.0',
    status: 'running',
  });
});

// Health check endpoints
app.use('/health', healthRoutes);

// API Documentation (Swagger UI)
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Kashaya Fabs ERP API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
    },
  })
);

// API info endpoint
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'Kashaya Fabs ERP API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      documentation: '/api-docs',
      auth: '/api/auth',
      users: '/api/users',
      customers: '/api/customers',
      suppliers: '/api/suppliers',
      materials: '/api/materials',
      styles: '/api/styles',
      orders: '/api/orders',
      bom: '/api/bom',
      styleCosting: '/api/style-costing',
      dashboard: '/api/dashboard',
    },
  });
});

// Create versioned API router
const apiRouter = createApiRouter();

// API Routes - Support both versioned (/api/v1/) and legacy (/api/) prefixes
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter);

// 404 handler - catches all undefined routes
app.use(notFoundHandler);

// Sentry error handler - captures errors before they reach our handler
// Must be after routes and before other error handlers
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Global error handler - must be last middleware
app.use(errorHandler);

export default app;
