/**
 * Fabric Stock Routes
 *
 * All routes are protected with authentication middleware
 */

import { Router } from 'express';
import {
  createFabricStock,
  listStock,
  getStockById,
  getStockDashboard,
  getFabricStockSummary,
  getAgingStock,
  getStockValuation,
  transferStock,
  adjustStock,
  updateStock,
  deleteStock,
} from '../controllers/fabric-stock.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';
import {
  createFabricStockSchema,
  updateFabricStockSchema,
  transferFabricStockSchema,
  adjustFabricStockSchema,
  fabricStockQuerySchema,
  fabricStockIdParamSchema,
} from '../schemas/fabricStock.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Stock creation
router.post(
  '/',
  authorize(
    UserRole.ADMIN,
    UserRole.INVENTORY,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
    UserRole.PURCHASE
  ),
  validateBody(createFabricStockSchema),
  asyncHandler(createFabricStock)
);

// Stock listing and details
router.get('/', validateQuery(fabricStockQuerySchema), asyncHandler(listStock));
router.get('/dashboard', asyncHandler(getStockDashboard));
router.get('/summary', asyncHandler(getFabricStockSummary));
router.get('/aging', asyncHandler(getAgingStock));
router.get('/valuation', asyncHandler(getStockValuation));
router.get('/:id', validateParams(fabricStockIdParamSchema), asyncHandler(getStockById));

// Stock operations
router.post(
  '/transfer',
  authorize(
    UserRole.ADMIN,
    UserRole.INVENTORY,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
    UserRole.PURCHASE
  ),
  validateBody(transferFabricStockSchema),
  asyncHandler(transferStock)
);
router.post(
  '/adjust',
  authorize(UserRole.ADMIN, UserRole.INVENTORY),
  validateBody(adjustFabricStockSchema),
  asyncHandler(adjustStock)
);

// Stock update
router.patch(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.INVENTORY),
  validateParams(fabricStockIdParamSchema),
  validateBody(updateFabricStockSchema),
  asyncHandler(updateStock)
);

// Stock deletion
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.INVENTORY),
  validateParams(fabricStockIdParamSchema),
  asyncHandler(deleteStock)
);

export default router;
