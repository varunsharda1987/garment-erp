import { Router } from 'express';
import { getAllFGStock, getFGStockSummary, getFGStockById } from '../controllers/fg-stock.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/fg-stock/summary - Aggregated view by style (before :id to avoid conflict)
router.get('/summary', asyncHandler(getFGStockSummary));

// GET /api/fg-stock - List all FG stock with pagination
router.get('/', asyncHandler(getAllFGStock));

// GET /api/fg-stock/:id - Get single item
router.get('/:id', asyncHandler(getFGStockById));

export default router;
