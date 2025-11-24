import { Router } from 'express';
import {
  createPackaging,
  getAllPackaging,
  getPackagingById,
  updatePackaging,
  deletePackaging,
  bulkImportPackaging,
  downloadTemplate
} from '../controllers/packaging.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/materials/packaging
 * @desc    Create a single packaging item
 * @access  Private
 */
router.post('/', createPackaging);

/**
 * @route   GET /api/materials/packaging
 * @desc    Get all packaging items with pagination and search
 * @access  Private
 * @query   page, limit, search, supplierId
 */
router.get('/', getAllPackaging);

/**
 * @route   GET /api/materials/packaging/template
 * @desc    Download Excel template for bulk import
 * @access  Private
 */
router.get('/template', downloadTemplate);

/**
 * @route   GET /api/materials/packaging/:id
 * @desc    Get single packaging item by ID
 * @access  Private
 */
router.get('/:id', getPackagingById);

/**
 * @route   PUT /api/materials/packaging/:id
 * @desc    Update packaging item
 * @access  Private
 */
router.put('/:id', updatePackaging);

/**
 * @route   DELETE /api/materials/packaging/:id
 * @desc    Delete packaging item
 * @access  Private
 */
router.delete('/:id', deletePackaging);

/**
 * @route   POST /api/materials/packaging/bulk-import
 * @desc    Bulk import packaging items from Excel
 * @access  Private
 */
router.post('/bulk-import', bulkImportPackaging);

export default router;
