/**
 * Issue Report Routes
 *
 * POST /            — any authenticated user submits an issue (multipart: screenshot optional)
 * GET  /my          — user's own reports
 * GET  /open-count  — admin badge count
 * GET  /            — admin list with status filter
 * GET  /:id         — admin detail
 * PATCH /:id        — admin updates status / notes
 */

import { Router } from 'express';
import { issueReportController } from '../controllers/issue-report.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { uploadIssueScreenshot } from '../middleware/upload.middleware';
import {
  createIssueReportSchema,
  updateIssueReportSchema,
  issueReportQuerySchema,
} from '../schemas/issueReport.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

router.use(authenticateToken);

// Any authenticated user: submit an issue.
// Multer MUST run before validateBody — it is what populates req.body for multipart requests.
router.post(
  '/',
  uploadIssueScreenshot,
  validateBody(createIssueReportSchema),
  asyncHandler(issueReportController.create.bind(issueReportController))
);

// Own reports (declare before /:id)
router.get('/my', asyncHandler(issueReportController.getMyReports.bind(issueReportController)));

// Admin: open count for badge (declare before /:id)
router.get(
  '/open-count',
  authorize('ADMIN'),
  asyncHandler(issueReportController.getOpenCount.bind(issueReportController))
);

// Admin: list all
router.get(
  '/',
  authorize('ADMIN'),
  validateQuery(issueReportQuerySchema),
  asyncHandler(issueReportController.getAll.bind(issueReportController))
);

// Admin: detail
router.get(
  '/:id',
  authorize('ADMIN'),
  validateParams(idParamSchema),
  asyncHandler(issueReportController.getById.bind(issueReportController))
);

// Admin: update status / notes (PUT alias kept for the persistence smoke suite)
router.patch(
  '/:id',
  authorize('ADMIN'),
  validateParams(idParamSchema),
  validateBody(updateIssueReportSchema),
  asyncHandler(issueReportController.update.bind(issueReportController))
);
router.put(
  '/:id',
  authorize('ADMIN'),
  validateParams(idParamSchema),
  validateBody(updateIssueReportSchema),
  asyncHandler(issueReportController.update.bind(issueReportController))
);

export default router;
