// Main Express application setup
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from backend/.env (local takes priority)
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

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

    console.log('✅ AI Provider initialized:', AIProviderFactory.getProviderInfo()?.name);
  } catch (error: any) {
    console.warn('⚠️  AI Provider initialization failed:', error.message);
    console.warn('   AI features will be disabled. Check your AI configuration.');
  }
} else {
  console.log('ℹ️  AI features disabled (AI_ENABLED=false or AI_PROVIDER not set)');
}

// Create Express app
const app: Application = express();

// Middleware
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
}));

// Request logger
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`📨 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Response transformation middleware - converts snake_case to camelCase
import { transformResponse } from './middleware/transform.middleware';
app.use(transformResponse);

// Serve static files (uploaded images)
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

// API Routes
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'Kashaya Fabs ERP API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
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
      // Financial Management
      chartOfAccounts: '/api/chart-of-accounts',
      taxMasters: '/api/tax-masters',
      paymentTerms: '/api/payment-terms',
      currencies: '/api/currencies',
      costCenters: '/api/cost-centers',
      expenseTypes: '/api/expense-types',
      bankAccounts: '/api/bank-accounts',
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/styles', styleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/materials', materialRoutes);
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
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

export default app;
