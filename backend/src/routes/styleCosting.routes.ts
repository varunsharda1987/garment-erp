import express from 'express';
import { UserRole } from '@prisma/client';
import {
  createCostSheet,
  getAllCostSheets,
  getCostSheetById,
  getCostSheetByStyle,
  updateCostSheet,
  approveCostSheet,
  deleteCostSheet,
  generateCostSheetFromStyle,
} from '../controllers/styleCosting.controller';
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
 * @access  Private (ADMIN, PRODUCTION_MANAGER)
 */
router.patch(
  '/:id/approve',
  authenticateToken,
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER),
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

export default router;
