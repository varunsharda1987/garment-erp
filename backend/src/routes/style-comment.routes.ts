/**
 * Style Comment Routes
 * API routes for style collaboration/comments
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateParams } from '../middleware/validation.middleware';
import {
  createComment,
  getComments,
  updateComment,
  deleteComment,
  getRecentActivity,
} from '../controllers/style-comment.controller';
import { styleIdAsStyleIdParamSchema, styleAndCommentIdParamSchema } from '../schemas/style.schema';

const router = Router();

// Activity feed (static route must come before parameterized routes)
router.get('/comments/activity', authenticateToken, asyncHandler(getRecentActivity));

// Style-specific comment routes
router.get(
  '/:styleId/comments',
  authenticateToken,
  validateParams(styleIdAsStyleIdParamSchema),
  asyncHandler(getComments)
);
router.post(
  '/:styleId/comments',
  authenticateToken,
  validateParams(styleIdAsStyleIdParamSchema),
  asyncHandler(createComment)
);
router.patch(
  '/:styleId/comments/:commentId',
  authenticateToken,
  validateParams(styleAndCommentIdParamSchema),
  asyncHandler(updateComment)
);
router.delete(
  '/:styleId/comments/:commentId',
  authenticateToken,
  validateParams(styleAndCommentIdParamSchema),
  asyncHandler(deleteComment)
);

export default router;
