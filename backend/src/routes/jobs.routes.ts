/**
 * Job Queue API Routes
 *
 * Endpoints to check job status and queue health.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { getJob, getJobStatus, getQueueStats, isQueueAvailable } from '../jobs';
import { NotFoundError } from '../errors';

const router = Router();

/**
 * @swagger
 * /jobs/status:
 *   get:
 *     summary: Check if job queue is available
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue status
 */
router.get('/status', authenticateToken, (req: Request, res: Response) => {
  res.json({
    available: isQueueAvailable(),
    message: isQueueAvailable()
      ? 'Job queue is running'
      : 'Job queue is not available (Redis not configured)',
  });
});

/**
 * @swagger
 * /jobs/stats:
 *   get:
 *     summary: Get queue statistics
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue statistics
 */
router.get(
  '/stats',
  authenticateToken,
  authorize('ADMIN', 'PRODUCTION_MANAGER'),
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await getQueueStats();

    if (!stats) {
      res.json({
        available: false,
        message: 'Queue not available',
      });
      return;
    }

    res.json({
      available: true,
      stats,
    });
  })
);

/**
 * @swagger
 * /jobs/{jobId}:
 *   get:
 *     summary: Get job status by ID
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job status
 *       404:
 *         description: Job not found
 */
router.get('/:jobId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const status = await getJobStatus(jobId);

  if (!status) {
    throw new NotFoundError('Job', jobId);
  }

  res.json({
    jobId,
    ...status,
  });
}));

/**
 * @swagger
 * /jobs/{jobId}/details:
 *   get:
 *     summary: Get full job details
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full job details
 *       404:
 *         description: Job not found
 */
router.get(
  '/:jobId/details',
  authenticateToken,
  authorize('ADMIN', 'PRODUCTION_MANAGER'),
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const job = await getJob(jobId);

    if (!job) {
      throw new NotFoundError('Job', jobId);
    }

    const state = await job.getState();

    res.json({
      id: job.id,
      name: job.name,
      data: job.data,
      state,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    });
  })
);

export default router;
