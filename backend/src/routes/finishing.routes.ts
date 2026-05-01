import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createFinishingIssueSchema,
  updateFinishingIssueSchema,
  receiveFromStitchingSchema,
  recordFinishingOutputSchema,
  polybagEntrySchema,
  cartonPackingSchema,
  finishingIssueQuerySchema,
} from '../schemas/production.schema';
import { idParamSchema, workOrderIdParamSchema } from '../schemas/common.schema';
import {
  // Finishing Issue endpoints
  getAllFinishingIssues,
  getFinishingIssueById,
  createFinishingIssue,
  updateFinishingIssue,
  deleteFinishingIssue,
  // Workflow actions
  receiveFromStitching,
  startFinishingIssue,
  recordDailyOutput,
  moveToPackingFinishingIssue,
  completeFinishingIssue,
  generateTransferSlip,
  // Summary endpoints
  getSummary,
  getSummaryByWorkOrder,
  getAvailableTransferSlips,
  getAvailableManagers,
  getStyleSizeSummary,
  // Packing endpoints
  createPolybagEntry,
  createCartonPacking,
} from '../controllers/finishing.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// SUMMARY ROUTES (must be before parameterized routes)
// ============================================
router.get('/summary', asyncHandler(getSummary));
router.get(
  '/summary/work-order/:workOrderId',
  validateParams(workOrderIdParamSchema),
  asyncHandler(getSummaryByWorkOrder)
);
router.get('/available-transfer-slips', asyncHandler(getAvailableTransferSlips));
router.get('/available-managers', asyncHandler(getAvailableManagers));
router.get('/style-size-summary', asyncHandler(getStyleSizeSummary));

// ============================================
// FINISHING ISSUE ROUTES
// ============================================

// List and CRUD
router.get('/issues', validateQuery(finishingIssueQuerySchema), asyncHandler(getAllFinishingIssues));
router.get('/issues/:id', validateParams(idParamSchema), asyncHandler(getFinishingIssueById));
router.post('/issues', validateBody(createFinishingIssueSchema), asyncHandler(createFinishingIssue));
router.put(
  '/issues/:id',
  validateParams(idParamSchema),
  validateBody(updateFinishingIssueSchema),
  asyncHandler(updateFinishingIssue)
);
router.delete('/issues/:id', validateParams(idParamSchema), asyncHandler(deleteFinishingIssue));

// Workflow actions
router.post(
  '/issues/:id/receive',
  validateParams(idParamSchema),
  validateBody(receiveFromStitchingSchema),
  asyncHandler(receiveFromStitching)
);
router.post('/issues/:id/start', validateParams(idParamSchema), asyncHandler(startFinishingIssue));
router.post(
  '/issues/:id/record-output',
  validateParams(idParamSchema),
  validateBody(recordFinishingOutputSchema),
  asyncHandler(recordDailyOutput)
);
router.post('/issues/:id/move-to-packing', validateParams(idParamSchema), asyncHandler(moveToPackingFinishingIssue));
router.post('/issues/:id/complete', validateParams(idParamSchema), asyncHandler(completeFinishingIssue));
router.post('/issues/:id/generate-transfer-slip', validateParams(idParamSchema), asyncHandler(generateTransferSlip));

// Packing
router.post(
  '/issues/:id/polybag-entry',
  validateParams(idParamSchema),
  validateBody(polybagEntrySchema),
  asyncHandler(createPolybagEntry)
);
router.post(
  '/issues/:id/carton-packing',
  validateParams(idParamSchema),
  validateBody(cartonPackingSchema),
  asyncHandler(createCartonPacking)
);

export default router;
