// Stock Movement Routes - API routes for stock transactions
import express from 'express';
import * as stockMovementController from '../controllers/stockMovement.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET routes
router.get('/', stockMovementController.getAllMovements);
router.get('/material/:materialId/history', stockMovementController.getMaterialMovementHistory);
router.get('/summary/:warehouseId', stockMovementController.getMovementSummary);
router.get('/ledger/:materialId/:warehouseId', stockMovementController.getStockLedger);
router.get('/:id', stockMovementController.getMovementById);

// POST routes
router.post('/stock-in', stockMovementController.createStockIn);
router.post('/stock-out', stockMovementController.createStockOut);
router.post('/transfer', stockMovementController.createStockTransfer);
router.post('/adjustment', stockMovementController.createStockAdjustment);

export default router;
