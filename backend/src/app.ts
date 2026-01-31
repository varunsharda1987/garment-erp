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

// Load environment variables from backend/.env (local takes priority)
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import logger
import logger, { logInfo, logWarn, logError } from './utils/logger';

// Import all middleware
import { generalLimiter } from './middleware/security.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { fileAccessMiddleware } from './middleware/file-access.middleware';
import { httpLogger } from './middleware/logging.middleware';
import { transformResponse } from './middleware/transform.middleware';

// Import all route handlers
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import styleRoutes from './routes/style.routes';
import dashboardRoutes from './routes/dashboard.routes';
import customerRoutes from './routes/customer.routes';
import supplierRoutes from './routes/supplier.routes';
import materialRoutes from './routes/material.routes';
import orderRoutes from './routes/order.routes';
import styleCostingRoutes from './routes/styleCosting.routes';

// Financial Management Routes
import chartOfAccountsRoutes from './routes/chartOfAccounts.routes';
import taxMastersRoutes from './routes/taxMasters.routes';
import paymentTermsRoutes from './routes/paymentTerms.routes';
import currenciesRoutes from './routes/currencies.routes';
import costCentersRoutes from './routes/costCenters.routes';
import expenseTypesRoutes from './routes/expenseTypes.routes';
import bankAccountsRoutes from './routes/bankAccounts.routes';
import componentMastersRoutes from './routes/componentMasters.routes';

// Import/Export Routes (Phase 1.5)
import exportRoutes from './routes/export.routes';
import importRoutes from './routes/import.routes';
import templateRoutes from './routes/template.routes';

// Inventory & Warehouse Management Routes (Phase 3)
import warehouseRoutes from './routes/warehouse.routes';
import stockLevelRoutes from './routes/stockLevel.routes';
import stockMovementRoutes from './routes/stockMovement.routes';
import stockCountRoutes from './routes/stockCount.routes';

// Production Planning Routes (Phase 5.4)
import workOrderRoutes from './routes/workOrder.routes';

// Fabric & Greige Management Routes (Phase 1A)
import fabricGreigeRoutes from './routes/fabric-greige.routes';

// Fabric Lifecycle Management Routes (Phase 3)
import fabricProcurementRoutes from './routes/fabric-procurement.routes';
import fabricStockRoutes from './routes/fabric-stock.routes';
import fabricProcessingRoutes from './routes/fabric-processing.routes';

// AI Routes
import aiRoutes from './routes/ai.routes';

// Style Import & Stock Routes
import styleImportRoutes from './routes/style-import.routes';
import greigeStockRoutes from './routes/greige-stock.routes';

// Material Master Routes (Phase 1)
import laceRoutes from './routes/lace.routes';
import buttonRoutes from './routes/button.routes';
import threadRoutes from './routes/thread.routes';
import zipperRoutes from './routes/zipper.routes';
import elasticRoutes from './routes/elastic.routes';
import labelRoutes from './routes/label.routes';
import packagingRoutes from './routes/packaging.routes';
import styleMaterialBOMRoutes from './routes/style-material-bom.routes';
import customerAccessoriesRoutes from './routes/customer-accessories.routes';
import styleCADPlanningRoutes from './routes/style-cad-planning.routes';
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

// CORS Configuration - MUST come before helmet and other middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5177',
    'http://localhost:5178',
    process.env.FRONTEND_URL || 'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition'],
}));

// Security: Helmet - secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http://localhost:*"],
      connectSrc: ["'self'", "http://localhost:*", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
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
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));

// Response compression
app.use(compression({
  threshold: 1024,
  level: 6,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

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

// File access control middleware
app.use('/uploads', fileAccessMiddleware);

app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '7d',
  etag: true,
  lastModified: true,
}));

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
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Kashaya Fabs ERP API Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true,
  },
}));

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

// Global error handler - must be last middleware
app.use(errorHandler);

export default app;
