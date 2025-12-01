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
import { createMaterialSchema, updateMaterialSchema, materialQuerySchema, materialIdParamSchema } from '../schemas/material.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/materials/categories/hierarchy
 * @desc    Get category hierarchy (parents with children)
 * @access  Private (Authenticated users)
 */
router.get('/categories/hierarchy', getCategoryHierarchy);

/**
 * @route   GET /api/materials/categories
 * @desc    Get all material categories (optionally filter by parentId)
 * @access  Private (Authenticated users)
 */
router.get('/categories', getAllCategories);

/**
 * @route   POST /api/materials/categories
 * @desc    Create material category
 * @access  Private (Authenticated users)
 */
router.post('/categories', createCategory);

/**
 * @route   POST /api/materials
 * @desc    Create new material
 * @access  Private (Authenticated users)
 */
router.post('/', validateBody(createMaterialSchema), createMaterial);

/**
 * @route   GET /api/materials
 * @desc    Get all materials with pagination, search, and filters
 * @access  Private (Authenticated users)
 */
router.get('/', validateQuery(materialQuerySchema), getAllMaterials);

/**
 * @route   GET /api/materials/:id
 * @desc    Get material by ID
 * @access  Private (Authenticated users)
 */
router.get('/:id', validateParams(materialIdParamSchema), getMaterialById);

/**
 * @route   PUT /api/materials/:id
 * @desc    Update material
 * @access  Private (Authenticated users)
 */
router.put('/:id', validateParams(materialIdParamSchema), validateBody(updateMaterialSchema), updateMaterial);

/**
 * @route   DELETE /api/materials/:id
 * @desc    Delete material (soft delete)
 * @access  Private (Authenticated users)
 */
router.delete('/:id', validateParams(materialIdParamSchema), deleteMaterial);

export default router;
