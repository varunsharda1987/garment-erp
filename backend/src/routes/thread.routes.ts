import { Router } from 'express';
import {
  createThread,
  getAllThreads,
  getThreadById,
  updateThread,
  deleteThread,
  bulkImportThreads,
  downloadTemplate,
  getThreadStock,
} from '../controllers/thread.controller';
import * as threadConversionController from '../controllers/thread-conversion.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createThreadSchema,
  updateThreadSchema,
  convertThreadSchema,
  bulkImportThreadSchema,
  trimMasterQuerySchema,
  trimMasterIdParamSchema,
  threadMasterStockQuerySchema,
} from '../schemas/trimMasters.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// SPECIFIC ROUTES (must come BEFORE /:id)
// ============================================

/**
 * @route   GET /api/materials/thread/template
 * @desc    Download Excel template for bulk import
 * @access  Private
 */
router.get('/template', asyncHandler(downloadTemplate));

/**
 * @route   POST /api/materials/thread/convert
 * @desc    Convert thread quantities (boxes ↔ units ↔ meters)
 * @access  Private
 */
// BUG-INV9 fix: added asyncHandler
router.post(
  '/convert',
  validateBody(convertThreadSchema),
  asyncHandler(threadConversionController.convertThreadQuantity)
);

/**
 * @route   GET /api/materials/thread/packaging-specs
 * @desc    Get all packaging specifications
 * @access  Private
 */
// BUG-INV9 fix: added asyncHandler
router.get('/packaging-specs', asyncHandler(threadConversionController.getPackagingSpecs));

/**
 * @route   POST /api/materials/thread/bulk-import
 * @desc    Bulk import thread items from Excel
 * @access  Private
 */
router.post('/bulk-import', validateBody(bulkImportThreadSchema), asyncHandler(bulkImportThreads));

/**
 * @route   GET /api/materials/thread/:id/stock
 * @desc    Get thread stock information
 * @access  Private
 * @query   requiredUnits, warehouseId
 * BUG-TH5 FIX: Added validateQuery to prevent parseFloat("abc") → NaN
 */
router.get(
  '/:id/stock',
  validateParams(trimMasterIdParamSchema),
  validateQuery(threadMasterStockQuerySchema),
  asyncHandler(getThreadStock)
);

// ============================================
// COLLECTION ROUTES (generic, no params)
// ============================================

/**
 * @route   POST /api/materials/thread
 * @desc    Create a single thread item
 * @access  Private
 */
router.post('/', validateBody(createThreadSchema), asyncHandler(createThread));

/**
 * @route   GET /api/materials/thread
 * @desc    Get all thread items with pagination and search
 * @access  Private
 * @query   page, limit, search, supplierId
 */
router.get('/', validateQuery(trimMasterQuerySchema), asyncHandler(getAllThreads));

// ============================================
// PARAMETER ROUTES (must come LAST)
// ============================================

/**
 * @route   GET /api/materials/thread/:id
 * @desc    Get single thread item by ID
 * @access  Private
 */
router.get('/:id', validateParams(trimMasterIdParamSchema), asyncHandler(getThreadById));

/**
 * @route   PUT /api/materials/thread/:id
 * @desc    Update thread item
 * @access  Private
 */
router.put(
  '/:id',
  validateParams(trimMasterIdParamSchema),
  validateBody(updateThreadSchema),
  asyncHandler(updateThread)
);

/**
 * @route   DELETE /api/materials/thread/:id
 * @desc    Delete thread item
 * @access  Private
 */
router.delete('/:id', validateParams(trimMasterIdParamSchema), asyncHandler(deleteThread));

export default router;
