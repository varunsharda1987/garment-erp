import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  createCuttingBatchSchema,
  updateCuttingBatchSchema,
  recordCuttingOutputSchema,
  addCuttingLaySchema,
  issueToStitchingSchema,
  completeCuttingBatchSchema,
  batchActionSchema,
  cuttingBatchQuerySchema,
} from '../schemas/production.schema';
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
  // Issued fabric (for completion dialog)
  getIssuedFabric,
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
router.get('/batches', validateQuery(cuttingBatchQuerySchema), asyncHandler(getAllCuttingBatches));
router.get('/batches/:id', asyncHandler(getCuttingBatchById));
router.post('/batches', validateBody(createCuttingBatchSchema), asyncHandler(createCuttingBatch));
router.put('/batches/:id', validateBody(updateCuttingBatchSchema), asyncHandler(updateCuttingBatch));
router.delete('/batches/:id', asyncHandler(deleteCuttingBatch));

// Fabric issuance data (for completion dialog)
router.get('/batches/:id/issued-fabric', asyncHandler(getIssuedFabric));

// Workflow actions
router.post('/batches/:id/start', asyncHandler(startCuttingBatch));
router.post('/batches/:id/record-output', validateBody(recordCuttingOutputSchema), asyncHandler(recordCuttingOutput));
router.post('/batches/:id/complete', validateBody(completeCuttingBatchSchema), asyncHandler(completeCuttingBatch));
router.post('/batches/:id/hold', validateBody(batchActionSchema), asyncHandler(holdCuttingBatch));
router.post('/batches/:id/resume', asyncHandler(resumeCuttingBatch));
router.post('/batches/:id/cancel', validateBody(batchActionSchema), asyncHandler(cancelCuttingBatch));
router.post('/batches/:id/generate-transfer-slip', asyncHandler(generateTransferSlip));

// Cutting Lays (daily production input)
router.get('/batches/:id/lays', asyncHandler(getCuttingLays));
router.post('/batches/:id/lays', validateBody(addCuttingLaySchema), asyncHandler(addCuttingLay));
router.delete('/batches/:id/lays/:layId', asyncHandler(deleteCuttingLay));

// Issue to Stitching
router.get('/batches/:id/stitching-issues', asyncHandler(getStitchingIssues));
router.post('/batches/:id/issue-to-stitching', validateBody(issueToStitchingSchema), asyncHandler(issueToStitching));

export default router;
