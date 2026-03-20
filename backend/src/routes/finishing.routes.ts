import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
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
router.get('/summary', getSummary);
router.get('/summary/work-order/:workOrderId', getSummaryByWorkOrder);
router.get('/available-transfer-slips', getAvailableTransferSlips);
router.get('/available-managers', getAvailableManagers);
router.get('/style-size-summary', getStyleSizeSummary);

// ============================================
// FINISHING ISSUE ROUTES
// ============================================

// List and CRUD
router.get('/issues', getAllFinishingIssues);
router.get('/issues/:id', getFinishingIssueById);
router.post('/issues', createFinishingIssue);
router.put('/issues/:id', updateFinishingIssue);
router.delete('/issues/:id', deleteFinishingIssue);

// Workflow actions
router.post('/issues/:id/receive', receiveFromStitching);
router.post('/issues/:id/start', startFinishingIssue);
router.post('/issues/:id/record-output', recordDailyOutput);
router.post('/issues/:id/move-to-packing', moveToPackingFinishingIssue);
router.post('/issues/:id/complete', completeFinishingIssue);
router.post('/issues/:id/generate-transfer-slip', generateTransferSlip);

export default router;
