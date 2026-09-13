/**
 * Mood Board Routes
 * API routes for mood board functionality
 */
import { Router } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import { uploadStyleImage } from '../middleware/upload.middleware';
import { idParamSchema, idAndItemIdParamSchema } from '../schemas/common.schema';
import {
  create,
  getAll,
  getById,
  update,
  deleteMoodBoard,
  addItem,
  updateItem,
  deleteItem,
  bulkUpdateItems,
} from '../controllers/mood-board.controller';
import {
  bulkUpdateMoodBoardItemsSchema,
  createMoodBoardSchema,
  updateMoodBoardSchema,
  createMoodBoardItemSchema,
  updateMoodBoardItemSchema,
} from '../schemas/moodBoard.schema';

const router = Router();

// Mood board CRUD
router.get('/', authenticateToken, asyncHandler(getAll));
router.post(
  '/',
  authenticateToken,
  requirePermission('styles'),
  validateBody(createMoodBoardSchema),
  asyncHandler(create)
);
router.get('/:id', authenticateToken, validateParams(idParamSchema), asyncHandler(getById));
router.patch(
  '/:id',
  authenticateToken,
  requirePermission('styles'),
  validateParams(idParamSchema),
  validateBody(updateMoodBoardSchema),
  asyncHandler(update)
);
router.delete(
  '/:id',
  authenticateToken,
  requirePermission('styles'),
  validateParams(idParamSchema),
  asyncHandler(deleteMoodBoard)
);

// Item management
// NOTE: validateBody must run AFTER uploadStyleImage — multer is what populates
// req.body for the multipart/form-data (image upload) variant of this endpoint.
router.post(
  '/:id/items',
  authenticateToken,
  requirePermission('styles'),
  validateParams(idParamSchema),
  uploadStyleImage,
  validateBody(createMoodBoardItemSchema),
  asyncHandler(addItem)
);
router.post(
  '/:id/items/bulk-update',
  authenticateToken,
  requirePermission('styles'),
  validateParams(idParamSchema),
  validateBody(bulkUpdateMoodBoardItemsSchema),
  asyncHandler(bulkUpdateItems)
);
router.patch(
  '/:id/items/:itemId',
  authenticateToken,
  requirePermission('styles'),
  validateParams(idAndItemIdParamSchema),
  validateBody(updateMoodBoardItemSchema),
  asyncHandler(updateItem)
);
router.delete(
  '/:id/items/:itemId',
  authenticateToken,
  requirePermission('styles'),
  validateParams(idAndItemIdParamSchema),
  asyncHandler(deleteItem)
);

export default router;
