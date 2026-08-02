/**
 * Unified PO Routes
 *
 * Extended PO endpoints (unified creation, validation, category mapping):
 * - POST   /api/purchase-orders/unified           - Create unified PO
 * - POST   /api/purchase-orders/validate          - Validate PO input
 * - POST   /api/purchase-orders/check-duplicates  - Check for duplicate POs
 * - GET    /api/purchase-orders/category-mapping/material/:materialType
 * - GET    /api/purchase-orders/category-mapping/service/:serviceType
 *
 * Note: Status management routes (/:id/send, /:id/acknowledge, /:id/cancel)
 * are in purchaseOrder.routes.ts to avoid shadowing (BUG-DASH2 fix).
 */

import { Router } from 'express';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import { createUnifiedPOSchema, validatePOInputSchema, checkDuplicatesSchema } from '../schemas/unifiedPo.schema';
import { materialTypeParamSchema, serviceTypeParamSchema } from '../schemas/common.schema';
import {
  createUnifiedPOController,
  validatePOInputController,
  checkDuplicatesController,
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
  validateBody(createUnifiedPOSchema),
  asyncHandler(createUnifiedPOController)
);

/**
 * POST /api/purchase-orders/validate
 * Validate PO input without creating
 */
router.post(
  '/validate',
  authorize('ADMIN', 'PURCHASE', 'PRODUCTION_MANAGER', 'MERCHANDISER'),
  validateBody(validatePOInputSchema),
  asyncHandler(validatePOInputController)
);

/**
 * POST /api/purchase-orders/check-duplicates
 * Check for existing active POs for the same materials
 */
router.post(
  '/check-duplicates',
  authorize('ADMIN', 'PURCHASE', 'PRODUCTION_MANAGER', 'MERCHANDISER'),
  validateBody(checkDuplicatesSchema),
  asyncHandler(checkDuplicatesController)
);

// ============================================
// Status Management
// ============================================
// NOTE: /:id/send, /:id/acknowledge, /:id/cancel routes are defined in purchaseOrder.routes.ts
// They were duplicated here (BUG-DASH2) but never reached since purchaseOrder.routes.ts is mounted first.
// Removed to eliminate dead code. The handlers in purchaseOrder.controller.ts are the active ones.

// ============================================
// Category Mappings
// ============================================

/**
 * GET /api/purchase-orders/category-mapping/material/:materialType
 * Get recommended POCategory for a material type
 */
router.get(
  '/category-mapping/material/:materialType',
  validateParams(materialTypeParamSchema),
  authorize('ADMIN', 'PURCHASE', 'PRODUCTION_MANAGER', 'MERCHANDISER', 'ACCOUNTS'),
  asyncHandler(getMaterialCategoryMappingController)
);

/**
 * GET /api/purchase-orders/category-mapping/service/:serviceType
 * Get recommended POCategory for a service type
 */
router.get(
  '/category-mapping/service/:serviceType',
  validateParams(serviceTypeParamSchema),
  authorize('ADMIN', 'PURCHASE', 'PRODUCTION_MANAGER', 'MERCHANDISER', 'ACCOUNTS'),
  asyncHandler(getServiceCategoryMappingController)
);

export default router;
