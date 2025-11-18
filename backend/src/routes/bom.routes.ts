import express from 'express';
import { UserRole } from '@prisma/client';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import * as bomController from '../controllers/bom.controller';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/bom
 * @desc    Create a new Bill of Materials
 * @access  Admin, Production Manager, Merchandiser
 */
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.MERCHANDISER),
  bomController.createBOM
);

/**
 * @route   GET /api/bom
 * @desc    Get all BOMs with filtering and pagination
 * @access  All authenticated users
 * @query   styleId, isActive, approved, page, limit, search
 */
router.get('/', bomController.getAllBOMs);

/**
 * @route   GET /api/bom/:id
 * @desc    Get a single BOM by ID
 * @access  All authenticated users
 */
router.get('/:id', bomController.getBOMById);

/**
 * @route   GET /api/bom/style/:styleId/active
 * @desc    Get active BOM for a style
 * @access  All authenticated users
 */
router.get('/style/:styleId/active', bomController.getActiveBOMByStyle);

/**
 * @route   GET /api/bom/style/:styleId/versions
 * @desc    Get all BOM versions for a style
 * @access  All authenticated users
 */
router.get('/style/:styleId/versions', bomController.getBOMVersionsByStyle);

/**
 * @route   PUT /api/bom/:id
 * @desc    Update a BOM (only if not approved)
 * @access  Admin, Production Manager, Merchandiser
 */
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.MERCHANDISER),
  bomController.updateBOM
);

/**
 * @route   PATCH /api/bom/:id/approve
 * @desc    Approve or reject a BOM
 * @access  Admin, Production Manager
 */
router.patch(
  '/:id/approve',
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER),
  bomController.approveBOM
);

/**
 * @route   DELETE /api/bom/:id
 * @desc    Delete (deactivate) a BOM
 * @access  Admin, Production Manager
 */
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER),
  bomController.deleteBOM
);

/**
 * @route   POST /api/bom/:id/calculate
 * @desc    Calculate material requirements for a given order quantity
 * @access  All authenticated users
 */
router.post('/:id/calculate', bomController.calculateMaterialRequirements);

export default router;
