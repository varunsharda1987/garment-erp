import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  // Cutting Batch endpoints
  getAllCuttingBatches,
  getCuttingBatchById,
  createCuttingBatch,
  updateCuttingBatch,
  deleteCuttingBatch,
  // Workflow actions
  startCuttingBatch,
  recordCuttingOutput,
  completeCuttingBatch,
  holdCuttingBatch,
  resumeCuttingBatch,
  cancelCuttingBatch,
  generateTransferSlip,
  // Cutting Lays
  addCuttingLay,
  getCuttingLays,
  deleteCuttingLay,
  // Issue to Stitching
  issueToStitching,
  getStitchingIssues,
  // Summary endpoints
  getSummary,
  getSummaryByWorkOrder,
  getAvailableWorkOrders,
  getAvailableFabricStock,
  getStyleSizeSummary,
  // Chart data
  getCuttingChartData,
} from '../controllers/cutting.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// SUMMARY ROUTES (must be before parameterized routes)
// ============================================
router.get('/summary', getSummary);
router.get('/summary/work-order/:workOrderId', getSummaryByWorkOrder);
router.get('/available-work-orders', getAvailableWorkOrders);
router.get('/available-fabric-stock/:fabricId', getAvailableFabricStock);
router.get('/style-size-summary', getStyleSizeSummary);
router.get('/chart-data/:workOrderId', getCuttingChartData);

// ============================================
// CUTTING BATCH ROUTES
// ============================================

// List and CRUD
router.get('/batches', getAllCuttingBatches);
router.get('/batches/:id', getCuttingBatchById);
router.post('/batches', createCuttingBatch);
router.put('/batches/:id', updateCuttingBatch);
router.delete('/batches/:id', deleteCuttingBatch);

// Workflow actions
router.post('/batches/:id/start', startCuttingBatch);
router.post('/batches/:id/record-output', recordCuttingOutput);
router.post('/batches/:id/complete', completeCuttingBatch);
router.post('/batches/:id/hold', holdCuttingBatch);
router.post('/batches/:id/resume', resumeCuttingBatch);
router.post('/batches/:id/cancel', cancelCuttingBatch);
router.post('/batches/:id/generate-transfer-slip', generateTransferSlip);

// Cutting Lays (daily production input)
router.get('/batches/:id/lays', getCuttingLays);
router.post('/batches/:id/lays', addCuttingLay);
router.delete('/batches/:id/lays/:layId', deleteCuttingLay);

// Issue to Stitching
router.get('/batches/:id/stitching-issues', getStitchingIssues);
router.post('/batches/:id/issue-to-stitching', issueToStitching);

export default router;
