/**
 * Order Thread Requirement Routes
 */

import { Router } from 'express';
import * as controller from '../controllers/order-thread-requirement.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticateToken } from '../middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  idParamSchema,
  orderIdParamSchema,
  orderIdAndIdParamSchema,
  orderIdAndThreadIdParamSchema,
} from '../schemas/common.schema';
import {
  createThreadRequirementSchema,
  updateThreadRequirementSchema,
  checkShortageSchema,
  generateThreadPOSchema,
  availableSuppliersSchema,
  threadRequirementQuerySchema,
} from '../schemas/orderThreadRequirement.schema';

const router = Router();

// Apply authentication to specific route prefixes only (not globally)
// This prevents auth from affecting other routes when mounted at '/'
router.use('/thread-requirements', authenticateToken);
router.use('/orders', authenticateToken);

// Cross-order endpoints (for UnifiedRequirementsPage)
// These MUST come before /orders/:orderId to avoid route conflicts
router.get('/thread-requirements/stats', asyncHandler(controller.getStats));
router.get(
  '/thread-requirements',
  validateQuery(threadRequirementQuerySchema),
  asyncHandler(controller.getAllRequirements)
);
router.post(
  '/thread-requirements/generate-po',
  validateBody(generateThreadPOSchema),
  asyncHandler(controller.generatePO)
);
router.post(
  '/thread-requirements/available-suppliers',
  validateBody(availableSuppliersSchema),
  asyncHandler(controller.getAvailableSuppliers)
);

// Order-specific CRUD routes
router.post(
  '/orders/:orderId/thread-requirements',
  validateParams(orderIdParamSchema),
  validateBody(createThreadRequirementSchema),
  asyncHandler(controller.createThreadRequirement)
);
router.get(
  '/orders/:orderId/thread-requirements',
  validateParams(orderIdParamSchema),
  asyncHandler(controller.getThreadRequirements)
);
router.get(
  '/orders/:orderId/thread-requirements/:id',
  validateParams(orderIdAndIdParamSchema),
  asyncHandler(controller.getThreadRequirement)
);
router.put(
  '/orders/:orderId/thread-requirements/:id',
  validateParams(orderIdAndIdParamSchema),
  validateBody(updateThreadRequirementSchema),
  asyncHandler(controller.updateThreadRequirement)
);
router.delete(
  '/orders/:orderId/thread-requirements/:id',
  validateParams(orderIdAndIdParamSchema),
  asyncHandler(controller.deleteThreadRequirement)
);

// Shortage detection
router.post(
  '/orders/:orderId/thread-requirements/check-shortage',
  validateParams(orderIdParamSchema),
  validateBody(checkShortageSchema),
  asyncHandler(controller.checkShortages)
);

// SKU generation
router.get(
  '/orders/:orderId/thread-requirements/:threadId/sku',
  validateParams(orderIdAndThreadIdParamSchema),
  asyncHandler(controller.generateStyleSpecificSKU)
);

export default router;
