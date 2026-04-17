/**
 * Order Thread Requirement Routes
 */

import { Router } from 'express';
import * as controller from '../controllers/order-thread-requirement.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticateToken } from '../middleware/auth.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  createThreadRequirementSchema,
  updateThreadRequirementSchema,
  checkShortageSchema,
  generateThreadPOSchema,
  availableSuppliersSchema,
  threadRequirementQuerySchema,
} from '../schemas/orderThreadRequirement.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

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
  validateBody(createThreadRequirementSchema),
  asyncHandler(controller.createThreadRequirement)
);
router.get('/orders/:orderId/thread-requirements', asyncHandler(controller.getThreadRequirements));
router.get('/orders/:orderId/thread-requirements/:id', asyncHandler(controller.getThreadRequirement));
router.put(
  '/orders/:orderId/thread-requirements/:id',
  validateBody(updateThreadRequirementSchema),
  asyncHandler(controller.updateThreadRequirement)
);
router.delete('/orders/:orderId/thread-requirements/:id', asyncHandler(controller.deleteThreadRequirement));

// Shortage detection
router.post(
  '/orders/:orderId/thread-requirements/check-shortage',
  validateBody(checkShortageSchema),
  asyncHandler(controller.checkShortages)
);

// SKU generation
router.get('/orders/:orderId/thread-requirements/:threadId/sku', asyncHandler(controller.generateStyleSpecificSKU));

export default router;
