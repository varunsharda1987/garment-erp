/**
 * CAD Planning Routes
 *
 * Independent API routes for CAD Planning module.
 * Base path: /api/cad-planning
 */

import { Router } from 'express';
import {
  // List & query operations
  getPendingCADStyles,
  getStylesForCADPlanning,
  getCADStatusCounts,
  getStyleCADSummary,
  getEnhancedCADPlanning,
  getStyleCADHistory,
  getCADTableData,
  getCADOrderHistory,
  getGreigeOptionsForGeneric,
  getGreigeWidths,
  // CAD generation and calculation
  generateCADOptions,
  calculateCADCost,
  selectGreigeForGroup,
  // CAD row CRUD
  addCADWidth,
  deleteCADWidth,
  addCADTableRow,
  addCombinedCADRow,
  updateCADTableRow,
  deleteCADTableRow,
  updateCADValues,
  updateCADValuesWithBreakdown,
  setPreferredCAD,
  getCADGroupDetails,
} from '../controllers/cad-planning.controller';
import {
  approveCAD,
  approveCADPurpose,
  rejectCADPurpose,
  createPlanningVersion,
  copyCADPurpose,
  getCADLineage,
  linkCADToStock,
} from '../controllers/cad-approval.controller';
import {
  getStyleFabricPatternParts,
  assignPatternParts,
  updatePatternPartAssignment,
  deletePatternPartAssignment,
  assignPatternPartsFromComponent,
  getCADPatternPartsForComponent,
} from '../controllers/cad-pattern-parts.controller';
import {
  getEmbroideryCad,
  createOrUpdateEmbroideryCad,
  deleteEmbroideryCad,
  getTotalFabricCad,
  createProductionCADFromStock,
  approveProductionVariance,
  getPendingVarianceApprovals,
} from '../controllers/cad-embroidery.controller';
import { approveCADPlan } from '../controllers/style.controller';
import { authenticateToken as authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// LIST OPERATIONS
// ============================================

/**
 * @route   GET /api/cad-planning/styles
 * @desc    Get styles for CAD planning list with filters
 * @access  All authenticated users
 * @query   status (PENDING|IN_PROGRESS|APPROVED), page, limit, search
 */
router.get('/styles', asyncHandler(getStylesForCADPlanning));

/**
 * @route   GET /api/cad-planning/pending
 * @desc    Get all styles pending CAD approval (legacy endpoint)
 * @access  All authenticated users
 */
router.get('/pending', asyncHandler(getPendingCADStyles));

/**
 * @route   GET /api/cad-planning/status-counts
 * @desc    Get CAD status counts for tabs
 * @access  All authenticated users
 */
router.get('/status-counts', asyncHandler(getCADStatusCounts));

/**
 * @route   GET /api/cad-planning/greige-options
 * @desc    Get available greige options for a generic fabric name
 * @access  All authenticated users
 * @query   genericGreigeName (required)
 */
router.get('/greige-options', asyncHandler(getGreigeOptionsForGeneric));

/**
 * @route   GET /api/cad-planning/greige/:greigeId/widths
 * @desc    Get available widths for a greige
 * @access  All authenticated users
 */
router.get('/greige/:greigeId/widths', asyncHandler(getGreigeWidths));

/**
 * @route   GET /api/cad-planning/pending-variance
 * @desc    Get all PRODUCTION CAD rows pending variance approval
 * @access  ADMIN only
 * @query   styleId (optional), orderId (optional)
 */
router.get('/pending-variance', authorize('ADMIN'), asyncHandler(getPendingVarianceApprovals));

// ============================================
// STYLE-SPECIFIC CAD OPERATIONS
// ============================================

/**
 * @route   GET /api/cad-planning/:styleId
 * @desc    Get enhanced CAD planning data for a style
 * @access  All authenticated users
 */
router.get('/:styleId', asyncHandler(getEnhancedCADPlanning));

/**
 * @route   GET /api/cad-planning/:styleId/summary
 * @desc    Get CAD planning summary for a style
 * @access  All authenticated users
 */
router.get('/:styleId/summary', asyncHandler(getStyleCADSummary));

/**
 * @route   GET /api/cad-planning/:styleId/history
 * @desc    Get all CAD history for a style
 * @access  All authenticated users
 */
router.get('/:styleId/history', asyncHandler(getStyleCADHistory));

/**
 * @route   GET /api/cad-planning/:styleId/table
 * @desc    Get CAD spreadsheet table data for a style
 * @access  All authenticated users
 */
router.get('/:styleId/table', asyncHandler(getCADTableData));

/**
 * @route   GET /api/cad-planning/:styleId/order-history
 * @desc    Get CAD order usage history for a style
 * @access  All authenticated users
 */
router.get('/:styleId/order-history', asyncHandler(getCADOrderHistory));

/**
 * @route   GET /api/cad-planning/:styleId/group/:groupKey/details
 * @desc    Get CAD group details for CAD Edit page
 * @access  All authenticated users
 */
router.get('/:styleId/group/:groupKey/details', asyncHandler(getCADGroupDetails));

// ============================================
// CAD GENERATION & CALCULATION
// ============================================

/**
 * @route   POST /api/cad-planning/generate
 * @desc    Generate CAD options for a style's fabric
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.post('/generate', authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'), asyncHandler(generateCADOptions));

/**
 * @route   POST /api/cad-planning/calculate-cost
 * @desc    Calculate cost for a specific CAD option
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.post(
  '/calculate-cost',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  asyncHandler(calculateCADCost)
);

/**
 * @route   POST /api/cad-planning/:styleId/select-greige
 * @desc    Select greige for a fabric group and generate CAD options
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.post(
  '/:styleId/select-greige',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  asyncHandler(selectGreigeForGroup)
);

// ============================================
// CAD ROW OPERATIONS
// ============================================

/**
 * @route   POST /api/cad-planning/:styleId/row
 * @desc    Add a new CAD row to the spreadsheet table
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.post('/:styleId/row', authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'), asyncHandler(addCADTableRow));

/**
 * @route   POST /api/cad-planning/:styleId/combined-row
 * @desc    Add a COMBINED CAD row from multiple style fabrics
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.post(
  '/:styleId/combined-row',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  asyncHandler(addCombinedCADRow)
);

/**
 * @route   PUT /api/cad-planning/:styleId/row/:rowId
 * @desc    Update a CAD row in the spreadsheet table
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.put(
  '/:styleId/row/:rowId',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  asyncHandler(updateCADTableRow)
);

/**
 * @route   DELETE /api/cad-planning/:styleId/row/:rowId
 * @desc    Delete a CAD row from the spreadsheet table
 * @access  ADMIN, MERCHANDISER
 */
router.delete('/:styleId/row/:rowId', authorize('ADMIN', 'MERCHANDISER'), asyncHandler(deleteCADTableRow));

/**
 * @route   POST /api/cad-planning/:styleId/add-width
 * @desc    Add a new CAD width entry for a fabric group (legacy)
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.post('/:styleId/add-width', authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'), asyncHandler(addCADWidth));

/**
 * @route   DELETE /api/cad-planning/cad/:cadId
 * @desc    Delete a CAD width entry (legacy)
 * @access  ADMIN, MERCHANDISER
 */
router.delete('/cad/:cadId', authorize('ADMIN', 'MERCHANDISER'), asyncHandler(deleteCADWidth));

/**
 * @route   PUT /api/cad-planning/cad/:cadId
 * @desc    Update CAD values with size breakdown support
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.put(
  '/cad/:cadId',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  asyncHandler(updateCADValuesWithBreakdown)
);

/**
 * @route   PUT /api/cad-planning/update-cad/:cadId
 * @desc    Update CAD values (legacy - without size breakdown)
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.put(
  '/update-cad/:cadId',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  asyncHandler(updateCADValues)
);

/**
 * @route   PUT /api/cad-planning/cad/:cadId/set-preferred
 * @desc    Set a CAD width as preferred for a fabric
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.put(
  '/cad/:cadId/set-preferred',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  asyncHandler(setPreferredCAD)
);

// ============================================
// APPROVAL OPERATIONS
// ============================================

/**
 * @route   POST /api/cad-planning/approve
 * @desc    Approve a specific CAD option for a style (legacy)
 * @access  ADMIN, MERCHANDISER
 */
router.post('/approve', authorize('ADMIN', 'MERCHANDISER'), asyncHandler(approveCAD));

/**
 * @route   POST /api/cad-planning/:styleId/row/:rowId/approve
 * @desc    Approve CAD Purpose (COSTING, RAW_MATERIAL_CALCULATION, or PRODUCTION)
 * @access  ADMIN, MERCHANDISER
 */
router.post('/:styleId/row/:rowId/approve', authorize('ADMIN', 'MERCHANDISER'), asyncHandler(approveCADPurpose));

/**
 * @route   POST /api/cad-planning/:styleId/row/:rowId/reject
 * @desc    Reject CAD Purpose
 * @access  ADMIN, MERCHANDISER
 */
router.post('/:styleId/row/:rowId/reject', authorize('ADMIN', 'MERCHANDISER'), asyncHandler(rejectCADPurpose));

/**
 * @route   POST /api/cad-planning/:styleId/planning/:rowId/create-version
 * @desc    Create new version of COSTING CAD (route kept as 'planning' for backwards compatibility)
 * @access  ADMIN, MERCHANDISER
 */
router.post(
  '/:styleId/planning/:rowId/create-version',
  authorize('ADMIN', 'MERCHANDISER'),
  asyncHandler(createPlanningVersion)
);

/**
 * @route   POST /api/cad-planning/:styleId/copy
 * @desc    Copy CAD between purposes (COSTING->RAW_MATERIAL_CALCULATION, RAW_MATERIAL_CALCULATION->PRODUCTION)
 * @access  ADMIN, MERCHANDISER
 */
router.post('/:styleId/copy', authorize('ADMIN', 'MERCHANDISER'), asyncHandler(copyCADPurpose));

/**
 * @route   GET /api/cad-planning/:styleId/row/:rowId/lineage
 * @desc    Get copy lineage for a CAD record (source -> current -> children)
 * @access  All authenticated users
 */
router.get('/:styleId/row/:rowId/lineage', asyncHandler(getCADLineage));

/**
 * @route   POST /api/cad-planning/:styleId/link-stock
 * @desc    Link PRODUCTION CAD to fabric stock
 * @access  ADMIN, MERCHANDISER
 */
router.post('/:styleId/link-stock', authorize('ADMIN', 'MERCHANDISER'), asyncHandler(linkCADToStock));

/**
 * @route   PUT /api/cad-planning/:styleId/approve-cad
 * @desc    Approve CAD plan and link fabrics to selected CAD entries
 * @access  ADMIN, MERCHANDISER
 */
router.put('/:styleId/approve-cad', authorize('ADMIN', 'MERCHANDISER'), asyncHandler(approveCADPlan));

// ============================================
// PRODUCTION CAD FROM STOCK
// ============================================

/**
 * @route   POST /api/cad-planning/:styleId/production-from-stock
 * @desc    Create PRODUCTION CAD from fabric stock receipt
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.post(
  '/:styleId/production-from-stock',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  asyncHandler(createProductionCADFromStock)
);

// ============================================
// PATTERN PARTS
// ============================================

/**
 * @route   GET /api/cad-planning/:styleId/fabrics/:fabricId/pattern-parts
 * @desc    Get pattern parts assigned to a style fabric
 * @access  All authenticated users
 */
router.get('/:styleId/fabrics/:fabricId/pattern-parts', asyncHandler(getStyleFabricPatternParts));

/**
 * @route   POST /api/cad-planning/:styleId/fabrics/:fabricId/pattern-parts
 * @desc    Assign pattern parts to a style fabric
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.post(
  '/:styleId/fabrics/:fabricId/pattern-parts',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  asyncHandler(assignPatternParts)
);

/**
 * @route   POST /api/cad-planning/:styleId/fabrics/:fabricId/pattern-parts/from-component
 * @desc    Bulk assign pattern parts from component definition
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.post(
  '/:styleId/fabrics/:fabricId/pattern-parts/from-component',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  asyncHandler(assignPatternPartsFromComponent)
);

/**
 * @route   PUT /api/cad-planning/:styleId/pattern-parts/:partId
 * @desc    Update a pattern part assignment
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.put(
  '/:styleId/pattern-parts/:partId',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  asyncHandler(updatePatternPartAssignment)
);

/**
 * @route   DELETE /api/cad-planning/:styleId/pattern-parts/:partId
 * @desc    Delete a pattern part assignment
 * @access  ADMIN, MERCHANDISER
 */
router.delete(
  '/:styleId/pattern-parts/:partId',
  authorize('ADMIN', 'MERCHANDISER'),
  asyncHandler(deletePatternPartAssignment)
);

/**
 * @route   GET /api/cad-planning/:styleId/components/:componentId/pattern-parts
 * @desc    Get pattern parts for a component
 * @access  All authenticated users
 */
router.get('/:styleId/components/:componentId/pattern-parts', asyncHandler(getCADPatternPartsForComponent));

// ============================================
// EMBROIDERY CAD
// ============================================

/**
 * @route   GET /api/cad-planning/:styleId/fabrics/:fabricId/embroidery-cad
 * @desc    Get embroidery CAD for a style fabric
 * @access  All authenticated users
 */
router.get('/:styleId/fabrics/:fabricId/embroidery-cad', asyncHandler(getEmbroideryCad));

/**
 * @route   POST /api/cad-planning/:styleId/fabrics/:fabricId/embroidery-cad
 * @desc    Create or update embroidery CAD for a style fabric
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.post(
  '/:styleId/fabrics/:fabricId/embroidery-cad',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  asyncHandler(createOrUpdateEmbroideryCad)
);

/**
 * @route   DELETE /api/cad-planning/:styleId/fabrics/:fabricId/embroidery-cad
 * @desc    Delete embroidery CAD for a style fabric
 * @access  ADMIN, MERCHANDISER
 */
router.delete(
  '/:styleId/fabrics/:fabricId/embroidery-cad',
  authorize('ADMIN', 'MERCHANDISER'),
  asyncHandler(deleteEmbroideryCad)
);

/**
 * @route   GET /api/cad-planning/:styleId/fabrics/:fabricId/total-cad
 * @desc    Get total CAD for a style fabric (Main CAD + Embroidery CAD)
 * @access  All authenticated users
 */
router.get('/:styleId/fabrics/:fabricId/total-cad', asyncHandler(getTotalFabricCad));

/**
 * @route   POST /api/cad-planning/:styleId/row/:rowId/approve-variance
 * @desc    Approve or reject PRODUCTION CAD variance (> 3% threshold)
 * @access  ADMIN only
 * @body    { action: 'APPROVE' | 'REJECT', notes?: string }
 */
router.post('/:styleId/row/:rowId/approve-variance', authorize('ADMIN'), asyncHandler(approveProductionVariance));

export default router;
