// Style Master routes
import { Router } from 'express';
import {
  createStyle,
  getAllStyles,
  getStyleById,
  updateStyle,
  deleteStyle,
  permanentDeleteStyle,
  restoreStyle,
  getDeletedStyles,
  uploadStyleImage,
  createStyleVariants,
  getAllDrafts,
  getDraftById,
  deleteDraft,
  publishDraft,
  updateCADGrouping,
  approveCADPlan,
  canDeactivateStyle,
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
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { uploadStyleImage as uploadMiddleware } from '../middleware/upload.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { createStyleSchema, updateStyleSchema, styleQuerySchema, styleIdParamSchema } from '../schemas/style.schema';
import { UserRole } from '@prisma/client';
import { getStockForStyle } from '../controllers/fabric-stock.controller';

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
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MERCHANDISER),
  validateBody(createStyleSchema),
  asyncHandler(createStyle)
);

/**
 * @route   GET /api/styles/drafts
 * @desc    Get all draft styles
 * @access  Protected - All authenticated users
 */
router.get('/drafts', asyncHandler(getAllDrafts));

/**
 * @route   GET /api/styles/drafts/:id
 * @desc    Get specific draft by ID
 * @access  Protected - All authenticated users
 */
router.get('/drafts/:id', asyncHandler(getDraftById));

/**
 * @route   DELETE /api/styles/drafts/:id
 * @desc    Delete a draft
 * @access  Protected - Admin, Merchandiser
 */
router.delete('/drafts/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(deleteDraft));

/**
 * @route   GET /api/styles/deleted
 * @desc    Get all deleted/archived styles
 * @access  Protected - Admin, Merchandiser
 */
router.get('/deleted', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(getDeletedStyles));

/**
 * @route   GET /api/styles
 * @desc    Get all styles (paginated, searchable, filterable by stage)
 * @access  Protected - All authenticated users
 */
router.get('/', validateQuery(styleQuerySchema), asyncHandler(getAllStyles));

/**
 * @route   GET /api/styles/:id
 * @desc    Get style by ID with all related data
 * @access  Protected - All authenticated users
 */
router.get('/:id', validateParams(styleIdParamSchema), asyncHandler(getStyleById));

/**
 * @route   PUT /api/styles/:id
 * @desc    Update style
 * @access  Protected - Admin, Merchandiser
 */
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MERCHANDISER),
  validateParams(styleIdParamSchema),
  validateBody(updateStyleSchema),
  asyncHandler(updateStyle)
);

/**
 * @route   DELETE /api/styles/:id
 * @desc    Delete (deactivate) style
 * @access  Protected - Admin only
 */
router.delete('/:id', authorize(UserRole.ADMIN), validateParams(styleIdParamSchema), asyncHandler(deleteStyle));

/**
 * @route   GET /api/styles/:id/can-deactivate
 * @desc    Check if style can be deactivated
 * @access  Protected - Admin, Merchandiser
 */
router.get(
  '/:id/can-deactivate',
  authorize(UserRole.ADMIN, UserRole.MERCHANDISER),
  validateParams(styleIdParamSchema),
  asyncHandler(canDeactivateStyle)
);

/**
 * @route   GET /api/styles/:id/fabric-stock
 * @desc    Get available fabric stock for a style (for CAD planning)
 * @access  Protected - All authenticated users
 */
router.get('/:id/fabric-stock', asyncHandler(getStockForStyle));

/**
 * @route   POST /api/styles/:id/image
 * @desc    Upload style image
 * @access  Protected - Admin, Merchandiser
 */
router.post(
  '/:id/image',
  authorize(UserRole.ADMIN, UserRole.MERCHANDISER),
  uploadMiddleware,
  asyncHandler(uploadStyleImage)
);

/**
 * @route   POST /api/styles/:id/variants
 * @desc    Create or update style variants with SKUs
 * @access  Protected - Admin, Merchandiser
 */
