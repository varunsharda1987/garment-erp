/**
 * Audit Log Routes
 *
 * API endpoints for viewing audit logs
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import {
  getAuditLogsForEntity,
  getAuditLogsByUser,
  getRecentAuditLogs,
} from '../services/audit.service';
import { logError } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * /api/audit:
 *   get:
 *     summary: Get recent audit logs
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of audit logs
 */
router.get('/', authenticateToken, authorize('ADMIN', 'PRODUCTION_MANAGER'), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const entityType = req.query.entityType as string | undefined;
    const action = req.query.action as string | undefined;

    const logs = await getRecentAuditLogs({ limit, entityType, action });

    res.status(200).json({
      data: logs,
      pagination: {
        limit,
      },
    });
  } catch (error) {
    logError('Error fetching audit logs:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch audit logs',
    });
  }
});

/**
 * @swagger
 * /api/audit/entity/{entityType}/{entityId}:
 *   get:
 *     summary: Get audit logs for a specific entity
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Audit logs for the entity
 */
router.get(
  '/entity/:entityType/:entityId',
  authenticateToken,
  authorize('ADMIN', 'PRODUCTION_MANAGER'),
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const { logs, total } = await getAuditLogsForEntity(entityType, entityId, { limit, offset });

      res.status(200).json({
        data: logs,
        pagination: {
          page: Math.floor(offset / limit) + 1,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logError('Error fetching entity audit logs:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch audit logs',
      });
    }
  }
);

/**
 * @swagger
 * /api/audit/user/{userId}:
 *   get:
 *     summary: Get audit logs by user
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Audit logs by user
 */
router.get(
  '/user/:userId',
  authenticateToken,
  authorize('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const { logs, total } = await getAuditLogsByUser(userId, { limit, offset });

      res.status(200).json({
        data: logs,
        pagination: {
          page: Math.floor(offset / limit) + 1,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logError('Error fetching user audit logs:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch audit logs',
      });
    }
  }
);

export default router;
