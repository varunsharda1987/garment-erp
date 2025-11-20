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
// Load environment variables from backend/.env (local takes priority)
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env.local') });
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
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
        console.log('✅ AI Provider initialized:', AIProviderFactory_1.AIProviderFactory.getProviderInfo()?.name);
    }
    catch (error) {
        console.warn('⚠️  AI Provider initialization failed:', error.message);
        console.warn('   AI features will be disabled. Check your AI configuration.');
    }
}
else {
    console.log('ℹ️  AI features disabled (AI_ENABLED=false or AI_PROVIDER not set)');
}
// Create Express app
const app = (0, express_1.default)();
// Middleware
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
}));
// Request logger
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
    next();
});
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Response transformation middleware - converts snake_case to camelCase
const transform_middleware_1 = require("./middleware/transform.middleware");
app.use(transform_middleware_1.transformResponse);
// Serve static files (uploaded images)
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
// API Routes
app.get('/api', (req, res) => {
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
// API Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/styles', style_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
app.use('/api/customers', customer_routes_1.default);
app.use('/api/suppliers', supplier_routes_1.default);
app.use('/api/materials', material_routes_1.default);
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
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    });
});
exports.default = app;
