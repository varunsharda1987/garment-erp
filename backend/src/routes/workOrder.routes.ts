// Work Order Routes - API routes for work order management
import express from 'express';
import * as workOrderController from '../controllers/workOrder.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { createWorkOrderSchema, updateWorkOrderSchema } from '../schemas/workOrder.schema';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Dashboard route - must come before /:id route
router.get('/dashboard/summary', asyncHandler(workOrderController.getProductionDashboard));

// GET routes
router.get('/', asyncHandler(workOrderController.getAllWorkOrders));
router.get('/order/:orderId', asyncHandler(workOrderController.getWorkOrdersByOrderId));
router.get('/:id/material-readiness', asyncHandler(workOrderController.checkMaterialReadiness));
router.get('/:id', asyncHandler(workOrderController.getWorkOrderById));

// POST routes
router.post('/', validateBody(createWorkOrderSchema), asyncHandler(workOrderController.createWorkOrder));
router.post('/:id/tracking', asyncHandler(workOrderController.addProductionTracking));
router.post('/:id/split', asyncHandler(workOrderController.splitWorkOrder));
router.post('/:id/push-to-cutting', asyncHandler(workOrderController.pushToCutting));

// PUT routes
router.put('/:id', validateBody(updateWorkOrderSchema), asyncHandler(workOrderController.updateWorkOrder));

// PATCH routes
router.patch('/:id/approve', asyncHandler(workOrderController.approveWorkOrder));

// DELETE routes
router.delete('/:id', asyncHandler(workOrderController.deleteWorkOrder));

export default router;
