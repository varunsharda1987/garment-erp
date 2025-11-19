/**
 * Fabric Stock Routes
 *
 * All routes are protected with authentication middleware
 */

import { Router } from 'express';
import {
  listStock,
  getStockById,
  getStockDashboard,
  getAgingStock,
  getStockValuation,
  transferStock,
  adjustStock,
} from '../controllers/fabric-stock.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Stock listing and details
router.get('/', listStock);
router.get('/dashboard', getStockDashboard);
router.get('/aging', getAgingStock);
router.get('/valuation', getStockValuation);
router.get('/:id', getStockById);

// Stock operations
router.post('/transfer', transferStock);
router.post('/adjust', adjustStock);

export default router;
