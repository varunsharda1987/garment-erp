// Warehouse Routes - API routes for warehouse management
import express from 'express';
import * as warehouseController from '../controllers/warehouse.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET routes
router.get('/', warehouseController.getAllWarehouses);
router.get('/by-type/:warehouseType', warehouseController.getWarehousesByType);
router.get('/generate-code/:warehouseType', warehouseController.generateWarehouseCode);
router.get('/code/:warehouseCode', warehouseController.getWarehouseByCode);
router.get('/:id/stock-summary', warehouseController.getWarehouseStockSummary);
router.get('/:id', warehouseController.getWarehouseById);

// POST routes
router.post('/', warehouseController.createWarehouse);

// PUT routes
router.put('/:id', warehouseController.updateWarehouse);

// DELETE routes
router.delete('/:id', warehouseController.deleteWarehouse);

export default router;
