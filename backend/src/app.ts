// Main Express application setup
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

// Load environment variables from backend/.env (local takes priority)
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import logger
import logger, { logInfo, logWarn, logError } from './utils/logger';

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
  } catch (error: any) {
    logWarn(`AI Provider initialization failed: ${error.message}`);
    logWarn('AI features will be disabled. Check your AI configuration.');
  }
} else {
  logInfo('AI features disabled (AI_ENABLED=false or AI_PROVIDER not set)');
}

// Security middleware
import helmet from 'helmet';
import { generalLimiter } from './middleware/security.middleware';

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
// Temporarily disabled to fix CORS issues with static files
// TODO: Re-enable helmet with proper configuration
// const helmetMiddleware = helmet({
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'"],
//       styleSrc: ["'self'", "'unsafe-inline'"],
//       scriptSrc: ["'self'"],
//       imgSrc: ["'self'", "data:", "https:"],
//     },
//   },
//   crossOriginEmbedderPolicy: false,
//   crossOriginOpenerPolicy: false,
//   crossOriginResourcePolicy: false,
// });
// app.use(helmetMiddleware);

// Security: Rate limiting (general)
app.use(generalLimiter);

// HTTP Request logger
import { httpLogger } from './middleware/logging.middleware';
app.use(httpLogger);

// Body parsing
app.use(express.json({ limit: '10mb' })); // Set reasonable limit
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Response transformation middleware - converts snake_case to camelCase
import { transformResponse } from './middleware/transform.middleware';
app.use(transformResponse);

// Serve static files (uploaded images) with CORS headers
// Set headers before static middleware to ensure they're sent
app.use('/uploads', (req, res, next) => {
  // Set CORS headers for static files
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

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Kashaya Fabs ERP API',
    version: '1.0.0',
    status: 'running',
  });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Kashaya Fabs ERP API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API Documentation (Swagger UI)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Kashaya Fabs ERP API Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true,
  },
}));

// API Routes
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
      lace: '/api/materials/lace',
      button: '/api/materials/button',
      thread: '/api/materials/thread',
      zipper: '/api/materials/zipper',
      elastic: '/api/materials/elastic',
      label: '/api/materials/label',
      packaging: '/api/materials/packaging',
      styles: '/api/styles',
      orders: '/api/orders',
      bom: '/api/bom',
      styleCosting: '/api/style-costing',
      dashboard: '/api/dashboard',
      // Financial Management
      chartOfAccounts: '/api/chart-of-accounts',
      taxMasters: '/api/tax-masters',
      paymentTerms: '/api/payment-terms',
      currencies: '/api/currencies',
      costCenters: '/api/cost-centers',
      expenseTypes: '/api/expense-types',
      bankAccounts: '/api/bank-accounts',
      componentMasters: '/api/component-masters',
      // Import/Export (Phase 1.5)
      export: '/api/export/:module',
      import: '/api/import/:module',
      templates: '/api/templates',
      // Inventory & Warehouse Management (Phase 3)
      warehouses: '/api/warehouses',
      stockLevels: '/api/stock-levels',
      stockMovements: '/api/stock-movements',
      stockCounts: '/api/stock-counts',
      // Production Planning (Phase 5.4)
      workOrders: '/api/work-orders',
      // Fabric & Greige Management (Phase 1A)
      greigeMasters: '/api/fabric-management/greige',
      fabricMasters: '/api/fabric-management/fabric',
      fabricCADs: '/api/fabric-management/cad',
    },
  });
});

// Import route handlers
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import styleRoutes from './routes/style.routes';
import dashboardRoutes from './routes/dashboard.routes';
import customerRoutes from './routes/customer.routes';
import supplierRoutes from './routes/supplier.routes';
import materialRoutes from './routes/material.routes';
import orderRoutes from './routes/order.routes';
import bomRoutes from './routes/bom.routes';
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
import styleMaterialBOMRoutes from './routes/style-material-bom.routes'; // Phase 2: Style Material BOM

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/styles', styleRoutes);
app.use('/api/styles', styleImportRoutes); // Style import and stock management
app.use('/api/greige', greigeStockRoutes); // Greige stock management
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
// Material Master Routes (Phase 1) - MUST come before general materials route
app.use('/api/materials/lace', laceRoutes); // Material Master - Lace (Phase 1)
app.use('/api/materials/button', buttonRoutes); // Material Master - Button (Phase 1)
app.use('/api/materials/thread', threadRoutes); // Material Master - Thread (Phase 1)
app.use('/api/materials/zipper', zipperRoutes); // Material Master - Zipper (Phase 1)
app.use('/api/materials/elastic', elasticRoutes); // Material Master - Elastic (Phase 1)
app.use('/api/materials/label', labelRoutes); // Material Master - Label (Phase 1)
app.use('/api/materials/packaging', packagingRoutes); // Material Master - Packaging (Phase 1)
app.use('/api/materials', materialRoutes);
app.use('/api/styles', styleMaterialBOMRoutes); // Phase 2: Style Material BOM (must be registered before style routes)
app.use('/api/orders', orderRoutes);
app.use('/api/bom', bomRoutes);
app.use('/api/style-costing', styleCostingRoutes);

// Financial Management Routes
app.use('/api/chart-of-accounts', chartOfAccountsRoutes);
app.use('/api/tax-masters', taxMastersRoutes);
app.use('/api/payment-terms', paymentTermsRoutes);
app.use('/api/currencies', currenciesRoutes);
app.use('/api/cost-centers', costCentersRoutes);
app.use('/api/expense-types', expenseTypesRoutes);
app.use('/api/bank-accounts', bankAccountsRoutes);
app.use('/api/component-masters', componentMastersRoutes);

// Import/Export Routes (Phase 1.5)
app.use('/api/export', exportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/templates', templateRoutes);

// Inventory & Warehouse Management Routes (Phase 3)
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/stock-levels', stockLevelRoutes);
app.use('/api/stock-movements', stockMovementRoutes);
app.use('/api/stock-counts', stockCountRoutes);

// Production Planning Routes (Phase 5.4)
app.use('/api/work-orders', workOrderRoutes);

// Fabric & Greige Management Routes (Phase 1A)
app.use('/api/fabric-management', fabricGreigeRoutes);

// Fabric Lifecycle Management Routes (Phase 3)
app.use('/api/procurement', fabricProcurementRoutes);
app.use('/api/stock', fabricStockRoutes);
app.use('/api/processing', fabricProcessingRoutes);

// AI Routes
app.use('/api/ai', aiRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logError('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

export default app;

