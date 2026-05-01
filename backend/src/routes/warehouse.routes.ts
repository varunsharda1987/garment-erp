// Warehouse Routes - API routes for warehouse management
import express from 'express';
import * as warehouseController from '../controllers/warehouse.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  warehouseQuerySchema,
  warehouseIdParamSchema,
  warehouseTypeParamSchema,
  warehouseCodeParamSchema,
} from '../schemas/warehouse.schema';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET routes
router.get('/', validateQuery(warehouseQuerySchema), asyncHandler(warehouseController.getAllWarehouses));
router.get(
  '/by-type/:warehouseType',
  validateParams(warehouseTypeParamSchema),
  asyncHandler(warehouseController.getWarehousesByType)
);
router.get(
  '/generate-code/:warehouseType',
  validateParams(warehouseTypeParamSchema),
  asyncHandler(warehouseController.generateWarehouseCode)
);
router.get(
  '/code/:warehouseCode',
  validateParams(warehouseCodeParamSchema),
  asyncHandler(warehouseController.getWarehouseByCode)
);
router.get(
  '/:id/stock-summary',
  validateParams(warehouseIdParamSchema),
  asyncHandler(warehouseController.getWarehouseStockSummary)
);
router.get('/:id', validateParams(warehouseIdParamSchema), asyncHandler(warehouseController.getWarehouseById));

// POST routes
router.post('/', validateBody(createWarehouseSchema), asyncHandler(warehouseController.createWarehouse));

// PUT routes
router.put(
  '/:id',
  validateParams(warehouseIdParamSchema),
  validateBody(updateWarehouseSchema),
  asyncHandler(warehouseController.updateWarehouse)
);

// DELETE routes
router.delete('/:id', validateParams(warehouseIdParamSchema), asyncHandler(warehouseController.deleteWarehouse));

export default router;
