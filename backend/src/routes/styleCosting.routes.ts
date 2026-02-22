import express from 'express';
import { UserRole } from '@prisma/client';
import {
  createCostSheet,
  getAllCostSheets,
  getCostSheetById,
  getCostSheetByStyle,
  getCostSheetsGroupedByWidth,
  updateCostSheet,
  approveCostSheet,
  deleteCostSheet,
  generateCostSheetFromStyle,
  createCostSheetVersion,
  getCostSheetVersions,
  compareCostSheetVersions,
  copyCostSheetForProcurement,
  updateActuals,
  approveVariance,
  getBudgetSuggestions,
} from '../controllers/styleCosting.controller';
import {
  addLaceItem,
  updateLaceItemController,
  deleteLaceItem,
  getLaceItems,
  getLaceItem,
  calculateLaceOptions,
  bulkAddLaceItemsController,
} from '../controllers/styleCostingLaceItems.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';

const router = express.Router();

// ============================================================================
// COST SHEET ROUTES
// ============================================================================

/**
 * @route   POST /api/style-costing
 * @desc    Create a new cost sheet
 * @access  Private (ADMIN, PRODUCTION_MANAGER, MERCHANDISER)
 */
router.post(
  '/',
  authenticateToken,
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.MERCHANDISER),
  createCostSheet
);

/**
 * @route   POST /api/style-costing/generate/:styleId
 * @desc    Auto-generate cost sheet from approved CAD data
 * @access  Private (ADMIN, PRODUCTION_MANAGER, MERCHANDISER)
 */
router.post(
  '/generate/:styleId',
  authenticateToken,
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.MERCHANDISER),
  generateCostSheetFromStyle
);

/**
 * @route   GET /api/style-costing
 * @desc    Get all cost sheets with filtering and pagination
 * @access  Private
 */
router.get('/', authenticateToken, getAllCostSheets);

/**
 * @route   GET /api/style-costing/budget-suggestions/:styleId
 * @desc    Get budget suggestions for direct procurement cost sheets
 * @access  Private (ADMIN, PRODUCTION_MANAGER, MERCHANDISER)
 * @note    Calculates budgets from CAD, BOM, and rate cards for RAW_MATERIAL/PRODUCTION purposes
 *          IMPORTANT: This route must come BEFORE /:id to avoid route conflicts
 */
router.get(
  '/budget-suggestions/:styleId',
  authenticateToken,
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.MERCHANDISER),
  getBudgetSuggestions
);

/**
 * @route   GET /api/style-costing/:id
 * @desc    Get cost sheet by ID
 * @access  Private
 */
router.get('/:id', authenticateToken, getCostSheetById);

/**
 * @route   GET /api/style-costing/style/:styleId
 * @desc    Get cost sheet by style ID
 * @access  Private
 */
router.get('/style/:styleId', authenticateToken, getCostSheetByStyle);

/**
 * @route   GET /api/style-costing/style/:styleId/grouped
 * @desc    Get all cost sheets for a style grouped by width combination
 * @access  Private
 */
router.get('/style/:styleId/grouped', authenticateToken, getCostSheetsGroupedByWidth);

/**
 * @route   PUT /api/style-costing/:id
 * @desc    Update cost sheet (only if not approved)
 * @access  Private (ADMIN, PRODUCTION_MANAGER, MERCHANDISER)
 */
router.put(
  '/:id',
  authenticateToken,
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.MERCHANDISER),
  updateCostSheet
);

/**
 * @route   PATCH /api/style-costing/:id/approve
 * @desc    Approve or reject cost sheet
 * @access  Private (ADMIN only - as per integration plan requirement)
 */
router.patch(
  '/:id/approve',
  authenticateToken,
  authorize(UserRole.ADMIN), // Admin only for cost sheet approval
  approveCostSheet
);

/**
 * @route   DELETE /api/style-costing/:id
 * @desc    Delete cost sheet (only if not approved)
 * @access  Private (ADMIN, PRODUCTION_MANAGER)
 */
router.delete(
  '/:id',
  authenticateToken,
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER),
  deleteCostSheet
);

// ============================================================================
// COST SHEET VERSIONING ROUTES
// ============================================================================

/**
 * @route   POST /api/style-costing/:id/create-version
 * @desc    Create a new version of an approved cost sheet
 * @access  Private (ADMIN, PRODUCTION_MANAGER, MERCHANDISER)
 * @note    Only approved cost sheets can be versioned
 */
