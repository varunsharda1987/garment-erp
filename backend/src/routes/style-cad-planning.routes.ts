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

export default router;
