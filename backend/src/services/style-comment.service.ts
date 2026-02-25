/**
 * Style Comment Service
 * Manages threaded comments on styles for team collaboration
 */
import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../errors';
import { logError, logInfo, logDebug } from '../utils/logger';

export interface CreateStyleCommentDTO {
  comment: string;
  parentId?: string;
}

export interface UpdateStyleCommentDTO {
  comment: string;
}

export interface StyleCommentWithReplies {
  id: string;
  styleId: string;
  userId: string;
  comment: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  replies: StyleCommentWithReplies[];
}

class StyleCommentService {
  /**
   * Create a new comment on a style
   */
  async create(styleId: string, userId: string, data: CreateStyleCommentDTO): Promise<object> {
    try {
      logDebug('Creating style comment', { styleId, userId, data });

      // Verify style exists
      const style = await prisma.styles.findUnique({ where: { id: styleId } });
      if (!style) {
        throw new NotFoundError('Style', styleId);
      }

      // If parentId provided, verify parent comment exists
      if (data.parentId) {
        const parentComment = await prisma.style_comments.findFirst({
          where: { id: data.parentId, styleId },
        });
        if (!parentComment) {
          throw new ValidationError('Parent comment not found');
        }
      }

      const comment = await prisma.style_comments.create({
        data: {
          styleId,
          userId,
          comment: data.comment,
          parentId: data.parentId || null,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      logInfo('Style comment created successfully', { id: comment.id, styleId });
      return comment;
    } catch (error) {
      logError('Failed to create style comment', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get all top-level comments for a style with nested replies
   */
  async getByStyleId(styleId: string): Promise<StyleCommentWithReplies[]> {
    try {
      // Verify style exists
      const style = await prisma.styles.findUnique({ where: { id: styleId } });
      if (!style) {
        throw new NotFoundError('Style', styleId);
      }

      // Get top-level comments (no parent) with their replies
      const comments = await prisma.style_comments.findMany({
        where: {
          styleId,
          parentId: null, // Only top-level comments
        },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          replies: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              replies: {
                orderBy: { createdAt: 'asc' },
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      return comments as unknown as StyleCommentWithReplies[];
    } catch (error) {
      logError('Failed to get style comments', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update a comment (only by the author)
   */
  async update(styleId: string, commentId: string, userId: string, data: UpdateStyleCommentDTO): Promise<object> {
    try {
      logDebug('Updating style comment', { styleId, commentId, userId, data });

      // Verify comment exists and belongs to style
      const existing = await prisma.style_comments.findFirst({
        where: { id: commentId, styleId },
      });
      if (!existing) {
        throw new NotFoundError('Style Comment', commentId);
      }

      // Verify user is the author
      if (existing.userId !== userId) {
        throw new ValidationError('You can only edit your own comments');
      }

      const comment = await prisma.style_comments.update({
        where: { id: commentId },
        data: {
          comment: data.comment,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      logInfo('Style comment updated successfully', { id: comment.id });
      return comment;
    } catch (error) {
      logError('Failed to update style comment', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete a comment (only by the author)
   * Cascade deletes all replies
   */
  async delete(styleId: string, commentId: string, userId: string): Promise<void> {
    try {
      logDebug('Deleting style comment', { styleId, commentId, userId });

      // Verify comment exists and belongs to style
      const existing = await prisma.style_comments.findFirst({
        where: { id: commentId, styleId },
      });
      if (!existing) {
        throw new NotFoundError('Style Comment', commentId);
      }

      // Verify user is the author
      if (existing.userId !== userId) {
        throw new ValidationError('You can only delete your own comments');
      }

      // Delete comment (cascade deletes replies via Prisma schema)
      await prisma.style_comments.delete({
        where: { id: commentId },
      });

      logInfo('Style comment deleted successfully', { id: commentId });
    } catch (error) {
      logError('Failed to delete style comment', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get recent activity (comments) across all styles
   * Used for dashboard activity feed
   */
  async getRecentActivity(limit: number = 20): Promise<object[]> {
    try {
      const comments = await prisma.style_comments.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          style: {
            select: {
              id: true,
              styleCode: true,
              styleName: true,
            },
          },
        },
      });

      return comments;
    } catch (error) {
      logError('Failed to get recent activity', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get comment count for a style
   */
  async getCommentCount(styleId: string): Promise<number> {
    try {
      const count = await prisma.style_comments.count({
        where: { styleId },
      });
      return count;
    } catch (error) {
      logError('Failed to get comment count', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

export const styleCommentService = new StyleCommentService();
