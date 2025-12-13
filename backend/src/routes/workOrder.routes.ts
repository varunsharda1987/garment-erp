// Work Order Routes - API routes for work order management
import express from 'express';
import * as workOrderController from '../controllers/workOrder.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Dashboard route - must come before /:id route
router.get('/dashboard/summary', workOrderController.getProductionDashboard);

// GET routes
router.get('/', workOrderController.getAllWorkOrders);
router.get('/order/:orderId', workOrderController.getWorkOrdersByOrderId);
router.get('/:id', workOrderController.getWorkOrderById);

// POST routes
router.post('/', workOrderController.createWorkOrder);
router.post('/:id/tracking', workOrderController.addProductionTracking);
router.post('/:id/split', workOrderController.splitWorkOrder);

// PUT routes
router.put('/:id', workOrderController.updateWorkOrder);

// PATCH routes
router.patch('/:id/approve', workOrderController.approveWorkOrder);

// DELETE routes
router.delete('/:id', workOrderController.deleteWorkOrder);

export default router;
