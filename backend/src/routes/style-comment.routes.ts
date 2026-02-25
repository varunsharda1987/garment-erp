/**
 * Style Comment Routes
 * API routes for style collaboration/comments
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  createComment,
  getComments,
  updateComment,
  deleteComment,
  getRecentActivity,
} from '../controllers/style-comment.controller';

const router = Router();

// Activity feed (static route must come before parameterized routes)
router.get('/comments/activity', authenticateToken, getRecentActivity);

// Style-specific comment routes
router.get('/:styleId/comments', authenticateToken, getComments);
router.post('/:styleId/comments', authenticateToken, createComment);
router.patch('/:styleId/comments/:commentId', authenticateToken, updateComment);
router.delete('/:styleId/comments/:commentId', authenticateToken, deleteComment);

export default router;
