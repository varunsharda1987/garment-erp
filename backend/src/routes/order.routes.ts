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
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  orderQuerySchema,
} from '../schemas/order.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Statistics routes (must be before /:id to avoid conflict)
router.get('/statistics/by-customer', asyncHandler(getOrderStatisticsByCustomer));

// Order CRUD routes - with Zod validation
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.SALES, UserRole.MERCHANDISER, UserRole.PRODUCTION_MANAGER),
  validateBody(createOrderSchema),
  asyncHandler(createOrder)
);
router.get('/', validateQuery(orderQuerySchema), asyncHandler(getAllOrders));
router.get('/:id', validateParams(idParamSchema), asyncHandler(getOrderById));
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.SALES, UserRole.MERCHANDISER, UserRole.PRODUCTION_MANAGER),
  validateParams(idParamSchema),
  validateBody(updateOrderSchema),
  asyncHandler(updateOrder)
);
router.patch(
  '/:id/status',
  authorize(UserRole.ADMIN, UserRole.SALES, UserRole.MERCHANDISER, UserRole.PRODUCTION_MANAGER),
  validateParams(idParamSchema),
  validateBody(updateOrderStatusSchema),
  asyncHandler(updateOrderStatus)
);
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.SALES, UserRole.MERCHANDISER, UserRole.PRODUCTION_MANAGER),
  validateParams(idParamSchema),
  asyncHandler(deleteOrder)
);

// Hard delete routes (for unprocessed orders)
router.get('/:id/can-delete', validateParams(idParamSchema), asyncHandler(canDeleteOrder));
router.delete(
  '/:id/hard-delete',
  authorize(UserRole.ADMIN),
  validateParams(idParamSchema),
  asyncHandler(hardDeleteOrder)
);

// Cancellation with options (handles lace allocations)
router.post(
  '/:id/cancel',
  authorize(UserRole.ADMIN, UserRole.SALES, UserRole.MERCHANDISER, UserRole.PRODUCTION_MANAGER),
  validateParams(idParamSchema),
  validateBody(cancelOrderSchema),
  asyncHandler(cancelOrderWithOptions)
);
router.get('/:id/lace-allocations', validateParams(idParamSchema), asyncHandler(getOrderLaceAllocations));

export default router;
