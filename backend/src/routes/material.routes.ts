// Material Management Routes
import { Router } from 'express';
import {
  createMaterial,
  getAllMaterials,
  getMaterialById,
  updateMaterial,
  deleteMaterial,
  getAllCategories,
  createCategory,
} from '../controllers/material.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/materials/categories
 * @desc    Get all material categories
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
router.post('/', createMaterial);

/**
 * @route   GET /api/materials
 * @desc    Get all materials with pagination, search, and filters
 * @access  Private (Authenticated users)
 */
router.get('/', getAllMaterials);

/**
 * @route   GET /api/materials/:id
 * @desc    Get material by ID
 * @access  Private (Authenticated users)
 */
router.get('/:id', getMaterialById);

/**
 * @route   PUT /api/materials/:id
 * @desc    Update material
 * @access  Private (Authenticated users)
 */
router.put('/:id', updateMaterial);

/**
 * @route   DELETE /api/materials/:id
 * @desc    Delete material (soft delete)
 * @access  Private (Authenticated users)
 */
router.delete('/:id', deleteMaterial);

export default router;
