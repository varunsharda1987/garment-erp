import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
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
  idParamSchema,
  workOrderIdParamSchema,
  fabricIdParamSchema,
  idAndLayIdParamSchema,
} from '../schemas/common.schema';
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
router.get(
  '/summary/work-order/:workOrderId',
  validateParams(workOrderIdParamSchema),
  asyncHandler(getSummaryByWorkOrder)
);
router.get('/available-work-orders', asyncHandler(getAvailableWorkOrders));
router.get(
  '/available-fabric-stock/:fabricId',
  validateParams(fabricIdParamSchema),
  asyncHandler(getAvailableFabricStock)
);
router.get('/style-size-summary', asyncHandler(getStyleSizeSummary));
router.get('/chart-data/:workOrderId', validateParams(workOrderIdParamSchema), asyncHandler(getCuttingChartData));

// ============================================
// CUTTING BATCH ROUTES
// ============================================

// List and CRUD
router.get('/batches', validateQuery(cuttingBatchQuerySchema), asyncHandler(getAllCuttingBatches));
router.get('/batches/:id', validateParams(idParamSchema), asyncHandler(getCuttingBatchById));
router.post('/batches', validateBody(createCuttingBatchSchema), asyncHandler(createCuttingBatch));
router.put(
  '/batches/:id',
  validateParams(idParamSchema),
  validateBody(updateCuttingBatchSchema),
  asyncHandler(updateCuttingBatch)
);
router.delete('/batches/:id', validateParams(idParamSchema), asyncHandler(deleteCuttingBatch));

// Fabric issuance data (for completion dialog)
router.get('/batches/:id/issued-fabric', validateParams(idParamSchema), asyncHandler(getIssuedFabric));

// Workflow actions
router.post('/batches/:id/start', validateParams(idParamSchema), asyncHandler(startCuttingBatch));
router.post(
  '/batches/:id/record-output',
  validateParams(idParamSchema),
  validateBody(recordCuttingOutputSchema),
  asyncHandler(recordCuttingOutput)
);
router.post(
  '/batches/:id/complete',
  validateParams(idParamSchema),
  validateBody(completeCuttingBatchSchema),
  asyncHandler(completeCuttingBatch)
);
router.post(
  '/batches/:id/hold',
  validateParams(idParamSchema),
  validateBody(batchActionSchema),
  asyncHandler(holdCuttingBatch)
);
router.post('/batches/:id/resume', validateParams(idParamSchema), asyncHandler(resumeCuttingBatch));
router.post(
  '/batches/:id/cancel',
  validateParams(idParamSchema),
  validateBody(batchActionSchema),
  asyncHandler(cancelCuttingBatch)
);
router.post('/batches/:id/generate-transfer-slip', validateParams(idParamSchema), asyncHandler(generateTransferSlip));

// Cutting Lays (daily production input)
router.get('/batches/:id/lays', validateParams(idParamSchema), asyncHandler(getCuttingLays));
router.post(
  '/batches/:id/lays',
  validateParams(idParamSchema),
  validateBody(addCuttingLaySchema),
  asyncHandler(addCuttingLay)
);
router.delete('/batches/:id/lays/:layId', validateParams(idAndLayIdParamSchema), asyncHandler(deleteCuttingLay));

// Issue to Stitching
router.get('/batches/:id/stitching-issues', validateParams(idParamSchema), asyncHandler(getStitchingIssues));
router.post(
  '/batches/:id/issue-to-stitching',
  validateParams(idParamSchema),
  validateBody(issueToStitchingSchema),
  asyncHandler(issueToStitching)
);

export default router;
