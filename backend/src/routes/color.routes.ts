/**
 * Color Master Routes
 * API routes for color master operations
 */

import { Router } from 'express';
import {
  createColor,
  getAllColors,
  getColorById,
  updateColor,
  deleteColor,
  searchColors,
  getColorFamilies,
  bulkImportColors,
  getImportTemplate,
} from '../controllers/color.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createColorSchema,
  updateColorSchema,
  colorQuerySchema,
  colorIdParamSchema,
  colorSearchSchema,
  colorBulkImportSchema,
} from '../schemas/color.schema';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/colors/search
 * @desc    Search colors for dropdown (minimal data)
 * @access  Private (Authenticated users)
 */
router.get('/search', validateQuery(colorSearchSchema), asyncHandler(searchColors));

/**
 * @route   GET /api/colors/families
 * @desc    Get color families (fixed list)
 * @access  Private (Authenticated users)
 */
router.get('/families', asyncHandler(getColorFamilies));

/**
 * @route   GET /api/colors/template
 * @desc    Get import template structure
 * @access  Private (Authenticated users)
 */
router.get('/template', asyncHandler(getImportTemplate));

/**
 * @route   POST /api/colors/bulk-import
 * @desc    Bulk import colors
 * @access  Private (Authenticated users)
 */
router.post('/bulk-import', validateBody(colorBulkImportSchema), asyncHandler(bulkImportColors));

/**
 * @route   POST /api/colors
 * @desc    Create new color
 * @access  Private (Authenticated users)
 */
router.post('/', validateBody(createColorSchema), asyncHandler(createColor));

/**
 * @route   GET /api/colors
 * @desc    Get all colors with pagination and filters
 * @access  Private (Authenticated users)
 */
router.get('/', validateQuery(colorQuerySchema), asyncHandler(getAllColors));

/**
 * @route   GET /api/colors/:id
 * @desc    Get color by ID
 * @access  Private (Authenticated users)
 */
router.get('/:id', validateParams(colorIdParamSchema), asyncHandler(getColorById));

/**
 * @route   PUT /api/colors/:id
 * @desc    Update color
 * @access  Private (Authenticated users)
 */
router.put('/:id', validateParams(colorIdParamSchema), validateBody(updateColorSchema), asyncHandler(updateColor));

/**
 * @route   DELETE /api/colors/:id
 * @desc    Delete color (soft delete)
 * @access  Private (Authenticated users)
 */
router.delete('/:id', validateParams(colorIdParamSchema), asyncHandler(deleteColor));

export default router;
