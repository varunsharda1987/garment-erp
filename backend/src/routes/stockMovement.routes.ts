// Stock Movement Routes - API routes for stock transactions
import express from 'express';
import * as stockMovementController from '../controllers/stockMovement.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';
import {
  createStockInSchema,
  createBulkStockInSchema,
  createStockOutSchema,
  createStockTransferSchema,
  createStockAdjustmentSchema,
  createProcessorReturnSchema,
  stockMovementQuerySchema,
  movementSummaryQuerySchema,
  stockMovementIdParamSchema,
  materialIdParamSchema,
  warehouseIdParamSchema,
  materialWarehouseParamSchema,
} from '../schemas/stockMovement.schema';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET routes
router.get('/', validateQuery(stockMovementQuerySchema), asyncHandler(stockMovementController.getAllMovements));
router.get('/unified', asyncHandler(stockMovementController.getUnifiedMovements));
router.get(
  '/material/:materialId/history',
  validateParams(materialIdParamSchema),
  asyncHandler(stockMovementController.getMaterialMovementHistory)
);
router.get(
  '/summary/:warehouseId',
  validateParams(warehouseIdParamSchema),
  validateQuery(movementSummaryQuerySchema),
  asyncHandler(stockMovementController.getMovementSummary)
);
router.get(
  '/ledger/:materialId/:warehouseId',
  validateParams(materialWarehouseParamSchema),
  asyncHandler(stockMovementController.getStockLedger)
);
router.get('/:id', validateParams(stockMovementIdParamSchema), asyncHandler(stockMovementController.getMovementById));

// POST routes - all validated with Zod schemas (write access: Admin, Inventory)
router.post(
  '/stock-in',
  authorize(UserRole.ADMIN, UserRole.INVENTORY),
  validateBody(createStockInSchema),
  asyncHandler(stockMovementController.createStockIn)
);
router.post(
  '/bulk-stock-in',
  authorize(UserRole.ADMIN, UserRole.INVENTORY),
  validateBody(createBulkStockInSchema),
  asyncHandler(stockMovementController.createBulkStockIn)
);
router.post(
  '/stock-out',
  authorize(UserRole.ADMIN, UserRole.INVENTORY),
  validateBody(createStockOutSchema),
  asyncHandler(stockMovementController.createStockOut)
);
router.post(
  '/transfer',
  authorize(UserRole.ADMIN, UserRole.INVENTORY),
  validateBody(createStockTransferSchema),
  asyncHandler(stockMovementController.createStockTransfer)
);
router.post(
  '/adjustment',
  authorize(UserRole.ADMIN, UserRole.INVENTORY),
  validateBody(createStockAdjustmentSchema),
  asyncHandler(stockMovementController.createStockAdjustment)
);
router.post(
  '/processor-return',
  authorize(UserRole.ADMIN, UserRole.INVENTORY),
  validateBody(createProcessorReturnSchema),
  asyncHandler(stockMovementController.createProcessorReturn)
);

export default router;
