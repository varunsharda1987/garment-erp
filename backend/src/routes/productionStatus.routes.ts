import { Router } from 'express';
import {
  getAllProductionStatus,
  getProductionStatusSummary,
} from '../controllers/productionStatus.controller';
import {
  getOrderStatusList,
  getOrderStatusSummary,
  selectCadForOrder,
  updateInheritanceSettings,
  recalculateOrderCosting,
  getOrderItemCosting,
  getCostingComparison,
  deleteOrderItemCosting,
} from '../controllers/orderProductionStatus.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// Style-centric routes (existing)
// ============================================
router.get('/', asyncHandler(getAllProductionStatus));
router.get('/summary', asyncHandler(getProductionStatusSummary));

// ============================================
// Order-centric routes (new)
// ============================================
router.get('/by-order', asyncHandler(getOrderStatusList));
router.get('/by-order/summary', asyncHandler(getOrderStatusSummary));

export default router;
