/**
 * Style Comment Controller
 * Handles HTTP requests for style comments/collaboration
 */
import { Request, Response } from 'express';
import { styleCommentService } from '../services/style-comment.service';
import { NotFoundError, ValidationError } from '../errors';
import { logError } from '../utils/logger';

/**
 * Create a new comment on a style
 * POST /api/styles/:styleId/comments
 */
export const createComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    const userId = req.user?.userId;
    const { comment, parentId } = req.body;

    if (!userId) {
      throw new ValidationError('User authentication required');
    }

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      throw new ValidationError('Comment text is required');
    }

    const newComment = await styleCommentService.create(styleId, userId, {
      comment: comment.trim(),
      parentId,
    });

    res.status(201).json({
      data: newComment,
      message: 'Comment added successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to create comment');
  }
};

/**
 * Get all comments for a style
 * GET /api/styles/:styleId/comments
 */
export const getComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    const comments = await styleCommentService.getByStyleId(styleId);

    res.status(200).json({
      data: comments,
    });
  } catch (error) {
    handleError(res, error, 'Failed to get comments');
  }
};

/**
 * Update a comment
 * PATCH /api/styles/:styleId/comments/:commentId
 */
export const updateComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId, commentId } = req.params;
    const userId = req.user?.userId;
    const { comment } = req.body;

    if (!userId) {
      throw new ValidationError('User authentication required');
    }

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      throw new ValidationError('Comment text is required');
    }

    const updatedComment = await styleCommentService.update(styleId, commentId, userId, {
      comment: comment.trim(),
    });

    res.status(200).json({
      data: updatedComment,
      message: 'Comment updated successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to update comment');
  }
};

/**
 * Delete a comment
 * DELETE /api/styles/:styleId/comments/:commentId
 */
export const deleteComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId, commentId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new ValidationError('User authentication required');
    }

    await styleCommentService.delete(styleId, commentId, userId);

    res.status(200).json({
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to delete comment');
  }
};

/**
 * Get recent activity (comments across all styles)
 * GET /api/styles/comments/activity
 */
export const getRecentActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const activity = await styleCommentService.getRecentActivity(limit);

    res.status(200).json({
      data: activity,
    });
  } catch (error) {
    handleError(res, error, 'Failed to get recent activity');
  }
};

/**
 * Error handler helper
 */
function handleError(res: Response, error: unknown, defaultMessage: string): void {
  if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
  } else if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
  } else {
    logError(defaultMessage, error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: defaultMessage });
  }
}
