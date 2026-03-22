// Stock Count Routes - API routes for physical inventory counts
import express from 'express';
import * as stockCountController from '../controllers/stockCount.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET routes
router.get('/', asyncHandler(stockCountController.getAllStockCounts));
router.get('/summary/:warehouseId', asyncHandler(stockCountController.getCountSummary));
router.get('/:id/variance', asyncHandler(stockCountController.getVarianceReport));
router.get('/:id', asyncHandler(stockCountController.getStockCountById));

// POST routes
router.post('/', asyncHandler(stockCountController.createStockCount));
router.post('/:id/start', asyncHandler(stockCountController.startCounting));
router.post('/:id/verify', asyncHandler(stockCountController.verifyStockCount));
router.post('/:id/approve', asyncHandler(stockCountController.approveStockCount));
router.post('/:id/cancel', asyncHandler(stockCountController.cancelStockCount));

// PUT routes
router.put('/:countId/items/:itemId', asyncHandler(stockCountController.updateCountItem));

export default router;
