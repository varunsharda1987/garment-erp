import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  createStitchingIssueSchema,
  updateStitchingIssueSchema,
  receiveFromCuttingSchema,
  recordStitchingOutputSchema,
  disposeDefectsSchema,
  stitchingIssueQuerySchema,
} from '../schemas/production.schema';
import {
  // Stitching Issue endpoints
  getAllStitchingIssues,
  getStitchingIssueById,
  createStitchingIssue,
  updateStitchingIssue,
  deleteStitchingIssue,
  // Workflow actions
  receiveFromCutting,
  startStitchingIssue,
  recordDailyOutput,
  completeStitchingIssue,
  reopenStitchingIssue,
  generateTransferSlip,
  // Summary endpoints
  getSummary,
  getSummaryByWorkOrder,
  getSummaryByManager,
  getStyleSizeSummary,
  getAvailableTransferSlips,
  getAvailableManagers,
  disposeDefects,
} from '../controllers/stitching.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// SUMMARY ROUTES (must be before parameterized routes)
// ============================================
router.get('/summary', asyncHandler(getSummary));
router.get('/summary/work-order/:workOrderId', asyncHandler(getSummaryByWorkOrder));
router.get('/summary/manager/:managerId', asyncHandler(getSummaryByManager));
router.get('/style-size-summary', asyncHandler(getStyleSizeSummary));
router.get('/pending-transfer-slips', asyncHandler(getAvailableTransferSlips));
router.get('/available-managers', asyncHandler(getAvailableManagers));

// ============================================
// STITCHING ISSUE ROUTES
// ============================================

// List and CRUD
router.get('/issues', validateQuery(stitchingIssueQuerySchema), asyncHandler(getAllStitchingIssues));
router.get('/issues/:id', asyncHandler(getStitchingIssueById));
router.post('/issues', validateBody(createStitchingIssueSchema), asyncHandler(createStitchingIssue));
router.put('/issues/:id', validateBody(updateStitchingIssueSchema), asyncHandler(updateStitchingIssue));
router.delete('/issues/:id', asyncHandler(deleteStitchingIssue));

// Workflow actions
router.post('/issues/:id/receive', validateBody(receiveFromCuttingSchema), asyncHandler(receiveFromCutting));
router.post('/issues/:id/start', asyncHandler(startStitchingIssue));
router.post('/issues/:id/daily-output', validateBody(recordStitchingOutputSchema), asyncHandler(recordDailyOutput));
router.post('/issues/:id/complete', asyncHandler(completeStitchingIssue));
router.post('/issues/:id/reopen', asyncHandler(reopenStitchingIssue));
router.post('/issues/:id/generate-transfer-slip', asyncHandler(generateTransferSlip));
router.post('/issues/:id/dispose-defects', validateBody(disposeDefectsSchema), asyncHandler(disposeDefects));

export default router;
