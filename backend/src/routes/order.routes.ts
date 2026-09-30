// Order Management Routes
import { Router, Request, Response } from 'express';
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrder,
  canDeleteOrder,
  hardDeleteOrder,
  getOrderStatisticsByCustomer,
  cancelOrderWithOptions,
  getOrderLaceAllocations,
  createWorkOrdersForOrder,
  setOrderItemSizeBreakup,
  getOrdersWaitingForRun,
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
  ordersWaitingForRunQuerySchema,
} from '../schemas/order.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);
router.use(requirePermissionForWrites('orders'));

// Statistics routes (must be before /:id to avoid conflict)
router.get('/statistics/by-customer', asyncHandler(getOrderStatisticsByCustomer));
router.get('/waiting-for-run', validateQuery(ordersWaitingForRunQuerySchema), asyncHandler(getOrdersWaitingForRun));

// Order CRUD routes - with Zod validation
router.post('/', validateBody(createOrderSchema), asyncHandler(createOrder));
router.get('/', validateQuery(orderQuerySchema), asyncHandler(getAllOrders));
router.get('/:id', validateParams(idParamSchema), asyncHandler(getOrderById));
router.put('/:id', validateParams(idParamSchema), validateBody(updateOrderSchema), asyncHandler(updateOrder));
/**
 * RETIRED 2026-09-28. An order's status is DERIVED from its production runs and delivery notes
 * (services/helpers/order-status.helper.ts) — nothing sets it by hand except Cancel. This route had
 * no caller; it flipped status with none of the cancel cascade and let admins force any transition.
 * The body is still validated so an unknown status keeps its 400.
 */
router.patch('/:id/status', validateParams(idParamSchema), validateBody(updateOrderStatusSchema), (_req, res) =>
  res.status(410).json({
    success: false,
    message: 'Order status follows its production runs and delivery notes; to cancel an order use Cancel order.',
  })
);
/**
 * RETIRED 2026-09-28. "Delete" used to fall through to a CANCEL whenever the order could not be
 * deleted — so a Delete click on an order being cut cancelled it and its running production run.
 * Deleting is DELETE /:id/hard-delete; cancelling is POST /:id/cancel. They are separate decisions.
 */
// no-body — 410 tombstone, nothing read
router.delete('/:id', (_req: Request, res: Response) =>
  res.status(410).json({
    success: false,
    message: 'To delete an order use Delete permanently; to cancel it use Cancel order.',
  })
);

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
