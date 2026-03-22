import { Router } from 'express';
import {
  createLabel,
  getAllLabel,
  getLabelById,
  updateLabel,
  deleteLabel,
  bulkImportLabel,
  downloadTemplate,
} from '../controllers/label.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/materials/label
 * @desc    Create a single label item
 * @access  Private
 */
router.post('/', asyncHandler(createLabel));

/**
 * @route   GET /api/materials/label
 * @desc    Get all label items with pagination and search
 * @access  Private
 * @query   page, limit, search, supplierId
 */
router.get('/', asyncHandler(getAllLabel));

/**
 * @route   GET /api/materials/label/template
 * @desc    Download Excel template for bulk import
 * @access  Private
 */
router.get('/template', asyncHandler(downloadTemplate));

/**
 * @route   GET /api/materials/label/:id
 * @desc    Get single label item by ID
 * @access  Private
 */
router.get('/:id', asyncHandler(getLabelById));

/**
 * @route   PUT /api/materials/label/:id
 * @desc    Update label item
 * @access  Private
 */
router.put('/:id', asyncHandler(updateLabel));

/**
 * @route   DELETE /api/materials/label/:id
 * @desc    Delete label item
 * @access  Private
 */
router.delete('/:id', asyncHandler(deleteLabel));

/**
 * @route   POST /api/materials/label/bulk-import
 * @desc    Bulk import label items from Excel
 * @access  Private
 */
router.post('/bulk-import', asyncHandler(bulkImportLabel));

export default router;
