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

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// Style-centric routes (existing)
// ============================================
router.get('/', getAllProductionStatus);
router.get('/summary', getProductionStatusSummary);

// ============================================
// Order-centric routes (new)
// ============================================
router.get('/by-order', getOrderStatusList);
router.get('/by-order/summary', getOrderStatusSummary);

export default router;
