/**
 * AI Validation Schemas
 *
 * Zod schemas for AI-powered features.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// AI CHAT SCHEMAS
// ============================================================================

const ConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});

/**
 * Chat
 * POST /api/ai/chat
 */
export const chatSchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000),
  conversationHistory: z.array(ConversationMessageSchema).optional().default([]),
});

/**
 * Chat Persistent
 * POST /api/ai/chat/persistent
 */
export const chatPersistentSchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000),
  conversationId: z.string().uuid('Invalid conversation ID').optional(),
});

/**
 * AI Feedback
 * POST /api/ai/feedback
 */
export const feedbackSchema = z.object({
  messageId: z.string().uuid('Invalid message ID'),
  rating: z.enum(['HELPFUL', 'NOT_HELPFUL']),
  issueType: z.string().max(50).optional(),
  comment: z.string().max(1000).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ChatInput = z.infer<typeof chatSchema>;
export type ChatPersistentInput = z.infer<typeof chatPersistentSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
