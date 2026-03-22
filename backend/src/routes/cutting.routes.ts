import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
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
router.get('/summary', asyncHandler(getSummary));
router.get('/summary/work-order/:workOrderId', asyncHandler(getSummaryByWorkOrder));
router.get('/available-work-orders', asyncHandler(getAvailableWorkOrders));
router.get('/available-fabric-stock/:fabricId', asyncHandler(getAvailableFabricStock));
router.get('/style-size-summary', asyncHandler(getStyleSizeSummary));
router.get('/chart-data/:workOrderId', asyncHandler(getCuttingChartData));

// ============================================
// CUTTING BATCH ROUTES
// ============================================

// List and CRUD
router.get('/batches', asyncHandler(getAllCuttingBatches));
router.get('/batches/:id', asyncHandler(getCuttingBatchById));
router.post('/batches', asyncHandler(createCuttingBatch));
router.put('/batches/:id', asyncHandler(updateCuttingBatch));
router.delete('/batches/:id', asyncHandler(deleteCuttingBatch));

// Workflow actions
router.post('/batches/:id/start', asyncHandler(startCuttingBatch));
router.post('/batches/:id/record-output', asyncHandler(recordCuttingOutput));
router.post('/batches/:id/complete', asyncHandler(completeCuttingBatch));
router.post('/batches/:id/hold', asyncHandler(holdCuttingBatch));
router.post('/batches/:id/resume', asyncHandler(resumeCuttingBatch));
router.post('/batches/:id/cancel', asyncHandler(cancelCuttingBatch));
router.post('/batches/:id/generate-transfer-slip', asyncHandler(generateTransferSlip));

// Cutting Lays (daily production input)
router.get('/batches/:id/lays', asyncHandler(getCuttingLays));
router.post('/batches/:id/lays', asyncHandler(addCuttingLay));
router.delete('/batches/:id/lays/:layId', asyncHandler(deleteCuttingLay));

// Issue to Stitching
router.get('/batches/:id/stitching-issues', asyncHandler(getStitchingIssues));
router.post('/batches/:id/issue-to-stitching', asyncHandler(issueToStitching));

export default router;
