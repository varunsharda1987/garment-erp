/**
 * Order Items Routes
 * Handles order item specific operations like CAD selection, inheritance, and costing
 */

import { Router } from 'express';
import {
  selectCadForOrder,
  updateInheritanceSettings,
  recalculateOrderCosting,
  getOrderItemCosting,
  getCostingComparison,
  deleteOrderItemCosting,
} from '../controllers/orderProductionStatus.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { selectCadSchema, updateInheritanceSchema, recalculateCostingSchema } from '../schemas/orderItems.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// CAD Selection
// ============================================
// Select CAD width for an order item
router.patch('/:id/select-cad', validateBody(selectCadSchema), asyncHandler(selectCadForOrder));

// ============================================
// Inheritance Settings
// ============================================
// Toggle sample/inspection inheritance
router.patch('/:id/inheritance', validateBody(updateInheritanceSchema), asyncHandler(updateInheritanceSettings));

// ============================================
// Costing
// ============================================
// Get order item costing
router.get('/:id/costing', asyncHandler(getOrderItemCosting));

// Recalculate costing based on selected CAD
router.post('/:id/recalculate-costing', validateBody(recalculateCostingSchema), asyncHandler(recalculateOrderCosting));

// Get costing comparison (base style vs order-specific)
router.get('/:id/costing-comparison', asyncHandler(getCostingComparison));

// Delete order item costing (revert to style costing)
router.delete('/:id/costing', asyncHandler(deleteOrderItemCosting));

export default router;
