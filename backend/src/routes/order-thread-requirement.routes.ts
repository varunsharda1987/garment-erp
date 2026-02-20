/**
 * Order Thread Requirement Routes
 */

import { Router } from 'express';
import * as controller from '../controllers/order-thread-requirement.controller';

const router = Router();

// CRUD routes
router.post('/orders/:orderId/thread-requirements', controller.createThreadRequirement);
router.get('/orders/:orderId/thread-requirements', controller.getThreadRequirements);
router.get('/orders/:orderId/thread-requirements/:id', controller.getThreadRequirement);
router.put('/orders/:orderId/thread-requirements/:id', controller.updateThreadRequirement);
router.delete('/orders/:orderId/thread-requirements/:id', controller.deleteThreadRequirement);

// Shortage detection
router.post('/orders/:orderId/thread-requirements/check-shortage', controller.checkShortages);

// SKU generation
router.get('/orders/:orderId/thread-requirements/:threadId/sku', controller.generateStyleSpecificSKU);

export default router;
