/**
 * Fabric Stock Routes
 *
 * All routes are protected with authentication middleware
 */

import { Router } from 'express';
import {
  createStock,
  listStock,
  getStockById,
  getStockDashboard,
  getFabricStockSummary,
  getAgingStock,
  getStockValuation,
  transferStock,
  adjustStock,
  updateStock,
  deleteStock,
} from '../controllers/fabric-stock.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Stock creation
router.post('/', asyncHandler(createStock));

// Stock listing and details
router.get('/', asyncHandler(listStock));
router.get('/dashboard', asyncHandler(getStockDashboard));
router.get('/summary', asyncHandler(getFabricStockSummary));
router.get('/aging', asyncHandler(getAgingStock));
router.get('/valuation', asyncHandler(getStockValuation));
router.get('/:id', asyncHandler(getStockById));

// Stock operations
router.post('/transfer', asyncHandler(transferStock));
router.post('/adjust', asyncHandler(adjustStock));

// Stock update
router.patch('/:id', asyncHandler(updateStock));

// Stock deletion
router.delete('/:id', asyncHandler(deleteStock));

export default router;