router.post('/:id/variants', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(createStyleVariants));

/**
 * @route   POST /api/styles/:id/publish
 * @desc    Publish a draft style (convert to ACTIVE status)
 * @access  Protected - Admin, Merchandiser
 */
router.post('/:id/publish', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(publishDraft));

// ============================================
// CAD PLANNING ROUTES
// ============================================
// NOTE: CAD Planning routes are now in style-cad-planning.routes.ts
// The getEnhancedCADPlanning function provides greige options lookup
// ============================================

/**
 * @route   POST /api/styles/:id/cad-groups
 * @desc    Update CAD grouping for style fabrics
 * @access  Protected - Admin, Merchandiser
 */
router.post('/:id/cad-groups', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(updateCADGrouping));

/**
 * @route   PUT /api/styles/:id/approve-cad
 * @desc    Approve CAD plan and link fabrics to selected CAD entries
 * @access  Protected - Admin, Merchandiser
 */
router.put('/:id/approve-cad', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(approveCADPlan));

/**
 * @route   POST /api/styles/:id/restore
 * @desc    Restore a soft-deleted style
 * @access  Protected - Admin, Merchandiser
 */
router.post('/:id/restore', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(restoreStyle));

/**
 * @route   DELETE /api/styles/:id/permanent
 * @desc    Permanently delete a style (hard delete)
 * @access  Protected - Admin only
 */
router.delete('/:id/permanent', authorize(UserRole.ADMIN), asyncHandler(permanentDeleteStyle));

// ============================================
// COMPONENT ROUTES
// ============================================

/**
 * @route   POST /api/styles/:styleId/components
 * @desc    Add component to style
 * @access  Protected - Admin, Merchandiser
 */
router.post('/:styleId/components', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(createComponent));

/**
 * @route   PUT /api/components/:id
 * @desc    Update component
 * @access  Protected - Admin, Merchandiser
 */
router.put('/components/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(updateComponent));

/**
 * @route   DELETE /api/components/:id
 * @desc    Delete component
 * @access  Protected - Admin, Merchandiser
 */
router.delete('/components/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(deleteComponent));

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
  asyncHandler(createFabric)
);

/**
 * @route   PUT /api/fabrics/:id
 * @desc    Update fabric (including CAD averages)
 * @access  Protected - Admin, Merchandiser
 */
router.put('/fabrics/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(updateFabric));

/**
 * @route   DELETE /api/fabrics/:id
 * @desc    Delete fabric
 * @access  Protected - Admin, Merchandiser
 */
router.delete('/fabrics/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(deleteFabric));

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
  asyncHandler(createAccessory)
);

/**
 * @route   PUT /api/accessories/:id
 * @desc    Update accessory
 * @access  Protected - Admin, Merchandiser
 */
router.put('/accessories/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(updateAccessory));

/**
 * @route   DELETE /api/accessories/:id
 * @desc    Delete accessory
 * @access  Protected - Admin, Merchandiser
 */
router.delete('/accessories/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(deleteAccessory));

// ============================================
// PROCESS ROUTES
// ============================================

/**
 * @route   POST /api/styles/:styleId/processes
 * @desc    Add process to style
 * @access  Protected - Admin, Merchandiser
 */
router.post('/:styleId/processes', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(createProcess));

/**
 * @route   PUT /api/processes/:id
 * @desc    Update process
 * @access  Protected - Admin, Merchandiser
 */
router.put('/processes/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(updateProcess));

/**
 * @route   DELETE /api/processes/:id
 * @desc    Delete process
 * @access  Protected - Admin, Merchandiser
 */
router.delete('/processes/:id', authorize(UserRole.ADMIN, UserRole.MERCHANDISER), asyncHandler(deleteProcess));

// ============================================
// COSTING ROUTES
// ============================================

// Note: Costing routes have been moved to /api/style-costing
// See styleCosting.routes.ts for cost sheet management

export default router;
