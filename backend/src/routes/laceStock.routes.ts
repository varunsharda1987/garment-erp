/**
 * Lace Stock Routes
 *
 * API routes for lace stock management:
 * - Stock CRUD operations
 * - Allocation, transfer, consumption, return
 * - Reports (aging, utilization)
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  createStock,
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
router.get('/reports/aging', getAgingReport);

/**
 * @route   GET /api/lace-stock/reports/utilization
 * @desc    Get stock utilization report (cross-style reuse statistics)
 * @access  Private
 */
router.get('/reports/utilization', getUtilizationReport);

// ============================================================================
// ALLOCATION OPERATIONS
// ============================================================================

/**
 * @route   POST /api/lace-stock/allocations/:allocationId/consume
 * @desc    Consume allocated stock (issue to production)
 * @access  Private
 * @body    quantityConsumed, notes?
 */
router.post('/allocations/:allocationId/consume', consumeStockController);

/**
 * @route   POST /api/lace-stock/allocations/:allocationId/return
 * @desc    Return unused stock from production
 * @access  Private
 * @body    quantityToReturn, notes?
 */
router.post('/allocations/:allocationId/return', returnStockController);

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
router.post('/', createStock);

/**
 * @route   GET /api/lace-stock
 * @desc    Get all lace stock with filters and pagination
 * @access  Private
 * @query   laceId, originStyleId, originOrderId, status, stockType,
 *          qualityGrade, warehouseLocation, minQuantity, search, page, limit
 */
router.get('/', getStocks);

/**
 * @route   GET /api/lace-stock/available/:laceId
 * @desc    Get available stock for a specific lace item
 * @access  Private
 * @query   minQuantity - Filter for minimum available quantity
 */
router.get('/available/:laceId', getAvailableStock);

/**
 * @route   GET /api/lace-stock/:id
 * @desc    Get stock by ID with full details
 * @access  Private
 */
router.get('/:id', getStock);

/**
 * @route   GET /api/lace-stock/:id/transactions
 * @desc    Get transaction history for a stock lot
 * @access  Private
 */
router.get('/:id/transactions', getTransactions);

/**
 * @route   POST /api/lace-stock/:id/allocate
 * @desc    Allocate stock to an order/style
 * @access  Private
 * @body    orderId, styleId, styleCode?, quantityToAllocate, allocationType?, notes?
 */
router.post('/:id/allocate', allocateStockController);

/**
 * @route   POST /api/lace-stock/:id/transfer
 * @desc    Transfer stock to another style
 * @access  Private
 * @body    toOrderId, toStyleId, toStyleCode?, quantityToTransfer, transferNotes?
 */
router.post('/:id/transfer', transferStockController);

export default router;
