/**
 * Health Check and Monitoring Routes
 *
 * Provides endpoints for application health, readiness, and liveness checks.
 * Used by container orchestrators and monitoring systems.
 */

import { Router, Request, Response } from 'express';
import os from 'os';
import { version } from '../../package.json';
import { logError } from '../utils/logger';
import prisma from '../config/database';
import { runAllCleanupTasks } from '../services/file-cleanup.service';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Application is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 */
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Kashaya Fabs ERP API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version,
  });
});

/**
 * @swagger
 * /health/readiness:
 *   get:
 *     summary: Readiness check
 *     description: Checks if application is ready to accept traffic (database connection, etc.)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Application is ready
 *       503:
 *         description: Application is not ready
 */
interface HealthCheck {
  status: 'up' | 'down' | 'degraded';
  responseTime?: string;
  warning?: string;
  error?: string;
}

router.get('/readiness', asyncHandler(async (req: Request, res: Response) => {
  const checks: Record<string, HealthCheck> = {};

  try {
    // Check database connection
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbDuration = Date.now() - dbStart;

    checks.database = {
      status: 'up',
      responseTime: `${dbDuration}ms`,
    };

    // Check if database is too slow
    if (dbDuration > 5000) {
      checks.database.status = 'degraded';
      checks.database.warning = 'Slow response time';
    }
  } catch (error: unknown) {
    checks.database = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Overall status
  const isHealthy = Object.values(checks).every(
    (check) => check.status === 'up' || check.status === 'degraded'
  );

  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
  });
}));

/**
 * @swagger
 * /health/liveness:
 *   get:
 *     summary: Liveness check
 *     description: Checks if application is alive (simple ping)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Application is alive
 */
router.get('/liveness', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: Application metrics
 *     description: Returns system and application metrics
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Metrics data
 */
router.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
  // System metrics
  const systemMetrics = {
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    cpus: os.cpus().length,
    totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
    freeMemory: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
    uptime: `${Math.round(os.uptime())}s`,
  };

  // Process metrics
  const memUsage = process.memoryUsage();
  const processMetrics = {
    pid: process.pid,
    uptime: `${Math.round(process.uptime())}s`,
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
    },
  };

  // Database metrics
  interface DbCountResult {
    users_count?: number;
    customers_count?: number;
    suppliers_count?: number;
    orders_count?: number;
  }
  let databaseMetrics: { responseTime?: string; counts?: DbCountResult; error?: string } = {};
  try {
    const dbStart = Date.now();
    const result = await prisma.$queryRaw<DbCountResult[]>`
      SELECT
        (SELECT count(*) FROM "Users") as users_count,
        (SELECT count(*) FROM "Customers") as customers_count,
        (SELECT count(*) FROM "Suppliers") as suppliers_count,
        (SELECT count(*) FROM "Orders") as orders_count
    `;
    const dbDuration = Date.now() - dbStart;

    databaseMetrics = {
      responseTime: `${dbDuration}ms`,
      counts: result[0] || {},
    };
  } catch (error: unknown) {
    databaseMetrics = {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  res.status(200).json({
    timestamp: new Date().toISOString(),
    version,
    environment: process.env.NODE_ENV || 'development',
    system: systemMetrics,
    process: processMetrics,
    database: databaseMetrics,
  });
}));

/**
 * @swagger
 * /health/version:
 *   get:
 *     summary: Application version
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Version information
 */
router.get('/version', (req: Request, res: Response) => {
  res.status(200).json({
    version,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * @swagger
 * /health/cleanup:
 *   post:
 *     summary: Run file cleanup tasks
 *     description: Removes orphaned files and old temp files
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Cleanup results
 */
router.post('/cleanup', asyncHandler(async (req: Request, res: Response) => {
  const results = await runAllCleanupTasks();
  res.status(200).json({
    status: 'success',
    timestamp: new Date().toISOString(),
    results,
  });
}));

export default router;
