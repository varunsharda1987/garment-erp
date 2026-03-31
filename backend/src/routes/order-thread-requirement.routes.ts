/**
 * Order Thread Requirement Routes
 */

import { Router } from 'express';
import * as controller from '../controllers/order-thread-requirement.controller';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// Cross-order endpoints (for UnifiedRequirementsPage)
// These MUST come before /orders/:orderId to avoid route conflicts
router.get('/thread-requirements/stats', asyncHandler(controller.getStats));
router.get('/thread-requirements', asyncHandler(controller.getAllRequirements));
router.post('/thread-requirements/generate-po', asyncHandler(controller.generatePO));
router.post('/thread-requirements/available-suppliers', asyncHandler(controller.getAvailableSuppliers));

// Order-specific CRUD routes
router.post('/orders/:orderId/thread-requirements', asyncHandler(controller.createThreadRequirement));
router.get('/orders/:orderId/thread-requirements', asyncHandler(controller.getThreadRequirements));
router.get('/orders/:orderId/thread-requirements/:id', asyncHandler(controller.getThreadRequirement));
router.put('/orders/:orderId/thread-requirements/:id', asyncHandler(controller.updateThreadRequirement));
router.delete('/orders/:orderId/thread-requirements/:id', asyncHandler(controller.deleteThreadRequirement));

// Shortage detection
router.post('/orders/:orderId/thread-requirements/check-shortage', asyncHandler(controller.checkShortages));

// SKU generation
router.get('/orders/:orderId/thread-requirements/:threadId/sku', asyncHandler(controller.generateStyleSpecificSKU));

export default router;
