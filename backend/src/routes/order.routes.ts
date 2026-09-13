// Order Management Routes
import { Router } from 'express';
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updateOrder,
  deleteOrder,
  canDeleteOrder,
  hardDeleteOrder,
  getOrderStatisticsByCustomer,
  cancelOrderWithOptions,
  getOrderLaceAllocations,
  createWorkOrdersForOrder,
  setOrderItemSizeBreakup,
} from '../controllers/order.controller';
import { authenticateToken, requirePermissionForWrites, requireAdmin } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  orderQuerySchema,
  createWorkOrdersForOrderSchema,
  setOrderItemSizeBreakupSchema,
  orderItemSizeBreakupParamSchema,
} from '../schemas/order.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);
router.use(requirePermissionForWrites('orders'));

// Statistics routes (must be before /:id to avoid conflict)
router.get('/statistics/by-customer', asyncHandler(getOrderStatisticsByCustomer));

// Order CRUD routes - with Zod validation
router.post('/', validateBody(createOrderSchema), asyncHandler(createOrder));
router.get('/', validateQuery(orderQuerySchema), asyncHandler(getAllOrders));
router.get('/:id', validateParams(idParamSchema), asyncHandler(getOrderById));
router.put('/:id', validateParams(idParamSchema), validateBody(updateOrderSchema), asyncHandler(updateOrder));
router.patch(
  '/:id/status',
  validateParams(idParamSchema),
  validateBody(updateOrderStatusSchema),
  asyncHandler(updateOrderStatus)
);
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteOrder));

// Hard delete routes (for unprocessed orders)
router.get('/:id/can-delete', validateParams(idParamSchema), asyncHandler(canDeleteOrder));
router.delete('/:id/hard-delete', requireAdmin(), validateParams(idParamSchema), asyncHandler(hardDeleteOrder));

// Cancellation with options (handles lace allocations)
router.post(
  '/:id/cancel',
  validateParams(idParamSchema),
  validateBody(cancelOrderSchema),
  asyncHandler(cancelOrderWithOptions)
);
router.get('/:id/lace-allocations', validateParams(idParamSchema), asyncHandler(getOrderLaceAllocations));

/**
 * Create any missing production work orders for an order.
 * Explicit replacement for the fallback that used to run silently inside BOM approval —
 * scheduling production is a separate decision from approving a bill of materials.
 */
router.post(
  '/:orderId/work-orders',
  validateBody(createWorkOrdersForOrderSchema),
  asyncHandler(createWorkOrdersForOrder)
);

/**
 * Sizes-later workflow: set one order item's size/colour breakup after the order was created
 * without sizes (so greige/dyeing/printing could be procured first), then recalculate MRP and
 * catch production planning up. Additive — it never replaces order_items, unlike PUT /:id.
 */
router.put(
  '/:orderId/items/:orderItemId/size-breakup',
  validateParams(orderItemSizeBreakupParamSchema),
  validateBody(setOrderItemSizeBreakupSchema),
  asyncHandler(setOrderItemSizeBreakup)
);

export default router;
