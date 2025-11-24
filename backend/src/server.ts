// Server entry point
// CRITICAL: Import database config FIRST to force local database URL
import prisma from './config/database';
import app from './app';
import { logInfo, logError } from './utils/logger';

const PORT = process.env.PORT || 5000;

// Test database connection
async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    logInfo('✅ Database connected successfully');

    // Run a simple query to verify
    const result = await prisma.$queryRaw`SELECT current_database(), current_user`;
    logInfo('📊 Database info:', result);
  } catch (error) {
    logError('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    // Test database connection first
    await testDatabaseConnection();

    // Start Express server
    const server = app.listen(PORT, () => {
      logInfo('');
      logInfo('🏭 Kashaya Fabs ERP - Backend Server');
      logInfo('================================');
      logInfo(`🚀 Server running on: http://localhost:${PORT}`);
      logInfo(`📋 Health check: http://localhost:${PORT}/health`);
      logInfo(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      logInfo('================================');
      logInfo('');
    });

    // Keep the server instance to prevent immediate exit
    return server;
  } catch (error) {
    logError('Failed to start server:', error);
    process.exit(1);
  }
}

// Store server instance for graceful shutdown
let server: any;

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  logInfo('\n🛑 Shutting down gracefully...');
  if (server) {
    server.close(() => {
      logInfo('Server closed');
    });
  }
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logInfo('\n🛑 Shutting down gracefully...');
  if (server) {
    server.close(() => {
      logInfo('Server closed');
    });
  }
  await prisma.$disconnect();
  process.exit(0);
});

// Start the server and store the instance
startServer().then((serverInstance) => {
  server = serverInstance;
}).catch((error) => {
  logError('Failed to start server:', error);
  process.exit(1);
});

