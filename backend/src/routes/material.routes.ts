// Material Management Routes
import { Router } from 'express';
import {
  createMaterial,
  getAllMaterials,
  getMaterialById,
  updateMaterial,
  deleteMaterial,
  getAllCategories,
  getCategoryHierarchy,
  createCategory,
} from '../controllers/material.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createMaterialSchema,
  updateMaterialSchema,
  materialQuerySchema,
  materialIdParamSchema,
  createCategorySchema,
  categoryQuerySchema,
} from '../schemas/material.schema';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/materials/categories/hierarchy
 * @desc    Get category hierarchy (parents with children)
 * @access  Private (Authenticated users)
 */
router.get('/categories/hierarchy', asyncHandler(getCategoryHierarchy));

/**
 * @route   GET /api/materials/categories
 * @desc    Get all material categories (optionally filter by parentId)
 * @access  Private (Authenticated users)
 * @query   parentId - Optional UUID to filter by parent category
 */
router.get('/categories', validateQuery(categoryQuerySchema), asyncHandler(getAllCategories));

/**
 * @route   POST /api/materials/categories
 * @desc    Create material category
 * @access  Private (Authenticated users)
 */
router.post('/categories', validateBody(createCategorySchema), asyncHandler(createCategory));

/**
 * @route   POST /api/materials
 * @desc    Create new material
 * @access  Private (Authenticated users)
 */
router.post('/', validateBody(createMaterialSchema), asyncHandler(createMaterial));

/**
 * @route   GET /api/materials
 * @desc    Get all materials with pagination, search, and filters
 * @access  Private (Authenticated users)
 */
router.get('/', validateQuery(materialQuerySchema), asyncHandler(getAllMaterials));

/**
 * @route   GET /api/materials/:id
 * @desc    Get material by ID
 * @access  Private (Authenticated users)
 */
router.get('/:id', validateParams(materialIdParamSchema), asyncHandler(getMaterialById));

/**
 * @route   PUT /api/materials/:id
 * @desc    Update material
 * @access  Private (Authenticated users)
 */
router.put(
  '/:id',
  validateParams(materialIdParamSchema),
  validateBody(updateMaterialSchema),
  asyncHandler(updateMaterial)
);

/**
 * @route   DELETE /api/materials/:id
 * @desc    Delete material (soft delete)
 * @access  Private (Authenticated users)
 */
router.delete('/:id', validateParams(materialIdParamSchema), asyncHandler(deleteMaterial));

export default router;
