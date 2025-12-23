// Order Label Requirements Routes
import { Router } from 'express';
import {
  getOrderLabelRequirements,
  createLabelOverride,
  getOrderLabelOverrides,
  deleteLabelOverride,
  getOrderTotalLabelRequirements,
} from '../controllers/order-label.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// Order Label Override Routes
// ============================================

// Delete a label override
router.delete('/:id', deleteLabelOverride);

export default router;

// ============================================
// Order Item-Scoped Routes (to be mounted under /order-items/:orderItemId)
// ============================================

export const orderItemLabelRouter = Router({ mergeParams: true });

// Apply authentication to order-item-scoped routes
orderItemLabelRouter.use(authenticateToken);

// Get label requirements for an order item (calculated from breakup)
orderItemLabelRouter.get('/label-requirements', getOrderLabelRequirements);

// Get all label overrides for an order item
orderItemLabelRouter.get('/label-overrides', getOrderLabelOverrides);

// Create or update a label override for an order item
orderItemLabelRouter.post('/label-overrides', createLabelOverride);

// ============================================
// Order-Scoped Routes (to be mounted under /orders/:orderId)
// ============================================

export const orderLabelRouter = Router({ mergeParams: true });

// Apply authentication to order-scoped routes
orderLabelRouter.use(authenticateToken);

// Get aggregated label requirements for entire order
orderLabelRouter.get('/label-requirements', getOrderTotalLabelRequirements);
