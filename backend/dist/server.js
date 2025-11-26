"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Server entry point
// CRITICAL: Import database config FIRST to force local database URL
const database_1 = __importDefault(require("./config/database"));
const app_1 = __importDefault(require("./app"));
const logger_1 = require("./utils/logger");
const PORT = process.env.PORT || 5000;
// Test database connection
async function testDatabaseConnection() {
    try {
        await database_1.default.$connect();
        (0, logger_1.logInfo)('✅ Database connected successfully');
        // Run a simple query to verify
        const result = await database_1.default.$queryRaw `SELECT current_database(), current_user`;
        (0, logger_1.logInfo)('📊 Database info:', result);
    }
    catch (error) {
        (0, logger_1.logError)('❌ Database connection failed:', error);
        process.exit(1);
    }
}
// Start server
async function startServer() {
    try {
        // Test database connection first
        await testDatabaseConnection();
        // Start Express server
        const server = app_1.default.listen(PORT, () => {
            (0, logger_1.logInfo)('');
            (0, logger_1.logInfo)('🏭 Kashaya Fabs ERP - Backend Server');
            (0, logger_1.logInfo)('================================');
            (0, logger_1.logInfo)(`🚀 Server running on: http://localhost:${PORT}`);
            (0, logger_1.logInfo)(`📋 Health check: http://localhost:${PORT}/health`);
            (0, logger_1.logInfo)(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
            (0, logger_1.logInfo)('================================');
            (0, logger_1.logInfo)('');
        });
        // Keep the server instance to prevent immediate exit
        return server;
    }
    catch (error) {
        (0, logger_1.logError)('Failed to start server:', error);
        process.exit(1);
    }
}
// Store server instance for graceful shutdown
let server;
// Handle shutdown gracefully
process.on('SIGINT', async () => {
    (0, logger_1.logInfo)('\n🛑 Shutting down gracefully...');
    if (server) {
        server.close(() => {
            (0, logger_1.logInfo)('Server closed');
        });
    }
    await database_1.default.$disconnect();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    (0, logger_1.logInfo)('\n🛑 Shutting down gracefully...');
    if (server) {
        server.close(() => {
            (0, logger_1.logInfo)('Server closed');
        });
    }
    await database_1.default.$disconnect();
    process.exit(0);
});
// Start the server and store the instance
startServer().then((serverInstance) => {
    server = serverInstance;
}).catch((error) => {
    (0, logger_1.logError)('Failed to start server:', error);
    process.exit(1);
});
