/**
 * AI Conversation Service
 *
 * Handles CRUD operations for AI conversations and messages.
 * Provides persistent memory for AI chat sessions.
 */

import { ConversationStatus, AIMessageRole, FeedbackRating, ActionStatus, Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { logInfo, logError } from '../../utils/logger';

// Types
export interface CreateConversationInput {
  userId: string;
  title?: string;
}

export interface CreateMessageInput {
  conversationId: string;
  role: AIMessageRole;
  content: string;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  latencyMs?: number;
  actionType?: string;
  actionEntity?: string;
  actionPayload?: Record<string, unknown>;
  actionStatus?: ActionStatus;
  metadata?: Record<string, unknown>;
}

export interface CreateFeedbackInput {
  messageId: string;
  userId: string;
  rating: FeedbackRating;
  issueType?: string;
  comment?: string;
}

export interface ConversationListParams {
  userId: string;
  status?: ConversationStatus;
  limit?: number;
  offset?: number;
  search?: string;
}

// Service class
class ConversationService {
  /**
   * Create a new conversation
   */
  async createConversation(input: CreateConversationInput) {
    try {
      const conversation = await prisma.ai_conversations.create({
        data: {
          userId: input.userId,
          title: input.title || 'New Chat',
          status: 'ACTIVE',
          lastMessageAt: new Date(),
        },
      });

      logInfo('[ConversationService] Created conversation:', conversation.id);
      return conversation;
    } catch (error) {
      logError('[ConversationService] Failed to create conversation:', error);
      throw error;
    }
  }

  /**
   * Get conversations for a user
   */
  async getConversations(params: ConversationListParams) {
    try {
      const { userId, status = 'ACTIVE', limit = 50, offset = 0, search } = params;

      const where: Record<string, unknown> = {
        userId,
        status,
      };

      // Add search filter if provided
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { messages: { some: { content: { contains: search, mode: 'insensitive' } } } },
        ];
      }

      const [conversations, total] = await Promise.all([
        prisma.ai_conversations.findMany({
          where,
          orderBy: { lastMessageAt: 'desc' },
          take: limit,
          skip: offset,
          include: {
            _count: {
              select: { messages: true },
            },
          },
        }),
        prisma.ai_conversations.count({ where }),
      ]);

      return { conversations, total };
    } catch (error) {
      logError('[ConversationService] Failed to get conversations:', error);
      throw error;
    }
  }

  /**
   * Get a single conversation with messages
   */
  async getConversation(conversationId: string, userId: string) {
    try {
      const conversation = await prisma.ai_conversations.findFirst({
        where: {
          id: conversationId,
          userId, // Ensure user can only access their own conversations
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              feedback: true,
            },
          },
        },
      });

      return conversation;
    } catch (error) {
      logError('[ConversationService] Failed to get conversation:', error);
      throw error;
    }
  }

  /**
   * Update conversation (title, status)
   */
  async updateConversation(conversationId: string, userId: string, data: { title?: string; status?: ConversationStatus }) {
    try {
      // Verify ownership
      const existing = await prisma.ai_conversations.findFirst({
        where: { id: conversationId, userId },
      });

      if (!existing) {
        throw new Error('Conversation not found or access denied');
      }

      const conversation = await prisma.ai_conversations.update({
        where: { id: conversationId },
        data,
      });

      logInfo('[ConversationService] Updated conversation:', conversationId);
      return conversation;
    } catch (error) {
      logError('[ConversationService] Failed to update conversation:', error);
      throw error;
    }
  }

  /**
   * Soft delete a conversation (set status to DELETED)
   */
  async deleteConversation(conversationId: string, userId: string) {
    try {
      // Verify ownership
      const existing = await prisma.ai_conversations.findFirst({
        where: { id: conversationId, userId },
      });

      if (!existing) {
        throw new Error('Conversation not found or access denied');
      }

      const conversation = await prisma.ai_conversations.update({
        where: { id: conversationId },
        data: { status: 'DELETED' },
      });

      logInfo('[ConversationService] Soft deleted conversation:', conversationId);
      return conversation;
    } catch (error) {
      logError('[ConversationService] Failed to delete conversation:', error);
      throw error;
    }
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(input: CreateMessageInput) {
    try {
      const message = await prisma.ai_messages.create({
        data: {
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          provider: input.provider,
          model: input.model,
          tokensUsed: input.tokensUsed,
          latencyMs: input.latencyMs,
          actionType: input.actionType,
          actionEntity: input.actionEntity,
          actionPayload: input.actionPayload as Prisma.InputJsonValue | undefined,
          actionStatus: input.actionStatus,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      // Update conversation's lastMessageAt
      await prisma.ai_conversations.update({
        where: { id: input.conversationId },
        data: { lastMessageAt: new Date() },
      });

      // Auto-generate title from first user message if no title set
      const conversation = await prisma.ai_conversations.findUnique({
        where: { id: input.conversationId },
      });

      if (conversation && (!conversation.title || conversation.title === 'New Chat') && input.role === 'USER') {
        const autoTitle = input.content.slice(0, 50) + (input.content.length > 50 ? '...' : '');
        await prisma.ai_conversations.update({
          where: { id: input.conversationId },
          data: { title: autoTitle },
        });
      }

      return message;
    } catch (error) {
      logError('[ConversationService] Failed to add message:', error);
      throw error;
    }
  }

  /**
   * Get messages for a conversation (with pagination for long conversations)
   */
  async getMessages(conversationId: string, userId: string, limit = 100, offset = 0) {
    try {
      // Verify ownership
      const conversation = await prisma.ai_conversations.findFirst({
        where: { id: conversationId, userId },
      });

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      const messages = await prisma.ai_messages.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: offset,
        include: {
          feedback: true,
        },
      });

      return messages;
    } catch (error) {
      logError('[ConversationService] Failed to get messages:', error);
      throw error;
    }
  }

  /**
   * Add feedback to a message
   */
  async addFeedback(input: CreateFeedbackInput) {
    try {
      // Check if feedback already exists
      const existing = await prisma.ai_feedback.findFirst({
        where: {
          messageId: input.messageId,
          userId: input.userId,
        },
      });

      if (existing) {
        // Update existing feedback
        const feedback = await prisma.ai_feedback.update({
          where: { id: existing.id },
          data: {
            rating: input.rating,
            issueType: input.issueType,
            comment: input.comment,
          },
        });
        return feedback;
      }

      // Create new feedback
      const feedback = await prisma.ai_feedback.create({
        data: {
          messageId: input.messageId,
          userId: input.userId,
          rating: input.rating,
          issueType: input.issueType,
          comment: input.comment,
        },
      });

      logInfo('[ConversationService] Added feedback for message:', input.messageId);
      return feedback;
    } catch (error) {
      logError('[ConversationService] Failed to add feedback:', error);
      throw error;
    }
  }

  /**
   * Get conversation history formatted for AI context
   * Returns last N messages in a format suitable for AI prompt
   */
  async getConversationContext(conversationId: string, maxMessages = 10) {
    try {
      const messages = await prisma.ai_messages.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: maxMessages,
        select: {
          role: true,
          content: true,
        },
      });

      // Reverse to get chronological order
      return messages.reverse();
    } catch (error) {
      logError('[ConversationService] Failed to get conversation context:', error);
      throw error;
    }
  }

  /**
   * Archive old conversations (for cleanup job)
   */
  async archiveOldConversations(daysOld: number) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.ai_conversations.updateMany({
        where: {
          status: 'ACTIVE',
          lastMessageAt: { lt: cutoffDate },
        },
        data: { status: 'ARCHIVED' },
      });

      logInfo(`[ConversationService] Archived ${result.count} old conversations`);
      return result.count;
    } catch (error) {
      logError('[ConversationService] Failed to archive old conversations:', error);
      throw error;
    }
  }

  /**
   * Permanently delete old archived conversations (for cleanup job)
   */
  async purgeDeletedConversations(daysOld: number) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.ai_conversations.deleteMany({
        where: {
          status: 'DELETED',
          updatedAt: { lt: cutoffDate },
        },
      });

      logInfo(`[ConversationService] Purged ${result.count} deleted conversations`);
      return result.count;
    } catch (error) {
      logError('[ConversationService] Failed to purge deleted conversations:', error);
      throw error;
    }
  }

  /**
   * Get statistics for a user's AI usage
   */
  async getUserStats(userId: string) {
    try {
      const [totalConversations, totalMessages, feedbackStats] = await Promise.all([
        prisma.ai_conversations.count({ where: { userId, status: 'ACTIVE' } }),
        prisma.ai_messages.count({
          where: { conversation: { userId } },
        }),
        prisma.ai_feedback.groupBy({
          by: ['rating'],
          where: { userId },
          _count: true,
        }),
      ]);

      return {
        totalConversations,
        totalMessages,
        feedbackStats: feedbackStats.reduce((acc, item) => {
          acc[item.rating] = item._count;
          return acc;
        }, {} as Record<string, number>),
      };
    } catch (error) {
      logError('[ConversationService] Failed to get user stats:', error);
      throw error;
    }
  }
}

export const conversationService = new ConversationService();
