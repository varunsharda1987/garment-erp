/**
 * Mood Board Routes
 * API routes for mood board functionality
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { uploadStyleImage } from '../middleware/upload.middleware';
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

const router = Router();

// Mood board CRUD
router.get('/', authenticateToken, asyncHandler(getAll));
router.post('/', authenticateToken, asyncHandler(create));
router.get('/:id', authenticateToken, asyncHandler(getById));
router.patch('/:id', authenticateToken, asyncHandler(update));
router.delete('/:id', authenticateToken, asyncHandler(deleteMoodBoard));

// Item management
router.post('/:id/items', authenticateToken, uploadStyleImage, asyncHandler(addItem));
router.post('/:id/items/bulk-update', authenticateToken, asyncHandler(bulkUpdateItems));
router.patch('/:id/items/:itemId', authenticateToken, asyncHandler(updateItem));
router.delete('/:id/items/:itemId', authenticateToken, asyncHandler(deleteItem));

export default router;
