import { Router } from 'express';
import {
  getPendingCADStyles,
  generateCADOptions,
  calculateCADCost,
  approveCAD,
  updateCADValues,
  getGreigeOptionsForGeneric,
  getStyleCADSummary,
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
 * @route   GET /api/styles/:styleId/cad-summary
 * @desc    Get CAD planning summary for a style
 * @access  All authenticated users
 */
router.get('/:styleId/cad-summary', getStyleCADSummary);

/**
 * @route   POST /api/styles/cad-planning/generate
 * @desc    Generate CAD options for a style's fabric
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 * @body    { styleId, genericFabricName, greigeId, widths? }
 */
router.post(
  '/cad-planning/generate',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  generateCADOptions
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
 * @desc    Update CAD values for a specific width
 * @access  ADMIN, MERCHANDISER, PRODUCTION_MANAGER
 * @body    { cadMeters?, cadYards?, cadWastagePercent?, markerEfficiency?, notes? }
 */
router.put(
  '/cad-planning/update-cad/:cadId',
  authorize('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'),
  updateCADValues
);

export default router;
