/**
 * Mood Board Routes
 * API routes for mood board functionality
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
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
import { bulkUpdateMoodBoardItemsSchema } from '../schemas/moodBoard.schema';

const router = Router();

// Mood board CRUD
router.get('/', authenticateToken, asyncHandler(getAll));
router.post('/', authenticateToken, asyncHandler(create));
router.get('/:id', authenticateToken, validateParams(idParamSchema), asyncHandler(getById));
router.patch('/:id', authenticateToken, validateParams(idParamSchema), asyncHandler(update));
router.delete('/:id', authenticateToken, validateParams(idParamSchema), asyncHandler(deleteMoodBoard));

// Item management
router.post('/:id/items', authenticateToken, validateParams(idParamSchema), uploadStyleImage, asyncHandler(addItem));
router.post(
  '/:id/items/bulk-update',
  authenticateToken,
  validateParams(idParamSchema),
  validateBody(bulkUpdateMoodBoardItemsSchema),
  asyncHandler(bulkUpdateItems)
);
router.patch('/:id/items/:itemId', authenticateToken, validateParams(idAndItemIdParamSchema), asyncHandler(updateItem));
router.delete(
  '/:id/items/:itemId',
  authenticateToken,
  validateParams(idAndItemIdParamSchema),
  asyncHandler(deleteItem)
);

export default router;
