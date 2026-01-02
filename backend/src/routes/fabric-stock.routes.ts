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

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Stock creation
router.post('/', createStock);

// Stock listing and details
router.get('/', listStock);
router.get('/dashboard', getStockDashboard);
router.get('/summary', getFabricStockSummary);
router.get('/aging', getAgingStock);
router.get('/valuation', getStockValuation);
router.get('/:id', getStockById);

// Stock operations
router.post('/transfer', transferStock);
router.post('/adjust', adjustStock);

// Stock update
router.patch('/:id', updateStock);

// Stock deletion
router.delete('/:id', deleteStock);

export default router;
