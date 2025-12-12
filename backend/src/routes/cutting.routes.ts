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
  cancelCuttingBatch,
  generateTransferSlip,
  // Summary endpoints
  getSummary,
  getSummaryByWorkOrder,
  getAvailableWorkOrders,
  getAvailableFabricStock,
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
router.post('/batches/:id/cancel', cancelCuttingBatch);
router.post('/batches/:id/generate-transfer-slip', generateTransferSlip);

export default router;
