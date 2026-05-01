import { Router } from 'express';
import {
  getAllSizeCategories,
  getSizeCategoryById,
  createSizeCategory,
  updateSizeCategory,
  deleteSizeCategory,
} from '../controllers/size-category.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import { createSizeCategorySchema, updateSizeCategorySchema } from '../schemas/sizeCategory.schema';
import { authenticateToken } from '../middleware/auth.middleware';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// Apply authentication to all size category routes
router.use(authenticateToken);

// GET /api/size-categories - Get all size categories
router.get('/', asyncHandler(getAllSizeCategories));

// GET /api/size-categories/:id - Get size category by ID
router.get('/:id', validateParams(idParamSchema), asyncHandler(getSizeCategoryById));

// POST /api/size-categories - Create new size category
router.post('/', validateBody(createSizeCategorySchema), asyncHandler(createSizeCategory));

// PUT /api/size-categories/:id - Update size category
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateSizeCategorySchema),
  asyncHandler(updateSizeCategory)
);

// DELETE /api/size-categories/:id - Delete size category
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteSizeCategory));

export default router;
