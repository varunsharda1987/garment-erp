import { Router } from 'express';
import {
  createThread,
  getAllThreads,
  getThreadById,
  updateThread,
  deleteThread,
  bulkImportThreads,
  downloadTemplate,
  getThreadStock
} from '../controllers/thread.controller';
import * as threadConversionController from '../controllers/thread-conversion.controller';
import { authenticateToken } from '../middleware/auth.middleware';

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
router.get('/template', downloadTemplate);

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
router.post('/bulk-import', bulkImportThreads);

/**
 * @route   GET /api/materials/thread/:id/stock
 * @desc    Get thread stock information
 * @access  Private
 * @query   requiredUnits, warehouseId
 */
router.get('/:id/stock', getThreadStock);

// ============================================
// COLLECTION ROUTES (generic, no params)
// ============================================

/**
 * @route   POST /api/materials/thread
 * @desc    Create a single thread item
 * @access  Private
 */
router.post('/', createThread);

/**
 * @route   GET /api/materials/thread
 * @desc    Get all thread items with pagination and search
 * @access  Private
 * @query   page, limit, search, supplierId
 */
router.get('/', getAllThreads);

// ============================================
// PARAMETER ROUTES (must come LAST)
// ============================================

/**
 * @route   GET /api/materials/thread/:id
 * @desc    Get single thread item by ID
 * @access  Private
 */
router.get('/:id', getThreadById);

/**
 * @route   PUT /api/materials/thread/:id
 * @desc    Update thread item
 * @access  Private
 */
router.put('/:id', updateThread);

/**
 * @route   DELETE /api/materials/thread/:id
 * @desc    Delete thread item
 * @access  Private
 */
router.delete('/:id', deleteThread);

export default router;
