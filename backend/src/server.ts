// Server entry point
// Note: Environment variables are loaded via -r dotenv/config in package.json dev script
import prisma from './config/database';
import app from './app';
import { logInfo, logError } from './utils/logger';
import { cleanupOldTempFiles } from './middleware/upload.middleware';
import { initializeCache, closeCache } from './lib/cache';
import { PermissionService } from './services/permission.service';
import { systemSettingsService } from './services/system-settings.service';
import { startIdleSweep as startWhatsappIdleSweep, shutdownAll as shutdownWhatsapp } from './services/whatsapp.service';
import { closeBrowser as closePdfRenderer } from './services/html-renderer.service';
import { reclaimPort } from './utils/portReclaim';

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
    // Cleanup old temp files on startup
    cleanupOldTempFiles(24); // Remove temp files older than 24 hours
    logInfo('🧹 Cleaned up old temp files');

    // Test database connection first
    await testDatabaseConnection();

    // Ensure permissions are seeded (auto-recovers if deleted)
    await PermissionService.ensureSeeded();

    // Load system settings and seed defaults if missing
    await systemSettingsService.preloadDefaults();

    // Start the per-user WhatsApp idle-teardown sweep (sessions link lazily on first use).
    startWhatsappIdleSweep();

    // Initialize Redis cache (optional - falls back gracefully if unavailable)
    const cacheEnabled = await initializeCache();
    if (cacheEnabled) {
      logInfo('✅ Redis cache initialized');
    } else {
      logInfo('⚠️ Redis cache not available - using direct queries');
    }

    // Start Express server - bind to 0.0.0.0 for LAN access
    const server = app.listen(Number(PORT), '0.0.0.0', () => {
      logInfo('');
      logInfo('🏭 Kashaya Fabs ERP - Backend Server');
      logInfo('================================');
      logInfo(`🚀 Server running on: http://localhost:${PORT}`);
      logInfo(`🌐 LAN access: http://YOUR_IP:${PORT} (accessible from other machines)`);
      logInfo(`📋 Health check: http://localhost:${PORT}/health`);
      logInfo(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      logInfo('================================');
      logInfo('');
    });

    // EADDRINUSE self-heal for the Windows PM2 kill-race: the previous fork of this app
    // can survive a pm2 restart and keep port 5000 — reclaim it (portReclaim verifies the
    // holder really is a stale PM2 fork before killing) instead of crash-looping forever.
    // With this 'error' listener attached, EADDRINUSE no longer reaches uncaughtException.
    let reclaimAttempts = 0;
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code !== 'EADDRINUSE' || reclaimAttempts >= 3) {
        logError('HTTP server error - exiting for a clean PM2 restart:', err);
        process.exit(1);
      }
      reclaimAttempts += 1;
      logInfo(`Port ${PORT} in use - reclaim attempt ${reclaimAttempts}/3`);
      void (async () => {
        try {
          const result = await reclaimPort(Number(PORT));
          if (result === 'refused') {
            logError(`Port ${PORT} not reclaimable - exiting`);
            process.exit(1);
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
          server.listen(Number(PORT), '0.0.0.0');
        } catch (e) {
          logError('Port reclaim failed - exiting:', e);
          process.exit(1);
        }
      })();
    });

    // Keep the server instance to prevent immediate exit
    return server;
  } catch (error) {
    logError('Failed to start server:', error);
    process.exit(1);
  }
}

// Store server instance for graceful shutdown
let server: ReturnType<typeof app.listen> | undefined;

// Handle shutdown gracefully
async function gracefulShutdown(): Promise<void> {
  logInfo('\n🛑 Shutting down gracefully...');
  if (server) {
    server.close(() => {
      logInfo('Server closed');
    });
  }
  await closePdfRenderer();
  await shutdownWhatsapp();
  await closeCache();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
// PM2 on Windows signals shutdown via IPC message (ecosystem.config.js sets
// shutdown_with_message: true) — without this handler the graceful path never
// ran under PM2 restarts, which is how headless Chrome instances got orphaned.
process.on('message', (msg) => {
  if (msg === 'shutdown') void gracefulShutdown();
});

// Production-grade error handlers
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logError('⚠️ Unhandled Promise Rejection:', reason);
  // In production, you might want to track this in Sentry
  // Sentry.captureException(reason);
});

process.on('uncaughtException', (error: Error) => {
  logError('💥 Uncaught Exception - shutting down:', error);
  // In production, you might want to track this in Sentry
  // Sentry.captureException(error);
  // Graceful shutdown - give ongoing requests time to complete
  if (server) {
    server.close(() => {
      prisma.$disconnect().then(() => {
        process.exit(1);
      });
    });
    // Force exit after 30 seconds if graceful shutdown fails
    setTimeout(() => {
      logError('Forced shutdown after uncaught exception');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(1);
  }
});

// Start the server and store the instance
startServer()
  .then((serverInstance) => {
    server = serverInstance;
  })
  .catch((error) => {
    logError('Failed to start server:', error);
    process.exit(1);
  });
