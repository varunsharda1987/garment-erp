// Stock Level Routes - API routes for stock inquiry and management
import express from 'express';
import * as stockLevelController from '../controllers/stockLevel.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import { updateStockLevelSchema, stockLevelQuerySchema } from '../schemas/stockLevel.schema';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET routes
router.get('/', validateQuery(stockLevelQuerySchema), asyncHandler(stockLevelController.getAllStockLevels));
router.get('/below-reorder', asyncHandler(stockLevelController.getMaterialsBelowReorderLevel));
router.get('/valuation', asyncHandler(stockLevelController.getStockValuationReport));
router.get('/aging/:warehouseId', asyncHandler(stockLevelController.getStockAgingReport));
router.get('/by-type/:materialType', asyncHandler(stockLevelController.getStockLevelsByMaterialType));
router.get('/material/:materialId', asyncHandler(stockLevelController.getStockLevelsByMaterial));
router.get('/warehouse/:warehouseId', asyncHandler(stockLevelController.getStockLevelsByWarehouse));
router.get('/:id', asyncHandler(stockLevelController.getStockLevelById));

// PUT routes
router.put('/:id', validateBody(updateStockLevelSchema), asyncHandler(stockLevelController.updateStockLevel));

export default router;
