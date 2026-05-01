import { Router } from 'express';
import {
  createElastic,
  getAllElastic,
  getElasticById,
  updateElastic,
  deleteElastic,
  bulkImportElastic,
  downloadTemplate,
} from '../controllers/elastic.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createElasticSchema,
  updateElasticSchema,
  bulkImportElasticSchema,
  trimMasterQuerySchema,
  trimMasterIdParamSchema,
} from '../schemas/trimMasters.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/materials/elastic
 * @desc    Create a single elastic item
 * @access  Private
 */
router.post('/', validateBody(createElasticSchema), asyncHandler(createElastic));

/**
 * @route   GET /api/materials/elastic
 * @desc    Get all elastic items with pagination and search
 * @access  Private
 * @query   page, limit, search, supplierId
 */
router.get('/', validateQuery(trimMasterQuerySchema), asyncHandler(getAllElastic));

/**
 * @route   GET /api/materials/elastic/template
 * @desc    Download Excel template for bulk import
 * @access  Private
 */
router.get('/template', asyncHandler(downloadTemplate));

/**
 * @route   GET /api/materials/elastic/:id
 * @desc    Get single elastic item by ID
 * @access  Private
 */
router.get('/:id', validateParams(trimMasterIdParamSchema), asyncHandler(getElasticById));

/**
 * @route   PUT /api/materials/elastic/:id
 * @desc    Update elastic item
 * @access  Private
 */
router.put(
  '/:id',
  validateParams(trimMasterIdParamSchema),
  validateBody(updateElasticSchema),
  asyncHandler(updateElastic)
);

/**
 * @route   DELETE /api/materials/elastic/:id
 * @desc    Delete elastic item
 * @access  Private
 */
router.delete('/:id', validateParams(trimMasterIdParamSchema), asyncHandler(deleteElastic));

/**
 * @route   POST /api/materials/elastic/bulk-import
 * @desc    Bulk import elastic items from Excel
 * @access  Private
 */
router.post('/bulk-import', validateBody(bulkImportElasticSchema), asyncHandler(bulkImportElastic));

export default router;
