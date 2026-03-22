import { Router } from 'express';
import {
  createZipper,
  getAllZipper,
  getZipperById,
  updateZipper,
  deleteZipper,
  bulkImportZipper,
  downloadTemplate,
} from '../controllers/zipper.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/materials/zipper
 * @desc    Create a single zipper item
 * @access  Private
 */
router.post('/', asyncHandler(createZipper));

/**
 * @route   GET /api/materials/zipper
 * @desc    Get all zipper items with pagination and search
 * @access  Private
 * @query   page, limit, search, supplierId
 */
router.get('/', asyncHandler(getAllZipper));

/**
 * @route   GET /api/materials/zipper/template
 * @desc    Download Excel template for bulk import
 * @access  Private
 */
router.get('/template', asyncHandler(downloadTemplate));

/**
 * @route   GET /api/materials/zipper/:id
 * @desc    Get single zipper item by ID
 * @access  Private
 */
router.get('/:id', asyncHandler(getZipperById));

/**
 * @route   PUT /api/materials/zipper/:id
 * @desc    Update zipper item
 * @access  Private
 */
router.put('/:id', asyncHandler(updateZipper));

/**
 * @route   DELETE /api/materials/zipper/:id
 * @desc    Delete zipper item
 * @access  Private
 */
router.delete('/:id', asyncHandler(deleteZipper));

/**
 * @route   POST /api/materials/zipper/bulk-import
 * @desc    Bulk import zipper items from Excel
 * @access  Private
 */
router.post('/bulk-import', asyncHandler(bulkImportZipper));

export default router;
