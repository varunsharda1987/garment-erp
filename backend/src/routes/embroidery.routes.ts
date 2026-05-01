import { Router } from 'express';
import {
  createEmbroidery,
  getAllEmbroidery,
  getEmbroideryById,
  updateEmbroidery,
  deleteEmbroidery,
  searchEmbroidery,
} from '../controllers/embroidery.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { createEmbroiderySchema, updateEmbroiderySchema, embroideryQuerySchema } from '../schemas/embroidery.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/embroidery
 * @desc    Create a new embroidery design
 * @access  Private
 */
router.post('/', validateBody(createEmbroiderySchema), asyncHandler(createEmbroidery));

/**
 * @route   GET /api/embroidery
 * @desc    Get all embroidery designs with pagination and search
 * @access  Private
 * @query   page, limit, search, supplierId, isActive
 */
router.get('/', validateQuery(embroideryQuerySchema), asyncHandler(getAllEmbroidery));

/**
 * @route   GET /api/embroidery/search
 * @desc    Search embroidery designs for picker/dropdown (minimal data)
 * @access  Private
 * @query   search, limit
 */
router.get('/search', asyncHandler(searchEmbroidery));

/**
 * @route   GET /api/embroidery/:id
 * @desc    Get single embroidery design by ID
 * @access  Private
 */
router.get('/:id', validateParams(idParamSchema), asyncHandler(getEmbroideryById));

/**
 * @route   PUT /api/embroidery/:id
 * @desc    Update embroidery design
 * @access  Private
 */
router.put('/:id', validateParams(idParamSchema), validateBody(updateEmbroiderySchema), asyncHandler(updateEmbroidery));

/**
 * @route   DELETE /api/embroidery/:id
 * @desc    Delete embroidery design (only if not used in any style)
 * @access  Private
 */
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteEmbroidery));

export default router;