router.post(
  '/:id/create-version',
  authenticateToken,
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.MERCHANDISER),
  createCostSheetVersion
);

/**
 * @route   GET /api/style-costing/style/:styleId/versions
 * @desc    Get all cost sheet versions for a style
 * @access  Private
 */
router.get('/style/:styleId/versions', authenticateToken, getCostSheetVersions);

/**
 * @route   GET /api/style-costing/compare/:id1/:id2
 * @desc    Compare two cost sheet versions
 * @access  Private
 */
router.get('/compare/:id1/:id2', authenticateToken, compareCostSheetVersions);

// ============================================================================
// PROCUREMENT & VARIANCE TRACKING ROUTES (Phase 2B)
// ============================================================================

/**
 * @route   POST /api/style-costing/copy
 * @desc    Copy COSTING cost sheet to PROCUREMENT_PRODUCTION mode
 * @access  Private (ADMIN, PRODUCTION_MANAGER, MERCHANDISER)
 * @note    Creates new cost sheet with budget fields populated from source totals
 */
router.post(
  '/copy',
  authenticateToken,
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.MERCHANDISER),
  copyCostSheetForProcurement
);

/**
 * @route   PATCH /api/style-costing/:id/actuals
 * @desc    Update actual costs for PROCUREMENT_PRODUCTION cost sheet
 * @access  Private (ADMIN, PRODUCTION_MANAGER, MERCHANDISER)
 * @note    Auto-triggers variance calculation
 */
router.patch(
  '/:id/actuals',
  authenticateToken,
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.MERCHANDISER),
  updateActuals
);

/**
 * @route   POST /api/style-costing/variance/:id/approve
 * @desc    Approve or reject cost variance
 * @access  Private (ADMIN only)
 * @note    Required when variance exceeds buffer limits
 */
router.post(
  '/variance/:id/approve',
  authenticateToken,
  authorize(UserRole.ADMIN), // Admin only for variance approval
  approveVariance
);

// ============================================================================
// LACE ITEMS ROUTES (Phase 6 - Lace Processing Support)
// ============================================================================

/**
 * @route   POST /api/style-costing/:costingId/lace-items
 * @desc    Add a lace item to cost sheet
 * @access  Private (ADMIN, PRODUCTION_MANAGER, MERCHANDISER)
 */
router.post(
  '/:costingId/lace-items',
  authenticateToken,
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.MERCHANDISER),
  addLaceItem
);

/**
 * @route   POST /api/style-costing/:costingId/lace-items/bulk
 * @desc    Bulk add lace items to cost sheet
 * @access  Private (ADMIN, PRODUCTION_MANAGER, MERCHANDISER)
 */
router.post(
  '/:costingId/lace-items/bulk',
  authenticateToken,
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.MERCHANDISER),
  bulkAddLaceItemsController
);

/**
 * @route   POST /api/style-costing/:costingId/lace-items/calculate-options
 * @desc    Calculate cost options for lace (stock, ready, greige+processing)
 * @access  Private
 */
router.post(
  '/:costingId/lace-items/calculate-options',
  authenticateToken,
  calculateLaceOptions
);

/**
 * @route   GET /api/style-costing/:costingId/lace-items
 * @desc    Get all lace items for a cost sheet
 * @access  Private
 */
router.get('/:costingId/lace-items', authenticateToken, getLaceItems);

/**
 * @route   GET /api/style-costing/:costingId/lace-items/:itemId
 * @desc    Get single lace item by ID
 * @access  Private
 */
router.get('/:costingId/lace-items/:itemId', authenticateToken, getLaceItem);

/**
 * @route   PUT /api/style-costing/:costingId/lace-items/:itemId
 * @desc    Update lace item
 * @access  Private (ADMIN, PRODUCTION_MANAGER, MERCHANDISER)
 */
router.put(
  '/:costingId/lace-items/:itemId',
  authenticateToken,
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.MERCHANDISER),
  updateLaceItemController
);

/**
 * @route   DELETE /api/style-costing/:costingId/lace-items/:itemId
 * @desc    Remove lace item from cost sheet
 * @access  Private (ADMIN, PRODUCTION_MANAGER, MERCHANDISER)
 */
router.delete(
  '/:costingId/lace-items/:itemId',
  authenticateToken,
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.MERCHANDISER),
  deleteLaceItem
);

export default router;
