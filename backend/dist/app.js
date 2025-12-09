"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Main Express application setup
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./config/swagger");
const helmet_1 = __importDefault(require("helmet"));
const connect_timeout_1 = __importDefault(require("connect-timeout"));
// Load environment variables from backend/.env (local takes priority)
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env.local') });
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
// Import logger
const logger_1 = require("./utils/logger");
// Import all middleware
const security_middleware_1 = require("./middleware/security.middleware");
const error_middleware_1 = require("./middleware/error.middleware");
const file_access_middleware_1 = require("./middleware/file-access.middleware");
const logging_middleware_1 = require("./middleware/logging.middleware");
const transform_middleware_1 = require("./middleware/transform.middleware");
// Import all route handlers
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const index_1 = require("./routes/index");
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
        (0, logger_1.logWarn)(`AI Provider initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        (0, logger_1.logWarn)('AI features will be disabled. Check your AI configuration.');
    }
}
else {
    (0, logger_1.logInfo)('AI features disabled (AI_ENABLED=false or AI_PROVIDER not set)');
}
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
app.use((0, helmet_1.default)({
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
app.use((0, compression_1.default)({
    threshold: 1024,
    level: 6,
    filter: (req, res) => {
        if (req.headers['x-no-compression'])
            return false;
        return compression_1.default.filter(req, res);
    },
}));
// Security: Rate limiting (general)
app.use(security_middleware_1.generalLimiter);
// Request timeout middleware
app.use((0, connect_timeout_1.default)('120s'));
// Handle timeout errors
app.use((req, res, next) => {
    if (!req.timedout)
        next();
});
// HTTP Request logger
app.use(logging_middleware_1.httpLogger);
// Body parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Response transformation middleware
app.use(transform_middleware_1.transformResponse);
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
app.use('/uploads', file_access_middleware_1.fileAccessMiddleware);
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads'), {
    maxAge: '7d',
    etag: true,
    lastModified: true,
}));
// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Kashaya Fabs ERP API',
        version: '1.0.0',
        status: 'running',
    });
});
// Health check endpoints
app.use('/health', health_routes_1.default);
// API Documentation (Swagger UI)
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec, {
    customSiteTitle: 'Kashaya Fabs ERP API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
        persistAuthorization: true,
    },
}));
// API info endpoint
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
            styles: '/api/styles',
            orders: '/api/orders',
            bom: '/api/bom',
            styleCosting: '/api/style-costing',
            dashboard: '/api/dashboard',
        },
    });
});
// Create versioned API router
const apiRouter = (0, index_1.createApiRouter)();
// API Routes - Support both versioned (/api/v1/) and legacy (/api/) prefixes
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter);
// 404 handler - catches all undefined routes
app.use(error_middleware_1.notFoundHandler);
// Global error handler - must be last middleware
app.use(error_middleware_1.errorHandler);
exports.default = app;
