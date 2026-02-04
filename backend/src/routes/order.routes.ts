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
} from '../controllers/order.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Statistics routes (must be before /:id to avoid conflict)
router.get('/statistics/by-customer', getOrderStatisticsByCustomer);

// Order CRUD routes
router.post('/', createOrder);
router.get('/', getAllOrders);
router.get('/:id', getOrderById);
router.put('/:id', updateOrder);
router.patch('/:id/status', updateOrderStatus);
router.delete('/:id', deleteOrder);

// Hard delete routes (for unprocessed orders)
router.get('/:id/can-delete', canDeleteOrder);
router.delete('/:id/hard-delete', hardDeleteOrder);

export default router;
