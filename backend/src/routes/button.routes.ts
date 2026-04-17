import { Router } from 'express';
import {
  createButton,
  getAllButtons,
  getButtonById,
  updateButton,
  deleteButton,
  bulkImportButtons,
  downloadTemplate,
} from '../controllers/button.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  createButtonSchema,
  updateButtonSchema,
  bulkImportButtonSchema,
  trimMasterQuerySchema,
} from '../schemas/trimMasters.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/materials/button
 * @desc    Create a single button item
 * @access  Private
 */
router.post('/', validateBody(createButtonSchema), asyncHandler(createButton));

/**
 * @route   GET /api/materials/button
 * @desc    Get all button items with pagination and search
 * @access  Private
 * @query   page, limit, search, supplierId
 */
router.get('/', validateQuery(trimMasterQuerySchema), asyncHandler(getAllButtons));

/**
 * @route   GET /api/materials/button/template
 * @desc    Download Excel template for bulk import
 * @access  Private
 */
router.get('/template', asyncHandler(downloadTemplate));

/**
 * @route   GET /api/materials/button/:id
 * @desc    Get single button item by ID
 * @access  Private
 */
router.get('/:id', asyncHandler(getButtonById));

/**
 * @route   PUT /api/materials/button/:id
 * @desc    Update button item
 * @access  Private
 */
router.put('/:id', validateBody(updateButtonSchema), asyncHandler(updateButton));

/**
 * @route   DELETE /api/materials/button/:id
 * @desc    Delete button item
 * @access  Private
 */
router.delete('/:id', asyncHandler(deleteButton));

/**
 * @route   POST /api/materials/button/bulk-import
 * @desc    Bulk import button items from Excel
 * @access  Private
 */
router.post('/bulk-import', validateBody(bulkImportButtonSchema), asyncHandler(bulkImportButtons));

export default router;
