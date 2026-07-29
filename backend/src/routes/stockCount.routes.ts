// Stock Count Routes - API routes for physical inventory counts
import express from 'express';
import * as stockCountController from '../controllers/stockCount.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import { idParamSchema, warehouseIdParamSchema, countIdAndItemIdParamSchema } from '../schemas/common.schema';
import { createStockCountSchema, updateCountItemSchema } from '../schemas/stockCount.schema';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET routes
router.get('/', asyncHandler(stockCountController.getAllStockCounts));
router.get(
  '/summary/:warehouseId',
  validateParams(warehouseIdParamSchema),
  asyncHandler(stockCountController.getCountSummary)
);
router.get('/:id/variance', validateParams(idParamSchema), asyncHandler(stockCountController.getVarianceReport));
router.get('/:id', validateParams(idParamSchema), asyncHandler(stockCountController.getStockCountById));

// POST routes
router.post('/', validateBody(createStockCountSchema), asyncHandler(stockCountController.createStockCount));
router.post('/:id/start', validateParams(idParamSchema), asyncHandler(stockCountController.startCounting));
router.post('/:id/verify', validateParams(idParamSchema), asyncHandler(stockCountController.verifyStockCount));
router.post('/:id/approve', validateParams(idParamSchema), asyncHandler(stockCountController.approveStockCount));
router.post('/:id/cancel', validateParams(idParamSchema), asyncHandler(stockCountController.cancelStockCount));

// PUT routes
router.put(
  '/:countId/items/:itemId',
  validateParams(countIdAndItemIdParamSchema),
  validateBody(updateCountItemSchema),
  asyncHandler(stockCountController.updateCountItem)
);

export default router;
