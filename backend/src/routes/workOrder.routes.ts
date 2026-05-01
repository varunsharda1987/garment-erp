// Work Order Routes - API routes for work order management
import express from 'express';
import * as workOrderController from '../controllers/workOrder.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import { createWorkOrderSchema, updateWorkOrderSchema } from '../schemas/workOrder.schema';
import { idParamSchema, orderIdParamSchema } from '../schemas/common.schema';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Dashboard route - must come before /:id route
router.get('/dashboard/summary', asyncHandler(workOrderController.getProductionDashboard));

// GET routes
router.get('/', asyncHandler(workOrderController.getAllWorkOrders));
router.get(
  '/order/:orderId',
  validateParams(orderIdParamSchema),
  asyncHandler(workOrderController.getWorkOrdersByOrderId)
);
router.get(
  '/:id/material-readiness',
  validateParams(idParamSchema),
  asyncHandler(workOrderController.checkMaterialReadiness)
);
router.get(
  '/:id/fabric-issuance-data',
  validateParams(idParamSchema),
  asyncHandler(workOrderController.getFabricIssuanceData)
);
router.get(
  '/:id/trim-issuance-data',
  validateParams(idParamSchema),
  asyncHandler(workOrderController.getTrimIssuanceData)
);
router.get(
  '/:id/packaging-issuance-data',
  validateParams(idParamSchema),
  asyncHandler(workOrderController.getPackagingIssuanceData)
);
router.get(
  '/:id/thread-issuance-data',
  validateParams(idParamSchema),
  asyncHandler(workOrderController.getThreadIssuanceData)
);
router.get('/:id/wip-summary', validateParams(idParamSchema), asyncHandler(workOrderController.getWipSummary));
router.get('/:id', validateParams(idParamSchema), asyncHandler(workOrderController.getWorkOrderById));

// POST routes
router.post('/', validateBody(createWorkOrderSchema), asyncHandler(workOrderController.createWorkOrder));
router.post('/:id/tracking', validateParams(idParamSchema), asyncHandler(workOrderController.addProductionTracking));
router.post('/:id/split', validateParams(idParamSchema), asyncHandler(workOrderController.splitWorkOrder));
router.post('/:id/push-to-cutting', validateParams(idParamSchema), asyncHandler(workOrderController.pushToCutting));
router.post('/:id/issue-fabric', validateParams(idParamSchema), asyncHandler(workOrderController.issueFabric));
router.post('/:id/issue-trims', validateParams(idParamSchema), asyncHandler(workOrderController.issueTrims));
router.post('/:id/issue-packaging', validateParams(idParamSchema), asyncHandler(workOrderController.issuePackaging));
router.post('/:id/issue-thread', validateParams(idParamSchema), asyncHandler(workOrderController.issueThread));

// PUT routes
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateWorkOrderSchema),
  asyncHandler(workOrderController.updateWorkOrder)
);

// PATCH routes
router.patch('/:id/approve', validateParams(idParamSchema), asyncHandler(workOrderController.approveWorkOrder));

// DELETE routes
router.delete('/:id', validateParams(idParamSchema), asyncHandler(workOrderController.deleteWorkOrder));

export default router;
