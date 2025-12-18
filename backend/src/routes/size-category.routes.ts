import { Router } from 'express';
import {
  getAllSizeCategories,
  getSizeCategoryById,
  createSizeCategory,
  updateSizeCategory,
  deleteSizeCategory,
} from '../controllers/size-category.controller';

const router = Router();

// GET /api/size-categories - Get all size categories
router.get('/', getAllSizeCategories);

// GET /api/size-categories/:id - Get size category by ID
router.get('/:id', getSizeCategoryById);

// POST /api/size-categories - Create new size category
router.post('/', createSizeCategory);

// PUT /api/size-categories/:id - Update size category
router.put('/:id', updateSizeCategory);

// DELETE /api/size-categories/:id - Delete size category
router.delete('/:id', deleteSizeCategory);

export default router;
