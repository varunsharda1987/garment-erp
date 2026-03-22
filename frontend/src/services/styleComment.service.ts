/**
 * Style Comment Service
 * API service for style comments/collaboration functionality
 */

import api from '../lib/api';
import type {
  StyleComment,
  StyleCommentsResponse,
  StyleCommentResponse,
  StyleCommentActivity,
  StyleCommentActivityResponse,
  CreateStyleCommentDTO,
  UpdateStyleCommentDTO,
} from '../types/styleComment.types';

export const styleCommentService = {
  /**
   * Get all comments for a style
   */
  getComments: async (styleId: string): Promise<StyleComment[]> => {
    const response = await api.get<StyleCommentsResponse>(`/styles/${styleId}/comments`);
    return response.data.data;
  },

  /**
   * Create a new comment
   */
  createComment: async (styleId: string, data: CreateStyleCommentDTO): Promise<StyleComment> => {
    const response = await api.post<StyleCommentResponse>(`/styles/${styleId}/comments`, data);
    return response.data.data;
  },

  /**
   * Update a comment
   */
  updateComment: async (styleId: string, commentId: string, data: UpdateStyleCommentDTO): Promise<StyleComment> => {
    const response = await api.patch<StyleCommentResponse>(`/styles/${styleId}/comments/${commentId}`, data);
    return response.data.data;
  },

  /**
   * Delete a comment
   */
  deleteComment: async (styleId: string, commentId: string): Promise<void> => {
    await api.delete(`/styles/${styleId}/comments/${commentId}`);
  },

  /**
   * Get recent activity (comments across all styles)
   */
  getRecentActivity: async (limit?: number): Promise<StyleCommentActivity[]> => {
    const response = await api.get<StyleCommentActivityResponse>(`/styles/comments/activity`, {
      params: { limit: limit || 20 },
    });
    return response.data.data;
  },
};

export default styleCommentService;
