/**
 * Style Comment Routes
 * API routes for style collaboration/comments
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import {
  createComment,
  getComments,
  updateComment,
  deleteComment,
  getRecentActivity,
} from '../controllers/style-comment.controller';

const router = Router();

// Activity feed (static route must come before parameterized routes)
router.get('/comments/activity', authenticateToken, asyncHandler(getRecentActivity));

// Style-specific comment routes
router.get('/:styleId/comments', authenticateToken, asyncHandler(getComments));
router.post('/:styleId/comments', authenticateToken, asyncHandler(createComment));
router.patch('/:styleId/comments/:commentId', authenticateToken, asyncHandler(updateComment));
router.delete('/:styleId/comments/:commentId', authenticateToken, asyncHandler(deleteComment));

export default router;
