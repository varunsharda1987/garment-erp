// Stock Level Routes - API routes for stock inquiry and management
import express from 'express';
import * as stockLevelController from '../controllers/stockLevel.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET routes
router.get('/', stockLevelController.getAllStockLevels);
router.get('/below-reorder', stockLevelController.getMaterialsBelowReorderLevel);
router.get('/valuation', stockLevelController.getStockValuationReport);
router.get('/aging/:warehouseId', stockLevelController.getStockAgingReport);
router.get('/by-type/:materialType', stockLevelController.getStockLevelsByMaterialType);
router.get('/material/:materialId', stockLevelController.getStockLevelsByMaterial);
router.get('/warehouse/:warehouseId', stockLevelController.getStockLevelsByWarehouse);
router.get('/:id', stockLevelController.getStockLevelById);

// PUT routes
router.put('/:id', stockLevelController.updateStockLevel);

export default router;
