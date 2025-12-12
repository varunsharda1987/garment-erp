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
  issueToManager,
  startStitchingIssue,
  recordDailyOutput,
  completeStitchingIssue,
  generateTransferSlip,
  // Summary endpoints
  getSummary,
  getSummaryByWorkOrder,
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
router.get('/available-transfer-slips', getAvailableTransferSlips);
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
router.post('/issues/:id/issue-to-manager', issueToManager);
router.post('/issues/:id/start', startStitchingIssue);
router.post('/issues/:id/record-output', recordDailyOutput);
router.post('/issues/:id/complete', completeStitchingIssue);
router.post('/issues/:id/generate-transfer-slip', generateTransferSlip);

export default router;
