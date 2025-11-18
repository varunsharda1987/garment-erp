// Server entry point
// CRITICAL: Import database config FIRST to force local database URL
import prisma from './config/database';
import app from './app';

const PORT = process.env.PORT || 5000;

// Test database connection
async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Run a simple query to verify
    const result = await prisma.$queryRaw`SELECT current_database(), current_user`;
    console.log('📊 Database info:', result);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
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
      console.log('');
      console.log('🏭 Kashaya Fabs ERP - Backend Server');
      console.log('================================');
      console.log(`🚀 Server running on: http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('================================');
      console.log('');
    });

    // Keep the server instance to prevent immediate exit
    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Store server instance for graceful shutdown
let server: any;

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('Server closed');
    });
  }
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('Server closed');
    });
  }
  await prisma.$disconnect();
  process.exit(0);
});

// Start the server and store the instance
startServer().then((serverInstance) => {
  server = serverInstance;
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
