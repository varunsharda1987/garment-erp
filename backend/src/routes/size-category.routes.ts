import { Router } from 'express';
import {
  getAllSizeCategories,
  getSizeCategoryById,
  createSizeCategory,
  updateSizeCategory,
  deleteSizeCategory,
} from '../controllers/size-category.controller';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// GET /api/size-categories - Get all size categories
router.get('/', asyncHandler(getAllSizeCategories));

// GET /api/size-categories/:id - Get size category by ID
router.get('/:id', asyncHandler(getSizeCategoryById));

// POST /api/size-categories - Create new size category
router.post('/', asyncHandler(createSizeCategory));

// PUT /api/size-categories/:id - Update size category
router.put('/:id', asyncHandler(updateSizeCategory));

// DELETE /api/size-categories/:id - Delete size category
router.delete('/:id', asyncHandler(deleteSizeCategory));

export default router;
