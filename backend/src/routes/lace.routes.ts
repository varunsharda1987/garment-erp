import { Router } from 'express';
import {
  createLace,
  getAllLace,
  getLaceById,
  updateLace,
  deleteLace,
  bulkImportLace,
  downloadTemplate,
  getGreigeLace,
  getFinishedLace,
  getLaceForCosting,
} from '../controllers/lace.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createLaceSchema,
  updateLaceSchema,
  bulkImportLaceSchema,
  trimMasterQuerySchema,
  trimMasterIdParamSchema,
} from '../schemas/trimMasters.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/materials/lace
 * @desc    Create a single lace item (supports both greige and finished lace)
 * @access  Private
 * @body    isGreige, expectedShrinkagePercent, costPerMeterGreige for greige lace
 */
router.post('/', validateBody(createLaceSchema), asyncHandler(createLace));

/**
 * @route   GET /api/materials/lace
 * @desc    Get all lace items with pagination and search
 * @access  Private
 * @query   page, limit, search, supplierId, isGreige (filter by greige status)
 */
router.get('/', validateQuery(trimMasterQuerySchema), asyncHandler(getAllLace));

/**
 * @route   GET /api/materials/lace/greige
 * @desc    Get greige (raw) lace items only - for dyeing/processing selection
 * @access  Private
 * @query   page, limit, search
 */
router.get('/greige', asyncHandler(getGreigeLace));

/**
 * @route   GET /api/materials/lace/finished
 * @desc    Get finished (ready-to-use) lace items only
 * @access  Private
 * @query   page, limit, search, color
 */
router.get('/finished', asyncHandler(getFinishedLace));

/**
 * @route   GET /api/materials/lace/for-costing
 * @desc    Get lace items formatted for cost sheet selection
 * @access  Private
 * @query   search
 */
router.get('/for-costing', asyncHandler(getLaceForCosting));

/**
 * @route   GET /api/materials/lace/template
 * @desc    Download Excel template for bulk import
 * @access  Private
 */
router.get('/template', asyncHandler(downloadTemplate));

/**
 * @route   GET /api/materials/lace/:id
 * @desc    Get single lace item by ID
 * @access  Private
 */
router.get('/:id', validateParams(trimMasterIdParamSchema), asyncHandler(getLaceById));

/**
 * @route   PUT /api/materials/lace/:id
 * @desc    Update lace item
 * @access  Private
 */
router.put('/:id', validateParams(trimMasterIdParamSchema), validateBody(updateLaceSchema), asyncHandler(updateLace));

/**
 * @route   DELETE /api/materials/lace/:id
 * @desc    Delete lace item
 * @access  Private
 */
router.delete('/:id', validateParams(trimMasterIdParamSchema), asyncHandler(deleteLace));

/**
 * @route   POST /api/materials/lace/bulk-import
 * @desc    Bulk import lace items from Excel
 * @access  Private
 */
router.post('/bulk-import', validateBody(bulkImportLaceSchema), asyncHandler(bulkImportLace));

export default router;
