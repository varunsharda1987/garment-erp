// Stock Movement Routes - API routes for stock transactions
import express from 'express';
import * as stockMovementController from '../controllers/stockMovement.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import {
  createStockInSchema,
  createBulkStockInSchema,
  createStockOutSchema,
  createStockTransferSchema,
  createStockAdjustmentSchema,
  createProcessorReturnSchema,
} from '../schemas/stockMovement.schema';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET routes
router.get('/', asyncHandler(stockMovementController.getAllMovements));
router.get('/material/:materialId/history', asyncHandler(stockMovementController.getMaterialMovementHistory));
router.get('/summary/:warehouseId', asyncHandler(stockMovementController.getMovementSummary));
router.get('/ledger/:materialId/:warehouseId', asyncHandler(stockMovementController.getStockLedger));
router.get('/:id', asyncHandler(stockMovementController.getMovementById));

// POST routes - all validated with Zod schemas
router.post('/stock-in', validateBody(createStockInSchema), asyncHandler(stockMovementController.createStockIn));
router.post(
  '/bulk-stock-in',
  validateBody(createBulkStockInSchema),
  asyncHandler(stockMovementController.createBulkStockIn)
);
router.post('/stock-out', validateBody(createStockOutSchema), asyncHandler(stockMovementController.createStockOut));
router.post(
  '/transfer',
  validateBody(createStockTransferSchema),
  asyncHandler(stockMovementController.createStockTransfer)
);
router.post(
  '/adjustment',
  validateBody(createStockAdjustmentSchema),
  asyncHandler(stockMovementController.createStockAdjustment)
);
router.post(
  '/processor-return',
  validateBody(createProcessorReturnSchema),
  asyncHandler(stockMovementController.createProcessorReturn)
);

export default router;
