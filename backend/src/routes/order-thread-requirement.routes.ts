/**
 * Order Thread Requirement Routes
 */

import { Router } from 'express';
import * as controller from '../controllers/order-thread-requirement.controller';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// CRUD routes
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
