import { Router } from 'express';
import {
  createLabel,
  getAllLabel,
  getLabelById,
  updateLabel,
  deleteLabel,
  bulkImportLabel,
  downloadTemplate
} from '../controllers/label.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/materials/label
 * @desc    Create a single label item
 * @access  Private
 */
router.post('/', createLabel);

/**
 * @route   GET /api/materials/label
 * @desc    Get all label items with pagination and search
 * @access  Private
 * @query   page, limit, search, supplierId
 */
router.get('/', getAllLabel);

/**
 * @route   GET /api/materials/label/template
 * @desc    Download Excel template for bulk import
 * @access  Private
 */
router.get('/template', downloadTemplate);

/**
 * @route   GET /api/materials/label/:id
 * @desc    Get single label item by ID
 * @access  Private
 */
router.get('/:id', getLabelById);

/**
 * @route   PUT /api/materials/label/:id
 * @desc    Update label item
 * @access  Private
 */
router.put('/:id', updateLabel);

/**
 * @route   DELETE /api/materials/label/:id
 * @desc    Delete label item
 * @access  Private
 */
router.delete('/:id', deleteLabel);

/**
 * @route   POST /api/materials/label/bulk-import
 * @desc    Bulk import label items from Excel
 * @access  Private
 */
router.post('/bulk-import', bulkImportLabel);

export default router;
