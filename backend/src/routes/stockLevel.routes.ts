// Stock Level Routes - API routes for stock inquiry and management
import express from 'express';
import * as stockLevelController from '../controllers/stockLevel.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';
import { updateStockLevelSchema, stockLevelQuerySchema, stockLevelIdParamSchema } from '../schemas/stockLevel.schema';
import { warehouseIdParamSchema, materialIdParamSchema, materialTypeParamSchema } from '../schemas/common.schema';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET routes
router.get('/', validateQuery(stockLevelQuerySchema), asyncHandler(stockLevelController.getAllStockLevels));
router.get('/below-reorder', asyncHandler(stockLevelController.getMaterialsBelowReorderLevel));
router.get('/valuation', asyncHandler(stockLevelController.getStockValuationReport));
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
// :id is the synthetic composite `${materialId}_${warehouseId}` emitted by the list endpoints
// (legacy bare-UUID row ids still pass validation and get a clear 404 from the service).
router.get('/:id', validateParams(stockLevelIdParamSchema), asyncHandler(stockLevelController.getStockLevelById));

// PUT routes (write access: Admin, Inventory)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.INVENTORY),
  validateParams(stockLevelIdParamSchema),
  validateBody(updateStockLevelSchema),
  asyncHandler(stockLevelController.updateStockLevel)
);

export default router;
