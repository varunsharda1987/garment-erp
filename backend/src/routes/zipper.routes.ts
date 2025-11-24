import { Router } from 'express';
import {
  createZipper,
  getAllZipper,
  getZipperById,
  updateZipper,
  deleteZipper,
  bulkImportZipper,
  downloadTemplate
} from '../controllers/zipper.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/materials/zipper
 * @desc    Create a single zipper item
 * @access  Private
 */
router.post('/', createZipper);

/**
 * @route   GET /api/materials/zipper
 * @desc    Get all zipper items with pagination and search
 * @access  Private
 * @query   page, limit, search, supplierId
 */
router.get('/', getAllZipper);

/**
 * @route   GET /api/materials/zipper/template
 * @desc    Download Excel template for bulk import
 * @access  Private
 */
router.get('/template', downloadTemplate);

/**
 * @route   GET /api/materials/zipper/:id
 * @desc    Get single zipper item by ID
 * @access  Private
 */
router.get('/:id', getZipperById);

/**
 * @route   PUT /api/materials/zipper/:id
 * @desc    Update zipper item
 * @access  Private
 */
router.put('/:id', updateZipper);

/**
 * @route   DELETE /api/materials/zipper/:id
 * @desc    Delete zipper item
 * @access  Private
 */
router.delete('/:id', deleteZipper);

/**
 * @route   POST /api/materials/zipper/bulk-import
 * @desc    Bulk import zipper items from Excel
 * @access  Private
 */
router.post('/bulk-import', bulkImportZipper);

export default router;
