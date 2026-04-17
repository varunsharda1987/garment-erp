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
} from '../controllers/order.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  createOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  orderQuerySchema,
} from '../schemas/order.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Statistics routes (must be before /:id to avoid conflict)
router.get('/statistics/by-customer', asyncHandler(getOrderStatisticsByCustomer));

// Order CRUD routes - with Zod validation
router.post('/', validateBody(createOrderSchema), asyncHandler(createOrder));
router.get('/', validateQuery(orderQuerySchema), asyncHandler(getAllOrders));
router.get('/:id', asyncHandler(getOrderById));
router.put('/:id', validateBody(updateOrderSchema), asyncHandler(updateOrder));
router.patch('/:id/status', validateBody(updateOrderStatusSchema), asyncHandler(updateOrderStatus));
router.delete('/:id', asyncHandler(deleteOrder));

// Hard delete routes (for unprocessed orders)
router.get('/:id/can-delete', asyncHandler(canDeleteOrder));
router.delete('/:id/hard-delete', asyncHandler(hardDeleteOrder));

// Cancellation with options (handles lace allocations)
router.post('/:id/cancel', asyncHandler(cancelOrderWithOptions));
router.get('/:id/lace-allocations', asyncHandler(getOrderLaceAllocations));

export default router;
