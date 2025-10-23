// Style Master routes
import { Router } from 'express';
import {
  createStyle,
  getAllStyles,
  getStyleById,
  updateStyle,
  deleteStyle,
  uploadStyleImage,
} from '../controllers/style.controller';
import {
  createComponent,
  updateComponent,
  deleteComponent,
  createFabric,
  updateFabric,
  deleteFabric,
  createAccessory,
  updateAccessory,
  deleteAccessory,
  createProcess,
  updateProcess,
  deleteProcess,
} from '../controllers/styleComponent.controller';
import {
  createOrUpdateCosting,
  getCosting,
  calculateCosting,
} from '../controllers/styleCosting.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { uploadStyleImage as uploadMiddleware } from '../middleware/upload.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// STYLE ROUTES
// ============================================

/**
 * @route   POST /api/styles
 * @desc    Create new style
 * @access  Protected - Admin, Merchandiser
 */
router.post('/', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), createStyle);

/**
 * @route   GET /api/styles
 * @desc    Get all styles (paginated, searchable, filterable by stage)
 * @access  Protected - All authenticated users
 */
router.get('/', getAllStyles);

/**
 * @route   GET /api/styles/:id
 * @desc    Get style by ID with all related data
 * @access  Protected - All authenticated users
 */
router.get('/:id', getStyleById);

/**
 * @route   PUT /api/styles/:id
 * @desc    Update style
 * @access  Protected - Admin, Merchandiser
 */
router.put('/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), updateStyle);

/**
 * @route   DELETE /api/styles/:id
 * @desc    Delete (deactivate) style
 * @access  Protected - Admin only
 */
router.delete('/:id', authorize(UserRole.ADMIN), deleteStyle);

/**
 * @route   POST /api/styles/:id/image
 * @desc    Upload style image
 * @access  Protected - Admin, Merchandiser
 */
router.post(
  '/:id/image',
  authorize(UserRole.ADMIN, UserRole.MERCHANDISER),
  uploadMiddleware,
  uploadStyleImage
);

/**
 * @route   PUT /api/styles/:id/production-stage
 * @desc    Update production stage for a style
 * @access  Protected - Admin, Production Manager, Merchandiser
 */
router.put(
  '/:id/production-stage',
  authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.MERCHANDISER),
);

// ============================================
// COMPONENT ROUTES
// ============================================

/**
 * @route   POST /api/styles/:styleId/components
 * @desc    Add component to style
 * @access  Protected - Admin, Merchandiser
 */
router.post(
  '/:styleId/components',
  authorize(UserRole.ADMIN, UserRole.MERCHANDISER),
  createComponent
);

/**
 * @route   PUT /api/components/:id
 * @desc    Update component
 * @access  Protected - Admin, Merchandiser
 */
router.put('/components/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), updateComponent);

/**
 * @route   DELETE /api/components/:id
 * @desc    Delete component
 * @access  Protected - Admin, Merchandiser
 */
router.delete('/components/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), deleteComponent);

// ============================================
// FABRIC ROUTES
// ============================================

/**
 * @route   POST /api/components/:componentId/fabrics
 * @desc    Add fabric to component
 * @access  Protected - Admin, Merchandiser
 */
router.post(
  '/components/:componentId/fabrics',
  authorize(UserRole.ADMIN, UserRole.MERCHANDISER),
  createFabric
);

/**
 * @route   PUT /api/fabrics/:id
 * @desc    Update fabric (including CAD averages)
 * @access  Protected - Admin, Merchandiser
 */
router.put('/fabrics/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), updateFabric);

/**
 * @route   DELETE /api/fabrics/:id
 * @desc    Delete fabric
 * @access  Protected - Admin, Merchandiser
 */
router.delete('/fabrics/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), deleteFabric);

// ============================================
// ACCESSORY ROUTES
// ============================================

/**
 * @route   POST /api/components/:componentId/accessories
 * @desc    Add accessory to component
 * @access  Protected - Admin, Merchandiser
 */
router.post(
  '/components/:componentId/accessories',
  authorize(UserRole.ADMIN, UserRole.MERCHANDISER),
  createAccessory
);

/**
 * @route   PUT /api/accessories/:id
 * @desc    Update accessory
 * @access  Protected - Admin, Merchandiser
 */
router.put('/accessories/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), updateAccessory);

/**
 * @route   DELETE /api/accessories/:id
 * @desc    Delete accessory
 * @access  Protected - Admin, Merchandiser
 */
router.delete('/accessories/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), deleteAccessory);

// ============================================
// PROCESS ROUTES
// ============================================

/**
 * @route   POST /api/styles/:styleId/processes
 * @desc    Add process to style
 * @access  Protected - Admin, Merchandiser
 */
router.post(
  '/:styleId/processes',
  authorize(UserRole.ADMIN, UserRole.MERCHANDISER),
  createProcess
);

/**
 * @route   PUT /api/processes/:id
 * @desc    Update process
 * @access  Protected - Admin, Merchandiser
 */
router.put('/processes/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), updateProcess);

/**
 * @route   DELETE /api/processes/:id
 * @desc    Delete process
 * @access  Protected - Admin, Merchandiser
 */
router.delete('/processes/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), deleteProcess);

// ============================================
// COSTING ROUTES
// ============================================

/**
 * @route   POST /api/styles/:styleId/costing
 * @desc    Create or update costing
 * @access  Protected - Admin, Merchandiser
 */
router.post(
  '/:styleId/costing',
  authorize(UserRole.ADMIN, UserRole.MERCHANDISER),
  createOrUpdateCosting
);

/**
 * @route   GET /api/styles/:styleId/costing
 * @desc    Get costing for style
 * @access  Protected - All authenticated users
 */
router.get('/:styleId/costing', getCosting);

/**
 * @route   POST /api/styles/:styleId/costing/calculate
 * @desc    Auto-calculate costing from components
 * @access  Protected - Admin, Merchandiser
 */
router.post(
  '/:styleId/costing/calculate',
  authorize(UserRole.ADMIN, UserRole.MERCHANDISER),
  calculateCosting
);

export default router;
