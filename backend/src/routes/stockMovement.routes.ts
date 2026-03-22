// Stock Movement Routes - API routes for stock transactions
import express from 'express';
import * as stockMovementController from '../controllers/stockMovement.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET routes
router.get('/', asyncHandler(stockMovementController.getAllMovements));
router.get('/material/:materialId/history', asyncHandler(stockMovementController.getMaterialMovementHistory));
router.get('/summary/:warehouseId', asyncHandler(stockMovementController.getMovementSummary));
router.get('/ledger/:materialId/:warehouseId', asyncHandler(stockMovementController.getStockLedger));
router.get('/:id', asyncHandler(stockMovementController.getMovementById));

// POST routes
router.post('/stock-in', asyncHandler(stockMovementController.createStockIn));
router.post('/stock-out', asyncHandler(stockMovementController.createStockOut));
router.post('/transfer', asyncHandler(stockMovementController.createStockTransfer));
router.post('/adjustment', asyncHandler(stockMovementController.createStockAdjustment));

export default router;
