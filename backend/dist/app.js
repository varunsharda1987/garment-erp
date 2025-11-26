"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Main Express application setup
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./config/swagger");
// Load environment variables from backend/.env (local takes priority)
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env.local') });
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
// Import logger
const logger_1 = require("./utils/logger");
// Initialize AI Provider (if configured)
const AIProviderFactory_1 = require("./services/ai/providers/AIProviderFactory");
if (process.env.AI_PROVIDER && process.env.AI_ENABLED === 'true') {
    try {
        AIProviderFactory_1.AIProviderFactory.initialize({
            type: process.env.AI_PROVIDER,
            apiKey: process.env.AI_API_KEY,
            model: process.env.AI_MODEL,
            baseUrl: process.env.AI_BASE_URL,
        });
        (0, logger_1.logInfo)(`AI Provider initialized: ${AIProviderFactory_1.AIProviderFactory.getProviderInfo()?.name}`);
    }
    catch (error) {
        (0, logger_1.logWarn)(`AI Provider initialization failed: ${error.message}`);
        (0, logger_1.logWarn)('AI features will be disabled. Check your AI configuration.');
    }
}
else {
    (0, logger_1.logInfo)('AI features disabled (AI_ENABLED=false or AI_PROVIDER not set)');
}
const security_middleware_1 = require("./middleware/security.middleware");
// Create Express app
const app = (0, express_1.default)();
// CORS Configuration - MUST come before helmet and other middleware
app.use((0, cors_1.default)({
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
app.use(security_middleware_1.generalLimiter);
// HTTP Request logger
const logging_middleware_1 = require("./middleware/logging.middleware");
app.use(logging_middleware_1.httpLogger);
// Body parsing
app.use(express_1.default.json({ limit: '10mb' })); // Set reasonable limit
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Response transformation middleware - converts snake_case to camelCase
const transform_middleware_1 = require("./middleware/transform.middleware");
app.use(transform_middleware_1.transformResponse);
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
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Kashaya Fabs ERP API',
        version: '1.0.0',
        status: 'running',
    });
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Kashaya Fabs ERP API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    });
});
// API Documentation (Swagger UI)
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec, {
    customSiteTitle: 'Kashaya Fabs ERP API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
        persistAuthorization: true,
    },
}));
// API Routes
app.get('/api', (req, res) => {
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
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const style_routes_1 = __importDefault(require("./routes/style.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const customer_routes_1 = __importDefault(require("./routes/customer.routes"));
const supplier_routes_1 = __importDefault(require("./routes/supplier.routes"));
const material_routes_1 = __importDefault(require("./routes/material.routes"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
const bom_routes_1 = __importDefault(require("./routes/bom.routes"));
const styleCosting_routes_1 = __importDefault(require("./routes/styleCosting.routes"));
// Financial Management Routes
const chartOfAccounts_routes_1 = __importDefault(require("./routes/chartOfAccounts.routes"));
const taxMasters_routes_1 = __importDefault(require("./routes/taxMasters.routes"));
const paymentTerms_routes_1 = __importDefault(require("./routes/paymentTerms.routes"));
const currencies_routes_1 = __importDefault(require("./routes/currencies.routes"));
const costCenters_routes_1 = __importDefault(require("./routes/costCenters.routes"));
const expenseTypes_routes_1 = __importDefault(require("./routes/expenseTypes.routes"));
const bankAccounts_routes_1 = __importDefault(require("./routes/bankAccounts.routes"));
// Import/Export Routes (Phase 1.5)
const export_routes_1 = __importDefault(require("./routes/export.routes"));
const import_routes_1 = __importDefault(require("./routes/import.routes"));
const template_routes_1 = __importDefault(require("./routes/template.routes"));
// Inventory & Warehouse Management Routes (Phase 3)
const warehouse_routes_1 = __importDefault(require("./routes/warehouse.routes"));
const stockLevel_routes_1 = __importDefault(require("./routes/stockLevel.routes"));
const stockMovement_routes_1 = __importDefault(require("./routes/stockMovement.routes"));
const stockCount_routes_1 = __importDefault(require("./routes/stockCount.routes"));
// Production Planning Routes (Phase 5.4)
const workOrder_routes_1 = __importDefault(require("./routes/workOrder.routes"));
// Fabric & Greige Management Routes (Phase 1A)
const fabric_greige_routes_1 = __importDefault(require("./routes/fabric-greige.routes"));
// Fabric Lifecycle Management Routes (Phase 3)
const fabric_procurement_routes_1 = __importDefault(require("./routes/fabric-procurement.routes"));
const fabric_stock_routes_1 = __importDefault(require("./routes/fabric-stock.routes"));
const fabric_processing_routes_1 = __importDefault(require("./routes/fabric-processing.routes"));
// AI Routes
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
// Style Import & Stock Routes
const style_import_routes_1 = __importDefault(require("./routes/style-import.routes"));
const greige_stock_routes_1 = __importDefault(require("./routes/greige-stock.routes"));
// Material Master Routes (Phase 1)
const lace_routes_1 = __importDefault(require("./routes/lace.routes"));
const button_routes_1 = __importDefault(require("./routes/button.routes"));
const thread_routes_1 = __importDefault(require("./routes/thread.routes"));
const zipper_routes_1 = __importDefault(require("./routes/zipper.routes"));
const elastic_routes_1 = __importDefault(require("./routes/elastic.routes"));
const label_routes_1 = __importDefault(require("./routes/label.routes"));
const packaging_routes_1 = __importDefault(require("./routes/packaging.routes"));
const style_material_bom_routes_1 = __importDefault(require("./routes/style-material-bom.routes")); // Phase 2: Style Material BOM
// API Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/styles', style_routes_1.default);
app.use('/api/styles', style_import_routes_1.default); // Style import and stock management
app.use('/api/greige', greige_stock_routes_1.default); // Greige stock management
app.use('/api/dashboard', dashboard_routes_1.default);
app.use('/api/customers', customer_routes_1.default);
app.use('/api/suppliers', supplier_routes_1.default);
// Material Master Routes (Phase 1) - MUST come before general materials route
app.use('/api/materials/lace', lace_routes_1.default); // Material Master - Lace (Phase 1)
app.use('/api/materials/button', button_routes_1.default); // Material Master - Button (Phase 1)
app.use('/api/materials/thread', thread_routes_1.default); // Material Master - Thread (Phase 1)
app.use('/api/materials/zipper', zipper_routes_1.default); // Material Master - Zipper (Phase 1)
app.use('/api/materials/elastic', elastic_routes_1.default); // Material Master - Elastic (Phase 1)
app.use('/api/materials/label', label_routes_1.default); // Material Master - Label (Phase 1)
app.use('/api/materials/packaging', packaging_routes_1.default); // Material Master - Packaging (Phase 1)
app.use('/api/materials', material_routes_1.default);
app.use('/api/styles', style_material_bom_routes_1.default); // Phase 2: Style Material BOM (must be registered before style routes)
app.use('/api/orders', order_routes_1.default);
app.use('/api/bom', bom_routes_1.default);
app.use('/api/style-costing', styleCosting_routes_1.default);
// Financial Management Routes
app.use('/api/chart-of-accounts', chartOfAccounts_routes_1.default);
app.use('/api/tax-masters', taxMasters_routes_1.default);
app.use('/api/payment-terms', paymentTerms_routes_1.default);
app.use('/api/currencies', currencies_routes_1.default);
app.use('/api/cost-centers', costCenters_routes_1.default);
app.use('/api/expense-types', expenseTypes_routes_1.default);
app.use('/api/bank-accounts', bankAccounts_routes_1.default);
// Import/Export Routes (Phase 1.5)
app.use('/api/export', export_routes_1.default);
app.use('/api/import', import_routes_1.default);
app.use('/api/templates', template_routes_1.default);
// Inventory & Warehouse Management Routes (Phase 3)
app.use('/api/warehouses', warehouse_routes_1.default);
app.use('/api/stock-levels', stockLevel_routes_1.default);
app.use('/api/stock-movements', stockMovement_routes_1.default);
app.use('/api/stock-counts', stockCount_routes_1.default);
// Production Planning Routes (Phase 5.4)
app.use('/api/work-orders', workOrder_routes_1.default);
// Fabric & Greige Management Routes (Phase 1A)
app.use('/api/fabric-management', fabric_greige_routes_1.default);
// Fabric Lifecycle Management Routes (Phase 3)
app.use('/api/procurement', fabric_procurement_routes_1.default);
app.use('/api/stock', fabric_stock_routes_1.default);
app.use('/api/processing', fabric_processing_routes_1.default);
// AI Routes
app.use('/api/ai', ai_routes_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
    });
});
// Error handler
app.use((err, req, res, next) => {
    (0, logger_1.logError)('Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    });
});
exports.default = app;
