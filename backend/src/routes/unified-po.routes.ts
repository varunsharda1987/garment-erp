/**
 * Unified PO Routes
 *
 * Extended PO endpoints (unified creation, validation, status management):
 * - POST   /api/purchase-orders/unified           - Create unified PO
 * - POST   /api/purchase-orders/validate          - Validate PO input
 * - POST   /api/purchase-orders/check-duplicates  - Check for duplicate POs
 * - PATCH  /api/purchase-orders/:id/send          - Send PO
 * - PATCH  /api/purchase-orders/:id/acknowledge   - Acknowledge PO
 * - PATCH  /api/purchase-orders/:id/cancel        - Cancel PO
 * - GET    /api/purchase-orders/category-mapping/material/:materialType
 * - GET    /api/purchase-orders/category-mapping/service/:serviceType
 *
 * Note: GET /stats and GET /by-source/:source are in purchaseOrder.routes.ts
 * (must be registered before the /:id wildcard route)
 */

import { Router } from 'express';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import {
  createUnifiedPOController,
  validatePOInputController,
  checkDuplicatesController,
  sendPOController,
  acknowledgePOController,
  cancelPOController,
  getMaterialCategoryMappingController,
  getServiceCategoryMappingController,
} from '../controllers/unified-po.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// Unified PO Creation & Validation
// ============================================

/**
 * POST /api/purchase-orders/unified
 * Create a unified PO from any source (MANUAL, COST_SHEET, MRP, SERVICE_REQUIREMENT)
 */
router.post(
  '/unified',
  authorize('ADMIN', 'PURCHASE', 'PRODUCTION_MANAGER', 'MERCHANDISER'),
  asyncHandler(createUnifiedPOController)
);

/**
 * POST /api/purchase-orders/validate
 * Validate PO input without creating
 */
router.post(
  '/validate',
  authorize('ADMIN', 'PURCHASE', 'PRODUCTION_MANAGER', 'MERCHANDISER'),
  asyncHandler(validatePOInputController)
);

/**
 * POST /api/purchase-orders/check-duplicates
 * Check for existing active POs for the same materials
 */
router.post(
  '/check-duplicates',
  authorize('ADMIN', 'PURCHASE', 'PRODUCTION_MANAGER', 'MERCHANDISER'),
  asyncHandler(checkDuplicatesController)
);

// ============================================
// Status Management
// ============================================

/**
 * PATCH /api/purchase-orders/:id/send
 * Send PO to supplier (DRAFT/READY_FOR_PROCESSING -> SENT)
 */
router.patch('/:id/send', authorize('ADMIN', 'PURCHASE', 'PRODUCTION_MANAGER'), asyncHandler(sendPOController));

/**
 * PATCH /api/purchase-orders/:id/acknowledge
 * Mark PO as acknowledged by supplier (SENT -> ACKNOWLEDGED)
 */
router.patch(
  '/:id/acknowledge',
  authorize('ADMIN', 'PURCHASE', 'PRODUCTION_MANAGER'),
  asyncHandler(acknowledgePOController)
);

/**
 * PATCH /api/purchase-orders/:id/cancel
 * Cancel PO with reason
 */
router.patch('/:id/cancel', authorize('ADMIN', 'PURCHASE', 'PRODUCTION_MANAGER'), asyncHandler(cancelPOController));

// ============================================
// Category Mappings
// ============================================

/**
 * GET /api/purchase-orders/category-mapping/material/:materialType
 * Get recommended POCategory for a material type
 */
router.get(
  '/category-mapping/material/:materialType',
  authorize('ADMIN', 'PURCHASE', 'PRODUCTION_MANAGER', 'MERCHANDISER', 'ACCOUNTS'),
  asyncHandler(getMaterialCategoryMappingController)
);

/**
 * GET /api/purchase-orders/category-mapping/service/:serviceType
 * Get recommended POCategory for a service type
 */
router.get(
  '/category-mapping/service/:serviceType',
  authorize('ADMIN', 'PURCHASE', 'PRODUCTION_MANAGER', 'MERCHANDISER', 'ACCOUNTS'),
  asyncHandler(getServiceCategoryMappingController)
);

export default router;
