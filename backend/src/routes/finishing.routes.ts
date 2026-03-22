import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
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
} from '../controllers/finishing.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// SUMMARY ROUTES (must be before parameterized routes)
// ============================================
router.get('/summary', asyncHandler(getSummary));
router.get('/summary/work-order/:workOrderId', asyncHandler(getSummaryByWorkOrder));
router.get('/available-transfer-slips', asyncHandler(getAvailableTransferSlips));
router.get('/available-managers', asyncHandler(getAvailableManagers));
router.get('/style-size-summary', asyncHandler(getStyleSizeSummary));

// ============================================
// FINISHING ISSUE ROUTES
// ============================================

// List and CRUD
router.get('/issues', asyncHandler(getAllFinishingIssues));
router.get('/issues/:id', asyncHandler(getFinishingIssueById));
router.post('/issues', asyncHandler(createFinishingIssue));
router.put('/issues/:id', asyncHandler(updateFinishingIssue));
router.delete('/issues/:id', asyncHandler(deleteFinishingIssue));

// Workflow actions
router.post('/issues/:id/receive', asyncHandler(receiveFromStitching));
router.post('/issues/:id/start', asyncHandler(startFinishingIssue));
router.post('/issues/:id/record-output', asyncHandler(recordDailyOutput));
router.post('/issues/:id/move-to-packing', asyncHandler(moveToPackingFinishingIssue));
router.post('/issues/:id/complete', asyncHandler(completeFinishingIssue));
router.post('/issues/:id/generate-transfer-slip', asyncHandler(generateTransferSlip));

export default router;
