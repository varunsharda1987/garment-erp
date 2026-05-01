// Stock Level Routes - API routes for stock inquiry and management
import express from 'express';
import * as stockLevelController from '../controllers/stockLevel.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { updateStockLevelSchema, stockLevelQuerySchema } from '../schemas/stockLevel.schema';
import {
  idParamSchema,
  warehouseIdParamSchema,
  materialIdParamSchema,
  materialTypeParamSchema,
} from '../schemas/common.schema';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET routes
router.get('/', validateQuery(stockLevelQuerySchema), asyncHandler(stockLevelController.getAllStockLevels));
router.get('/below-reorder', asyncHandler(stockLevelController.getMaterialsBelowReorderLevel));
router.get('/valuation', asyncHandler(stockLevelController.getStockValuationReport));
// Unified stock view endpoints (aggregated from specialized tables - single source of truth)
router.get('/unified', asyncHandler(stockLevelController.getUnifiedStockLevels));
router.get('/summary-by-type', asyncHandler(stockLevelController.getStockSummaryByType));
router.get(
  '/aging/:warehouseId',
  validateParams(warehouseIdParamSchema),
  asyncHandler(stockLevelController.getStockAgingReport)
);
router.get(
  '/by-type/:materialType',
  validateParams(materialTypeParamSchema),
  asyncHandler(stockLevelController.getStockLevelsByMaterialType)
);
router.get(
  '/material/:materialId',
  validateParams(materialIdParamSchema),
  asyncHandler(stockLevelController.getStockLevelsByMaterial)
);
router.get(
  '/warehouse/:warehouseId',
  validateParams(warehouseIdParamSchema),
  asyncHandler(stockLevelController.getStockLevelsByWarehouse)
);
router.get('/:id', validateParams(idParamSchema), asyncHandler(stockLevelController.getStockLevelById));

// PUT routes
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateStockLevelSchema),
  asyncHandler(stockLevelController.updateStockLevel)
);

export default router;
