/**
 * Lace Stock Routes
 *
 * API routes for lace stock management:
 * - Stock CRUD operations
 * - Allocation, transfer, consumption, return
 * - Reports (aging, utilization)
 */

import { Router } from 'express';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createLaceStockSchema,
  allocateLaceStockSchema,
  transferLaceStockSchema,
  consumeLaceStockSchema,
  returnLaceStockSchema,
  laceStockQuerySchema,
  laceStockIdParamSchema,
  laceIdParamSchema,
  allocationIdParamSchema,
} from '../schemas/laceStock.schema';
import {
  createLaceStock,
  getStocks,
  getStock,
  getAvailableStock,
  allocateStockController,
  transferStockController,
  consumeStockController,
  returnStockController,
  getTransactions,
  getAgingReport,
  getUtilizationReport,
} from '../controllers/laceStock.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// REPORTS (placed before parameterized routes to avoid conflicts)
// ============================================================================

/**
 * @route   GET /api/lace-stock/reports/aging
 * @desc    Get stock aging report (items older than specified days)
 * @access  Private
 * @query   minAgeDays - Minimum age in days (default: 90)
 */
router.get('/reports/aging', asyncHandler(getAgingReport));

/**
 * @route   GET /api/lace-stock/reports/utilization
 * @desc    Get stock utilization report (cross-style reuse statistics)
 * @access  Private
 */
router.get('/reports/utilization', asyncHandler(getUtilizationReport));

// ============================================================================
// ALLOCATION OPERATIONS
// ============================================================================

/**
 * @route   POST /api/lace-stock/allocations/:allocationId/consume
 * @desc    Consume allocated stock (issue to production)
 * @access  Private
 * @body    quantityConsumed, notes?
 */
router.post(
  '/allocations/:allocationId/consume',
  authorize(
    UserRole.ADMIN,
    UserRole.INVENTORY,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
    UserRole.PURCHASE
  ),
  validateParams(allocationIdParamSchema),
  validateBody(consumeLaceStockSchema),
  asyncHandler(consumeStockController)
);

/**
 * @route   POST /api/lace-stock/allocations/:allocationId/return
 * @desc    Return unused stock from production
 * @access  Private
 * @body    quantityToReturn, notes?
 */
router.post(
  '/allocations/:allocationId/return',
  authorize(
    UserRole.ADMIN,
    UserRole.INVENTORY,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
    UserRole.PURCHASE
  ),
  validateParams(allocationIdParamSchema),
  validateBody(returnLaceStockSchema),
  asyncHandler(returnStockController)
);

// ============================================================================
// STOCK CRUD
// ============================================================================

/**
 * @route   POST /api/lace-stock
 * @desc    Create a new lace stock entry
 * @access  Private
 * @body    laceId, quantityAvailable, weightedAvgCost, purchaseCost?,
 *          lotNumber?, dyeLotNumber?, shadeNote?, originStyleId?, etc.
 */
router.post(
  '/',
  authorize(
    UserRole.ADMIN,
    UserRole.INVENTORY,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
    UserRole.PURCHASE
  ),
  validateBody(createLaceStockSchema),
  asyncHandler(createLaceStock)
);

/**
 * @route   GET /api/lace-stock
 * @desc    Get all lace stock with filters and pagination
 * @access  Private
 * @query   laceId, originStyleId, originOrderId, status, stockType,
 *          qualityGrade, warehouseLocation, minQuantity, search, page, limit
 */
router.get('/', validateQuery(laceStockQuerySchema), asyncHandler(getStocks));

/**
 * @route   GET /api/lace-stock/available/:laceId
 * @desc    Get available stock for a specific lace item
 * @access  Private
 * @query   minQuantity - Filter for minimum available quantity
 */
router.get('/available/:laceId', validateParams(laceIdParamSchema), asyncHandler(getAvailableStock));

/**
 * @route   GET /api/lace-stock/:id
 * @desc    Get stock by ID with full details
 * @access  Private
 */
router.get('/:id', validateParams(laceStockIdParamSchema), asyncHandler(getStock));

/**
 * @route   GET /api/lace-stock/:id/transactions
 * @desc    Get transaction history for a stock lot
 * @access  Private
 */
router.get('/:id/transactions', validateParams(laceStockIdParamSchema), asyncHandler(getTransactions));

/**
 * @route   POST /api/lace-stock/:id/allocate
 * @desc    Allocate stock to an order/style
 * @access  Private
 * @body    orderId, styleId, styleCode?, quantityToAllocate, allocationType?, notes?
 */
router.post(
  '/:id/allocate',
  authorize(
    UserRole.ADMIN,
    UserRole.INVENTORY,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
    UserRole.PURCHASE
  ),
  validateParams(laceStockIdParamSchema),
  validateBody(allocateLaceStockSchema),
  asyncHandler(allocateStockController)
);

/**
 * @route   POST /api/lace-stock/:id/transfer
 * @desc    Transfer stock to another style
 * @access  Private
 * @body    toOrderId, toStyleId, toStyleCode?, quantityToTransfer, transferNotes?
 */
router.post(
  '/:id/transfer',
  authorize(
    UserRole.ADMIN,
    UserRole.INVENTORY,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
    UserRole.PURCHASE
  ),
  validateParams(laceStockIdParamSchema),
  validateBody(transferLaceStockSchema),
  asyncHandler(transferStockController)
);

export default router;
