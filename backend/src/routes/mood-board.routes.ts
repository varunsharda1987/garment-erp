/**
 * Mood Board Routes
 * API routes for mood board functionality
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
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
router.get('/', authenticateToken, getAll);
router.post('/', authenticateToken, create);
router.get('/:id', authenticateToken, getById);
router.patch('/:id', authenticateToken, update);
router.delete('/:id', authenticateToken, deleteMoodBoard);

// Item management
router.post('/:id/items', authenticateToken, uploadStyleImage, addItem);
router.post('/:id/items/bulk-update', authenticateToken, bulkUpdateItems);
router.patch('/:id/items/:itemId', authenticateToken, updateItem);
router.delete('/:id/items/:itemId', authenticateToken, deleteItem);

export default router;
