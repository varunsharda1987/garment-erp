import { Router } from 'express';
import {
  createLace,
  getAllLace,
  getLaceById,
  updateLace,
  deleteLace,
  bulkImportLace,
  downloadTemplate
} from '../controllers/lace.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/materials/lace
 * @desc    Create a single lace item
 * @access  Private
 */
router.post('/', createLace);

/**
 * @route   GET /api/materials/lace
 * @desc    Get all lace items with pagination and search
 * @access  Private
 * @query   page, limit, search, supplierId
 */
router.get('/', getAllLace);

/**
 * @route   GET /api/materials/lace/template
 * @desc    Download Excel template for bulk import
 * @access  Private
 */
router.get('/template', downloadTemplate);

/**
 * @route   GET /api/materials/lace/:id
 * @desc    Get single lace item by ID
 * @access  Private
 */
router.get('/:id', getLaceById);

/**
 * @route   PUT /api/materials/lace/:id
 * @desc    Update lace item
 * @access  Private
 */
router.put('/:id', updateLace);

/**
 * @route   DELETE /api/materials/lace/:id
 * @desc    Delete lace item
 * @access  Private
 */
router.delete('/:id', deleteLace);

/**
 * @route   POST /api/materials/lace/bulk-import
 * @desc    Bulk import lace items from Excel
 * @access  Private
 */
router.post('/bulk-import', bulkImportLace);

export default router;
