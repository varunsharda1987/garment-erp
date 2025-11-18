// Stock Count Routes - API routes for physical inventory counts
import express from 'express';
import * as stockCountController from '../controllers/stockCount.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET routes
router.get('/', stockCountController.getAllStockCounts);
router.get('/summary/:warehouseId', stockCountController.getCountSummary);
router.get('/:id/variance', stockCountController.getVarianceReport);
router.get('/:id', stockCountController.getStockCountById);

// POST routes
router.post('/', stockCountController.createStockCount);
router.post('/:id/start', stockCountController.startCounting);
router.post('/:id/verify', stockCountController.verifyStockCount);
router.post('/:id/approve', stockCountController.approveStockCount);
router.post('/:id/cancel', stockCountController.cancelStockCount);

// PUT routes
router.put('/:countId/items/:itemId', stockCountController.updateCountItem);

export default router;
