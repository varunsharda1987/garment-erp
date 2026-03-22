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
router.post('/convert', threadConversionController.convertThreadQuantity);

/**
 * @route   GET /api/materials/thread/packaging-specs
 * @desc    Get all packaging specifications
 * @access  Private
 */
router.get('/packaging-specs', threadConversionController.getPackagingSpecs);

/**
 * @route   POST /api/materials/thread/bulk-import
 * @desc    Bulk import thread items from Excel
 * @access  Private
 */
router.post('/bulk-import', asyncHandler(bulkImportThreads));

/**
 * @route   GET /api/materials/thread/:id/stock
 * @desc    Get thread stock information
 * @access  Private
 * @query   requiredUnits, warehouseId
 */
router.get('/:id/stock', asyncHandler(getThreadStock));

// ============================================
// COLLECTION ROUTES (generic, no params)
// ============================================

/**
 * @route   POST /api/materials/thread
 * @desc    Create a single thread item
 * @access  Private
 */
router.post('/', asyncHandler(createThread));

/**
 * @route   GET /api/materials/thread
 * @desc    Get all thread items with pagination and search
 * @access  Private
 * @query   page, limit, search, supplierId
 */
router.get('/', asyncHandler(getAllThreads));

// ============================================
// PARAMETER ROUTES (must come LAST)
// ============================================

/**
 * @route   GET /api/materials/thread/:id
 * @desc    Get single thread item by ID
 * @access  Private
 */
router.get('/:id', asyncHandler(getThreadById));

/**
 * @route   PUT /api/materials/thread/:id
 * @desc    Update thread item
 * @access  Private
 */
router.put('/:id', asyncHandler(updateThread));

/**
 * @route   DELETE /api/materials/thread/:id
 * @desc    Delete thread item
 * @access  Private
 */
router.delete('/:id', asyncHandler(deleteThread));

export default router;
