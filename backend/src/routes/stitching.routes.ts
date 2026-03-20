import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
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
} from '../controllers/stitching.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// SUMMARY ROUTES (must be before parameterized routes)
// ============================================
router.get('/summary', getSummary);
router.get('/summary/work-order/:workOrderId', getSummaryByWorkOrder);
router.get('/summary/manager/:managerId', getSummaryByManager);
router.get('/style-size-summary', getStyleSizeSummary);
router.get('/pending-transfer-slips', getAvailableTransferSlips);
router.get('/available-managers', getAvailableManagers);

// ============================================
// STITCHING ISSUE ROUTES
// ============================================

// List and CRUD
router.get('/issues', getAllStitchingIssues);
router.get('/issues/:id', getStitchingIssueById);
router.post('/issues', createStitchingIssue);
router.put('/issues/:id', updateStitchingIssue);
router.delete('/issues/:id', deleteStitchingIssue);

// Workflow actions
router.post('/issues/:id/receive', receiveFromCutting);
router.post('/issues/:id/start', startStitchingIssue);
router.post('/issues/:id/daily-output', recordDailyOutput);
router.post('/issues/:id/complete', completeStitchingIssue);
router.post('/issues/:id/reopen', reopenStitchingIssue);
router.post('/issues/:id/generate-transfer-slip', generateTransferSlip);

export default router;
