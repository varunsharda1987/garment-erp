// Warehouse Routes - API routes for warehouse management
import express from 'express';
import * as warehouseController from '../controllers/warehouse.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { createWarehouseSchema, updateWarehouseSchema } from '../schemas/warehouse.schema';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET routes
router.get('/', asyncHandler(warehouseController.getAllWarehouses));
router.get('/by-type/:warehouseType', asyncHandler(warehouseController.getWarehousesByType));
router.get('/generate-code/:warehouseType', asyncHandler(warehouseController.generateWarehouseCode));
router.get('/code/:warehouseCode', asyncHandler(warehouseController.getWarehouseByCode));
router.get('/:id/stock-summary', asyncHandler(warehouseController.getWarehouseStockSummary));
router.get('/:id', asyncHandler(warehouseController.getWarehouseById));

// POST routes
router.post('/', validateBody(createWarehouseSchema), asyncHandler(warehouseController.createWarehouse));

// PUT routes
router.put('/:id', validateBody(updateWarehouseSchema), asyncHandler(warehouseController.updateWarehouse));

// DELETE routes
router.delete('/:id', asyncHandler(warehouseController.deleteWarehouse));

export default router;
