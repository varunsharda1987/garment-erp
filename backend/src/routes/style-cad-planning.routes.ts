import { Router } from 'express';
import {
  getPendingCADStyles,
  generateCADOptions,
  calculateCADCost,
  approveCAD,
  updateCADValues,
  getGreigeOptionsForGeneric,
  getStyleCADSummary,
  getEnhancedCADPlanning,
  selectGreigeForGroup,
  addCADWidth,
  deleteCADWidth,
  getCADGroupDetails,
  updateCADValuesWithBreakdown,
  setPreferredCAD,
  getStyleCADHistory,
  // Pattern Parts endpoints
  getStyleFabricPatternParts,
  assignPatternParts,
  updatePatternPartAssignment,
  deletePatternPartAssignment,
  assignPatternPartsFromComponent,
  getCADPatternPartsForComponent,
  // Embroidery CAD endpoints
  getEmbroideryCad,
  createOrUpdateEmbroideryCad,
  deleteEmbroideryCad,
  getTotalFabricCad,
  // CAD Spreadsheet Table endpoints
  getCADTableData,
  addCADTableRow,
  addCombinedCADRow,
  updateCADTableRow,
  deleteCADTableRow,
  getGreigeWidths,
  // CAD Purposes endpoints
  approveCADPurpose,
  rejectCADPurpose,
  createPlanningVersion,
  copyCADPurpose,
  linkCADToStock,
  // Multi-order CAD workflow endpoints
  createProductionCADFromStock,
  getCADOrderHistory,
} from '../controllers/style-cad-planning.controller';
import { authenticateToken as authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/styles/cad-planning/pending
 * @desc    Get all styles pending CAD approval
 * @access  All authenticated users
 * @query   page, limit
 */
router.get('/cad-planning/pending', getPendingCADStyles);

/**
 * @route   GET /api/styles/cad-planning/greige-options
 * @desc    Get available greige options for a generic fabric name
 * @access  All authenticated users
 * @query   genericFabricName (required)
 */
router.get('/cad-planning/greige-options', getGreigeOptionsForGeneric);

/**
 * @route   GET /api/styles/:styleId/cad-planning
 * @desc    Get enhanced CAD planning data for a style (new workflow)
 * @access  All authenticated users
 */
router.get('/:styleId/cad-planning', getEnhancedCADPlanning);

/**
 * @route   GET /api/styles/:styleId/cad-summary
 * @desc    Get CAD planning summary for a style
 * @access  All authenticated users
 */
router.get('/:styleId/cad-summary', getStyleCADSummary);

/**
 * @route   GET /api/styles/:styleId/cad-planning/history
 * @desc    Get all CAD history for a style (all calculated widths, selected/approved status)
 * @access  All authenticated users
 */
router.get('/:styleId/cad-planning/history', getStyleCADHistory);

/**
 * @route   POST /api/styles/cad-planning/generate
 * @desc    Generate CAD options for a style's fabric
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 * @body    { styleId, genericFabricName, greigeId, averagingMode?, componentNames? }
 */
router.post(
  '/cad-planning/generate',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  generateCADOptions
);

/**
 * @route   POST /api/styles/:styleId/cad-planning/select-greige
 * @desc    Select greige for a fabric group and generate CAD options
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 * @body    { groupKey, greigeId, averagingMode }
 */
router.post(
  '/:styleId/cad-planning/select-greige',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  selectGreigeForGroup
);

/**
 * @route   POST /api/styles/cad-planning/calculate-cost
 * @desc    Calculate cost for a specific CAD option
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 * @body    { cadId, fabricRate, unit? }
 */
router.post(
  '/cad-planning/calculate-cost',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  calculateCADCost
);

/**
 * @route   POST /api/styles/cad-planning/approve
 * @desc    Approve a specific CAD option for a style
 * @access  ADMIN, MERCHANDISER
 * @body    { styleId, cadId, fabricId, approvalNotes? }
 */
router.post(
  '/cad-planning/approve',
  authorize('ADMIN', 'MERCHANDISER'),
  approveCAD
);

/**
 * @route   PUT /api/styles/cad-planning/update-cad/:cadId
 * @desc    Update CAD values for a specific width (legacy - without size breakdown)
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 * @body    { cadMeters?, cadYards?, cadWastagePercent?, markerEfficiency?, notes? }
 */
router.put(
  '/cad-planning/update-cad/:cadId',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  updateCADValues
);

/**
 * @route   GET /api/styles/:styleId/cad-planning/:groupKey/details
 * @desc    Get CAD group details for CAD Edit page (includes size breakdowns and style variants)
 * @access  All authenticated users
 */
router.get('/:styleId/cad-planning/:groupKey/details', getCADGroupDetails);

/**
 * @route   POST /api/styles/:styleId/cad-planning/add-width
 * @desc    Add a new CAD width entry for a fabric group
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 * @body    { groupKey, fabricId?, cutableWidth, greigeId?, componentName? }
 */
router.post(
  '/:styleId/cad-planning/add-width',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  addCADWidth
);

/**
 * @route   DELETE /api/styles/cad-planning/cad/:cadId
 * @desc    Delete a CAD width entry
 * @access  ADMIN, MERCHANDISER
 */
router.delete(
  '/cad-planning/cad/:cadId',
  authorize('ADMIN', 'MERCHANDISER'),
  deleteCADWidth
);

/**
 * @route   PUT /api/styles/cad-planning/cad/:cadId
 * @desc    Update CAD values with size breakdown support
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 * @body    { cadMeters?, cadYards?, cadWastagePercent?, markerEfficiency?, notes?, sizeBreakdowns?: [{sizeName, quantity}] }
 */
router.put(
  '/cad-planning/cad/:cadId',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  updateCADValuesWithBreakdown
);

/**
 * @route   PUT /api/styles/cad-planning/cad/:cadId/set-preferred
 * @desc    Set a CAD width as preferred for a fabric
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.put(
  '/cad-planning/cad/:cadId/set-preferred',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  setPreferredCAD
);

// ============================================================================
// PATTERN PARTS ROUTES
// ============================================================================

/**
 * @route   GET /api/styles/:styleId/fabrics/:fabricId/pattern-parts
 * @desc    Get pattern parts assigned to a style fabric
 * @access  All authenticated users
 */
router.get('/:styleId/fabrics/:fabricId/pattern-parts', getStyleFabricPatternParts);

/**
 * @route   POST /api/styles/:styleId/fabrics/:fabricId/pattern-parts
 * @desc    Assign pattern parts to a style fabric
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 * @body    { patternParts: [{ patternPartId, quantity?, goesToEmbroidery?, notes? }] }
 */
router.post(
  '/:styleId/fabrics/:fabricId/pattern-parts',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  assignPatternParts
);

/**
 * @route   POST /api/styles/:styleId/fabrics/:fabricId/pattern-parts/from-component
 * @desc    Bulk assign pattern parts from component definition
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 */
router.post(
  '/:styleId/fabrics/:fabricId/pattern-parts/from-component',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  assignPatternPartsFromComponent
);

/**
 * @route   PUT /api/styles/:styleId/pattern-parts/:partId
 * @desc    Update a pattern part assignment (e.g., toggle embroidery flag)
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 * @body    { quantity?, goesToEmbroidery?, notes? }
 */
router.put(
  '/:styleId/pattern-parts/:partId',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  updatePatternPartAssignment
);

/**
 * @route   DELETE /api/styles/:styleId/pattern-parts/:partId
 * @desc    Delete a pattern part assignment
 * @access  ADMIN, MERCHANDISER
 */
router.delete(
  '/:styleId/pattern-parts/:partId',
  authorize('ADMIN', 'MERCHANDISER'),
  deletePatternPartAssignment
);

/**
 * @route   GET /api/styles/:styleId/components/:componentId/cad-pattern-parts
 * @desc    Get pattern parts for a component - CAD-defined parts first, then component master parts
 * @access  All authenticated users
 */
router.get('/:styleId/components/:componentId/cad-pattern-parts', getCADPatternPartsForComponent);

// ============================================================================
// EMBROIDERY CAD ROUTES
// ============================================================================

/**
 * @route   GET /api/styles/:styleId/fabrics/:fabricId/embroidery-cad
 * @desc    Get embroidery CAD for a style fabric
 * @access  All authenticated users
 */
router.get('/:styleId/fabrics/:fabricId/embroidery-cad', getEmbroideryCad);

/**
 * @route   POST /api/styles/:styleId/fabrics/:fabricId/embroidery-cad
 * @desc    Create or update embroidery CAD for a style fabric
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 * @body    { fabricWidthCadId?, embroideryId?, cadMeters?, cadYards?, cadWastagePercent?,
 *           layerMarginMeters?, piecesPerMarker?, markerEfficiency?, printDirection?, notes?,
 *           sizeBreakdowns?: [{ sizeName, sizeId?, quantity }] }
 */
router.post(
  '/:styleId/fabrics/:fabricId/embroidery-cad',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  createOrUpdateEmbroideryCad
);

/**
 * @route   DELETE /api/styles/:styleId/fabrics/:fabricId/embroidery-cad
 * @desc    Delete embroidery CAD for a style fabric
 * @access  ADMIN, MERCHANDISER
 */
router.delete(
  '/:styleId/fabrics/:fabricId/embroidery-cad',
  authorize('ADMIN', 'MERCHANDISER'),
  deleteEmbroideryCad
);

/**
 * @route   GET /api/styles/:styleId/fabrics/:fabricId/total-cad
 * @desc    Get total CAD for a style fabric (Main CAD + Embroidery CAD)
 * @access  All authenticated users
 */
router.get('/:styleId/fabrics/:fabricId/total-cad', getTotalFabricCad);

// ============================================================================
// CAD SPREADSHEET TABLE ROUTES
// ============================================================================

/**
 * @route   GET /api/styles/:styleId/cad-table
 * @desc    Get CAD spreadsheet table data for a style
 * @access  All authenticated users
 */
router.get('/:styleId/cad-table', getCADTableData);

/**
 * @route   POST /api/styles/:styleId/cad-table/row
 * @desc    Add a new CAD row to the spreadsheet table
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 * @body    { purpose?, componentId, styleFabricId, partId?, isEmbroidery? }
 */
router.post(
  '/:styleId/cad-table/row',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  addCADTableRow
);

/**
 * @route   POST /api/styles/:styleId/cad-table/combined-row
 * @desc    Add a COMBINED CAD row from multiple style fabrics with same base fabric
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 * @body    { styleFabricIds: string[], purpose?: string }
 */
router.post(
  '/:styleId/cad-table/combined-row',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  addCombinedCADRow
);

/**
 * @route   PUT /api/styles/:styleId/cad-table/row/:rowId
 * @desc    Update a CAD row in the spreadsheet table
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 * @body    { purpose?, partId?, isEmbroidery?, greigeId?, cutableWidth?, printDirection?, sizeBreakdowns?, cadMeters?, piecesPerMarker? }
 */
router.put(
  '/:styleId/cad-table/row/:rowId',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  updateCADTableRow
);

/**
 * @route   DELETE /api/styles/:styleId/cad-table/row/:rowId
 * @desc    Delete a CAD row from the spreadsheet table
 * @access  ADMIN, MERCHANDISER
 */
router.delete(
  '/:styleId/cad-table/row/:rowId',
  authorize('ADMIN', 'MERCHANDISER'),
  deleteCADTableRow
);

/**
 * @route   GET /api/styles/cad-table/greige/:greigeId/widths
 * @desc    Get available widths for a greige
 * @access  All authenticated users
 */
router.get('/cad-table/greige/:greigeId/widths', getGreigeWidths);

// ============================================
// CAD PURPOSES: COSTING, RAW_MATERIAL_CALCULATION, PRODUCTION
// (Renamed: PLANNING → COSTING, COSTING → RAW_MATERIAL_CALCULATION)
// ============================================

/**
 * @route   POST /api/styles/:styleId/cad-table/row/:rowId/approve
 * @desc    Approve CAD Purpose (COSTING, RAW_MATERIAL_CALCULATION, or PRODUCTION)
 * @access  Admin, Merchandiser
 */
router.post(
  '/:styleId/cad-table/row/:rowId/approve',
  authorize('ADMIN', 'MERCHANDISER'),
  approveCADPurpose
);

/**
 * @route   POST /api/styles/:styleId/cad-table/row/:rowId/reject
 * @desc    Reject CAD Purpose
 * @access  Admin, Merchandiser
 */
router.post(
  '/:styleId/cad-table/row/:rowId/reject',
  authorize('ADMIN', 'MERCHANDISER'),
  rejectCADPurpose
);

/**
 * @route   POST /api/styles/:styleId/cad-table/planning/:rowId/create-version
 * @desc    Create new version of COSTING CAD (route kept as 'planning' for backwards compatibility)
 * @access  Admin, Merchandiser
 */
router.post(
  '/:styleId/cad-table/planning/:rowId/create-version',
  authorize('ADMIN', 'MERCHANDISER'),
  createPlanningVersion
);

/**
 * @route   POST /api/styles/:styleId/cad-table/copy
 * @desc    Copy CAD between purposes (RAW_MATERIAL_CALCULATION→COSTING, COSTING→PRODUCTION)
 * @access  Admin, Merchandiser
 */
router.post(
  '/:styleId/cad-table/copy',
  authorize('ADMIN', 'MERCHANDISER'),
  copyCADPurpose
);

/**
 * @route   POST /api/styles/:styleId/cad-table/link-stock
 * @desc    Link PRODUCTION CAD to fabric stock
 * @access  Admin, Merchandiser
 */
router.post(
  '/:styleId/cad-table/link-stock',
  authorize('ADMIN', 'MERCHANDISER'),
  linkCADToStock
);

// ============================================
// MULTI-ORDER CAD WORKFLOW
// ============================================

/**
 * @route   POST /api/styles/:styleId/cad-planning/production-from-stock
 * @desc    Create PRODUCTION CAD from fabric stock receipt
 *          Allows creating new PRODUCTION CAD rows for new stock lots even after style is approved
 * @access  Admin, Merchandiser, Production Manager
 * @body    { fabricStockId, styleFabricId?, basedOnPlanningCadId?, componentId?, greigeId?, patternPartId? }
 */
router.post(
  '/:styleId/cad-planning/production-from-stock',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  createProductionCADFromStock
);

/**
 * @route   GET /api/styles/:styleId/cad-planning/order-history
 * @desc    Get CAD order usage history for a style
 *          Shows which orders used which PRODUCTION CAD widths
 * @access  All authenticated users
 */
router.get('/:styleId/cad-planning/order-history', getCADOrderHistory);

export default router;
